/* Real parent export controls, synthetic records, no production requests. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
(async()=>{
  const root=path.resolve(__dirname,'../..');
  let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.equal(html.split('tryRestoreSession();').length,2);
  html=html.replace('tryRestoreSession();',`window.inspectionTest={state:state,card:inspectionRecoveryCard,
    prepare:function(){HOUSEHOLD_ID='11111111-1111-4111-8111-111111111111';}};`);
  const browser=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:420,height:900},acceptDownloads:true});
    const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async r=>{
      const url=new URL(r.request().url());
      if(url.href==='https://forge.example.invalid/')return r.fulfill({contentType:'text/html',body:html});
      if(url.pathname==='/assets/inspection.js')return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'assets/inspection.js'),'utf8')});
      if(url.hostname==='cdn.jsdelivr.net')return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(process.env.SBJS,'utf8')});
      requests.push(url.href);return r.abort();
    });
    await page.goto('https://forge.example.invalid/');
    await page.evaluate(()=>{
      inspectionTest.prepare();const s=inspectionTest.state;
      s.kids={kid1:{name:'Anna'},kid2:{name:'Ryan',dayPlan:{end:'13:45',items:[['project','10:00']]}}};
      s.schedules={kid2:{blocks:[]}};
      const date=new Date(),iso=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
      s.assignments={real:{kidId:'kid2',date:iso,title:'Selected project lesson',subject:'Independent'},
        retired:{kidId:'kid2',date:iso,title:'Retired lesson',reviewStatus:'retired'}};
      s.familyGoal={rp:{id:'johnnyos',ids:['real']}};
      localStorage.setItem('al_forge_edits_kid2','[[1,2,3,4]]');
      localStorage.setItem('sb-example-auth-token','PRIVATE LOGIN');
      s.leaderMode=true;s.leaderUnlocked=false;document.body.innerHTML='';document.body.appendChild(inspectionTest.card());
    });
    await page.getByRole('button',{name:'Download schedule comparison',exact:true}).click();
    assert.match(await page.getByRole('status').innerText(),/unlock/);
    await page.evaluate(()=>inspectionTest.state.leaderUnlocked=true);
    let download=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download schedule comparison',exact:true}).click();
    let file=await download;const schedule=JSON.parse(fs.readFileSync(await file.path(),'utf8'));
    assert.equal(schedule.build,'2026-11-06.2');assert.equal(schedule.project.id,'johnnyos');
    assert.equal(schedule.kids[1].days[0].lessons.length,1);
    assert.equal(schedule.kids[1].days[0].lessons[0].id,'real');assert.equal(schedule.kids[1].clockPlan.items[0][1],'10:00');
    const before=await page.evaluate(()=>JSON.stringify({...localStorage}));
    download=page.waitForEvent('download');
    await page.getByRole('button',{name:"Back up this device's worlds and drafts",exact:true}).click();
    file=await download;const device=JSON.parse(fs.readFileSync(await file.path(),'utf8'));
    assert.ok(device.entries.some(e=>e.key==='al_forge_edits_kid2'));
    assert.ok(!JSON.stringify(device).includes('PRIVATE LOGIN'));
    assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),before);
    assert.equal(requests.filter(u=>u.includes('supabase.co')).length,0);assert.deepEqual(errors,[]);
    console.log('Parent export controls passed: locked access, actual schedule functions, retired filtering, device preservation, no backend calls.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
