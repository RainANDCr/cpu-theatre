# Phase 03–10 交付报告

本文件合并记录 Phase 03 到 Phase 10。前三个阶段各自有独立报告
（`PHASE-0.md` / `PHASE-1.md` / `PHASE-2.md`），从 03 起引擎进入长跑阶段，
按「阶段 + 验收」记录更清楚。

---

## Phase 03：SEQ 六阶段执行引擎

**目标**：一条指令六拍，每一拍的中间值都能被界面读到。

### 实现

`src/core/execution/` 下六个纯函数，输入是「机器状态 + 已译码指令」，输出是该阶段的
全部信号（`valE`、`valM`、`dstE`、`nextPC`…）：

| 文件 | 产物 |
| --- | --- |
| `fetch.ts` | `icode/ifun/rA/rB/valC/valP` |
| `decode.ts` | `valA/valB`、`srcA/srcB/dstE/dstM` |
| `execute.ts` | `valE`、`Cnd`、新条件码 |
| `memory.ts` | `valM`、读写地址 |
| `writeback.ts` | 寄存器写入列表 |
| `pcUpdate.ts` | 下一 PC 与跳转决策 |

`SEQProcessor` 只用这六个函数 + 一次提交，不重复实现任何指令语义。
`step()` 返回 `{ before, after, trace }`，`trace.stages` 记录**实际走到**的阶段
——异常指令会在中途停下，界面据此只点亮走到的那几段。

### 验收

- 程序 A/B/C 的寄存器、内存、Stat 全部吻合（`tests/seq/seq.test.ts`）。
- 栈与 `call/ret`：返回地址压栈、`%rsp` 复原、被调用者改写可见。
- `popq %rsp` 的语义（先 `dstE` 后 `dstM`）单独有用例——这条最容易写反。
- 异常：非法编码置 INS；越界访存置 ADR 且**不写回、不更新 PC**。

### 抓到的 bug

`decode.ts` 里 `dstM` 只对 `mrmovq` 赋值，漏了 `popq`。症状是 `popq %rsp` 弹出后
寄存器值不对——测试里那条「以弹出的值为准」直接把它暴露了。

---

## Phase 04：动态可视化

**目标**：动画由 trace 驱动，不由定时器驱动。

### 实现

- `stageModel.ts` 增加 `STAGE_HIGHLIGHTS`：阶段 → 该点亮的模块与连线。
  改执行语义时这张表自动跟着变，不会出现「动画演 addq、实际执行 subq」。
- `CPUStage` 收到 `stage` 后给对应模块加高亮描边、给连线加流动虚线。
- 被点亮的总线上有沿路径运动的粒子（`animateMotion`，每线 2 颗、错开半个周期），
  颜色沿用数据类型色；开启「减少动效」时不渲染粒子，只保留虚线。
- `useStagePlayback` 把一条指令的 3–6 个阶段按 80–150ms 铺开；连续运行时压缩时长，
  单步时放慢。
- `StageRibbon` 显示本拍走到第几段，异常指令只显示实际到达的阶段。

### 取舍

粒子动画的**位置**来自连线定义，**颜色**来自 `trace.dataType`，**开关**来自
`trace.stages`。三者都不写死在组件里，所以 Phase 7 的 PIPE 视图能复用同一套颜色语义。

---

## Phase 05：调试系统

### 实现

- 历史：`HistoryEntry { before, after, trace, memoryUndo }`。回退不是倒放动画，
  而是把 `before` 快照写回引擎、并用 `memoryUndo` 撤销内存写入。
- `rewindTo(n)` 支持点日志任意一行回到那一拍。
- 断点落在**源码行**上：`assemble()` 返回 `addressToLine`，store 负责行 ↔ 地址换算。
  这样改一行代码不会让断点漂到别的指令上。
- 编辑器沟槽显示红点，当前 PC 所在行整行高亮。
- 「运行」遇到断点会停：判断放在每拍执行**之前**，是执行语义而不是界面装饰。

### 验收

- 回退后 `pc/registers/cc/stat/cycle` 逐字段相等。
- 浏览器实测：单步两次 `%rax=0xA, %rbx=0x14` → 回退 → `%rbx=0x0`、Cycle 1。

---

## Phase 06：PIPE 五阶段引擎

**目标**：真正的流水线，而不是把 SEQ 的结果画成五列。

### 实现

`PIPEProcessor` 持有 F/D/E/M/W 五个流水线寄存器，每拍做四件事：

1. **推进**：W←M←E←D←F，气泡用 `icode=NOP` 且 `stat=BUB` 表示。
2. **转发**：E 段操作数优先取 M 段的 `valE`（ALU 结果），其次 W 段的 `valE`/`valM`。
   计数进 `stats.forwards`。
3. **加载/互锁**：E 段是 `mrmovq`/`popq` 且目的寄存器正被 D 段使用 → 冻结 F、D，
   E 段插入气泡。转发救不了「值还没从内存出来」。
4. **分支恢复**：预测「跳转发生」；E 段算出 `Cnd=0` 时，用 E 的 `valA`（即 `valP`）
   作为下一 PC，并给 D 段插气泡。

`ret` 特殊：返回地址要到 W 段才从内存读出，期间 F 段必须停。

### 验收（测试 D）

8 个程序逐一对比 SEQ 与 PIPE 的终态：寄存器、内存、条件码、PC、Stat 全部一致。
覆盖了纯算术、访存、条件跳转、栈与调用、加载后立即使用、连续条件传送、长循环、异常。

### 抓到的 bug

1. `slotViews()` 混用了「更新前」和「更新后」的寄存器，五列错开一拍——
   看起来像流水线在倒着走。统一成「本拍各段在做什么」。
2. 退休指令计数把 `nop`/`halt` 排除了，CPI 分母偏小。CPI 的分母应该是
   「完成了多少条指令」，含 nop 与 halt。
3. 控制逻辑最初把 `ret` 与加载互锁混在一个分支里，导致 `ret` 在途时 D 段被错误保留。

---

## Phase 07：PIPE 可视化

### 实现

- `pipeStore` 维护 5 个段位、当前拍、最近 12 拍的轨迹、统计。
- `PipelineLab` 五列布局，每列显示该段的指令、关键字段（`valE`/`valM`/`dstE`…）、状态。
- 底部统计条：CPI、Stall、Bubble、Forward、Cycle——全部来自引擎计数，不是估算。
- 周期日志：每拍一行，展开可看五段快照。

### 验收

生产产物实测：装载 → 连点 5 次「下一拍」，五列各自出现不同指令，
CPI 由 `cycles / instructions` 实时计算。

---

## Phase 08：Logic Lab

**目标**：电路实验必须接真实 ALU，而不是另写一套假计算。

### 实现

- 门实验台：AND / OR / NOT / XOR / MUX，输入开关 + 真值表 + 实时输出。
  真值表由同一个 `evaluate()` 生成，不是手写的表。
- ALU 实验台：两个 64 位输入、四种运算，结果与 ZF/SF/OF 直接调用
  `src/core/execution/alu.ts`——和 SEQ/PIPE 用的是同一份实现。
- HCL 片段：`dstE`、`aluA`、`mem_addr` 等控制逻辑用 HCL 写法展示，标注输入与判定条件。

### 修复

真值表最初把布尔值直接渲染成 `true/false`，且 MUX 的三列顺序写错（`s,0,x`）。
改成 `1/0` 并按 `s, x, y` 排列。

---

## Phase 09：Learning Center

### 实现

- 4 个模块：ISA / 逻辑设计 / SEQ / PIPE，共 15 个知识点。
- 每个知识点包含：解释、可运行示例、相关实验入口。
- 8 道自测题，答对答错都有解释；答错可重选。
- 进度按「读过的知识点 + 答过的题」计算，存 localStorage。
- 所有文案原创，未复制教材正文。

### 修复

自测区最初没有语义标签，导致 `getByText('addq')` 同时命中选项和代码示例。
加 `<section aria-label="自测">` 后测试才稳定——这也是无障碍该有的样子。

---

## Phase 10：总测与收尾

### 新增

- `tests/perf/perf.test.ts`：6 个性能用例（长程执行、复杂度、历史内存）。
- `.qa/offline.mjs`：生产产物离线抓包。
- `docs/ISA.md`、`docs/TEST-REPORT.md`、`docs/WINDOWS.md`、本文件。
- 验收清单 A–E 状态改为 `passed`（此前一直是 `pending`，与事实不符）。

### 数字

| 项 | 结果 |
| --- | --- |
| 测试 | 20 文件 / **252 用例全通过**，11.6s |
| 类型 | `tsc -b` 0 error |
| Lint | oxlint 104 文件，0 warning 0 error |
| 审计 | `npm audit` 0 vulnerabilities |
| 构建 | 3.5 MB，首屏 JS 145 KB gzip；Monaco 2.7 MB（懒加载） |
| 离线 | 14 个去重请求全部 localhost，0 外部 |
| 性能 | SEQ 40,003 条 / 173ms；PIPE CPI 1.0002 |

### 修掉的文档问题

- `instructions.ts` 注释写「26 条指令」，实际 27 条（cmov 6 条 + rrmovq 同属 icode 2）。
- README 说 Node 20+，Vite 8 实际要求 22+。
- 验收清单状态与测试事实不一致。

---

## 收尾补强：E2E 与视觉回归

Phase 10 之后的追加项（原计划的 11 个阶段不包含它）：

- `e2e/` 下 20 个 Playwright 用例：模拟器（单步/回退/断点）、编辑器（汇编/诊断/快捷键）、
  流水线（五列同拍）、逻辑实验室（门与 ALU）、学习中心（进度与自测）、四个页面的像素基线。
- 独立 `tsconfig.e2e.json`：E2E 也要过严格类型检查，但不把 node 全局漏进浏览器侧代码。
- 跑 dev server 而非构建产物（避开 `dist` 批量删除限制），基线只覆盖无 Monaco 的页面。

**顺手修掉的真 bug**：装载前点行号下断点会静默失效——`addressToLine` 还是空的。
现在点行号会先汇编再落断点，并有单测（`tests/store/cpu-store.test.ts`）。

## 阶段之外仍存在的限制

1. CI 工作流（`.github/workflows/ci.yml`）已提供，但未在真实 GitHub Runner 上跑过；
   本地以同样的命令（`E2E_TARGET=preview` + `--project=functional`）验证过 16 条用例。
2. 移动端已做抽屉式导航（<1024px，含 ESC、焦点归还、路由自动收起）；数据通路图仍以整体缩放呈现。
3. 诊断只有行号，没有列号。
4. 伪指令实现了 `.pos` / `.org` / `.align` / `.quad` / `.string`；`.byte` / `.word` 等仍不支持。
5. 已实跑 Electron 免安装打包并通过 `--smoke` 自检；未做 NSIS 安装包、代码签名与跨机器验证。
