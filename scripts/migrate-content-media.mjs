import fs from 'node:fs';
import path from 'node:path';
const source = 'https://sojrvsbqkrbxoymlwtii.supabase.co';
const files = new Map();
function walk(value) {
  if(typeof value==='string') {
    for(const raw of value.matchAll(/https:\/\/sojrvsbqkrbxoymlwtii\.supabase\.co\/storage\/v1\/object\/(?:public|sign)\/product-media\/[^\s"'<>]+/g)) {
      const url=new URL(raw[0]);
      const name=decodeURIComponent(url.pathname.split('/product-media/')[1]);
      if(name.split('/').some(part=>['..','.',''].includes(part)) || name.includes('\\'))throw new Error('Unsafe media path');
      files.set(name, `${source}/storage/v1/object/public/product-media/${name.split('/').map(encodeURIComponent).join('/')}`);
    }
  } else if(Array.isArray(value))value.forEach(walk);
  else if(value && typeof value==='object')Object.values(value).forEach(walk);
}
const data=JSON.parse(fs.readFileSync('.migration-private/source-data.json','utf8'));
delete data.auth_users; delete data.auth_identities;
walk(data);
walk(JSON.parse(fs.readFileSync('src/data/contentSnapshot.json','utf8')));
const root=path.resolve('.migration-private/media');
fs.mkdirSync(root,{recursive:true});
const result=[];
for(const [name,url] of files) {
  const target=path.resolve(root,name);
  if(!target.startsWith(root+path.sep))throw new Error('Media path outside directory');
  const response=await fetch(url);
  if(!response.ok) { result.push({name,status:response.status}); continue; }
  const bytes=Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,bytes);
  result.push({name,status:200,bytes:bytes.length});
}
fs.writeFileSync('.migration-private/media-manifest.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({referenced:files.size,downloaded:result.filter(r=>r.status===200).length,failed:result.filter(r=>r.status!==200).length,bytes:result.reduce((n,r)=>n+(r.bytes??0),0)}));
if(result.some(r=>r.status!==200))process.exitCode=1;
