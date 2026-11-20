import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

/**
 * monaco-editor 的 editor.main 会把 CSS / HTML / JSON / TypeScript 四种语言服务
 * 一起带进来（连带 6.9MB 的 ts.worker、1MB 的 css.worker…）。
 * 本项目只注册自定义的 y86 语言，用不到它们，因此在解析阶段直接置空。
 *
 * 做成插件而不是 resolve.alias：这些是 monaco 内部的**相对导入**
 * （'../languages/features/css/register.js'），裸模块别名拦不住。
 */
const MONACO_LANGUAGE_SERVICE_STUB = '\0monaco-language-service-stub'

function stripMonacoLanguageServices(): Plugin {
  return {
    name: 'cpu-theatre:strip-monaco-language-services',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !importer.includes('monaco-editor')) return null
      if (!source.includes('languages/features/')) return null
      if (!source.endsWith('/register.js')) return null
      return MONACO_LANGUAGE_SERVICE_STUB
    },
    load(id) {
      if (id === MONACO_LANGUAGE_SERVICE_STUB) return 'export {}'
      return null
    },
  }
}

/**
 * GitHub Pages 把站点挂在 `/<repo>/` 下，资源必须带这段前缀；
 * 本地 dev、preview 和桌面版（`cpu://app/`）都要求根路径。
 *
 * 所以不写死 base：由 `CPU_BASE` 决定，默认 `/`。桌面外壳因此不需要为部署改任何东西，
 * 页面里的路由前缀也统一从 `import.meta.env.BASE_URL` 推导（见 src/App.tsx）。
 *
 * 三种写法都接受：`/cpu-theatre/`、`/cpu-theatre`、`cpu-theatre/`。
 * 最后一种不是随手宽容——Git Bash（MSYS）会把带前导斜杠的环境变量当成本机路径，
 * 悄悄重写成 `C:/Program Files/Git/cpu-theatre/`，构建能过、部署全 404。
 * 不写前导斜杠就绕开了这个转换。
 */
function resolveBase(raw: string | undefined): string {
  const trimmed = raw?.trim()
  if (!trimmed || trimmed === '/') return '/'
  const segment = trimmed.replace(/^[/\\]+|[/\\]+$/g, '')
  return segment ? `/${segment}/` : '/'
}

const base = resolveBase(process.env.CPU_BASE)

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), stripMonacoLanguageServices()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2200,
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/core/**', 'src/store/**'],
    },
  },
})
