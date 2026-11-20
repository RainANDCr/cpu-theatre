# Windows 本地运行与打包

> 想先知道「项目现在是什么状态」，看 [STATUS.md](STATUS.md)。

## 一、直接运行（推荐）

需要 **Node.js 22 或更高**（`node -v` 确认）。不需要 Python、不需要 Visual Studio。

```bat
:: 1. 进入项目目录
cd cpu-theatre

:: 2. 安装依赖（首次约 2–4 分钟，monaco-editor 体积较大）
npm install

:: 3. 启动开发服务器
npm run dev
```

浏览器打开 `http://localhost:5173`。端口被占用时 Vite 会自动换一个，以终端输出为准。

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（热更新） |
| `npm run build` | 生产构建到 `dist/` |
| `npm run preview` | 用本地静态服务器预览 `dist/` |
| `npm test` | 运行全部 301 个测试 |
| `npm run test:watch` | 测试监听模式 |
| `npm run lint` | oxlint 静态检查 |
| `npm run typecheck` | TypeScript 类型检查 |

### 断网可用性

项目**不需要联网**。所有依赖在 `npm install` 时下载完毕，运行时零外部请求
（已用 CDP 抓包验证：15 个请求全部指向 localhost）。

唯一需要网络的是首次 `npm install`。若目标机器完全离线，可在有网机器上执行
`npm ci` 后把整个目录（含 `node_modules`）拷过去。

## 二、构建产物

```bat
npm run build
```

产物在 `dist/`，约 3.5 MB（首屏 JS 约 145 KB gzip，Monaco 懒加载另计）。它是纯静态文件，但**不能直接双击 `index.html`**——
浏览器对 `file://` 下的 ES module 与 worker 有跨域限制，页面会白屏。

正确做法是起一个静态服务器：

```bat
npm run preview
```

若要分发给别人，把 `dist/` 交给任意静态服务器（IIS、nginx、`npx serve`）即可。

## 三、打包成 Windows 桌面版（Electron，已实跑）

> **状态**：已在本机完成打包与自检，产物为 `release/CPU THEATRE-win32-x64/`。
> 不是「方案」，是实际跑出来的目录。

### 为什么不用 `base: './'`

Vite 产物里的资源路径是绝对的（`/assets/index-xxx.js`）。`file://` 下它会解析到盘符根目录，
而且 `file://` 是 opaque origin，Monaco 的模块 Worker 会被同源策略挡掉。

本项目注册了一个标准 scheme `cpu://app/`，由主进程从 `dist/` 读文件返回：

```js
protocol.registerSchemesAsPrivileged([
  { scheme: 'cpu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])
protocol.handle('cpu', serve)   // 读 dist，找不到文件时回落到 index.html
```

于是绝对路径、Worker、history API 全部按正常站点工作，**Web 版不需要为桌面版改任何配置**。
SPA 回退也顺带解决了「打包后从 `/editor` 启动 404」的问题。

### 命令

```bat
npm install                 :: 会装 electron 与 @electron/packager（约 150 MB 运行时）
npm run dev                 :: 终端 A：开发服务器
npm run desktop:dev         :: 终端 B：用桌面壳打开 dev server（热更新可用）
npm run desktop             :: 构建后用桌面壳打开 dist（验证生产产物）
npm run package:win         :: 打包到 release/CPU THEATRE-win32-x64
npm run smoke:desktop       :: 无头自检：首页 / Monaco / 深链
npm run smoke:packaged      :: 对打包后的 exe 跑同一套自检
```

打包产物是**免安装目录**：整个文件夹拷到任意 Windows x64 机器，双击 `CPU THEATRE.exe` 即用。
没有做 NSIS 安装包——那需要额外下载 winCodeSign / nsis 二进制，在离线或代理环境经常失败。

### 实测数据

| 项 | 值 |
| --- | --- |
| `app.asar` | 3.6 MB（只含 `dist/`、`electron/`、`package.json`） |
| 目录总大小 | 363 MB（其中 99% 是 Electron 运行时） |
| 启动自检 | 首页渲染、Monaco 渲染出 5 行、深链 `/pipeline` 正常 |
| 网络 | 运行期零外部请求（资源全部走 `cpu://`） |

自检输出（`npm run smoke:packaged`）：

```text
[smoke] 首页 {"title":"CPU THEATRE · Y86-64 处理器可视化实验室","text":"MODULE 01 / OVERVIEW / 总览 …"}
[smoke] 编辑器 {"monaco":true,"lines":5}
[smoke] 深链 "Pipeline Lab · 五级流水线"
[smoke] OK
```

### 已知限制

1. 只打了 **win32-x64** 免安装目录；没有安装包、没有代码签名，SmartScreen 可能提示「未知发布者」。
2. 图标是 Electron 默认图标（仓库只有 `favicon.svg`，没有 `.ico`）。
3. macOS / Linux 未打包；`electron/main.cjs` 本身是跨平台的，但没有实测。
4. 首次 `npm install` 需要网络下载 Electron 运行时；目标机器运行时不需要网络。

### 备选方案：Tauri（未实施）

体积可压到 3–6 MB，代价是需要 Rust 与 Visual Studio Build Tools。配置思路相同：
`frontendDist` 指向 `dist`，窗口尺寸与本项目一致。**本项目没有实施**，仅作为备选记录。

## 四、桌面版自检清单

`electron/main.cjs` 支持 `--smoke`：隐藏窗口、逐页验证、打印结果并以退出码表示成败。
它检查的不是「进程起来了」，而是三件真正会坏的事：

| 检查 | 失败含义 |
| --- | --- |
| 首页 `#root` 有内容 | 资源路径或 `cpu://` handler 错了，页面白屏 |
| 编辑器出现 `.view-line` | Monaco 的 worker 在自定义 scheme 下没起来 |
| `/pipeline` 深链渲染 | SPA 回退缺失，刷新或从子路由启动会 404 |

已验证（本机，Windows 11 / Electron 45.4.1）：

- [x] `npm run build` 通过，`dist/` 3.5 MB
- [x] `npm run smoke:desktop` 三项全过
- [x] `npm run package:win` 产出 `release/CPU THEATRE-win32-x64`
- [x] `npm run smoke:packaged` 对 exe 三项全过
- [x] asar 内不含 `src/`、`tests/`、`docs/`、`.qa/`
- [x] 125% / 150% 缩放：`e2e/hidpi.spec.ts` 按 1536×864 与 1280×720 两个 CSS 视口 + 对应 DPR 断言不溢出
- [x] 运行期零外部请求：`e2e/offline.spec.ts` 拦截并断言

尚未验证，发版前请人工确认：

- [ ] 在**另一台**干净 Windows 机器上双击运行（本机与构建机同环境）
- [ ] 物理断网启动（自动化已证明「不发起外部请求」，但没拔过网线）
- [ ] SmartScreen / 杀软对未签名 exe 的提示

## 五、常见问题

**`npm install` 卡在 monaco-editor**
换 npm 镜像：`npm config set registry https://registry.npmmirror.com`，再重试。

**启动后页面空白，控制台报 `Failed to resolve module specifier`**
用 `file://` 直接打开了 `dist/index.html`。改用 `npm run preview` 或按第三节打包。

**端口 5173 被占用**
Vite 会自动换端口，看终端输出的实际地址；或 `npm run dev -- --port 5180`。

**测试报 `matchMedia is not a function`**
说明 `tests/setup.ts` 没被加载。检查 `vite.config.ts` 里的 `test.setupFiles`。

**构建警告 chunk 超过 500 kB**
正常。Monaco 单独成块且懒加载，已通过 `chunkSizeWarningLimit` 显式接受。
