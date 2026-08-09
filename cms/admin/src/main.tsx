import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Router } from 'wouter'
import { Toaster } from 'react-hot-toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Toaster position="top-right" />
      <App />
    </Router>
  </StrictMode>
)
