// ═══════════════════════════════════════════════════════════════════════════
// IRON CAGE — MMA Manager
// ui.js — Fighter profile modal, settings page, God Mode, export/import
// ═══════════════════════════════════════════════════════════════════════════

function showFighterProfile(id){
  // Search all pools
  const f = [...G.roster, ...G.opponents, ...G.freeAgents, ...G.prospects].find(x=>x.id===id);
  if(!f) return;
  const isMine = !!G.roster.find(x=>x.id===id);
  const total = f.wins+f.losses;
  const finPct = total>0 ? Math.round(((f.koWins||0)+(f.subWins||0))/Math.max(f.wins,1)*100) : 0;
  const ratio = total>0 ? (f.wins/(f.losses||1)).toFixed(1) : '—';
  const consec = G.consecutiveLosses[f.id]||0;

  const content = document.getElementById('fighter-profile-content');
  content.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar" style="background:${f.color};color:#fff">${f.initials}</div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div class="profile-name">${f.name}</div>
          <span style="font-size:20px">${f.nationality?.flag||''}</span>
          ${f.isChamp?'<span class="badge badge-gold">🏆 CHAMPION</span>':''}
          ${f.isProspect?'<span class="badge badge-blue">PROSPECT</span>':''}
        </div>
        ${f.nickname?`<div class="profile-nickname">${f.nickname}</div>`:''}
        <div class="profile-meta">${(()=>{
          const age=f.age||25, fights=(f.wins||0)+(f.losses||0);
          const inDecline=age>=34||fights>=28, inYouth=age<24;
          const ageColor=inDecline?'var(--orange)':inYouth?'#5DADE2':'var(--text)';
          const ageLabel=inDecline?'⏳ ':'';
          const ageSpan='<span style="color:'+ageColor+'">'+ageLabel+'Age '+age+'</span>';
          return f.nationality?.display+' · '+(f.stance||'Orthodox')+' · '+f.style+' · '+f.division+' · '+ageSpan;
        })()}</div>
        <div class="profile-meta" style="margin-top:2px">${f.height?`${Math.floor(f.height/12)}'${f.height%12}" · Reach ${f.reach}"`:''}</div>
        <div style="margin-top:6px;display:flex;align-items:center;gap:8px">
          <div style="font-size:10px;color:var(--muted);letter-spacing:1px;font-family:'Barlow Condensed';font-weight:600">POPULARITY</div>
          <div style="flex:1;background:var(--bg4);height:6px;border-radius:3px;max-width:140px">
            <div style="height:100%;border-radius:3px;background:${computePopularity(f)>70?'var(--gold)':computePopularity(f)>40?'var(--orange)':'var(--muted)'};width:${computePopularity(f)}%"></div>
          </div>
          <div style="font-family:'Barlow Condensed';font-size:14px;font-weight:700;color:var(--gold)">${computePopularity(f)}</div>
        </div>
        <div class="profile-meta" style="margin-top:4px">${fmtMoney(f.salary)}/week · Contract: ${f.contract} yrs</div>
      </div>
      <button onclick="closeModal('fighter-profile-modal')" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;align-self:flex-start">✕</button>
    </div>

    <div class="profile-stats-grid">
      <div class="profile-stat-box">
        <div class="profile-stat-num">${f.wins}</div>
        <div class="profile-stat-lbl">Wins</div>
      </div>
      <div class="profile-stat-box">
        <div class="profile-stat-num" style="color:var(--red-bright)">${f.losses}</div>
        <div class="profile-stat-lbl">Losses</div>
      </div>
      <div class="profile-stat-box">
        <div class="profile-stat-num">${ratio}</div>
        <div class="profile-stat-lbl">W/L Ratio</div>
      </div>
      <div class="profile-stat-box">
        <div class="profile-stat-num">${finPct}%</div>
        <div class="profile-stat-lbl">Finish Rate</div>
      </div>
    </div>

    ${buildStatsHTML(f)}

    <div>
      <div style="font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;font-weight:600">Fight History</div>
      ${(f.fightHistory&&f.fightHistory.length>0) ? f.fightHistory.slice(0,50).map((h,idx)=>`
        <div class="history-row">
          <div class="result-pill result-${h.result.toLowerCase()}">${h.result}</div>
          <div style="flex:1">
            <span style="font-weight:600">${h.opponent}</span>
            <span style="color:var(--muted)"> · ${h.method} · R${h.round}</span>
            ${h.stats?`<span style="font-size:10px;color:var(--muted)"> · ${h.stats.strikes||0}str ${h.stats.takedowns||0}td</span>`:''}
          </div>
          <div style="color:var(--muted);font-size:11px">Wk ${h.week}</div>
          ${h.result==='W'&&h.purse?`<div style="color:var(--gold);font-family:'Barlow Condensed';font-size:13px;min-width:60px;text-align:right">+${fmtMoney(h.purse)}</div>`:''}
          <button onclick="closeModal('fighter-profile-modal');showFightLog('${f.id}',${idx})" style="background:none;border:1px solid var(--border);color:var(--muted);font-size:10px;padding:2px 8px;border-radius:2px;cursor:pointer;font-family:'Barlow Condensed';letter-spacing:1px;text-transform:uppercase;flex-shrink:0">Log</button>
        </div>`).join('') : '<div style="color:var(--muted);font-size:12px;padding:12px 0">No recorded fights yet.</div>'}>

    </div>`;

  const actions = document.getElementById('fighter-profile-actions');
  if(actions){
    actions.innerHTML = '';
    if(isMine){
      actions.innerHTML = `
        <button class="btn btn-ghost" onclick="closeModal('fighter-profile-modal');showPage('training');selectFighter('${f.id}')">Train</button>
        <button class="btn btn-ghost" onclick="closeModal('fighter-profile-modal');openMatchmaking('${f.id}')">Matchmake</button>
        ${(()=>{
          const lastP = f._lastPromoWeek||0;
          const wLeft = 4-(G.week-lastP);
          return lastP>0&&wLeft>0
            ? `<button class="btn btn-ghost btn-sm" disabled title="Available in ${wLeft} week${wLeft>1?'s':''}">📣 Promote (${wLeft}w)</button>`
            : `<button class="btn btn-blue btn-sm" onclick="promoteFighterToPool('${f.id}')" title="Boost popularity — costs $5,000">📣 Promote (+pop)</button>`;
        })()}
        <button class="btn btn-red btn-sm" onclick="confirmCutAndClose('${f.id}')">Release</button>`;
    } else if(G.freeAgents.find(x=>x.id===id)){
      actions.innerHTML = `<button class="btn btn-green" onclick="closeModal('fighter-profile-modal');signFighter('${f.id}')">Sign Fighter</button>`;
    } else if(G.prospects.find(x=>x.id===id)){
      actions.innerHTML = `<button class="btn btn-gold" onclick="closeModal('fighter-profile-modal');signProspect('${f.id}')">Sign Prospect</button>`;
    }
  }
  openModal('fighter-profile-modal');
}

// ===================== UI HELPERS =====================
function showPage(id){
  // Matchmaking tab: nothing special needed — fight is a separate modal
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id)?.classList.add('active');
  const tabs = ['dashboard','organization','rankings','prospects','training','matchmaking','fight','schedule'];
  const tabEl = document.querySelectorAll('.nav-tab')[tabs.indexOf(id)];
  if(tabEl) tabEl.classList.add('active');
  if(id==='matchmaking') renderMatchmaking();
  if(id==='fight') renderFightPage();
  if(id==='organization') renderOrganization();
  if(id==='rankings') renderRankings();
  if(id==='prospects') renderProspects();
}

function openModal(id){ const m=document.getElementById(id); if(m) m.classList.add('open'); }
function closeModal(id){ const m=document.getElementById(id); if(m) m.classList.remove('open'); }

let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 3000);
}

// Close modal on bg click
document.querySelectorAll('.modal-bg').forEach(m=>{
  m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('open'); });
});

init();

// ─────────────────────────────────────────────────────────────────────────────
// ⚡ GOD MODE — Settings & Theme Engine
// ─────────────────────────────────────────────────────────────────────────────

// ── DATA IMPORT / EXPORT ──────────────────────────────────────────────────────
function exportData(){
  const payload = {
    version: 1,
    week: G.week,
    money: G.money,
    rep: G.rep,
    agencyName: G.agencyName,
    totalWins: G.totalWins,
    totalLosses: G.totalLosses,
    roster:     G.roster,
    opponents:  G.opponents,
    freeAgents: G.freeAgents,
    prospects:  G.prospects,
    schedule:   G.schedule,
    news:       G.news,
    consecutiveLosses: G.consecutiveLosses,
    trainingSelections: G.trainingSelections,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ironcage_save_week${G.week}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Save exported — ironcage_save_week' + G.week + '.json');
}

function importData(evt){
  const file = evt.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    try {
      const data = JSON.parse(e.target.result);
      if(!data.roster || !data.opponents){ throw new Error('Invalid save file — missing fighter data.'); }
      // Restore all fields
      G.week     = data.week    || G.week;
      G.money    = data.money   || G.money;
      G.rep      = data.rep     || G.rep;
      G.agencyName = data.agencyName || G.agencyName;
      G.totalWins  = data.totalWins  || 0;
      G.totalLosses= data.totalLosses|| 0;
      G.roster     = data.roster;
      G.opponents  = data.opponents;
      G.freeAgents = data.freeAgents || [];
      G.prospects  = data.prospects  || [];
      G.schedule   = data.schedule   || [];
      G.news       = data.news       || [];
      G.consecutiveLosses  = data.consecutiveLosses  || {};
      G.trainingSelections = data.trainingSelections || {};
      const st = document.getElementById('import-status');
      if(st) st.innerHTML = `<span style="color:var(--green)">✓ Save loaded — Week ${G.week}, ${G.roster.length} fighters on roster.</span>`;
      renderAll();
      showToast('Save imported successfully!');
    } catch(err){
      const st = document.getElementById('import-status');
      if(st) st.innerHTML = `<span style="color:var(--red-bright)">✗ Error: ${err.message}</span>`;
      showToast('Import failed: ' + err.message);
    }
    evt.target.value = ''; // reset file input
  };
  reader.readAsText(file);
}

let G_godMode = false;
let G_theme = 'default';

function setTheme(theme){
  G_theme = theme;
  document.documentElement.setAttribute('data-theme', theme === 'default' ? '' : theme);
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('active', b.dataset.theme===theme));
  localStorage.setItem('ic_theme', theme);
}

function toggleGodMode(){
  G_godMode = !G_godMode;
  const knob  = document.getElementById('god-toggle-knob');
  const wrap  = document.getElementById('god-toggle-wrap');
  const lbl   = document.getElementById('god-mode-label');
  const badge = document.getElementById('god-mode-badge');
  const panel = document.getElementById('god-mode-panel');
  if(knob){ knob.style.left = G_godMode ? '23px' : '3px'; knob.style.background = G_godMode ? '#FF6B35' : 'var(--muted)'; }
  if(wrap){ wrap.style.background = G_godMode ? 'rgba(255,107,53,0.2)' : 'var(--bg4)'; wrap.style.borderColor = G_godMode ? '#FF6B35' : 'var(--border)'; }
  if(lbl)  lbl.textContent = G_godMode ? 'ON' : 'OFF';
  if(badge) badge.style.display = G_godMode ? 'inline-block' : 'none';
  if(panel) panel.style.display = G_godMode ? 'block' : 'none';
  if(G_godMode) godRefreshDropdowns();
}

function godRefreshDropdowns(){
  const allPool = [...new Map([...G.roster,...G.opponents,...G.freeAgents,...G.prospects].map(f=>[f.id,f])).values()];
  const sorted = [...allPool].sort((a,b)=>a.name.localeCompare(b.name));
  const optHTML = sorted.map(f=>`<option value="${f.id}">${f.name} (${f.division})</option>`).join('');

  // Fighter dropdowns
  ['god-f1','god-f2','god-edit-fighter','god-rank-fighter'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.innerHTML = `<option value="">Select...</option>` + optHTML; }
  });

  // Event dropdown
  const evtEl = document.getElementById('god-card-event');
  if(evtEl){
    const future = G.schedule.filter(e=>e.week>=G.week);
    evtEl.innerHTML = `<option value="">Select Event...</option>` +
      future.map(e=>`<option value="${e.id}">Wk ${e.week} — ${e.name}</option>`).join('');
  }
}

function godRenderCardPreview(){
  const preview = document.getElementById('god-card-fights-preview');
  if(!preview) return;
  const evtId = document.getElementById('god-card-event')?.value;
  if(!evtId){ preview.innerHTML = '<span style="color:var(--muted)">Select an event to see and remove fights.</span>'; return; }
  const evt = G.schedule.find(e=>e.id===evtId);
  if(!evt||!evt.fights||evt.fights.length===0){ preview.innerHTML = '<span style="color:var(--muted)">No fights on this card yet.</span>'; return; }
  const allPool = [...new Map([...G.roster,...G.opponents,...G.freeAgents,...G.prospects].map(f=>[f.id,f])).values()];
  preview.innerHTML = evt.fights.map((fi,idx)=>{
    const f1 = allPool.find(r=>r.id===fi.fighterId);
    const f2 = allPool.find(r=>r.id===fi.opponentId);
    const label = fi.isTitleFight?'TITLE':fi.isMainEvent?'MAIN':fi.slot==='co_main'?'CO-MAIN':'PRELIM';
    const result = fi.result ? ` · <span style="color:var(--muted)">${fi.result} (${fi.method||'?'})</span>` : '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:9px;color:var(--gold);font-family:'Barlow Condensed';font-weight:700;min-width:52px">${label}</span>
      <span style="flex:1;font-size:12px">${f1?f1.name:'?'} vs ${f2?f2.name:'?'}${result}</span>
      ${!fi.result?`<button class="btn btn-red btn-sm" style="font-size:10px;padding:2px 8px" onclick="godRemoveFight('${evt.id}','${fi.id}')">✕ Remove</button>`:'<span style="font-size:10px;color:var(--muted)">Resolved</span>'}
    </div>`;
  }).join('');
}

function godRemoveFight(evtId, fightId){
  if(!G_godMode) return;
  const evt = G.schedule.find(e=>e.id===evtId);
  if(!evt) return;
  evt.fights = (evt.fights||[]).filter(fi=>fi.id!==fightId);
  showToast('Fight removed from card.');
  godRenderCardPreview();
  renderAll();
}

function godAddFight(){
  if(!G_godMode) return;
  const evtId = document.getElementById('god-card-event')?.value;
  const f1id  = document.getElementById('god-f1')?.value;
  const f2id  = document.getElementById('god-f2')?.value;
  const slot  = document.getElementById('god-slot')?.value || 'undercard';
  if(!evtId||!f1id||!f2id){ showToast('Select an event and both fighters.'); return; }
  if(f1id===f2id){ showToast('Cannot match a fighter against themselves.'); return; }
  const evt = G.schedule.find(e=>e.id===evtId);
  if(!evt){ showToast('Event not found.'); return; }
  const allPool = [...new Map([...G.roster,...G.opponents,...G.freeAgents,...G.prospects].map(f=>[f.id,f])).values()];
  const f1 = allPool.find(f=>f.id===f1id);
  const f2 = allPool.find(f=>f.id===f2id);
  if(!f1||!f2){ showToast('Fighter data missing.'); return; }
  const isTitle = slot==='title', isMain = slot==='main_event';
  const purse = isTitle?rnd(80000,200000):isMain?rnd(30000,80000):slot==='co_main'?rnd(15000,35000):rnd(6000,18000);
  if(!evt.fights) evt.fights=[];
  evt.fights.push({
    id:'f_'+Math.random().toString(36).slice(2),
    fighterId:f1.id, opponentId:f2.id,
    purse, result:null,
    isMainEvent: isMain,
    isTitleFight: isTitle,
    slot, division: f1.division
  });
  showToast(`Added: ${f1.first} vs ${f2.first} (${slot.replace('_',' ')}) to ${evt.name}`);
  godRenderCardPreview();
  renderAll();
}

function godSetRankScore(){
  if(!G_godMode) return;
  const fid   = document.getElementById('god-rank-fighter')?.value;
  const score = parseFloat(document.getElementById('god-rank-score')?.value);
  if(!fid||isNaN(score)){ showToast('Select a fighter and enter a score.'); return; }
  const allPool = [...new Map([...G.roster,...G.opponents,...G.freeAgents].map(f=>[f.id,f])).values()];
  const f = allPool.find(x=>x.id===fid);
  if(!f){ showToast('Fighter not found.'); return; }
  f._rankScore = score;
  const newRank = getRankableFighters(f.division).findIndex(r=>r.id===f.id)+1;
  const preview = document.getElementById('god-rank-preview');
  if(preview) preview.textContent = `${f.name} rank score set to ${score} — now ranked #${newRank||'NR'} in ${f.division}`;
  renderAll();
}

// Flatten all stats for editing
function godGetFlatStats(stats, prefix=''){
  const result = [];
  for(const [k,v] of Object.entries(stats)){
    const key = prefix ? prefix+'.'+k : k;
    if(typeof v==='number') result.push({key, label:k, val:v});
    else if(typeof v==='object'&&v!==null) result.push(...godGetFlatStats(v, key));
  }
  return result;
}

function godSetNestedVal(obj, path, val){
  const parts = path.split('.');
  let cur = obj;
  for(let i=0;i<parts.length-1;i++){
    if(!cur[parts[i]]) cur[parts[i]]={};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length-1]] = val;
}

function godLoadFighterStats(){
  if(!G_godMode) return;
  const fid = document.getElementById('god-edit-fighter')?.value;
  const editor = document.getElementById('god-stat-editor');
  if(!editor) return;
  if(!fid){ editor.innerHTML=''; return; }
  const allPool = [...new Map([...G.roster,...G.opponents,...G.freeAgents,...G.prospects].map(f=>[f.id,f])).values()];
  const f = allPool.find(x=>x.id===fid);
  if(!f||!f.stats){ editor.innerHTML='<div style="color:var(--muted)">No stats tree found.</div>'; return; }
  const flat = godGetFlatStats(f.stats);
  editor.innerHTML = flat.map(({key,label,val})=>`
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:3px;padding:6px 8px">
      <div style="font-size:10px;color:var(--muted);font-family:'Barlow Condensed';letter-spacing:0.5px;margin-bottom:3px">${key}</div>
      <input data-key="${key}" type="number" min="1" max="99" value="${Math.round(val)}"
        style="width:100%;background:var(--bg4);color:var(--text);border:1px solid var(--border);border-radius:2px;padding:3px 6px;font-family:'Barlow Condensed';font-size:14px;font-weight:700">
    </div>`).join('');
}

function godSaveFighterStats(){
  if(!G_godMode) return;
  const fid = document.getElementById('god-edit-fighter')?.value;
  if(!fid){ showToast('Select a fighter first.'); return; }
  const allPool = [...new Map([...G.roster,...G.opponents,...G.freeAgents,...G.prospects].map(f=>[f.id,f])).values()];
  const f = allPool.find(x=>x.id===fid);
  if(!f||!f.stats){ showToast('Fighter has no stats tree.'); return; }
  document.querySelectorAll('#god-stat-editor input[data-key]').forEach(inp=>{
    const val = clamp(parseInt(inp.value)||55, 1, 99);
    godSetNestedVal(f.stats, inp.dataset.key, val);
  });
  // Recompute rating
  f.rating = computeRating(f.stats);
  const pl = getPillarScores(f);
  f.striking=pl.striking; f.wrestling=pl.grappling;
  f.cardio=f.stats.phys.cardio; f.chin=f.stats.phys.chin;
  f.speed=Math.round(avg2(f.stats.phys.hand_speed,f.stats.phys.move_speed));
  f.power=f.stats.phys.strength;
  showToast(`${f.name}'s stats saved! New rating: ${f.rating}`);
  renderAll();
}

// Restore theme on load
function restoreSettings(){
  const saved = localStorage.getItem('ic_theme') || 'default';
  setTheme(saved);
}
