/**
 * monaco 的深层 ESM 入口没有单独类型声明（官方类型只有 `monaco-editor/monaco.d.ts`）。
 *
 * 运行期我们只加载 `editor.api` 以避开 suggest/hover/语言服务，
 * 类型则通过 monacoRuntime.ts 里的 `MonacoApi = typeof import('monaco-editor')` 保留。
 * 没有这个声明，TypeScript 会报 TS2307，并把 `api` 推成 any，连带调用方失去空值检查。
 */
declare module 'monaco-editor/editor/editor.api'
