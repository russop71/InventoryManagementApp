import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputArgument = process.argv.indexOf('--output');
const output = outputArgument >= 0 ? process.argv[outputArgument + 1] : '';
if (!output) throw new Error('Use --output with a secure directory outside this repository');
const resolvedOutput = path.resolve(output);
const repository = path.resolve(process.cwd());
if (resolvedOutput === repository || resolvedOutput.startsWith(`${repository}${path.sep}`)) {
  throw new Error('Backups contain private client data and must be stored outside the repository');
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and a Supabase service-role key are required');

const tables = ['accounts', 'locations', 'app_users', 'location_data', 'app_usage_events'];
const backup = { format: 'zestiq-supabase-backup-v1', createdAt: new Date().toISOString(), tables: {} };

for (const table of tables) {
  const records = [];
  for (let start = 0; ; start += 1000) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${start}-${start + 999}` },
    });
    if (!response.ok) throw new Error(`Backup failed for ${table} (${response.status})`);
    const page = await response.json();
    records.push(...page);
    if (page.length < 1000) break;
  }
  backup.tables[table] = records;
}

const json = JSON.stringify(backup);
const digest = createHash('sha256').update(json).digest('hex');
await mkdir(resolvedOutput, { recursive: true, mode: 0o700 });
const stamp = backup.createdAt.replace(/[:.]/g, '-');
const file = path.join(resolvedOutput, `zestiq-backup-${stamp}.json`);
await writeFile(file, json, { mode: 0o600 });
await writeFile(`${file}.sha256`, `${digest}  ${path.basename(file)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ file, sha256: digest, counts: Object.fromEntries(tables.map(table => [table, backup.tables[table].length])) }, null, 2));
