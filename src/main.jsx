import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// Apply a theme picked with the toggle before the first paint, so there's no flash of the other theme.
try {
  const theme = localStorage.getItem('favorite-faces-theme')
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme
} catch {
  // storage unavailable: follow the device setting
}

// iOS 14 and older don't support aspect-ratio, which sizes every photo box; styles.css falls back
// to padding-based sizing under this class.
if (!window.CSS?.supports?.('aspect-ratio', '1 / 1')) document.documentElement.classList.add('no-aspect')

// Touch screens get no hover highlight (it sticks after a tap). Some in-app browsers, like Messenger,
// claim a mouse, so count any touch support.
if (navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches) document.documentElement.classList.add('touch')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
