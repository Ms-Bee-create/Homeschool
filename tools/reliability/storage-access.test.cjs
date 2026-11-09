/* Metadata/insert RLS only. A public bucket's download endpoint bypass is a separate concern. */
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const sql=fs.readFileSync(path.resolve(__dirname,'../../supabase/restrict_upload_access.sql'),'utf8');
const own='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
async function setup(){
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean);
    CREATE TABLE storage.objects(id text PRIMARY KEY,bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated;
    GRANT SELECT,INSERT ON storage.objects TO anon,authenticated;
    CREATE POLICY "Allow read" ON storage.objects FOR SELECT USING(bucket_id='lesson-uploads');
    CREATE POLICY "Allow uploads" ON storage.objects FOR INSERT WITH CHECK(bucket_id='lesson-uploads');
    INSERT INTO storage.buckets VALUES('lesson-uploads',true);
    INSERT INTO storage.objects VALUES('own','lesson-uploads','${own}/lesson/photo.png'),
      ('other','lesson-uploads','${other}/lesson/photo.png'),('elsewhere','other-app','${own}/file');`);
  return db;
}
test('household metadata and uploads are restricted without modifying public links or object rows',async()=>{
  const db=await setup();try{
    await db.exec(sql);await db.exec(sql);
    await db.exec('SET ROLE anon');
    assert.equal((await db.query('SELECT id FROM storage.objects')).rows.length,0);
    await assert.rejects(db.exec(`INSERT INTO storage.objects VALUES('anon','lesson-uploads','${own}/bad')`),/row-level security/);
    await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${own}',false)`);
    assert.deepEqual((await db.query('SELECT id FROM storage.objects')).rows.map(r=>r.id),['own']);
    await db.exec(`INSERT INTO storage.objects VALUES('ok','lesson-uploads','${own}/morning-launch/kid2/audio.webm')`);
    for(const name of [other+'/bad',own+'extra/bad','no-household/bad'])
      await assert.rejects(db.query('INSERT INTO storage.objects VALUES($1,$2,$3)',['invalid','lesson-uploads',name]),/row-level security/);
    await assert.rejects(db.query('INSERT INTO storage.objects VALUES($1,$2,$3)',['invalid','other-app',own+'/bad']),/row-level security/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM storage.objects')).rows[0].n,4);
    assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='lesson-uploads'")).rows[0].public,true);
  }finally{await db.close();}
});
test('unexpected policy on another app prevents any storage policy changes',async()=>{
  const db=await setup();try{
    await db.exec(`CREATE POLICY other_app_read ON storage.objects FOR SELECT USING(bucket_id='other-app')`);
    await assert.rejects(db.exec(sql),/Unexpected storage policy/);await db.exec('ROLLBACK');
    assert.equal((await db.query(`SELECT policyname FROM pg_policies WHERE schemaname='storage' AND policyname='Allow read'`)).rows.length,1);
  }finally{await db.close();}
});
