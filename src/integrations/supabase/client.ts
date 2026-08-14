import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) || "";

const supabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) || "";

const supabaseServiceKey =
  (typeof import.meta !== "undefined" && (import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env?.SUPABASE_SERVICE_ROLE_KEY)) || "";


export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
