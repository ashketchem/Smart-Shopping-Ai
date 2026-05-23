import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './nav.jsx'
import './nav.css'
import Smartai from './Smartai.jsx'
import App from './yt.jsx'
import PremiumGlassLogin from './pages/login.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route 
          path="/" 
          element={
            <>
              <Smartai />
              <App />
            </>
          } 
        />
        <Route path="/login" element={<PremiumGlassLogin />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
