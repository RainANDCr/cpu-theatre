# Phase 02 交付报告 — Y86-64 指令集

> 目标：把教材第 4 章的 ISA 变成一套**可被逐条验证**的核心模块。
> 这一阶段没有执行引擎，但之后 SEQ 与 PIPE 的全部正确性都压在这里。

---

## 一、本阶段完成内容

### 1. 指令表（唯一事实来源）

`src/core/isa/instructions.ts` 用一张表描述 27 条指令：`icode`、`ifun`、操作数形态、
编码长度、类别、条件码语义、标准写法、一句话说明。

- 27 条 = 教材 Figure 4.3 全集（`nop`/`halt` + 7 条传送 + 4 条运算 + 7 条跳转 + `call`/`ret` + 2 条栈）。
- 编码长度**由操作数形态推导**（`FORM_LENGTH`），不在别处重复写 `10` 或 `9`。
- `findSpecByOpcode` 查不到就返回 `null`，绝不做「同 icode 回退」——`0x2F` 必须是 INS。

指令表的单一来源原则落实到了三处消费方：Monaco 高亮、`CodeSurface` 降级视图、
汇编器。改指令只改一处。

### 2. 编解码器（严格对称）

`decoder.ts` / `encoder.ts` 互为逆运算，`tests/isa/encoding.test.ts` 对 27 条指令逐条做
往返一致性测试，并对照教材 Figure 4.2 的字节序列做定点验证。

解码器只返回两种失败：

| 情形 | 结果 | 对应 Stat |
| --- | --- | --- |
| `(icode, ifun)` 不在表里 | `status: 'INS'` | INS |
| 字节不够读完一条指令 / 取指越界 | `status: 'ADR'` | ADR |

### 3. 解析器与两遍扫描汇编器

- `parser.ts`：只做**语法**——剥注释、收集标签、识别助记符、把操作数归类成
  寄存器编号或待解析的 token。它不碰地址。
- `labels.ts` + `assembler.ts`：第一遍按长度推进地址建标签表，第二遍解析符号并编码。

之所以必须两遍：`je target` 可以写在 `target:` 之前。而 Y86-64 的指令长度与符号值无关
（跳转 9 字节、立即数 10 字节都是定长），所以第一遍就能算准所有地址——这是定长编码
相对 x86 变长编码的直接好处。

### 4. 程序员可见状态

| 模块 | 内容 |
| --- | --- |
| `RegisterFile.ts` | 15 个 64 位寄存器，写入强制截断到 64 位 |
| `Memory.ts` | `Uint8Array` 64 KiB，字节寻址、小端 8 字节读写、整体跨度越界检查、访问订阅 |
| `ConditionCodes.ts` | ZF / SF / OF，复位全 0 |
| `Status.ts` | AOK / HLT / ADR / INS + `isFault` / `isTerminal` |
| `execution/alu.ts` | add / sub / and / xor 与条件码产生 |
| `isa/conditions.ts` | 7 种条件的真值判断，cmov 与 jXX 共用 |

### 5. 编辑器接通汇编

Instruction Editor 从「静态外壳」升级成可用的编译器前端：

- 工具栏「汇编」按钮 + `Ctrl/Cmd + Enter`，失败自动跳到诊断页；
- 底部输出面板三个标签页：**Listing**（地址 / 长度 / 机器码 / 源行 / 规范化指令）、
  **Symbols**（标签名 / 地址 / 十进制 / 定义行）、**Diagnostics**（按行号排序，带修正建议）；
- 源码改动后结果标记 `stale`，不悄悄把旧机器码当新程序。

---

## 二、两个值得记下来的设计判断

### 1. RNONE：解码器宽容，汇编器严格

上一阶段遗留的问题——`rA:rB` 里的 `0xF` 该不该报非法——最终这样处理：

- **解码器照实记录**。`0xF` 是合法的 4-bit 字段，硬件会读它，只是语义上用不上
  （`irmovq` 的 valA 被丢弃、`pushq` 的 rB 不参与运算）。解码时「纠正」成 RNONE
  反而会掩盖真实字节，让「改了机器码为什么行为不变」这类问题无从排查。
- **汇编器绝不生成**。用户写不出 `%rnone`，语法层只接受 15 个真实寄存器名。
- **语义落在寄存器文件**：`read(RNONE) === 0n`、`write(RNONE)` 是空操作。
  这正是教材 `dstE != RNONE` 的写法，SEQ 与 PIPE 因此不必各自判断一遍。

### 2. 减法方向写进函数签名

`computeAlu(op, valA, valB)` 的参数名是 `valA` / `valB` 而不是 `a` / `b`，
因为 `subq %rax, %rbx` 是 `%rbx − %rax`——**目的操作数在左**，与直觉相反。
参数名一旦含糊，这个 bug 会以「某些减法结果反了」的形式潜伏很久。

---

## 三、验收对照

### 程序 A：简单加法

```
irmovq $10, %rax     30 F0 0A 00 00 00 00 00 00 00
irmovq $20, %rbx     30 F3 14 00 00 00 00 00 00 00
addq %rax, %rbx      60 03
halt                 10
```

地址 `0x0 / 0xA / 0x14 / 0x16`，共 23 字节。

### 程序 B：内存读写

```
irmovq $100, %rax    30 F0 64 00 00 00 00 00 00 00
irmovq $123, %rbx    30 F3 7B 00 00 00 00 00 00 00
rmmovq %rbx, 0(%rax) 40 30 00 00 00 00 00 00 00 00
mrmovq 0(%rax), %rcx 50 10 00 00 00 00 00 00 00 00
halt                 10
```

注意 `mrmovq` 的第二字节是 `0x10`：rA 是目的（`%rcx`=1），rB 是基址（`%rax`=0）。
这条曾经被我写反过，是测试把它拦下来的。

### 程序 C：条件跳转

```
0x00  irmovq $10, %rax
0x0A  irmovq $10, %rbx
0x14  subq %rax, %rbx
0x16  je target         73 2A 00 00 00 00 00 00 00
0x1F  irmovq $1, %rcx
0x29  halt
0x2A  target: irmovq $2, %rcx
0x34  halt
```

`je` 的 8 字节目标是小端 `0x2A`，向前引用被正确解析。

---

## 四、测试

| 文件 | 用例 | 覆盖 |
| --- | --- | --- |
| `tests/isa/instructions.test.ts` | 7 | 数量、唯一性、长度表、条件映射、非法 ifun |
| `tests/isa/encoding.test.ts` | 27 + 12 | 教材字节序列、逐条往返、INS/ADR、反汇编 |
| `tests/isa/parser.test.ts` | 19 | 标签、注释、操作数形态、诊断与建议 |
| `tests/isa/conditions.test.ts` | 10 | 7 条件 × 7 组标志的完整真值表 |
| `tests/assembler/assembler.test.ts` | 14 | 三个验收程序的逐字节断言、标签、诊断、基址 |
| `tests/cpu/memory.test.ts` | 16 | 小端、跨度越界、装载、快照、访问通知 |
| `tests/cpu/register-file.test.ts` | 9 | RNONE 语义、截断、快照 |
| `tests/execution/alu.test.ts` | 9 | 四种运算、OF 的三种情形、减法方向 |
| `tests/ui/editor-page.test.tsx` | 5 | 汇编闭环、失败跳诊断、符号表、stale |

全量：**16 个文件 / 195 个用例通过**；`tsc -b` 0 error；`oxlint` 0 warning / 0 error。

浏览器实测（无头 Edge + CDP，1600×1000）：点「汇编」后 Listing 出现 4 行、
`30 F0 0A …` 与 `0x0/0xA/0x14/0x16` 均正确；输入一段错误程序后自动切到 Diagnostics，
显示 `L2 未知指令 "movq" → 是不是想写 "rrmovq"？` 与 `L3 "5" 不是立即数`。
1280 与 390 宽度下均无横向溢出。

---

## 五、本阶段发现并修掉的问题

1. **解码器把跳转目标当寄存器字节读**：`jXX`/`call` 是 9 字节，走进了「长度 ≥ 2 就读
   rA:rB」的分支，导致 `je 0x2A` 解出 `rA=2, rB=10`。改为按操作数形态判断。
2. **`mrmovq` 的 rA:rB 断言写反**：测试期望 `50 01`，实际应是 `50 10`。
   错的是测试，不是汇编器——这正好说明「按语义推导期望值」比「按记忆写期望值」可靠。
3. **字节列截断到 8 字节**：10 字节指令正好把立即数藏起来，而立即数是核对编码的关键。
   改为整条显示。
4. **窄屏工具栏把「汇编」推出屏幕**：示例列表横向滚动时把右侧操作组一起推走了。
   改为示例区自己滚动、操作组固定在右侧。

---

## 六、尚未解决

> 2026-11-19 更新：第 1、2 条已补上——新增 `.pos` / `.org` / `.quad` 伪指令，
> 见 `src/core/isa/parser.ts` 的 `parseDirective` 与 `tests/assembler/directives.test.ts`。

1. **`.pos` 伪指令未实现**：无法把代码放到非零地址（`assemble` 已支持 `baseAddress`
   参数，但没有对应语法）。留到需要展示「代码与数据同处一块内存」时再加。
2. **没有 `.quad` / `.string` 数据段**：教材的 `yas` 支持，但 Y86-64 教学程序可以
   用 `irmovq` + `rmmovq` 构造数据，暂不引入。
3. **诊断没有列号**：目前只报行号。要精确到列需要在解析时记录 token 偏移。
4. **`unused-nibble` 诊断码已定义但未启用**：Phase 3 若要在执行前对非规范编码
   （例如 `irmovq` 的 rA ≠ RNONE）给出提示，可以直接用这个码。

---

## 七、下一阶段（Phase 03：SEQ 执行引擎）

1. 六个阶段的纯函数：`fetch` / `decode` / `execute` / `memory` / `writeback` / `pcUpdate`，
   每阶段**接收状态、返回新状态 + 该阶段的数据通路记录**（供 Phase 4 的动画直接消费）。
2. `SEQProcessor`：持有 PC / 寄存器 / 内存 / 条件码 / Stat，`step()` 执行一条指令并返回
   完整快照；`run()` / `reset()`；ADR / INS 的终止语义。
3. 与汇编器对接：`assemble().image` 直接 `load` 进内存，PC 从 `baseAddress` 开始。
4. 验收 A/B/C 三项在 SEQ 上的执行结果断言，外加 `pushq`/`popq`/`call`/`ret` 的栈语义。

一个需要先定下来的问题：**`step()` 的返回粒度**。是返回「执行前 + 执行后」两个完整快照
（简单、内存翻倍），还是返回「执行前快照 + 变化量」（省内存、但回退时要重放）？
Phase 5 的 Step Back 要连续回退上百步，这个选择会直接决定它的实现复杂度。
