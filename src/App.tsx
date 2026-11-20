import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import EditorPage from './pages/EditorPage'
import LearningCenter from './pages/LearningCenter'
import LogicLab from './pages/LogicLab'
import MemoryExplorer from './pages/MemoryExplorer'
import NotFound from './pages/NotFound'
import Overview from './pages/Overview'
import PipelineLab from './pages/PipelineLab'
import RegisterLab from './pages/RegisterLab'
import SettingsPage from './pages/SettingsPage'
import Simulator from './pages/Simulator'

/** 路由表与外壳分离，测试可以直接用 MemoryRouter 包住它。 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="simulator" element={<Simulator />} />
        <Route path="editor" element={<EditorPage />} />
        <Route path="registers" element={<RegisterLab />} />
        <Route path="memory" element={<MemoryExplorer />} />
        <Route path="pipeline" element={<PipelineLab />} />
        <Route path="logic" element={<LogicLab />} />
        <Route path="learning" element={<LearningCenter />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

/**
 * 部署到 GitHub Pages 时站点在 `/<repo>/` 下，路由必须认识这段前缀，
 * 否则 `/<repo>/editor` 会被当成未知路径。
 *
 * 前缀只能从 Vite 注入的 `BASE_URL` 推导，不能写死仓库名——本地是 `/`，
 * 用户主页仓库（`<user>.github.io`）也是 `/`。去掉尾部斜杠后根路径会变成空串，
 * React Router 不接受，所以回落到 `/`。
 */
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <AppRoutes />
    </BrowserRouter>
  )
}
