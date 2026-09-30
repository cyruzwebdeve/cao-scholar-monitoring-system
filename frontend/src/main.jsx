import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SiteAccessGate from './components/SiteAccessGate.jsx'
import { installSiteAccessFetch } from './services/api.js'

installSiteAccessFetch()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SiteAccessGate>
      <App />
    </SiteAccessGate>
  </StrictMode>,
)
