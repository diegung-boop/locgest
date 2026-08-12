import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  "https://wstjabzuiftnasijcmad.supabase.co";
const supabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdGphYnp1aWZ0bmFzaWpjbWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTM2MjksImV4cCI6MjEwMTM2OTYyOX0.slvGGYkFMnGBQfMx1m0_B7-O2qFgXJYvFnXDKzM2cbY";

const supabaseServiceKey =
  (typeof import.meta !== "undefined" && (import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env?.SUPABASE_SERVICE_ROLE_KEY)) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdGphYnp1aWZ0bmFzaWpjbWFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTc5MzYyOSwiZXhwIjoyMTAxMzY5NjI5fQ.5GjKIzq_DjInQhFed97grwXcJL7ljjbUYomltztyUYs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
