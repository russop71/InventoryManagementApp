import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) throw new Error('Pass the backup JSON file to verify');
const raw = await readFile(file, 'utf8');
const backup = JSON.parse(raw);
if (backup.format !== 'zestiq-supabase-backup-v1' || !backup.tables || typeof backup.tables !== 'object') {
  throw new Error('This is not a recognized ZestIQ backup');
}
const required = ['accounts', 'locations', 'app_users', 'location_data', 'app_usage_events'];
for (const table of required) if (!Array.isArray(backup.tables[table])) throw new Error(`Backup is missing ${table}`);
const accountIds = new Set(backup.tables.accounts.map(account => account.id));
if (backup.tables.locations.some(location => !accountIds.has(location.account_id))) throw new Error('Backup contains a location without its company account');
if (backup.tables.app_users.some(user => !accountIds.has(user.account_id))) throw new Error('Backup contains a user without its company account');
console.log(JSON.stringify({ valid: true, sha256: createHash('sha256').update(raw).digest('hex'), createdAt: backup.createdAt, counts: Object.fromEntries(required.map(table => [table, backup.tables[table].length])) }, null, 2));
