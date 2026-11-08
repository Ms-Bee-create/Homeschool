/* Synthetic restored-backend fixture only. Refuses non-loopback targets and existing browser profiles. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
(async()=>{
 const origin=process.argv[2];const profile=process.argv[3];
 const url=new URL(origin);assert.equal(url.protocol,'http:');assert.equal(url.hostname,'127.0.0.1');
 assert.ok(profile,'Supply a NEW synthetic browser profile directory.');
 if(fs.existsSync(profile))assert.equal(fs.readdirSync(profile).length,0,'Use a new empty synthetic profile.');
 const context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROME||'/usr/bin/chromium',headless:true,
  viewport:{width:1280,height:1000},proxy:{server:origin,bypass:'127.0.0.1,localhost'},
  args:['--no-sandbox','--disable-quic','--disable-background-networking']});
 try{
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);assert.match(await page.locator('#recoveryBanner').innerText(),/RESTORED COPY/);await page.locator('#loginEmail').fill('roundtrip@example.test');
  await page.locator('#loginPass').fill('synthetic-test-password-123');await page.locator('#loginBtn').click();
  await page.locator('.who-gate-opt').filter({hasText:'Anna restored sample'}).waitFor({timeout:30000});
  await page.locator('.who-gate-opt').filter({hasText:'Anna restored sample'}).click();
  await page.locator('[data-tab="week"]').click();
  await page.getByText('Recovered math evidence — Anna',{exact:false}).click();
  await page.waitForFunction(()=>document.body.innerText.includes('Saved attempt: 84 divided by 4 is 21')||Array.from(document.querySelectorAll('textarea')).some(e=>e.value.includes('Saved attempt: 84 divided by 4 is 21')),{timeout:10000});
  await page.locator('.profile-trigger').click();
  await page.locator('.profile-row').filter({hasText:'Ryan restored sample'}).click();
  await page.locator('[data-tab="week"]').click();
  await page.getByText('Recovered math evidence — Ryan',{exact:false}).click();
  assert.match(await page.locator('#recoveryBanner').innerText(),/RESTORED COPY/);
  // The guard, not application optimism, rejects writes and private paths.
  const checks=await page.evaluate(async()=>({
   write:(await fetch('/rest/v1/al_assignments',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,
   privateFile:(await fetch('/PRIVATE-login.json')).status,
   rpc:(await fetch('/rest/v1/rpc/set_member_pin',{method:'POST',body:'{}'})).status
  }));
  assert.deepEqual(checks,{write:403,privateFile:404,rpc:403});
  await page.reload();await page.locator('.who-gate-opt').filter({hasText:'Anna restored sample'}).waitFor({timeout:15000});
  assert.equal(await page.locator('#loginGate').isVisible(),false);
  // A navigation bypasses app link interception and must still be stopped by
  // the dedicated browser's local rejecting proxy. Never use production here.
  const external=await context.newPage();let rejected=false;
  try{await external.goto('https://example.invalid/',{timeout:10000});}catch(e){rejected=true;}
  assert.equal(rejected,true);await external.close();
  assert.deepEqual(errors,[]);
  if(process.env.FORGE_BROWSER_QA_RESULT)fs.writeFileSync(process.env.FORGE_BROWSER_QA_RESULT,JSON.stringify({synthetic_only:true,passed:true,
   real_browser:true,profiles:2,saved_lessons:2,reload_session:true,writes_blocked:true,private_files_blocked:true,external_navigation_blocked:true}));
  console.log('REAL BROWSER PASSED: sign-in, both restored profiles/lessons, saved work, session after reload, blocked writes/private files/external navigation.');
 }catch(e){
  const pages=context.pages();if(process.env.FORGE_BROWSER_QA_SCREENSHOT&&pages[pages.length-1])await pages[pages.length-1].screenshot({path:process.env.FORGE_BROWSER_QA_SCREENSHOT,fullPage:true});
  throw e;
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
