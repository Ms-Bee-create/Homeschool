const assert=require('node:assert/strict');
const {test}=require('node:test');
const {webcrypto,createHash}=require('node:crypto');
const inspection=require('../../assets/inspection.js');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

test('browser snapshot uses actual schedule functions and excludes answers/credentials',()=>{
  const calls=[];
  const env={build:'pretend',householdId:'fake',kids:[{id:'kid2',defaultName:'Ryan'}],schedules:{kid2:{blocks:['Monday']}},
    familyGoal:()=>({rp:{id:'chosen',ids:['lesson']},leader_pin_hash:'SECRET',world:{private:'world'}}),
    daysOffList:()=>[{from:'2026-11-23',to:'2026-11-27'}],isOffDate:d=>d.getDate()===23,
    kidData:()=>({name:'Ryan',private:'do not export'}),getDayPlan:()=>({end:'13:45',items:[['project','10:00']]}),
    orderedBlocksFor:()=>[{key:'project'}],blockKeyFor:()=> 'project',
    assignmentsFor:(kid,day)=>{calls.push([kid,day]);return [{id:'lesson',kidId:kid,date:day,title:'Actual pick',workBlocks:[{text:'PRIVATE ANSWER'}]}];}};
  const out=inspection.snapshot(env,'2026-11-23',2),text=JSON.stringify(out);
  assert.equal(calls.length,2);assert.equal(out.kids[0].days[0].off,true);
  assert.equal(out.kids[0].days[0].lessons[0].id,'lesson');assert.equal(out.project.id,'chosen');
  assert.ok(!text.includes('SECRET'));assert.ok(!text.includes('PRIVATE ANSWER'));assert.ok(!text.includes('private'));
});
test('date boundaries cross month/year and reject impossible dates',()=>{
  assert.deepEqual(inspection.dateRange('2026-12-31',2),['2026-12-31','2027-01-01']);
  for(const [day,n] of [['2026-02-30',1],['2026-11-06',22],['2026-11-06',0]])assert.throws(()=>inspection.dateRange(day,n));
});
test('device export retains builds/drafts, excludes auth, verifies offline and detects corruption',async()=>{
  const values={'al_forge_edits_kid2':'[[1,2,3,4]]','al_forge_inv_kid2':'{"block":5}',
    al_family_goal:'{"name":"Anna 🦄 and Ryan"}',al_safe_work_fake_lesson:'private draft',
    'sb-example-auth-token':'SECRET',al_auth_token:'SECRET',al_leader_pin_hash:'SECRET',al_leader_unlocked:'1'};
  const before=JSON.stringify(values),keys=Object.keys(values);
  const out=await inspection.deviceBackup({length:keys.length,key:i=>keys[i],getItem:k=>values[k]},
    {origin:'https://example.invalid',build:'pretend',householdId:'fake'},webcrypto);
  assert.equal(JSON.stringify(values),before);assert.equal(out.entries.length,4);assert.ok(!JSON.stringify(out).includes('SECRET'));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-device-'));
  try{
    const file=path.join(dir,'device.json');fs.writeFileSync(file,JSON.stringify(out,null,2));
    const script=path.resolve(__dirname,'../backup/verify_device.py');
    assert.match(execFileSync('python',[script,file],{encoding:'utf8'}),/including 2 world/);
    out.entries[0].value='changed';fs.writeFileSync(file,JSON.stringify(out));
    assert.throws(()=>execFileSync('python',[script,file],{stdio:'pipe'}));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

const core=import('../../supabase/functions/inspect-school/core.mjs');
const household='11111111-1111-4111-8111-111111111111';
const token='a'.repeat(43);
function config(fetcher){return {url:'https://example.supabase.co',key:'SERVER-SECRET',household,fetcher,
  clients:JSON.stringify([{name:'test',sha256:createHash('sha256').update(token).digest('hex'),expiresAt:'2099-01-01T00:00:00Z'}])};}
function req(message,extra={}){return new Request('https://example.invalid/inspect',{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(extra.headers||{})},
  body:JSON.stringify(message),...extra});}
const call={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'inspect_stored_day',arguments:{date:'2026-11-06'}}};

test('unauthorized, expired, browser-origin and oversized requests never read the database',async()=>{
  const {createHandler}=await core;let calls=0;
  const c=config(async()=>{calls++;throw Error('must not read');});
  const handler=createHandler(c);
  assert.equal((await handler(req(call,{headers:{'Content-Type':'application/json'}}))).status,401);
  assert.equal((await handler(req(call,{headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'https://evil.invalid'}}))).status,403);
  assert.equal((await handler(req({padding:'a'.repeat(5000)}))).status,400);
  c.clients=JSON.stringify([{sha256:createHash('sha256').update(token).digest('hex'),expiresAt:'2000-01-01'}]);
  assert.equal((await createHandler(c)(req(call))).status,401);assert.equal(calls,0);
});
test('MCP discovery is read-only; unknown tools and invalid inputs make no reads',async()=>{
  const {dispatch}=await core;const read=()=>{throw Error('must not read');};
  for(const message of [null,[],{...call,params:null},{...call,params:{name:'delete',arguments:{}}},
    {...call,params:{name:'inspect_stored_day',arguments:{date:'2026-02-30'}}},
    {...call,params:{name:'inspect_stored_day',arguments:{date:'2026-11-06',household_id:'OTHER'}}}]){
    const out=await dispatch(message,read);assert.ok(out.error);
  }
  const tools=await dispatch({jsonrpc:'2.0',id:2,method:'tools/list'},read);
  assert.equal(tools.result.tools.length,1);assert.equal(tools.result.tools[0].annotations.readOnlyHint,true);
  assert.equal(await dispatch({jsonrpc:'2.0',method:'notifications/initialized'},read),null);
});
test('authenticated inspection issues only constrained GETs with no private answer/PIN selects',async()=>{
  const {createHandler}=await core;const reads=[];
  const handler=createHandler(config(async(url,options)=>{
    reads.push([new URL(url),options]);return new Response('[]',{headers:{'Content-Range':'*/0'}});
  }));
  const response=await handler(req(call)),body=await response.json();
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal(reads.length,7);assert.equal(body.result.isError,undefined);
  assert.equal(JSON.parse(body.result.content[0].text).source,'direct-database-read');
  for(const [url,options] of reads){
    assert.equal(options.method,'GET');assert.equal(url.searchParams.get('household_id'),'eq.'+household);
    assert.equal(url.searchParams.get('limit'),'201');assert.equal(options.redirect,'error');
    assert.ok(!/work_blocks|leader_pin|balance|\*/.test(url.searchParams.get('select')));
    if(url.pathname.endsWith('/al_kids'))assert.equal(url.searchParams.get('select'),'id,name,day_plan');
  }
  assert.ok(!JSON.stringify(body).includes('SERVER-SECRET'));
});
test('capped pages, missing tables and oversized responses fail instead of returning partial success',async()=>{
  const {createHandler}=await core;
  for(const response of [new Response('[]',{headers:{'Content-Range':'0-0/2'}}),
    new Response('{}',{status:404}),new Response(' '.repeat(70000))]){
    const handler=createHandler(config(async()=>response));const body=await (await handler(req(call))).json();
    assert.equal(body.result.isError,true);assert.ok(!body.result.content[0].text.includes('SERVER-SECRET'));
  }
});
