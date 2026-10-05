const origin = process.argv[2] ?? 'https://vanessalimashoes.com.br';
const response=await fetch(origin,{headers:{'Cache-Control':'no-cache'}});
if(!response.ok)throw new Error(`Site returned ${response.status}`);
const html=await response.text();
const entries=[...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/g)].map(match=>new URL(match[1],response.url));
let foundNew=false,foundOld=false;
for(const url of entries.filter(url=>url.pathname.includes('/assets/'))) {
  const script=await fetch(url,{headers:{'Cache-Control':'no-cache'}});
  if(!script.ok)throw new Error(`Asset returned ${script.status}`);
  const code=await script.text();
  foundNew ||= code.includes('incrfwanfvnrebztvffd.supabase.co');
  foundOld ||= code.includes('sojrvsbqkrbxoymlwtii.supabase.co');
}
console.log(JSON.stringify({url:response.url,status:response.status,entryScripts:entries.length,newBackend:foundNew,oldBackend:foundOld}));
if(!foundNew || foundOld)process.exitCode=1;
