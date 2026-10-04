import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schema = JSON.parse(fs.readFileSync(path.join(root, 'supabase/migration-source-schema.json'), 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'src/data/contentSnapshot.json'), 'utf8'));
const references = new Map();

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(absolute);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.|^types\.ts$/.test(entry.name)) {
      const code = fs.readFileSync(absolute, 'utf8');
      for (const match of code.matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g)) {
        const files = references.get(match[1]) ?? new Set();
        files.add(path.relative(root, absolute).replaceAll('\\', '/'));
        references.set(match[1], files);
      }
    }
  }
}
scan(path.join(root, 'src'));
scan(path.join(root, 'supabase/functions'));

const legacy = new Set(['products', 'product_images', 'product_reviews', 'orders', 'order_items', 'admin_notifications']);
const tables = [...new Set(schema.columns.map(column => column.table_name))].sort();
const inventory = {
  source: 'sojrvsbqkrbxoymlwtii',
  destination: 'incrfwanfvnrebztvffd',
  status: 'review_required_before_import',
  notes: [
    'Static .from calls only; dynamic tables, RPCs, policy and trigger dependencies require review.',
    'No data, users, secrets or files exported by this script.',
    'Legacy runtime references must be removed or redesigned before excluding their tables.',
    'Snapshot keys can include editorial categories; they do not imply restoring catalog synchronization.',
  ],
  tables: tables.map(table => ({
    table,
    snapshot: Object.hasOwn(snapshot, table),
    codeReferences: [...(references.get(table) ?? [])].sort(),
    disposition: legacy.has(table) ? 'legacy_runtime_review' : (references.has(table) || Object.hasOwn(snapshot, table)) ? 'candidate_to_migrate' : 'not_directly_referenced_review_dependencies',
    foreignKeys: schema.constraints.filter(c => c.table === table && c.type === 'f'),
    policyCount: schema.policies.filter(p => p.tablename === table).length,
  })),
  views: schema.views.map(view => ({ name: view.name, referenced: references.has(view.name) || Object.hasOwn(snapshot, view.name) })),
};
fs.writeFileSync(path.join(root, 'supabase/migration-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`Inventory prepared: ${tables.length} source tables; ${inventory.tables.filter(t => t.disposition === 'candidate_to_migrate').length} direct candidates; ${inventory.tables.filter(t => t.disposition === 'legacy_runtime_review').length} legacy tables require review.`);
