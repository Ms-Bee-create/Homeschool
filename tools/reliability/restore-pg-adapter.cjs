/* Synthetic restore-test adapter. Never used by the laptop helper or production app. */
const {PGlite}=require('@electric-sql/pglite');
const readline=require('node:readline');
(async()=>{
 const db=new PGlite();
 try{
  for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
   try{
    const {sql,raw}=JSON.parse(line);const results=await db.exec(sql);
    const rows=results.flatMap(r=>r.rows||[]);
    const value=raw?rows.map(r=>Object.values(r).map(v=>typeof v==='object'?JSON.stringify(v):String(v)).join('|')).join('\n'):
      (rows.length?Object.values(rows[rows.length-1])[0]:null);
    process.stdout.write(JSON.stringify({ok:true,value})+'\n');
   }catch(e){process.stdout.write(JSON.stringify({ok:false,error:e.message})+'\n');}
  }
 }finally{await db.close();}
})().catch(e=>{process.stderr.write(e.message);process.exitCode=1;});
