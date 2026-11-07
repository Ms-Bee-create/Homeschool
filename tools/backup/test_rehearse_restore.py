import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import rehearse_restore as helper

PROJECT='abcdefghijklmnopqrst'
OWN='11111111-1111-4111-8111-111111111111'
MEMBER='22222222-2222-4222-8222-222222222222'
REWARD='33333333-3333-4333-8333-333333333333'

def fixture(base):
    root=Path(base);backup=root/'backup-tools';backup.mkdir();dest=backup/'backups';snapshot=dest/'data/2026-11-06';snapshot.mkdir(parents=True)
    (backup/'backup.py').write_text('not executed')
    (backup/'.env').write_text('SUPABASE_URL=https://'+PROJECT+'.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=DO-NOT-USE\n')
    tables={t:[] for t in helper.REQUIRED|helper.HOME_QUEST|{'member_pins'}}
    tables.update(households=[{'id':OWN}],al_kids=[{'id':'kid1','household_id':OWN},{'id':'kid2','household_id':OWN}],
      members=[{'id':MEMBER,'household_id':OWN,'has_pin':True,'current_balance':12.5,'goal_reward_id':REWARD}],
      reward_items=[{'id':REWARD,'household_id':OWN,'owner_id':MEMBER}],
      transactions=[{'id':'transaction','household_id':OWN,'member_id':MEMBER,'amount':2.5}],
      al_assignments=[{'id':'lesson','household_id':OWN,'work_blocks':[{'type':'text','text':"Anna 🦄 tried. '; DROP TABLE members; --"}],'done':False}],
      member_pins=[{'member_id':MEMBER,'household_id':OWN,'pin_hash':'synthetic-only'}])
    entries=[]
    for table,rows in tables.items():
        p=snapshot/(table+'.json');p.write_text(json.dumps(rows,ensure_ascii=False))
        entries.append({'path':p.name,'rows':len(rows),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    m={'format':1,'complete':True,'source':'https://'+PROJECT+'.supabase.co','tables':entries,'files':[],
       'coverage':{'home_quest':True,'member_pins':True}}
    (snapshot/'manifest.json').write_text(json.dumps(m))
    structure=dest/'database-structure/2026-11-07';structure.mkdir(parents=True)
    sql=schema_sql(tables)
    files=[]
    for name,text in [('application.sql',sql),('roles.sql','-- No custom roles in this synthetic fixture.'),('managed-structure.sql','-- Reference only')]:
        p=structure/name;p.write_text(text);files.append({'path':name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    (structure/'manifest.json').write_text(json.dumps({'format':'forge-structure-export-v1','complete':True,'project_ref':PROJECT,'files':files}))
    return backup,dest,snapshot,tables,sql

def schema_sql(tables):
    out=[]
    special={
      'households':'id uuid PRIMARY KEY REFERENCES auth.users(id)',
      'al_assignments':'id text PRIMARY KEY,household_id uuid,work_blocks jsonb,done boolean',
      'members':'id uuid PRIMARY KEY,household_id uuid REFERENCES households(id),has_pin boolean,current_balance numeric(10,2),goal_reward_id uuid',
      'reward_items':'id uuid PRIMARY KEY,household_id uuid REFERENCES households(id),owner_id uuid REFERENCES members(id)',
      'member_pins':'member_id uuid PRIMARY KEY REFERENCES members(id),household_id uuid REFERENCES households(id),pin_hash text',
      'transactions':'id text PRIMARY KEY,household_id uuid REFERENCES households(id),member_id uuid REFERENCES members(id),amount numeric(10,2)',
      'al_settings':'household_id uuid PRIMARY KEY'}
    order=['households','members','reward_items']+[t for t in sorted(tables) if t not in ('households','members','reward_items')]
    for table in order:
        out.append('CREATE TABLE public.'+helper.ident(table)+'('+special.get(table,'id text PRIMARY KEY,household_id uuid')+');')
        out.append('ALTER TABLE public.'+helper.ident(table)+' ENABLE ROW LEVEL SECURITY;')
        if table!='households':
            out.append('CREATE POLICY own_rows ON public.'+helper.ident(table)+' FOR ALL USING(household_id=auth.uid()) WITH CHECK(household_id=auth.uid());')
        out.append('GRANT SELECT ON public.'+helper.ident(table)+' TO anon,authenticated;')
    out.append('ALTER TABLE members ADD CONSTRAINT member_goal_fk FOREIGN KEY(goal_reward_id) REFERENCES reward_items(id);')
    return '\n'.join(out)

BASELINE="""CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;"""

class PgAdapter:
    def __init__(self):
        self.process=subprocess.Popen(['node',str(Path(__file__).parent.parent/'reliability/restore-pg-adapter.cjs')],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=dict(os.environ))
    def query(self,sql,raw=False):
        self.process.stdin.write(json.dumps({'sql':sql,'raw':raw})+'\n');self.process.stdin.flush()
        line=self.process.stdout.readline()
        if not line:raise RuntimeError(self.process.stderr.read())
        result=json.loads(line)
        if not result['ok']:raise RuntimeError(result['error'])
        return result['value']
    def close(self):
        self.process.stdin.close();self.process.wait(timeout=30)
        self.process.stdout.close();self.process.stderr.close()

class RehearsalTests(unittest.TestCase):
    def test_local_docker_guard_disconnects_networks_and_requires_tmpfs_before_queries(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);cli=root/'supabase.exe';cli.write_text('not executed');workspace=root/'workspace';workspace.mkdir()
            state={'started':False,'volume':False,'network':False,'connected':True};calls=[];db=None
            def runner(argv,**kw):
                calls.append((argv,kw))
                self.assertNotIn('SUPABASE_ACCESS_TOKEN',kw['env']);self.assertNotIn('SUPABASE_DB_PASSWORD',kw['env'])
                def result(value='',code=0):return subprocess.CompletedProcess(argv,code,value.encode(),b'')
                if argv[0]==str(cli):
                    self.assertNotIn('--remote',str(argv));self.assertNotIn('--yes',argv)
                    if argv[1]=='init':
                        folder=workspace/'supabase';folder.mkdir();(folder/'config.toml').write_text('project_id="initial"\n[db]\nport = 54322\nmajor_version = 17\n')
                    elif argv[1:3]==['db','start']:state['started']=True
                    else:raise AssertionError(argv)
                    return result()
                args=argv[2:];self.assertTrue(argv[1].startswith('--host='))
                if args[:1]==['info']:return result(json.dumps({'OSType':'linux'}))
                if args[:2]==['container','inspect']:return result('',0 if state['started'] else 1)
                if args[:2]==['volume','inspect']:
                    return result(json.dumps([{'Options':{'type':'tmpfs','device':'tmpfs'}}]),0 if state['volume'] else 1)
                if args[:2]==['network','inspect']:return result('',0 if state['network'] else 1)
                if args[:2]==['image','ls']:return result(json.dumps({'Repository':'public.ecr.aws/supabase/postgres','Tag':'17.6.1.021'}))
                if args[:2]==['volume','create']:state['volume']=True;return result()
                if args[:2]==['network','create']:state['network']=True;return result()
                if args[:1]==['inspect']:
                    return result(json.dumps([{'Name':'/'+db.container_name,'Id':'synthetic-container-id',
                      'NetworkSettings':{'Networks':{'isolated':{}} if state['connected'] else {}},
                      'Mounts':[{'Name':db.volume,'Destination':'/var/lib/postgresql/data'}]}]))
                if args[:2]==['network','disconnect']:state['connected']=False;return result()
                if args[:1]==['exec']:
                    self.assertFalse(state['connected']);self.assertIn('-w',args);self.assertIn('-qtA',args)
                    self.assertNotIn('DROP TABLE',str(args))
                    source=kw.get('input',b'')
                    if b"'users',to_regclass" in source:return result(json.dumps({'users':True,'uid':True,'roles':2}))
                    return result('/var/lib/postgresql/data\n' if source.startswith(b'SHOW') else '')
                if args[:1] in (['stop'],['rm']) or args[:2] in (['volume','rm'],['network','rm']):return result()
                raise AssertionError(argv)
            with patch('rehearse_restore.shutil.which',return_value='docker'),patch.dict(os.environ,{'SUPABASE_ACCESS_TOKEN':'private','SUPABASE_DB_PASSWORD':'private'}):
                db=helper.LocalDatabase(cli,workspace,root/'private.log',runner)
                with contextlib.redirect_stdout(io.StringIO()):db.start()
                self.assertFalse(state['connected']);self.assertEqual(db.container,'synthetic-container-id')
                db.query('SELECT 1; DROP TABLE synthetic_only;',raw=True)
                state['connected']=True
                with self.assertRaises(helper.RehearsalStopped):db.query('SELECT 1',raw=True)
                state['connected']=False;db.stop()
                self.assertEqual((workspace/'supabase/.temp/postgres-version').read_text().strip(),'17.6.1.021')
    def test_generated_copy_is_current(self):
        spec=importlib.util.spec_from_file_location('builder',Path(__file__).parent.parent/'inspection/build_restore_helper.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        self.assertEqual(Path(helper.__file__).read_text(),module.build())
    def test_input_integrity_and_no_cloud_credentials_in_restore_environment(self):
        with tempfile.TemporaryDirectory() as d:
            backup,dest,snapshot,tables,sql=fixture(d)
            project,_,_,_,loaded,_=helper.read_inputs(backup);self.assertEqual(project,PROJECT);self.assertEqual(loaded,tables)
            with patch.dict(os.environ,{'SUPABASE_ACCESS_TOKEN':'private','SUPABASE_DB_PASSWORD':'private','PGPASSWORD':'private','SUPABASE_YES':'1'}):
                env=helper.clean_env(Path(d)/'private-cli-home','unix:///var/run/docker.sock')
                self.assertNotIn('SUPABASE_ACCESS_TOKEN',env);self.assertNotIn('PGPASSWORD',env);self.assertNotIn('SUPABASE_YES',env)
            (snapshot/'al_assignments.json').write_text('[]')
            with self.assertRaises(ValueError):helper.read_inputs(backup)
    def test_postgres_restores_exact_values_cycles_and_scoped_reads(self):
        with tempfile.TemporaryDirectory() as d:
            backup,dest,snapshot,tables,sql=fixture(d);db=PgAdapter()
            try:
                db.query(BASELINE,raw=True);db.query(sql,raw=True);db.query(helper.insert_sql(tables),raw=True)
                counts=helper.check_rows(db,tables);self.assertEqual(counts['al_assignments'],1)
                self.assertGreater(helper.check_foreign_keys(db,tables),0)
                self.assertEqual(helper.check_household_reads(db,tables),4)
                db.query("SET session_replication_role=replica; UPDATE transactions SET member_id='44444444-4444-4444-8444-444444444444'; SET session_replication_role=origin;",raw=True)
                with self.assertRaises(helper.RehearsalStopped):helper.check_foreign_keys(db,tables)
                db.query('CREATE POLICY bad_public_read ON al_assignments FOR SELECT USING(true);',raw=True)
                with self.assertRaises(helper.RehearsalStopped):helper.check_household_reads(db,tables)
            finally:db.close()

if __name__=='__main__':unittest.main()
