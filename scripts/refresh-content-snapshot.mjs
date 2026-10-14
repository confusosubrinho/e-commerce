import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const snapshotPath = path.join(root, 'src/data/contentSnapshot.json');
const force = process.argv.includes('--force');

function loadEnv(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv('.env.local');
loadEnv('.env');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (.env.local ou .env).');
  process.exit(1);
}

const current = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const next = {};
const problems = [];

for (const table of Object.keys(current)) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    problems.push(`${table}: HTTP ${res.status} ${await res.text()}`);
    next[table] = current[table];
    continue;
  }
  const rows = await res.json();
  if (rows.length === 0 && current[table].length > 0) {
    problems.push(`${table}: banco retornou 0 linhas (snapshot tinha ${current[table].length})`);
  }
  console.log(`${table.padEnd(30)} ${String(current[table].length).padStart(3)} -> ${rows.length}`);
  next[table] = rows;
}

if (problems.length && !force) {
  console.error('\nSnapshot NÃO foi alterado:\n- ' + problems.join('\n- '));
  console.error('Revise e rode novamente com --force se estiver correto.');
  process.exit(1);
}

fs.writeFileSync(snapshotPath, `${JSON.stringify(next, null, 2)}\n`);
console.log(`\nSnapshot atualizado em ${path.relative(root, snapshotPath)}. Faça build/deploy para publicar.`);
