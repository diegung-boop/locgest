import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim().replace(/['"]/g, '') : '';
const supabaseKey = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'diegung@gmail.com');
  console.log('Profiles in DB:', profiles);
  if (error) console.log('Error profiles:', error);

  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  const user = authUsers?.users?.find(u => u.email === 'diegung@gmail.com');
  console.log('Auth user metadata:', user?.user_metadata);
  if (authError) console.log('Auth Error:', authError);
}
check();
