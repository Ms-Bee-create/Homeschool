/* Lesson audit: opens every lesson the way a kid would (the real lesson page, rendered) and checks that it has what a
   lesson needs (CLAUDE.md rules 1-6, 18, 19, plus reading load). Writes report.md and report.json next to this file.
   Run: NODE_PATH=<folder with playwright-core and @supabase/supabase-js> node audit.js */
const h = require('./harness'); const fs = require('fs');
(async()=>{
  const {browser,page,errors} = await h.open();
  await page.waitForTimeout(8000);
  await page.evaluate(()=>{ __fa.runAutoMigrations(); }); /* like a second page load, so patches see the lessons the first load created */
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ /* packs Mom has not added yet are audited too, as if they were on the calendar */
    __fa.contentPacks().forEach((pk,pi)=>{ (pk.items||[]).forEach((it,ii)=>{
      if(Object.values(state.assignments).some(a=>a.kidId===pk.kid && a.title===it.title)) return;
      state.assignments['pack'+pi+'_'+ii] = Object.assign({kidId:pk.kid, date:'2099-01-01', done:false}, it);
    }); });
  });
  const rows = await page.evaluate(()=>{
    const out = [];
    const ids = Object.keys(state.assignments);
    for(const id of ids){
      const a = state.assignments[id];
      state.lessonDetailId = id; state.activeKid = a.kidId; state.leaderMode = false;
      let text = '', html = '', err = '';
      try{ __fa.renderLessonDetail(); text = __fa.els.view.innerText; html = __fa.els.view.innerHTML; }catch(e){ err = String(e.message||e); }
      const st = (a.standard) ? a.standard.split('/').map(c=>__fa.STANDARD_STATUS[c.trim()]||'unverified') : [];
      out.push({id, kid:a.kidId, date:a.date, title:a.title, subject:a.subject, stage:a.stage, standard:a.standard||'', stdStatus:st,
        passage:a.passage||'', materials:a.materials||'', video:a.video||'', quizN:(a.quiz||[]).length,
        quizNoExplain:(a.quiz||[]).filter(q=>!q.explain).length, done:!!a.done,
        hasCards:__fa.EXPLAINER_CARDS.some(d=>String(a.title||'').indexOf(d.match)===0), shown:text, hasListen:/Read aloud/.test(html)||html.indexOf('speak-btn')>=0, hasSteps:/<li|checkbox|type="checkbox"/.test(html), err});
    }
    state.lessonDetailId = null; __fa.renderView();
    return out;
  });
  const words = s=>(s.match(/\S+/g)||[]).length;
  const sents = s=>s.split(/(?<=[.!?])\s+/).filter(x=>x.trim());
  const issues = [];
  for(const r of rows){
    const p = [], w = [];
    const kid = r.kid==='kid1'?'Anna':'Ryan';
    const isFixed = /^(Show & Teach|Morning Launch)/i.test(r.title||'');
    if(r.err) p.push('lesson page crashes: '+r.err);
    if(isFixed) p.push('title copies a fixed block name (rule 16)');
    if(!r.title || r.title.length<12) p.push('title too short to tell the kid what to do (rule 18)');
    if(/^(🔁 )?review:/i.test(r.title||'')) p.push('title is only "Review:" (rule 18)');
    if(!r.passage.trim()){ p.push('no instructions at all (rule 19)'); }
    else {
      const hasGather = /Gather first/i.test(r.passage), hasIdea = /Here'?s the Idea/i.test(r.passage), hasTurn = /Your Turn/i.test(r.passage);
      const hasSee = /See It Done/i.test(r.passage), hasCheck = /Check Yourself/i.test(r.passage), hasShow = /Show What You Know/i.test(r.passage);
      if(!hasTurn && !/\n\s*\d+\./.test(r.passage) && !/\b1\.\s/.test(r.passage)) w.push('no numbered steps to follow');
      if(!hasIdea && r.stage==='teach') p.push('teaching lesson without "Here\'s the Idea" (rule 2)');
      if(r.stage==='teach' && !hasSee && !/\bexample\b|e\.g\./i.test(r.passage)) p.push('teaching lesson without a worked example (rule 2)');
      if(!hasCheck && !r.quizN) w.push('no way to check understanding (no Check Yourself, no quiz)');
      if(!hasShow && !hasCheck && !r.quizN && r.stage==='apply') w.push('apply lesson without Show What You Know (rule 15)');
      if(!hasGather && /Minecraft|paper|pencil|tape|scissors|cup|ruler|string/i.test(r.passage)) w.push('uses supplies but has no "Gather first" list');
      const limit = r.kid==='kid1' ? 14 : 22; const ss = sents(r.passage); const avg = ss.length? words(r.passage)/ss.length : 0;
      const longest = ss.reduce((m,s)=>Math.max(m,words(s)),0);
      if(r.hasCards){} else if(r.kid==='kid1' && words(r.passage)>(/^Handwriting p\./.test(r.title||'')?330:260)) w.push(kid+': long ('+words(r.passage)+' words), may feel like a wall of text');
      else if(r.kid==='kid2' && words(r.passage)>420) w.push(kid+': long ('+words(r.passage)+' words)');
      if(avg>limit) w.push(kid+': sentences average '+avg.toFixed(1)+' words (hard to read)');
      if(longest>(r.kid==='kid1'?32:45)) w.push(kid+': one sentence is '+longest+' words long');
      if(/the link above|link below|click here/i.test(r.passage) && !r.materials && !r.video) p.push('passage mentions a link but the lesson has none (rule 1)');
    }
    for(const u of [r.materials, r.video].filter(Boolean)){
      try{ const x = new URL(u); if(/^https?:/.test(u) && (x.pathname==='/'||x.pathname==='') ) p.push('link goes to a homepage: '+u+' (rule 1)');
           else if(/\/(search|browse|category|categories|apps|catalog)\/?$/i.test(x.pathname)) w.push('link may be a listing page: '+u+' (rule 1)'); }
      catch(e){ if(!/^videos\/[\w.-]+\.mp4$/.test(u)) p.push('link is not a valid web address: '+u); }
    }
    if(!r.standard) p.push('no standard tag (rule 6)');
    else if(r.stdStatus.some(s=>s==='unverified')) w.push('standard '+r.standard+' is not verified (rule 24)');
    else if(r.stdStatus.some(s=>s==='exists')) w.push('standard '+r.standard+' exists but fit not confirmed (rule 24)');
    if(r.quizNoExplain) p.push(r.quizNoExplain+' quiz question(s) with no explanation (rule 5)');
    if(!r.shown.trim()) p.push('lesson page shows nothing');
    if(/undefined|\[object|NaN\b/.test(r.shown)) p.push('lesson page shows broken text (undefined / [object])');
    if(r.passage.trim() && !r.hasListen) w.push('no read-aloud button on the page');
    if(p.length||w.length) issues.push({id:r.id,kid,date:r.date,title:r.title,subject:r.subject,problems:p,warnings:w});
  }
  const byKind = {}; issues.forEach(i=>i.problems.concat(i.warnings).forEach(x=>{ const k=x.replace(/\d+(\.\d+)?/g,'N').replace(/: https?:\S+/,'').replace(/Anna|Ryan/,'kid'); byKind[k]=(byKind[k]||0)+1; }));
  fs.writeFileSync(__dirname+'/report.json', JSON.stringify({total:rows.length, errors, issues}, null, 1));
  let md = '# Lesson audit\n\nLessons checked: '+rows.length+'. With problems: '+issues.filter(i=>i.problems.length).length+'. Warnings only: '+issues.filter(i=>!i.problems.length).length+'.\n\n## Most common\n';
  Object.entries(byKind).sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>md+='- '+n+' x '+k+'\n');
  md += '\n## Lessons with problems\n';
  issues.filter(i=>i.problems.length).forEach(i=>{ md += '\n**'+i.kid+' '+(i.date||'')+' - '+i.title+'**\n'+i.problems.map(x=>'- PROBLEM: '+x).join('\n')+'\n'+i.warnings.map(x=>'- warning: '+x).join('\n')+'\n'; });
  fs.writeFileSync(__dirname+'/report.md', md);
  console.log(md.split('\n## Lessons')[0]); console.log('page errors:', errors.slice(0,3));
  await browser.close();
})();
