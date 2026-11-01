/* Loads the real Forge Academy page in headless Chromium with a fake in-memory Supabase, lets the app create
   its lessons, and returns the page. Needs: npm i playwright-core @supabase/supabase-js (in any folder; set NODE_PATH).
   Never talks to the real Supabase. */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const HID = '11111111-1111-1111-1111-111111111111';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SBJS = process.env.SBJS || '/var/tmp/sbtest/node_modules/@supabase/supabase-js/dist/umd/supabase.js';
exports.HID = HID;
/* Optional copy of the family's real schedule: SEED=/path/to/export.json (made with EXPORT_AND_ROLEPLAY.md step 1).
   The rows go into the fake database only, so tapping Done, answering quizzes and submitting work is safe: nothing reaches the real Supabase. */
function seedStore(store){
  const file = process.env.SEED; if(!file) return;
  const exp = JSON.parse(fs.readFileSync(file,'utf8'));
  const html = fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
  const i = html.indexOf('var FIELD_MAP = {'), j = html.indexOf('\n};', i);
  const FIELD_MAP = new Function(html.slice(i, j+3).replace('var FIELD_MAP =','return')+';')();
  const toRow = (coll,o)=>{ const m = FIELD_MAP[coll]||{}, r = {}; Object.keys(o).forEach(k=>{ r[m[k]||k] = o[k]; }); return r; };
  store.al_kids = Object.keys(exp.kids||{}).map(id=>Object.assign({household_id:HID}, toRow('kids',exp.kids[id]), {id}));
  store.al_assignments = Object.keys(exp.assignments||{}).map(id=>Object.assign({household_id:HID}, toRow('assignments',exp.assignments[id]), {id}));
  console.log('SEED: '+store.al_kids.length+' kids, '+store.al_assignments.length+' lessons loaded into the fake database');
}
exports.open = async function(){
  const store = { al_kids: [
    {id:'kid1',household_id:HID,name:'Anna',grade:2}, {id:'kid2',household_id:HID,name:'Ryan',grade:4}
  ] };
  seedStore(store);
  const b = await chromium.launch({executablePath:CHROME, args:['--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:420,height:900}});
  await ctx.addInitScript(([hid])=>{
    const exp = Math.floor(Date.now()/1000)+86400*30;
    const fake = btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:hid,exp,role:'authenticated'}))+'.sig';
    localStorage.setItem('sb-fbrnxuargsilbyyjrjop-auth-token', JSON.stringify({access_token:fake,token_type:'bearer',expires_in:3600*24*30,expires_at:exp,refresh_token:'r',user:{id:hid,aud:'authenticated',role:'authenticated',email:'m@x.com',app_metadata:{},user_metadata:{},created_at:'2026-01-01'}}));
  },[HID]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.route('**/cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'application/javascript', body:fs.readFileSync(SBJS,'utf8')}));
  function match(row, q){
    for(const [k,v] of q){
      if(['select','order','limit','offset','on_conflict','columns'].includes(k)) continue;
      let m;
      if((m=v.match(/^eq\.(.*)$/))){ if(String(row[k])!==m[1]) return false; }
      else if((m=v.match(/^in\.\((.*)\)$/))){ if(!m[1].split(',').map(s=>s.replace(/^"|"$/g,'')).includes(String(row[k]))) return false; }
    }
    return true;
  }
  await page.route('**/fbrnxuargsilbyyjrjop.supabase.co/**', async r=>{
    const u = new URL(r.request().url()), m = r.request().method(), p = u.pathname;
    const h = {'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'*'};
    if(m==='OPTIONS') return r.fulfill({status:204,headers:h});
    let mt;
    if((mt=p.match(/^\/rest\/v1\/rpc\/(\w+)/))) return r.fulfill({status:200,headers:h,body:JSON.stringify(mt[1]==='server_time'?new Date().toISOString():null)});
    if((mt=p.match(/^\/rest\/v1\/(\w+)/))){
      const t = mt[1]; const rows = store[t] = store[t] || [];
      const q = [...u.searchParams.entries()];
      if(m==='GET'){
        const obj = (r.request().headers()['accept']||'').includes('pgrst.object');
        const out = rows.filter(x=>match(x,q));
        return r.fulfill({status:200,headers:h,body:JSON.stringify(obj?(out[0]||null):out)});
      }
      if(m==='POST'){
        let body = JSON.parse(r.request().postData()||'{}'); const arr = Array.isArray(body)?body:[body]; const made = [];
        arr.forEach(x=>{ const row = Object.assign({id:'a'+Math.random().toString(36).slice(2,10),household_id:HID},x); rows.push(row); made.push(row); });
        return r.fulfill({status:201,headers:h,body:JSON.stringify(made)});
      }
      if(m==='PATCH'){ const body = JSON.parse(r.request().postData()||'{}'); const hit = rows.filter(x=>match(x,q)); hit.forEach(x=>Object.assign(x,body)); return r.fulfill({status:200,headers:h,body:JSON.stringify(hit)}); }
      if(m==='DELETE'){ const keep = rows.filter(x=>!match(x,q)); store[t] = keep; return r.fulfill({status:200,headers:h,body:'[]'}); }
    }
    if(p.includes('/auth/v1/user')) return r.fulfill({status:200,headers:h,body:JSON.stringify({id:HID,aud:'authenticated',email:'m@x.com',app_metadata:{},user_metadata:{}})});
    return r.fulfill({status:200,headers:h,body:'{}'});
  });
  /* The app keeps its functions inside a closure, so the audit copy exposes the few it needs. The real index.html is not changed. */
  const src = fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
  const hook = 'window.state = state;';
  if(src.split(hook).length!==2) throw new Error('hook line "window.state = state;" not found exactly once');
  const tmp = path.resolve(__dirname,'.audit-copy.html');
  fs.writeFileSync(tmp, src.replace(hook, hook+' window.__fa = {sb:sb, renderView:renderView, renderLessonDetail:renderLessonDetail, els:els, STANDARD_STATUS:STANDARD_STATUS, runAutoMigrations:runAutoMigrations, daysOffApply:daysOffApply, contentPacks:contentPacks, isDayOffIso:isDayOffIso, addSchoolDays:addSchoolDays, EXPLAINER_CARDS:EXPLAINER_CARDS};'));
  await page.goto('file://'+tmp);
  return {browser:b, page, store, errors};
};
