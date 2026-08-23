import { useEffect } from 'react';
// HashRouter, not BrowserRouter: GitHub Pages has no server-side rewrite, so
// deep links under a plain BrowserRouter 404. See CLAUDE.md, "Commands".
import { HashRouter as Router, Route, Routes } from 'react-router-dom'
import './styles/global.scss'
import Home from './view/pages/Home.jsx'
import NotFound from './view/pages/NotFound.jsx'
import { getInitialTheme, setTheme } from './controllers/themeController.js'

function App() {
  useEffect(() => { setTheme(getInitialTheme()) }, []);

  // No global ThemeToggle: it sat on top of the child's screen with nothing
  // stopping him pressing it. Theme now lives in the adult panel, behind the
  // long press on the title.
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  )
}

export default App
