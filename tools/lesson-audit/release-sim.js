/* Release check (fake database only). Needs, in the folder given by env SP: live-assignments.raw and live-kids.raw (read-only supabase query output), ids.json (the loop-row allowlist).
   Seeds the fake DB with those rows (never committed), loads the real page, then reports: loop rows left, school days without Math / with two, duplicate titles,
   warm-ups in Morning Launch (block key, card, completion), the project cap, and that repeat planner + migration runs move nothing. Set OUT to also save a date snapshot for before/after comparison. */
/* Fake-database simulation of the release: seeds the fake DB with a read-only copy of the live rows (kept in the scratchpad, never in the repo),
   loads the real page, lets the app run its migrations and planner, then checks the result. Never talks to the real Supabase. */
const fs=require('fs');
const SP=process.env.SP, WT=process.cwd();
function rows(f){const s=fs.readFileSync(SP+'/'+f,'utf8');return JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1)).rows;}
const kids=rows('live-kids.raw'),asg=rows('live-assignments.raw');
const exp={kids:{},assignments:{}};const HID='11111111-1111-1111-1111-111111111111';kids.forEach(k=>{k.household_id=HID;exp.kids[k.id]=k;});asg.forEach(a=>{a.household_id=HID;exp.assignments[a.id]=a;});
fs.writeFileSync(SP+'/sim-seed.json',JSON.stringify(exp));
process.env.SEED=SP+'/sim-seed.json';
const h=require(WT+'/tools/lesson-audit/harness.js');
(async()=>{
  const o=await h.open();const page=o.page;await page.waitForTimeout(9000);
  const snap=()=>page.evaluate(()=>{const r={};Object.entries(state.assignments).forEach(([k,a])=>r[k]=a.date);return r;});
  const LOOP=JSON.parse(fs.readFileSync(SP+'/ids.json','utf8'));
  const report=()=>page.evaluate((LOOP)=>{
    const today=new Date().toISOString().slice(0,10);
    const A=Object.entries(state.assignments).filter(([id,a])=>a.kidId==='kid1');
    const math=A.filter(([id,a])=>a.subject==='Math'&&a.date>=today&&a.reviewStatus!=='retired').sort((x,y)=>x[1].date.localeCompare(y[1].date)||x[1].title.localeCompare(y[1].title));
    const days={};math.forEach(([id,a])=>{(days[a.date]=days[a.date]||[]).push(a.title)});
    // next 30 school days
    const sd=[];let d=new Date(today+'T00:00:00');while(sd.length<60){const iso=d.toISOString().slice(0,10);if(!(d.getDay()===0||d.getDay()===6||window.__fa.isDayOffIso(iso))){sd.push(iso);}d.setDate(d.getDate()+1);}
    const titles={};A.forEach(([id,a])=>{titles[a.title]=(titles[a.title]||0)+1});
    const dupTitles=Object.entries(titles).filter(([t,n])=>n>1&&!/^Math: /.test(t)).map(([t,n])=>t+' x'+n);
    return {loopLeft:LOOP.filter(id=>state.assignments[id]).length,
      loopOpen:A.filter(([id,a])=>a.subject==='Math'&&!a.done&&a.date>=today&&/^Math: /.test(a.title)).length,
      mathDays:Object.keys(days).sort().map(k=>k+' '+days[k].join(' + ')),
      missing:sd.filter(x=>!days[x]), doubles:Object.keys(days).filter(k=>days[k].length>1),
      dupTitles};
  },LOOP);
  const dbg=await page.evaluate(()=>Object.values(state.assignments).filter(a=>a.kidId==='kid1'&&a.date>='2026-11-10'&&a.date<='2026-11-13').map(a=>a.date+' '+a.subject+' '+a.stage+' '+(a.done?'DONE ':'')+a.title.slice(0,45)+' '+a.skillId).sort());console.log(dbg.join(String.fromCharCode(10)));const dbg2=await page.evaluate(()=>{return ['Fact Families','Hop Along','Solve the Mystery','Even or Odd'].map(t=>{const a=Object.values(state.assignments).find(x=>x.kidId==='kid1'&&x.title.indexOf(t)>=0);return t+' => '+(a?a.date+' created '+a.createdAt+' stage '+a.stage:'missing');}).concat(['ff flag '+localStorage.getItem('al_anna_factfam_placed')]);});console.log(dbg2.join(String.fromCharCode(10)));const r1=await report();
  console.log('loop ids still present:',r1.loopLeft,'| open "Math: " loop-titled rows from today:',r1.loopOpen);
  console.log('school days (next 60) with no Math:',JSON.stringify(r1.missing));
  console.log('days with 2+ Math:',JSON.stringify(r1.doubles));
  console.log('duplicate kid1 titles (excluding done loop copies):',JSON.stringify(r1.dupTitles));
  console.log('ANNA MATH from today:\n'+r1.mathDays.join('\n'));
  const chk=await page.evaluate(()=>{
    const out={};const rows=Object.entries(state.assignments).map(([id,a])=>Object.assign({id},a));const f=window.__fa;
    const te=rows.find(a=>a.kidId==='kid2'&&a.skillId==='ryan-thought-experiments'&&!a.done&&a.date>='2026-11-10');
    const hw=rows.find(a=>a.kidId==='kid1'&&/^Handwriting p./.test(a.title)&&!a.done&&a.date>='2026-11-10');
    [['kid2',te],['kid1',hw]].forEach(([kid,a])=>{
      if(!a){out[kid]='no warm-up row found';return;}
      const card=f.renderDailyBlockCard({key:'morning',label:'Morning Launch',icon:'x'},kid,a.date,[a],false,true,true);const txt=card.textContent;
      state.journalEntries=(state.journalEntries||[]).filter(j=>!(j.kidId===kid&&j.date===a.date)).concat([{kidId:kid,date:a.date,launchMood:'ready',launchGoal:'Reading'}]);
      out[kid]={title:a.title.slice(0,40),date:a.date,blockKey:f.blockKeyFor(a),inCard:txt.includes(a.title.slice(0,20)),warmupLabel:txt.includes('Warm-up'),
        completeWhenWarmupUndone:f.blockComplete('morning',kid,a.date,{morning:[a]}),completeWhenWarmupDone:f.blockComplete('morning',kid,a.date,{morning:[Object.assign({},a,{done:true})]}),completeWithNoWarmups:f.blockComplete('morning',kid,a.date,{})};
    });
    const cnt={},over=[];rows.forEach(a=>{if(!a.date||a.date<'2026-11-10'||a.reviewStatus==='retired'||a.skillId==='offscreen-friday')return;if(f.schedClass(a)==='project'){const k=a.kidId+'|'+a.date;cnt[k]=(cnt[k]||0)+1;}});
    Object.entries(cnt).forEach(([k,n])=>{if(n>2)over.push(k+' '+n)});out.projectOver=over;out.warmupAsProject=rows.filter(a=>f.isWarmup(a)&&f.schedClass(a)==='project').length;
    out.warmupCount={kid1:rows.filter(a=>a.kidId==='kid1'&&f.isWarmup(a)).length,kid2:rows.filter(a=>a.kidId==='kid2'&&f.isWarmup(a)).length};return out;});
  console.log('WARMUP CHECK',JSON.stringify(chk,null,1));
  /* every installed book lesson that has a video in its source file must have it in the simulated database row (and the same materials link) */
  const PILOT=process.env.PILOT||'C:/Users/amand/Projects/Homeschool/Homeschool/prototype/anna-textbook/pilot/out';
  const src={};['U1GAPS','U2','U3','U4','U5','U6','U7','U8','U9','U10','U11'].forEach(u=>JSON.parse(fs.readFileSync(PILOT+'/ANNA_MATH_'+u+'.json','utf8')).forEach(l=>{src[l.title]={video:l.video||null,materials:l.materials||null};}));
  const vid=await page.evaluate((src)=>{const rows=Object.values(state.assignments).filter(a=>a.kidId==='kid1');const by={};rows.forEach(a=>{by[a.title]=a;});
    let installed=0,withVideo=0,missingRow=[],lostVideo=[],lostMaterials=[];
    Object.keys(src).forEach(t=>{const r=by[t];if(!r){missingRow.push(t);return;}installed++;if(src[t].video){withVideo++;if(r.video!==src[t].video)lostVideo.push(t);}if(src[t].materials&&r.materials!==src[t].materials)lostMaterials.push(t);});
    return {sourceLessons:Object.keys(src).length,installed,withVideo,missingRow:missingRow.slice(0,5),lostVideo:lostVideo.slice(0,5),lostVideoCount:lostVideo.length,lostMaterialsCount:lostMaterials.length};},src);
  console.log('VIDEO CHECK',JSON.stringify(vid));
  const a=await snap();
  for(let i=0;i<3;i++){await page.waitForTimeout(800);const m=await page.evaluate(()=>window.__fa.planSchedule());console.log('plan rerun',i+1,'moved',JSON.stringify(m));}
  await page.evaluate(()=>window.__fa.runAutoMigrations());await page.waitForTimeout(1500);
  await page.evaluate(()=>window.__fa.planSchedule());await page.waitForTimeout(800);
  const b=await snap();const T=await page.evaluate(()=>{const r={};Object.entries(state.assignments).forEach(([k,a])=>r[k]=a.kidId+' '+a.subject+' '+a.title.slice(0,50));return r;});for(const k in b){if(k in a&&a[k]!==b[k])console.log('MOVED',T[k],a[k],'->',b[k]);}let n=0,added=0,gone=0;for(const k in b){if(!(k in a))added++;else if(a[k]!==b[k])n++;}for(const k in a)if(!(k in b))gone++;
  console.log('after migrations+planner again: moved',n,'added',added,'removed',gone,'of',Object.keys(b).length);
  fs.writeFileSync(process.env.OUT,JSON.stringify(await page.evaluate(()=>Object.entries(state.assignments).map(([k,a])=>[k,a.kidId,a.subject,a.title,a.date,a.done]))));console.log('page errors:',JSON.stringify(o.errors.slice(0,3)));
  process.exit(0);
})();
