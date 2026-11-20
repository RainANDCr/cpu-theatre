# 测试报告

**项目**：CPU THEATRE — A Visual Journey Inside the Processor
**版本**：Phase 10（最终交付）
**日期**：2026-11-19

> 现状摘要（能力 / 限制 / 人工清单）见 [STATUS.md](STATUS.md)；本文只负责「怎么测、测出了什么」。

**结论**：311 个单元/组件用例 + 35 个端到端用例全部通过；验收 A–E 全部有可复现断言；
生产产物离线运行零外部请求。

## 1. 环境

| 项 | 值 |
| --- | --- |
| 操作系统 | Windows（本地） |
| Node.js | v22.22.2 |
| 浏览器 | Microsoft Edge（Chromium，无头 CDP 驱动） |
| 构建 | Vite 8 / TypeScript 7 / React 19 |
| 测试 | Vitest 5 + jsdom + Testing Library |

## 2. 总览

```
Test Files  23 passed (23)
     Tests  311 passed (311)
  Duration  23.7s
```

| 套件 | 用例 | 覆盖内容 |
| --- | ---: | --- |
| `isa/encoding.test.ts` | 59 | 27 条指令编码↔解码往返；畸形字节的 INS/ADR 判定 |
| `seq/seq.test.ts` | 21 | 验收 A/B/C、栈与调用、异常、Step Back、复位 |
| `assembler/assembler.test.ts` | 19 | 验收程序逐字节、标签、诊断、错误恢复 |
| `assembler/directives.test.ts` | 32 | `.pos`/`.org`/`.align`/`.quad`/`.string` 布局、空洞填零、转义、诊断 |
| `assembler/asum.test.ts` | 8 | 教材 Figure 4.7 的 18 条地址逐行对拍；SEQ/PIPE 终态一致 |
| `assembler/examples.test.ts` | 8 | 7 个内置示例逐个真实汇编，防止示例腐坏 |
| `isa/parser.test.ts` | 19 | 语法、操作数形态、行列定位 |
| `pipe/pipe.test.ts` | 16 | 验收 D 对拍、转发、加载互锁、分支恢复 |
| `cpu/memory.test.ts` | 16 | 小端读写、跨边界越界、访问通知 |
| `store/cpu-store.test.ts` | 14 | 装载、单步、断点、回退、源码变更重载 |
| `isa/conditions.test.ts` | 10 | 7 种条件的真值表 |
| `execution/alu.test.ts` | 9 | 四种运算与三标志 |
| `cpu/register-file.test.ts` | 9 | RNONE 读写语义、写回 |
| `core/word.test.ts` | 8 | 64 位截断、符号扩展 |
| `isa/instructions.test.ts` | 7 | 表自身的一致性（无重复 opcode、长度与形态一致） |
| `perf/perf.test.ts` | 6 | 长程执行、复杂度、内存占用 |
| `store/settings-store.test.ts` | 6 | 持久化、复位、面板尺寸 |
| `ui/*.test.tsx`（5 个） | 32 | 路由、模拟器空态与执行、编辑器汇编、学习中心、设置 |
| `core/registers.test.ts` | 5 | 寄存器编号与名称映射 |
| `ui/i18n-theme.test.tsx` | 7 | 三档语言结构一致、`html[lang]`、双语片段 `lang="en"`、主题开关与持久化 |
| **合计** | **311** | |

## 3. 验收用例

### 测试 A — 简单加法

```asm
irmovq $10, %rax
irmovq $20, %rbx
addq %rax, %rbx
halt
```

| 断言 | 结果 |
| --- | --- |
| `%rax = 10` | ✅ |
| `%rbx = 30` | ✅ |
| `Stat = HLT` | ✅ |
| `addq` 六阶段均有真实数据 | ✅ |

位置：`tests/seq/seq.test.ts:19-64`

### 测试 B — 内存读写

| 断言 | 结果 |
| --- | --- |
| 地址 100–107 为 123 的小端字节 `7B 00 00 00 00 00 00 00` | ✅ |
| `%rcx = 123` | ✅ |
| 写内存前记录了旧值（供回退） | ✅ |

位置：`tests/seq/seq.test.ts:66-93`

### 测试 C — 条件跳转

| 断言 | 结果 |
| --- | --- |
| `subq` 相等后 `je` 生效 | ✅ |
| `%rcx = 2` | ✅ |
| 条件不成立时顺序执行、`%rcx = 1` | ✅ |

位置：`tests/seq/seq.test.ts:95-133`

### 测试 D — SEQ 与 PIPE 终态一致

对 8 个程序逐一对比寄存器、内存、条件码、PC、Stat：

| 程序 | 结果 |
| --- | --- |
| 简单加法 / 内存读写 / 条件跳转（验收 A/B/C） | ✅ |
| 栈与 call/ret | ✅ |
| 加载后立即使用（触发互锁） | ✅ |
| 连续条件传送 | ✅ |
| 长循环 | ✅ |
| 异常程序（ADR / INS） | ✅ |

位置：`tests/pipe/pipe.test.ts:110+`

> 允许周期数不同：SEQ 每条指令 1 拍，PIPE 有填充与冒险开销。

### 测试 E — Step Back 精确回退

| 断言 | 结果 |
| --- | --- |
| 回退后 `pc` / `registers` / `cc` / `stat` / `cycle` 逐字段相等 | ✅ |
| 回退会撤销内存写入 | ✅ |
| 初始状态回退返回 `false` | ✅ |
| `rewindTo(0)` 回到刚装载的状态 | ✅ |
| 回退后重新执行结果相同 | ✅ |

位置：`tests/seq/seq.test.ts:206-260`

浏览器端实测（生产产物）：单步两次后 `%rax=0xA, %rbx=0x14`，回退一次后 `%rbx=0x0`、Cycle 回到 1。

### 教材对拍 — Figure 4.7 `asum.ys`

不是「另写一段能跑的程序」，而是把教材印刷的地址表当成断言：

| 锚点 | 教材值 | 本实现 |
| --- | --- | --- |
| `init` / `call main` / `halt` | 0x000 / 0x00A / 0x013 | ✅ 相同 |
| `.align 8` 后的 `array` | 0x018 | ✅ 相同 |
| `array` 四个 `.quad` | 0x018 / 0x020 / 0x028 / 0x030 | ✅ 相同 |
| `main` / `call sum` / `ret` | 0x038 / 0x04C / 0x055 | ✅ 相同 |
| `loop` / `jne loop` | 0x077 / 0x087 | ✅ 相同 |
| `stack` | 0x200 | ✅ 相同，镜像 512 字节 |
| 首 19 字节机器码 | `30 f4 00 02…` + `80 38 00…` | ✅ 逐字节相同 |
| SEQ 与 PIPE 终态 | `%rax` = 四常量之和，`%rsp`=0x200 | ✅ 一致 |

位置：`tests/assembler/asum.test.ts`。这条测试同时守住了 `.align`、`.quad`、
`call` 的定长编码和地址布局——任何一处偏差都会让整张表错位。

## 3.5 端到端与视觉回归（Playwright）

单元测试只能证明「函数算得对」，证明不了「用户点得到、看得见」。这 22 个用例补的是后者。

```bash
npm run test:e2e          # 30 用例，约 39 秒
npm run test:e2e:update   # 重建视觉基线
```

| 文件 | 用例 | 证明的事 |
| --- | ---: | --- |
| `e2e/simulator.spec.ts` | 5 | 空态不编数据；单步只走一条；**回退真的恢复状态**；跑完 = 验收 A；断点在目标指令前停住 |
| `e2e/offline.spec.ts` | 1 | 九个模块逐个访问：非 localhost 请求一律 abort 并断言为空；console error 与页面异常为空 |
| `e2e/hidpi.spec.ts` | 4 | 125%（1536×864）/150%（1280×720）下，DPR 生效、无横向溢出、单步与汇编仍正确 |
| `e2e/i18n-theme.spec.ts` | 5 | 三档语言切换（结构不变）、双语对照块、浅色主题对比度 ≥ 4.5、次级行对比度、偏好持久化 |
| `e2e/mobile.spec.ts` | 2 | 390px 下汉堡开抽屉、ESC 关闭并归还焦点；选模块后自动收起；无横向溢出 |
| `e2e/editor.spec.ts` | 6 | 默认示例出 `30 F0 0A` / 23 B；输错代码给出诊断**与建议**；Ctrl+Enter 等价于点按钮；数据段示例的 `.quad` 进 Listing；字符串示例落盘为 UTF-8；精简 bundle 后撤销与查找仍可用 |
| `e2e/pipeline.spec.ts` | 3 | 空态五列各有职责说明；推进五拍后五列装着**不同**指令，顶栏显示 `PIPE / CYCLE 5` 而不是 `SEQ / OFFLINE`；无横向溢出 |
| `e2e/logic.spec.ts` | 3 | AND/OR/XOR 真值随输入变化；ALU 台算 `5−3=2` 与 `0−1` 的全 1 |
| `e2e/learning.spec.ts` | 2 | 标记已读后刷新仍在；自测答对/答错各有反馈 |
| `e2e/visual.spec.ts` | 4 | Overview / Logic / Pipeline 空态 / Settings 的像素基线 |

三个刻意的取舍：

1. **默认跑 dev，发版前跑构建产物。** `E2E_TARGET=preview` 让同一套用例在 `dist` 上再跑
   一遍，「源码能跑」不等于「打出来的包能跑」；两种目标都验证过。
2. **视觉基线只覆盖不含 Monaco 与实时数据的页面。** 编辑器的光标、高亮 token 数、
   日志里的周期数，每次截图都可能差几像素；那种基线报的警大多是噪声。
3. **基线是本机字体渲染的产物**（`*-win32.png`）。换机器或 Edge 大版本后用
   `test:e2e:update` 重建，并在提交信息里写明原因。

稳定性：`--repeat-each=2` 连跑 60 次全绿；`reducedMotion` 与固定面板尺寸在
每个页面加载前写入 localStorage，消除「上次运行留下的宽度」这类隐性差异。

### 服务目标与 CI

E2E 默认跑 dev，CI 跑**构建产物**——「源码能跑」与「打出来的包能跑」是两件事。

| 命令 | 目标 | 项目 | 用途 |
| --- | --- | --- | --- |
| `npm run test:e2e` | dev | functional + visual | 本地日常 |
| `npm run test:e2e:prod` | preview（需先 build） | functional | 发版前 / CI |
| `npm run test:e2e:update` | dev | visual | 重建基线 |

`.github/workflows/ci.yml` 的顺序是：`npm ci` → lint → typecheck → 单元测试 →
`npm run build` → 安装 Chromium → `E2E_TARGET=preview` 跑 `functional`。
视觉基线不进 CI：它绑定本机字体渲染，跨平台必然产生假失败。

**实测**：26 个 functional 用例在 `dist` 产物上全过（约 17s）；visual 基线在 dev 与
preview 两种目标下都通过，说明二者渲染一致，基线不必绑定服务类型。

> 这个 workflow **尚未在真实 GitHub Runner 上执行过**。已做的是：YAML 结构自检、
> `npm ci --dry-run` 验证锁文件同步、本地以 `CI` 相同的命令跑通 functional。
> 首次推送后请以 Actions 日志为准。

## 3.6 桌面外壳（Electron）

Web 版能跑不等于「双击 exe 能跑」。`electron/main.cjs` 注册 `cpu://app/` 标准 scheme
从 `dist/` 读文件（`file://` 下绝对路径会 404，且模块 Worker 被同源策略挡住），
并提供 `--smoke` 无头自检：

| 检查 | 结果 |
| --- | --- |
| 首页 `#root` 渲染出内容 | ✅ `title` 与模块标题正确 |
| 编辑器出现 `.view-line` | ✅ 5 行（Monaco worker 在 `cpu://` 下正常） |
| 深链 `/pipeline` 直开 | ✅ 回落到 `index.html` 并渲染 |
| 打包后 exe 同一套自检 | ✅ 三项全过 |

产物：`release/CPU THEATRE-win32-x64`，`app.asar` 3.6 MB，目录 363 MB（含 Electron 运行时），
免安装、可整目录拷贝。未做 NSIS 安装包、代码签名与跨机器验证。

## 4. 性能

程序：`irmovq $20000, %rcx` + 20,000 次 `subq/jne` 循环 + `halt`（40,003 条指令）。

| 指标 | 实测 | 阈值 |
| --- | --- | --- |
| SEQ 执行 40,003 条 | 173 ms | < 20 s（只防病理级退化，不做基准） |
| SEQ 吞吐 | ≈ 230,000 条/秒 | — |
| PIPE 执行 40,009 拍 | 245 ms | 周期 ≤ SEQ×6 |
| PIPE CPI | 1.0002 | 0.5 – 2 |
| 转发次数 | 20,001 | ≥ 2 |
| 气泡 | 1（循环最后一次 `jne` 预测失败） | — |
| 单条历史序列化体积 | 约 0.4 KB | < 1.2 KB（内存副本会到 20 KB 以上） |

「单步耗时保持平稳」用例先预热 500 步，再各取 2000 步对比「历史 700 条」与「历史 2 万条」时的单步耗时，倍数上限 8×——平方级实现会差两个数量级。样本取大是因为单步约 30 ns，小样本的计时噪声会直接淹没信号（曾因此误报失败）。

## 5. 离线与兼容性

**离线验证**：对 `vite preview` 的生产产物依次访问 9 个页面并在编辑器执行一次汇编，通过 CDP 记录全部请求：

```
请求总数: 39 | 去重: 14
外部请求: 无
加载失败: 无
控制台错误: 无
汇编结果可见: true
```

15 个请求全部是 `localhost` 下的 JS/CSS/字体/worker，零 CDN、零字体外链。

**布局兼容性**（`scrollWidth === innerWidth`，无横向溢出）：

| 视口 | 页面 | 结果 |
| --- | --- | --- |
| 1920 / 1600 / 1440 / 1280 | Simulator、Editor | ✅ |
| 390 / 320 | Overview、Editor | ✅ |

窄屏下侧栏自动收成图标栏，编辑器工具栏把主操作固定在右侧。

## 6. 静态检查

```
oxlint: 112 files, 0 warnings, 0 errors (116 rules)
tsc -b: 0 error
npm audit: 0 vulnerabilities
```

`npm audit` 为 0 是通过 `overrides` 把 monaco-editor 内置的 dompurify 顶到 3.4.18 得到的；
上游目前没有发布带修复的 monaco 版本，该 override 已实测不影响编辑器功能。

## 7. 产物体积

| 文件 | 原始 | gzip |
| --- | ---: | ---: |
| `index.js`（首屏） | 447 KB | 145 KB |
| `monacoRuntime.js`（懒加载） | 2.7 MB | 697 KB |
| `editor.worker.js`（懒加载） | 294 KB | 89 KB |
| `index.css` | 59 KB | 10 KB |
| dist 合计 | 3.46 MB | — |

Monaco 只在进入编辑器/模拟器页时加载，首屏不为它付费。dist 中另有 81 个 1–16 KB 的语言定义分块（solidity、pascaligo 等），它们是 monaco 基础语言包按需动态导入的产物，本项目不注册这些语言，永远不会被请求——离线验证的 15 个请求可佐证。

## 8. 已知限制

1. **CI 工作流未经真实 runner 验证**：配置已按本地实测命令写好，但 GitHub Actions 上
   尚未跑过一次。首次推送后可能需要小幅调整（例如 runner 上的 Chromium 版本、字体差异
   导致 `functional` 里的文本断言不稳）。视觉基线不在 CI 中，跨平台问题被绕开而非解决。
2. **性能用例阈值宽**：目的是抓复杂度回归，不是精确基准；不同机器上数字会波动。
3. **移动端只覆盖导航**：<1024px 使用抽屉式导航并验证无横向溢出，但数据通路图在 390px 下仍以缩放呈现，尚未做逐模块的触屏手势优化。
4. **诊断无列号**：只有行号，列级定位需要 parser 保留列信息。
5. **伪指令覆盖有限**：已支持 `.pos` / `.org` / `.align` / `.quad` / `.string`（2026-11-19 补齐），
   但 `.byte` / `.word` 仍未实现。
