import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// After a new deploy, a page that was already open still asks for the old build's lazy chunks,
// which no longer exist. Reload once to pick up the new build (guarded against reload loops).
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'chunk-reload-at'
  let last = 0
  try { last = Number(sessionStorage.getItem(KEY)) || 0 } catch { /* storage blocked */ }
  if (Date.now() - last < 30_000) return
  event.preventDefault()
  try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* storage blocked */ }
  window.location.reload()
})

// /prep is a separate app (exam practice for ครูผู้ช่วย) with its own bundle and auth session.
// Two separate lazy() calls so each route only downloads its own chunk and CSS.
const isPrep = window.location.pathname === '/prep' || window.location.pathname.startsWith('/prep/')
const PrepApp = lazy(() => import('./prep/PrepApp.tsx'))
const App = lazy(() => import('./App.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isPrep ? <PrepApp /> : <App />}
    </Suspense>
  </StrictMode>,
)
