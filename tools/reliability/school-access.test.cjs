/* Synthetic household RLS rehearsal; never contacts the family's database. */
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/restrict_school_access.sql'),'utf8');
const own='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
async function setup(){
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated;
    CREATE TABLE al_assignments(id text PRIMARY KEY,household_id uuid NOT NULL,title text);
    CREATE TABLE al_questions(id text PRIMARY KEY,household_id uuid NOT NULL,title text);
    CREATE TABLE al_kids(id text PRIMARY KEY,household_id uuid NOT NULL);
    CREATE TABLE member_pins(member_id uuid PRIMARY KEY,household_id uuid NOT NULL);
    CREATE TABLE storage.objects(id uuid);
    CREATE TABLE storage.buckets(id text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    GRANT SELECT,INSERT,UPDATE,DELETE ON al_assignments,al_questions,al_kids,member_pins TO anon,authenticated;
    GRANT SELECT,INSERT ON storage.objects TO anon,authenticated;
    ALTER TABLE al_assignments ENABLE ROW LEVEL SECURITY;ALTER TABLE al_questions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow read" ON al_assignments FOR SELECT USING(true);
    CREATE POLICY "Allow update" ON al_assignments FOR UPDATE USING(true) WITH CHECK(true);
    CREATE POLICY "Allow insert" ON al_assignments FOR INSERT WITH CHECK(true);
    CREATE POLICY "al_assignments_delete_own" ON al_assignments FOR DELETE USING(auth.uid()=household_id);
    CREATE POLICY "al_questions_all_own" ON al_questions FOR ALL USING(auth.uid()=household_id) WITH CHECK(auth.uid()=household_id);
    CREATE POLICY "Allow insert" ON al_questions FOR INSERT WITH CHECK(true);
    INSERT INTO al_assignments VALUES('own','${own}','Own lesson'),('other','${other}','Other lesson');
    INSERT INTO al_questions VALUES('own-q','${own}','Own question'),('other-q','${other}','Other question');`);
  return db;
}
test('broad policies expose synthetic rows when grants permit; correction preserves household CRUD',async()=>{
  const db=await setup();try{
    await db.exec('SET ROLE anon');
    assert.equal((await db.query('SELECT id FROM al_assignments')).rows.length,2);
    await db.exec(`UPDATE al_assignments SET title='Unwanted change' WHERE id='other'`);
    await db.exec('RESET ROLE');
    await db.exec(migration);await db.exec(migration); // Safe to repeat.
    const verification=fs.readFileSync(path.resolve(__dirname,'../inspection/verify_permissions.sql'),'utf8');
    const report=(await db.query(verification)).rows[0].permission_verification;
    assert.equal(report.school_tables_with_rls,2);assert.equal(report.expected_household_policies,2);
    assert.equal(report.unrestricted_school_policies_remaining,0);
    await db.exec('SET ROLE anon');
    assert.equal((await db.query('SELECT id FROM al_assignments')).rows.length,0);
    await assert.rejects(db.exec(`INSERT INTO al_assignments VALUES('anon','${own}','blocked')`),/row-level security/);
    await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${own}',false)`);
    assert.deepEqual((await db.query('SELECT id FROM al_assignments')).rows.map(r=>r.id),['own']);
    await db.exec(`UPDATE al_assignments SET title='Parent edit' WHERE id='own';
      INSERT INTO al_assignments VALUES('new','${own}','Parent addition');
      UPDATE al_assignments SET title='blocked' WHERE id='other';`);
    await assert.rejects(db.exec(`INSERT INTO al_assignments VALUES('wrong','${other}','blocked')`),/row-level security/);
    await assert.rejects(db.exec(`UPDATE al_assignments SET household_id='${other}' WHERE id='own'`),/row-level security/);
    await assert.rejects(db.exec(`INSERT INTO al_questions VALUES('wrong-q','${other}','blocked')`),/row-level security/);
    await db.exec(`INSERT INTO al_questions VALUES('new-q','${own}','Allowed question');
      DELETE FROM al_assignments WHERE id='new';DELETE FROM al_assignments WHERE id='other';RESET ROLE;`);
    assert.equal((await db.query("SELECT title FROM al_assignments WHERE id='own'")).rows[0].title,'Parent edit');
    assert.equal((await db.query("SELECT title FROM al_assignments WHERE id='other'")).rows[0].title,'Unwanted change');
    assert.equal((await db.query('SELECT id FROM al_assignments')).rows.length,2);
  }finally{await db.close();}
});
test('unexpected unconditional policy aborts the entire correction',async()=>{
  const db=await setup();try{
    await db.exec('CREATE POLICY unexpected_open_access ON al_assignments FOR SELECT USING(true)');
    await assert.rejects(db.exec(migration),/Unexpected unconditional/);await db.exec('ROLLBACK');
    assert.equal((await db.query("SELECT policyname FROM pg_policies WHERE tablename='al_assignments' AND policyname='Allow read'")).rows.length,1);
    assert.equal((await db.query("SELECT policyname FROM pg_policies WHERE policyname='school_assignments_household_only'")).rows.length,0);
  }finally{await db.close();}
});
test('read-only grant query reports privileges and bucket configuration without selecting family data',async()=>{
  const db=await setup();try{
    const sql=fs.readFileSync(path.resolve(__dirname,'../inspection/access_check.sql'),'utf8');
    const out=(await db.query(sql)).rows[0].access_check;
    assert.equal(out.api_roles.length,2);
    assert.equal(out.api_roles.find(r=>r.role==='anon').tables.find(t=>t.name==='al_assignments').select,true);
    assert.deepEqual(out.upload_bucket,[]);
    assert.equal(out.missing_inspector_column,true);
  }finally{await db.close();}
});
