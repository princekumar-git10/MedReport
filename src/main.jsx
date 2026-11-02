import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AuthGate from './AuthGate.jsx'   // new

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>                           {/* new */}
      <App />
    </AuthGate>                          {/* new */}
  </StrictMode>,
)