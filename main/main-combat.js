// ═══════════════════════════════════════════════════════════════════════════
// IRON CAGE — MMA Manager
// combat.js — Full fight engine
//   Section 1: Location HP & damage utilities
//   Section 2: Body figure SVG
//   Module-level reach/range helpers (getRangeZone, reachRangeMod)
//   Section 3: runFight — visual fight simulation with playback
//   Section 4: endFight — result application & ranking update
//   Section 5: simulateFightHeadless + _headlessRound — instant simulation
//   Section 6: autoResolveFight — skipped/NPC fight resolution
//   Week card modal
// ═══════════════════════════════════════════════════════════════════════════

function initLocationHP(fighter){
  const chin     = fighter.stats?.phys?.chin      ?? fighter.chin      ?? 65;
  const bodyTough= fighter.stats?.phys?.body_tough ?? 65;
  const legDur   = fighter.stats?.phys?.leg_dur    ?? 65;
  return {
    head: Math.round(chin      * 0.75),   // max ~74 for elite chin
    body: Math.round(bodyTough * 0.75),
    legs: Math.round(legDur    * 0.75),
  };
}

// Determine which body part a strike targets
// strikeType: 'boxing'|'kick'|'clinch'|'ground'
// action string provides hints; fighter IQ shifts toward weakened zones
function targetLocation(strikeType, action, atkFIQ, defLoc){
  // Find the most damaged zone for smart targeting
  const lowestZone = defLoc.head <= defLoc.body && defLoc.head <= defLoc.legs ? 'head'
                   : defLoc.body <= defLoc.legs ? 'body' : 'legs';

  // IQ-based targeting: higher IQ → more likely to attack weakest zone
  const iqBias = clamp((atkFIQ - 50) / 100, 0, 0.5); // 0..0.5 bias toward weak zone
  const goWeak = Math.random() < iqBias;

  // Feint logic: sometimes high-IQ fighters set up by faking one zone then hitting another
  let target;
  if(strikeType === 'kick'){
    if(action.includes('low kick')) target = 'legs';
    else if(action.includes('body kick') || action.includes('body')) target = 'body';
    else target = 'head';
  } else if(strikeType === 'clinch'){
    if(action.includes('body') || action.includes('knee to the body')) target = 'body';
    else target = 'head';
  } else if(strikeType === 'ground'){
    target = Math.random() < 0.6 ? 'head' : 'body';
  } else {
    // Boxing: jabs to head, body shots to body, most punches head
    if(action.includes('body shot') || action.includes('body')) target = 'body';
    else target = 'head';
  }

  // Override with smart targeting if high IQ
  if(goWeak && defLoc[lowestZone] < 40) target = lowestZone;

  return target;
}

// CUT SYSTEM
// cut levels: 0=none, 1=small (−5 mental), 2=mild (−10 mental), 3=large (−20 mental, doctor check)
function initCuts(){
  return {head: 0, body: 0}; // body cuts rare but possible
}

// Try to open a cut based on strike type and defender's injury resistance
function tryCut(strikeType, isElbow, isGroundElbow, defInjRes){
  const baseProb = isGroundElbow ? 0.20
                 : isElbow       ? 0.15
                 : 0.03;
  // Injury resistance reduces cut probability: high resistance halves it
  const resMod = clamp(1 - (defInjRes - 50) / 200, 0.4, 1.3);
  const prob = baseProb * resMod;
  if(Math.random() >= prob) return null;

  // Determine severity: ~60% small, ~30% mild, ~10% large
  const r = Math.random();
  return r < 0.60 ? 1 : r < 0.90 ? 2 : 3;
}

// Apply cut to fighter — upgrades existing cut if worse
function applyCut(cuts, zone, level){
  if(level > (cuts[zone]||0)){
    cuts[zone] = level;
    return true; // new or worsened cut
  }
  return false;
}

// Mental debuff from cuts (applied each exchange)
function cutMentalDebuff(cuts){
  const head = cuts.head||0;
  return head===3 ? 20 : head===2 ? 10 : head===1 ? 5 : 0;
}

// Cut label
function cutLabel(level){ return level===1?'small cut':level===2?'mild cut':level===3?'LARGE CUT':''; }
function cutColor(level){ return level===1?'var(--orange)':level===2?'var(--red-bright)':'#FF1010'; }

// ===================== FIGHT ENGINE =====================

function showFightSection(){
  // Open fight night as a popup modal
  openModal('fight-night-modal');
}

function closeFightNightModal(){
  // Prevent close mid-fight (fight-btn disabled = fight running)
  const fightBtn = document.getElementById('fight-btn');
  if(fightBtn && fightBtn.disabled){
    showToast("Fight in progress — wait for it to finish.");
    return;
  }
  closeModal('fight-night-modal');
}

function showMatchmakingSection(){
  closeFightNightModal();
  openMatchmaking();
}

function openMatchmaking(fighterId){
  if(fighterId){
    G.selectedFighter = [...G.roster].find(f=>f.id===fighterId) || null;
    G.selectedOpponent = null;
  } else {
    G.selectedFighter = null;
    G.selectedOpponent = null;
  }
  renderMatchmaking();
  openModal('matchmaking-modal');
}

function renderFightPage(){
  // Open fight night modal
  showFightSection();
  const fc = document.getElementById('fight-container');
  if(!fc) return;
  if(!G.pendingFight){
    // Show pending fights from current week's event
    const curEvt = G.schedule.find(e=>e.week===G.week);
    const pendingOnCard = curEvt ? (curEvt.fights||[]).filter(fi=>G.roster.find(r=>r.id===fi.fighterId)&&!fi.result) : [];
    if(pendingOnCard.length>0){
      fc.innerHTML = `<div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:12px">🏟</div>
        <div style="font-family:'Bebas Neue';font-size:28px;color:var(--gold)">${curEvt.name}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:8px">You have ${pendingOnCard.length} fight${pendingOnCard.length>1?'s':''} on this card.</div>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;max-width:400px;margin-left:auto;margin-right:auto">
          ${pendingOnCard.map(fi=>{
            const fighter=[...G.roster].find(r=>r.id===fi.fighterId);
            const opp=[...G.opponents,...G.roster].find(r=>r.id===fi.opponentId);
            return fighter&&opp?`<button class="btn btn-gold" onclick="loadFightFromCard('${curEvt.id}','${fi.fighterId}')">${fighter.name} vs ${opp.name} ▶</button>`:'';
          }).join('')}
        </div>
      </div>`;
    } else {
      fc.innerHTML = `<div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:12px">🏟</div>
        <div style="font-family:'Bebas Neue';font-size:24px;color:var(--muted)">No Fight Scheduled</div>
        <div style="font-size:13px;color:var(--muted);margin-top:8px">Go to Matchmaking to book fights on upcoming cards.</div>
        <div style="margin-top:20px"><button class="btn btn-gold" onclick="openMatchmaking()">Matchmaking</button></div>
      </div>`;
    }
    return;
  }
  const {fighter:f, opponent:o} = G.pendingFight;
  fc.innerHTML = `
    <div class="fighter-vs card" style="margin-bottom:16px">
      <div class="fight-fighter">
        <div style="display:flex;justify-content:center;margin-bottom:8px"><div style="width:56px;height:56px;border-radius:50%;background:${f.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:20px">${f.initials}</div></div>
        <div class="fight-name">${f.name}</div>
        <div style="font-size:12px;color:var(--muted)">${f.wins}-${f.losses} · ${f.rating} RTG</div>
        <div id="f-body-figure" style="margin:8px 0">${buildBodyFigureSVG('f',100,100,100)}</div>
        <div class="health-label" style="margin-top:4px">Stamina</div>
        <div class="health-bar"><div class="health-fill stam-fill" id="f-st" style="width:100%"></div></div>
      </div>
      <div style="text-align:center;align-self:center">
        <div class="vs-label">VS</div>
        <div style="font-size:11px;color:var(--muted)">Round <span id="round-num">1</span>/<span id="round-max">${(G.pendingFight?.isTitleFight||G.pendingFight?.isMainEvent)?5:3}</span></div>
      </div>
      <div class="fight-fighter">
        <div style="display:flex;justify-content:center;margin-bottom:8px"><div style="width:56px;height:56px;border-radius:50%;background:${o.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:20px">${o.initials}</div></div>
        <div class="fight-name">${o.name}</div>
        <div style="font-size:12px;color:var(--muted)">${o.wins}-${o.losses} · ${o.rating} RTG</div>
        <div id="o-body-figure" style="margin:8px 0">${buildBodyFigureSVG('o',100,100,100)}</div>
        <div class="health-label" style="margin-top:4px">Stamina</div>
        <div class="health-bar"><div class="health-fill stam-fill" id="o-st" style="width:100%"></div></div>
      </div>
    </div>
    <div id="fight-log"></div>
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-top:16px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;font-family:'Barlow Condensed'">Speed</label>
        <select id="fight-speed" style="background:var(--bg4);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:5px 10px;font-family:'Barlow Condensed';font-size:13px">
          <option value="3000">Slow</option>
          <option value="1800" selected>Normal</option>
          <option value="900">Fast</option>
          <option value="400">Very Fast</option>
        </select>
      </div>
      <button class="btn btn-gold" id="fight-btn" onclick="runFight()">🔔 Start Fight</button>
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// ██████████████████████████████████████████████████████████████████████████████
// ██  COMBAT ENGINE — SECTION 2: BODY FIGURE DISPLAY                         ██
// ██  buildBodyFigureSVG · renders live location HP as coloured silhouette    ██
// ██████████████████████████████████████████████████████████████████████████████
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// BODY FIGURE SVG — renders a simple human silhouette with zone HP colour coding
// headHP, bodyHP, legsHP: 0-100 each (starts at 3/4 of stat)
// Colour: green=healthy, yellow=damaged, orange=hurt, red=critical, dark=0
// ─────────────────────────────────────────────────────────────────────────────
function buildBodyFigureSVG(key, headHP, bodyHP, legsHP){
  function zoneColor(hp){
    if(hp<=0)  return '#2A0000';      // near black — gone
    if(hp<15)  return '#C0392B';      // red — critical
    if(hp<30)  return '#D35400';      // dark orange — hurt
    if(hp<50)  return '#E67E22';      // orange — damaged
    if(hp<70)  return '#F1C40F';      // yellow — worn
    return '#27AE60';                 // green — healthy
  }
  function zoneStroke(hp){
    if(hp<=0) return '#5A0000';
    if(hp<30) return '#8B2500';
    if(hp<60) return '#7B6000';
    return '#1A7A40';
  }
  function hpLabel(hp){ return Math.max(0,Math.round(hp)); }

  const headCol  = zoneColor(headHP);
  const bodyCol  = zoneColor(bodyHP);
  const legsCol  = zoneColor(legsHP);
  const headStk  = zoneStroke(headHP);
  const bodyStk  = zoneStroke(bodyHP);
  const legsStk  = zoneStroke(legsHP);

  const W = 90, H = 190;
  const cx = W/2;

  // Build SVG — compact human body figure: head circle, torso rect, two leg rects
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin:0 auto">
    <!-- HEAD zone -->
    <circle cx="${cx}" cy="18" r="14"
      fill="${headCol}" stroke="${headStk}" stroke-width="1.5"/>
    <text x="${cx}" y="22" text-anchor="middle"
      style="font-size:10px;font-family:'Barlow Condensed';font-weight:700;fill:#fff;dominant-baseline:central">
      ${hpLabel(headHP)}
    </text>

    <!-- NECK connector -->
    <rect x="${cx-3}" y="31" width="6" height="8"
      fill="${bodyCol}" stroke="${bodyStk}" stroke-width="1"/>

    <!-- LEFT ARM -->
    <rect x="${cx-22}" y="38" width="9" height="50" rx="4"
      fill="${bodyCol}" stroke="${bodyStk}" stroke-width="1"/>
    <!-- RIGHT ARM -->
    <rect x="${cx+13}" y="38" width="9" height="50" rx="4"
      fill="${bodyCol}" stroke="${bodyStk}" stroke-width="1"/>

    <!-- TORSO zone -->
    <rect x="${cx-16}" y="38" width="32" height="55" rx="5"
      fill="${bodyCol}" stroke="${bodyStk}" stroke-width="1.5"/>
    <text x="${cx}" y="67" text-anchor="middle"
      style="font-size:10px;font-family:'Barlow Condensed';font-weight:700;fill:#fff;dominant-baseline:central">
      ${hpLabel(bodyHP)}
    </text>

    <!-- HIPS connector -->
    <rect x="${cx-13}" y="92" width="26" height="10" rx="3"
      fill="${legsCol}" stroke="${legsStk}" stroke-width="1"/>

    <!-- LEFT LEG -->
    <rect x="${cx-20}" y="101" width="17" height="65" rx="5"
      fill="${legsCol}" stroke="${legsStk}" stroke-width="1.5"/>
    <!-- RIGHT LEG -->
    <rect x="${cx+3}"  y="101" width="17" height="65" rx="5"
      fill="${legsCol}" stroke="${legsStk}" stroke-width="1.5"/>

    <!-- Left foot -->
    <rect x="${cx-22}" y="163" width="19" height="8" rx="3"
      fill="${legsCol}" stroke="${legsStk}" stroke-width="1"/>
    <!-- Right foot -->
    <rect x="${cx+3}"  y="163" width="19" height="8" rx="3"
      fill="${legsCol}" stroke="${legsStk}" stroke-width="1"/>

    <!-- Legs HP label (centred between the two legs) -->
    <text x="${cx}" y="143" text-anchor="middle"
      style="font-size:10px;font-family:'Barlow Condensed';font-weight:700;fill:#fff;dominant-baseline:central">
      ${hpLabel(legsHP)}
    </text>

    <!-- Zone labels below figure -->
    <text x="${cx-14}" y="180" text-anchor="middle"
      style="font-size:8px;font-family:'Barlow Condensed';fill:#888;letter-spacing:0.5px">HEAD</text>
    <text x="${cx}" y="180" text-anchor="middle"
      style="font-size:8px;font-family:'Barlow Condensed';fill:#888;letter-spacing:0.5px">BODY</text>
    <text x="${cx+14}" y="180" text-anchor="middle"
      style="font-size:8px;font-family:'Barlow Condensed';fill:#888;letter-spacing:0.5px">LEGS</text>
  </svg>`;
}

// ── Module-level reach/range helpers (used by both runFight and headless engine) ──
const REACH_MULT = { jab:1.00, cross:1.05, hook:0.70, uppercut:0.65, kick:1.30, elbow:0.40, clinch:0.25 };

function getRangeZone(atkStyle, defStyle, atkReach, defReach){
  const reachAdv = atkReach - defReach;
  let pOut = 0.30, pMid = 0.45, pIn = 0.25;
  if(atkStyle==='Brawler'||atkStyle==='Pressure Fighter'){ pOut-=0.15; pIn+=0.15; }
  if(atkStyle==='Counter-Striker'||atkStyle==='Kickboxer'){ pOut+=0.15; pIn-=0.15; }
  if(atkStyle==='Wrestler'||atkStyle==='BJJ Artist'){ pOut-=0.20; pIn+=0.20; }
  pOut += reachAdv*0.008; pIn -= reachAdv*0.008;
  pOut=clamp(pOut,0.05,0.70); pIn=clamp(pIn,0.05,0.70); pMid=clamp(1-pOut-pIn,0.10,0.70);
  const r=Math.random();
  return r<pOut?'outside':r<pOut+pMid?'mid':'inside';
}

function reachRangeMod(strikeType, action, zone, atkReach, defReach, atkHeight, defHeight){
  const reachAdv=atkReach-defReach, heightAdv=atkHeight-defHeight;
  let accMod=0, dmgMod=1.0;
  if(zone==='outside'){
    if(strikeType==='kick'){accMod+=reachAdv*0.006;dmgMod+=reachAdv*0.008;}
    if(action.includes('jab')||action.includes('teep')){accMod+=reachAdv*0.008;}
    if(action.includes('straight')||action.includes('cross')){accMod+=reachAdv*0.005;}
    if(action.includes('hook')||action.includes('uppercut')){accMod-=0.08;dmgMod-=0.10;}
    if(reachAdv<0){accMod+=reachAdv*0.006;dmgMod+=reachAdv*0.005;}
    if(strikeType==='kick'&&heightAdv>2){dmgMod+=0.08;}
  } else if(zone==='inside'){
    if(action.includes('hook')||action.includes('uppercut')){accMod-=reachAdv*0.005;dmgMod-=reachAdv*0.008;}
    if(action.includes('body shot')){accMod-=reachAdv*0.006;dmgMod-=reachAdv*0.006;}
    if(strikeType==='clinch'){accMod-=reachAdv*0.004;}
    if(action.includes('jab')||action.includes('straight')){accMod-=0.06;dmgMod-=0.08;}
    if(strikeType==='kick'){accMod-=0.10;dmgMod-=0.12;}
    if(reachAdv<0){accMod+=0.04;dmgMod+=0.05;}
  }
  if(heightAdv>2&&strikeType==='kick') dmgMod+=0.05;
  if(heightAdv<-2&&action.includes('body shot')){accMod+=0.04;dmgMod+=0.04;}
  accMod=clamp(accMod,-0.15,0.15); dmgMod=clamp(dmgMod,0.75,1.25);
  return {accMod, dmgMod, logNote:zone!=='mid'?`<span style="font-size:10px;color:var(--muted)">[${zone}]</span>`:''};
}

// ═════════════════════════════════════════════════════════════════════════════
// ██████████████████████████████████████████████████████████████████████████████
// ██  COMBAT ENGINE — SECTION 3: FIGHT SIMULATION (runFight)                 ██
// ██                                                                          ██
// ██  Outer function:  runFight()                                             ██
// ██  Inner helpers:  fStat / oStat / fStatD / oStatD / updateBars           ██
// ██  Core loop:      collectRoundActions(r)                                  ██
// ██    ├─ Grappling:  takedown attempt → ground sequence → get-ups           ██
// ██    │    getRangeZone · reachRangeMod                                     ██
// ██    └─ Striking:   combo system → location damage → zone debuffs          ██
// ██  Scoring:         judgeRound · tallyForJudge · 10-8 detection            ██
// ██  Finish checks:   KO / TKO / Submission / decision                       ██
// ██  Playback:        timed action replay with ACTION_DELAY / ROUND_DELAY    ██
// ██████████████████████████████████████████████████████████████████████████████
// ═════════════════════════════════════════════════════════════════════════════

function runFight(){
  const btn = document.getElementById('fight-btn');
  if(btn) btn.disabled = true;
  const {fighter:f, opponent:o, purse} = G.pendingFight;
  const log = document.getElementById('fight-log');
  log.innerHTML = '';

  // NO total HP — location HP only (head/body/legs per fighter)
  // fLoc/oLoc live outside collectRoundActions so bars can read them
  let fST=100, oST=100;
  let round=1, finished=false, winner=null, method='', finishRound=0;

  // Stat helpers — fall back to legacy flat props if no stats tree
  function getS(fighter, path, fallback){
    try {
      const parts = path.split('.');
      let v = fighter.stats;
      for(const p of parts) v = v[p];
      return v||fallback;
    } catch(e){ return fallback; }
  }
  function fStat(path, fb){ return getS(f,path,fb); }
  function oStat(path, fb){ return getS(o,path,fb); }

  function logLine(html){ log.innerHTML += '<div>'+html+'</div>'; log.scrollTop=log.scrollHeight; }
  function updateBars(){
    // Update body figure SVGs
    const ffig = document.getElementById('f-body-figure');
    const ofig = document.getElementById('o-body-figure');
    if(ffig && fLoc) ffig.innerHTML = buildBodyFigureSVG('f', fLoc.head, fLoc.body, fLoc.legs);
    if(ofig && oLoc) ofig.innerHTML = buildBodyFigureSVG('o', oLoc.head, oLoc.body, oLoc.legs);
    const fst=document.getElementById('f-st'), ost=document.getElementById('o-st');
    if(fst) fst.style.width=clamp(fST,0,100)+'%';
    if(ost) ost.style.width=clamp(oST,0,100)+'%';
    const rn=document.getElementById('round-num'); if(rn) rn.textContent=round;
    const rm=document.getElementById('round-max'); if(rm) rm.textContent=MAX_ROUNDS;
  }

  const speedEl = document.getElementById('fight-speed');
  const ROUND_DELAY = speedEl ? parseInt(speedEl.value) : 1800;
  const ACTION_DELAY = Math.round(ROUND_DELAY / 10); // per-action delay within a round

  // Round-by-round scorecards
  // Each round tracked: damage dealt, control time, aggression
  const roundScores = []; // [{fDmg, oDmg, fCtrl, oCtrl, fAgg, oAgg}]

  // ── Per-fight running totals (for fight log / stats) ─────────────────────
  const fightStats = {
    f: { strikes:0, sigStrikes:0, takedowns:0, tdAttempts:0, ctrlSeconds:0, knockdowns:0 },
    o: { strikes:0, sigStrikes:0, takedowns:0, tdAttempts:0, ctrlSeconds:0, knockdowns:0 },
  };

  // ── Locational HP: head/body/legs (NO total HP — these ARE the HP) ─────────
  const fLoc = initLocationHP(f);
  const oLoc = initLocationHP(o);

  // ── Per-fighter stat debuff accumulators (modified by zone damage) ─────────
  // These are deltas applied to effective stat lookups during the fight
  const fDebuff = { move_speed:0, td_def:0, kicks:0, stamina_drain:0,
                    boxing:0, upper_td:0, mental:0, sub_def:0, head_mov:0, reaction:0 };
  const oDebuff = { move_speed:0, td_def:0, kicks:0, stamina_drain:0,
                    boxing:0, upper_td:0, mental:0, sub_def:0, head_mov:0, reaction:0 };

  // ── Cuts tracking ──────────────────────────────────────────────────────────
  const fCuts = initCuts();
  const oCuts = initCuts();

  // ── Track whether last head hit was ground strike ──────────────────────────
  let fLastHeadHitGround = false;
  let oLastHeadHitGround = false;

  // ── REACH & HEIGHT MATCHUP ────────────────────────────────────────────────
  // Compute deltas; positive = fighter has advantage, negative = opponent has advantage
  const fReach  = f.reach  || 70;
  const oReach  = o.reach  || 70;
  const fHeight = f.height || 70;
  const oHeight = o.height || 70;
  const reachDelta  = fReach  - oReach;   // positive = f longer reach
  const heightDelta = fHeight - oHeight;  // positive = f taller
  // Debuffed stat helper — applies accumulated location debuffs to stat reads
  function fStatD(path, fb){ const base=fStat(path,fb); const key=path.split('.').pop(); return Math.max(10, base-(fDebuff[key]||0)); }
  function oStatD(path, fb){ const base=oStat(path,fb); const key=path.split('.').pop(); return Math.max(10, base-(oDebuff[key]||0)); }

  function collectRoundActions(r){
    const actions = [];
    let localFST=fST, localOST=oST;
    let localFinished=false, localWinner=null, localMethod='';
    // Round scoring accumulators
    let fDmg=0, oDmg=0, fCtrl=0, oCtrl=0, fAgg=0, oAgg=0;

    logLine(`<span class="log-round">═══ ROUND ${r} ═══</span>`);
    // ~25-35 exchanges per round
    let exchanges = 25 + rnd(0,10);
    // Round-level counters for striking % display
    let fStrAtt=0, fStrLand=0, oStrAtt=0, oStrLand=0;

    // Per-round TD budget: max takedown ATTEMPTS per fighter per round (realistic ~2-5 shots)
    let fTDattempts=0, oTDattempts=0;
    const maxTDperRound = rnd(6,8); // each fighter gets up to 6-8 shot attempts per round

    for(let i=0;i<exchanges;i++){
      if(localFinished) break;
      const fAtk = Math.random()<0.5;
      const atk = fAtk?f:o, def = fAtk?o:f;
      const atkST = fAtk?localFST:localOST;
      const defST = fAtk?localOST:localFST;
      const atkMod = atkST/100;
      // Stamina scales key stats: 0→40 ST has progressive effect
      // Below 40 ST, physical stats (strength, TD, blocking) degrade
      const atkStaminaFac = atkST < 40 ? 0.65 + (atkST/40)*0.35 : 1.0; // 0.65–1.0
      const defStaminaFac = defST < 40 ? 0.65 + (defST/40)*0.35 : 1.0;

      // Style-weighted grapple probability
      // Wrestlers/BJJ lean heavily to grappling; strikers lean striking
      const baseGrapScore = fAtk
        ? avg2(fStat('grap.td.dl_td',60), fStat('grap.clinch.control',60), fStat('grap.ground.top_ctrl',55))
        : avg2(oStat('grap.td.dl_td',60), oStat('grap.clinch.control',60), oStat('grap.ground.top_ctrl',55));
      const baseStrScore = fAtk
        ? avg2(fStat('str.boxing.jab',60), fStat('str.boxing.cross',60), fStat('str.kicking.low_kicks',60))
        : avg2(oStat('str.boxing.jab',60), oStat('str.boxing.cross',60), oStat('str.kicking.low_kicks',60));
      // Style modifier: Wrestlers and BJJ artists get a grapple preference bonus
      const atkStyle = atk.style||'All-Rounder';
      const styleGrapBonus = (atkStyle==='Wrestler'||atkStyle==='BJJ Artist') ? 0.28
                           : (atkStyle==='Pressure Fighter') ? 0.10
                           : (atkStyle==='Boxer')   ? -0.42
                           : (atkStyle==='Kickboxer') ? -0.35
                           : (atkStyle==='Muay Thai') ? -0.12
                           : (atkStyle==='Brawler')   ? -0.25
                           : (atkStyle==='Counter-Striker') ? -0.30
                           : 0;
      // Fight pacing: fights start slower, build through the round
      // exchangeProgress 0→1 over the round; aggression ramps up
      const exchangeProgress = i / Math.max(exchanges-1, 1);
      const pacingMod = 0.65 + exchangeProgress * 0.35; // 65% activity early, 100% late

      // TD budget: if this fighter has used their shots for the round, lock out grapple
      const atkTDUsed = fAtk ? fTDattempts : oTDattempts;
      const tdBudgetExhausted = atkTDUsed >= maxTDperRound;

      // ── Fight IQ TD decision: fighter weighs their TD skill vs opponent's TD defense ──
      const atkFightIQ   = fAtk ? fStat('ment.fight_iq',65) : oStat('ment.fight_iq',65);
      const atkTDskill   = fAtk ? avg2(fStat('grap.td.dl_td',60),fStat('grap.td.sl_td',60))
                                : avg2(oStat('grap.td.dl_td',60),oStat('grap.td.sl_td',60));
      const defTDskill   = fAtk ? avg2(oStat('grap.td_def.dl_def',60),oStat('grap.td_def.sl_def',60))
                                : avg2(fStat('grap.td_def.dl_def',60),fStat('grap.td_def.sl_def',60));
      // TD advantage: how much better is this fighter at TDs vs opponent's defense?
      const tdAdvantage  = (atkTDskill - defTDskill) / 100; // −1 to +1 range
      // Fight IQ modifier: high IQ fighters recognize bad matchups and avoid shooting
      // Low IQ fighters shoot regardless; high IQ fighters only shoot when they have an advantage
      const fiqTDmod = (atkFightIQ - 65) * 0.04; // −0.15 to +0.14 based on IQ
      // Base grap prob from style-weighted stats + style bias
      const rawGrapProb = clamp(baseGrapScore/(baseGrapScore+baseStrScore||1) + styleGrapBonus, 0.04, 0.80);
      // Fight IQ × TD advantage: all fighters shoot more when they have a TD edge,
      // and far less when they are at a disadvantage. High IQ amplifies this recognition.
      const tdIQAdjustment = fiqTDmod * tdAdvantage * 2;
      // Low fight IQ strikers: even low-IQ non-grapplers stay on the feet instinctively
      // This adds an extra penalty for striking styles with low IQ attempting to grapple
      const isStrikingStyle = ['Boxer','Kickboxer','Muay Thai','Brawler','Counter-Striker'].includes(atkStyle);
      const lowIQStrikerBias = (isStrikingStyle && atkFightIQ < 65)
        ? (65 - atkFightIQ) * -0.003  // up to -0.195 extra penalty at fight_iq=0
        : 0;
      const adjustedGrapProb = rawGrapProb * 0.38 + tdIQAdjustment + lowIQStrikerBias;
      const grapProb = tdBudgetExhausted ? 0 : clamp(adjustedGrapProb, 0.01, 0.35);
      const atkAggression = fAtk ? fStat('ment.aggression',65) : oStat('ment.aggression',65);
      const doGrapple = Math.random() < grapProb;

      let logHTML = '', newFST=localFST, newOST=localOST;
      let roundFinished=false, roundWinner=null, roundMethod='';
      let comboActions=[], landedStrikes=[], isSigCombo=false;

      // ── Reach & height for this exchange (needed by both grappling and striking) ──
      const atkReach  = fAtk ? fReach  : oReach;
      const defReach  = fAtk ? oReach  : fReach;
      const atkHeight = fAtk ? fHeight : oHeight;
      const defHeight = fAtk ? oHeight : fHeight;
      const rangeZone = getRangeZone(atkStyle, def.style||'All-Rounder', atkReach, defReach);
      const grapReachBonus = (atkReach - defReach) * 0.0015;

      if(doGrapple){
        // ── TAKEDOWN ATTEMPT ───────────────────────────────────────────────────
        // Stamina degrades TD ability and TD defense
        const atkTDraw = fAtk ? avg2(fStat('grap.td.dl_td',60), fStat('grap.td.sl_td',60))
                               : avg2(oStat('grap.td.dl_td',60), oStat('grap.td.sl_td',60));
        const atkTD = atkTDraw * atkStaminaFac;
        // TD defense debuffed by leg damage and fatigue
        const rawTDdef = fAtk ? avg2(oStat('grap.td_def.dl_def',60), oStat('grap.td_def.sl_def',60))
                               : avg2(fStat('grap.td_def.dl_def',60), fStat('grap.td_def.sl_def',60));
        const defTD = Math.max(10, rawTDdef * defStaminaFac - (fAtk?oDebuff.td_def:fDebuff.td_def));
        // Height: taller fighter weaker vs low shots; shorter better at double leg
        const heightTDmod = (atkHeight < defHeight) ? 0.04 : (atkHeight > defHeight) ? -0.04 : 0;
        const tdChance = clamp(0.18+(atkTD-defTD)*0.003+atkMod*0.08+heightTDmod, 0.08, 0.75);

        // Count this as a TD attempt against the budget
        if(fAtk) fTDattempts++; else oTDattempts++;

        if(Math.random()<tdChance){
          // ── TAKEDOWN LANDS — enter ground sequence ─────────────────────────
          const tdType = pick(['single leg','double leg','body lock','ankle pick','trip']);
          if(fAtk){ newOST=clamp(localOST-rnd(6,12),0,100); } else { newFST=clamp(localFST-rnd(6,12),0,100); }

          const defLocGrap  = fAtk ? oLoc : fLoc;
          const defDebuffG  = fAtk ? oDebuff : fDebuff;
          const atkLocGrap  = fAtk ? fLoc : oLoc;

          // Get-up stats: how hard the bottom fighter escapes
          const defWrestleUp = fAtk ? oStat('grap.ground.wrestling_getup',55) : fStat('grap.ground.wrestling_getup',55);
          const defBJJUp     = fAtk ? oStat('grap.ground.bjj_getup',55)       : fStat('grap.ground.bjj_getup',55);
          const defScramble  = fAtk ? oStat('grap.ground.scrambling',55)       : fStat('grap.ground.scrambling',55);
          // Best getup is combination: a wrestler can frame up, a BJJ player can create space
          const getupScore   = avg2(defWrestleUp, defBJJUp, defScramble);

          // Top-game transition stats for the attacker
          const atkWresTrans = fAtk ? fStat('grap.ground.wrestling_trans',55)  : oStat('grap.ground.wrestling_trans',55);
          const atkBJJTrans  = fAtk ? fStat('grap.ground.bjj_trans',55)        : oStat('grap.ground.bjj_trans',55);
          const atkTopCtrl   = fAtk ? fStat('grap.ground.top_ctrl',55)         : oStat('grap.ground.top_ctrl',55);
          const atkBotCtrl   = fAtk ? fStat('grap.ground.bottom_ctrl',55)      : oStat('grap.ground.bottom_ctrl',55);

          // Sub offense / defense
          const atkSub  = fAtk ? avg2(fStat('grap.sub_off.chokes',50), fStat('grap.sub_off.joint_locks',50))
                               : avg2(oStat('grap.sub_off.chokes',50), oStat('grap.sub_off.joint_locks',50));
          const rawSubD = fAtk ? avg2(oStat('grap.sub_def.choke_def',60), oStat('grap.sub_def.joint_def',60))
                               : avg2(fStat('grap.sub_def.choke_def',60), fStat('grap.sub_def.joint_def',60));
          const defSubD = Math.max(10, rawSubD - (fAtk?oDebuff.sub_def:fDebuff.sub_def));

          // Ground control: how many exchanges happen before a getup attempt
          // Better top control + transitions = more ground exchanges
          const ctrlScore = avg2(atkTopCtrl, atkWresTrans, atkBJJTrans);
          // Getup chance per exchange: getup score vs top control (capped 15-65%)
          const getupChancePerEx = clamp(0.35 - (ctrlScore-getupScore)*0.004, 0.15, 0.65);
          // Number of ground exchanges: 2-6, more if top fighter dominates
          const groundExchanges = rnd(2, 2 + Math.round((ctrlScore-getupScore)*0.04 + 2));

          let groundLog = [`<span class="log-hit">${atk.name} shoots ${tdType} — ${def.first} taken down!</span>`];
          let gotUp = false;

          for(let g=0; g<clamp(groundExchanges,2,7); g++){
            if(roundFinished) break;

            // Get-up attempt: defender tries to stand
            if(g > 0 && Math.random() < getupChancePerEx){
              // Scramble/getup — attacker can either let it go or chase
              const chaseRoll = Math.random();
              const chaseScore = avg2(atkWresTrans, atkBJJTrans) / 100;
              if(chaseRoll < chaseScore * 0.6){
                // Successful re-takedown (transition to new position)
                const transPos = pick(['back to half guard','regains full mount','trips back down','re-takes back']);
                groundLog.push(`<span class="log-hit">${def.first} fights back to feet — ${atk.first} transitions: ${transPos}</span>`);
                if(fAtk){ newOST=clamp(newOST-rnd(3,7),0,100); } else { newFST=clamp(newFST-rnd(3,7),0,100); }
              } else {
                // Successful getup or scramble to feet
                const getupDesc = defWrestleUp > defBJJUp
                  ? pick(['wrestles back to feet','creates a scramble and stands','rolls to feet','hip escapes to standing'])
                  : pick(['frames up and creates space','sweeps to top','rolls through and stands','shrimps out and stands']);
                groundLog.push(`<span class="log-miss">${def.first} ${getupDesc}!</span>`);
                gotUp = true;
                if(fAtk){ newOST=clamp(newOST-rnd(2,6),0,100); } else { newFST=clamp(newFST-rnd(2,6),0,100); }
                break;
              }
            }

            // Ground position: attacker works G&P or seeks submission
            // Position transitions (guard pass, half guard, mount, back)
            const posRoll = Math.random();
            let currentPos;
            if(posRoll < 0.2 && atkBJJTrans > 60) currentPos = 'full mount';
            else if(posRoll < 0.4 && atkWresTrans > 60) currentPos = 'side control';
            else if(posRoll < 0.55) currentPos = 'half guard';
            else if(posRoll < 0.70 && atkBJJTrans > 55) currentPos = 'back mount';
            else currentPos = 'top position';

            // Sub attempt from dominant positions
            const subRollPos = (currentPos==='full mount'||currentPos==='back mount') ? 1.4
                             : currentPos==='side control' ? 1.1 : 0.85;
            const subReachMod = (fAtk ? fReach-oReach : oReach-fReach) * 0.001;
          const subChance = clamp((atkSub-defSubD)*0.002 + 0.035 * subRollPos + subReachMod, 0.01, 0.15);

            if(Math.random() < subChance){
              const subType = pick(['rear-naked choke','arm bar','guillotine','triangle choke','kimura','heel hook','anaconda choke']);
              groundLog.push(`<span class="log-finish">🔒 ${atk.name} ${subType.toUpperCase()} from ${currentPos}! TAP!</span>`);
              roundFinished=true; roundWinner=atk; roundMethod='Submission';
              break;
            }

            // G&P exchanges
            const gctrl  = fAtk ? fStat('grap.ground.top_ctrl',55)     : oStat('grap.ground.top_ctrl',55);
            const gndStr = fAtk ? fStat('str.ground_str.gnd_strikes',55): oStat('str.ground_str.gnd_strikes',55);
            const botDef = fAtk ? oStat('str.ground_str.gnd_def',55)    : fStat('str.ground_str.gnd_def',55);
            const gndDmg = Math.round(rnd(1,4)*(gctrl/80)*(gndStr/75)*atkMod);

            if(gndDmg > 0){
              const gndZone = (currentPos==='full mount'||currentPos==='back mount') ? 'head' : (Math.random()<0.55?'head':'body');
              defLocGrap[gndZone] = clamp(defLocGrap[gndZone] - gndDmg, 0, 100);
              if(fAtk) oLastHeadHitGround = true; else fLastHeadHitGround = true;

              // Update debuffs
              const maxHd = Math.round((fAtk?oStat('phys.chin',60):fStat('phys.chin',60))*0.75);
              const maxBd = Math.round((fAtk?oStat('phys.body_tough',65):fStat('phys.body_tough',65))*0.75);
              const hFrac = clamp(1-defLocGrap.head/Math.max(maxHd,1),0,1);
              const bFrac = clamp(1-defLocGrap.body/Math.max(maxBd,1),0,1);
              defDebuffG.mental=Math.round(hFrac*20); defDebuffG.sub_def=Math.round(hFrac*20);
              defDebuffG.head_mov=Math.round(hFrac*25); defDebuffG.reaction=Math.round(hFrac*15);
              defDebuffG.stamina_drain=Math.max(defDebuffG.stamina_drain,Math.round(bFrac*20));
              defDebuffG.boxing=Math.round(bFrac*15);

              const gpDesc = pick(['hammerfist','elbow','short punch','ground punch','mounted punch']);
              groundLog.push(`<span class="log-hit">${atk.first} ${gpDesc} from ${currentPos} (${gndZone} −${gndDmg}hp)</span>`);

              // Finish checks
              if(defLocGrap.head<=0){
                groundLog.push(`<span class="log-finish">💥 ${atk.name} STOPS IT WITH G&P! TKO!</span>`);
                roundFinished=true; roundWinner=atk; roundMethod='TKO'; break;
              }
              if(defLocGrap.body<=0){
                groundLog.push(`<span class="log-finish">💢 ${def.first.toUpperCase()} CAN'T TAKE IT! BODY TKO!</span>`);
                roundFinished=true; roundWinner=atk; roundMethod='TKO'; break;
              }
            } else {
              // Bottom fighter defends well
              const defDesc = pick(['covers up','frames off','moves hips','survives the exchange','blocks the shots']);
              groundLog.push(`<span class="log-miss">${def.first} ${defDesc} (${currentPos})</span>`);
            }

            // Stamina drain per ground exchange
            // Bottom fighter (def) drains faster under control — defending takes energy
            const stDrain = rnd(3,8);
            const ctrlDrain = rnd(2,5); // extra drain on controlled fighter
            if(fAtk){ newOST=clamp(newOST-stDrain-ctrlDrain,0,100); } else { newFST=clamp(newFST-stDrain-ctrlDrain,0,100); }
            if(fAtk){ newFST=clamp(newFST-rnd(1,4),0,100); } else { newOST=clamp(newOST-rnd(1,4),0,100); } // top works too

            // ctrl time scoring
            fCtrl += fAtk ? rnd(2,5) : 0;
            oCtrl += !fAtk ? rnd(2,5) : 0;
          }

          logHTML = groundLog.join('<br>');
          if(!gotUp && !roundFinished){
            // Fighter didn't get up — still on the ground at end of this exchange block
            logHTML += `<br><span style="color:var(--muted);font-size:11px"> ${def.first} still on the canvas...</span>`;
          }
        } else {
          const stuffType = pick(['stuffs the takedown','sprawls perfectly','blocks the level change','walls up','hip escape prevents the takedown']);
          // Failed TD drains significant stamina — explosive shot with nothing to show
          const tdFailDrain = rnd(6,14);
          if(fAtk){ newOST=clamp(localOST-tdFailDrain,0,100); logHTML=`<span class="log-miss">${def.name} ${stuffType} — ${atk.first} gasses (−${tdFailDrain} ST)</span>`; }
          else { newFST=clamp(localFST-tdFailDrain,0,100); logHTML=`<span class="log-miss">${def.name} ${stuffType} — ${atk.first} gasses (−${tdFailDrain} ST)</span>`; }
        }
      } else {
        // ── STRIKING EXCHANGE with combo system ──────────────────────────────
        const kickScore = fAtk ? avg2(fStat('str.kicking.low_kicks',55), fStat('str.kicking.body_kicks',55))
                               : avg2(oStat('str.kicking.low_kicks',55), oStat('str.kicking.body_kicks',55));
        const clinchScore= fAtk ? fStat('str.clinch_str.knees',55) : oStat('str.clinch_str.knees',55);
        const typeRoll = Math.random();
        let atkPower, defPower;
        const stance = atk.stance||'Orthodox';
        const spMod = stance==='Southpaw'?' (southpaw)':'';

        // Pick strike type
        let strikeType = 'boxing';
        if(typeRoll<0.10 && clinchScore>58){ strikeType='clinch'; }
        else if(typeRoll<0.28 && kickScore>52){ strikeType='kick'; }

        // Determine attacker and defender stats
        let atkAccStat, defEvadeStat;
        let comboActions = [];  // array of {action, isSig}

        if(strikeType==='clinch'){
          const kneeStat = fAtk?fStat('str.clinch_str.knees',55):oStat('str.clinch_str.knees',55);
          const elbStat  = fAtk?fStat('str.clinch_str.elbows',55):oStat('str.clinch_str.elbows',55);
          atkPower=avg2(kneeStat,elbStat);
          defPower=fAtk?oStat('str.clinch_str.clinch_str_def',55):fStat('str.clinch_str.clinch_str_def',55);
          atkAccStat = atkPower;
          defEvadeStat = defPower;
          const comboSize = rnd(1,2);
          const clinchMoves = ['knee to the body','short elbow','knee to the head','dirty boxing flurry','clinch knee'];
          for(let c=0;c<comboSize;c++) comboActions.push({action:pick(clinchMoves), isSig: true});
        } else if(strikeType==='kick'){
          const kickStat = fAtk?avg2(fStat('str.kicking.low_kicks',55),fStat('str.kicking.body_kicks',55),fStat('str.kicking.teep',50)):avg2(oStat('str.kicking.low_kicks',55),oStat('str.kicking.body_kicks',55),oStat('str.kicking.teep',50));
          const kickDef = fAtk?oStat('str.kicking.kick_def',55):fStat('str.kicking.kick_def',55);
          atkPower=kickStat; defPower=kickDef;
          atkAccStat = kickStat;
          defEvadeStat = kickDef;
          const kickMoves = ['low kick','body kick','teep kick','switch kick','spinning heel kick'];
          comboActions.push({action:pick(kickMoves), isSig: true});
          // Kick combos uncommon
          if(Math.random()<0.25) comboActions.push({action:pick(['jab','cross']), isSig: false});
        } else {
          // Boxing — combos of 1-4 punches common
          const jab  = fAtk?fStat('str.boxing.jab',60):oStat('str.boxing.jab',60);
          const cross= fAtk?fStat('str.boxing.cross',60):oStat('str.boxing.cross',60);
          const hooks= fAtk?fStat('str.boxing.hooks',55):oStat('str.boxing.hooks',55);
          const upcut= fAtk?fStat('str.boxing.uppercuts',52):oStat('str.boxing.uppercuts',52);
          const defHM= fAtk?oStat('str.boxing.head_mov',55):fStat('str.boxing.head_mov',55);
          const defBkRaw= fAtk?oStat('str.boxing.blocking',55):fStat('str.boxing.blocking',55);
          const defBk = defBkRaw * defStaminaFac; // tired fighters block less well
          atkPower=avg2(jab,cross,hooks);
          defPower=avg2(defHM,defBk);
          atkAccStat = avg2(jab,cross,hooks,upcut);
          defEvadeStat = avg2(defHM * defStaminaFac, defBk); // head movement also suffers
          // Combo size: 1-4 punches, non-sig jabs + sig power shots
          const comboSize = rnd(1,4);
          const punchTypes = [
            {action:'jab'+spMod, isSig:false},
            {action:'jab'+spMod, isSig:false},
            {action:'straight'+spMod, isSig:true},
            {action:'hook'+spMod, isSig:true},
            {action:'body shot'+spMod, isSig:true},
            {action:'uppercut'+spMod, isSig:true},
            {action:'overhand'+spMod, isSig:true},
          ];
          for(let c=0;c<comboSize;c++) comboActions.push(pick(punchTypes));
        }

        // Per-strike accuracy: target 30-45% for average fighters (accuracy stat-based)
        // Base 32% + up to +13% from stat advantage
        const atkHandSpd=fAtk?fStat('phys.hand_speed',60):oStat('phys.hand_speed',60);
        const defReact  =fAtk?oStat('phys.reaction',60):fStat('phys.reaction',60);

        // (reach/range computed above — atkReach, defReach, atkHeight, defHeight, rangeZone)

        // Pacing: accuracy is lower early in the round (fighters feeling each other out)
        // Stamina effects: low stamina heavily degrades accuracy and power
        const staminaPenalty = atkST < 40 ? (40-atkST)*0.004 : 0; // up to -16% acc at 0 ST
        const baseAcc = (0.28 + exchangeProgress*0.06) + (atkAccStat-defEvadeStat)*0.002 + (atkHandSpd-defReact)*0.002 + atkMod*0.06 - staminaPenalty;
        const perStrikeAcc = clamp(baseAcc, 0.18, 0.58);

        // Simulate each strike in the combo
        let totalAttempts = comboActions.length;
        let landedStrikes = [];
        let missedStrikes = [];
        let totalDmg = 0;
        let isSigCombo = false;

        // ── Location context ─────────────────────────────────────────────────
        const atkFIQ    = fAtk ? fStat('ment.fight_iq',65)  : oStat('ment.fight_iq',65);
        const defInjRes = fAtk ? oStat('phys.inj_res',60)   : fStat('phys.inj_res',60);
        const defLoc    = fAtk ? oLoc : fLoc;
        const atkLoc    = fAtk ? fLoc : oLoc;
        const defDebuff = fAtk ? oDebuff : fDebuff;
        const atkDebuff = fAtk ? fDebuff : oDebuff;
        const defCutsRef= fAtk ? oCuts : fCuts;
        const isGroundPosition = doGrapple; // strikes inside grappling are ground
        const defCutPenalty = cutMentalDebuff(defCutsRef) / 100;

        // Debuffed accuracy: cut + head damage reduces defense (head mov + reaction)
        // Counter bonus: fighters with high boxing_counters get accuracy/damage bonus
        // when they're not the aggressor (i.e. on defence mode — being attacked first)
        const atkCounters = fAtk ? fStat('str.boxing.counters',55) : oStat('str.boxing.counters',55);
        // Counter opportunity: if aggression < 50, treat this exchange as counter-punching
        const isCountering = atkAggression < 50 && strikeType !== 'kick';
        const counterBonus = isCountering ? (atkCounters - 55) * 0.003 : 0; // up to +6% accuracy
        // Zone-level accuracy modifier from reach advantage
          const zoneAccMod = rangeZone==='outside' ? (atkReach-defReach)*0.004
                           : rangeZone==='inside'  ? -(atkReach-defReach)*0.004
                           : 0;
          const adjAcc = clamp(perStrikeAcc + defCutPenalty*0.15 + (defDebuff.head_mov||0)*0.002 + counterBonus + zoneAccMod, 0.18, 0.68);

        comboActions.forEach(({action, isSig})=>{
          if(fAtk){ fStrAtt++; } else { oStrAtt++; }
          if(Math.random() < adjAcc){
            if(fAtk){ fStrLand++; } else { oStrLand++; }
            const strRaw = fAtk?fStat('phys.strength',60):oStat('phys.strength',60);
            const str = strRaw * atkStaminaFac; // tired = less power output
            // Strike-type power stat: boxing.power for punches/clinch, kicking.power for kicks
            const strikePowerStat = (strikeType==='kick')
              ? (fAtk?fStat('str.kicking.power',55):oStat('str.kicking.power',55))
              : (fAtk?fStat('str.boxing.power',55) :oStat('str.boxing.power',55));
            const powerMod = 0.75 + (strikePowerStat/100)*0.50; // 0.75–1.25× based on power stat
            // Counter-punch damage bonus
            const counterDmgBonus = (isCountering && isSig) ? 1 + (atkCounters-55)*0.004 : 1.0;
            // Reach & range zone modifier per strike
            const rrMod = reachRangeMod(strikeType, action, rangeZone, atkReach, defReach, atkHeight, defHeight);
            const baseDmg = isSig ? rnd(2,6) : rnd(1,2);
            // Per-action reach/range modifier (action changes within combo)
            const rrModAction = reachRangeMod(strikeType, action, rangeZone, atkReach, defReach, atkHeight, defHeight);
            // Stamina also reduces power output directly
            const staminaDmgMod = atkST < 40 ? 0.6 + (atkST/40)*0.4 : 1.0; // 0.6 at 0 ST, 1.0 at 40+ ST
            const dmg = baseDmg * (str/80) * (atkPower/75) * powerMod * rrModAction.dmgMod * counterDmgBonus * atkMod * staminaDmgMod * 1.07;
            totalDmg += dmg;

            // ── Target zone (FIQ-driven) ──────────────────────────────────────
            const zone = targetLocation(strikeType, action, atkFIQ, defLoc);
            const locDmg = Math.round(dmg * (isSig ? 0.5 : 0.20));
            defLoc[zone] = clamp(defLoc[zone] - locDmg, 0, 100);
            landedStrikes.push({action, zone, locDmg, isSig, isGround: isGroundPosition});
            if(isSig) isSigCombo = true;

            // ── Apply zone debuffs immediately ────────────────────────────────
            // Scale: full debuff at loc HP=0, none at loc HP=max
            const maxLoc = zone==='head' ? Math.round((fAtk?oStat('phys.chin',60):fStat('phys.chin',60))*0.75)
                         : zone==='body' ? Math.round((fAtk?oStat('phys.body_tough',65):fStat('phys.body_tough',65))*0.75)
                         : Math.round((fAtk?oStat('phys.leg_dur',65):fStat('phys.leg_dur',65))*0.75);
            const dmgFrac = clamp(1 - defLoc[zone]/Math.max(maxLoc,1), 0, 1);

            if(zone==='legs'){
              defDebuff.move_speed = Math.round(dmgFrac * 25);
              defDebuff.td_def     = Math.round(dmgFrac * 20);
              defDebuff.kicks      = Math.round(dmgFrac * 30);
              defDebuff.stamina_drain = Math.round(dmgFrac * 15);
            } else if(zone==='body'){
              defDebuff.stamina_drain = Math.max(defDebuff.stamina_drain, Math.round(dmgFrac * 20));
              defDebuff.boxing     = Math.round(dmgFrac * 15);
              defDebuff.upper_td   = Math.round(dmgFrac * 15);
              defDebuff.td_def     = Math.max(defDebuff.td_def, Math.round(dmgFrac * 10));
            } else { // head
              defDebuff.mental     = Math.round(dmgFrac * 20);
              defDebuff.sub_def    = Math.round(dmgFrac * 20);
              defDebuff.head_mov   = Math.round(dmgFrac * 25);
              defDebuff.reaction   = Math.round(dmgFrac * 15);
              defDebuff.move_speed = Math.max(defDebuff.move_speed, Math.round(dmgFrac * 10));
              // Slight stamina on heavy head damage
              defDebuff.stamina_drain = Math.max(defDebuff.stamina_drain, Math.round(dmgFrac * 8));
              // Track whether last damaging head strike was ground
              if(fAtk){ oLastHeadHitGround = isGroundPosition; }
              else     { fLastHeadHitGround = isGroundPosition; }
            }

            // ── Cuts (head zone only) ─────────────────────────────────────────
            const isElbow       = action.includes('elbow') && !action.includes('ground');
            const isGroundElbow = isGroundPosition && action.includes('elbow');
            if(zone==='head'){
              const cutLvl = tryCut(strikeType, isElbow, isGroundElbow, defInjRes);
              if(cutLvl){
                const opened = applyCut(defCutsRef, 'head', cutLvl);
                if(opened) landedStrikes[landedStrikes.length-1].cut = cutLvl;
              }
            }
          } else {
            missedStrikes.push(action);
          }
        });

        if(landedStrikes.length > 0){
          if(fAtk){ localOST=clamp(localOST-rnd(1,4),0,100); }
          else     { localFST=clamp(localFST-rnd(1,4),0,100); }

          // Build log line
          const strikeParts = landedStrikes.map(s=>{
            const cutSuffix = s.cut ? ` ✂ ${cutLabel(s.cut)}` : '';
            return `${s.action} (${s.zone}${cutSuffix})`;
          });
          const landDesc = strikeParts.length===1 ? strikeParts[0]
            : strikeParts.slice(0,-1).join(', ')+', '+strikeParts[strikeParts.length-1];
          const accPct = Math.round(landedStrikes.length/totalAttempts*100);
          const newCutLines = landedStrikes.filter(s=>s.cut)
            .map(s=>`<span style="color:${cutColor(s.cut)};font-size:11px"> ✂ ${def.first} has a ${cutLabel(s.cut)}!</span>`).join('');

          // Loc HP hints — show zones below 35 HP
          const hints = ['head','body','legs'].filter(z=>defLoc[z]<35)
            .map(z=>`${z}:${defLoc[z]}hp`).join(' ');
          const locHint = hints ? ` <span style="color:var(--orange);font-size:10px">[${hints}]</span>` : '';

          logHTML = `<span class="log-hit">${atk.name}: ${landDesc} (${landedStrikes.length}/${totalAttempts}, ${accPct}%)${locHint}</span>${newCutLines}`;

          // ── Location KO/TKO checks ────────────────────────────────────────
          const defLastGnd = fAtk ? oLastHeadHitGround : fLastHeadHitGround;
          if(defLoc.legs <= 0){
            logHTML += `<br><span class="log-finish">🦵 ${def.first.toUpperCase()} CAN'T CONTINUE — leg buckled! TKO!</span>`;
            roundFinished=true; roundWinner=atk; roundMethod='TKO';
          } else if(defLoc.body <= 0){
            logHTML += `<br><span class="log-finish">💢 ${def.first.toUpperCase()} IS BROKEN BY BODY SHOTS! TKO!</span>`;
            roundFinished=true; roundWinner=atk; roundMethod='TKO';
          } else if(defLoc.head <= 0){
            const finMethod = defLastGnd ? 'TKO' : 'KO';
            const finMsg = defLastGnd
              ? `<span class="log-finish">💥 ${atk.name} STOPS ${def.first.toUpperCase()} WITH G&P! TKO!</span>`
              : `<span class="log-finish">💥 ${atk.name} KNOCKS OUT ${def.first.toUpperCase()}! KO!</span>`;
            logHTML += `<br>${finMsg}`;
            roundFinished=true; roundWinner=atk; roundMethod=finMethod;
          } else {
            // Partial head damage KO chance (chin + head HP)
            const defChin = fAtk ? oStat('phys.chin',60) : fStat('phys.chin',60);
            const headFrac = clamp((40 - defLoc.head)/80, 0, 0.4);  // only contributes below 40 HP
            const cutFactor = cutMentalDebuff(defCutsRef)/100 * 0.15;
            const str = fAtk?fStat('phys.strength',60):oStat('phys.strength',60);
            const kochance = clamp((100-defChin)*0.0015 + str/100*0.04 + headFrac*0.08 + cutFactor, 0.002, 0.10);
            if(defLoc.head < 15 && Math.random() < kochance){
              const finMethod = (fAtk ? oLastHeadHitGround : fLastHeadHitGround) ? 'TKO' : 'KO';
              logHTML += `<br><span class="log-finish">💥 ${atk.name} PUTS ${def.first.toUpperCase()} AWAY! ${finMethod}!</span>`;
              roundFinished=true; roundWinner=atk; roundMethod=finMethod;
            }
          }
        } else {
          const evadeAction=pick(['slips','moves outside','rolls under','blocks','steps back','catches on the guard']);
          logHTML=`<span class="log-miss">${def.name} ${evadeAction} (${atk.name} 0/${totalAttempts})</span>`;
        }
      }

      // Clamp all values
      newFST=clamp(newFST,0,100); newOST=clamp(newOST,0,100);

      // ── Round scoring (use total location damage dealt this exchange) ────────
      const exchLocDmg = doGrapple
        ? ((typeof gndDmg!=='undefined') ? gndDmg : 0)
        : landedStrikes.reduce((s,x)=>s+(x.locDmg||0),0);
      if(fAtk){ fDmg += exchLocDmg; } else { oDmg += exchLocDmg; }
      if(doGrapple){
        if(fAtk && exchLocDmg>0) fCtrl += rnd(2,4);
        if(!fAtk && exchLocDmg>0) oCtrl += rnd(2,4);
      }
      if(fAtk) fAgg += 1; else oAgg += 1;

      // ── Per-fight stats accumulation ──────────────────────────────────────
      const atkKey = fAtk ? 'f' : 'o';
      if(!doGrapple){
        fightStats[atkKey].strikes += comboActions.length || 1;
        if(isSigCombo && landedStrikes.length>0) fightStats[atkKey].sigStrikes += landedStrikes.length;
        if(roundFinished) fightStats[atkKey].knockdowns++;
      } else {
        // Grappling attempt
        fightStats[atkKey].tdAttempts++;
        // Count takedown if ground damage was dealt (gndDmg>0 proxy)
        if(fAtk && (typeof gndDmg!=='undefined') && gndDmg>0){
          fightStats['f'].takedowns++;
          fightStats['f'].ctrlSeconds += rnd(20, 60);
        } else if(!fAtk && (typeof gndDmg!=='undefined') && gndDmg>0){
          fightStats['o'].takedowns++;
          fightStats['o'].ctrlSeconds += rnd(20, 60);
        }
      }

      actions.push({logHTML, newFST:localFST, newOST:localOST, roundFinished, roundWinner, roundMethod,
                    fLocSnap:{...fLoc}, oLocSnap:{...oLoc}});
      if(roundFinished){ localFinished=true; localWinner=roundWinner; localMethod=roundMethod; break; }
    }

    // End-of-round drain — cardio + location debuff stamina penalties
    const fCardio=fStat('phys.cardio',65), oCardio=oStat('phys.cardio',65);
    localFST=clamp(localFST-Math.round(rnd(4,10)*(1-fCardio/100))-fDebuff.stamina_drain, 0, 100);
    localOST=clamp(localOST-Math.round(rnd(4,10)*(1-oCardio/100))-oDebuff.stamina_drain, 0, 100);

    // Doctor check for large (level-3) cuts — 12% chance of TKO stoppage per round
    if(!localFinished){
      if(fCuts.head>=3 && Math.random()<0.12){
        localFinished=true; localWinner=o; localMethod='TKO';
        actions.push({logHTML:`<span class="log-finish">🩺 Doctor stops the fight! ${f.first} has an uncontrollable cut. TKO!</span>`, newFST:localFST, newOST:localOST, fLocSnap:{...fLoc}, oLocSnap:{...oLoc}});
      } else if(oCuts.head>=3 && Math.random()<0.12){
        localFinished=true; localWinner=f; localMethod='TKO';
        actions.push({logHTML:`<span class="log-finish">🩺 Doctor stops the fight! ${o.first} has an uncontrollable cut. TKO!</span>`, newFST:localFST, newOST:localOST, fLocSnap:{...fLoc}, oLocSnap:{...oLoc}});
      }
    }
    // End-of-round striking % summary + location + cut status
    const fAccStr = fStrAtt>0 ? `${fStrLand}/${fStrAtt} (${Math.round(fStrLand/fStrAtt*100)}%)` : '0/0';
    const oAccStr = oStrAtt>0 ? `${oStrLand}/${oStrAtt} (${Math.round(oStrLand/oStrAtt*100)}%)` : '0/0';

    // Build cut status strings
    function cutStatusStr(cuts, loc, name){
      const parts = [];
      if(cuts.head>0) parts.push(`<span style="color:${cutColor(cuts.head)}">${name} head: ${cutLabel(cuts.head)}</span>`);
      if(cuts.body>0) parts.push(`<span style="color:${cutColor(cuts.body)}">${name} body: ${cutLabel(cuts.body)}</span>`);
      return parts.join(' · ');
    }
    const fCutStr = cutStatusStr(fCuts, fLoc, f.first);
    const oCutStr = cutStatusStr(oCuts, oLoc, o.first);
    const cutLine = [fCutStr, oCutStr].filter(Boolean).join(' | ');

    // Low leg HP causes stamina bleed
    if(fLoc.legs < 25 && !localFinished) localFST=clamp(localFST-rnd(3,7),0,100);
    if(oLoc.legs < 25 && !localFinished) localOST=clamp(localOST-rnd(3,7),0,100);

    // Location HP display (only show damaged ones)
    function locStr(loc, name){
      const parts=[];
      if(loc.head<50) parts.push(`${name} head:${loc.head}hp`);
      if(loc.body<50) parts.push(`body:${loc.body}hp`);
      if(loc.legs<50) parts.push(`legs:${loc.legs}hp`);
      return parts.join(' ');
    }
    const fLocStr = locStr(fLoc, f.first);
    const oLocStr = locStr(oLoc, o.first);
    const locLine = [fLocStr, oLocStr].filter(Boolean).join(' | ');

    const statLineHTML = `<span style="color:var(--muted);font-size:11px">End R${r} — Strikes: ${f.first} ${fAccStr} · ${o.first} ${oAccStr}${locLine?' | <span style="color:var(--orange)">'+locLine+'</span>':''}${cutLine?' | '+cutLine:''}</span>`;
    actions.push({logHTML: statLineHTML, newFST:localFST, newOST:localOST, fLocSnap:{...fLoc}, oLocSnap:{...oLoc}, isStatLine:true});
    actions.push({logHTML:null, newFST:localFST, newOST:localOST, fLocSnap:{...fLoc}, oLocSnap:{...oLoc},
                  endOfRound:true, roundFinished:localFinished, roundWinner:localWinner, roundMethod:localMethod});
    // Save round scorecard (use loc HP averages as proxy for damage taken)
    const fLocAvg = Math.round((fLoc.head+fLoc.body+fLoc.legs)/3);
    const oLocAvg = Math.round((oLoc.head+oLoc.body+oLoc.legs)/3);
    roundScores.push({r, fDmg, oDmg, fCtrl, oCtrl, fAgg, oAgg,
                      fHPDrop: 100-fLocAvg, oHPDrop: 100-oLocAvg,
                      fST: localFST, oST: localOST});
    return {actions, finished:localFinished, winner:localWinner, method:localMethod};
  }

  // Judge a single round. Returns an object:
  //   { winner: 'f'|'o'|'draw', score: '10-9'|'10-8'|'10-10', dominant: bool }
  // 10-8 criteria (ANY one triggers it):
  //   - Winner's damage output is >= 3× the loser's damage output
  //   - Winner dealt >= 35 HP damage AND loser dealt <= 8 HP damage
  //   - A knockdown was scored (approximated: loser HP dropped below 20 at any point)
  //   - Winner controlled over 80% of the round (ctrl metric dominance)
  function judgeRound(rs){
    const fScore = rs.fDmg*0.6 + rs.fCtrl*0.2 + rs.fAgg*0.2;
    const oScore = rs.oDmg*0.6 + rs.oCtrl*0.2 + rs.oAgg*0.2;
    const diff = fScore - oScore;
    const totalScore = fScore + oScore;

    // Too close to call — 10-10
    if(Math.abs(diff) < 0.5) return {winner:'draw', score:'10-10', dominant:false};

    const winnerDmg  = diff>0 ? rs.fDmg : rs.oDmg;
    const loserDmg   = diff>0 ? rs.oDmg : rs.fDmg;
    const winnerCtrl = diff>0 ? rs.fCtrl : rs.oCtrl;
    const loserCtrl  = diff>0 ? rs.oCtrl : rs.fCtrl;
    const loserHPDrop= diff>0 ? rs.oHPDrop : rs.fHPDrop;  // HP the loser bled this round
    const loserST    = diff>0 ? rs.oST : rs.fST;          // loser's remaining stamina

    // 10-8 checks — STRICT criteria, should be rare (knockdown or near-finish level)
    let is10_8 = false;
    let reason10_8 = '';
    const dmgRatio = loserDmg > 0 ? winnerDmg/loserDmg : winnerDmg > 8 ? 99 : 0;

    // Criteria are now cumulative — need MULTIPLE indicators, not just one
    let dominancePoints = 0;
    if(dmgRatio >= 4)           dominancePoints++;  // raised from 3x to 4x
    if(winnerDmg >= 45 && loserDmg <= 6) dominancePoints++; // raised thresholds
    if(loserHPDrop >= 35 && loserST <= 20) dominancePoints++; // deeper hurt + more gassed
    if(winnerCtrl >= 8 && loserCtrl === 0 && winnerDmg > loserDmg*3) dominancePoints++; // raised ctrl
    if(Math.abs(diff) > totalScore * 0.75 && totalScore > 8) dominancePoints++; // raised to 75%

    if(dominancePoints >= 2){
      // Need at least 2 dominance indicators for 10-8
      is10_8 = true;
      if(loserHPDrop >= 35) reason10_8 = 'Fighter hurt badly — near finish';
      else if(dmgRatio >= 4) reason10_8 = 'Complete striking domination';
      else if(winnerCtrl >= 8) reason10_8 = 'Total grappling control with damage';
      else reason10_8 = 'Dominant performance across all categories';
    }

    const winner = diff>0 ? 'f' : 'o';
    return {winner, score: is10_8 ? '10-8' : '10-9', dominant: is10_8, reason: reason10_8};
  }

  // Title fights and main events = 5 rounds; others = 3
  const isTitleOrMain = G.pendingFight?.isTitleFight || G.pendingFight?.isMainEvent;
  const MAX_ROUNDS = isTitleOrMain ? 5 : 3;

  // Collect all rounds upfront
  // Between rounds, 15% of damage/stamina loss carries over (slow recovery)
  const RECOVERY_PENALTY = 0.15;
  const allRoundData = [];
  let tempFST=fST, tempOST=oST;
  for(let r=1;r<=MAX_ROUNDS;r++){
    fST=tempFST; oST=tempOST;
    const rd = collectRoundActions(r);
    allRoundData.push({r, rd});
    if(rd.finished){ break; }
    // Apply end state — 15% of stamina loss carries over (loc HP damage is permanent)
    const last = rd.actions[rd.actions.length-1];
    const fSTLost = 100 - last.newFST;
    const oSTLost = 100 - last.newOST;
    tempFST = clamp(last.newFST + fSTLost*(1-RECOVERY_PENALTY), 0, 100);
    tempOST = clamp(last.newOST + oSTLost*(1-RECOVERY_PENALTY), 0, 100);
  }

  // Determine final result
  const lastRound = allRoundData[allRoundData.length-1];
  if(lastRound.rd.finished){
    winner=lastRound.rd.winner; method=lastRound.rd.method; finishRound=lastRound.r;
  } else {
    // Per-round scorecard decision
    finishRound=MAX_ROUNDS;
    let fRoundsWon=0, oRoundsWon=0, drawRounds=0;
    const cardLines = [];
    // Tally rounds per judge — each judge may disagree on close rounds (Split Decision simulation)
    // We run 3 virtual judges, each with slight random noise on their scoring
    function tallyForJudge(noise){
      let fTotal=0, oTotal=0;
      const lines=[];
      roundScores.forEach(rs=>{
        const jrs = {...rs,
          fDmg: rs.fDmg*(1+noise*(Math.random()-0.5)),
          oDmg: rs.oDmg*(1+noise*(Math.random()-0.5)),
        };
        const {winner:v, score, dominant} = judgeRound(jrs);
        if(v==='f'){
          fTotal+=10; oTotal+=(score==='10-8'?8:9);
        } else if(v==='o'){
          oTotal+=10; fTotal+=(score==='10-8'?8:9);
        } else {
          fTotal+=10; oTotal+=10;
        }
        lines.push({r:rs.r, winner:v, score, dominant});
      });
      return {fTotal, oTotal, lines};
    }
    const j1 = tallyForJudge(0);
    const j2 = tallyForJudge(0.15);
    const j3 = tallyForJudge(0.15);
    const j1w = j1.fTotal>=j1.oTotal?'f':'o';
    const j2w = j2.fTotal>=j2.oTotal?'f':'o';
    const j3w = j3.fTotal>=j3.oTotal?'f':'o';

    // Determine overall winner
    const fJudges = [j1w,j2w,j3w].filter(x=>x==='f').length;
    const oJudges = [j1w,j2w,j3w].filter(x=>x==='o').length;
    winner = fJudges>=oJudges ? f : o;

    // Decision type
    const winnerJudges = winner===f ? fJudges : oJudges;
    if(winnerJudges===3) method='Unanimous Decision';
    else if(winnerJudges===2) method='Split Decision';
    else method='Majority Decision'; // shouldn't happen but safety net

    // Build "Judge 1: 30-27, Judge 2: 29-28, Judge 3: 29-28" scoreline
    function judgeScore(j, winnerIsF){
      return winnerIsF
        ? `${j.fTotal}-${j.oTotal}`
        : `${j.oTotal}-${j.fTotal}`;
    }
    const winnerIsF = winner.id===f.id;
    const scoreline = `${judgeScore(j1,winnerIsF)} ${judgeScore(j2,winnerIsF)} ${judgeScore(j3,winnerIsF)}`;
    const judgeLines = `Judge 1: ${judgeScore(j1,winnerIsF)} · Judge 2: ${judgeScore(j2,winnerIsF)} · Judge 3: ${judgeScore(j3,winnerIsF)}`;

    const last = lastRound.rd.actions[lastRound.rd.actions.length-1];

    // Show any 10-8 rounds with reasoning in the log
    roundScores.forEach(rs=>{
      const {dominant, reason, winner:rv, score} = judgeRound(rs);
      if(dominant && score==='10-8'){
        const rdWinner = rv==='f'?f:o;
        allRoundData.find(d=>d.r===rs.r)?.rd.actions.push({
          logHTML:`<span style="color:var(--orange);font-size:12px">⚡ Round ${rs.r} scored 10-8 for ${rdWinner.first} — ${reason}</span>`,
          newFST:last.newFST, newOST:last.newOST
        });
      }
    });

    allRoundData[allRoundData.length-1].rd.actions.push({
      logHTML:`<div style="margin:4px 0;padding:6px 8px;background:var(--bg3);border-radius:3px;border-left:3px solid var(--gold)">
        <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:3px">📋 ${method.toUpperCase()}</div>
        <div style="font-size:12px;font-weight:700;color:var(--text)">${winner.name} wins</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${judgeLines}</div>
      </div>`,
      newFST:last.newFST, newOST:last.newOST
    });
  }

  // Playback with ACTION_DELAY between each action, ROUND_DELAY between rounds
  let playbackDelay = 0;
  let actionCount = 0;
  allRoundData.forEach(({r, rd})=>{
    rd.actions.forEach((a,idx)=>{
      setTimeout(()=>{
        if(a.logHTML) logLine('<div>'+a.logHTML+'</div>');
        // Restore location HP snapshot for bar display
        if(a.fLocSnap){ fLoc.head=a.fLocSnap.head; fLoc.body=a.fLocSnap.body; fLoc.legs=a.fLocSnap.legs; }
        if(a.oLocSnap){ oLoc.head=a.oLocSnap.head; oLoc.body=a.oLocSnap.body; oLoc.legs=a.oLocSnap.legs; }
        if(a.newFST!==undefined) fST=a.newFST;
        if(a.newOST!==undefined) oST=a.newOST;
        updateBars();
        round=r;
        if(a.endOfRound){
          const rn=document.getElementById('round-num'); if(rn) rn.textContent=r;
        }
      }, playbackDelay);
      playbackDelay += a.endOfRound ? ACTION_DELAY*3 : ACTION_DELAY;
    });
    playbackDelay += ROUND_DELAY;
  });

  // Stash stats + round log for histEntry
  G._lastFightStats = fightStats;
  G._lastRoundLog = allRoundData.map(({r, rd})=>({
    r,
    actions: rd.actions.filter(a=>a.logHTML).map(a=>({html:a.logHTML})),
    scorecard: roundScores.find(rs=>rs.r===r) || null,
    finished: rd.finished,
    winner: rd.winner ? rd.winner.name : null,
    method: rd.method || null,
  }));

  // End fight after all playback (pass loc avg as condition proxy)
  setTimeout(()=>endFight(winner, method, finishRound, purse,
    Math.round((fLoc.head+fLoc.body+fLoc.legs)/3),
    Math.round((oLoc.head+oLoc.body+oLoc.legs)/3)),
    playbackDelay+500);
}

// ═════════════════════════════════════════════════════════════════════════════
// ██████████████████████████████████████████████████████████████████████████████
// ██  COMBAT ENGINE — SECTION 4: FIGHT RESULT & RANKING                      ██
// ██  endFight · applyFightResultToRankings · updateRankingsAfterFight        ██
// ██  initRankScore · recentlyFought · fightRecord                            ██
// ██████████████████████████████████████████████████████████████████████████████
// ═════════════════════════════════════════════════════════════════════════════

function endFight(winner, method, round, purse){
  const {fighter:f, opponent:o} = G.pendingFight;
  const playerWon = winner.id===f.id;
  // Use G._lastLocHP for condition calc (set just before endFight is called)
  const fLocEnd = G._lastLocHP ? G._lastLocHP.f : {head:50,body:50,legs:50};
  const oLocEnd = G._lastLocHP ? G._lastLocHP.o : {head:50,body:50,legs:50};
  const fCondHP = Math.round((fLocEnd.head+fLocEnd.body+fLocEnd.legs)/3);
  const oCondHP = Math.round((oLocEnd.head+oLocEnd.body+oLocEnd.legs)/3);

  if(playerWon){
    f.wins++; o.losses++;
    G.totalWins++;
    G.money += purse;
    G.rep = clamp(G.rep + rnd(3,8), 0, 100);
    f.condition = clamp(Math.round(fCondHP*0.8), 20, 100);
    if(method==='KO'||method==='TKO') f.koWins=(f.koWins||0)+1;
    else if(method==='Submission') f.subWins=(f.subWins||0)+1;
    else f.decWins=(f.decWins||0)+1;
    G.consecutiveLosses[f.id] = 0;
    const histEntry = {
      week:G.week, opponent:o.name, opponentId:o.id, result:'W', method, round:round, purse,
      stats: G._lastFightStats ? {...G._lastFightStats.f} : null,
      oppStats: G._lastFightStats ? {...G._lastFightStats.o} : null,
      roundLog: G._lastRoundLog || [],
    };
    if(!f.fightHistory) f.fightHistory=[];
    f.fightHistory.unshift(histEntry);
    addNews(`${f.name} def. ${o.name} by ${method} (R${round}) — Purse: ${fmtMoney(purse)}`, G.week);
    applyFightResultToRankings(f.id, o.id, true, method, G.pendingFight?.isTitleFight, f.division);
  } else {
    f.losses++; o.wins++;
    if(method==='KO'||method==='TKO') o.koWins=(o.koWins||0)+1;
    else if(method==='Submission')    o.subWins=(o.subWins||0)+1;
    else                              o.decWins=(o.decWins||0)+1;
    G.totalLosses++;
    G.money -= Math.round(purse*0.3);
    G.rep = clamp(G.rep - rnd(2,5), 0, 100);
    f.condition = clamp(Math.round(oCondHP*0.6), 10, 80);
    G.consecutiveLosses[f.id] = (G.consecutiveLosses[f.id]||0)+1;
    const histEntryL = {
      week:G.week, opponent:o.name, opponentId:o.id, result:'L', method, round:round, purse:0,
      stats: G._lastFightStats ? {...G._lastFightStats.f} : null,
      oppStats: G._lastFightStats ? {...G._lastFightStats.o} : null,
      roundLog: G._lastRoundLog || [],
    };
    if(!f.fightHistory) f.fightHistory=[];
    f.fightHistory.unshift(histEntryL);
    addNews(`${f.name} lost to ${o.name} by ${method} (R${round})`, G.week);
    applyFightResultToRankings(f.id, o.id, false, method, G.pendingFight?.isTitleFight, f.division);
  }

  // Update fighter rating and popularity
  if(f.stats){ f.rating=computeRating(f.stats); const pl=getPillarScores(f); f.striking=pl.striking; f.wrestling=pl.grappling; f.cardio=f.stats.phys.cardio; f.chin=f.stats.phys.chin; f.speed=Math.round(avg2(f.stats.phys.hand_speed,f.stats.phys.move_speed)); f.power=f.stats.phys.strength; f.bjj=Math.round(avg2(f.stats.grap.sub_off.chokes,f.stats.grap.sub_off.joint_locks,f.stats.grap.sub_off.leg_locks)); }
  else { f.rating = Math.round((f.striking+f.wrestling+f.bjj+f.chin+f.cardio+f.speed+f.power)/7); }
  // Popularity update for watched fight
  const popType = playerWon
    ? (method==='KO'||method==='TKO'?'finish_ko':method==='Submission'?'finish_sub':'decision')
    : (method==='KO'||method==='TKO'?'loss_ko':'loss');
  applyPopularityEvent(playerWon?f:o, popType);
  if(!playerWon) applyPopularityEvent(o, 'finish_ko'); // opponent gains too

  // Show result modal
  const rc = document.getElementById('fight-result-content');
  rc.innerHTML = `
    <div class="result-title ${playerWon?'result-win':'result-loss'}">${playerWon?'VICTORY':'DEFEAT'}</div>
    <div style="font-family:'Bebas Neue';font-size:22px;margin-bottom:4px">${f.name} vs ${o.name}</div>
    <div class="result-method">${winner.name} wins by ${method} · Round ${round}</div>
    ${playerWon?`<div style="margin-top:16px;color:var(--gold);font-family:'Barlow Condensed';font-size:20px">+${fmtMoney(purse)} earned</div>`:''}
    <div style="margin-top:12px;font-size:13px;color:var(--muted)">${f.name} condition: ${f.condition}%</div>`;

  // Mark result on the fight card — snapshot pre-fight ranks first
  if(G.pendingFight && G.pendingFight.eventId){
    const evt = G.schedule.find(e=>e.id===G.pendingFight.eventId);
    if(evt){
      const fi = evt.fights.find(fi=>fi.fighterId===G.pendingFight.fighterId);
      if(fi){
        fi.winnerId  = winner.id;
        fi.result    = playerWon?'W':'L';
        fi.method    = method;
        fi.round     = round;
      }
    }
  }
  // Build context-aware action buttons in result modal
  const resultActions = document.getElementById('fight-result-actions');
  if(resultActions){
    const evtId = G.pendingFight ? G.pendingFight.eventId : null;
    const pendingEvts = _weekCardEvts && _weekCardEvts.length > 0;
    let btns = '';

    if(evtId){
      // Count remaining watchable fights on this event
      const evt = G.schedule.find(e=>e.id===evtId);
      const remaining = evt ? (evt.fights||[]).filter(fi=>!fi.result) : [];
      const nextWatchable = remaining.find(fi=>!!G.roster.find(r=>r.id===fi.fighterId)||!!G.roster.find(r=>r.id===fi.opponentId));

      if(nextWatchable){
        btns += `<button class="btn btn-gold" onclick="closeModal('fight-result-modal');watchOneFight('${evtId}','${nextWatchable.fighterId}')">Watch Next ▶</button>`;
      }
      if(remaining.length > 0){
        btns += `<button class="btn btn-ghost" onclick="closeModal('fight-result-modal');skipAllOnEvent('${evtId}')">Skip Remaining</button>`;
      }
    }

    if(pendingEvts){
      btns += `<button class="btn btn-ghost" onclick="closeModal('fight-result-modal');reopenWeekCard()">Back to Card</button>`;
    }

    if(!btns){
      btns = `<button class="btn btn-gold" onclick="closeModal('fight-result-modal');renderAll()">Continue</button>`;
    }
    resultActions.innerHTML = btns;
  }

  document.getElementById('fight-result-modal').classList.add('open');
  G.pendingFight = null;
  renderAll();
  // Check for autocut conditions after fight
  setTimeout(()=>{
    const flagged = checkAutoCuts();
    if(flagged.length > 0) showAutoCutModal(flagged);
  }, 400);
}

// Re-open the week card modal after returning from a watched fight
function reopenWeekCard(){
  if(_weekCardEvts && _weekCardEvts.length>0){
    openWeekCardModal(_weekCardEvts);
  } else {
    // Fall back to finding this week's events
    const thisWeekEvts = G.schedule.filter(e=>e.week===G.week && (e.fights||[]).length>0);
    if(thisWeekEvts.length>0) openWeekCardModal(thisWeekEvts);
    else renderAll();
  }
}

// Skip all remaining fights on a specific event
function skipAllOnEvent(evtId){
  const evt = G.schedule.find(e=>e.id===evtId);
  if(!evt) return;
  const allPool = [...G.roster,...G.opponents,...G.freeAgents,...G.prospects];
  (evt.fights||[]).filter(fi=>!fi.result).forEach(fi=>autoResolveFight(fi, allPool));
  reopenWeekCard();
  setTimeout(()=>{ const fl=checkAutoCuts(); if(fl.length>0) showAutoCutModal(fl); }, 150);
}

// ===================== ORGANIZATION =====================
window._orgSort = 'division';
window._orgView = 'all'; // 'all' | 'mine'

function cycleOrgSort(){
  const sorts = ['division','rating','record'];
  const idx = sorts.indexOf(window._orgSort);
  window._orgSort = sorts[(idx+1)%sorts.length];
  const labels = {division:'Weight Class', rating:'Rating', record:'Record'};
  const el = document.getElementById('org-sort-label');
  if(el) el.textContent = labels[window._orgSort];
  renderOrganization();
}

function renderOrganization(){
  const grid = document.getElementById('org-division-grid');
  const badges = document.getElementById('org-summary-badges');
  if(!grid) return;

  const sort = window._orgSort || 'division';

  // We show ALL fighters: your roster + world-ranked opponents
  // World rankings per division capped at 8 (positive record only)
  const myFighters = G.roster;
  const allOpponents = G.opponents;

  // Build per-division view: ranked fighters (from opponents) + your fighters
  const summary = {
    myTotal: myFighters.length,
    ranked: 0,
    atRisk: 0,
    onFire: 0,
    champs: 0,
    scheduled: 0,
  };

  G.schedule.forEach(e=>(e.fights||[]).forEach(fi=>{
    if(myFighters.find(r=>r.id===fi.fighterId)) summary.scheduled++;
  }));

  let html = '';

  if(sort !== 'division'){
    // Flat view: all fighters combined, sorted
    const combined = [
      ...myFighters.map(f=>({...f, _mine:true})),
      ...allOpponents.map(f=>({...f, _mine:false}))
    ];
    const sorted = sort==='rating'
      ? combined.sort((a,b)=>b.rating-a.rating)
      : combined.sort((a,b)=>{
          const ra=a.wins/(a.losses||1), rb=b.wins/(b.losses||1);
          return rb-ra || b.wins-a.wins;
        });
    html = buildOrgTable(sorted, summary, true);
  } else {
    // Division-grouped view — default: Ranked Top 8 + Unranked NR (next 20)
    DIVISIONS.forEach(div=>{
      const mine = myFighters.filter(f=>f.division===div).sort((a,b)=>b.rating-a.rating);
      const ranked10 = getRankableFighters(div); // top 10, positive record, sorted by score
      const ranked10ids = new Set(ranked10.map(f=>f.id));

      // Unranked: positive record but NOT in top 8, up to 20, sorted by rating
      const unranked20 = allOpponents
        .filter(f=>f.division===div && f.wins>f.losses && !ranked10ids.has(f.id))
        .sort((a,b)=>b.rating-a.rating)
        .slice(0,20);
      const unranked20ids = new Set(unranked20.map(f=>f.id));

      if(mine.length===0 && ranked10.length===0 && unranked20.length===0) return;

      const divWeight = DIV_WEIGHTS[div]||'';
      const champName = ranked10.length>0 ? ranked10[0].name : null;

      html += `<div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border-radius:4px 4px 0 0;border:1px solid var(--border);border-bottom:none">
          <span style="font-family:'Bebas Neue';font-size:22px;color:var(--gold)">${div}</span>
          <span style="font-size:12px;color:var(--muted)">${divWeight}</span>
          ${champName?`<span style="font-size:11px;color:var(--gold);margin-left:8px">🏆 ${champName}</span>`:''}
          <span style="margin-left:auto;font-size:11px;color:var(--muted)">${mine.length} signed · ${ranked10.length} ranked · ${unranked20.length} NR</span>
        </div>
        <div style="border:1px solid var(--border);border-radius:0 0 4px 4px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--bg4)">
                <th style="${TH}width:44px;text-align:center">Rank</th>
                <th style="${TH}">Fighter</th>
                <th style="${TH}text-align:center">Record</th>
                <th style="${TH}text-align:center">Rtg</th>
                <th style="${TH}">Style</th>
                <th style="${TH}text-align:center">Cond</th>
                <th style="${TH}text-align:center">Status</th>
                <th style="${TH}"></th>
              </tr>
            </thead>
            <tbody>`;

      // ── RANKED TOP 8 ─────────────────────────────────────────────────────
      html += `<tr><td colspan="8" style="padding:4px 14px;background:var(--bg3);border-bottom:1px solid var(--border)">
        <span style="font-size:10px;color:var(--gold);font-family:'Barlow Condensed';font-weight:700;letter-spacing:2px;text-transform:uppercase">Ranked — Top 8</span>
      </td></tr>`;
      if(ranked10.length===0){
        html += `<tr><td colspan="8" style="padding:10px;text-align:center;color:var(--muted);font-size:12px">No ranked fighters in this division</td></tr>`;
      } else {
        ranked10.forEach((f,i)=>{
          const isMineFlag = !!mine.find(m=>m.id===f.id);
          html += buildOrgRow(f, isMineFlag, i+1, summary, isMineFlag);
        });
      }

      // ── UNRANKED NR (next 20) ─────────────────────────────────────────────
      html += `<tr><td colspan="8" style="padding:4px 14px;background:var(--bg3);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
        <span style="font-size:10px;color:var(--muted);font-family:'Barlow Condensed';font-weight:700;letter-spacing:2px;text-transform:uppercase">Unranked — NR (${unranked20.length} shown)</span>
      </td></tr>`;
      if(unranked20.length===0){
        html += `<tr><td colspan="8" style="padding:10px;text-align:center;color:var(--muted);font-size:12px">No unranked fighters in this division</td></tr>`;
      } else {
        unranked20.forEach(f=>{
          const isMineFlag = !!mine.find(m=>m.id===f.id);
          html += buildOrgRow(f, isMineFlag, null, summary, isMineFlag);
        });
      }

      // ── YOUR SIGNED FIGHTERS not appearing above ──────────────────────────
      const extraMine = mine.filter(f=>!ranked10ids.has(f.id)&&!unranked20ids.has(f.id));
      if(extraMine.length>0){
        html += `<tr><td colspan="8" style="padding:4px 14px;background:var(--bg3);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
          <span style="font-size:10px;color:var(--gold);font-family:'Barlow Condensed';font-weight:700;letter-spacing:2px;text-transform:uppercase">Your Other Signed Fighters</span>
        </td></tr>`;
        extraMine.forEach(f=>{
          html += buildOrgRow(f, true, null, summary, true);
        });
      }

      html += `</tbody></table></div></div>`;
    });

    if(html==='') html = `<div style="color:var(--muted);padding:40px;text-align:center;font-size:13px">
      No fighters available. Use <strong>+ Sign Fighter</strong> to recruit.
    </div>`;
  }

  grid.innerHTML = html;

  if(badges) badges.innerHTML = `
    <span class="badge badge-gold">${summary.myTotal} Signed</span>
    <span class="badge badge-blue">${summary.ranked} World-Ranked</span>
    ${summary.champs>0?`<span class="badge badge-gold">${summary.champs} 🏆 Champ${summary.champs>1?'s':''}</span>`:''}
    ${summary.scheduled>0?`<span class="badge badge-blue">${summary.scheduled} Booked</span>`:''}
    ${summary.onFire>0?`<span class="badge badge-green">${summary.onFire} Hot Streak</span>`:''}
    ${summary.atRisk>0?`<span class="badge badge-red">${summary.atRisk} At Risk</span>`:''}`;
}

const TH = "padding:7px 10px;text-align:left;font-family:'Barlow Condensed';font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);font-weight:600;border-bottom:1px solid var(--border);white-space:nowrap;";

function buildOrgRow(f, isMine, rankNum, summary, showCut){
  const consec = G.consecutiveLosses[f.id]||0;
  const total = f.wins+f.losses;
  const ratio = total>0 ? f.wins/(f.losses||1) : 999;
  const atRisk = isMine && ((ratio<0.5&&total>=4)||(consec>=5));
  const onFire = isMine && consec===0 && f.wins>=3 && ratio>=2.5;
  if(atRisk && summary) summary.atRisk++;
  if(onFire && summary) summary.onFire++;
  if(isMine && f.isChamp && summary) summary.champs++;
  const condColor = f.condition>70?'var(--green)':f.condition>40?'var(--orange)':'var(--red-bright)';

  // Rank cell
  const rankCell = rankNum
    ? `<span style="font-family:'Bebas Neue';font-size:16px;color:${rankNum<=4?'var(--gold)':'var(--muted)'}">${rankNum===1?'C':'#'+(rankNum-1)}</span>${rankNum===1?'🏆':''}`
    : `<span style="font-size:10px;color:var(--muted)">NR</span>`;

  // Status cell
  const scheduledFight = G.schedule.reduce((acc,e)=>{
    const fi = (e.fights||[]).find(x=>x.fighterId===f.id);
    return fi ? {evt:e,fi} : acc;
  }, null);
  let statusHTML = '';
  if(scheduledFight){
    statusHTML = `<span style="font-size:10px;color:var(--gold);font-weight:600;font-family:'Barlow Condensed'">WK ${scheduledFight.evt.week}</span>`;
  } else if(atRisk){
    statusHTML = `<span class="cut-flag" style="font-size:9px">AT RISK</span>`;
  } else if(onFire){
    statusHTML = `<span class="streak-badge streak-win" style="font-size:9px">HOT</span>`;
  } else if(consec>0){
    statusHTML = `<span class="streak-badge streak-loss" style="font-size:9px">L${consec}</span>`;
  }

  const rowBg = atRisk?'background:#150800':onFire?'background:#051505':isMine?'background:var(--bg2)':'background:transparent';
  const leftBorder = isMine ? 'border-left:2px solid var(--gold-dim)' : '';

  return `<tr style="border-bottom:1px solid var(--border);${rowBg};${leftBorder}">
    <td style="padding:7px 10px;text-align:center">${rankCell}</td>
    <td style="padding:7px 10px;cursor:pointer" onclick="showFighterProfile('${f.id}')">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:26px;height:26px;border-radius:50%;background:${f.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:9px;flex-shrink:0">${f.initials}</div>
        <div>
          <div style="font-size:13px;font-weight:${isMine?'700':'500'}">${f.name} ${f.nationality?.flag||''} ${f.isChamp?'🏆':''}</div>
          ${f.nickname?`<div style="font-size:10px;color:var(--gold);font-style:italic">${f.nickname}</div>`:''}
          <div style="font-size:10px;color:var(--muted)">${f.stance||'Orthodox'} · Age ${f.age}${isMine?'':' · World Pool'}</div>
        </div>
      </div>
    </td>
    <td style="padding:7px 10px;text-align:center">
      <div style="font-family:'Barlow Condensed';font-size:14px;font-weight:700">${f.wins}-${f.losses}</div>
      <div style="font-size:9px;color:var(--muted)">${total>0?Math.round(f.wins/total*100)+'%':'-'}</div>
    </td>
    <td style="padding:7px 10px;text-align:center">
      <span style="font-family:'Bebas Neue';font-size:19px;color:${isMine?'var(--gold)':'var(--text)'}">${f.rating}</span>
    </td>
    <td style="padding:7px 10px;font-size:11px;color:var(--muted)">${f.style}</td>
    <td style="padding:7px 10px;text-align:center">
      ${isMine ? `<div style="background:var(--bg4);height:4px;border-radius:2px;overflow:hidden;width:44px;margin:0 auto 2px"><div style="width:${f.condition}%;height:100%;background:${condColor};border-radius:2px"></div></div><div style="font-size:9px;color:${condColor}">${f.condition}%</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}
    </td>
    <td style="padding:7px 10px;text-align:center">${statusHTML}</td>
    <td style="padding:7px 10px;text-align:right">
      ${isMine && showCut ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px" onclick="confirmCut('${f.id}')">Cut</button>` : (isMine?'':`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px" onclick="showFighterProfile('${f.id}')">View</button>`)}
    </td>
  </tr>`;
}

function buildOrgTable(fighters, summary, showDiv){
  if(fighters.length===0) return '';
  let html = `<div style="border:1px solid var(--border);border-radius:4px;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg4)">
        <th style="${TH}width:40px;text-align:center">Rank</th>
        <th style="${TH}">Fighter</th>
        ${showDiv?`<th style="${TH}">Division</th>`:''}
        <th style="${TH}text-align:center">Record</th>
        <th style="${TH}text-align:center">Rtg</th>
        <th style="${TH}">Style</th>
        <th style="${TH}text-align:center">Cond</th>
        <th style="${TH}text-align:center">Status</th>
        <th style="${TH}"></th>
      </tr></thead>
      <tbody>`;
  fighters.forEach(f=>{
    const isMine = f._mine !== undefined ? f._mine : !!G.roster.find(r=>r.id===f.id);
    const divRank = getRankableFighters(f.division);
    const worldRank = divRank.findIndex(r=>r.id===f.id);
    const rankNum = worldRank>=0 ? worldRank+1 : null;
    html += buildOrgRow(f, isMine, rankNum, summary, true);
  });
  html += '</tbody></table></div>';
  return html;
}

// ===================== RANKINGS =====================
function getRankableFighters(div){
  // Deduplicate by ID (promoted roster fighters appear in both pools)
  const seen = new Set();
  const all = [...G.roster, ...G.opponents].filter(f=>{
    if(seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  return all
    .filter(f=>f.division===div && f.wins>f.losses && f.wins>0)
    .sort((a,b)=>{
      // Sort by rankScore (set by updateRankings), then rating, then W/L
      const aScore = a._rankScore||0, bScore = b._rankScore||0;
      if(bScore!==aScore) return bScore-aScore;
      if(b.rating!==a.rating) return b.rating-a.rating;
      return (b.wins/(b.losses||1))-(a.wins/(a.losses||1));
    })
    .slice(0,10);
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC RANKING SYSTEM
// After each fight: check relative ranks, adjust _rankScore accordingly.
// Rules:
//   win vs higher-ranked → rise above them
//   loss to higher-ranked → stay
//   win vs lower-ranked → stay
//   loss to lower-ranked → drop below them
//   championship fight: winner becomes champ, loser becomes #2
//   past matchup protection: if A beat B recently, B cannot leapfrog A via other wins
// ─────────────────────────────────────────────────────────────────────────────
function initRankScore(f){
  if(f._rankScore === undefined) f._rankScore = f.rating * 0.5 + f.wins * 2 - f.losses * 1.5;
}

function updateRankingsAfterFight(winner, loser, isTitleFight, div){
  // Ensure both have rank scores
  initRankScore(winner);
  initRankScore(loser);

  // Get all fighters in division for context
  const allInDiv = [...new Map([...G.roster,...G.opponents].filter(f=>f.division===div).map(f=>[f.id,f])).values()];
  allInDiv.forEach(initRankScore);

  // Snapshot ranks BEFORE changes for news reporting
  const getRank = f => getRankableFighters(div).findIndex(r=>r.id===f.id) + 1; // 1-based, 0 = NR
  const winnerRankBefore = getRank(winner);
  const loserRankBefore  = getRank(loser);

  const winnerScore = winner._rankScore;
  const loserScore  = loser._rankScore;

  if(isTitleFight){
    const topScores = allInDiv.map(f=>f._rankScore).sort((a,b)=>b-a);
    const top1 = topScores[0]||100, top2 = topScores[1]||80;
    winner._rankScore = Math.max(top1, winner._rankScore) + 5;
    loser._rankScore  = Math.max(top2, loser._rankScore) > winner._rankScore
      ? winner._rankScore - 0.1
      : Math.max(top2, loser._rankScore);
    allInDiv.forEach(f=>{ if(f.id!==winner.id) f.isChamp=false; });
    winner.isChamp = true;
    addNews(`🏆 ${winner.name} is the NEW ${div} Champion!`, G.week);
  } else if(winnerScore < loserScore){
    const recentLossToThisLoser = (winner.fightHistory||[]).slice(0,4).some(
      h=>h.opponentId===loser.id && h.result==='L'
    );
    if(recentLossToThisLoser){
      winner._rankScore = loserScore + 0.5 + Math.random()*0.5;
      loser._rankScore = Math.max(0, loserScore - 1);
    } else {
      winner._rankScore = loserScore + 0.1 + Math.random()*0.5;
      allInDiv.forEach(prevBeater=>{
        if(prevBeater.id===winner.id||prevBeater.id===loser.id) return;
        initRankScore(prevBeater);
        const prevBeaterBeatWinner = (winner.fightHistory||[]).slice(0,4).some(
          h=>h.opponentId===prevBeater.id && h.result==='L'
        );
        if(!prevBeaterBeatWinner) return;
        if(prevBeater._rankScore >= loserScore) return;
        prevBeater._rankScore = loserScore + 0.05 + Math.random()*0.3;
        loser._rankScore = Math.max(0, loser._rankScore - 1.5);
      });
    }
  } else {
    winner._rankScore += 1.5;
    loser._rankScore = Math.max(0, loser._rankScore - 2);
  }

  // Report ranking changes in the news feed
  if(!isTitleFight){
    const winnerRankAfter = getRank(winner);
    const loserRankAfter  = getRank(loser);
    const divShort = div.split(' ').pop(); // e.g. "Welterweight" → "Welterweight"

    if(winnerRankBefore > 0 && winnerRankAfter > 0 && winnerRankAfter < winnerRankBefore){
      const moved = winnerRankBefore - winnerRankAfter;
      addNews(`📈 ${winner.first} moves up ${moved} spot${moved>1?'s':''} to ${winnerRankAfter===1?'Champion':('#'+(winnerRankAfter-1))} ${div}`, G.week);
    } else if(winnerRankBefore === 0 && winnerRankAfter > 0){
      addNews(`📈 ${winner.first} enters the ${div} rankings at #${winnerRankAfter-1}`, G.week);
    }

    if(loserRankBefore > 0 && loserRankAfter > 0 && loserRankAfter > loserRankBefore){
      const dropped = loserRankAfter - loserRankBefore;
      addNews(`📉 ${loser.first} drops ${dropped} spot${dropped>1?'s':''} to #${loserRankAfter-1} ${div}`, G.week);
    } else if(loserRankBefore > 0 && loserRankAfter === 0){
      addNews(`📉 ${loser.first} falls out of the ${div} rankings`, G.week);
    }
  }
}

function applyFightResultToRankings(fighterId, opponentId, playerWon, method, isTitleFight, div){
  const allPool = [...new Map([...G.roster,...G.opponents,...G.freeAgents].map(f=>[f.id,f])).values()];
  const f1 = allPool.find(f=>f.id===fighterId);
  const f2 = allPool.find(f=>f.id===opponentId);
  if(!f1||!f2) return;
  const winner = playerWon ? f1 : f2;
  const loser  = playerWon ? f2 : f1;
  updateRankingsAfterFight(winner, loser, isTitleFight, div||f1.division||f2.division);
}

// Format rank display: index 0 = C, index 1 = #1, etc.
function fmtRank(idx){ return idx===0 ? 'C' : '#'+idx; }

function renderRankings(){
  const grid = document.getElementById('rankings-grid');
  const filter = document.getElementById('rankings-div-filter')?.value || 'all';
  if(!grid) return;
  const divs = filter==='all' ? DIVISIONS : [filter];
  let html = '';
  divs.forEach(div=>{
    const fighters = getRankableFighters(div);
    const allInDiv = [...G.roster,...G.opponents].filter(f=>f.division===div);
    const unranked = allInDiv.filter(f=>!(f.wins>f.losses&&f.wins>0));
    html += `<div style="margin-bottom:${filter==='all'?'28px':'0'}">
      ${filter==='all'?`<div style="font-family:'Bebas Neue';font-size:18px;color:var(--gold);margin-bottom:8px;padding:6px 10px;background:var(--bg3);border-left:3px solid var(--gold)">${div} <span style="font-size:13px;color:var(--muted);font-family:'Barlow Condensed'">${DIV_WEIGHTS[div]||''}</span></div>`:''}
      <div class="card" style="padding:0;overflow:hidden">
        <table class="rank-table">
          <thead><tr>
            <th style="width:50px">Rank</th>
            <th>Fighter</th>
            <th>Record</th>
            <th>W/L</th>
            <th>Style</th>
            <th>Rtg</th>
            <th>Nat.</th>
          </tr></thead>
          <tbody>`;
    if(fighters.length===0){
      html += `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;font-size:13px">No ranked fighters — need a positive record to rank</td></tr>`;
    } else {
      fighters.forEach((f,i)=>{
        const isMine = !!G.roster.find(r=>r.id===f.id);
        const total = f.wins+f.losses;
        const ratio = f.losses>0?(f.wins/f.losses).toFixed(1):'∞';
        const isChamp = i===0;
        html += `<tr class="${isMine?'my-fighter':''}">
          <td style="text-align:center">
            <span class="rank-num ${i<3?'top3':''}">${fmtRank(i)}</span>
            ${isChamp?'<span class="rank-champ-belt">🏆</span>':''}
          </td>
          <td style="cursor:pointer" onclick="showFighterProfile('${f.id}')">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:28px;height:28px;border-radius:50%;background:${f.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:10px;flex-shrink:0">${f.initials}</div>
              <div>
                <div style="font-weight:600;font-size:13px">${f.name}${isMine?` <span style="font-size:10px;color:var(--gold)">[MINE]</span>`:''}</div>
                ${f.nickname?`<div style="font-size:10px;color:var(--muted);font-style:italic">${f.nickname}</div>`:''}
              </div>
            </div>
          </td>
          <td style="font-family:'Barlow Condensed';font-size:14px;font-weight:700">${f.wins}<span style="color:var(--muted)">-</span>${f.losses}</td>
          <td style="font-size:12px;color:var(--muted)">${ratio}</td>
          <td style="font-size:12px;color:var(--muted)">${f.style}</td>
          <td><span style="font-family:'Bebas Neue';font-size:20px;color:${isMine?'var(--gold)':'var(--text)'}">${f.rating}</span></td>
          <td style="font-size:16px">${f.nationality?.flag||'—'}</td>
        </tr>`;
      });
    }
    html += `</tbody></table>`;
    if(unranked.length>0){
      html += `<div style="padding:8px 12px;border-top:1px solid var(--border);font-size:11px;color:var(--muted)">
        ${unranked.length} unranked (losing/no record): ${unranked.map(f=>`<span style="cursor:pointer;text-decoration:underline" onclick="showFighterProfile('${f.id}')">${f.name} (${f.wins}-${f.losses})</span>`).join(', ')}
      </div>`;
    }
    html += `</div></div>`;
  });
  grid.innerHTML = html || '<div style="color:var(--muted);padding:20px;text-align:center">No divisions found.</div>';
}

// Also update dashboard rankings snapshot
function getDashRankings(){
  const byDiv = {};
  DIVISIONS.forEach(d=>{ byDiv[d] = getRankableFighters(d).slice(0,3); });
  return byDiv;
}

// ===================== PROSPECTS =====================
function renderProspects(){
  const grid = document.getElementById('prospect-grid');
  const filter = document.getElementById('prospect-div-filter')?.value || 'all';
  if(!grid) return;
  const prospects = filter==='all' ? G.prospects : G.prospects.filter(p=>p.division===filter);
  if(prospects.length===0){
    grid.innerHTML = '<div style="color:var(--muted);padding:40px;text-align:center;grid-column:1/-1"><div style="font-size:32px;margin-bottom:8px">🔍</div><div>No prospects scouted yet. Click "Scout New" to find talent.</div></div>';
    return;
  }
  grid.innerHTML = prospects.map(p=>{
    const total = p.wins+p.losses;
    const hypeClass = p.hype==='elite'?'hype-elite':p.hype==='high'?'hype-high':'hype-medium';
    const hypeLabel = p.hype==='elite'?'Elite Prospect':p.hype==='high'?'High Potential':'Promising';
    const alreadySigned = G.roster.find(r=>r.id===p.id);
    return `<div class="prospect-card">
      <div class="prospect-header">
        <div style="width:40px;height:40px;border-radius:50%;background:${p.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:14px;flex-shrink:0">${p.initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed';font-size:15px;font-weight:700">${p.name} ${p.nationality?.flag||''}</div>
          ${p.nickname?`<div style="font-size:10px;color:var(--gold);font-style:italic">${p.nickname}</div>`:''}
          <div style="font-size:11px;color:var(--muted)">${p.division} · Age ${p.age} · ${p.style}</div>
        </div>
        <span class="prospect-hype ${hypeClass}">${hypeLabel}</span>
      </div>
      <div style="padding:12px">
        <div style="display:flex;gap:12px;margin-bottom:10px">
          <div style="flex:1;background:var(--bg3);border-radius:3px;padding:8px;text-align:center">
            <div style="font-family:'Bebas Neue';font-size:22px;color:var(--gold)">${p.wins}-${p.losses}</div>
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Record</div>
          </div>
          <div style="flex:1;background:var(--bg3);border-radius:3px;padding:8px;text-align:center">
            <div style="font-family:'Bebas Neue';font-size:22px;color:var(--text)">${p.rating}</div>
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Rating</div>
          </div>
          <div style="flex:1;background:var(--bg3);border-radius:3px;padding:8px;text-align:center">
            <div style="font-family:'Bebas Neue';font-size:22px;color:#9B59B6">${p.potential||'?'}</div>
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Ceiling</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${total} career fights · ${Math.round(p.wins/total*100)}% win rate</div>
        ${statBar('Striking',p.striking,'#E74C3C')}
        ${statBar('Wrestling',p.wrestling,'#3498DB')}
        ${statBar('BJJ',p.bjj,'#9B59B6')}
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
          <div style="flex:1;font-size:11px;color:var(--gold)">${fmtMoney(p.salary)}/wk</div>
          <button class="btn btn-ghost btn-sm" onclick="showFighterProfile('${p.id}')">Profile</button>
          ${alreadySigned
            ? `<span style="font-size:11px;color:var(--green)">✓ Signed</span>`
            : `<button class="btn btn-gold btn-sm" onclick="signProspect('${p.id}')">Sign</button>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

function signProspect(id){
  const idx = G.prospects.findIndex(p=>p.id===id);
  if(idx===-1) return;
  const p = G.prospects[idx];
  if(!meetsSigningStandard(p)){
    showToast(p.name+' no longer meets signing standards.');
    return;
  }
  p._isProspect = true;  // track that this was signed as a prospect
  G.roster.push(p);
  // Add to opponents so they appear in world rankings immediately
  if(!G.opponents.find(x=>x.id===p.id)) G.opponents.push(p);
  G.prospects.splice(idx,1);
  addNews(`Signed prospect ${p.name} (${p.division}, ${p.wins}-${p.losses}) to ${G.agencyName||'the agency'}`, G.week);
  showToast(p.name+' signed!');
  renderProspects();
  renderAll();
}

// ===================== SCHEDULE =====================
let _schedTab = 'upcoming';

function switchScheduleTab(tab){
  _schedTab = tab;
  const u = document.getElementById('sched-tab-upcoming');
  const p = document.getElementById('sched-tab-past');
  if(u){ u.style.background=tab==='upcoming'?'var(--gold)':'transparent'; u.style.color=tab==='upcoming'?'#000':'var(--muted)'; }
  if(p){ p.style.background=tab==='past'?'var(--gold)':'transparent'; p.style.color=tab==='past'?'#000':'var(--muted)'; }
  renderSchedule();
}

function renderSchedule(){
  const sl = document.getElementById('schedule-list');
  if(!sl) return;
  let events = G.schedule;
  if(_schedTab==='upcoming') events = events.filter(e=>e.week>=G.week).sort((a,b)=>a.week-b.week);
  else events = events.filter(e=>e.week<G.week).sort((a,b)=>b.week-a.week); // past: most recent first

  if(events.length===0){
    sl.innerHTML='<div style="color:var(--muted);padding:30px;text-align:center">No events match this filter.</div>';
    return;
  }

  sl.innerHTML = events.map(e=>{
    const isPast = e.week < G.week;
    const isCurrent = e.week === G.week;
    const typeClass = e.type==='title'?'event-title':e.type==='main'?'event-main':'event-norm';
    const typeLabel = e.type==='title'?'TITLE CARD':e.type==='main'?'MAIN CARD':'FIGHT NIGHT';
    const weekColor = isPast?'var(--muted)':isCurrent?'var(--gold)':'var(--text)';
    const fights = e.fights||[];
    const myFights = fights.filter(fi=>G.roster.find(r=>r.id===fi.fighterId));
    const pendingMine = myFights.filter(fi=>!fi.result);
    const allPool = [...G.roster,...G.opponents,...G.freeAgents];

    // Fight rows — sorted: prelims first, co-mains next, main event / title last
    const displayFights = [...fights].sort((a,b)=>{
      const rank = f=>f.isTitleFight?3:f.isMainEvent?2:f.slot==='co_main'?1:0;
      return rank(a)-rank(b);
    });
    const fightRows = displayFights.map((fi,idx)=>{
      const fighter = allPool.find(r=>r.id===fi.fighterId);
      const opp = allPool.find(r=>r.id===fi.opponentId);
      if(!fighter||!opp) return '';
      const isMine = !!G.roster.find(r=>r.id===fi.fighterId);
      const isTitle = !!fi.isTitleFight;
      const isMainEvt = !!fi.isMainEvent;
      const isMainSlot = fi.slot==='main';
      const slotLabel = isTitle?'🏆 TITLE':isMainEvt?'⭐ MAIN EVENT':fi.slot==='co_main'?'CO-MAIN':'PRELIM';
      const slotColor = isTitle?'var(--gold)':isMainEvt?'#E8A87C':fi.slot==='co_main'?'var(--muted)':'var(--border)';
      const rowBg = isTitle?'#1A1200':isMainEvt?'#160F00':fi.slot==='co_main'?'var(--bg3)':isMine?'#1A1500':'transparent';
      const rowBorder = isTitle?'var(--gold)':isMainEvt?'#6B4C1E':fi.slot==='co_main'?'var(--border)':'var(--border)';
      const resultHTML = fi.result
        ? `<span style="font-size:12px;font-weight:700;color:${fi.result==='W'?'var(--green)':'var(--red-bright)'};min-width:48px;text-align:right">${fi.result==='W'?'WIN':'LOSS'}</span>`
        : (isMine && isCurrent
            ? `<button class="btn btn-gold btn-sm" style="font-size:10px;padding:4px 10px" onclick="loadFightFromCard('${e.id}','${fi.fighterId}')">▶ Fight</button>`
            : isMine
              ? `<span style="font-size:11px;color:var(--gold)">Upcoming</span>`
              : `<span style="font-size:11px;color:var(--muted)">Pending</span>`);
      const cancelBtn = isMine&&!fi.result&&!isPast
        ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 6px" onclick="removeFightFromCard('${e.id}','${fighter.id}')">✕</button>`
        : '';
      // For past fights: use pre-fight snapshot ranks; for upcoming: use current ranks
      let fRank, oRank;
      if(isPast && fi.preRankF !== undefined){
        fRank = fi.preRankF; oRank = fi.preRankO;
      } else {
        fRank = getRankableFighters(fighter.division).findIndex(r=>r.id===fighter.id);
        oRank = getRankableFighters(opp.division).findIndex(r=>r.id===opp.id);
      }
      const fRankStr = fRank>=0 ? ' '+fmtRank(fRank) : '';
      const oRankStr = oRank>=0 ? ' '+fmtRank(oRank) : '';

      // For past fights: highlight winner name and show clear result label
      const fIsWinner = isPast && fi.winnerId === fighter.id;
      const oIsWinner = isPast && fi.winnerId === opp.id;
      const fNameStyle = fIsWinner ? 'color:var(--green);font-weight:700' : isPast&&!fIsWinner&&fi.winnerId?'color:var(--muted)':'';
      const oNameStyle = oIsWinner ? 'color:var(--green);font-weight:700' : isPast&&!oIsWinner&&fi.winnerId?'color:var(--muted)':'';
      const resultBadge = isPast && fi.winnerId
        ? `<div style="text-align:right;min-width:90px">
            <div style="font-size:10px;font-weight:700;color:${fIsWinner?'var(--green)':'var(--red-bright)'}">${fIsWinner?(isMine?'WIN':'W'):(isMine?'LOSS':'L')}</div>
            <div style="font-size:10px;color:var(--muted)">${fi.method||'?'} R${fi.round||'?'}</div>
           </div>`
        : resultHTML;

      return `<div style="display:flex;align-items:center;gap:10px;padding:${isTitle||isMainEvt?'11px':'8px'} 14px;border-top:1px solid ${rowBorder};border-left:3px solid ${slotColor};background:${rowBg}">
        <div style="min-width:58px;text-align:left">
          <div style="font-size:9px;color:${slotColor};font-family:'Barlow Condensed';font-weight:700;letter-spacing:0.5px">${slotLabel}</div>
        </div>
        <div style="width:26px;height:26px;border-radius:50%;background:${fighter.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:9px;flex-shrink:0">${fighter.initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:${isTitle||isMainEvt?'14px':'13px'};font-weight:${isTitle||isMainEvt||isMine?'700':'500'}"><span style="${fNameStyle}">${fighter.name}${fRankStr}</span> <span style="color:var(--muted);font-weight:400">vs</span> <span style="${oNameStyle}">${opp.name}${oRankStr}</span></div>
          <div style="font-size:10px;color:var(--muted)">${fighter.division} · ${fmtMoney(fi.purse)} purse ${isMine?'<span style="color:var(--gold)">[YOUR FIGHTER]</span>':''}</div>
        </div>
        ${resultBadge}
        ${cancelBtn}
      </div>`;
    }).join('');

    const emptyRow = fights.length===0
      ? `<div style="padding:10px 14px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)">No fights booked. <a href="#" onclick="event.preventDefault();openMatchmaking()" style="color:var(--gold);cursor:pointer">Book a fight →</a></div>`
      : '';

    const runCardBtn = pendingMine.length>0 && isCurrent
      ? `<button class="btn btn-gold btn-sm" onclick="loadFightFromCard('${e.id}','${pendingMine[0].fighterId}')">▶ Run Next Fight</button>`
      : '';

    return `<div style="margin-bottom:14px;border:1px solid ${isCurrent?'var(--gold)':'var(--border)'};border-radius:4px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${isPast?'var(--bg3)':isCurrent?'#1A1500':'var(--bg2)'}">
        <div style="font-family:'Bebas Neue';font-size:24px;color:${weekColor};min-width:52px;line-height:1">${isCurrent?'NOW':fmtWeek(e.week).replace(' ','<br>')}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:14px">${e.name}</div>
          <div style="font-size:11px;color:var(--muted)">${fights.length} fight${fights.length!==1?'s':''} · ${isPast?'Completed':isCurrent?'Fight Week':'Upcoming'}</div>
        </div>
        <span class="event-type ${typeClass}">${typeLabel}</span>
        ${runCardBtn}
      </div>
      ${fightRows}${emptyRow}
    </div>`;
  }).join('');
}

function loadFightFromCard(eventId, fighterId){
  const evt = G.schedule.find(e=>e.id===eventId);
  if(!evt) return;
  const fi = (evt.fights||[]).find(f=>f.fighterId===fighterId);
  if(!fi) return;
  // Search ALL pools — not just roster (NPC vs NPC fights use opponents pool)
  const allPool = [...G.roster,...G.opponents,...G.freeAgents,...G.prospects];
  const fighter = allPool.find(r=>r.id===fi.fighterId);
  const opp     = allPool.find(r=>r.id===fi.opponentId);
  if(!fighter||!opp){ showToast('Fighter data missing — pool may need refreshing'); return; }
  G.pendingFight = {fighter, opponent:opp, purse:fi.purse, eventId, fighterId,
    isTitleFight: !!fi.isTitleFight,
    isMainEvent:  !!fi.isMainEvent};
  showPage('fight');
  renderFightPage();
}

// ===================== WEEK ADVANCE =====================
function advanceWeek(){
  // Auto-resolve any unresolved fights from the current week before advancing
  const currentWeekEvts = G.schedule.filter(e=>e.week===G.week && (e.fights||[]).some(fi=>!fi.result));
  if(currentWeekEvts.length>0){
    const allPool = [...G.roster,...G.opponents,...G.freeAgents,...G.prospects];
    // Snapshot current rankings onto each fight before any fight this week runs
    currentWeekEvts.forEach(evt=>{
      (evt.fights||[]).filter(fi=>!fi.result).forEach(fi=>{
        if(fi.preRankF === undefined){
          const _fDiv = fi.division || allPool.find(r=>r.id===fi.fighterId)?.division;
          if(_fDiv){
            const _r = getRankableFighters(_fDiv);
            fi.preRankF = _r.findIndex(r=>r.id===fi.fighterId);
            fi.preRankO = _r.findIndex(r=>r.id===fi.opponentId);
          }
        }
      });
    });
    currentWeekEvts.forEach(evt=>{
      (evt.fights||[]).filter(fi=>!fi.result).forEach(fi=>autoResolveFight(fi, allPool));
    });
    // Close any open week card modal
    closeModal('week-card-modal');
  }

  G.week++;
  // Ensure schedule extends far enough ahead
  extendSchedule();
  // Apply training
  G.roster.forEach(f=>{
    const prog = G.trainingSelections[f.id];
    if(!prog) return;
    const p = TRAINING_PROGRAMS.find(x=>x.id===prog);
    G.money -= p.cost;
    const age = f.age||25;
    const fights = (f.wins||0)+(f.losses||0);
    const inDecline = age >= 34 || fights >= 28;
    const inYouth   = age < 24;
    // Training multiplier based on age
    const trainMult = inYouth ? 1.20 : inDecline ? 0.75 : 1.0;
    const gain = ()=>Math.round(rnd(p.gain[0],p.gain[1]) * trainMult);
    // Physical-specific multiplier for decline (harder to build physicals)
    const physGain = ()=>Math.round(rnd(p.gain[0],p.gain[1]) * (inDecline ? 0.55 : inYouth ? 1.25 : 1.0));
    function bumpStat(obj, keys){
      // Randomly improve 2-4 sub-stats in the group
      const shuffled = [...keys].sort(()=>Math.random()-0.5).slice(0,rnd(2,4));
      shuffled.forEach(k=>{ if(obj[k]!==undefined) obj[k]=clamp(obj[k]+gain(),28,99); });
    }
    if(!f.stats){
      // Legacy fighter without stats tree — skip or handle gracefully
      f.rating = clamp(f.rating+rnd(0,2),1,99);
      return;
    }
    if(p.stat==='condition'){
      f.condition = clamp(f.condition+rnd(p.gain[0],p.gain[1]),0,100);
      f.morale = clamp(f.morale+5,0,100);
    } else if(p.stat==='all'){
      // Full sparring: small boosts everywhere, injury risk
      bumpStat(f.stats.str.boxing, Object.keys(f.stats.str.boxing));
      bumpStat(f.stats.grap.td, Object.keys(f.stats.grap.td));
      bumpStat(f.stats.ment, Object.keys(f.stats.ment));
      if(Math.random()<0.1){ f.condition=clamp(f.condition-rnd(5,15),0,100); addNews(`${f.name} picked up a minor injury in sparring!`, G.week); }
    } else if(p.stat==='boxing'){
      // Boxing Camp: focuses on boxing sub-stats; slight improvement to kicking
      bumpStat(f.stats.str.boxing, Object.keys(f.stats.str.boxing));    // main focus
      // Slight boost across all striking — 1-2 random sub-stats from other groups
      const slightStriking = [...Object.keys(f.stats.str.kicking)].sort(()=>Math.random()-0.5).slice(0,1);
      slightStriking.forEach(k=>{ if(f.stats.str.kicking[k]!==undefined) f.stats.str.kicking[k]=clamp(f.stats.str.kicking[k]+rnd(1,2),28,99); });
      f.stats.phys.hand_speed = clamp(f.stats.phys.hand_speed+rnd(0,2),28,99);

    } else if(p.stat==='kickboxing'){
      // Kickboxing Training: focuses on kicking; slight boxing improvement
      bumpStat(f.stats.str.kicking, Object.keys(f.stats.str.kicking));  // main focus
      // Slight boxing boost — 1-2 sub-stats
      const slightBoxing = [...Object.keys(f.stats.str.boxing)].sort(()=>Math.random()-0.5).slice(0,2);
      slightBoxing.forEach(k=>{ if(f.stats.str.boxing[k]!==undefined) f.stats.str.boxing[k]=clamp(f.stats.str.boxing[k]+rnd(1,2),28,99); });
      f.stats.phys.move_speed = clamp(f.stats.phys.move_speed+rnd(0,2),28,99);

    } else if(p.stat==='muaythai'){
      // Muay Thai Camp: clinch striking primary; boxing + kicking secondary; slight chin/cardio
      bumpStat(f.stats.str.clinch_str, Object.keys(f.stats.str.clinch_str)); // main focus
      // Boxing secondary (2 sub-stats)
      const boxKeys = [...Object.keys(f.stats.str.boxing)].sort(()=>Math.random()-0.5).slice(0,2);
      boxKeys.forEach(k=>{ if(f.stats.str.boxing[k]!==undefined) f.stats.str.boxing[k]=clamp(f.stats.str.boxing[k]+rnd(2,4),28,99); });
      // Kicking secondary (2 sub-stats)
      const kickKeys = [...Object.keys(f.stats.str.kicking)].sort(()=>Math.random()-0.5).slice(0,2);
      kickKeys.forEach(k=>{ if(f.stats.str.kicking[k]!==undefined) f.stats.str.kicking[k]=clamp(f.stats.str.kicking[k]+rnd(2,4),28,99); });
      // Slight physical improvement
      f.stats.phys.chin   = clamp(f.stats.phys.chin   + rnd(0,2),28,99);
      f.stats.phys.cardio = clamp(f.stats.phys.cardio + rnd(0,2),28,99);
      f.stats.phys.body_tough = clamp(f.stats.phys.body_tough + rnd(0,1),28,99);

    } else if(p.stat==='wrestling'){
      bumpStat(f.stats.grap.td, Object.keys(f.stats.grap.td));
      bumpStat(f.stats.grap.td_def, Object.keys(f.stats.grap.td_def));
      bumpStat(f.stats.grap.clinch, Object.keys(f.stats.grap.clinch));
    } else if(p.stat==='bjj'){
      bumpStat(f.stats.grap.sub_off, Object.keys(f.stats.grap.sub_off));
      bumpStat(f.stats.grap.sub_def, Object.keys(f.stats.grap.sub_def));
      bumpStat(f.stats.grap.ground, Object.keys(f.stats.grap.ground));
    } else if(p.stat==='cardio'){
      f.stats.phys.cardio = clamp(f.stats.phys.cardio+gain(),28,99);
      f.stats.phys.recovery = clamp(f.stats.phys.recovery+gain(),28,99);
      f.stats.phys.move_speed = clamp(f.stats.phys.move_speed+rnd(0,3),28,99);
    } else {
      // Generic
      const k = p.stat;
      if(f.stats.phys[k]!==undefined) f.stats.phys[k]=clamp(f.stats.phys[k]+physGain(),28,99);
    }
    // Recompute rating and legacy props
    f.rating = computeRating(f.stats);
    const pl = getPillarScores(f);
    f.striking=pl.striking; f.wrestling=pl.grappling;
    f.cardio=f.stats.phys.cardio; f.chin=f.stats.phys.chin;
    f.speed=Math.round(avg2(f.stats.phys.hand_speed,f.stats.phys.move_speed));
    f.power=f.stats.phys.strength;
    f.bjj=Math.round(avg2(f.stats.grap.sub_off.chokes,f.stats.grap.sub_off.joint_locks,f.stats.grap.sub_off.leg_locks));
  });
  // Passive condition recovery: all fighters recover 1% per week regardless of training
  G.roster.forEach(f=>{
    const prog = G.trainingSelections[f.id];
    if(!prog || prog !== 'rest'){  // rest slot handles its own recovery; others get passive 1%
      f.condition = clamp(f.condition + 1, 0, 100);
    }
  });

  // ── NPC TRAINING & RECOVERY (world pool fighters) ──────────────────────────
  // NPCs train passively each week: small random skill improvement,
  // condition recovery. Mirrors the player's fighters without UI selection.
  {
    const npcPool = [...new Map(G.opponents.map(f=>[f.id,f])).values()];
    npcPool.forEach(f=>{
      if(!f.stats) return;
      // Condition recovery: NPCs bounce back ~2% per week
      f.condition = clamp((f.condition||80) + rnd(1,3), 0, 100);
      // Small passive skill improvement chance (3% per week per fighter)
      if(Math.random() < 0.03){
        const npcStatGroups = [
          [f.stats.str.boxing,  Object.keys(f.stats.str.boxing)],
          [f.stats.str.kicking, Object.keys(f.stats.str.kicking)],
          [f.stats.grap.td,     Object.keys(f.stats.grap.td)],
          [f.stats.grap.ground, Object.keys(f.stats.grap.ground)],
          [f.stats.phys,        ['cardio','recovery','strength']],
        ];
        const [obj, keys] = pick(npcStatGroups);
        const k = pick(keys);
        if(obj[k] !== undefined) obj[k] = clamp(obj[k] + 1, 28, 99);
      }
    });
  }

  // ── AGE FACTOR (all fighters — roster + NPC pool) ─────────────────────────
  // Fires every week; effects are gentle and accumulate over time.
  {
    const allAgingPool = [...new Map([...G.roster,...G.opponents].map(f=>[f.id,f])).values()];
    allAgingPool.forEach(f=>{
      if(!f.stats) return;
      const age    = f.age    || 25;
      const fights = (f.wins||0) + (f.losses||0);
      const inDecline = age >= 34 || fights >= 28;
      const inYouth   = age < 24;

      // ── YOUTH DEVELOPMENT ────────────────────────────────────────────────
      // Young fighters have a small weekly chance to naturally improve a skill
      if(inYouth && Math.random() < 0.10){
        const targets = [
          [f.stats.str.boxing,  Object.keys(f.stats.str.boxing)],
          [f.stats.str.kicking, Object.keys(f.stats.str.kicking)],
          [f.stats.grap.td,     Object.keys(f.stats.grap.td)],
        ];
        const [obj, keys] = pick(targets);
        const k = pick(keys);
        if(obj[k] !== undefined) obj[k] = clamp(obj[k] + rnd(1,2), 28, 97);
      }
      // Young fighters' mentals slowly climb each week
      if(inYouth && Math.random() < 0.06){
        const mk = pick(['fight_iq','decision','composure','adaptive']);
        f.stats.ment[mk] = clamp(f.stats.ment[mk] + 1, 28, 99);
      }

      // ── PHYSICAL DECLINE ─────────────────────────────────────────────────
      if(inDecline){
        // Physicals tick down slowly (not every week — probabilistic)
        const physDeclineChance = 0.06 + Math.max(0, (age - 34)) * 0.008; // accelerates with age
        if(Math.random() < physDeclineChance){
          const decliningPhys = ['strength','hand_speed','move_speed','cardio','leg_dur'];
          const pk = pick(decliningPhys);
          f.stats.phys[pk] = clamp(f.stats.phys[pk] - 1, 28, 99);
        }
        // Chin and body_tough decline slightly (slower)
        if(Math.random() < 0.03){
          const dk = Math.random() < 0.5 ? 'chin' : 'body_tough';
          f.stats.phys[dk] = clamp(f.stats.phys[dk] - 1, 28, 99);
        }
        // Mentals still rise slightly in decline — veterans get wiser
        if(Math.random() < 0.04){
          const mk = pick(['fight_iq','decision','composure','adaptive']);
          f.stats.ment[mk] = clamp(f.stats.ment[mk] + 1, 28, 99);
        }
        // Skill stats mostly preserved (experience compensates) — very small chance
        // of slight decay only in deep decline (age 38+)
        if(age >= 38 && Math.random() < 0.03){
          const skillGroups = [f.stats.str.boxing, f.stats.str.kicking, f.stats.grap.td];
          const sg = pick(skillGroups);
          const sk = pick(Object.keys(sg));
          sg[sk] = clamp(sg[sk] - 1, 28, 99);
        }
      }

      // ── ANNUAL AGE INCREMENT (every 52 weeks) ────────────────────────────
      if(G.week % 52 === 0){
        f.age = (f.age||25) + 1;
        // News for player's fighters crossing decline threshold
        if(G.roster.find(r=>r.id===f.id)){
          const newAge = f.age;
          const newFights = (f.wins||0)+(f.losses||0);
          if(newAge === 34 || newFights === 28){
            addNews(`⏳ ${f.name} (${newAge}) may be entering the twilight of their career. Physical decline has begun.`, G.week);
          }
        }
      }

      // ── RECOMPUTE RATING after age changes ───────────────────────────────
      if(inDecline || inYouth){
        f.rating = computeRating(f.stats);
        const pl = getPillarScores(f);
        f.striking=pl.striking; f.wrestling=pl.grappling;
        f.cardio=f.stats.phys.cardio; f.chin=f.stats.phys.chin;
        f.speed=Math.round(avg2(f.stats.phys.hand_speed,f.stats.phys.move_speed));
        f.power=f.stats.phys.strength;
      }
    });
  }

  // ── TRAINING GAIN MODIFIER for roster fighters ────────────────────────────
  // Young fighters train faster; declining fighters gain less on physicals

  // Pay salaries
  const total = G.roster.reduce((s,f)=>s+f.salary,0);
  G.money -= total;

  // Occasionally add new free agents to the pool
  if(Math.random()<0.3){
    const newFA = genFighter(false, null, pick(DIVISIONS));
    G.freeAgents.push(newFA);
    addNews(`${newFA.name} (${newFA.division}) has entered the free agent pool.`, G.week);
  }
  // Random event
  if(Math.random()<0.15){
    const msgs=['A new sponsor offer arrived!','Fan engagement is up this week.','A rival promotion is scouting your fighters.','Fight week media coverage is strong.','A hot prospect has been generating buzz in the scene.','Rankings are shuffling after last weekend\'s cards.'];
    addNews(pick(msgs), G.week);
  }
  // Rotate in new prospects occasionally
  if(G.week % 3 === 0){
    const d = pick(DIVISIONS);
    G.prospects.push(genProspect(d));
    if(G.prospects.length > 30) G.prospects.shift();
  }
  // Passive condition recovery: fighters not training still recover 1% per week
  G.roster.forEach(f=>{
    if(!G.trainingSelections[f.id]){
      f.condition = clamp(f.condition + 1, 0, 100);
    }
  });
  addNews(`Week ${G.week} begins. Paid ${fmtMoney(total)} in salaries.`, G.week);

  // ── Fight offer & auto-card trigger ──────────────────────────────────────
  // 7 weeks out: send fight offer to manager for one of their fighters
  // 1 week out: auto-generate the rest of the card
  let offerPending = false;
  G.schedule.forEach(evt=>{
    const weeksOut = evt.week - G.week;
    if(weeksOut === 6 && !evt.cardGenerated){
      autoGenerateCard(evt);
    }
    // Send offer when: card is built AND either first time (weeksOut=6) OR player just responded
    const offerReady = !evt.offerSent && !G.pendingOffer &&
                       (weeksOut<=6 && weeksOut>=1) &&
                       (!G._nextOfferWeek || G.week >= G._nextOfferWeek);
    if(offerReady){
      buildFightOffer(evt);
      offerPending = true;
      G._nextOfferWeek = null;
    }
  });

  showToast('Week '+G.week+(offerPending?' — New fight offer!':' — Salaries paid: '+fmtMoney(total)));

  // Show weekly fight card modal only if one of the player's fighters is booked this week
  const thisWeekEvts = G.schedule.filter(e=>e.week===G.week && (e.fights||[]).length>0);
  const myFightEvts = thisWeekEvts.filter(e=>(e.fights||[]).some(fi=>G.roster.find(r=>r.id===fi.fighterId)||G.roster.find(r=>r.id===fi.opponentId)));
  if(myFightEvts.length>0){
    setTimeout(()=>openWeekCardModal(myFightEvts), 200);
  } else {
    renderAll();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Generate plausible estimated stats for an auto-resolved fight ─────────────
function genAutoFightStats(winnerIsF, method, round, fRating, oRating){
  const rounds = Math.max(1, round);

  // Winner lands more strikes; loser less (especially in finishes)
  const winnerSigPerRound = rnd(18, 28);
  const loserSigPerRound  = rnd(8, 20);
  const finishMult = (method==='KO'||method==='TKO') ? 0.6 : method==='Submission' ? 0.75 : 1.0;

  // f is the "fighter" slot — determine which is winner/loser
  const fIsWinner = winnerIsF;
  const fSigPerRound  = fIsWinner ? winnerSigPerRound : Math.round(loserSigPerRound * finishMult);
  const oSigPerRound  = fIsWinner ? Math.round(loserSigPerRound * finishMult) : winnerSigPerRound;

  const fSig = Math.round(fSigPerRound * rounds * (0.85 + fRating/600));
  const oSig = Math.round(oSigPerRound * rounds * (0.85 + oRating/600));

  function ests(sig){
    return { sigStrikes: sig, strikes: Math.round(sig / 0.42) };
  }

  const fStr = ests(fSig);
  const oStr = ests(oSig);

  // TDs: 0-3 per round for wrestlers, ~0-1 for others
  const fTDs = Math.max(0, Math.round((rnd(0,3) * rounds * (method==='KO'?0.3:1))));
  const oTDs = Math.max(0, Math.round((rnd(0,3) * rounds * (method==='KO'?0.3:1))));
  const fCtrl = fTDs * rnd(25,55);
  const oCtrl = oTDs * rnd(25,55);

  const fKD = (winnerIsF && (method==='KO'||method==='TKO')) ? rnd(1,2) : 0;
  const oKD = (!winnerIsF && (method==='KO'||method==='TKO')) ? rnd(1,2) : 0;

  return {
    f: { strikes:fStr.strikes, sigStrikes:fStr.sigStrikes, takedowns:fTDs, tdAttempts:Math.max(fTDs,rnd(fTDs,fTDs+2)), ctrlSeconds:fCtrl, knockdowns:fKD },
    o: { strikes:oStr.strikes, sigStrikes:oStr.sigStrikes, takedowns:oTDs, tdAttempts:Math.max(oTDs,rnd(oTDs,oTDs+2)), ctrlSeconds:oCtrl, knockdowns:oKD },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ██████████████████████████████████████████████████████████████████████████████
// ██  COMBAT ENGINE — SECTION 5: AUTO-RESOLVE (skipped / NPC fights)         ██
// ██  genAutoFightStats · autoResolveFight                                    ██
// ██  Used when a fight is skipped or between two NPC fighters                ██
// ██████████████████████████████████████████████████████████████████████████████
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// HEADLESS FIGHT SIMULATION
// Runs the full combat engine synchronously with no DOM rendering.
// Returns { winner, loser, method, round, fightStats, fLoc, oLoc }
// ─────────────────────────────────────────────────────────────────────────────
function simulateFightHeadless(f, o, isTitleOrMain){
  const MAX_ROUNDS = isTitleOrMain ? 5 : 3;

  // Stub DOM-dependent helpers
  const _noop = ()=>{};
  const _logLine = _noop;
  const _updateBars = _noop;

  // Inline copies of stat helpers (mirrors runFight internals)
  function getS(fighter, path, fallback){
    try { const parts=path.split('.'); let v=fighter.stats; for(const p of parts) v=v[p]; return v||fallback; }
    catch(e){ return fallback; }
  }
  const fStat = (p,fb)=>getS(f,p,fb);
  const oStat = (p,fb)=>getS(o,p,fb);

  let fST=100, oST=100;
  let round=1, finished=false, winner=null, method='', finishRound=0;

  const fightStats = {
    f: { strikes:0, sigStrikes:0, takedowns:0, tdAttempts:0, ctrlSeconds:0, knockdowns:0 },
    o: { strikes:0, sigStrikes:0, takedowns:0, tdAttempts:0, ctrlSeconds:0, knockdowns:0 },
  };

  const fLoc = initLocationHP(f);
  const oLoc = initLocationHP(o);
  const fDebuff = { move_speed:0, td_def:0, kicks:0, stamina_drain:0, boxing:0, upper_td:0, mental:0, sub_def:0, head_mov:0, reaction:0 };
  const oDebuff = { move_speed:0, td_def:0, kicks:0, stamina_drain:0, boxing:0, upper_td:0, mental:0, sub_def:0, head_mov:0, reaction:0 };
  const fCuts = initCuts(); const oCuts = initCuts();
  let fLastHeadHitGround=false, oLastHeadHitGround=false;

  // Reach / height
  const fReach=f.reach||70, oReach=o.reach||70, fHeight=f.height||70, oHeight=o.height||70;

  const fStatD=(p,fb)=>{const base=fStat(p,fb);const key=p.split('.').pop();return Math.max(10,base-(fDebuff[key]||0));};
  const oStatD=(p,fb)=>{const base=oStat(p,fb);const key=p.split('.').pop();return Math.max(10,base-(oDebuff[key]||0));};

  const RECOVERY_PENALTY=0.15;
  let tempFST=fST, tempOST=oST;
  const roundScores=[];

  for(let r=1; r<=MAX_ROUNDS; r++){
    fST=tempFST; oST=tempOST;
    // Use the real collectRoundActions by temporarily hijacking G.pendingFight and inner vars
    // Instead, we run a simplified version that mirrors the logic
    const rd = _headlessRound(r, f, o, fStat, oStat, fStatD, oStatD,
      fLoc, oLoc, fDebuff, oDebuff, fCuts, oCuts,
      {fST, oST}, fightStats, fReach, oReach, fHeight, oHeight,
      {fLastHeadHitGround, oLastHeadHitGround}, MAX_ROUNDS);

    fLastHeadHitGround=rd.fLastGnd; oLastHeadHitGround=rd.oLastGnd;
    roundScores.push(rd.scorecard);

    if(rd.finished){
      finished=true; winner=rd.winner; method=rd.method; finishRound=r;
      fST=rd.fST; oST=rd.oST;
      break;
    }

    // Recovery
    const fSTL=100-rd.fST, oSTL=100-rd.oST;
    tempFST=clamp(rd.fST+fSTL*(1-RECOVERY_PENALTY),0,100);
    tempOST=clamp(rd.oST+oSTL*(1-RECOVERY_PENALTY),0,100);
    fST=tempFST; oST=tempOST;
  }

  // Decision
  if(!finished){
    finishRound=MAX_ROUNDS;
    let fRoundsWon=0, oRoundsWon=0;
    roundScores.forEach(sc=>{
      const fS=sc.fDmg*0.6+sc.fCtrl*0.2+sc.fAgg*0.2;
      const oS=sc.oDmg*0.6+sc.oCtrl*0.2+sc.oAgg*0.2;
      if(fS>oS) fRoundsWon++; else oRoundsWon++;
    });
    winner = fRoundsWon>=oRoundsWon ? f : o;
    const diff=Math.abs(fRoundsWon-oRoundsWon);
    method = diff<=1 ? (Math.random()<0.5?'Split Decision':'Majority Decision') : 'Unanimous Decision';
  }

  const loser = (winner.id===f.id) ? o : f;
  return { winner, loser, method, round:finishRound, fightStats, fLoc, oLoc };
}

// Headless per-round simulation (stripped-down version of collectRoundActions)
function _headlessRound(r, f, o, fStat, oStat, fStatD, oStatD,
    fLoc, oLoc, fDebuff, oDebuff, fCuts, oCuts,
    stam, fightStats, fReach, oReach, fHeight, oHeight,
    lastGnd, MAX_ROUNDS){

  let localFST=stam.fST, localOST=stam.oST;
  let localFinished=false, localWinner=null, localMethod='';
  let fDmg=0, oDmg=0, fCtrl=0, oCtrl=0, fAgg=0, oAgg=0;
  let fLastGnd=lastGnd.fLastHeadHitGround, oLastGnd=lastGnd.oLastHeadHitGround;
  let fTDattempts=0, oTDattempts=0;
  const maxTDperRound=rnd(6,8);
  const exchanges=25+rnd(0,10);

  for(let i=0;i<exchanges;i++){
    if(localFinished) break;
    const fAtk=Math.random()<0.5;
    const atk=fAtk?f:o, def=fAtk?o:f;
    const atkST=fAtk?localFST:localOST;
    const atkMod=atkST/100;
    const defST_=fAtk?localOST:localFST;
    const atkStaminaFac=atkST<40?0.65+(atkST/40)*0.35:1.0;
    const defStaminaFac=defST_<40?0.65+(defST_/40)*0.35:1.0;
    const exchangeProgress=i/Math.max(exchanges-1,1);

    const baseGrapScore=fAtk?avg2(fStat('grap.td.dl_td',60),fStat('grap.clinch.control',60),fStat('grap.ground.top_ctrl',55)):avg2(oStat('grap.td.dl_td',60),oStat('grap.clinch.control',60),oStat('grap.ground.top_ctrl',55));
    const baseStrScore=fAtk?avg2(fStat('str.boxing.jab',60),fStat('str.boxing.cross',60),fStat('str.kicking.low_kicks',60)):avg2(oStat('str.boxing.jab',60),oStat('str.boxing.cross',60),oStat('str.kicking.low_kicks',60));
    const atkStyle=atk.style||'All-Rounder';
    const styleGrapBonus=(atkStyle==='Wrestler'||atkStyle==='BJJ Artist')?0.28:(atkStyle==='Pressure Fighter')?0.10:(atkStyle==='Boxer')?-0.42:(atkStyle==='Kickboxer')?-0.35:(atkStyle==='Muay Thai')?-0.12:(atkStyle==='Brawler')?-0.25:(atkStyle==='Counter-Striker')?-0.30:0;
    const atkTDUsed=fAtk?fTDattempts:oTDattempts;
    const tdBudgetExhausted=atkTDUsed>=maxTDperRound;
    const atkFIQ_=fAtk?fStat('ment.fight_iq',65):oStat('ment.fight_iq',65);
    const atkTDs_=fAtk?avg2(fStat('grap.td.dl_td',60),fStat('grap.td.sl_td',60)):avg2(oStat('grap.td.dl_td',60),oStat('grap.td.sl_td',60));
    const defTDs_=fAtk?avg2(oStat('grap.td_def.dl_def',60),oStat('grap.td_def.sl_def',60)):avg2(fStat('grap.td_def.dl_def',60),fStat('grap.td_def.sl_def',60));
    const tdAdv_=(atkTDs_-defTDs_)/100;
    const fiqMod_=(atkFIQ_-65)*0.04;
    const rawGrapProb=clamp(baseGrapScore/(baseGrapScore+baseStrScore||1)+styleGrapBonus,0.04,0.80);
    const tdIQAdj_=fiqMod_*tdAdv_*2;
    const isStriking_=['Boxer','Kickboxer','Muay Thai','Brawler','Counter-Striker'].includes(atkStyle);
    const lowIQBias_=(isStriking_&&atkFIQ_<65)?(65-atkFIQ_)*-0.003:0;
    const grapProb=tdBudgetExhausted?0:clamp(rawGrapProb*0.38+tdIQAdj_+lowIQBias_,0.01,0.35);
    const atkAggression=fAtk?fStat('ment.aggression',65):oStat('ment.aggression',65);
    const doGrapple=Math.random()<grapProb;

    // Reach/height for this exchange
    const atkReach=fAtk?fReach:oReach, defReach=fAtk?oReach:fReach;
    const atkHeight=fAtk?fHeight:oHeight, defHeight=fAtk?oHeight:fHeight;
    const rangeZone=getRangeZone(atkStyle,def.style||'All-Rounder',atkReach,defReach);

    if(doGrapple){
      if(fAtk)fTDattempts++;else oTDattempts++;
      const atkTD_raw=fAtk?avg2(fStat('grap.td.dl_td',60),fStat('grap.td.sl_td',60)):avg2(oStat('grap.td.dl_td',60),oStat('grap.td.sl_td',60));
      const atkTD=atkTD_raw*atkStaminaFac;
      const rawTDdef=fAtk?avg2(oStat('grap.td_def.dl_def',60),oStat('grap.td_def.sl_def',60)):avg2(fStat('grap.td_def.dl_def',60),fStat('grap.td_def.sl_def',60));
      const defTD=Math.max(10,rawTDdef*defStaminaFac-(fAtk?oDebuff.td_def:fDebuff.td_def));
      const heightTDmod=(atkHeight<defHeight)?0.04:(atkHeight>defHeight)?-0.04:0;
      const tdChance=clamp(0.18+(atkTD-defTD)*0.003+atkMod*0.08+heightTDmod,0.08,0.75);

      if(Math.random()<tdChance){
        // Takedown lands — ground sequence
        if(fAtk){localOST=clamp(localOST-rnd(6,12),0,100);}else{localFST=clamp(localFST-rnd(6,12),0,100);}
        const defLocGrap=fAtk?oLoc:fLoc, defDebuffG=fAtk?oDebuff:fDebuff;
        const defWrestleUp=fAtk?oStat('grap.ground.wrestling_getup',55):fStat('grap.ground.wrestling_getup',55);
        const defBJJUp=fAtk?oStat('grap.ground.bjj_getup',55):fStat('grap.ground.bjj_getup',55);
        const defScramble=fAtk?oStat('grap.ground.scrambling',55):fStat('grap.ground.scrambling',55);
        const getupScore=avg2(defWrestleUp,defBJJUp,defScramble);
        const atkTopCtrl=fAtk?fStat('grap.ground.top_ctrl',55):oStat('grap.ground.top_ctrl',55);
        const atkWresTrans=fAtk?fStat('grap.ground.wrestling_trans',55):oStat('grap.ground.wrestling_trans',55);
        const atkBJJTrans=fAtk?fStat('grap.ground.bjj_trans',55):oStat('grap.ground.bjj_trans',55);
        const ctrlScore=avg2(atkTopCtrl,atkWresTrans,atkBJJTrans);
        const getupChancePerEx=clamp(0.35-(ctrlScore-getupScore)*0.004,0.15,0.65);
        const groundExchanges=clamp(rnd(2,2+Math.round((ctrlScore-getupScore)*0.04+2)),2,7);
        const atkSub=fAtk?avg2(fStat('grap.sub_off.chokes',50),fStat('grap.sub_off.joint_locks',50)):avg2(oStat('grap.sub_off.chokes',50),oStat('grap.sub_off.joint_locks',50));
        const rawSubD=fAtk?avg2(oStat('grap.sub_def.choke_def',60),oStat('grap.sub_def.joint_def',60)):avg2(fStat('grap.sub_def.choke_def',60),fStat('grap.sub_def.joint_def',60));
        const defSubD=Math.max(10,rawSubD-(fAtk?oDebuff.sub_def:fDebuff.sub_def));
        const subReachMod=(fAtk?fReach-oReach:oReach-fReach)*0.001;
        let gotUp=false;
        fightStats[fAtk?'f':'o'].takedowns++; fightStats[fAtk?'f':'o'].tdAttempts++;

        for(let g=0;g<groundExchanges;g++){
          if(localFinished)break;
          if(g>0&&Math.random()<getupChancePerEx){gotUp=true;break;}
          const posRoll=Math.random();
          const currentPos=posRoll<0.2&&atkBJJTrans>60?'full mount':posRoll<0.4&&atkWresTrans>60?'side control':posRoll<0.55?'half guard':posRoll<0.70&&atkBJJTrans>55?'back mount':'top position';
          const subRollPos=(currentPos==='full mount'||currentPos==='back mount')?1.4:currentPos==='side control'?1.1:0.85;
          const subChance=clamp((atkSub-defSubD)*0.002+0.035*subRollPos+subReachMod,0.01,0.15);
          if(Math.random()<subChance){localFinished=true;localWinner=atk;localMethod='Submission';fightStats[fAtk?'f':'o'].knockdowns=0;break;}
          const gctrl=fAtk?fStat('grap.ground.top_ctrl',55):oStat('grap.ground.top_ctrl',55);
          const gndStr=fAtk?fStat('str.ground_str.gnd_strikes',55):oStat('str.ground_str.gnd_strikes',55);
          const gndDmg=Math.round(rnd(1,4)*(gctrl/80)*(gndStr/75)*atkMod);
          if(gndDmg>0){
            const gndZone=(currentPos==='full mount'||currentPos==='back mount')?'head':(Math.random()<0.55?'head':'body');
            defLocGrap[gndZone]=clamp(defLocGrap[gndZone]-gndDmg,0,100);
            if(fAtk)oLastGnd=true;else fLastGnd=true;
            const maxHd=Math.round((fAtk?oStat('phys.chin',60):fStat('phys.chin',60))*0.75);
            const maxBd=Math.round((fAtk?oStat('phys.body_tough',65):fStat('phys.body_tough',65))*0.75);
            const hFrac=clamp(1-defLocGrap.head/Math.max(maxHd,1),0,1);
            const bFrac=clamp(1-defLocGrap.body/Math.max(maxBd,1),0,1);
            defDebuffG.mental=Math.round(hFrac*20);defDebuffG.sub_def=Math.round(hFrac*20);defDebuffG.head_mov=Math.round(hFrac*25);defDebuffG.reaction=Math.round(hFrac*15);defDebuffG.stamina_drain=Math.max(defDebuffG.stamina_drain,Math.round(bFrac*20));defDebuffG.boxing=Math.round(bFrac*15);
            if(defLocGrap.head<=0){localFinished=true;localWinner=atk;localMethod='TKO';break;}
            if(defLocGrap.body<=0){localFinished=true;localWinner=atk;localMethod='TKO';break;}
          }
          const stD=rnd(3,8), ctrlD=rnd(2,5);
          if(fAtk){localOST=clamp(localOST-stD-ctrlD,0,100);localFST=clamp(localFST-rnd(1,4),0,100);}else{localFST=clamp(localFST-stD-ctrlD,0,100);localOST=clamp(localOST-rnd(1,4),0,100);}
          fCtrl+=fAtk?rnd(2,5):0; oCtrl+=!fAtk?rnd(2,5):0;
          fightStats[fAtk?'f':'o'].ctrlSeconds+=rnd(20,60);
        }
        if(!localFinished){
          const oDelta=fAtk?(fightStats.f.ctrlSeconds>0?rnd(3,8):0):0;
          fDmg+=fAtk?oDelta:0; oDmg+=!fAtk?oDelta:0;
        }
      } else {
        // Failed TD — stamina drain
        const tdFailDrain=rnd(6,14);
        if(fAtk){localFST=clamp(localFST-tdFailDrain,0,100);}else{localOST=clamp(localOST-tdFailDrain,0,100);}
        fightStats[fAtk?'f':'o'].tdAttempts++;
      }
    } else {
      // STRIKING
      const kickScore=fAtk?avg2(fStat('str.kicking.low_kicks',55),fStat('str.kicking.body_kicks',55)):avg2(oStat('str.kicking.low_kicks',55),oStat('str.kicking.body_kicks',55));
      const clinchScore=fAtk?fStat('str.clinch_str.knees',55):oStat('str.clinch_str.knees',55);
      const typeRoll=Math.random();
      let strikeType='boxing';
      if(typeRoll<0.10&&clinchScore>58)strikeType='clinch';
      else if(typeRoll<0.28&&kickScore>52)strikeType='kick';

      let atkPower,defPower,atkAccStat,defEvadeStat;
      if(strikeType==='clinch'){
        const k=fAtk?fStat('str.clinch_str.knees',55):oStat('str.clinch_str.knees',55);
        const e=fAtk?fStat('str.clinch_str.elbows',55):oStat('str.clinch_str.elbows',55);
        atkPower=avg2(k,e); defPower=fAtk?oStat('str.clinch_str.clinch_str_def',55):fStat('str.clinch_str.clinch_str_def',55);
        atkAccStat=atkPower; defEvadeStat=defPower;
      } else if(strikeType==='kick'){
        atkPower=fAtk?avg2(fStat('str.kicking.low_kicks',55),fStat('str.kicking.body_kicks',55),fStat('str.kicking.teep',50)):avg2(oStat('str.kicking.low_kicks',55),oStat('str.kicking.body_kicks',55),oStat('str.kicking.teep',50));
        defPower=fAtk?oStat('str.kicking.kick_def',55):fStat('str.kicking.kick_def',55);
        atkAccStat=atkPower; defEvadeStat=defPower;
      } else {
        const j=fAtk?fStat('str.boxing.jab',60):oStat('str.boxing.jab',60);
        const cr=fAtk?fStat('str.boxing.cross',60):oStat('str.boxing.cross',60);
        const h=fAtk?fStat('str.boxing.hooks',55):oStat('str.boxing.hooks',55);
        const dHM=fAtk?oStat('str.boxing.head_mov',55):fStat('str.boxing.head_mov',55);
        const dBk=fAtk?oStat('str.boxing.blocking',55):fStat('str.boxing.blocking',55);
        atkPower=avg2(j,cr,h); defPower=avg2(dHM,dBk); atkAccStat=avg2(j,cr,h); defEvadeStat=avg2(dHM,dBk);
      }

      const atkHandSpd=fAtk?fStat('phys.hand_speed',60):oStat('phys.hand_speed',60);
      const defReact=fAtk?oStat('phys.reaction',60):fStat('phys.reaction',60);
      const defDebuff=fAtk?oDebuff:fDebuff;
      const defLoc=fAtk?oLoc:fLoc;
      const atkCounters=fAtk?fStat('str.boxing.counters',55):oStat('str.boxing.counters',55);
      const isCountering=atkAggression<50&&strikeType!=='kick';
      const counterBonus=isCountering?(atkCounters-55)*0.003:0;
      const zoneAccMod=rangeZone==='outside'?(atkReach-defReach)*0.004:rangeZone==='inside'?-(atkReach-defReach)*0.004:0;
      const baseAcc=(0.28+exchangeProgress*0.06)+(atkAccStat-defEvadeStat)*0.002+(atkHandSpd-defReact)*0.002+atkMod*0.06;
      const perStrikeAcc=clamp(baseAcc,0.18,0.58);
      const defCutPenalty=cutMentalDebuff(fAtk?oCuts:fCuts)/100;
      const adjAcc=clamp(perStrikeAcc+defCutPenalty*0.15+(defDebuff.head_mov||0)*0.002+counterBonus+zoneAccMod,0.18,0.68);

      const comboSize=strikeType==='boxing'?rnd(1,4):1;
      let exchLanded=0, exchDmg=0;
      for(let ci=0;ci<comboSize;ci++){
        const isSig=Math.random()<0.6;
        fightStats[fAtk?'f':'o'].strikes++;
        if(Math.random()<adjAcc){
          exchLanded++;
          if(isSig)fightStats[fAtk?'f':'o'].sigStrikes++;
          const strRaw_=fAtk?fStat('phys.strength',60):oStat('phys.strength',60);
      const str=strRaw_*atkStaminaFac;
          const strikePowerStat=(strikeType==='kick')?(fAtk?fStat('str.kicking.power',55):oStat('str.kicking.power',55)):(fAtk?fStat('str.boxing.power',55):oStat('str.boxing.power',55));
          const powerMod=0.75+(strikePowerStat/100)*0.50;
          const counterDmgBonus=(isCountering&&isSig)?1+(atkCounters-55)*0.004:1.0;
          const rrModAction=reachRangeMod(strikeType,'',rangeZone,atkReach,defReach,atkHeight,defHeight);
          const baseDmg=isSig?rnd(2,6):rnd(1,2);
          const dmg=baseDmg*(str/80)*(atkPower/75)*powerMod*rrModAction.dmgMod*counterDmgBonus*atkMod*1.07;
          exchDmg+=dmg;
          const atkFIQ=fAtk?fStat('ment.fight_iq',65):oStat('ment.fight_iq',65);
          const zone=targetLocation(strikeType,'',atkFIQ,defLoc);
          const locDmg=Math.round(dmg*(isSig?0.5:0.20));
          defLoc[zone]=clamp(defLoc[zone]-locDmg,0,100);
          if(fAtk&&zone==='head')oLastGnd=false;else if(!fAtk&&zone==='head')fLastGnd=false;
          // Apply debuffs
          const maxLoc=zone==='head'?Math.round((fAtk?oStat('phys.chin',60):fStat('phys.chin',60))*0.75):zone==='body'?Math.round((fAtk?oStat('phys.body_tough',65):fStat('phys.body_tough',65))*0.75):Math.round((fAtk?oStat('phys.leg_dur',65):fStat('phys.leg_dur',65))*0.75);
          const dmgFrac=clamp(1-defLoc[zone]/Math.max(maxLoc,1),0,1);
          if(zone==='legs'){defDebuff.move_speed=Math.round(dmgFrac*25);defDebuff.td_def=Math.round(dmgFrac*20);defDebuff.kicks=Math.round(dmgFrac*30);defDebuff.stamina_drain=Math.round(dmgFrac*15);}
          else if(zone==='body'){defDebuff.stamina_drain=Math.max(defDebuff.stamina_drain,Math.round(dmgFrac*20));defDebuff.boxing=Math.round(dmgFrac*15);defDebuff.upper_td=Math.round(dmgFrac*15);defDebuff.td_def=Math.max(defDebuff.td_def,Math.round(dmgFrac*10));}
          else{defDebuff.mental=Math.round(dmgFrac*20);defDebuff.sub_def=Math.round(dmgFrac*20);defDebuff.head_mov=Math.round(dmgFrac*25);defDebuff.reaction=Math.round(dmgFrac*15);defDebuff.move_speed=Math.max(defDebuff.move_speed,Math.round(dmgFrac*10));defDebuff.stamina_drain=Math.max(defDebuff.stamina_drain,Math.round(dmgFrac*8));}
          // Finish checks
          if(defLoc.legs<=0){localFinished=true;localWinner=atk;localMethod='TKO';break;}
          if(defLoc.body<=0){localFinished=true;localWinner=atk;localMethod='TKO';break;}
          if(defLoc.head<=0){const finMethod=fAtk?oLastGnd:fLastGnd?'TKO':'KO';localFinished=true;localWinner=atk;localMethod=finMethod;fightStats[fAtk?'f':'o'].knockdowns++;break;}
          // Partial KO
          const defChin=fAtk?oStat('phys.chin',60):fStat('phys.chin',60);
          const headFrac=clamp((40-defLoc.head)/80,0,0.4);
          const cutFactor=cutMentalDebuff(fAtk?oCuts:fCuts)/100*0.15;
          const kochance=clamp((100-defChin)*0.0015+str/100*0.04+headFrac*0.08+cutFactor,0.002,0.10);
          if(defLoc.head<15&&Math.random()<kochance){const fm=fAtk?oLastGnd:fLastGnd?'TKO':'KO';localFinished=true;localWinner=atk;localMethod=fm;fightStats[fAtk?'f':'o'].knockdowns++;break;}
        }
      }
      if(exchLanded>0){
        if(fAtk)localOST=clamp(localOST-rnd(1,4),0,100);else localFST=clamp(localFST-rnd(1,4),0,100);
        fDmg+=fAtk?exchDmg:0; oDmg+=!fAtk?exchDmg:0;
      }
      fAgg+=fAtk?1:0; oAgg+=!fAtk?1:0;
    }

    if(localFinished){winner=localWinner;method=localMethod;finishRound=r;break;}
  }

  // End of round stamina
  const fCardio=fStat('phys.cardio',65),oCardio=oStat('phys.cardio',65);
  localFST=clamp(localFST-Math.round(rnd(4,10)*(1-fCardio/100))-(fDebuff.stamina_drain||0),0,100);
  localOST=clamp(localOST-Math.round(rnd(4,10)*(1-oCardio/100))-(oDebuff.stamina_drain||0),0,100);

  return {
    finished:localFinished, winner:localWinner, method:localMethod,
    fST:localFST, oST:localOST,
    fLastGnd, oLastGnd,
    scorecard:{r, fDmg, oDmg, fCtrl, oCtrl, fAgg, oAgg}
  };
}

// ── Auto-resolve a single fight (no animation) ─────────────────────────────
function autoResolveFight(fi, allPool){
  const fighter = allPool.find(r=>r.id===fi.fighterId);
  const opp     = allPool.find(r=>r.id===fi.opponentId);
  if(!fighter||!opp) return;

  // Run the full combat engine headlessly for realistic results
  const isTitleOrMain = fi.isTitleFight||fi.isMainEvent;
  const simResult = simulateFightHeadless(fighter, opp, isTitleOrMain);
  const winner  = simResult.winner;
  const loser   = simResult.loser;
  const method  = simResult.method;
  const round   = simResult.round;
  const playerWon = winner.id === fighter.id;

  // Apply result
  const isMine = !!G.roster.find(r=>r.id===fi.fighterId);
  fi.result = playerWon ? 'W' : 'L';
  fi.method = method;
  fi.round  = round;
  fi.winnerId = winner.id;

  if(isMine){
    if(playerWon){
      fighter.wins++; opp.losses++;
      G.totalWins++;
      G.money += fi.purse;
      G.rep = clamp(G.rep+rnd(2,6),0,100);
      fighter.condition = clamp(fighter.condition - rnd(10,25), 20, 100);
      if(method==='KO'||method==='TKO'){ fighter.koWins=(fighter.koWins||0)+1; applyPopularityEvent(fighter,'finish_ko'); }
      else if(method==='Submission'){  fighter.subWins=(fighter.subWins||0)+1; applyPopularityEvent(fighter,'finish_sub'); }
      else {                           fighter.decWins=(fighter.decWins||0)+1; applyPopularityEvent(fighter,'decision'); }
      G.consecutiveLosses[fighter.id]=0;
      if(!fighter.fightHistory) fighter.fightHistory=[];
      const _autoStats = genAutoFightStats(true, method, round, fighter.rating, opp.rating);
      fighter.fightHistory.unshift({week:G.week,opponent:opp.name,opponentId:opp.id,result:'W',method,round,purse:fi.purse,stats:_autoStats.f,oppStats:_autoStats.o,roundLog:[]});
      addNews(fighter.name+' def. '+opp.name+' by '+method+' (R'+round+') — '+fmtMoney(fi.purse), G.week);
    } else {
      fighter.losses++; opp.wins++;
      G.totalLosses++;
      G.money -= Math.round(fi.purse*0.3);
      G.rep = clamp(G.rep-rnd(1,4),0,100);
      fighter.condition = clamp(fighter.condition - rnd(15,35), 10, 80);
      G.consecutiveLosses[fighter.id]=(G.consecutiveLosses[fighter.id]||0)+1;
      // Credit the opponent (opp) with the finish
      if(method==='KO'||method==='TKO') opp.koWins=(opp.koWins||0)+1;
      else if(method==='Submission')    opp.subWins=(opp.subWins||0)+1;
      else                              opp.decWins=(opp.decWins||0)+1;
      if(!fighter.fightHistory) fighter.fightHistory=[];
      const _autoStatsL = genAutoFightStats(false, method, round, fighter.rating, opp.rating);
      fighter.fightHistory.unshift({week:G.week,opponent:opp.name,opponentId:opp.id,result:'L',method,round,purse:0,stats:_autoStatsL.f,oppStats:_autoStatsL.o,roundLog:[]});
      addNews(fighter.name+' lost to '+opp.name+' by '+method+' (R'+round+')', G.week);
    }
    if(fighter.stats){ fighter.rating=computeRating(fighter.stats); const pl=getPillarScores(fighter); fighter.striking=pl.striking; fighter.wrestling=pl.grappling; }
  } else {
    // NPC fight — update records for both fighters
    winner.wins++;
    loser.losses++;
    // Track finish method + popularity for both fighters
    if(method==='KO'||method==='TKO'){ winner.koWins=(winner.koWins||0)+1; applyPopularityEvent(winner,'finish_ko'); applyPopularityEvent(loser,'loss_ko'); }
    else if(method==='Submission'){    winner.subWins=(winner.subWins||0)+1; applyPopularityEvent(winner,'finish_sub'); applyPopularityEvent(loser,'loss'); }
    else {                            winner.decWins=(winner.decWins||0)+1; applyPopularityEvent(winner,'decision'); applyPopularityEvent(loser,'loss'); }
    // Apply ranking movement for NPC fights too
    const isTitleFight = fi.isTitleFight || false;
    const div = fi.division || fighter.division || opp.division;
    applyFightResultToRankings(winner.id, loser.id, true, method, isTitleFight, div);
    fi.winnerId = winner.id;
    if(!winner.fightHistory) winner.fightHistory=[];
    if(!loser.fightHistory)  loser.fightHistory=[];
    const _npcStats = genAutoFightStats(true, method, round, winner.rating||60, loser.rating||60);
    winner.fightHistory.unshift({week:G.week,opponent:loser.name,opponentId:loser.id,result:'W',method,round,purse:0,stats:_npcStats.f,oppStats:_npcStats.o,roundLog:[]});
    loser.fightHistory.unshift({week:G.week,opponent:winner.name,opponentId:winner.id,result:'L',method,round,purse:0,stats:_npcStats.o,oppStats:_npcStats.f,roundLog:[]});
    addNews(winner.name+' def. '+loser.name+' by '+method+' (R'+round+')', G.week);
  }
}

// ── Week card modal ────────────────────────────────────────────────────────
let _weekCardEvts = [];
let _weekCardFightQueue = [];

function openWeekCardModal(evts){
  _weekCardEvts = evts;
  const allPool = [...G.roster,...G.opponents,...G.freeAgents];
  // Snapshot rankings for all fights this week before any fights run
  evts.forEach(evt=>{
    (evt.fights||[]).filter(fi=>!fi.result).forEach(fi=>{
      if(fi.preRankF === undefined){
        const _fDiv = fi.division || allPool.find(r=>r.id===fi.fighterId)?.division;
        if(_fDiv){
          const _r = getRankableFighters(_fDiv);
          fi.preRankF = _r.findIndex(r=>r.id===fi.fighterId);
          fi.preRankO = _r.findIndex(r=>r.id===fi.opponentId);
        }
      }
    });
  });
  const title = document.getElementById('wcard-title');
  const sub   = document.getElementById('wcard-subtitle');
  if(title) title.textContent = evts.length>1 ? 'Fight Week — '+evts.length+' Events' : evts[0].name;
  if(sub) sub.textContent = 'Week '+G.week+' · Resolve each fight or watch live';

  // Collect all pending fights (those without results)
  _weekCardFightQueue = [];
  evts.forEach(evt=>{
    (evt.fights||[]).forEach(fi=>{
      if(!fi.result) _weekCardFightQueue.push({evt, fi});
    });
  });

  renderWeekCard();
  openModal('week-card-modal');
}

function renderWeekCard(){
  const cont = document.getElementById('wcard-fights');
  if(!cont) return;
  const allPool = [...G.roster,...G.opponents,...G.freeAgents,...G.prospects];
  let html = '';
  _weekCardEvts.forEach(evt=>{
    html += `<div style="padding:10px 20px;background:var(--bg3);border-bottom:1px solid var(--border)">
      <span style="font-family:'Barlow Condensed';font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold)">${evt.name}</span>
      <span style="font-size:11px;color:var(--muted);margin-left:8px">${evt.type.toUpperCase()}</span>
    </div>`;
    // Sort: undercard first, co-mains next, main event / title at bottom
    const sortedFights = [...(evt.fights||[])].sort((a,b)=>{
      const rank = f=>f.isTitleFight?3:f.isMainEvent?2:f.slot==='co_main'?1:0;
      return rank(a)-rank(b);
    });
    sortedFights.forEach((fi,idx)=>{
      const f1 = allPool.find(r=>r.id===fi.fighterId);
      const f2 = allPool.find(r=>r.id===fi.opponentId);
      if(!f1||!f2) return;
      const isMine = !!G.roster.find(r=>r.id===fi.fighterId)||!!G.roster.find(r=>r.id===fi.opponentId);
      const isTitle = !!fi.isTitleFight;
      const isMain  = !!fi.isMainEvent || fi.slot==='main';
      const isCoMain = isMain && !isTitle && !fi.isMainEvent;
      // Visual tier
      const slotLabel = isTitle ? 'TITLE' : fi.isMainEvent ? 'MAIN' : fi.slot==='co_main' ? 'CO-MAIN' : 'PRELIM';
      const slotColor = isTitle ? 'var(--gold)' : fi.isMainEvent ? '#E8A87C' : fi.slot==='co_main' ? 'var(--muted)' : 'var(--border)';
      const rowBg = isTitle ? '#1A1200' : fi.isMainEvent ? '#160F00' : isMine ? '#1A1500' : 'transparent';
      const rowBorder = isTitle ? 'var(--gold)' : fi.isMainEvent ? '#6B4C1E' : 'var(--border)';
      const nameSize = isTitle ? '15px' : fi.isMainEvent ? '14px' : '13px';
      const f1Rank = getRankableFighters(f1.division).findIndex(r=>r.id===f1.id);
      const f2Rank = getRankableFighters(f2.division).findIndex(r=>r.id===f2.id);
      const f1RStr = f1Rank>=0 ? ` <span style="font-size:9px;color:var(--gold)">${fmtRank(f1Rank)}</span>` : '';
      const f2RStr = f2Rank>=0 ? ` <span style="font-size:9px;color:var(--gold)">${fmtRank(f2Rank)}</span>` : '';
      html += `<div style="display:flex;align-items:center;gap:10px;padding:${isTitle?'14px':isMain?'12px':'9px'} 20px;border-bottom:1px solid ${rowBorder};border-left:3px solid ${slotColor};background:${rowBg}">
        <div style="min-width:52px;text-align:center">
          <div style="font-size:9px;color:${slotColor};font-family:'Barlow Condensed';font-weight:700;letter-spacing:1px">${slotLabel}</div>
          <div style="font-size:9px;color:var(--muted)">${fi.division?fi.division.split(' ').pop().slice(0,3).toUpperCase():''}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:${nameSize};font-weight:${isTitle||fi.isMainEvent?700:isMine?700:500}">${f1.name}${f1RStr} <span style="color:var(--muted);font-weight:400">vs</span> ${f2.name}${f2RStr}</div>
          <div style="font-size:10px;color:var(--muted)">${fmtMoney(fi.purse)}${isMine?' · <span style="color:var(--gold)">YOUR FIGHTER</span>':''}</div>
        </div>
        ${fi.result
          ? (() => {
              const w = allPool.find(r=>r.id===(fi.result==='W'?fi.fighterId:fi.opponentId));
              const winName = w ? w.first : '?';
              const label = isMine
                ? (fi.result==='W'?`<span style="color:var(--green);font-weight:700">WIN</span>`:`<span style="color:var(--red-bright);font-weight:700">LOSS</span>`)
                : `<span style="color:var(--muted)">Done</span>`;
              const detail = fi.method ? `${winName} · ${fi.method} R${fi.round||3}` : winName;
              return `<div style="text-align:right;min-width:120px">
                <div style="font-size:12px">${label}</div>
                <div style="font-size:10px;color:var(--muted)">${detail}</div>
              </div>`;
            })()
          : isMine
            ? `<div style="display:flex;gap:6px">
                <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="skipOneFight('${evt.id}','${fi.fighterId}')">Skip</button>
                <button class="btn btn-gold btn-sm" style="font-size:10px" onclick="watchOneFight('${evt.id}','${fi.fighterId}')">Watch ▶</button>
               </div>`
            : `<button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="skipOneFight('${evt.id}','${fi.fighterId}')">Resolve</button>`
        }
      </div>`;
    });
  });
  cont.innerHTML = html;
}

function skipOneFight(evtId, fighterId){
  const evt = G.schedule.find(e=>e.id===evtId);
  if(!evt) return;
  const fi = (evt.fights||[]).find(x=>x.fighterId===fighterId);
  if(!fi||fi.result) return;
  const allPool = [...G.roster,...G.opponents,...G.freeAgents];
  autoResolveFight(fi, allPool);
  renderWeekCard();
  // Check autocuts
  setTimeout(()=>{ const fl=checkAutoCuts(); if(fl.length>0) showAutoCutModal(fl); }, 100);
}

function skipAllCardFights(){
  const allPool = [...G.roster,...G.opponents,...G.freeAgents];
  _weekCardEvts.forEach(evt=>{
    (evt.fights||[]).filter(fi=>!fi.result).forEach(fi=>{
      autoResolveFight(fi, allPool);
    });
  });
  renderWeekCard();
  setTimeout(()=>{ const fl=checkAutoCuts(); if(fl.length>0) showAutoCutModal(fl); }, 100);
}

function watchOneFight(evtId, fighterId){
  closeModal('week-card-modal');
  loadFightFromCard(evtId, fighterId);
}

function watchNextCardFight(){
  const pending = _weekCardFightQueue.find(({fi})=>!fi.result);
  if(!pending){ showToast('All fights resolved.'); renderAll(); return; }
  watchOneFight(pending.evt.id, pending.fi.fighterId);
}

// ===================== FREE AGENTS =====================
function openFreeAgents(){
  // Refresh pool — only keep fighters with positive or no-fight records
  if(G.freeAgents.length < 6){
    DIVISIONS.forEach(d=>G.freeAgents.push(genFighter(false,null,d)));
  }
  // Filter: only show signable fighters (wins >= losses, or 0 fights)
  const signable = G.freeAgents.filter(f=>{
    const total = f.wins+f.losses;
    return total===0 || f.wins>=f.losses;
  });
  const fl = document.getElementById('fa-list');
  fl.innerHTML = signable.map(f=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border)">
      <div style="width:36px;height:36px;border-radius:50%;background:${f.color};display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bebas Neue';font-size:12px">${f.initials}</div>
      <div style="flex:1;cursor:pointer" onclick="showFighterProfile('${f.id}')">
        <div style="font-weight:600">${f.name} ${f.nationality?.flag||''} <span style="font-size:10px;color:var(--muted)">▸ profile</span></div>
        ${f.nickname?`<div style="font-size:10px;color:var(--gold);font-style:italic">${f.nickname}</div>`:''}
        <div style="font-size:11px;color:var(--muted)">${f.division} · ${f.wins}-${f.losses} · ${f.style} · RTG ${f.rating}</div>
        ${(f.wins+f.losses>0&&f.wins/(f.wins+f.losses)<0.5)?'<div style="font-size:10px;color:var(--red-bright);margin-top:2px">⚠ Below signing standard (min 0.5 W/L)</div>':''}
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:var(--gold)">${fmtMoney(f.salary)}/wk</div>
        <button class="btn btn-green btn-sm" style="margin-top:4px" onclick="signFighter('${f.id}')">Sign</button>
      </div>
    </div>`).join('') || '<div style="color:var(--muted);padding:20px;text-align:center">No eligible free agents available (min 0.5 W/L required)</div>';
  document.getElementById('free-agent-modal').classList.add('open');
}

function meetsSigningStandard(f){
  // Signed fighters must have at least 0.5 W/L ratio (or 0 fights = OK)
  const total = f.wins + f.losses;
  if(total === 0) return true;
  return f.wins / total >= 0.5;
}

function signFighter(id){
  const idx = G.freeAgents.findIndex(f=>f.id===id);
  if(idx===-1) return;
  const f = G.freeAgents[idx];
  if(!meetsSigningStandard(f)){
    showToast(f.name+' has a losing record and cannot be signed (min 0.5 W/L).');
    return;
  }
  G.roster.push(f);
  // Keep in opponents pool so they remain visible in world rankings
  if(!G.opponents.find(x=>x.id===f.id)) G.opponents.push(f);
  G.freeAgents.splice(idx,1);
  addNews(`Signed ${f.name} (${f.division}, ${f.wins}-${f.losses}) to ${G.agencyName||'the agency'}`, G.week);
  showToast(f.name+' signed!');
  closeModal('free-agent-modal');
  renderAll();
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT DISPLAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function sBar(label, val, color, compact=false){
  const pct = clamp(val,0,99);
  const grade = val>=85?'S':val>=75?'A':val>=65?'B':val>=55?'C':val>=45?'D':'F';
  const gradeColor = val>=85?'#F0B820':val>=75?'#58D68D':val>=65?'#5DADE2':val>=55?'#BDC3C7':val>=45?'#E67E22':'#E74C3C';
  if(compact){
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
      <div style="width:100px;font-size:10px;color:var(--muted);flex-shrink:0">${label}</div>
      <div style="flex:1;background:var(--bg4);height:4px;border-radius:2px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:2px"></div>
      </div>
      <div style="width:20px;text-align:right;font-size:10px;font-weight:600;color:${gradeColor}">${grade}</div>
      <div style="width:20px;text-align:right;font-size:10px;color:var(--muted)">${val}</div>
    </div>`;
  }
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
    <div style="width:130px;font-size:11px;color:var(--muted);flex-shrink:0">${label}</div>
    <div style="flex:1;background:var(--bg4);height:5px;border-radius:2px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:2px"></div>
    </div>
    <div style="width:20px;text-align:right;font-size:11px;font-weight:700;color:${gradeColor}">${grade}</div>
    <div style="width:24px;text-align:right;font-size:11px;color:var(--muted)">${val}</div>
  </div>`;
}

function sSection(title, color, rows, compact=false){
  return `<div style="margin-bottom:${compact?'10':'14'}px">
    <div style="font-size:10px;color:${color};letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">${title}</div>
    ${rows}
  </div>`;
}

function buildStatsHTML(f){
  const s = f.stats;
  const condColor = f.condition>70?'var(--green)':f.condition>40?'var(--orange)':'var(--red-bright)';
  const consec = G.consecutiveLosses[f.id]||0;

  // Pillar tabs state stored on window to avoid closure issues
  const tabId = 'ptab_'+f.id;
  if(!window._profileTab) window._profileTab = {};
  const activeTab = window._profileTab[tabId] || 'grappling';

  function tabBtn(id, label){
    const active = activeTab===id;
    return `<button onclick="window._profileTab['${tabId}']='${id}';showFighterProfile('${f.id}')"
      style="background:${active?'var(--gold)':'transparent'};color:${active?'#000':'var(--muted)'};border:1px solid ${active?'var(--gold)':'var(--border)'};font-family:'Barlow Condensed';font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;cursor:pointer;border-radius:2px">${label}</button>`;
  }

  let tabContent = '';
  if(activeTab==='grappling' && s){
    tabContent = `
      ${sSection('Takedowns','#3498DB',
        sBar('Single Leg',s.grap.td.sl_td,'#3498DB')+
        sBar('Cage Single Leg',s.grap.td.cage_sl_td,'#3498DB')+
        sBar('Double Leg',s.grap.td.dl_td,'#3498DB')+
        sBar('Cage Double Leg',s.grap.td.cage_dl_td,'#3498DB')+
        sBar('Upper Body',s.grap.td.ub_td,'#3498DB')+
        sBar('Blast Double',s.grap.td.blast_dl,'#3498DB'))}
      ${sSection('Takedown Defense','#5DADE2',
        sBar('Single Leg Def',s.grap.td_def.sl_def,'#5DADE2')+
        sBar('Cage SL Def',s.grap.td_def.cage_sl_def,'#5DADE2')+
        sBar('Double Leg Def',s.grap.td_def.dl_def,'#5DADE2')+
        sBar('Cage DL Def',s.grap.td_def.cage_dl_def,'#5DADE2')+
        sBar('Upper Body Def',s.grap.td_def.ub_def,'#5DADE2')+
        sBar('Blast Double Def',s.grap.td_def.blast_def,'#5DADE2'))}
      ${sSection('Submission Offense','#9B59B6',
        sBar('Chokes',s.grap.sub_off.chokes,'#9B59B6')+
        sBar('Joint Locks',s.grap.sub_off.joint_locks,'#9B59B6')+
        sBar('Leg Locks',s.grap.sub_off.leg_locks,'#9B59B6'))}
      ${sSection('Submission Defense','#BB8FCE',
        sBar('Choke Defense',s.grap.sub_def.choke_def,'#BB8FCE')+
        sBar('Joint Lock Defense',s.grap.sub_def.joint_def,'#BB8FCE')+
        sBar('Leg Lock Defense',s.grap.sub_def.leg_def,'#BB8FCE'))}
      ${sSection('Clinch Grappling','#1ABC9C',
        sBar('Control',s.grap.clinch.control,'#1ABC9C')+
        sBar('Transitions',s.grap.clinch.transitions,'#1ABC9C')+
        sBar('Dirty Boxing',s.grap.clinch.dirty_boxing,'#1ABC9C')+
        sBar('Clinch Takedowns',s.grap.clinch.clinch_td,'#1ABC9C'))}
      ${sSection('Ground Control','#16A085',
        sBar('Top Control',s.grap.ground.top_ctrl,'#16A085')+
        sBar('Bottom Control',s.grap.ground.bottom_ctrl,'#16A085')+
        sBar('Scrambling',s.grap.ground.scrambling,'#16A085')+
        sBar('Wrestling Get-Up',s.grap.ground.wrestling_getup||55,'#16A085')+
        sBar('BJJ Get-Up',s.grap.ground.bjj_getup||55,'#16A085')+
        sBar('Wrestling Transitions',s.grap.ground.wrestling_trans||55,'#16A085')+
        sBar('BJJ Transitions',s.grap.ground.bjj_trans||55,'#16A085'))})`;
  } else if(activeTab==='striking' && s){
    tabContent = `
      ${sSection('Boxing','#E74C3C',
        sBar('Jab',s.str.boxing.jab,'#E74C3C')+
        sBar('Cross',s.str.boxing.cross,'#E74C3C')+
        sBar('Hooks',s.str.boxing.hooks,'#E74C3C')+
        sBar('Uppercuts',s.str.boxing.uppercuts,'#E74C3C')+
        sBar('Overhands',s.str.boxing.overhands,'#E74C3C')+
        sBar('Head Movement',s.str.boxing.head_mov,'#E74C3C')+
        sBar('Blocking',s.str.boxing.blocking,'#E74C3C')+
        sBar('Power',s.str.boxing.power||55,'#C0392B')+
        sBar('Counters',s.str.boxing.counters||55,'#922B21'))}
      ${sSection('Kicking','#E67E22',
        sBar('Low Kicks',s.str.kicking.low_kicks,'#E67E22')+
        sBar('Body Kicks',s.str.kicking.body_kicks,'#E67E22')+
        sBar('Teep (Front Kick)',s.str.kicking.teep,'#E67E22')+
        sBar('Kick Defense',s.str.kicking.kick_def,'#E67E22')+
        sBar('Power',s.str.kicking.power||55,'#D35400'))}
      ${sSection('Clinch Striking','#C0392B',
        sBar('Knees',s.str.clinch_str.knees,'#C0392B')+
        sBar('Elbows',s.str.clinch_str.elbows,'#C0392B')+
        sBar('Clinch Defense',s.str.clinch_str.clinch_str_def,'#C0392B'))}
      ${sSection('Ground Striking','#922B21',
        sBar('Ground Strikes',s.str.ground_str.gnd_strikes,'#922B21')+
        sBar('Ground Defense',s.str.ground_str.gnd_def,'#922B21')+
        sBar('Ground Elbows',s.str.ground_str.gnd_elbows,'#922B21'))}`;
  } else if(activeTab==='physicals' && s){
    tabContent = `
      ${sSection('Strength & Speed','#F0B820',
        sBar('Strength',s.phys.strength,'#F0B820')+
        sBar('Hand Speed',s.phys.hand_speed,'#F0B820')+
        sBar('Movement Speed',s.phys.move_speed,'#F0B820')+
        sBar('Reaction Time',s.phys.reaction,'#F0B820'))}
      ${sSection('Endurance','#27AE60',
        sBar('Cardio',s.phys.cardio,'#27AE60')+
        sBar('Recovery Rate',s.phys.recovery,'#27AE60'))}
      ${sSection('Durability','#7F8C8D',
        sBar('Chin',s.phys.chin,'#7F8C8D')+
        sBar('Body Toughness',s.phys.body_tough,'#7F8C8D')+
        sBar('Leg Durability',s.phys.leg_dur,'#7F8C8D')+
        sBar('Injury Resistance',s.phys.inj_res,'#7F8C8D'))}`;
  } else if(activeTab==='mental' && s){
    tabContent = `
      ${sSection('Mental Attributes','#9B59B6',
        sBar('Fight IQ',s.ment.fight_iq,'#9B59B6')+
        sBar('Decision Making',s.ment.decision,'#9B59B6')+
        sBar('Composure',s.ment.composure,'#9B59B6')+
        sBar('Aggression',s.ment.aggression,'#9B59B6')+
        sBar('Adaptive Ability',s.ment.adaptive,'#9B59B6'))}`;
  } else if(activeTab==='overview'){
    const p = getPillarScores(f);
    tabContent = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="background:var(--bg3);border-radius:4px;padding:12px;border-left:3px solid #3498DB">
          <div style="font-size:11px;color:#5DADE2;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Grappling</div>
          ${!s?'<div style="color:var(--muted);font-size:12px">No data</div>':
            sBar('Takedowns',Math.round(avg2(...Object.values(s.grap.td))),'#3498DB',true)+
            sBar('TD Defense',Math.round(avg2(...Object.values(s.grap.td_def))),'#5DADE2',true)+
            sBar('Submissions',Math.round(avg2(...Object.values(s.grap.sub_off))),'#9B59B6',true)+
            sBar('Sub Defense',Math.round(avg2(...Object.values(s.grap.sub_def))),'#BB8FCE',true)+
            sBar('Clinch Grap',Math.round(avg2(...Object.values(s.grap.clinch))),'#1ABC9C',true)+
            sBar('Ground Ctrl',Math.round(avg2(...Object.values(s.grap.ground))),'#16A085',true)}
        </div>
        <div style="background:var(--bg3);border-radius:4px;padding:12px;border-left:3px solid #E74C3C">
          <div style="font-size:11px;color:#E74C3C;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Striking</div>
          ${!s?'<div style="color:var(--muted);font-size:12px">No data</div>':
            sBar('Boxing',Math.round(avg2(...Object.values(s.str.boxing))),'#E74C3C',true)+
            sBar('Kicking',Math.round(avg2(...Object.values(s.str.kicking))),'#E67E22',true)+
            sBar('Clinch Str.',Math.round(avg2(...Object.values(s.str.clinch_str))),'#C0392B',true)+
            sBar('Ground Str.',Math.round(avg2(...Object.values(s.str.ground_str))),'#922B21',true)}
        </div>
        <div style="background:var(--bg3);border-radius:4px;padding:12px;border-left:3px solid #F0B820">
          <div style="font-size:11px;color:#F0B820;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Physicals</div>
          ${!s?'<div style="color:var(--muted);font-size:12px">No data</div>':
            sBar('Strength',s.phys.strength,'#F0B820',true)+
            sBar('Hand Speed',s.phys.hand_speed,'#F0B820',true)+
            sBar('Move Speed',s.phys.move_speed,'#F0B820',true)+
            sBar('Cardio',s.phys.cardio,'#27AE60',true)+
            sBar('Chin',s.phys.chin,'#7F8C8D',true)+
            sBar('Body Tough',s.phys.body_tough,'#7F8C8D',true)}
        </div>
        <div style="background:var(--bg3);border-radius:4px;padding:12px;border-left:3px solid #9B59B6">
          <div style="font-size:11px;color:#9B59B6;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Mental</div>
          ${!s?'<div style="color:var(--muted);font-size:12px">No data</div>':
            sBar('Fight IQ',s.ment.fight_iq,'#9B59B6',true)+
            sBar('Decision',s.ment.decision,'#9B59B6',true)+
            sBar('Composure',s.ment.composure,'#9B59B6',true)+
            sBar('Aggression',s.ment.aggression,'#9B59B6',true)+
            sBar('Adaptive',s.ment.adaptive,'#9B59B6',true)}
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:4px;padding:12px">
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div><span style="color:var(--muted);font-size:11px">Stance: </span><span style="font-weight:600">${f.stance||'Orthodox'}</span></div>
          <div><span style="color:var(--muted);font-size:11px">Condition: </span><span style="color:${condColor};font-weight:600">${f.condition}%</span></div>
          <div><span style="color:var(--muted);font-size:11px">Morale: </span><span style="font-weight:600">${f.morale||75}%</span></div>
          <div><span style="color:var(--muted);font-size:11px">KO Wins: </span><span style="color:var(--red-bright);font-weight:600">${f.koWins||0}</span></div>
          <div><span style="color:var(--muted);font-size:11px">Subs: </span><span style="color:#9B59B6;font-weight:600">${f.subWins||0}</span></div>
          <div><span style="color:var(--muted);font-size:11px">Decisions: </span><span style="color:#3498DB;font-weight:600">${f.decWins||0}</span></div>
          ${consec>0?`<div style="color:var(--red-bright);font-size:11px">⚠ ${consec} straight loss${consec>1?'es':''}</div>`:''}
          ${f.potential?`<div style="color:#9B59B6;font-size:11px">Ceiling: ${f.potential}</div>`:''}
        </div>
      </div>`;
  }

  return `<div style="margin-bottom:16px">
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      ${tabBtn('overview','Overview')}
      ${tabBtn('grappling','Grappling')}
      ${tabBtn('striking','Striking')}
      ${tabBtn('physicals','Physicals')}
      ${tabBtn('mental','Mental')}
    </div>
    <div>${tabContent}</div>
  </div>`;
}

// ===================== FIGHT LOG VIEWER =====================
function showFightLog(fighterId, histIdx){
  const f = [...G.roster,...G.opponents,...G.freeAgents,...G.prospects].find(x=>x.id===fighterId);
  if(!f||!f.fightHistory||f.fightHistory.length===0){ showToast('No fight history.'); return; }
  const h = f.fightHistory[histIdx||0];
  if(!h){ showToast('Fight not found.'); return; }

  const titleEl = document.getElementById('flog-title');
  const subEl = document.getElementById('flog-subtitle');
  const contEl = document.getElementById('fight-log-content');
  if(!titleEl||!subEl||!contEl) return;

  const resultColor = h.result==='W' ? 'var(--green)' : 'var(--red-bright)';
  const resultLabel = h.result==='W' ? 'WIN' : 'LOSS';
  titleEl.innerHTML = `<span style="color:${resultColor}">${resultLabel}</span> — ${f.first} vs ${h.opponent}`;
  subEl.textContent = `Week ${h.week} · ${h.method} · Round ${h.round}`;

  let html = '';

  // ── Stats comparison ──────────────────────────────────────────────────────
  const fs = h.stats || {};
  const os = h.oppStats || {};
  function statCompRow(label, fVal, oVal){
    const total = (fVal||0)+(oVal||0)||1;
    const fPct = Math.round((fVal||0)/total*100);
    const oPct = 100-fPct;
    return `<div class="flog-stat-row">
      <span style="font-weight:600;color:${fVal>=oVal?'var(--text)':'var(--muted)'}">${fVal||0}</span>
      <span style="color:var(--muted);font-size:11px">${label}</span>
      <span style="font-weight:600;color:${oVal>fVal?'var(--text)':'var(--muted)'}">${oVal||0}</span>
    </div>
    <div class="flog-stat-bar">
      <div style="width:${fPct}%;height:100%;background:var(--gold);float:left;border-radius:2px 0 0 2px"></div>
      <div style="width:${oPct}%;height:100%;background:#444;float:right;border-radius:0 2px 2px 0"></div>
    </div>`;
  }

  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:10px 14px;background:var(--bg3);border-radius:4px">
    <div style="text-align:left">
      <div style="font-family:'Bebas Neue';font-size:18px;color:var(--gold)">${f.first}</div>
      <div style="font-size:11px;color:var(--muted)">Your Fighter</div>
    </div>
    <div style="text-align:center">
      <div style="font-family:'Bebas Neue';font-size:26px;color:${resultColor}">${resultLabel}</div>
      <div style="font-size:11px;color:var(--muted)">${h.method}</div>
    </div>
    <div style="text-align:right">
      <div style="font-family:'Bebas Neue';font-size:18px;color:var(--muted)">${h.opponent.split(' ')[0]}</div>
      <div style="font-size:11px;color:var(--muted)">Opponent</div>
    </div>
  </div>`;

  if(fs.strikes !== undefined){
    html += `<div class="flog-stat-grid">
      <div class="flog-stat-box">
        <div class="flog-stat-label">Striking</div>
        ${statCompRow('Total Strikes', fs.strikes, os.strikes)}
        ${statCompRow('Sig. Strikes', fs.sigStrikes, os.sigStrikes)}
        ${statCompRow('Knockdowns', fs.knockdowns, os.knockdowns)}
      </div>
      <div class="flog-stat-box">
        <div class="flog-stat-label">Grappling</div>
        ${statCompRow('Takedowns', fs.takedowns, os.takedowns)}
        ${statCompRow('TD Attempts', fs.tdAttempts, os.tdAttempts)}
        ${statCompRow('Ctrl (sec)', fs.ctrlSeconds, os.ctrlSeconds)}
      </div>
    </div>`;
  } else {
    html += `<div style="color:var(--muted);font-size:12px;margin-bottom:16px;padding:10px;background:var(--bg3);border-radius:4px">This was a simulated fight — stats are estimated.</div>`;
  }

  // ── Round-by-round log ────────────────────────────────────────────────────
  if(h.roundLog && h.roundLog.length > 0){
    html += `<div style="margin-top:4px">`;
    h.roundLog.forEach(rd=>{
      const sc = rd.scorecard;
      let roundLabel = `Round ${rd.r}`;
      let scorecardHTML = '';
      if(rd.finished && rd.winner){
        roundLabel += ` — ${rd.method} (${rd.winner.split(' ')[0]})`;
      } else if(sc){
        const fS = sc.fDmg*0.6+sc.fCtrl*0.2+sc.fAgg*0.2;
        const oS = sc.oDmg*0.6+sc.oCtrl*0.2+sc.oAgg*0.2;
        const wName = fS>=oS ? f.first : h.opponent.split(' ')[0];
        scorecardHTML = `<span style="font-size:11px;color:var(--muted)">${wName} scored</span>`;
      }
      html += `<div style="margin-bottom:12px">
        <div class="flog-round-header">
          <span>${roundLabel}</span>
          ${scorecardHTML}
        </div>`;
      const actions = rd.actions || [];
      if(actions.length===0){
        html += `<div class="flog-action">No action data recorded.</div>`;
      } else {
        actions.forEach(a=>{
          if(!a.html) return;
          // Strip HTML tags for display but preserve the content
          const raw = a.html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
          const isFinish = a.html.includes('log-finish');
          const isHit = a.html.includes('log-hit');
          html += `<div class="flog-action ${isFinish?'finish':isHit?'hit':''}">${raw}</div>`;
        });
      }
      html += `</div>`;
    });
    html += `</div>`;
  } else {
    html += `<div style="color:var(--muted);font-size:12px;padding:10px;background:var(--bg3);border-radius:4px">Round-by-round log not available for this fight.</div>`;
  }

  contEl.innerHTML = html;
  openModal('fight-log-modal');
}

// ===================== FIGHTER PROFILE =====================