import fs from 'node:fs';
const media=JSON.parse(fs.readFileSync('.migration-private/media-manifest.json','utf8'));
const status=new Map(media.map(m=>[m.name,m.status]));
const prefix='https://sojrvsbqkrbxoymlwtii.supabase.co/storage/v1/object/';
function rewrite(value,key='') {
  if(typeof value==='string')return value.replace(/https:\/\/sojrvsbqkrbxoymlwtii\.supabase\.co\/storage\/v1\/object\/(?:public|sign)\/product-media\/[^\s"'<>]+/g,raw=>{
    const name=decodeURIComponent(new URL(raw).pathname.split('/product-media/')[1]);
    if(status.get(name)===200)return `https://incrfwanfvnrebztvffd.supabase.co/storage/v1/object/public/product-media/media/${name.split('/').map(encodeURIComponent).join('/')}`;
    return key==='video_url'?'':'/placeholder.svg';
  });
  if(Array.isArray(value))return value.map(v=>rewrite(v,key));
  if(value && typeof value==='object') {
    const result=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v,k)]));
    if(Object.hasOwn(result,'video_url') && !result.video_url)result.is_active=false;
    if(Object.hasOwn(result,'product'))result.product=null;
    return result;
  }
  return value;
}
const data=JSON.parse(fs.readFileSync('.migration-private/source-data.json','utf8'));
const schema=JSON.parse(fs.readFileSync('supabase/migration-source-schema.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('supabase/migration-target/manifest.json','utf8'));
const q=v=>`"${v.replaceAll('"','""')}"`;
const sql=['BEGIN;'];
for(const table of manifest.tables)for(const row of data[table]??[]) {
  if(!JSON.stringify(row).includes(prefix))continue;
  const updated=rewrite(row);
  if(['instagram_videos','homepage_testimonials'].includes(table))updated.product_id=null;
  const pk=schema.constraints.find(c=>c.table===table && c.type==='p')?.definition.match(/PRIMARY KEY \(([^)]+)\)/)?.[1].split(',').map(k=>k.trim().replaceAll('"',''));
  if(!pk)throw new Error(`No primary key for media update: ${table}`);
  const cols=manifest.columns.filter(c=>c.table===table && !pk.includes(c.column)).map(c=>c.column);
  const json=JSON.stringify([updated]).replaceAll("'","''");
  sql.push(`UPDATE public.${q(table)} t SET ${cols.map(c=>`${q(c)}=s.${q(c)}`).join(', ')} FROM jsonb_populate_recordset(NULL::public.${q(table)}, '${json}'::jsonb) s WHERE ${pk.map(c=>`t.${q(c)}=s.${q(c)}`).join(' AND ')};`);
}
sql.push('COMMIT;');
fs.writeFileSync('.migration-private/004_rebase_media.sql',sql.join('\n\n')+'\n');
const snapshot=JSON.parse(fs.readFileSync('src/data/contentSnapshot.json','utf8'));
fs.writeFileSync('.migration-private/contentSnapshot.target.json',JSON.stringify(rewrite(snapshot),null,2)+'\n');
console.log('Prepared destination media URLs; unavailable source media replaced by placeholders and videos disabled.');
