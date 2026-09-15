import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await sb.from('license_keys').select('id').limit(1);

if (!error) {
  console.log('OK: license_keys table already exists');
  process.exit(0);
}

console.log('MISSING:', error.message);
console.log('Run supabase/migrations/001_license_keys.sql in the Supabase SQL Editor.');
process.exit(2);
