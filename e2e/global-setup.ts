/**
 * Playwright globalSetup: roda seed:qa quando SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * estão definidos. ABORTA se NODE_ENV ou VITE_MODE for production (segurança).
 * Carrega .env se existir (Node 20+ loadEnv ou dotenv).
 */
import { execSync } from 'child_process';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const candidates = [
    path.resolve(__dirname, '..'),
    process.cwd(),
    path.resolve(process.cwd(), '..'),
  ];
  for (const projectRoot of candidates) {
    for (const name of ['.env', '.env.local']) {
      const envPath = path.join(projectRoot, name);
      if (!existsSync(envPath)) continue;
      const content = readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
          value = value.slice(1, -1);
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

loadEnv();

const MSG = 'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para rodar seed:qa (e test:e2e).';

export default async function globalSetup() {
  const nodeEnv = process.env.NODE_ENV ?? '';
  const viteMode = process.env.VITE_MODE ?? process.env.MODE ?? '';
  if (nodeEnv === 'production' || viteMode === 'production') {
    console.error('[E2E] ABORT: Não rode E2E em produção. NODE_ENV=' + nodeEnv + ', VITE_MODE=' + viteMode);
    throw new Error('E2E blocked in production');
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[E2E] ' + MSG + ' (seed:qa será pulado; testes que precisam de login podem falhar.)');
    return;
  }
  try {
    execSync('node scripts/seed-qa.mjs', {
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_URL: url },
    });
    console.log('[E2E] seed:qa executado com sucesso.');
  } catch (e) {
    console.error('[E2E] seed:qa falhou:', (e as Error).message);
    throw e;
  }
}
