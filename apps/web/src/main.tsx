import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@purrroute/design-system/styles.css'
import './shell.css'
import App from './shell.tsx'
import { startPwa } from './pwa.ts'

startPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
