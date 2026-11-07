/* Bounded, household-scoped, read-only inspection. No arbitrary SQL/table/URL inputs. */
export const TOOLS = [{name:'inspect_stored_day',
  description:'Read stored assignments, schedule settings and Home Quest for one date. This is database state, not a rendered/effective browser schedule. Compare with the parent export before claiming parity.',
  inputSchema:{type:'object',properties:{date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}},required:['date'],additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}];

export function validDate(date){
  if(typeof date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const d=new Date(date+'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===date;
}

export async function inspectDay(date, read){
  if(!validDate(date))throw Error('Invalid date');
  // read() is supplied only by the server and always adds its configured household filter.
  const specs=[
    ['assignments','al_assignments','id,kid_id,date,title,subject,stage,standard,done,submitted_at,review_status',{date:'eq.'+date}],
    ['kids','al_kids','id,name,day_plan',{}],
    ['schedules','al_schedule','kid_id,blocks',{}],
    ['settings','al_settings','project:family_goal->rp,days_off:family_goal->daysOff',{}],
    ['homeJobs','home_jobs','id,member_id,title,place,time_label,slot,days,sort,active',{}],
    ['homeLogs','home_job_logs','id,job_id,member_id,day,status',{day:'eq.'+date}],
    ['members','members','id,name,role',{}]
  ];
  const result={format:'forge-stored-day-v1',date,capturedAt:new Date().toISOString(),source:'direct-database-read',
    consistency:'Sequential reads; not a transactionally consistent snapshot.',
    limitations:['Not a rendered schedule. Browser defaults, unsynced changes and local fallbacks can differ.',
      'Includes retired assignments for comparison; these are hidden by assignmentsFor in the app.',
      'Home jobs include inactive/nonmatching weekdays so configuration can be inspected.',
      'The supplied live schema has no al_kids.block_order column; compare the browser default order separately.',
      'No lesson answers, media, balances, login credentials or parent PINs are returned.']};
  for(const [name,table,select,filters] of specs)result[name]=await read(table,select,filters);
  return result;
}

export async function dispatch(message, read){
  if(!message || typeof message!=='object' || Array.isArray(message) || message.jsonrpc!=='2.0')
    return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}};
  const {id,method,params={}}=message;
  if(method==='notifications/initialized' && id===undefined)return null;
  if(id===undefined || !(typeof id==='string' || (typeof id==='number' && Number.isFinite(id))))
    return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'A request ID is required'}};
  const reply=(result)=>({jsonrpc:'2.0',id,result});
  const error=(code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
  if(method==='initialize')return reply({protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},
    serverInfo:{name:'forge-read-only-inspection',version:'0.1.0'}});
  if(method==='ping')return reply({});
  if(method==='tools/list')return reply({tools:TOOLS});
  if(method!=='tools/call')return error(-32601,'Unsupported method');
  if(!params || params.name!=='inspect_stored_day')return error(-32602,'Unknown tool');
  const args=params.arguments;
  if(!args || Object.keys(args).some(k=>k!=='date') || !validDate(args.date))return error(-32602,'Provide one valid date');
  try{return reply({content:[{type:'text',text:JSON.stringify(await inspectDay(args.date,read))}]});}
  catch{return reply({isError:true,content:[{type:'text',text:'Inspection failed or exceeded its limit. No data was changed; no partial result is presented as complete.'}]});}
}

export async function boundedJSON(response,limit){
  if(!response.body)throw Error('Empty response');
  const reader=response.body.getReader();let bytes=0;const chunks=[];
  try{
    while(true){const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;if(bytes>limit)throw Error('Response limit exceeded');chunks.push(value);}
  }finally{await reader.cancel();}
  const joined=new Uint8Array(bytes);let offset=0;
  for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(joined));
}

export function createReader({url,key,household,fetcher=fetch}){
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key || !/^[0-9a-f-]{36}$/i.test(household))throw Error('Invalid server configuration');
  let remaining=256*1024;
  return async function(table,select,filters){
    const query=new URLSearchParams({select,household_id:'eq.'+household,limit:'201',...filters});
    const order={al_schedule:'kid_id.asc',al_settings:'household_id.asc'}[table]||'id.asc';query.set('order',order);
    const response=await fetcher(url+'/rest/v1/'+table+'?'+query,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'count=exact'}});
    if(!response.ok)throw Error('Database unavailable');
    const rows=await boundedJSON(response,Math.min(65536,remaining));
    remaining-=new TextEncoder().encode(JSON.stringify(rows)).length;
    const range=response.headers.get('Content-Range')||'';
    const total=range.split('/')[1];
    // Exact count prevents a server-side page cap from silently hiding rows.
    if(!Array.isArray(rows) || !/^\d+$/.test(total||'') || Number(total)!==rows.length || rows.length>200 || remaining<0)
      throw Error('Incomplete/oversized database result');
    return rows;
  };
}

export async function authorized(token,clients,cryptoApi=crypto){
  if(typeof token!=='string' || !/^[A-Za-z0-9_-]{43,128}$/.test(token))return false;
  const hash=Array.from(new Uint8Array(await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(token))))
    .map(b=>b.toString(16).padStart(2,'0')).join('');
  return clients.some(c=>c && typeof c.sha256==='string' && /^[a-f0-9]{64}$/.test(c.sha256) && c.sha256===hash &&
    typeof c.expiresAt==='string' && Number.isFinite(Date.parse(c.expiresAt)) && Date.parse(c.expiresAt)>Date.now());
}

export function createHandler(config){
  return async function(req){
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
    if(req.headers.has('Origin'))return json({error:'Browser access is not enabled'},403);
    let clients;
    try{clients=JSON.parse(config.clients||'null');if(!Array.isArray(clients)||!clients.length)throw Error();}
    catch{return json({error:'Inspection is not configured'},503);}
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
    if(!await authorized(token,clients))return json({error:'Unauthorized'},401);
    if(req.method!=='POST')return json({error:'Only POST is supported'},405);
    if(!(req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return json({error:'JSON required'},415);
    let message;
    try{message=await boundedJSON(req,4096);}catch{return json({error:'Invalid or oversized request'},400);}
    try{
      const read=createReader(config);
      const result=await dispatch(message,read);
      return result===null?new Response(null,{status:202,headers}):json(result);
    }catch{return json({error:'Inspection is unavailable'},503);}
  };
}
