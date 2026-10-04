import fs from 'node:fs';
const schema = JSON.parse(fs.readFileSync('supabase/migration-source-schema.json', 'utf8'));
const deps = JSON.parse(fs.readFileSync('supabase/migration-source-dependencies.json', 'utf8'));
const inventory = JSON.parse(fs.readFileSync('supabase/migration-inventory.json', 'utf8'));
const tables = inventory.tables.filter(t => t.disposition === 'candidate_to_migrate' && t.table !== 'store_settings_public').map(t => t.table);
tables.push('user_tenants', 'app_logs', 'error_logs', 'rate_limit_log');
const selected = new Set(tables);
const retiredColumn = /^(bling_|yampi_|appmax_|rede_|melhor_envio_)/;
const columns = schema.columns.filter(c => selected.has(c.table_name) && !retiredColumn.test(c.column_name));
const q = name => `"${name.replaceAll('"', '""')}"`;
function type(c) {
  if(c.data_type === 'ARRAY') return `${c.udt_name.slice(1)}[]`;
  if(c.data_type === 'USER-DEFINED') return `public.${q(c.udt_name)}`;
  if(c.data_type === 'character varying' && c.character_maximum_length) return `varchar(${c.character_maximum_length})`;
  if(c.data_type === 'numeric' && c.numeric_precision) return `numeric(${c.numeric_precision},${c.numeric_scale ?? 0})`;
  return c.data_type;
}
const sql = ['BEGIN;', "SET LOCAL search_path TO public, extensions;", '-- Selective baseline; no retired commerce tables or credentials.'];
for(const name of new Set(columns.filter(c=>c.data_type==='USER-DEFINED').map(c=>c.udt_name))) {
  const values=deps.enums.filter(e=>e.typname===name).sort((a,b)=>a.enumsortorder-b.enumsortorder).map(e=>`'${e.enumlabel.replaceAll("'","''")}'`);
  sql.push(`CREATE TYPE public.${q(name)} AS ENUM (${values.join(', ')});`);
}
for(const table of tables) {
  const definitions=columns.filter(c=>c.table_name===table).sort((a,b)=>a.ordinal_position-b.ordinal_position).map(c=>`${q(c.column_name)} ${type(c)}${c.column_default ? ` DEFAULT ${c.column_default}` : ''}${c.is_nullable==='NO'?' NOT NULL':''}`);
  if(!definitions.length)throw new Error(`Missing table metadata: ${table}`);
  sql.push(`CREATE TABLE public.${q(table)} (\n${definitions.join(',\n')}\n);`);
}
for(const c of schema.constraints.filter(c=>selected.has(c.table)).sort((a,b)=>(a.type==='f')-(b.type==='f'))) {
  if(retiredColumn.test(c.name) || /\b(bling_|yampi_|appmax_|rede_|melhor_envio_)/.test(c.definition))continue;
  if(c.type==='f') {
    const ref=c.definition.match(/REFERENCES (?:public\.)?(\w+)/)?.[1];
    if(ref && !selected.has(ref) && !c.definition.includes('REFERENCES auth.users'))continue;
  }
  sql.push(`ALTER TABLE public.${q(c.table)} ADD CONSTRAINT ${q(c.name)} ${c.definition};`);
}
for(const f of deps.functions)sql.push(`${f.definition.trim().replace(/;$/, '')};`);
for(const t of deps.triggers.filter(t=>selected.has(t.table) && t.function==='update_updated_at_column'))sql.push(`${t.definition};`);
// Only timestamp triggers are migrated. Commerce and stock triggers are excluded.
for(const table of tables) {
  sql.push(`ALTER TABLE public.${q(table)} ENABLE ROW LEVEL SECURITY;`);
  sql.push(`REVOKE ALL ON public.${q(table)} FROM anon, authenticated;`);
  sql.push(`GRANT ALL ON public.${q(table)} TO service_role;`);
  const policies=schema.policies.filter(p=>p.tablename===table);
  for(const p of policies) {
    sql.push(`CREATE POLICY ${q(p.policyname)} ON public.${q(table)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(q).join(', ')}${p.qual?` USING (${p.qual})`:''}${p.with_check?` WITH CHECK (${p.with_check})`:''};`);
    const roles=p.roles.includes('public')?['anon','authenticated']:p.roles.filter(r=>['anon','authenticated'].includes(r));
    const commands=p.cmd==='ALL'?'SELECT, INSERT, UPDATE, DELETE':p.cmd;
    if(roles.length)sql.push(`GRANT ${commands} ON public.${q(table)} TO ${roles.map(q).join(', ')};`);
  }
}
for(const idx of deps.indexes.filter(i=>selected.has(i.tablename))) {
  if(schema.constraints.some(c=>c.table===idx.tablename && c.name===idx.indexname))continue;
  if(/\b(bling_|yampi_|appmax_|rede_|melhor_envio_)/.test(idx.indexdef))continue;
  sql.push(`${idx.indexdef};`);
}
const view=schema.views.find(v=>v.name==='store_settings_public').definition.replace(/\s+appmax_environment,\n/, '\n');
sql.push(`CREATE VIEW public.store_settings_public AS ${view.replace(/;\s*$/, '')};`, 'GRANT SELECT ON public.store_settings_public TO anon, authenticated, service_role;', 'COMMIT;');
fs.mkdirSync('supabase/migration-target', {recursive:true});
fs.writeFileSync('supabase/migration-target/001_selective_schema.sql', sql.join('\n\n')+'\n');
fs.writeFileSync('supabase/migration-target/manifest.json', JSON.stringify({tables,columns:columns.map(c=>({table:c.table_name,column:c.column_name})), excludedColumns:retiredColumn.source}, null, 2)+'\n');
console.log(`Prepared ${tables.length} tables with RLS and selective columns.`);
