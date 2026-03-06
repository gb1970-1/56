(() => {
  "use strict";

  // -------------------------
  // Crash safety (never blank screen)
  // -------------------------
  const toastEl = () => document.getElementById("toast");
  function toast(msg){
    const t = toastEl();
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> t.classList.remove("show"), 1400);
  }

  window.addEventListener("error", (e) => {
    console.error("App error:", e.error || e.message);
    toast("Something went wrong (recovered)");
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled rejection:", e.reason);
    toast("Something went wrong (recovered)");
  });

  // -------------------------
  // Helpers
  // -------------------------
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);

  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

  // Haptics
  // - On web/Android: Vibration API when available
  // - On iOS Safari: Vibration is not supported (no true haptics)
  // - If wrapped (Capacitor): use native Haptics plugin for real iOS haptics
  async function haptic(style="light"){
    try{
      const cap = window.Capacitor;
      const H = cap?.Plugins?.Haptics;
      if (H){
        // https://capacitorjs.com/docs/apis/haptics
        if (style === "success") return await H.notification({ type: "SUCCESS" });
        if (style === "warning") return await H.notification({ type: "WARNING" });
        if (style === "error") return await H.notification({ type: "ERROR" });
        const map = { light:"LIGHT", medium:"MEDIUM", heavy:"HEAVY" };
        return await H.impact({ style: map[style] || "LIGHT" });
      }
    }catch(_){ /* fall through */ }

    // Web fallback
    try{
      if (navigator.vibrate){
        if (style === "success") return navigator.vibrate([18, 60, 18]);
        if (style === "heavy") return navigator.vibrate(28);
        return navigator.vibrate(12);
      }
    }catch(_){ /* ignore */ }
  }

  function cleanUrl(){
    return location.origin + location.pathname;
  }

  function goHomeHard(){
    const u = cleanUrl();
    try{ history.replaceState({}, "", u); }catch(_){ /* ignore */ }
    // Real hard reset: guarantees no SPA edge cases on GH Pages
    location.href = u;
  }

  function animateChipRow(el){
    if (!el) return;
    const chips = Array.from(el.querySelectorAll('.chip'));
    if (!chips.length) return;
    chips.forEach((c, i) => {
      c.classList.remove('pop');
      // Staggered micro-appear
      setTimeout(() => c.classList.add('pop'), 40 + i * 55);
    });
  }

  function show(id){
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const el = $(id);
    if (el) el.classList.add("active");
  }

  function todayKey(){
    return new Date().toISOString().slice(0,10);
  }

  function isoWeekKey(d=new Date()){
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
  }

  // -------------------------
  // Traits
  // -------------------------
  const TRAITS = [
    { key:"chaotic", label:"chaotic", emoji:"💀" },
    { key:"overthinker", label:"overthinker", emoji:"🧠" },
    { key:"unavailable", label:"emotionally unavailable", emoji:"💔" },
    { key:"mysterious", label:"mysterious", emoji:"👀" },
    { key:"mainchar", label:"main character", emoji:"✨" },
    { key:"awkward", label:"awkward", emoji:"😅" },
    { key:"lowkey", label:"low-key judging", emoji:"🧊" },
    { key:"soft", label:"secretly kind", emoji:"🤍" },
    { key:"rizz", label:"rizz", emoji:"😮‍💨" },
    { key:"dramatic", label:"dramatic", emoji:"🔥" },
  ];

  // encode/decode 3 picks as base36 indices
  const idxToChar = (i) => i.toString(36);
  const charToIdx = (c) => {
    const i = parseInt(c, 36);
    return Number.isFinite(i) ? i : -1;
  };

  function encodePick(idxs){
    const uniq = [...new Set(idxs)].filter(i => i>=0 && i<TRAITS.length);
    if (uniq.length !== 3) return "";
    return uniq.map(idxToChar).join("");
  }

  function decodePick(s){
    if (!s || typeof s !== "string") return null;
    s = s.trim().toLowerCase();
    if (s.length !== 3) return null;
    const idxs = [...s].map(charToIdx);
    if (idxs.some(i => i<0 || i>=TRAITS.length)) return null;
    if (new Set(idxs).size !== 3) return null;
    return idxs;
  }

  function chipForIdx(i, pct=null){
    const t = TRAITS[i];
    const pctSpan = (pct==null) ? "" : `<span class="pct">${pct}%</span>`;
    return `<span class="chip"><span>${t.emoji}</span>${pctSpan}<span>${t.label}</span></span>`;
  }

  function chipForTraitKey(key, pct=null){
    const t = TRAITS.find(x => x.key === key) || {emoji:"✨", label:key};
    const pctSpan = (pct==null) ? "" : `<span class="pct">${pct}%</span>`;
    return `<span class="chip"><span>${t.emoji}</span>${pctSpan}<span>${t.label}</span></span>`;
  }

  // -------------------------
  // Storage keys
  // -------------------------
  const LS_SELF = "gmv_v22_self";
  const LS_TRAIT_COUNTS = "gmv_v22_traitCounts";
  const LS_STREAK = "gmv_v22_streak";

  function getSelfPick(){
    return decodePick(localStorage.getItem(LS_SELF) || "");
  }
  function setSelfPick(idxs){
    localStorage.setItem(LS_SELF, encodePick(idxs));
  }

  function getTraitCounts(){
    try{ return JSON.parse(localStorage.getItem(LS_TRAIT_COUNTS) || "{}"); }
    catch(_){ return {}; }
  }
  function setTraitCounts(obj){
    localStorage.setItem(LS_TRAIT_COUNTS, JSON.stringify(obj||{}));
  }
  function addTraitsToCounts(idxs){
    const counts = getTraitCounts();
    for (const i of (idxs||[])){
      const key = TRAITS[i]?.key;
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    setTraitCounts(counts);
  }
  function topTraitPercents(n=3){
    const counts = getTraitCounts();
    const total = Object.values(counts).reduce((a,b)=>a+b,0) || 0;
    const arr = Object.entries(counts).map(([k,v]) => ({
      key:k,
      count:v,
      pct: total ? Math.round((v/total)*100) : 0
    }));
    arr.sort((a,b)=> (b.count-a.count) || (b.pct-a.pct));
    return { total, top: arr.slice(0,n) };
  }

  function updateStreak(){
    const today = todayKey();
    let s;
    try{ s = JSON.parse(localStorage.getItem(LS_STREAK) || '{"count":0,"last":""}'); }
    catch(_){ s = {count:0,last:""}; }
    if (s.last !== today){
      const y = new Date(); y.setDate(y.getDate()-1);
      const yKey = y.toISOString().slice(0,10);
      s.count = (s.last === yKey) ? (s.count + 1) : 1;
      s.last = today;
      localStorage.setItem(LS_STREAK, JSON.stringify(s));
    }
    return s;
  }

  // Weekly focus
  const FOCUS_KEYS = ["mysterious","chaotic","dramatic","soft","overthinker","mainchar","rizz","awkward","lowkey","unavailable"];
  function currentFocusKey(){
    const wk = isoWeekKey();
    const n = parseInt(wk.slice(-2),10);
    const idx = Number.isFinite(n) ? (n % FOCUS_KEYS.length) : 0;
    return FOCUS_KEYS[idx];
  }

  // Icebreakers + Convo
  const ICEBREAKERS = [
    "Ok real question: what song is your vibe right now?",
    "Be honest: are you more chaotic or calm today?",
    "What’s one thing that instantly makes your day better?",
    "What’s your current obsession?",
    "What’s the most ‘you’ emoji?",
    "If we had 30 minutes free, what would we do?",
    "What movie character do you relate to?",
    "What’s your go-to comfort food?"
  ];

  function dailyIcebreaker(){
    const day = Math.floor(Date.now() / 86400000);
    return ICEBREAKERS[day % ICEBREAKERS.length];
  }

  const CONVO_PROMPTS = ICEBREAKERS.slice();
  function pick3Convo(){
    const pool = CONVO_PROMPTS.slice();
    for (let i=pool.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [pool[i],pool[j]] = [pool[j],pool[i]];
    }
    return pool.slice(0,3);
  }

  // Match logic (simple + stable)
  function matchPct(selfIdxs, guessIdxs){
    const a = new Set(selfIdxs);
    const overlap = guessIdxs.filter(i => a.has(i)).length; // 0..3
    const base = overlap === 3 ? 92 : overlap === 2 ? 74 : overlap === 1 ? 48 : 22;

    const d = new Date();
    const wobble = ((d.getDay()*7 + d.getDate()) % 7) - 3; // -3..+3
    const pct = clamp(base + wobble, 0, 100);

    const line1 =
      pct >= 85 ? "They almost got you." :
      pct >= 65 ? "Pretty close." :
      pct >= 40 ? "Not quite." :
      "Way off.";

    const line2 =
      pct >= 85 ? "Do you see me the same?" :
      pct >= 65 ? "What would you pick for me?" :
      "Who thinks they know you best?";

    return { pct, line1, line2 };
  }

  // Share helpers
  function isAbortError(err){
    const name = String(err?.name || "");
    const msg = String(err?.message || "");
    if (name === "AbortError") return true;
    if (name === "NotAllowedError" && /cancel|dismiss|abort/i.test(msg)) return true;
    return false;
  }

  async function tryNativeShare(payload){
    if (!navigator.share) return { ok:false, cancelled:false, reason:"no-share" };
    try{
      await navigator.share(payload);
      return { ok:true, cancelled:false };
    }catch(err){
      if (isAbortError(err)) return { ok:false, cancelled:true, reason:"cancel" };
      return { ok:false, cancelled:false, reason:String(err?.name || err) };
    }
  }

  async function copy(text){
    try{
      await navigator.clipboard.writeText(text);
      toast("Copied");
      return true;
    }catch(_){
      toast("Copy failed");
      return false;
    }
  }

  function buildChallengeLink(ownerPickIdxs){
    const u = new URL(location.href);
    u.search = "";
    u.searchParams.set("v", encodePick(ownerPickIdxs));
    u.searchParams.set("c", currentFocusKey() + "-" + isoWeekKey());
    return u.toString();
  }

  function buildReturnLink(ownerPickIdxs, guessIdxs){
    const u = new URL(location.href);
    u.search = "";
    u.searchParams.set("v", encodePick(ownerPickIdxs));
    u.searchParams.set("g", encodePick(guessIdxs));
    return u.toString();
  }

  function buildPingLink(ownerPickIdxs=null){
    const u = new URL(location.href);
    u.search = "";
    u.searchParams.set("ping", "1");
    if (ownerPickIdxs && ownerPickIdxs.length===3){
      u.searchParams.set("v", encodePick(ownerPickIdxs));
      u.searchParams.set("c", currentFocusKey() + "-" + isoWeekKey());
    }
    return u.toString();
  }

  async function shareLink({title, text, url}){
    const res = await tryNativeShare({title, text, url});
    if (res.ok) return true;
    if (res.cancelled) return false;
    return await copy(url);
  }

  async function shareOrCopyText(text){
    const res = await tryNativeShare({ text });
    if (res.ok){
      toast("Shared");
      return true;
    }
    await copy(text);
    return false;
  }

  // Story card generator
  async function createStoryCardBlob(data){
    const W=1080, H=1920;
    const c = document.createElement("canvas");
    c.width=W; c.height=H;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#0B0B0C";
    ctx.fillRect(0,0,W,H);

    const aura = ctx.createRadialGradient(W/2, H*0.22, 0, W/2, H*0.22, 860);
    aura.addColorStop(0, "rgba(255,255,255,0.10)");
    aura.addColorStop(0.55, "rgba(255,255,255,0.04)");
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aura;
    ctx.fillRect(0,0,W,H);

    const vig = ctx.createRadialGradient(W/2, H/2, 620, W/2, H/2, 1400);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.50)");
    ctx.fillStyle = vig;
    ctx.fillRect(0,0,W,H);

    ctx.fillStyle = "rgba(242,242,243,0.92)";
    ctx.font = "700 56px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText("👀 Guess my vibe", 92, 170);

    ctx.fillStyle = "rgba(242,242,243,0.96)";
    ctx.font = "820 170px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText(`${data.pct}%`, 92, 410);

    ctx.fillStyle = "rgba(242,242,243,0.68)";
    ctx.font = "650 54px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText(data.line1 || "They almost got you.", 92, 490);

    function roundRect(x,y,w,h,r){
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.arcTo(x+w, y, x+w, y+h, r);
      ctx.arcTo(x+w, y+h, x, y+h, r);
      ctx.arcTo(x, y+h, x, y, r);
      ctx.arcTo(x, y, x+w, y, r);
      ctx.closePath();
    }
    function pill(x,y,text){
      const padX=28, h=94, r=44;
      ctx.font = "760 54px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";
      const w = Math.min(ctx.measureText(text).width + padX*2, W-184);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      roundRect(x,y,w,h,r);
      ctx.fill();
      ctx.fillStyle = "rgba(242,242,243,0.96)";
      ctx.fillText(text, x+padX, y+64);
      return y + 120;
    }

    let y=620;
    ctx.fillStyle = "rgba(242,242,243,0.74)";
    ctx.font = "720 44px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText("THEY THINK I’M", 92, y);
    y += 46;

    for (const t of (data.top||[])){
      const label = `${t.emoji}  ${t.pct}%  ${t.label}`;
      y = pill(92, y+18, label);
    }

    y += 20;
    ctx.fillStyle = "rgba(242,242,243,0.74)";
    ctx.font = "720 44px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText("I THINK I’M", 92, y);
    y += 46;

    for (const t of (data.self||[])){
      const label = `${t.emoji}  ${t.label}`;
      y = pill(92, y+18, label);
    }

    ctx.fillStyle = "rgba(242,242,243,0.55)";
    ctx.font = "650 44px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";
    const n = Number(data.totalGuesses || 0);
    const who = n === 1 ? "person" : "people";
    ctx.fillText(`${n} ${who} guessed my vibe`, 92, H-220);

    ctx.fillStyle = "rgba(242,242,243,0.88)";
    ctx.font = "780 54px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText("Do you agree? 👀", 92, H-150);

    ctx.fillStyle = "rgba(242,242,243,0.55)";
    ctx.font = "650 40px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText("Screenshot this → send to a friend", 92, H-96);

    ctx.globalAlpha = 0.06;
    for (let i=0;i<2600;i++){
      const x = Math.random()*W, yy = Math.random()*H;
      ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
      ctx.fillRect(x, yy, 1, 1);
    }
    ctx.globalAlpha = 1;

    return await new Promise((resolve) => {
      c.toBlob((blob)=> resolve(blob), "image/png", 0.92);
    });
  }

  // UI: trait grid
  function renderTraitGrid(container, state){
    container.innerHTML = "";
    for (let i=0;i<TRAITS.length;i++){
      const t = TRAITS[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "traitBtn";
      btn.dataset.idx = String(i);
      btn.innerHTML = `
        <div class="traitTop">TRAIT</div>
        <div class="traitMain"><span class="traitEmoji">${t.emoji}</span><span>${t.label}</span></div>
      `;
      btn.addEventListener("click", () => {
        vibrate(12);
        const pos = state.selected.indexOf(i);
        if (pos >= 0){
          state.selected.splice(pos,1);
        } else {
          if (state.selected.length >= 3) return;
          state.selected.push(i);
        }
        updateTraitGrid(container, state);
        state.onChange?.();
      });
      container.appendChild(btn);
    }
    updateTraitGrid(container, state);
  }

  function updateTraitGrid(container, state){
    container.querySelectorAll(".traitBtn").forEach(btn => {
      const idx = parseInt(btn.dataset.idx,10);
      btn.classList.toggle("on", state.selected.includes(idx));
    });
    state.countEl.textContent = `${state.selected.length}/3`;
    state.submitBtn.disabled = state.selected.length !== 3;
  }

  // Sheets
  function openSheet(backdrop, sheet){
    backdrop.classList.add("show");
    sheet.classList.add("show");
    backdrop.setAttribute("aria-hidden","false");
    sheet.setAttribute("aria-hidden","false");
  }
  function closeSheet(backdrop, sheet){
    backdrop.classList.remove("show");
    sheet.classList.remove("show");
    backdrop.setAttribute("aria-hidden","true");
    sheet.setAttribute("aria-hidden","true");
  }

  // App state
  const state = {
    ownerPick: decodePick(qs.get("v")),
    guessPick: decodePick(qs.get("g")),
    ping: qs.get("ping") ? true : false,
    lastResult: null,
    story: { blob:null, file:null, url:null }
  };

  // Routing
  function route(){
    if (state.ping){ routeToPing(); return; }
    if (state.ownerPick && !state.guessPick){ routeToGuessIntro(); return; }
    if (state.ownerPick && state.guessPick){ routeToHold(); return; }
    routeToHome();
  }

  function routeToHome(){
    const self = getSelfPick();
    renderHome(self);
    if (!self){ show("scrSetup"); return; }
    show("scrHome");
  }
  function routeToPing(){ show("scrPing"); }
  function routeToGuessIntro(){ show("scrGuessIntro"); }
  function routeToHold(){ show("scrHold"); }

  // Render home
  function renderHome(selfIdxs){
    const st = updateStreak();
    const pillStreak = $("pillStreak");
    if (pillStreak) pillStreak.textContent = `🔥 ${st.count} day streak`;

    const wk = currentFocusKey();
    const t = TRAITS.find(x => x.key === wk);
    const pillWeek = $("pillWeek");
    pillWeek && (pillWeek.textContent = `This week: ${t ? `${t.emoji} ${t.label}` : wk}`);

    const el = $("homeTraits");
    if (el){
      if (!selfIdxs){
        el.innerHTML = `<span class="chip"><span>✨</span><span>no traits yet</span></span>`;
      } else {
        el.innerHTML = selfIdxs.map(i => chipForIdx(i)).join("");
      }
    }

    const q = dailyIcebreaker();
    const iceQ = $("iceQ");
    iceQ && (iceQ.textContent = q);

    const rep = $("weeklyBody");
    if (rep){
      const { total, top } = topTraitPercents(3);
      if (!total){
        rep.textContent = "No data yet. Get a few friends to guess you.";
      } else {
        const lines = top.map(x => {
          const tt = TRAITS.find(z => z.key === x.key) || {emoji:"✨", label:x.key};
          return `${tt.emoji} ${tt.label} — ${x.pct}%`;
        });
        rep.innerHTML = `${total} guesses so far<br>${lines.join("<br>")}`;
      }
    }
  }

  function picksToPercentsFallback(idxs){
    const p = [34,33,33];
    return (idxs||[]).slice(0,3).map((i,ix)=>({
      key: TRAITS[i]?.key || `t${i}`,
      pct: p[ix] || 33
    }));
  }

  function renderResult(){
    const r = state.lastResult;
    if (!r) return;

    const resPct = $("resPct");
    if (resPct){
      resPct.textContent = "0%";
      const start = performance.now();
      const dur = 720;
      const from = 0;
      const target = r.pct;
      const tick = (now) => {
        const t = clamp((now-start)/dur, 0, 1);
        const e = 1 - Math.pow(1-t, 3);
        const v = Math.round(from + (target-from)*e);
        resPct.textContent = `${v}%`;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    $("resLine1") && ($("resLine1").textContent = r.line1);
    $("resLine2") && ($("resLine2").textContent = r.line2);

    const { total, top } = topTraitPercents(3);
    const topChips = $("resTopChips");
    if (topChips){
      topChips.innerHTML = (top.length ? top : picksToPercentsFallback(r.guessIdxs)).map(x => chipForTraitKey(x.key, x.pct)).join("");
      animateChipRow(topChips);
    }

    const selfChips = $("resSelfChips");
    if (selfChips){
      selfChips.innerHTML = r.selfIdxs.map(i => chipForIdx(i)).join("");
      animateChipRow(selfChips);
    }

    r.totalGuesses = total;
  }

  // Hold-to-reveal
  function initHold(){
    const holdBtn = $("holdBtn");
    const prog = document.querySelector(".ringProg");
    const hint = $("holdHint");
    if (!holdBtn || !prog) return;

    const CIRC = 2 * Math.PI * 46;
    prog.style.strokeDasharray = String(CIRC);
    prog.style.strokeDashoffset = String(CIRC);

    let downAt = 0, raf = 0, timer = 0;
    const HOLD_MS = 800;

    function setProgress(p){
      const off = CIRC * (1 - clamp(p,0,1));
      prog.style.strokeDashoffset = String(off);
    }
    function reset(){
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      raf=0; timer=0;
      setProgress(0);
      if (hint) hint.textContent = "keep holding…";
    }
    function animate(){
      const t = performance.now() - downAt;
      const p = clamp(t / HOLD_MS, 0, 1);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(animate);
    }
    function complete(){
      reset();
      haptic("success");

      const selfIdxs = state.ownerPick;
      const guessIdxs = state.guessPick;
      if (!selfIdxs || !guessIdxs){
        toast("Missing data");
        goHomeHard();
        return;
      }

      const r = matchPct(selfIdxs, guessIdxs);
      addTraitsToCounts(guessIdxs);

      state.lastResult = {
        pct: r.pct,
        line1: r.line1,
        line2: r.line2,
        selfIdxs,
        guessIdxs,
        totalGuesses: topTraitPercents(1).total
      };

      // Better reveal: quick fade/scale out then show result
      const holdCard = document.querySelector('#scrHold .card');
      if (holdCard) holdCard.classList.add('revealOut');
      setTimeout(() => {
        if (holdCard) holdCard.classList.remove('revealOut');
        renderResult();
        show("scrResult");
      }, 220);
    }
    function start(){
      haptic("light");
      downAt = performance.now();
      if (hint) hint.textContent = "release to cancel";
      raf = requestAnimationFrame(animate);
      timer = setTimeout(complete, HOLD_MS);
    }
    function end(){
      if (!timer) return;
      reset();
    }

    holdBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); start(); }, { passive:false });
    holdBtn.addEventListener("pointerup", end);
    holdBtn.addEventListener("pointercancel", end);
    holdBtn.addEventListener("touchstart", (e)=>{ e.preventDefault(); start(); }, { passive:false });
    holdBtn.addEventListener("touchend", end);
    holdBtn.addEventListener("touchcancel", end);
  }

  // Setup/Guess
  function initSetup(){
    const grid = $("setupGrid");
    const countEl = $("setupCount");
    const btn = $("btnSaveSelf");
    if (!grid || !countEl || !btn) return;

    const st = { selected: [], countEl, submitBtn: btn, onChange: null };
    renderTraitGrid(grid, st);

    btn.addEventListener("click", () => {
      if (st.selected.length !== 3) return;
      setSelfPick(st.selected);
      toast("Saved");
      routeToHome();
    });

    $("btnSetupToHome")?.addEventListener("click", () => goHomeHard());
  }

  function initGuess(){
    const grid = $("guessGrid");
    const countEl = $("guessCount");
    const btn = $("btnSendGuess");
    if (!grid || !countEl || !btn) return;

    const st = { selected: [], countEl, submitBtn: btn, onChange: null };
    renderTraitGrid(grid, st);

    btn.addEventListener("click", async () => {
      if (!state.ownerPick){ toast("Missing owner"); goHomeHard(); return; }
      if (st.selected.length !== 3) return;

      const returnLink = buildReturnLink(state.ownerPick, st.selected);
      const ok = await shareLink({
        title: "Guess my vibe",
        text: "I guessed your vibe. Think I’m right?",
        url: returnLink
      });

      if (ok) show("scrGuessSent");
      else toast("Share cancelled");
    });

    $("btnGuessBack")?.addEventListener("click", () => show("scrGuessIntro"));
  }

  // Convo
  function openConvo(){
    const lines = pick3Convo();
    $("convo1") && ($("convo1").textContent = lines[0]);
    $("convo2") && ($("convo2").textContent = lines[1]);
    $("convo3") && ($("convo3").textContent = lines[2]);
    show("scrConvo");
  }

  function initConvo(){
    for (const id of ["convo1","convo2","convo3"]){
      const el = $(id);
      if (!el) continue;
      el.addEventListener("click", async () => {
        const txt = el.textContent || "";
        await shareOrCopyText(txt);
      });
    }
    $("btnConvoBack")?.addEventListener("click", () => {
      if (state.ownerPick && state.guessPick) show("scrResult");
      else if (state.ownerPick && !state.guessPick) show("scrGuessSent");
      else routeToHome();
    });
  }

  // More sheet
  function initMoreSheet(){
    const bd = $("sheetBackdrop");
    const sh = $("sheet");
    const open = () => openSheet(bd, sh);
    const close = () => closeSheet(bd, sh);

    $("btnMore")?.addEventListener("click", open);
    $("btnResMore")?.addEventListener("click", open);

    bd?.addEventListener("click", close);
    $("sheetClose")?.addEventListener("click", close);

    $("sheetHome")?.addEventListener("click", () => { close(); goHomeHard(); });
    $("sheetConvo")?.addEventListener("click", () => { close(); openConvo(); });

    $("sheetPing")?.addEventListener("click", async () => {
      close();
      const self = getSelfPick();
      const url = buildPingLink(self || state.ownerPick || null);
      await shareLink({ title:"Ping 👀", text:"I sent you something 👀", url });
    });

    $("sheetShareText")?.addEventListener("click", async () => {
      close();
      if (state.lastResult){
        const r = state.lastResult;
        const tTop = topTraitPercents(3).top;
        const lines = (tTop.length ? tTop : picksToPercentsFallback(r.guessIdxs))
          .slice(0,3)
          .map(x => {
            const tt = TRAITS.find(z=>z.key===x.key) || {emoji:"✨", label:x.key};
            return `${tt.emoji} ${x.pct}% ${tt.label}`;
          })
          .join("\n");

        const txt = `They think I'm:\n${lines}\n\nGuess my vibe 👀`;
        await shareOrCopyText(txt);
      } else {
        const self = getSelfPick();
        if (!self){ toast("Set your vibe first"); show("scrSetup"); return; }
        const url = buildChallengeLink(self);
        await shareLink({
          title:"Guess my vibe",
          text:"Can you guess my vibe? 👀\nPick 3 traits that describe me.\n\nHold to reveal your score.",
          url
        });
      }
    });
  }

  // Story sheet
  function initStorySheet(){
    const bd = $("storyBackdrop");
    const sh = $("storySheet");
    const preview = $("storyPreview");

    const close = () => {
      closeSheet(bd, sh);
      if (state.story.url){
        try{ URL.revokeObjectURL(state.story.url); }catch(_){}
      }
      state.story.blob = null;
      state.story.file = null;
      state.story.url = null;
      if (preview) preview.removeAttribute("src");
    };

    bd?.addEventListener("click", close);
    $("btnStoryClose")?.addEventListener("click", close);

    $("btnStoryDownload")?.addEventListener("click", () => {
      if (!state.story.blob){ toast("Not ready"); return; }
      const a = document.createElement("a");
      const url = state.story.url || URL.createObjectURL(state.story.blob);
      a.href = url;
      a.download = "guess-my-vibe.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("Downloaded");
    });

    $("btnStoryShare")?.addEventListener("click", async () => {
      if (!state.story.file){
        toast("Not ready");
        return;
      }
      const res = await tryNativeShare({ files:[state.story.file], title:"Guess my vibe" });
      if (res.ok) toast("Shared");
      else if (!res.cancelled) toast("Share not available — download");
    });
  }

  async function openStorySheet(){
    if (!state.lastResult){
      toast("No result yet");
      return;
    }
    const bd = $("storyBackdrop");
    const sh = $("storySheet");
    const preview = $("storyPreview");

    openSheet(bd, sh);

    try{
      const r = state.lastResult;
      const self = r.selfIdxs.map(i => ({emoji:TRAITS[i].emoji, label:TRAITS[i].label}));
      const { total, top } = topTraitPercents(3);
      const topList = (top.length ? top : picksToPercentsFallback(r.guessIdxs)).slice(0,3).map(x => {
        const tt = TRAITS.find(z=>z.key===x.key) || {emoji:"✨", label:x.key};
        return { emoji: tt.emoji, label: tt.label, pct: x.pct };
      });

      const blob = await createStoryCardBlob({
        pct: r.pct,
        line1: r.line1,
        top: topList,
        self,
        totalGuesses: total
      });

      if (!blob){ toast("Story render failed"); return; }

      state.story.blob = blob;
      state.story.file = new File([blob], "guess-my-vibe.png", { type:"image/png" });
      state.story.url = URL.createObjectURL(blob);

      if (preview) preview.src = state.story.url;
      toast("Story ready");
    }catch(err){
      console.error("Story render error:", err);
      toast("Story failed");
    }
  }

  // Bind buttons
  function bindButtons(){
    $("btnEditSelf")?.addEventListener("click", () => show("scrSetup"));
    $("btnChallenge")?.addEventListener("click", async () => {
      const self = getSelfPick();
      if (!self){ show("scrSetup"); return; }
      const url = buildChallengeLink(self);
      await shareLink({
        title:"Guess my vibe",
        text:"Can you guess my vibe? 👀\nPick 3 traits that describe me.\n\nHold to reveal your score.",
        url
      });
    });

    $("btnIceShare")?.addEventListener("click", async () => {
      await shareOrCopyText(dailyIcebreaker());
    });
    $("btnIceCopy")?.addEventListener("click", async () => {
      await copy(dailyIcebreaker());
    });

    $("btnStartGuess")?.addEventListener("click", () => show("scrGuess"));
    $("btnGuessIntroBack")?.addEventListener("click", () => goHomeHard());

    $("btnGuessSentHome")?.addEventListener("click", () => goHomeHard());
    $("btnGuessSentConvo")?.addEventListener("click", () => openConvo());
    $("btnGuessSentPing")?.addEventListener("click", async () => {
      const self = getSelfPick();
      const url = buildPingLink(self || state.ownerPick || null);
      await shareLink({ title:"Ping 👀", text:"I sent you something 👀", url });
    });

    $("btnHoldHome")?.addEventListener("click", () => goHomeHard());

    $("btnResHome")?.addEventListener("click", () => goHomeHard());
    $("btnResChallenge")?.addEventListener("click", async () => {
      const self = getSelfPick();
      if (!self){ show("scrSetup"); return; }
      const url = buildChallengeLink(self);
      await shareLink({
        title:"Guess my vibe",
        text:"Can you guess my vibe? 👀\nPick 3 traits that describe me.\n\nHold to reveal your score.",
        url
      });
    });
    $("btnResStory")?.addEventListener("click", async () => {
      await openStorySheet();
    });

    $("btnPingHome")?.addEventListener("click", () => goHomeHard());
    $("btnPingOpen")?.addEventListener("click", () => {
      if (state.ownerPick && !state.guessPick){
        show("scrGuessIntro");
        return;
      }
      routeToHome();
    });
  }

  // Boot
  function boot(){
    state.ownerPick = decodePick(qs.get("v"));
    state.guessPick = decodePick(qs.get("g"));
    state.ping = qs.get("ping") ? true : false;

    initSetup();
    initGuess();
    initHold();
    initConvo();
    initMoreSheet();
    initStorySheet();
    bindButtons();

    route();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();