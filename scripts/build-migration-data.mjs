import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('.migration-private/source-data.json', 'utf8'));
const schema = JSON.parse(fs.readFileSync('supabase/migration-source-schema.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('supabase/migration-target/manifest.json', 'utf8'));
const authColumns = JSON.parse(fs.readFileSync('supabase/migration-target/auth-columns.json', 'utf8'));
const quote = value => `"${value.replaceAll('"','""')}"`;
const sql = ['BEGIN;', 'SET LOCAL search_path TO public, extensions;'];
const adminIds=new Set(data.user_roles.filter(row=>row.role==='admin').map(row=>row.user_id));
if(adminIds.size!==1)throw new Error('Expected exactly one administrator for migration');
data.auth_users=data.auth_users.filter(row=>adminIds.has(row.id));
data.auth_identities=data.auth_identities.filter(row=>adminIds.has(row.user_id));
for(const table of ['profiles','user_roles','user_tenants','admin_members'])data[table]=data[table].filter(row=>adminIds.has(row.user_id));
for(const row of data.admin_members)if(row.invited_by&&!adminIds.has(row.invited_by))row.invited_by=null;
for(const row of data.payment_pricing_config)if(row.updated_by&&!adminIds.has(row.updated_by))row.updated_by=null;
function insert(schemaName, table, rows, cols) {
  if (!rows.length) return;
  const payload=JSON.stringify(rows).replaceAll("'", "''");
  const list=cols.map(quote).join(', ');
  sql.push(`INSERT INTO ${schemaName}.${quote(table)} (${list}) SELECT ${list} FROM jsonb_populate_recordset(NULL::${schemaName}.${quote(table)}, '${payload}'::jsonb);`);
}
for (const table of ['users','identities']) {
  const rows=data[`auth_${table}`];
  const columns=authColumns.filter(c=>c.table_name===table && c.is_generated==='NEVER' && Object.hasOwn(rows[0]??{},c.column_name)).map(c=>c.column_name);
  // Existing sessions are not migrated; users must sign in again.
  if(table==='users')for(const row of rows)for(const field of ['confirmation_token','recovery_token','email_change_token_new','email_change_token_current','phone_change_token','reauthentication_token'])if(Object.hasOwn(row,field))row[field]='';
  insert('auth',table,rows,columns);
}
const pending=new Set(manifest.tables.filter(t=>Object.hasOwn(data,t)));
while(pending.size) {
  const ready=[...pending].filter(t=>!schema.constraints.some(c=>c.table===t && c.type==='f' && pending.has(c.definition.match(/REFERENCES (?:public\.)?(\w+)/)?.[1]) && !c.definition.includes(`REFERENCES ${t}(`)));
  if(!ready.length)throw new Error(`Unresolved foreign-key cycle: ${[...pending]}`);
  for(const table of ready) {
    const rows=data[table];
    if(['instagram_videos','homepage_testimonials'].includes(table))for(const row of rows)row.product_id=null;
    insert('public',table,rows,manifest.columns.filter(c=>c.table===table).map(c=>c.column));
    pending.delete(table);
  }
}
sql.push('COMMIT;');
fs.writeFileSync('.migration-private/002_import_data.sql',sql.join('\n\n')+'\n');
console.log('Private data import prepared; source credentials and user data omitted from output.');
