/* Read-only diagnostics. No network requests, storage writes, or automatic exports. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.ForgeInspection = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  function copy(value){ return value == null ? null : JSON.parse(JSON.stringify(value)); }
  function dateRange(start, count){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(count) || count<1 || count>21) throw Error('Choose 1–21 days');
    var d = new Date(start+'T12:00:00Z');
    if(!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==start) throw Error('Invalid date');
    var out=[];
    for(var i=0;i<count;i++){ out.push(d.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate()+1); }
    return out;
  }
  function lesson(a, blockKeyFor){
    return {id:a.id, kidId:a.kidId, date:a.date, title:a.title||'', subject:a.subject||'',
      stage:a.stage||null, standard:a.standard||null, skillId:a.skillId||null,
      block:blockKeyFor(a), done:!!a.done, submittedAt:a.submittedAt||null, reviewStatus:a.reviewStatus||null};
  }
  function snapshot(env, start, count){
    var dates=dateRange(start,count), goal=env.familyGoal();
    return {format:'forge-schedule-inspection-v1', capturedAt:new Date().toISOString(),
      build:env.build, householdId:env.householdId, source:'current-browser-memory',
      freshness:'This is the current tab. It may contain unsynced or cached data; compare with a direct database read.',
      daysOff:copy(env.daysOffList()), project:copy(goal.rp),
      limitations:['Home Quest must be read from Momma Money/the database separately.',
        'Clock plan and subject/block order are distinct in the existing app.',
        'A project pick may change dates; listed assignments are what assignmentsFor currently returns.'],
      kids:env.kids.map(function(k){
        return {id:k.id, name:env.kidData(k.id).name||k.defaultName,
          clockPlan:copy(env.getDayPlan(k.id)), blocks:copy(env.orderedBlocksFor(k.id)),
          weeklySchedule:copy(env.schedules[k.id]||null),
          days:dates.map(function(day){
            return {date:day, off:env.isOffDate(new Date(day+'T12:00:00')),
              lessons:env.assignmentsFor(k.id,day).map(function(a){return lesson(a,env.blockKeyFor);})};
          })};
      })};
  }
  function recoveryKey(key){
    // Authentication and parent unlocking are deliberately outside the recovery payload.
    return /^al_/.test(key) && !/(?:auth|token|secret|password|credential|leader.*pin|pin.*hash|unlocked)/i.test(key);
  }
  async function deviceBackup(storage, metadata, cryptoApi){
    var entries=[];
    for(var i=0;i<storage.length;i++){
      var key=storage.key(i);
      if(key && recoveryKey(key)) entries.push({key:key,value:storage.getItem(key)});
    }
    entries.sort(function(a,b){return a.key.localeCompare(b.key);});
    if(entries.some(function(e){return typeof e.value!=='string';})) throw Error('Device storage changed; try again after closing other app tabs');
    var payload=JSON.stringify(entries), bytes=new TextEncoder().encode(payload);
    var hash=await cryptoApi.subtle.digest('SHA-256',bytes);
    return {format:'forge-device-recovery-v1', capturedAt:new Date().toISOString(),
      origin:metadata.origin, build:metadata.build, householdId:metadata.householdId,
      sha256:Array.from(new Uint8Array(hash)).map(function(b){return b.toString(16).padStart(2,'0');}).join(''),
      entries:entries, limits:['Private local-storage copy only; not a cloud backup or a transactional snapshot.',
        'May include records from other household logins on this browser. Keep the file private.',
        'No login tokens, session storage, or parent PIN; no automatic restore.']};
  }
  return {snapshot:snapshot, deviceBackup:deviceBackup, recoveryKey:recoveryKey, dateRange:dateRange};
});
