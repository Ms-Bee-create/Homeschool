/* Schedule check: loads the app (with SEED=export.json for the real schedule), adds every content pack, runs the planner and the full migration chain, and prints:
   how many lessons each repeat run moves (must be 0), template violations, and the next 12 school days per kid (count, missing slots, subjects). Read-only. */
const h=require('/home/user/Homeschool/tools/lesson-audit/harness.js');
(async()=>{const o=await h.open();const page=o.page;await page.waitForTimeout(8000);
await page.evaluate(()=>{__fa.contentPacks().forEach(pk=>{try{pk.load&&pk.load()}catch(e){}});});
await page.waitForTimeout(1500);
const snap=()=>page.evaluate(()=>{const r={};Object.entries(state.assignments).forEach(([k,a])=>r[k]=a.date);return r;});
await page.evaluate(()=>__fa.runAutoMigrations());await page.waitForTimeout(500);
let a;
for(let i=0;i<3;i++){await page.waitForTimeout(800);let m=await page.evaluate(()=>__fa.planSchedule());console.log('plan run',i+1,'moved',m);}
a=await snap();await page.evaluate(()=>__fa.runAutoMigrations());await page.waitForTimeout(800);const b=await snap();let n=0;for(const k in b)if(a[k]!==b[k])n++;console.log('migrations again moved',n,'of',Object.keys(b).length);
const rep=await page.evaluate(()=>{
 const out={};const today=new Date().toISOString().slice(0,10);
 ['kid1','kid2'].forEach(kid=>{const days={};Object.values(state.assignments).forEach(a=>{if(a.kidId===kid&&a.date>=today&&a.reviewStatus!=='retired'&&a.skillId!=='offscreen-friday'){(days[a.date]=days[a.date]||[]).push(a);}});
  const ds=Object.keys(days).sort().slice(0,12);out[kid]=ds.map(d=>{const dow=new Date(d+'T00:00:00').getDay();const subj={};days[d].forEach(a=>{const k=a.subject;subj[k]=(subj[k]||0)+1});return d.slice(5)+' '+'SMTWTFS'[dow]+' n='+days[d].length+' miss=['+__fa.schedMissing(kid,d).join(',')+'] '+Object.entries(subj).map(([k,v])=>k.slice(0,6)+v).join(' ');});});
 return out;});
const viol=await page.evaluate(()=>{const v=[];const today=new Date().toISOString().slice(0,10);['kid1','kid2'].forEach(kid=>{const days={};Object.values(state.assignments).forEach(a=>{if(a.kidId===kid&&a.date>=today&&a.reviewStatus!=='retired'&&a.skillId!=='offscreen-friday'&&!a.done){(days[a.date]=days[a.date]||[]).push(a);}});Object.keys(days).forEach(d=>{const dow=new Date(d+'T00:00:00').getDay();days[d].forEach(a=>{if(!__fa.rhythmAllows(a,dow))v.push(kid+' '+d+' '+a.subject+' off its weekday: '+a.title.slice(0,40));});const sc={};days[d].forEach(a=>{const k=__fa.subjKey(a);sc[k]=(sc[k]||0)+1;});Object.keys(__fa.SUBJECT_DAY_CAP[kid]).forEach(k=>{if(sc[k]>__fa.SUBJECT_DAY_CAP[kid][k])v.push(kid+' '+d+' '+k+' x'+sc[k]);});const wk=new Date(d+'T00:00:00').getDay();if(wk===0||wk===6)v.push(kid+' weekend '+d);});});return v;});
console.log('violations',viol.length,viol.slice(0,8));console.log(JSON.stringify(await page.evaluate(()=>Object.values(state.assignments).filter(a=>a.kidId==='kid1'&&a.subject==='Social Studies'&&['2026-11-16','2026-11-17'].includes(a.date)).map(a=>[a.date,a.skillId,a.title.slice(0,40),a.done]))));const bd=[];for(const k in b)if(a[k]!==b[k])bd.push(k);console.log(JSON.stringify(await page.evaluate((ks)=>ks.slice(0,6).map(k=>[state.assignments[k].title.slice(0,40),state.assignments[k].skillId]),bd)));
console.log('ANNA\n'+rep.kid1.join('\n'));console.log('RYAN\n'+rep.kid2.join('\n'));
process.exit(0)})();
