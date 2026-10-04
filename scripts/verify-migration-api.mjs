import fs from 'node:fs';
const env=Object.fromEntries(fs.readFileSync('.env.migration.local','utf8').trim().split(/\r?\n/).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const headers={apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY};
for(const [name,endpoint] of [['public-settings','/rest/v1/store_settings_public?select=id'],['private-profiles','/rest/v1/profiles?select=id'],['private-roles','/rest/v1/user_roles?select=id'],['auth-settings','/auth/v1/settings']]) {
  const response=await fetch(env.VITE_SUPABASE_URL+endpoint,{headers});
  const data=await response.json();
  if(name==='auth-settings')console.log(JSON.stringify({name,status:response.status,signupDisabled:data.disable_signup,googleEnabled:data.external?.google}));
  else console.log(JSON.stringify({name,status:response.status,rows:Array.isArray(data)?data.length:undefined}));
  if(!response.ok || (name.startsWith('private-')&&data.length!==0))process.exitCode=1;
}
const media=JSON.parse(fs.readFileSync('.migration-private/media-manifest.json','utf8')).filter(row=>row.status===200);
let verified=0;
for(const item of media){const response=await fetch(env.VITE_SUPABASE_URL+'/storage/v1/object/public/product-media/media/'+item.name.split('/').map(encodeURIComponent).join('/'),{method:'HEAD'});if(response.ok)verified++;else process.exitCode=1;}
console.log(JSON.stringify({mediaVerified:verified,mediaExpected:media.length}));
