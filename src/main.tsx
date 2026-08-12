import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Purge legacy locgest mock items from browser localStorage to ensure system strictly reflects Supabase DB
try {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("locgest_")) {
      localStorage.removeItem(key);
    }
  });
} catch {
  // Ignore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
