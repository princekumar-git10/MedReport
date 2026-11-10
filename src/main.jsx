import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n' // Initialize i18next before anything else
import './index.css'
import App from './App.jsx'
import AuthGate from './AuthGate.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </LanguageProvider>
  </StrictMode>,
)
