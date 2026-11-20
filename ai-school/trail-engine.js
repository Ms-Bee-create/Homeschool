/* AI School trail engine (19 Nov 2026). Runs a trail described in window.AIS_TRAILS (see trails/town-server.js).
   Stop types: cards, teachback, form, restate, bugs, note. Everything the child sees is built with textContent (never innerHTML), so a reply can never run markup.
   The true facts and the good answers are NOT here: they live on the server (supabase/functions/_shared/partner.ts), and the partner is reached only through the aipartner function.
   Progress is kept on this device (localStorage aiSchool.trail.<account id>.<trail id>). It is also sent, best effort, to the tables al_ai_trail_progress and al_ai_notebook
   once Mom has approved and run supabase/ai_school.sql; until then those calls fail quietly and the page says "saved on this device". */
(function () {
"use strict";
var A = null, T = null, st = null, busy = false, remoteOk = null;
var FN_FAIL = "I can't reach my brain right now. Try again in a minute, or ask a grown-up.";
function $(id) { return document.getElementById(id); }
function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function words(s) { return String(s || "").trim().split(/\s+/).filter(Boolean).length; }
function btn(text, cls, fn) { var b = h("button", cls || "", text); b.type = "button"; if (fn) b.onclick = fn; return b; }
function keyOf() { return "aiSchool.trail." + A.uid() + "." + T.id; }
function fresh() { return { done: {}, v: {}, ready: false }; }
function load() { try { var v = JSON.parse(localStorage.getItem(keyOf()) || "null"); if (v && v.done && v.v) return v; } catch (e) {} return fresh(); }

/* ---- saving: device first, database best effort ---- */
/* One record PER SAVE: a slow answer from an older save can never change what the note says about a newer one. */
var cur = { device: false, progress: false, notebook: null };
function note() {
  var n = $("trailSaveNote"); if (!n) return;
  var db = cur.progress === true && cur.notebook === true; /* a request still pending is NOT saved yet */
  n.textContent = db ? "Saved to your notebook." : cur.device ? "Saved on this device." : "Could not save. Tell a grown-up.";
}
function remote(d, table, row, upsert, key) {
  function done(ok) { d[key] = ok; if (d === cur) note(); }
  try {
    var q = A.sb.from(table);
    var p = upsert ? q.upsert(row, { onConflict: "household_id,kid_id,trail_id" }) : q.insert(row);
    p.then(function (r) { done(!(r && r.error)); }, function () { done(false); });
  } catch (e) { done(false); }
}
function save(withNotebook) {
  var d = { device: false, progress: false, notebook: withNotebook ? null : true }; cur = d;
  try { localStorage.setItem(keyOf(), JSON.stringify(st)); d.device = true; } catch (e) { d.device = false; }
  remote(d, "al_ai_trail_progress", { household_id: A.uid(), kid_id: "kid2", trail_id: T.id, state: st, updated_at: new Date().toISOString() }, true, "progress");
  note(); return d;
}
function complete(stopId, entry) {
  st.done[stopId] = true; st.v[stopId] = entry;
  var d = save(true);
  remote(d, "al_ai_notebook", { household_id: A.uid(), kid_id: "kid2", trail_id: T.id, stop_id: stopId, entry: entry }, false, "notebook");
  render();
}

/* ---- the partner ---- */
function call(extra, msgs) {
  var pt = A.getPartner();
  var body = { kidId: "kid2", partner: { name: pt.name, feel: pt.feel }, messages: msgs.slice(-12), mode: extra.mode, trail: T.id };
  if (extra.restateWas) body.restateWas = extra.restateWas;
  if (extra.sig) body.sig = extra.sig;
  if (extra.ruleIndex != null) body.ruleIndex = extra.ruleIndex;
  return A.sb.functions.invoke("aipartner", { body: body }).then(function (res) {
    var r = res && res.data;
    if (!res || res.error || !r || typeof r.reply !== "string") return null;
    if (typeof r.remaining === "number") A.setLeft(r.remaining);
    A.speak(r.reply, pt);
    return r;
  }, function () { return null; });
}
function logMsg(log, kind, text, who) {
  var d = h("div", "msg " + kind);
  if (who) d.appendChild(h("small", "", who));
  d.appendChild(document.createTextNode(text));
  log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
}
function stopFrame(s, idx) {
  var c = h("div", "card");
  var top = h("div", "top"); top.appendChild(h("h2", "", "Stop " + (idx + 1) + " of " + T.stops.length + ": " + s.title));
  top.appendChild(h("span", "badge", "about " + s.minutes + " min")); c.appendChild(top);
  if (s.intro) c.appendChild(h("p", "", s.intro));
  return c;
}

/* ---- stop: cards ---- */
function rCards(s, c) {
  var i = 0, view = h("div", "tcard"), nav = h("div", "row");
  var back = btn("Back", "", function () { i--; draw(); }), next = btn("Next", "primary", function () { if (i < s.cards.length - 1) { i++; draw(); } else complete(s.id, { read: true }); });
  next.id = "cardNext"; back.id = "cardBack";
  function draw() {
    view.innerHTML = ""; var cd = s.cards[i];
    view.appendChild(h("h3", "", cd.title)); view.appendChild(h("p", "", cd.text));
    view.appendChild(h("p", "muted", "Card " + (i + 1) + " of " + s.cards.length));
    back.disabled = i === 0; next.textContent = i === s.cards.length - 1 ? "I've got it" : "Next";
  }
  nav.appendChild(back); nav.appendChild(next); c.appendChild(view); c.appendChild(nav); draw();
}

/* ---- stop: teach it back (a chat in teach-back mode) ---- */
function rTeach(s, c) {
  var pt = A.getPartner(), msgs = [], log = h("div", "tlog"), prog = h("p", "muted"), done = h("div");
  log.id = "tbLog"; prog.id = "tbProg"; log.setAttribute("role", "log"); log.setAttribute("aria-live", "polite");
  logMsg(log, "ai", s.opening, pt.name);
  var form = h("form", "row"), inp = h("input"), send = btn("Send", "primary"); send.type = "submit"; send.id = "tbSend";
  form.style.flexWrap = "nowrap"; form.autocomplete = "off"; inp.type = "text"; inp.id = "tbInput"; inp.maxLength = 500; inp.placeholder = "Explain it in your own words"; inp.style.flex = "1";
  inp.setAttribute("aria-label", "Your explanation"); form.appendChild(inp); form.appendChild(send);
  function counts() {
    var a = msgs.filter(function (m) { return m.role === "user" && words(m.content) >= 5; }).length;
    var q = msgs.filter(function (m) { return m.role === "assistant" && /\?/.test(m.content); }).length;
    return { a: a, q: q };
  }
  function meter() {
    var k = counts(); prog.textContent = "Your explanations: " + Math.min(k.a, s.need.answers) + " of " + s.need.answers + ". Questions " + pt.name + " asked: " + Math.min(k.q, s.need.questions) + " of " + s.need.questions + ".";
    if (k.a >= s.need.answers && k.q >= s.need.questions && !done.firstChild) writeup();
  }
  function writeup() {
    done.appendChild(h("p", "", s.writeup));
    var ta = h("textarea"); ta.id = "tbWrite"; ta.rows = 3; ta.maxLength = 400; ta.setAttribute("aria-label", "What you explained well");
    var err = h("div", "err"); err.setAttribute("role", "alert"); err.id = "tbErr";
    var go = btn("Done. Build it next", "primary", function () {
      if (words(ta.value) < 8) { err.textContent = "Say a little more, in your own words."; return; }
      complete(s.id, { said: ta.value.trim(), explained: counts().a });
    }); go.id = "tbDone";
    done.appendChild(ta); done.appendChild(err); done.appendChild(go);
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault(); var t = inp.value.trim(); if (!t || busy) return;
    inp.value = ""; busy = true; send.disabled = true; msgs.push({ role: "user", content: t }); logMsg(log, "me", t, "You");
    var w = logMsg(log, "sys", pt.name + " is thinking…");
    call({ mode: "teachback" }, msgs).then(function (r) {
      w.remove();
      if (!r) { msgs.pop(); logMsg(log, "sys", FN_FAIL); } else { msgs.push({ role: "assistant", content: r.reply }); logMsg(log, "ai", r.reply, pt.name); }
      busy = false; send.disabled = false; meter(); inp.focus();
    });
  });
  c.appendChild(log); c.appendChild(form); c.appendChild(prog); c.appendChild(done); meter();
}

/* ---- stop: build it (a form with checks) ---- */
function styleLabel(v) { var f = T.stops.filter(function (x) { return x.type === "form"; })[0], o = f.fields.filter(function (x) { return x.id === "style"; })[0]; var m = o.options.filter(function (x) { return x[0] === v.style; })[0]; return m ? m[0] : String(v.style); }
function summary(v) {
  var s = "My server is called " + v.name + ". The game is " + v.game + ". It holds 24 players in " + v.teams + " teams of " + v.size + ". Two servers hold " + v.two + " players and three servers hold " + v.three + ". My rules, written as " + styleLabel(v) + ":\n" + v.rules;
  return s.length > 780 ? s.slice(0, 780) : s;
}
function rForm(s, c) {
  var els = {}, bugWords = (T.stops.filter(function (x) { return x.type === "bugs"; })[0] || {}).words || [];
  var saved = (st.v[s.id] || {});
  s.fields.forEach(function (f) {
    var id = "f_" + f.id, lab = h("label", "", f.label); lab.setAttribute("for", id); var e;
    if (f.kind === "textarea") { e = h("textarea"); e.rows = 5; e.maxLength = 600; }
    else if (f.kind === "select") { e = h("select"); f.options.forEach(function (o) { var op = h("option", "", o[1]); op.value = o[0]; e.appendChild(op); }); }
    else { e = h("input"); e.type = f.kind === "number" ? "number" : "text"; e.maxLength = 60; if (f.kind === "number") { e.min = "0"; e.max = "999"; e.inputMode = "numeric"; } }
    e.id = id; if (saved[f.id] != null) e.value = saved[f.id]; els[f.id] = e; c.appendChild(lab); c.appendChild(e);
    if (f.id === "test") {
      var chips = h("div", "row"); chips.style.marginTop = "6px";
      bugWords.forEach(function (w) { chips.appendChild(btn(w, "chip", function () { e.value = (e.value ? e.value + " " : "") + w; e.focus(); })); });
      c.appendChild(chips);
    }
  });
  var err = h("div", "err"); err.id = "buildErr"; err.setAttribute("role", "alert");
  var go = btn("Check my design", "primary", function () {
    var v = {}, say = [];
    s.fields.forEach(function (f) { v[f.id] = els[f.id].value.trim(); if (f.required && !v[f.id]) say.push("Fill in: " + f.label.split("?")[0].split(".")[0]); });
    if (!say.length) s.checks.forEach(function (k) {
      if (k.type === "product" && !(Number(v[k.fields[0]]) * Number(v[k.fields[1]]) === k.equals && Number(v[k.fields[0]]) > 0 && Number(v[k.fields[1]]) > 0)) say.push(k.say);
      if (k.type === "equals" && Number(v[k.field]) !== k.value) say.push(k.say);
      if (k.type === "lines" && v[k.field].split(/\n/).filter(function (x) { return x.trim(); }).length < k.min) say.push(k.say);
      if (k.type === "words" && words(v[k.field]) < k.min) say.push(k.say);
    });
    err.textContent = ""; err.innerHTML = "";
    if (say.length) { say.forEach(function (x) { err.appendChild(h("div", "", x)); }); return; }
    complete(s.id, v);
  }); go.id = "buildGo";
  c.appendChild(err); c.appendChild(go);
}

/* ---- stop: let me get this straight (the partner restates the design, sometimes wrong, sometimes right) ---- */
function rRestate(s, c) {
  var design = summary(st.v.build || {}), pt = A.getPartner(), round = 0, was = null, results = [], prev = null;
  var body = h("div"); c.appendChild(body);
  function retry() { next(true); }
  function next(keep) {
    body.innerHTML = ""; if (keep !== true) { was = prev ? (prev === "wrong" ? "right" : "wrong") : (Math.random() < 0.5 ? "wrong" : "right"); prev = was; }
    body.appendChild(h("p", "muted", "Round " + (round + 1) + " of " + s.rounds));
    var line = h("div", "tlog"); line.id = "rsLog"; body.appendChild(line);
    var w = logMsg(line, "sys", pt.name + " is thinking…");
    call({ mode: "restate", restateWas: was }, [{ role: "user", content: design }]).then(function (r) {
      w.remove();
      if (!r) { logMsg(line, "sys", FN_FAIL); body.appendChild(btn("Try again", "", retry)); return; }
      logMsg(line, "ai", r.reply, pt.name);
      /* Only a restatement the server could read, that changed what it was asked to change, and was not held back, opens the answer controls. */
      if (r.usable !== true || typeof r.sig !== "string") { logMsg(line, "sys", "That one could not be used. Let's try the round again."); body.appendChild(btn("Try again", "", retry)); return; }
      answer(r.reply, line, r.sig);
    });
  }
  function answer(restated, line, sig) {
    var choice = null, bR = btn("That is right", "feel"), bW = btn("Something is wrong", "feel");
    bR.id = "rsRight"; bW.id = "rsWrong";
    function pick(x) { choice = x; bR.setAttribute("aria-pressed", x === "right"); bW.setAttribute("aria-pressed", x === "wrong"); }
    bR.onclick = function () { pick("right"); }; bW.onclick = function () { pick("wrong"); };
    var row = h("div", "row"); row.appendChild(bR); row.appendChild(bW);
    var ta = h("textarea"); ta.id = "rsWhy"; ta.rows = 3; ta.maxLength = 300; ta.placeholder = "Say why. If something is wrong, what is it?"; ta.setAttribute("aria-label", "Why");
    var err = h("div", "err"); err.id = "rsErr"; err.setAttribute("role", "alert");
    var go = btn("Tell " + pt.name, "primary", function () {
      if (!choice) { err.textContent = "Pick one first."; return; }
      if (words(ta.value) < 3) { err.textContent = "Say why, in a few words."; return; }
      if (busy) return; busy = true; go.disabled = true; err.textContent = "";
      var said = "I say it is " + choice + ". " + ta.value.trim();
      logMsg(line, "me", said, "You");
      call({ mode: "judge", sig: sig }, [{ role: "user", content: design }, { role: "assistant", content: restated }, { role: "user", content: said }]).then(function (r) {
        busy = false;
        if (!r) { go.disabled = false; err.textContent = FN_FAIL; return; }
        logMsg(line, "ai", r.reply, pt.name);
        if (r.verdict !== "GOOD" && r.verdict !== "MISSED") { go.disabled = false; err.textContent = "That one was not scored. Try again, or ask a grown-up."; return; } // held, over the limit or no grade: leave the round unscored
        results.push({ was: was, said: choice, verdict: r.verdict });
        var vd = h("p", "", r.verdict === "GOOD" ? "You checked it, and you caught it." : "Not this time. Checking what someone says back to you is a habit worth practicing."); vd.id = "rsVerdict";
        row.remove(); ta.remove(); go.remove(); err.remove();
        body.appendChild(vd); round++;
        if (round < s.rounds) { var nx = btn("Next round", "primary", function () { next(); }); nx.id = "rsNext"; body.appendChild(nx); }
        else { var fin = btn("Finish this stop", "primary", function () { complete(s.id, { rounds: results, caught: results.filter(function (x) { return x.verdict === "GOOD"; }).length }); }); fin.id = "rsFinish"; body.appendChild(fin); }
      });
    }); go.id = "rsGo";
    body.appendChild(row); body.appendChild(ta); body.appendChild(err); body.appendChild(go);
  }
  next();
}

/* ---- stop: fix the broken rules ---- */
function rBugs(s, c) {
  var good = s.rules.map(function () { return false; }), hist = s.rules.map(function () { return []; }), answers = s.rules.map(function () { return ""; });
  var fin = btn("Finish this stop", "primary", function () { complete(s.id, { fixed: good.filter(Boolean).length, good: good, answers: answers }); });
  fin.id = "bugFinish"; fin.disabled = true; var tally = h("p", "muted"); tally.id = "bugTally";
  function count() { var n = good.filter(Boolean).length; tally.textContent = "Fixed " + n + " of " + s.rules.length + ". You need " + s.needGood + " to move on."; fin.disabled = n < s.needGood; }
  s.rules.forEach(function (rule, i) {
    var box = h("div", "card"); box.style.margin = "10px 0"; box.appendChild(h("p", "", "Rule " + (i + 1) + ": " + rule));
    var ta = h("textarea"); ta.id = "bug" + i; ta.rows = 3; ta.maxLength = 400; ta.placeholder = "What is wrong? How would you fix it? How would you check your fix?"; ta.setAttribute("aria-label", "Your answer for rule " + (i + 1));
    var out = h("div", "tlog"); out.id = "bugOut" + i; var err = h("div", "err"); err.setAttribute("role", "alert");
    var go = btn("Check rule " + (i + 1), "primary", function () {
      if (busy || good[i]) return;
      if (words(ta.value) < 6) { err.textContent = "Say what is wrong, how you would fix it, and how you would check it."; return; }
      err.textContent = ""; busy = true; go.disabled = true;
      var msg = { role: "user", content: "Rule " + (i + 1) + ". My answer: " + ta.value.trim() };
      logMsg(out, "me", ta.value.trim(), "You"); var w = logMsg(out, "sys", A.getPartner().name + " is thinking…");
      call({ mode: "bugfix", ruleIndex: i }, hist[i].concat([msg])).then(function (r) {
        w.remove(); busy = false; go.disabled = false;
        if (!r) { err.textContent = FN_FAIL; return; }
        hist[i].push(msg); hist[i].push({ role: "assistant", content: r.reply }); logMsg(out, "ai", r.reply, A.getPartner().name);
        if (r.verdict === "GOOD") { good[i] = true; answers[i] = ta.value.trim(); ta.disabled = true; go.disabled = true; go.textContent = "Fixed"; box.setAttribute("data-fixed", "1"); count(); }
        else ta.value = "";
      });
    }); go.id = "bugGo" + i;
    box.appendChild(ta); box.appendChild(err); box.appendChild(go); box.appendChild(out); c.appendChild(box);
  });
  c.appendChild(tally); c.appendChild(fin); count();
}

/* ---- stop: show a grown-up ---- */
function rNote(s, c) {
  c.appendChild(h("p", "", s.prompt));
  var ta = h("textarea"); ta.id = "noteText"; ta.rows = 4; ta.maxLength = 500; ta.setAttribute("aria-label", "What you changed and how you checked");
  var lab = h("label", ""); lab.style.fontWeight = "400"; var cb = h("input"); cb.type = "checkbox"; cb.id = "noteSeen"; lab.appendChild(cb); lab.appendChild(document.createTextNode(" A grown-up looked at it with me"));
  var err = h("div", "err"); err.id = "noteErr"; err.setAttribute("role", "alert");
  var go = btn("Finish the mission", "primary", function () {
    if (words(ta.value) < s.minWords) { err.textContent = "Say a little more: what did you change, and how did you check it?"; return; }
    if (!cb.checked) { err.textContent = "Show a grown-up first, then tick the box."; return; }
    st.ready = true; complete(s.id, { note: ta.value.trim(), grownupSaw: true, ready: true });
  }); go.id = "noteGo";
  c.appendChild(ta); c.appendChild(lab); c.appendChild(err); c.appendChild(go);
}

var TYPES = { cards: rCards, teachback: rTeach, form: rForm, restate: rRestate, bugs: rBugs, note: rNote };

/* ---- the screen ---- */
function render() {
  var root = $("trailBox"); root.innerHTML = ""; busy = false;
  var top = h("div", "top"); top.appendChild(h("span", "badge", "TRAIL"));
  var bk = btn("Back to home", "link", function () { A.goHome(); }); bk.id = "trailHome"; top.appendChild(bk); root.appendChild(top);
  root.appendChild(h("h1", "", T.title)); root.style.marginTop = "14px";
  var ol = h("ol", "stoplist"); ol.id = "stopList";
  var cur = -1; T.stops.forEach(function (s, i) { if (cur < 0 && !st.done[s.id]) cur = i; });
  T.stops.forEach(function (s, i) { var li = h("li", "", (st.done[s.id] ? "✓ " : "") + s.title); if (i === cur) { li.setAttribute("aria-current", "step"); li.style.fontWeight = "700"; } ol.appendChild(li); });
  root.appendChild(ol);
  if (cur < 0) {
    var c = h("div", "card"); c.id = "trailDone"; c.appendChild(h("h2", "", "Mission complete"));
    var rs = st.v.restate || {}, bg = st.v.bugs || {};
    c.appendChild(h("p", "", "You designed a server, taught it back, caught " + (rs.caught || 0) + " of " + ((rs.rounds || []).length) + " restatements, and fixed " + (bg.fixed || 0) + " broken rules."));
    c.appendChild(h("p", "", st.ready ? "This is marked ready for Mom to look at." : ""));
    c.appendChild(btn("Back to home", "primary", function () { A.goHome(); })); root.appendChild(c);
  } else {
    var s = T.stops[cur], f = stopFrame(s, cur); root.appendChild(f); TYPES[s.type](s, f);
  }
  var sn = h("p", "muted"); sn.id = "trailSaveNote"; root.appendChild(sn); note();
  A.show("trail");
}
function open(id) { T = window.AIS_TRAILS && window.AIS_TRAILS[id]; if (!T) return false; st = load(); render(); return true; }
function status(id) {
  var t = window.AIS_TRAILS && window.AIS_TRAILS[id]; if (!t) return null;
  var prev = T; T = t; var s = load(); T = prev;
  var n = t.stops.filter(function (x) { return s.done[x.id]; }).length; return { title: t.title, hook: t.hook, minutes: t.minutes, done: n, total: t.stops.length };
}
window.AIS_ENGINE = { init: function (api) { A = api; }, open: open, status: status };
})();
