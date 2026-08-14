import { createClient } from "@supabase/supabase-js";

const defaultUrl = "https://wstjabzuiftnasijcmad.supabase.co";
const defaultAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdGphYnp1aWZ0bmFzaWpjbWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTM2MjksImV4cCI6MjEwMTM2OTYyOX0.slvGGYkFMnGBQfMx1m0_B7-O2qFgXJYvFnXDKzM2cbY";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) || defaultUrl;

const supabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) || defaultAnonKey;

const supabaseServiceKey =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env?.SUPABASE_SERVICE_ROLE_KEY)) ||
  null;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase;

