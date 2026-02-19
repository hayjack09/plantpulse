import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Unregister any existing service workers (they cause stale cache issues)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
  caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
