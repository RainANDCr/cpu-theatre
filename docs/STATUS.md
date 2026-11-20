# 项目现状（STATUS）

> 这一页回答三个问题：**现在能做什么、验证到什么程度、哪些事还没做。**
> 更新于 2026-11-20。历史过程写在 `PHASE-*.md`，那里面的数字是当时的快照，不随代码更新。

**在线地址**：<https://rainandcr.github.io/cpu-theatre/> —— 推送到 `main` 自动发布，不需要构建机。

## 1. 结论

CPU THEATRE 是一个可运行、可调试、可对拍的 Y86-64 处理器可视化实验室：
九个模块全部可用，引擎与界面严格分离，运行时零外部请求，Web 版与 Windows 免安装桌面版
共用同一份构建产物。

**当前质量门**：单元/组件 **304**（23 文件）、端到端 **30**（functional 26 + visual 4）、
`tsc` 0 error、`oxlint` 0 warning、`dist` 3.5 MB。
两条 GitHub Actions 流水线已在真实 runner 上跑通：`CI`（检查 + 测试 + 产物 E2E）
与 `Deploy to GitHub Pages`。

## 2. 能做什么

| 模块 | 路由 | 能力 |
| --- | --- | --- |
| Overview | `/` | 项目地图、引擎状态、阶段进度 |
| CPU Simulator | `/simulator` | SEQ 六阶段执行、单步/回退/跑完、断点、阶段高亮 |
| Instruction Editor | `/editor` | 真实汇编、Listing / 符号表 / 诊断、七个内置示例 |
| Register Lab | `/registers` | 15 个寄存器、位模式、条件码 |
| Memory Explorer | `/memory` | 逐字节视图、跟随 PC、访存高亮 |
| Pipeline Lab | `/pipeline` | 五级流水线、转发/暂停/气泡、CPI |
| Logic Lab | `/logic` | 门电路实验台、ALU 实验 |
| Learning Center | `/learning` | 4 模块 13 知识点、自测与进度 |
| Settings | `/settings` | 强调色、动效、网格、面板尺寸（本地持久化） |

**ISA**：27 条 Y86-64 指令（教材第 4 章），严格定长编码（1/2/9/10 字节）。
**伪指令**：`.pos` / `.org` / `.align` / `.quad` / `.string`，详见 [ISA.md](ISA.md#7-汇编语法)。

## 3. 怎么验证

```bash
npm test              # 304 单元/组件用例（约 20s）
npm run test:e2e      # 30 端到端用例（约 40s）；--repeat-each=2 曾 60/60 稳定
npm run test:e2e:prod # 构建产物上的 26 条功能用例（约 17s，需先 npm run build）
npm run typecheck     # tsc -b，0 error
npm run lint          # oxlint，0 warning
npm run build         # dist 3.5 MB
npm run smoke:desktop # Electron 外壳自检（首页 / Monaco / 深链）
npm run docs:shots    # 重拍 README 截图（真实启动并点击，不是设计稿）
npm run package:win && npm run smoke:packaged  # 打包并对 exe 自检
CPU_BASE=cpu-theatre/ npm run build:pages      # 复现 Pages 产物（含 404.html / .nojekyll）
```

### 已自动化的验收

| 项目 | 守住什么 | 位置 |
| --- | --- | --- |
| 验收 A–E | addq / 内存小端 / je 跳转 / SEQ≡PIPE / Step Back 精确回退 | `tests/seq`、`tests/pipe` |
| 教材 Figure 4.7 | 18 条指令地址与教材印刷值逐行相同；首 19 字节机器码一致 | `tests/assembler/asum.test.ts` |
| 伪指令 | `.pos`/`.align`/`.quad`/`.string` 布局、空洞、转义、越界拒绝 | `tests/assembler/directives.test.ts` |
| 示例不腐坏 | 7 个内置示例逐个真实汇编 | `tests/assembler/examples.test.ts` |
| 离线 | 九个模块逐页访问，非 localhost 请求一律拦截并断言为空 | `e2e/offline.spec.ts` |
| 高 DPI | 125%（1536×864）/150%（1280×720）+ 对应 DPR，不溢出、可操作 | `e2e/hidpi.spec.ts` |
| 窄屏导航 | 390×844 抽屉开关、ESC 归还焦点、无横向溢出 | `e2e/mobile.spec.ts` |
| 桌面外壳 | 首页渲染 / Monaco 出 5 行 / 深链回落 index.html | `electron/main.cjs --smoke` |
| Pages 子路径 | 资源前缀、深链 404 回落、Monaco 在 `/<repo>/` 下可用 | `scripts/pages-postbuild.mjs` + 部署前产物校验 |

### 发布

推送到 `main` → `.github/workflows/pages.yml` 依次：计算站点前缀（仓库名，用户主页仓库则为 `/`）→
`npm ci` → lint/typecheck/test → `npm run build:pages` → 校验产物里有
`404.html`、`.nojekyll` 且 `index.html` 带前缀 → 上传并部署。

本地复现线上行为（`vite preview` 自带 SPA 回落，测不出子路径与 404 问题）：

```bash
CPU_BASE=cpu-theatre/ npm run build:pages
npm run preview:pages     # http://localhost:4183/cpu-theatre/
```

## 4. 已知限制

按「对用户的影响」排序，不是按实现难度：

1. **视觉回归只在 Windows 本机有效。** 功能断言已于 2026-11-20 在 GitHub runner 上跑通，
   但 4 张截图基线绑的是本机字体（`*-win32.png`），CI 刻意只跑 `functional` project——
   Linux 字体差异会让视觉比对变成噪声，而不是信号。
2. **桌面产物只覆盖 win32-x64 免安装目录。** 没有 NSIS 安装包、没有代码签名；
   换机器 / 断网 / SmartScreen 三项仍需人工确认（见下）。
3. **诊断只有行号，没有列号。** 要精确到列，需要在 parser 里保留 token 偏移。
4. **伪指令未覆盖 `.byte` / `.word`。** 现有五条已够教材与数据段演示。
5. **390px 下数据通路图整体缩放**，没有做逐模块的触屏手势或重排。
6. **Monaco 仍是最重的懒加载块**：2.7 MB（gzip 697 KB）。已从 `editor.main` 换成
   `editor.api` + 5 条必要贡献，再往下砍会开始损失编辑器手感。
7. **Tauri 方案未实施**（3–6 MB vs 363 MB），只有配置思路记录在 `WINDOWS.md`。
8. **GitHub Pages 在国内网络下不稳。** 站点本身不需要后端，但 `*.github.io` 的可达性与速度
   取决于线路：本机冷缓存首次打开编辑器耗时 65 s（Monaco 2.7 MB），刷新后走 ETag 复用。
   要稳定给国内访问，需要自定义域名 + 国内可用的 CDN，或改用其它静态托管。

## 5. 仍需人工确认

- [ ] 在**另一台干净 Windows** 上双击 `CPU THEATRE.exe`（本机与构建机同环境）
- [ ] 物理断网启动（自动化已证明不发起外部请求，但没拔过网线）
- [ ] SmartScreen / 杀软对未签名 exe 的提示是否可接受
- [ ] 换一条网络（手机热点 / 国内宽带）打开线上站点，确认可用与可接受的速度

## 6. 文档地图

| 文档 | 读它是为了 |
| --- | --- |
| `STATUS.md`（本文） | 现状、验证程度、未完成项 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 为什么这样分层；引擎/UI/动画的边界 |
| [ROADMAP.md](ROADMAP.md) | 阶段划分与每阶段的验收门槛 |
| [TEST-REPORT.md](TEST-REPORT.md) | 完整测试矩阵、性能与体积、验收用例细节 |
| [ISA.md](ISA.md) | 指令编码、伪指令、与 x86-64 的差异 |
| [WINDOWS.md](WINDOWS.md) | 本地运行、构建、桌面打包与自检清单 |
| `PHASE-0/1/2/10.md` | 各阶段**当时**的交付记录（数字是快照，可能已过时） |
| `.github/workflows/pages.yml` | 发布流水线：计算站点前缀、构建、产物校验、部署 |
