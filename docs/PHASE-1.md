# Phase 01 交付报告

**阶段**：界面与视觉舞台
**状态**：完成
**日期**：2026-11-17

---

## 一、本阶段完成内容

### 1. 可调三栏工作区（`/simulator`）

- 左：源码视图（Monaco，真编辑器）；中：SEQ 数据通路舞台 + 模块说明；右：寄存器/内存观察器（Tab 切换）；下：周期轴 + 执行日志。
- 两个竖向分隔条 + 一个横向分隔条，可拖拽、可键盘调整（方向键 16px 步进）、双击复位。
- 尺寸写回 `settingsStore` 并持久化；拖拽期间只改本地 draft，松手才落盘（避免每帧写 localStorage）。
- 容器变窄时两侧按比例收缩，保证中间舞台至少 440px；小于 1440px 直接改成纵向堆叠。

### 2. SEQ 数据通路舞台

- 8 个可点击模块：PC、指令内存、寄存器文件、ALU、控制逻辑、数据内存、条件码、状态码。
- 4 类连线按硬件语义着色：数据/地址（蓝）、控制信号（紫，虚线）、寄存器读写（青）、ALU 结果（橙）。
- 总线汇合点画实心圆，箭头方向即数据流向。
- 点击模块 → 下方说明条显示：中文名、英文名、功能、输入列表、输出列表、`当前值 —`。
- 键盘可操作（`role="button"` + Enter/Space），焦点态有可见描边。

### 3. 空态设计（本阶段最重要的一条纪律）

| 区域 | 空态表现 |
| --- | --- |
| 寄存器表 | 15 行列齐、编号与名字就位，数值列一律 `—` |
| 条件码 / Stat | `—`，附 AOF/HLT/ADR/INS 释义 |
| 内存表 | 地址与列头就位，字节格 `··`，底部说明「尚未装载程序」 |
| 周期轴 | 刻度 T0–T17 照常画（坐标轴不是数据），右侧标「尚无执行记录」 |
| 执行日志 | 表头就位，正文只说明「Phase 3 接入后会写什么」 |
| 执行按钮 | 五个按钮全部禁用，外层 `title` 说明原因 |

### 4. 执行控制栏

模式切换（SEQ 可用 / PIPE 禁用并注明 Phase 6）、回退/单步/运行/暂停/重置、动画速度、周期读数、引擎状态灯。
全部按钮的禁用理由都写在 tooltip 里——「为什么不能点」比「不能点」更重要。

### 5. 指令编辑器（`/editor`）

- Monaco 本地打包：worker 从 `node_modules` 走 `?worker` 进入构建，**运行时不请求任何 CDN**。
- 自定义 `y86` 语言：Monarch 分词 + 专属主题（关键字紫、寄存器青、立即数橙、标签蓝、注释灰斜体）。
- 内置四段示例可一键装载；右侧显示汇编输出（空态）、诊断（空态）、以及当前示例「该看什么」。
- 动态 `import()` 拆包：首屏不加载 Monaco；无 `Worker` 环境自动降级为只读源码视图（`CodeSurface`）。

### 6. 寄存器与内存独立页（`/registers`、`/memory`）

从占位页升级为空态可用的工具页：寄存器页含编码顺序说明，内存页含小端序逐字节示例。

### 7. 其他

- 侧栏在 1500px 以下自动收成图标栏：工作台需要横向空间，导航文字让位。
- 新增共享组件：`Segmented`（设置页与速度档位共用）、`Tabs`、`PaneHeader`。

---

## 二、新增 / 修改的文件

**新增（19）**

- `src/components/layout/{SplitWorkspace,PaneHeader}.tsx`
- `src/components/stage/{stageModel.ts,CPUStage,ModuleInspector}.tsx`
- `src/components/controls/ExecutionControls.tsx`
- `src/components/registers/RegisterPanel.tsx`
- `src/components/memory/MemoryPanel.tsx`
- `src/components/timeline/{CycleTimeline,ExecutionLog}.tsx`
- `src/components/editor/{AssemblyEditor,CodeSurface,monacoRuntime}.tsx`
- `src/components/ui/{Segmented,Tabs}.tsx`
- `src/core/isa/registers.ts`
- `tests/core/registers.test.ts`、`tests/ui/simulator.test.tsx`

**重写（4）**：`src/pages/{Simulator,EditorPage,RegisterLab,MemoryExplorer}.tsx`

**修改**：`settingsStore`（面板尺寸 + `setPaneSize`）、`Sidebar`（自适应折叠）、
`vite.config.ts`（剥离 Monaco 语言服务插件）、`config/project.ts`（阶段状态）、
`pages/Overview.tsx`（进度改为计算值、文案更新）、`pages/SettingsPage.tsx`（复用 Segmented）

---

## 三、已验证

```
Test Files  7 passed (7)
     Tests  42 passed (42)
```

其他检查：

- `npx tsc -b`：0 error；`npx oxlint`：0 warning / 0 error（60 文件）。
- `npm run build`：通过。产物 5.3MB（87 个文件），其中
  `index` 353KB（gzip 113KB，首屏）、`monacoRuntime` 3.9MB（gzip 993KB，懒加载）、
  `editor.worker` 301KB。
- **生产产物实测**（`vite preview` + CDP）：Monaco 挂载成功、语法着色 20 个 token、
  模拟键盘输入 `halt` 成功写入、无控制台错误、无错误浮层。
- **视口**：1280 / 1440 / 1600 / 1920 四档下 `document.scrollWidth === innerWidth`，
  无横向溢出；1280 自动切纵向堆叠，1440 起三栏。
- **拖拽**：CDP 真实鼠标事件拖动 80px，分隔条位移 80px，`localStorage` 中 `left` 由 430 变 510。

---

## 四、验收中发现并修复的问题

1. **舞台图不可读**：首版 viewBox 980×660，塞进约 590px 的面板后缩放只有 0.5，
   11px 的字渲染成 4.7px。→ 按面板真实尺寸重画坐标系（540×378，缩放≈1.0），
   连同字号、断线位置、图例位置全部重排。
2. **写回总线穿过 CONDITION CODES**：总线原在 y=296，条件码框在 y=284–328，
   线与 `dstE · dstM` 标签直接压在框上。→ 总线抬到 y=272，条件码下移到 y=300。
3. **图例与右下角说明重叠**：图例第 4 项与 `STATIC · NO EXECUTION DATA` 叠字。
   → 删掉该说明（面板头的 STATIC 徽章已表达同一件事）。
4. **内存表列塌陷**：`w-full` 表格未定列宽，剩余宽度全给地址列与 ASCII 列，
   8 个字节列挤成一团。→ `table-fixed` + `colgroup` 固定每列宽度。
5. **1440 下舞台过窄**：左 430 + 右 342 + 侧栏 258，中间只剩 238px。
   → 侧栏 <1500 自动收起，同时给中间设 440px 下限并按比例收缩两侧。
6. **构建产物带 9MB 死文件**：`editor.main` 把 CSS/HTML/JSON/TS 语言服务一并引入，
   产出 `ts.worker` 6.9MB 等 4 个永不请求的 worker。→ 写了一个 resolveId 插件
   在解析阶段把 `languages/features/*/register.js` 置空；dist 从 ~25MB 降到 5.3MB。
7. **lint 抓到渲染期写 ref**：`liveRef.current = live` 在渲染期间赋值，违反 React 规则。
   → 改为在拖拽的 `dragRef` 上滚动保存尺寸，彻底去掉渲染期 ref 读写。

---

## 五、尚未解决的问题

1. **Monaco chunk 仍偏大**（gzip 993KB）。（2026-11-19 已改为 `editor.api` + 5 条必要贡献，
   降到 2.7MB / 697KB；下面这段保留当时的判断。）进一步瘦身需要改用 `editor.api` +
   逐条挑选 contrib，收益约 40%，但会牺牲部分编辑功能的风险需要实测覆盖。
   留到 Phase 10 的打包优化，本阶段以「功能完整」优先。
2. **1440–1500 区间侧栏强制收起**，与 1500 以上有 180px 的跳变。功能无碍，
   但如果你更希望「用户选择优先」，这里需要改判定顺序。
3. **纵向堆叠布局（<1440）尚未精修**：舞台固定 420px 高、编辑器 340px，
   在小屏上只是「能用」，还没做抽屉式切换。
4. **执行日志的高度分配**：空态下占位偏大，等 Phase 3 有真实数据后需要重新调比例。

---

## 六、下一阶段计划（Phase 2：Y86-64 指令集）

1. 指令表：7 类指令的 icode/ifun、操作数形态、字节长度。
2. 编码器 / 解码器：`instruction → Uint8Array` 与反向，往返一致性测试覆盖每一条指令。
3. 汇编器：两遍扫描（标签收集 → 生成机器码）、诊断（未定义标签、非法寄存器、立即数越界、
   重复标签、多余操作数）。
4. 寄存器文件与内存模型：`Uint8Array`、小端读写、越界 `AddressError`。
5. 条件码与 Stat 的纯函数实现（`computeCC` / `setStat`）。
6. 编辑器接通汇编：点击「汇编」出真实编码表与诊断；失败时保留上一份可用机器码。
7. 验收：每类指令的编解码往返测试全绿；四段内置示例全部汇编成功且地址/长度符合预期。
