import contextlib
import hashlib
import http.client
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import threading
from types import SimpleNamespace
import unittest

import rehearse_browser as browser

OWN='11111111-1111-4111-8111-111111111111'
SOURCE=b'''<!doctype html><html><head>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
<script>var SUPABASE_URL = "https://example.supabase.co";
var SUPABASE_ANON_KEY = "public-key";
tryRestoreSession();</script></body></html>'''


class BrowserRehearsalTests(unittest.TestCase):
    def test_generated_helper_matches_reviewed_source_and_pins(self):
        p=Path(__file__).parent.parent/'inspection/build_browser_helper.py'
        spec=importlib.util.spec_from_file_location('builder',p);builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
        self.assertEqual(Path(browser.__file__).read_text(),builder.build())
        self.assertEqual(browser.ASSETS['build'],'2026-11-04.5')
        self.assertTrue(all(len(e['sha256'])==64 for e in browser.ASSETS['assets']+[browser.ASSETS['sdk'],browser.ASSETS['sdk_license']]))

    def test_preview_uses_local_client_and_pauses_automatic_changes(self):
        value=browser.preview_html(SOURCE,'http://127.0.0.1:54321','local-token','nonce').decode()
        self.assertNotIn('https://example.supabase.co',value);self.assertNotIn('public-key',value)
        self.assertIn('var SUPABASE_URL = "http://127.0.0.1:54321";',value)
        self.assertIn('/vendor/supabase.js',value);self.assertIn('state.migrationsRan=true',value)
        self.assertIn('planSchedule=function(){}',value);self.assertIn('planIsOver=function(){return false;}',value)
        self.assertIn('RESTORED COPY',value);self.assertIn('whoGateEl.style.display',value)
        with self.assertRaises(browser.Stopped):browser.preview_html(SOURCE+b'tryRestoreSession();','http://127.0.0.1:1','anon','nonce')

    def test_server_blocks_mutations_private_files_foreign_hosts_and_untrusted_views(self):
        calls=[]
        class Rest:
            auth=SimpleNamespace(secret='local-test-secret')
            def raw_request(self,port,method,path,headers,body):
                calls.append((port,method,path))
                if port==9999:
                    return 200,{'Content-Type':'application/json'},json.dumps({'access_token':browser.signed_token(self.auth.secret,'authenticated',OWN)}).encode()
                return 200,{'Content-Type':'application/json'},b'[]'
        server=browser.PreviewServer(Rest(),{'index.html':SOURCE,'vendor/supabase.js':b'/* synthetic */'},{'al_kids':[],'member_pins':[]},OWN)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        def request(method,path,headers=None,body=None):
            conn=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=5)
            try:
                conn.request(method,path,body=body,headers=headers or {})
                r=conn.getresponse();data=r.read();return r.status,dict(r.getheaders()),data
            finally:conn.close()
        try:
            code,headers,body=request('GET','/');self.assertEqual(code,200);self.assertIn("connect-src 'self'",headers['Content-Security-Policy'])
            for method,path in [('POST','/rest/v1/al_kids'),('PATCH','/rest/v1/al_kids'),('DELETE','/rest/v1/al_kids'),('GET','/rest/v1/member_pins'),('POST','/rest/v1/rpc/set_member_pin'),('POST','/auth/v1/signup')]:
                self.assertEqual(request(method,path)[0],403)
            self.assertEqual(request('GET','/PRIVATE-login.json')[0],404)
            self.assertEqual(request('GET','/',{'Host':'evil.example'})[0],403)
            self.assertEqual(request('GET','http://external.example/')[0],403)
            self.assertEqual(request('CONNECT','external.example:443')[0],403)
            self.assertEqual(request('GET','/rest/v1/al_kids')[0],401);self.assertEqual(calls,[])
            headers={'Content-Type':'application/json','X-Recovery-Nonce':server.nonce}
            self.assertEqual(request('POST','/__recovery__/view',headers,json.dumps({'profile':'kid1','lesson':True}))[0],204)
            self.assertEqual(server.profiles,set())
            request('POST','/auth/v1/token?grant_type=password',{'Content-Type':'application/json'},'{}')
            request('POST','/__recovery__/view',headers,json.dumps({'profile':'kid1','lesson':True}))
            request('POST','/__recovery__/view',{'Content-Type':'application/json'},json.dumps({'profile':'kid2','lesson':True}))
            self.assertEqual(server.profiles,{'kid1'});self.assertTrue(server.lesson_seen)
            token=browser.signed_token('local-test-secret','authenticated',OWN)
            self.assertEqual(request('GET','/rest/v1/al_kids',{'Authorization':'Bearer '+token})[0],200)
        finally:server.shutdown();server.server_close();thread.join(timeout=5)

    def test_raw_transport_handles_chunking_and_keeps_token_out_of_argv(self):
        token='LOCAL-SECRET-NEVER-IN-ARGV';seen=[]
        class Db:
            docker='docker';endpoint='unix:///local';workspace='.';env={}
            def assert_offline(self):pass
        self_outer=self;obj=object.__new__(browser.LocalRest);obj.db=Db();obj.auth=SimpleNamespace(container='owned-auth',assert_isolated=lambda:None);obj.assert_isolated=lambda:None
        class Input:
            data=b'';closed=False
            def write(self,data):self.data+=data
            def flush(self):pass
            def close(self):self.closed=True
        class Process:
            def __init__(self,args,**kw):
                seen.append((args,kw,self));self_outer.assertNotIn(token,str(args));self.stdin=Input()
                self.stdout=io.BytesIO(b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n[]\r\n0\r\n\r\n')
            def wait(self,timeout=None):return 0
            def kill(self):pass
        obj.popen=Process
        with contextlib.redirect_stdout(io.StringIO()) as output:
            status,headers,body=obj.raw_request(3000,'GET','/al_kids',{'Authorization':'Bearer '+token},b'')
        self.assertEqual((status,body),(200,b'[]'));self.assertEqual(output.getvalue(),'')
        self.assertEqual(seen[0][0][-2:],['127.0.0.1','3000'])
        self.assertIn(token,seen[0][2].stdin.data.decode());self.assertTrue(seen[0][2].stdin.closed)
        with self.assertRaises(browser.Stopped):obj.raw_request(443,'GET','/',{},b'')
        with self.assertRaises(browser.Stopped):obj.raw_request(3000,'GET','/\r\ninjected',{},b'')

    def test_api_record_comparison_refuses_missing_or_truncated_saved_ids(self):
        tables={'al_kids':[{'id':'kid1'},{'id':'kid2'}],'al_assignments':[{'id':'saved-lesson'}]}
        class Rest:
            auth=SimpleNamespace(secret='local-test-secret');missing=False
            def raw_request(self,port,method,path,headers,body):
                table=path[1:].split('?')[0];rows=tables[table]
                if self.missing and table=='al_assignments':rows=[]
                return 200,{},json.dumps(rows).encode()
        rest=Rest();self.assertEqual(browser.verify_api_records(rest,tables,OWN),{'al_kids':2,'al_assignments':1})
        rest.missing=True
        with self.assertRaisesRegex(browser.Stopped,'different saved school IDs'):browser.verify_api_records(rest,tables,OWN)


if __name__=='__main__':unittest.main()
