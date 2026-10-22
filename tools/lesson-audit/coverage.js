/* Standards coverage: which verified Georgia codes (Grade 2 for Anna, Grade 4 for Ryan) have lessons, counting
   lessons already on the calendar and lessons waiting in Content Packs. Writes coverage.md.
   Run: NODE_PATH=<folder with playwright-core and @supabase/supabase-js> node coverage.js   (SEED=export.json to use the real schedule) */
const h = require('./harness'); const fs = require('fs');
(async()=>{
  const {browser,page} = await h.open();
  await page.waitForTimeout(8000);
  await page.evaluate(()=>{ __fa.runAutoMigrations(); }); await page.waitForTimeout(1500);
  const d = await page.evaluate(()=>{
    const kids = {}; Object.keys(state.kids).forEach(i=>kids[i]=state.kids[i].name);
    const sched = [], packs = [];
    Object.values(state.assignments).forEach(a=>sched.push({k:a.kidId,s:a.standard||'',t:a.title}));
    __fa.contentPacks().forEach(pk=>(pk.items||[]).forEach(it=>packs.push({k:pk.kid,s:it.standard||'',t:it.title})));
    return {kids, sched, packs, codes:Object.keys(__fa.STANDARD_STATUS).filter(c=>__fa.STANDARD_STATUS[c]==='verified')};
  });
  const ids = Object.keys(d.kids);
  const who = n=>ids.find(i=>/anna/i.test(d.kids[i])) && (n==='Anna'?ids.find(i=>/anna/i.test(d.kids[i])):ids.find(i=>/ryan/i.test(d.kids[i])));
  const fam = {Anna:c=>/^(2\.|S2|SS2)/.test(c), Ryan:c=>/^(4\.|S4|SS4|CSS)/.test(c)};
  const main = c=>/^SS\d[A-Z]+\d[a-z]$/.test(c) ? null : c;  /* lettered Social Studies parts cannot be told from a tag; checked by topic instead */
  let md = '# Standards coverage\n\nLessons on the calendar / waiting in Content Packs, per verified Georgia code. "none" = no lesson at all.\n';
  ['Anna','Ryan'].forEach(n=>{
    const id = who(n); const tags = (list)=>{ const m={}; list.filter(x=>x.k===id).forEach(x=>x.s.split('/').forEach(c=>{c=c.trim(); if(c) m[c]=(m[c]||0)+1;})); return m; };
    const a = tags(d.sched), p = tags(d.packs);
    const codes = d.codes.filter(fam[n]).filter(main).sort();
    const none = codes.filter(c=>!a[c]&&!p[c]), packOnly = codes.filter(c=>!a[c]&&p[c]), thin = codes.filter(c=>(a[c]||0)+(p[c]||0)===1);
    md += `\n## ${n}\n- verified codes: ${codes.length}; covered: ${codes.length-none.length}\n- NONE (${none.length}): ${none.join(', ')}\n- only in a pack not yet added (${packOnly.length}): ${packOnly.join(', ')}\n- only 1 lesson (${thin.length}): ${thin.join(', ')}\n`;
  });
  fs.writeFileSync(__dirname+'/coverage.md', md); console.log(md); await browser.close();
})();
