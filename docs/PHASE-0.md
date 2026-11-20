# Phase 00 交付报告

**阶段**：项目基础架构
**状态**：完成
**日期**：2026-11-16

---

## 一、本阶段完成内容

### 1. 工程骨架

- Vite 8 + React 19 + TypeScript 7（原生编译器）工程，`tsconfig.app.json` 显式开启 `strict`
  与 `noImplicitOverride`（模板默认并未开启 `strict`，已补上）。
- 路由：`react-router-dom` 7，九个模块各占一个路由，未知路径落到 404 页面。
- 构建：`tsc -b && vite build` 通过，产物 `dist/` 约 318KB JS（gzip 103KB）。

### 2. 设计系统

- Tailwind CSS 4 的 CSS-first 令牌（`@theme`），颜色按硬件语义命名：
  `bus`（数据）/ `ctrl`（控制）/ `reg`（寄存器）/ `alu`（运算）/ `ok` / `err` / `warn`。
- 强调色可切换（blue / purple / cyan / amber），通过 `:root[data-accent]` 实现，
  不污染语义色。
- 基础组件：`Panel`、`Badge`、`Button`、`Readout`、`Metric`、`SectionHeading`。
- 全局动效：`pulse-soft`、`dash`（总线虚线流动）、`rise`（页面进入），
  并尊重 `prefers-reduced-motion`。

### 3. 应用外壳

- 侧栏：九个模块、当前项强调条、模块序号、可折叠（窄屏自动折叠）、
  底部引擎状态卡（如实标注 offline）。
- 顶栏：模块编号 / 名称 / 一句话职责，右侧 MODE / STATUS / CYCLE / PC 四个读数。
  引擎未接入时 CYCLE 与 PC 显示 `—`，STATUS 显示 OFFLINE，不显示 0。
- 底部状态条：`local only · y86-64 · 64-bit · little-endian · stage 00`。
- 渲染错误边界：视图崩溃时给出可读提示，而不是白屏。

### 4. 状态容器（Zustand 5）

| Store | 职责 | 说明 |
| --- | --- | --- |
| `cpuStore` | 运行时视图：模式、引擎状态、周期、PC、Stat | 不含任何执行逻辑；`EngineState` 与 `Stat` 分离 |
| `editorStore` | 汇编源码、当前示例、脏标记 | Phase 2 接入汇编器后扩展 |
| `settingsStore` | 强调色、减少动效、网格、速度、侧栏 | `persist` 到 localStorage，键名 `cpu-theatre:settings` |

### 5. 核心地基：64 位字表示

`src/core/cpu/word.ts` 建立 `Word = bigint` 的表示层，并强制所有新值经过 `asWord`
截断到 64 位——这是后续所有算术、条件码、地址计算正确性的前提。
附 8 个单元测试覆盖补码截断、符号位、值域边界。

### 6. 页面

- **Overview（可用）**：主视觉、三条设计铁律、十一阶段路线图（当前 1/11）、
  架构分层、验收用例 A–E（全部 pending，明确写出「一条都还没点亮」）。
- **Settings（可用）**：强调色、减少动效、动画速度、网格、侧栏折叠、恢复默认，
  全部真实生效并持久化。
- **其余七个模块（占位）**：统一模板，列出「将构建什么 / 当前状态 / 相关模块」，
  不摆放任何演示数据。

### 7. 示例程序

`src/lib/y86-examples.ts` 内置四段程序（加法、内存读写、条件跳转、栈与 call/ret），
Phase 2 的汇编器测试会直接复用，因此已校对为合法 Y86-64 子集。

---

## 二、新增 / 修改的文件

**配置**

- `package.json`（重写：名称、脚本、`overrides` 修正 dompurify 漏洞）
- `vite.config.ts`（重写：Tailwind 插件 + Vitest 配置）
- `tsconfig.app.json`（补 `strict`、`noImplicitOverride`、`DOM.Iterable`，纳入 `tests`）
- `index.html`（重写：标题、描述、暗色首屏、中文 lang）
- `public/favicon.svg`（重写：芯片风格图标）

**源码（36 个文件）**

- `src/main.tsx`、`src/App.tsx`、`src/index.css`
- `src/core/cpu/word.ts`
- `src/store/{cpu,editor,settings}Store.ts`
- `src/config/{nav,project}.ts`
- `src/lib/{cn,y86-examples}.ts`、`src/hooks/useMediaQuery.ts`
- `src/components/layout/{AppShell,Sidebar,TopBar,ConsoleBar,ChipMark,ErrorBoundary}.tsx`
- `src/components/ui/{Panel,Badge,Button,buttonStyles,Readout,SectionHeading}.tsx`
  （`buttonStyles.ts` 是拆出来的：`<Link>` 需要按钮外观但不能是 `<button>`，
  拆开后 `Button.tsx` 只导出组件，Fast Refresh 保持有效）
- `src/components/dashboard/DieSchematic.tsx`
- `src/pages/` 11 个页面文件

**测试（5 个文件、29 个用例）**

- `tests/setup.ts`、`tests/core/word.test.ts`、`tests/store/{cpu-store,settings-store}.test.ts`、
  `tests/ui/{navigation,settings-page}.test.tsx`

**文档**

- `README.md`、`docs/ARCHITECTURE.md`、`docs/ROADMAP.md`、`docs/PHASE-0.md`

**清理**：删除 Vite 模板自带的 `App.css`、`src/assets/*`、`public/icons.svg`。

---

## 三、已通过的测试

```
Test Files  5 passed (5)
     Tests  29 passed (29)
  Duration  ~9.7s
```

| 文件 | 用例 | 覆盖点 |
| --- | --- | --- |
| `tests/core/word.test.ts` | 8 | 补码截断、符号位、有符号重解释、十六进制/二进制格式、值域 |
| `tests/store/settings-store.test.ts` | 5 | 默认值、强调色切换、侧栏幂等切换、持久化不含函数、恢复默认 |
| `tests/store/cpu-store.test.ts` | 6 | 空读数不伪造、`—` 占位、PC 格式、快照投影、切模式清视图、reset 不冒充就绪 |
| `tests/ui/navigation.test.tsx` | 6 | 九个导航项、默认路由、离线读数、导航跳转、占位页标注、404 |
| `tests/ui/settings-page.test.tsx` | 4 | 强调色写 DOM + localStorage、开关无障碍语义、恢复默认、档位 aria-pressed |

其他检查：

- `npx tsc -b`：通过（0 error）。
- `npm run build`：通过，2556 modules，CSS 41.0KB / JS 318.0KB（gzip 103KB）。
- `npx oxlint`：0 warnings / 0 errors（42 个文件）。
- `npm audit`：0 vulnerabilities（见下方说明）。
- 视觉验收：用无头 Edge 以 1600×1050 截取三个页面并逐局部检查；窄屏改用 CDP
  设备模拟测量（Edge 无头窗口最小约 496px，直接 `--window-size=390` 得到的是裁切图，
  会误判为溢出）。实测 390px 与 320px 两个宽度下 `document.scrollWidth === innerWidth`，
  溢出元素数为 0。

---

## 四、验收中发现并修复的问题

1. **主标语断行事故**：`UNDERSTAND THE MACHINE.` 在 1600px 下被挤成两行，`MACHINE.`
   孤立成第三行，且 `UNDERSTAND` 与后半句颜色不一致，看起来像渲染错误。
   → 改为「两句各占一行」的 lockup，第二句主动缩小一号并使用统一色，`whitespace-nowrap`
   配合分级字号，1600 / 1024 / 375 三个宽度下均不溢出。
2. **开关关闭态对比度过低**：滑块用 `ink-3`，在深色轨道上像被禁用。
   → 改 `ink-2` 滑块 + `line/70` 轨道。
3. **速度档位选中态可读性差**：`bg-accent/15` + `text-accent` 属于蓝字压蓝底。
   → 改为 `bg-accent` + `text-void`，对比度接近主按钮。
4. **320px 下横向溢出**：`whitespace-nowrap` 的标题把 grid 列撑到 361px（视口 320），
   连带 21 个元素溢出。根因是 grid item 的 `min-width: auto` 会采用内容的 min-content 宽度。
   → 标题改用 `clamp(21px, 7.6vw, 30px)` 随视口收缩，再测 320 / 390 均为 0 溢出。
5. **窄屏顶栏折行**：`MODULE 01 / OVERVIEW` 在 320px 下换成两行，与 CYCLE 读数挤在一起。
   → 模块编号在 `sm` 以下隐藏，标签加 `whitespace-nowrap`，副标题走 `truncate`。
6. **lint 暴露的两个真问题**：
   - `useMediaQuery` 在 effect 里同步 `setState`，首帧多一次渲染。→ 改用 `useSyncExternalStore`
     订阅 `matchMedia`，这本就是外部数据源的正确接法。
   - `Button.tsx` 同时导出组件与样式函数，破坏 Fast Refresh。→ 样式函数拆到 `buttonStyles.ts`。

已确认不是问题：
- 截图中侧栏左缘的「蓝色竖线」经像素采样为缩放伪影（x=0 处实际为 `#080E19`）。
- 390px 截图看似溢出，实为无头窗口最小宽度导致的裁切，CDP 实测为 0 溢出。

---

## 五、尚未解决的问题

1. **monaco-editor 的传递依赖**：monaco 0.56/0.57 内置的 dompurify 3.4.8 命中多个 XSS 公告，
   上游暂无更新版本。已通过 `overrides` 将 dompurify 顶到 3.4.18，`npm audit` 归零。
   风险：monaco 内部若依赖 3.4.8 的具体行为，未来可能出现兼容问题；Phase 2 接入编辑器时需实测
   hover 文档与命令面板是否正常。
2. **Mobile 体验仅做到「不塌」**：侧栏在 1024px 以下自动折叠为图标栏，但还没有抽屉式导航；
   Phase 1 布局工作时一并处理。
3. **没有 E2E 测试**：当前只有组件级测试。视觉回归（截图对比）留到 Phase 10，
   避免早期频繁改版产生大量快照噪音。
4. **`npm run dev` 的管道问题**：用 `npm run dev | head` 启动会让 Vite 在管道关闭后退出，
   属预期行为，不影响正常使用；截图脚本改用 `npx vite --port` 直接启动。

---

## 六、下一阶段计划（Phase 1：界面与视觉舞台）

1. 三栏可拖拽布局：编辑器 / CPU 舞台 / 观察器，面板宽度可调并持久化。
2. CPU 舞台静态 SVG：PC、指令内存、寄存器文件、ALU、数据内存、条件码、控制逻辑、
   数据总线与地址总线；每个模块可点击查看说明（内容为静态说明，数值留空）。
3. 寄存器面板与内存面板的**空态设计**：表头、编号、格式全部就位，数值位显示 `—`。
4. 执行控制栏：Run / Pause / Step / Reset / Step Back 按钮就位，未接入引擎时禁用并说明原因。
5. 指令编辑器外壳：Monaco 本地打包接入 + Y86-64 语法高亮（编译功能留到 Phase 2）。
6. 时间轴与日志区的骨架。
7. 验收：布局在 1280 / 1600 / 1920 三档下无横向滚动；空态不出现任何假数值；
   新增布局与空态测试；`npm run build` 与全部测试保持绿色。
