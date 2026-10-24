import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// iOS 14 and older don't support aspect-ratio, which sizes every photo box; styles.css falls back
// to padding-based sizing under this class.
if (!window.CSS?.supports?.('aspect-ratio', '1 / 1')) document.documentElement.classList.add('no-aspect')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
