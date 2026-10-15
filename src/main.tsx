import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

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
