const { chromium } = require('playwright-core'); const fs=require('fs'); const crypto=require('crypto');
const SEG='segredo-de-teste-local-com-mais-de-32-caracteres!!';
const b64=o=>Buffer.from(typeof o==='string'?o:JSON.stringify(o)).toString('base64url');
function jwt(email){ const h=b64({alg:'HS256',typ:'JWT'}), p=b64({role:'authenticated',email,sub:crypto.randomUUID(),aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600});
  return `${h}.${p}.${crypto.createHmac('sha256',SEG).update(h+'.'+p).digest('base64url')}`; }
async function rotas(p, log){
 await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType:'application/javascript', body: fs.readFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js') }));
 await p.route('https://nhsjsttvxixgfqnweqos.supabase.co/**', async r => { const u=new URL(r.request().url()); const h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'*'};
   if (r.request().method()==='OPTIONS') return r.fulfill({status:200,headers:h});
   if (u.pathname==='/auth/v1/token'){ const c=JSON.parse(r.request().postData());
     const t=jwt(c.email); return r.fulfill({status:200,headers:h,contentType:'application/json',body:JSON.stringify({access_token:t,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'x',user:{id:'u1',email:c.email,aud:'authenticated',role:'authenticated'}})}); }
   if (u.pathname==='/auth/v1/user') return r.fulfill({status:200,headers:h,contentType:'application/json',body:JSON.stringify({id:'u1',email:'x@x',aud:'authenticated',role:'authenticated'})});
   if (u.pathname==='/functions/v1/usuarios'){ const b=JSON.parse(r.request().postData()); log.push('FUNCAO '+JSON.stringify(b)); return r.fulfill({status:200,headers:h,contentType:'application/json',body:JSON.stringify({ok:true,senha:'Teste1234!',jaExistia:false})}); }
   if (u.pathname.startsWith('/rest/v1/')){ const hd={...r.request().headers()}; if (!(hd.authorization||'').match(/^Bearer [^.]+\.[^.]+\.[^.]+$/)) delete hd.authorization;
     const resp=await r.fetch({url:'http://localhost:3000'+u.pathname.replace('/rest/v1','')+u.search, method:r.request().method(), headers:hd, data:r.request().postDataBuffer()||undefined});
     if (resp.status()>=400) log.push('HTTP '+resp.status()+' '+u.pathname+u.search+' '+(await resp.text()).slice(0,200));
     return r.fulfill({response:resp, headers:{...resp.headers(), ...h}}); }
   return r.fulfill({status:404,headers:h,body:'{}'}); }); }
async function extra(p){ await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); return r.fulfill({ contentType: u.endsWith('.css')?'text/css':'application/javascript', body: fs.readFileSync('node_modules/leaflet/dist/leaflet'+(u.endsWith('.css')?'.css':'.js')) }); });
  await p.route(/arcgisonline/, r => r.fulfill({contentType:'image/png', body: fs.readFileSync('tile.png')})); }
module.exports = { chromium, fs, rotas, extra };
