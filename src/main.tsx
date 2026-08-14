import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Purge legacy locgest mock items from browser localStorage to ensure system strictly reflects Supabase DB.
// "locgest_active_user" is excluded: it's the real, currently-used auth session key (AuthProvider), not a
// legacy mock key — deleting it on every load meant no session (Supabase or quick-demo) ever survived a refresh.
try {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("locgest_") && key !== "locgest_active_user") {
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
