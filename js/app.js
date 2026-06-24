/* ══════════════════════════════════════
   CONFIG — Apps Script URL
══════════════════════════════════════ */
const LS_KEY        = 'mgfrog_script_url';
const LS_SONGS_KEY  = 'mgfrog_songs';
const LS_VOTES_KEY  = 'mgfrog_votes';

function saveLocal(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function loadLocal(key) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch(e) { return null; }
}

const HARDCODED_URL = 'https://script.google.com/macros/s/AKfycbyr75uhTkAWzY3qITWUwXk9a4TWbOjR88cH88TPDMVp1fnS-YOdiEwqyY1dFuc8wXQZ/exec';

let SCRIPT_URL = HARDCODED_URL || (() => {
  try { return localStorage.getItem(LS_KEY) || ''; } catch(e) { return ''; }
})();

function saveScriptUrl() {
  const v = document.getElementById('scriptUrlInput').value.trim();
  if (!v.startsWith('https://script.google.com')) {
    alert('올바른 Apps Script URL을 입력해주세요!'); return;
  }
  SCRIPT_URL = v;
  try { localStorage.setItem(LS_KEY, v); } catch(e) {}
  const status = document.getElementById('currentUrlStatus');
  status.textContent = `✅ 연결 완료: ${SCRIPT_URL.slice(0,60)}…`;
  showSync('🐸 연결 완료!', 'ok');
  switchTab('add');
  loadAll();
}

function checkSetup() {
  if (!SCRIPT_URL) switchTab('setup');
}

/* ══════════════════════════════════════
   API HELPERS
══════════════════════════════════════ */
async function api(params) {
  if (!SCRIPT_URL) return null;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SCRIPT_URL}?${qs}`);
  return res.json();
}

async function apiPost(body) {
  if (!SCRIPT_URL) return null;
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.json();
}

let syncTimer;
function showSync(msg, type = '') {
  const bar = document.getElementById('syncBar');
  bar.textContent = msg;
  bar.className = 'sync-bar' + (type ? ' ' + type : '');
  bar.style.display = 'block';
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => bar.style.display = 'none', 2500);
}

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let songs     = [];
let votes     = {};
let auditions = [];
let audVotes  = {};
let members   = [
  {idx:0, name:'멤버1', position:'보컬',    quote:'한마디를 입력해주세요!', photo:null},
  {idx:1, name:'멤버2', position:'기타',    quote:'한마디를 입력해주세요!', photo:null},
  {idx:2, name:'멤버3', position:'기타2',   quote:'한마디를 입력해주세요!', photo:null},
  {idx:3, name:'멤버4', position:'베이스',  quote:'한마디를 입력해주세요!', photo:null},
  {idx:4, name:'멤버5', position:'드럼',    quote:'한마디를 입력해주세요!', photo:null},
  {idx:5, name:'멤버6', position:'키보드',  quote:'한마디를 입력해주세요!', photo:null},
  {idx:6, name:'멤버7', position:'보컬2',   quote:'한마디를 입력해주세요!', photo:null},
  {idx:7, name:'멤버8', position:'베이스2', quote:'한마디를 입력해주세요!', photo:null},
];

let currentVoter = null;
let audVoter     = null;
let editingIdx   = null;

const HISTORY = [
  { year: '2024 겨울', songs: [
    {name: '예뻤어',  artist: '데이식스',   done: true},
    {name: '고백',    artist: '델리스파이스', done: true},
  ]},
  { year: '2025 여름', songs: [
    {name: 'antifreeze',       artist: '검정치마', done: false, note: '중도 하차'},
    {name: '너에게 닿기를',    artist: '10cm',     done: false, note: '중도 하차'},
    {name: '고민중독(이홍기)', artist: 'QWER',     done: false, note: '중도 하차'},
    {name: '뭐라할까',         artist: '브리즈',   done: true},
    {name: '나는 나비',         artist: 'YB',       done: true},
    {name: '나에게로 떠나는 여행', artist: '버즈',  done: true},
  ]},
  { year: '2025 겨울', songs: [
    {name: '어쩌다 가끔씩', artist: 'AMP',       done: true},
    {name: '그대 입술이',   artist: '버스커버스커', done: true},
  ]},
];

/* ══════════════════════════════════════
   LOAD ALL DATA
══════════════════════════════════════ */
async function loadAll() {
  if (!SCRIPT_URL) {
    const ls = loadLocal(LS_SONGS_KEY); if (ls) songs = ls;
    const lv = loadLocal(LS_VOTES_KEY); if (lv) votes = lv;
    refreshAll();
    return;
  }
  showSync('⏳ 데이터 불러오는 중…');
  try {
    const [sRes, vRes, aRes, avRes, mRes] = await Promise.all([
      api({action: 'getSongs'}),
      api({action: 'getVotes'}),
      api({action: 'getAuditions'}),
      api({action: 'getAudVotes'}),
      api({action: 'getMembers'}),
    ]);

    if (Array.isArray(sRes?.songs)) {
      songs = sRes.songs;
      saveLocal(LS_SONGS_KEY, songs);
    } else {
      const ls = loadLocal(LS_SONGS_KEY); if (ls) songs = ls;
    }

    if (aRes?.auditions)  auditions = aRes.auditions;

    votes = {};
    if (Array.isArray(vRes?.votes)) {
      vRes.votes.forEach(v => {
        if (!votes[v.songId]) votes[v.songId] = {};
        votes[v.songId][v.voter] = +v.score;
      });
      saveLocal(LS_VOTES_KEY, votes);
    } else {
      const lv = loadLocal(LS_VOTES_KEY); if (lv) votes = lv;
    }

    audVotes = {};
    (avRes?.audVotes || []).forEach(v => {
      if (!audVotes[v.audId]) audVotes[v.audId] = {};
      audVotes[v.audId][v.voter] = {pitch: +v.pitch, feel: +v.feel, stage: +v.stage};
    });

    if (mRes?.members?.length) {
      mRes.members.forEach(m => {
        const i = members.findIndex(x => String(x.idx) === String(m.idx));
        if (i >= 0) members[i] = {...members[i], ...m, photo: m.photo || null};
        else members.push({...m, photo: m.photo || null});
      });
    }

    showSync('✅ 동기화 완료', 'ok');
    refreshAll();
  } catch(e) {
    const ls = loadLocal(LS_SONGS_KEY); if (ls) songs = ls;
    const lv = loadLocal(LS_VOTES_KEY); if (lv) votes = lv;
    showSync('❌ 연결 실패 — 로컬 데이터를 표시합니다', 'err');
    refreshAll();
  }
}

function refreshAll() {
  renderAddedList();
  renderVoteList();
  renderResult();
  renderAuditions();
  renderMembers();
  renderMemberChips();
  renderAudMemberChips();
}

/* ══════════════════════════════════════
   TABS
══════════════════════════════════════ */
const TAB_IDS = ['add', 'vote', 'result', 'audition', 'members', 'history', 'setup'];

function switchTab(id) {
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', TAB_IDS[i] === id)
  );
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');

  if (id === 'members')  { renderMembers(); renderMemberChips(); }
  if (id === 'vote')     { renderMemberChips(); renderVoteList(); }
  if (id === 'result')   renderResult();
  if (id === 'audition') { renderAudMemberChips(); renderAuditions(); }
  if (id === 'setup') {
    const status = document.getElementById('currentUrlStatus');
    status.textContent = SCRIPT_URL
      ? `✅ 현재 연결된 URL: ${SCRIPT_URL.slice(0, 60)}…`
      : '❌ 아직 연결된 URL이 없어요.';
  }
}

/* ══════════════════════════════════════
   BUBBLES (band-vote-sheets 전용)
══════════════════════════════════════ */
function initBubbles() {
  const wrap = document.getElementById('bubbles');
  if (!wrap) return;
  for (let i = 0; i < 10; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const s = 6 + Math.random() * 14;
    b.style.cssText = `width:${s}px;height:${s}px;left:${Math.random()*100}%;bottom:${Math.random()*40}px;animation-duration:${3+Math.random()*4}s;animation-delay:${Math.random()*4}s;`;
    wrap.appendChild(b);
  }
}

/* ══════════════════════════════════════
   SONGS
══════════════════════════════════════ */
async function addSong() {
  const artist   = document.getElementById('inp-artist').value.trim();
  const title    = document.getElementById('inp-title').value.trim();
  const proposer = document.getElementById('inp-proposer').value.trim();
  if (!artist || !title) { alert('아티스트와 곡 제목을 입력해주세요!'); return; }

  const newSong = {
    id:       Date.now().toString(),
    artist, title,
    genre:    document.getElementById('inp-genre').value,
    session:  +document.getElementById('sl-session').value,
    vocal:    +document.getElementById('sl-vocal').value,
    proposer: proposer || '익명',
  };
  songs.push(newSong);
  saveLocal(LS_SONGS_KEY, songs);
  ['inp-artist', 'inp-title', 'inp-proposer'].forEach(id => document.getElementById(id).value = '');
  renderAddedList(); renderVoteList(); renderResult();

  if (SCRIPT_URL) {
    showSync('💾 저장 중…');
    const res = await apiPost({action: 'addSong', ...newSong});
    if (res?.ok) showSync('✅ 곡 추가 완료!', 'ok');
    else showSync('❌ 저장 실패', 'err');
  }
}

async function removeSong(id) {
  if (!confirm('이 곡을 삭제할까요?')) return;
  showSync('🗑️ 삭제 중…');
  await apiPost({action: 'removeSong', id});
  songs = songs.filter(s => s.id.toString() !== id.toString());
  saveLocal(LS_SONGS_KEY, songs);
  delete votes[id];
  saveLocal(LS_VOTES_KEY, votes);
  renderAddedList(); renderVoteList(); renderResult();
  showSync('✅ 삭제 완료', 'ok');
}

function renderAddedList() {
  const el = document.getElementById('addedList');
  if (!songs.length) {
    el.innerHTML = `<div class="empty"><div class="icon">🎵</div>아직 추가된 곡이 없어요<br><small>위에서 후보곡을 추가해봐요!</small></div>`;
    return;
  }
  el.innerHTML = songs.map(s => `
    <div class="song-card">
      <div class="song-top">
        <div>
          <div class="song-title">${s.title}</div>
          <div class="song-artist">${s.artist}</div>
          <div class="song-proposer">제안: ${s.proposer}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="removeSong('${s.id}')" style="color:#ff4444;border-color:#ff444433;">✕</button>
      </div>
      <div class="badges">
        <span class="badge badge-genre">${s.genre}</span>
        <span class="badge badge-sess">세션 ${s.session}/5</span>
        <span class="badge badge-voc">보컬 ${s.vocal}/5</span>
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════
   VOTES
══════════════════════════════════════ */
function renderMemberChips() {
  document.getElementById('memberChips').innerHTML =
    members.map(m => `<div class="mchip ${currentVoter === m.name ? 'active' : ''}" onclick="selectVoter('${m.name}')">${m.position}</div>`).join('');
}

function selectVoter(name) {
  currentVoter = currentVoter === name ? null : name;
  renderMemberChips();
  renderVoteList();
}

function renderVoteList() {
  const el = document.getElementById('voteList');
  if (!songs.length) {
    el.innerHTML = `<div class="empty"><div class="icon">🗳️</div>먼저 곡추가 탭에서 후보곡을 등록해봐요!</div>`;
    return;
  }
  el.innerHTML = songs.map(s => {
    const sv     = votes[s.id] || {};
    const totalV = Object.keys(sv).length;
    const myV    = currentVoter && sv[currentVoter];
    const avgH   = totalV ? (Object.values(sv).reduce((a, v) => a + v, 0) / totalV).toFixed(1) : '-';
    return `
    <div class="song-card">
      <div class="song-top">
        <div>
          <div class="song-title">${s.title}</div>
          <div class="song-artist">${s.artist}</div>
          <div class="song-proposer">제안: ${s.proposer}</div>
        </div>
      </div>
      <div class="badges">
        <span class="badge badge-genre">${s.genre}</span>
        <span class="badge badge-sess">세션 ${s.session}/5</span>
        <span class="badge badge-voc">보컬 ${s.vocal}/5</span>
      </div>
      <div class="diff-bars">
        <div class="dbar-row"><span class="dbar-label">세션</span><div class="dbar-bg"><div class="dbar-fill fill-sess" style="width:${s.session/5*100}%"></div></div><span class="dbar-num">${s.session}</span></div>
        <div class="dbar-row"><span class="dbar-label">보컬</span><div class="dbar-bg"><div class="dbar-fill fill-voc" style="width:${s.vocal/5*100}%"></div></div><span class="dbar-num">${s.vocal}</span></div>
      </div>
      <div class="vote-row">
        <button class="vbtn ${myV===5?'v5':''}" onclick="castVote('${s.id}',5)">🔥 꼭해야해</button>
        <button class="vbtn ${myV===3?'v3':''}" onclick="castVote('${s.id}',3)">👍 괜찮아</button>
        <button class="vbtn ${myV===1?'v1':''}" onclick="castVote('${s.id}',1)">😐 글쎄</button>
      </div>
      <div class="vote-info">🗳️ ${totalV}명 참여 · 평균 선호도 ${avgH}점</div>
    </div>`;
  }).join('');
}

async function castVote(songId, score) {
  if (!currentVoter) { alert('먼저 내 포지션을 선택해주세요! 🐸'); return; }
  const sv = votes[songId] || {};
  const isCancel = sv[currentVoter] === score;
  if (!votes[songId]) votes[songId] = {};
  if (isCancel) delete votes[songId][currentVoter];
  else votes[songId][currentVoter] = score;
  saveLocal(LS_VOTES_KEY, votes);
  renderVoteList(); renderResult();

  if (SCRIPT_URL) {
    showSync('💾 투표 저장 중…');
    await apiPost({action: 'castVote', songId, voter: currentVoter, score: isCancel ? null : score});
    showSync('✅ 투표 완료!', 'ok');
  }
}

/* ══════════════════════════════════════
   RESULT
══════════════════════════════════════ */
function calcScore(s) {
  const sv = votes[s.id] || {};
  const vs = Object.values(sv);
  if (!vs.length) return 0;
  const avg = vs.reduce((a, v) => a + v, 0) / vs.length;
  const d   = +s.session + +s.vocal;
  const bal = (d >= 5 && d <= 8) ? 1.2 : 1;
  return +(avg * bal * (vs.length / members.length)).toFixed(2);
}

function renderResult() {
  const sorted = [...songs].sort((a, b) => calcScore(b) - calcScore(a));
  const el = document.getElementById('resultList');
  if (!sorted.length) {
    el.innerHTML = `<div class="empty"><div class="icon">🏆</div>아직 투표 데이터가 없어요</div>`;
    return;
  }
  el.innerHTML = sorted.map((s, i) => {
    const cls   = ['res-1', 'res-2', 'res-3'][i] || '';
    const medal = ['🥇 1위', '🥈 2위', '🥉 3위'][i] || `${i+1}위`;
    const pick  = i < 4 ? ' ✅ 선정 후보' : '';
    return `<div class="res-card ${cls}">
      <div class="res-rank">${medal}${pick}</div>
      <div class="res-title">${s.title}</div>
      <div class="res-artist">${s.artist}</div>
      <div class="res-score">${calcScore(s).toFixed(1)}점</div>
      <div class="res-detail">세션 ${s.session}/5 · 보컬 ${s.vocal}/5 · ${Object.keys(votes[s.id]||{}).length}명 참여</div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   AUDITION
══════════════════════════════════════ */
async function addAudition() {
  const song = document.getElementById('aud-song').value.trim();
  const name = document.getElementById('aud-name').value.trim();
  const url  = document.getElementById('aud-url').value.trim();
  const memo = document.getElementById('aud-memo').value.trim();
  if (!song || !name) { alert('곡 제목과 후보자 이름을 입력해주세요!'); return; }
  showSync('💾 저장 중…');
  const res = await apiPost({action: 'addAudition', song, name, url, memo});
  if (res?.ok) {
    auditions.push({id: res.id, song, name, url, memo});
    ['aud-song', 'aud-name', 'aud-url', 'aud-memo'].forEach(id => document.getElementById(id).value = '');
    renderAuditions();
    showSync('✅ 오디션 등록 완료!', 'ok');
  } else showSync('❌ 저장 실패', 'err');
}

function ytEmbed(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function renderAudMemberChips() {
  document.getElementById('audMemberChips').innerHTML =
    members.map(m => `<div class="mchip ${audVoter === m.name ? 'active' : ''}" onclick="selectAudVoter('${m.name}')">${m.position}</div>`).join('');
}

function selectAudVoter(name) {
  audVoter = audVoter === name ? null : name;
  renderAudMemberChips();
  renderAuditions();
}

async function setStars(audId, cat, val) {
  if (!audVoter) { alert('먼저 내 포지션을 선택해주세요! 🐸'); return; }
  if (!audVotes[audId]) audVotes[audId] = {};
  if (!audVotes[audId][audVoter]) audVotes[audId][audVoter] = {pitch: 0, feel: 0, stage: 0};
  audVotes[audId][audVoter][cat] = val;
  const r = audVotes[audId][audVoter];
  showSync('💾 평가 저장 중…');
  await apiPost({action: 'castAudVote', audId, voter: audVoter, pitch: r.pitch, feel: r.feel, stage: r.stage});
  renderAuditions();
  showSync('✅ 평가 저장!', 'ok');
}

function audTotal(audId) {
  const rs = Object.values(audVotes[audId] || {});
  if (!rs.length) return {pitch: 0, feel: 0, stage: 0, total: 0, count: 0};
  const avg = k => rs.reduce((s, r) => s + (r[k] || 0), 0) / rs.length;
  const p = avg('pitch'), f = avg('feel'), st = avg('stage');
  return {pitch: p, feel: f, stage: st, total: +(p + f + st).toFixed(1), count: rs.length};
}

async function removeAud(id) {
  if (!confirm('삭제할까요?')) return;
  showSync('🗑️ 삭제 중…');
  await apiPost({action: 'removeAudition', id});
  auditions = auditions.filter(a => a.id.toString() !== id.toString());
  delete audVotes[id];
  renderAuditions();
  showSync('✅ 삭제 완료', 'ok');
}

function renderAuditions() {
  const el = document.getElementById('auditionList');
  if (!auditions.length) {
    el.innerHTML = `<div class="empty"><div class="icon">🎤</div>오디션 영상을 등록해보세요!</div>`;
    return;
  }
  const bySong = {};
  auditions.forEach(a => { (bySong[a.song] = bySong[a.song] || []).push(a); });

  el.innerHTML = Object.entries(bySong).map(([song, cands]) => {
    const ranked = [...cands].sort((a, b) => audTotal(b.id).total - audTotal(a.id).total);
    const topId  = ranked[0]?.id;
    return `<div style="margin-bottom:24px;">
      <div class="sec" style="color:var(--pink);">🎵 ${song}</div>
      ${cands.map(a => {
        const sc   = audTotal(a.id);
        const my   = audVoter && (audVotes[a.id] || {})[audVoter];
        const emb  = ytEmbed(a.url);
        const isTop = a.id.toString() === topId?.toString() && sc.count > 0;
        const sr = (cat, icon, label) => `<div class="rating-group">
          <span class="rating-label">${icon} ${label}</span>
          <div class="stars">${[1,2,3,4,5].map(n =>
            `<span class="star ${(my?.[cat]||0)>=n?'on':''}" onclick="setStars('${a.id}','${cat}',${n})">⭐</span>`
          ).join('')}</div>
        </div>`;
        return `<div class="aud-card" style="${isTop ? 'border-color:var(--frog);box-shadow:var(--glow-g);' : ''}">
          <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:10px;">
            <div>
              <div class="aud-name">🎤 ${a.name}${isTop ? `<span class="crown">👑 최고점</span>` : ''}</div>
              ${a.memo ? `<div style="font-size:12px;color:var(--muted);margin-top:3px;">📝 ${a.memo}</div>` : ''}
              ${a.url && !emb ? `<a style="font-size:12px;color:var(--water);display:block;margin-top:4px;" href="${a.url}" target="_blank">🔗 영상 보기</a>` : ''}
            </div>
            <button class="btn btn-ghost btn-sm" onclick="removeAud('${a.id}')" style="color:#ff4444;border-color:#ff444433;">✕</button>
          </div>
          ${emb ? `<iframe class="video-embed" src="${emb}" allowfullscreen loading="lazy"></iframe>` : ''}
          <div style="font-size:11px;color:var(--muted);margin-bottom:10px;">
            ${audVoter ? `<span style="color:var(--frog)">🐸 ${audVoter}</span> 로 평가 중` : '⚠️ 위에서 포지션을 선택해주세요'}
          </div>
          ${sr('pitch', '🎵', '음정 / 음색')}
          ${sr('feel',  '💜', '감성 / 표현력')}
          ${sr('stage', '🔥', '무대매너 / 에너지')}
          <div class="aud-scores">
            ${[['pitch','🎵 음정'],['feel','💜 감성'],['stage','🔥 무대']].map(([k, l]) => `
              <div class="asrow"><span class="lbl">${l}</span><div class="bg"><div class="fill" style="width:${sc[k]/5*100}%"></div></div><span class="num">${sc[k].toFixed(1)}</span></div>`).join('')}
            <div class="aud-total"><span class="lbl">총점 (${sc.count}명)</span><span class="val">${sc.total} / 15</span></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   MEMBERS
══════════════════════════════════════ */
async function addMember() {
  const name = document.getElementById('new-mem-name').value.trim();
  const pos  = document.getElementById('new-mem-pos').value.trim();
  if (!name || !pos) { alert('이름과 포지션을 입력해주세요!'); return; }
  const idx = Date.now();
  const m = {idx, name, position: pos, quote: '한마디를 입력해주세요!', photo: null};
  members.push(m);
  showSync('💾 저장 중…');
  await apiPost({action: 'saveMember', ...m});
  document.getElementById('new-mem-name').value = '';
  document.getElementById('new-mem-pos').value = '';
  renderMembers(); renderMemberChips(); renderAudMemberChips();
  showSync('✅ 멤버 추가!', 'ok');
}

async function removeMember(idx) {
  if (!confirm(`${members[idx].name}(${members[idx].position}) 삭제할까요?`)) return;
  members.splice(idx, 1);
  renderMembers(); renderMemberChips(); renderAudMemberChips();
}

function uploadPhoto(idx, input) {
  const file = input.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async e => {
    members[idx].photo = e.target.result;
    renderMembers();
    showSync('💾 사진 저장 중…');
    await apiPost({action: 'saveMember', ...members[idx]});
    showSync('✅ 사진 저장!', 'ok');
  };
  r.readAsDataURL(file);
}

function openModal(idx) {
  editingIdx = idx;
  const m = members[idx];
  document.getElementById('modal-name').value  = m.name;
  document.getElementById('modal-pos').value   = m.position;
  document.getElementById('modal-quote').value = m.quote;
  document.getElementById('modalTitle').textContent = `${m.position} 수정`;
  document.getElementById('memberModal').classList.add('open');
}

function closeModal() {
  document.getElementById('memberModal').classList.remove('open');
  editingIdx = null;
}

async function saveModal() {
  if (editingIdx === null) return;
  members[editingIdx] = {
    ...members[editingIdx],
    name:     document.getElementById('modal-name').value.trim()  || members[editingIdx].name,
    position: document.getElementById('modal-pos').value.trim()   || members[editingIdx].position,
    quote:    document.getElementById('modal-quote').value.trim() || members[editingIdx].quote,
  };
  closeModal(); renderMembers(); renderMemberChips(); renderAudMemberChips();
  showSync('💾 저장 중…');
  await apiPost({action: 'saveMember', ...members[editingIdx]});
  showSync('✅ 저장 완료!', 'ok');
}

function renderMembers() {
  document.getElementById('membersGrid').innerHTML = members.map((m, i) => `
    <div class="mem-card">
      ${m.photo
        ? `<img class="mem-photo" src="${m.photo}" alt="${m.name}">`
        : `<div class="mem-placeholder">📷<input type="file" accept="image/*" onchange="uploadPhoto(${i},this)"></div>`}
      <div class="mem-name">${m.name}</div>
      <div class="mem-pos">${m.position}</div>
      <div class="mem-quote">"${m.quote}"</div>
      <button class="mem-edit-btn" onclick="openModal(${i})">✏️ 수정</button>
      <button class="mem-edit-btn" onclick="removeMember(${i})" style="color:#ff4444;border-color:#ff444433;margin-left:4px;">🗑️</button>
    </div>`).join('');
}

/* ══════════════════════════════════════
   HISTORY
══════════════════════════════════════ */
function renderHistory() {
  document.getElementById('historyList').innerHTML = HISTORY.map(y => `
    <div class="hy">${y.year}</div>
    ${y.songs.map(s => `
      <div class="hi">
        <div class="hdot ${s.done ? 'done' : ''}"></div>
        <div><div class="hname">${s.name}</div><div style="font-size:11px;color:var(--muted)">${s.artist}</div></div>
        ${s.note ? `<div class="hnote">${s.note}</div>` : ''}
      </div>`).join('')}`).join('');
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
function init() {
  initBubbles();
  renderHistory();
  checkSetup();
  loadAll();
  document.getElementById('memberModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  // 슬라이더 값 표시 연결
  document.getElementById('sl-session').addEventListener('input', e => {
    document.getElementById('sv-session').textContent = e.target.value;
  });
  document.getElementById('sl-vocal').addEventListener('input', e => {
    document.getElementById('sv-vocal').textContent = e.target.value;
  });
}

document.addEventListener('DOMContentLoaded', init);
