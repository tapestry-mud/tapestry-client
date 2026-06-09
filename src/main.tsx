import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WatchPage } from './watch/WatchPage'

// The anonymous /watch spectator page is a distinct entry surface, not a flag on the player client:
// it never runs the login/preauth/connectionStore flow. Route it here so App never mounts for /watch.
const isWatchRoute = window.location.pathname.replace(/\/+$/, '') === '/watch'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isWatchRoute ? <WatchPage /> : <App />}
  </StrictMode>,
)
