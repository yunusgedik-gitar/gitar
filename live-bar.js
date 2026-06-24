import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getDatabase, ref, set, get, update, remove, push,
  onValue, onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBkEd729B65y-NZIQ-sxScCgaEvlX-q7yA",
  authDomain: "gitar-yunus.firebaseapp.com",
  databaseURL: "https://gitar-yunus-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gitar-yunus",
  storageBucket: "gitar-yunus.firebasestorage.app",
  messagingSenderId: "184803778782",
  appId: "1:184803778782:web:8f9fbeb4fe625eb386e24f"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const CHAT_KEEP_MS  = 24 * 60 * 60 * 1000;
const WORD_LIMIT    = 100;
const TEACHER_SID   = 's01';

// ── YARDIMCI FONKSİYONLAR ──
function chatEscHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function chatFormatTime(ts) {
  const d = new Date(ts), now = new Date(), diff = now - d;
  if (diff < 60000) return 'az önce';
  if (diff < 3600000) return `${Math.floor(diff/60000)}dk`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit'});
}

function getDmRoom(a, b) { return [a,b].sort().join('_'); }

function getUsedWordsTday(sid) {
  const k = `chat_words_${sid}_${new Date().toISOString().slice(0,10)}`;
  return parseInt(localStorage.getItem(k)||'0');
}

function addUsedWordsTday(sid, n) {
  const k = `chat_words_${sid}_${new Date().toISOString().slice(0,10)}`;
  localStorage.setItem(k, getUsedWordsTday(sid) + n);
}

function countWords(t) { return t.trim().split(/\s+/).filter(Boolean).length; }


/* ══════════════════════════════════
   ONLINE SAYACI & DÜELLO SİSTEMİ
══════════════════════════════════ */
async function initLiveBar() {
  const sid  = localStorage.getItem('gitar_session');
  const name = localStorage.getItem('gitar_student_name');
  if (!sid || !name) return;

  let countEl = document.getElementById('_gs_active_count');
  if (!countEl) {
    const span = document.createElement('span');
    span.id = '_gs_active_count';
    span.style.display = 'none';
    document.body.appendChild(span);
    countEl = span;
  }

  const userRef = ref(db, 'online_users/' + sid);
  set(userRef, { name, online: true });
  onDisconnect(userRef).remove();

  onValue(ref(db, 'online_users'), (snapshot) => {
    const users = snapshot.val() || {};
    const names = Object.values(users)
      .filter(u => u && u.name)
      .map(u => u.name);

    if (countEl) {
      countEl.textContent = names.length > 0 ? '🟢 ' + names.join(', ') : '⚪ —';
    }

    const row = document.getElementById('online-badges-row');
    if (row) {
      if (names.length === 0) {
        row.innerHTML = '<span class="online-name-badge">🟢</span>';
      } else {
        row.innerHTML = names.map(n => '<span class="online-name-badge">🟢 ' + n + '</span>').join('');
      }
    }
  });

  injectChallengeStyles();
  listenForChallenge(sid, name);
}

function injectChallengeStyles() {
  if (document.getElementById('_gs_duel_styles')) return;
  const style = document.createElement('style');
  style.id = '_gs_duel_styles';
  style.textContent = `
    #_gs_challenge_overlay {
      display: none; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      width: calc(100% - 32px); max-width: 520px; z-index: 9999; background: #fff;
      border: 2px solid #7b5ea7; border-radius: 20px; padding: 1.1rem 1.2rem 1rem;
      box-shadow: 0 8px 32px rgba(123,94,167,0.28); font-family: 'Lato', sans-serif;
      animation: _gs_slideUp 0.3s ease;
    }
    @keyframes _gs_slideUp {
      from { transform: translateX(-50%) translateY(16px); opacity: 0; }
      to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
    }
    #_gs_challenge_overlay ._gs_title { font-weight: 700; font-size: 1rem; color: #5a3e2b; margin-bottom: 0.25rem; }
    #_gs_challenge_overlay ._gs_sub { font-size: 0.85rem; color: #b09070; margin-bottom: 0.9rem; }
    #_gs_challenge_overlay ._gs_timer_bar { height: 4px; background: #ede6d8; border-radius: 2px; margin-bottom: 0.85rem; overflow: hidden; }
    #_gs_challenge_overlay ._gs_timer_fill { height: 100%; width: 100%; background: #7b5ea7; border-radius: 2px; transition: width 30s linear; }
    ._gs_btn_row { display: flex; gap: 10px; }
    ._gs_btn { flex: 1; padding: 9px; font-size: 0.9rem; font-weight: 700; border-radius: 12px; cursor: pointer; font-family: inherit; transition: filter 0.12s; }
    ._gs_btn:hover { filter: brightness(0.93); }
    ._gs_btn_accept { background: #f3eeff; border: 1.5px solid #7b5ea7; color: #4a2d8a; }
    ._gs_btn_decline { background: #fdf0f0; border: 1.5px solid #e24b4a; color: #a32d2d; }
  `;
  document.head.appendChild(style);
}

function listenForChallenge(sid, myName) {
  const challengeRef = ref(db, `duel_challenges/${sid}`);
  let expireTimer = null;

  onValue(challengeRef, snap => {
    const c = snap.val();
    if (!c || c.status !== 'pending') {
      hideOverlay();
      return;
    }

    let overlay = document.getElementById('_gs_challenge_overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '_gs_challenge_overlay';
      overlay.innerHTML = `
        <div class="_gs_title">⚔️ Düello Daveti!</div>
        <div class="_gs_sub" id="_gs_challenge_sub"></div>
        <div class="_gs_timer_bar"><div class="_gs_timer_fill" id="_gs_timer_fill"></div></div>
        <div class="_gs_btn_row">
          <button class="_gs_btn _gs_btn_accept"  id="_gs_btn_accept">✅ Kabul Et</button>
          <button class="_gs_btn _gs_btn_decline" id="_gs_btn_decline">❌ Reddet</button>
        </div>`;
      document.body.appendChild(overlay);
    }

    const _gameLabel = c.totalSecs > 0 ? `⏱ ${c.totalSecs} saniyelik` : `${c.totalRounds} turluk`;
    const _modeLabel = c.mode === 'klavyeden-notaya' ? 'Klavyeden Notaya' : 'Notadan Klavyeye';
    document.getElementById('_gs_challenge_sub').textContent = `${c.fromName} seni ${_gameLabel} düelloya davet etti! (${_modeLabel})`;
    overlay.style.display = 'block';

    const fill = document.getElementById('_gs_timer_fill');
    fill.style.transition = 'none';
    fill.style.width = '100%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.transition = 'width 30s linear';
      fill.style.width = '0%';
    }));

    clearTimeout(expireTimer);
    expireTimer = setTimeout(() => {
      remove(ref(db, `duel_challenges/${sid}`));
      hideOverlay();
    }, 30000);

    const btnAccept  = document.getElementById('_gs_btn_accept');
    const btnDecline = document.getElementById('_gs_btn_decline');
    btnAccept.replaceWith(btnAccept.cloneNode(true));
    btnDecline.replaceWith(btnDecline.cloneNode(true));

    document.getElementById('_gs_btn_accept').onclick  = () => acceptChallenge(c, sid, myName, expireTimer);
    document.getElementById('_gs_btn_decline').onclick = () => declineChallenge(sid, expireTimer);
  });
}

async function acceptChallenge(c, mySid, myName, expireTimer) {
  clearTimeout(expireTimer);
  hideOverlay();
  await update(ref(db, `duel_rooms/${c.roomCode}`), {
    guest: { sid: mySid, name: myName },
    status: 'playing'
  });
  await update(ref(db, `duel_challenges/${mySid}`), { status: 'accepted' });
  localStorage.setItem('gitar_duel_handoff', JSON.stringify({
    roomCode:    c.roomCode,
    oppSid:      c.fromSid,
    oppName:     c.fromName,
    strings:     c.strings,
    totalRounds: c.totalRounds,
    totalSecs:   c.totalSecs   || 0,
    mode:        c.mode        || 'notadan-klavyeye'
  }));
  window.location.href = c.redirectTo || '/nota/';
}

async function declineChallenge(mySid, expireTimer) {
  clearTimeout(expireTimer);
  hideOverlay();
  await update(ref(db, `duel_challenges/${mySid}`), { status: 'declined' });
}

function hideOverlay() {
  const o = document.getElementById('_gs_challenge_overlay');
  if (o) o.style.display = 'none';
}


/* ══════════════════════════════════════════════════════════
   EVRENSEL CHAT SİSTEMİ (FLOATING PANEL MODÜLÜ)
══════════════════════════════════════════════════════════ */
async function initChatSystem() {
  const sid  = localStorage.getItem('gitar_session');
  const name = localStorage.getItem('gitar_student_name');
  if (!sid || !name) return;

  // Çakışma önleme
  if (document.getElementById('chat-fab')) return;
  if (document.getElementById('_gs_chat_fab')) return;

  // Stilleri Enjekte Et
  if (!document.getElementById('_gs_chat_css')) {
    const s = document.createElement('style');
    s.id = '_gs_chat_css';
    s.textContent = `
      #_gs_chat_fab {
        position:fixed; bottom:24px; right:24px; width:54px; height:54px; border-radius:50%;
        background:linear-gradient(135deg,#2c1f14,#4a3525); color:#fff; font-size:1.3rem;
        border:none; cursor:pointer; box-shadow:0 4px 20px rgba(44,31,20,.35);
        display:flex; align-items:center; justify-content:center; z-index:8000; transition:transform .18s;
      }
      #_gs_chat_fab:hover { transform:scale(1.09); }
      ._gs_fab_badge {
        position:absolute; top:-3px; right:-3px; min-width:18px; height:18px; padding:0 4px;
        background:#e24b4a; color:#fff; font-size:.65rem; font-weight:700; border-radius:9px;
        display:none; align-items:center; justify-content:center; border:2px solid #f7f4ef;
      }
      #_gs_chat_panel {
        position:fixed; bottom:88px; right:24px; width:min(370px,calc(100vw - 24px));
        height:min(560px,calc(100vh - 120px)); background:#fff; border:1px solid #e2d9cc;
        border-radius:22px; box-shadow:0 16px 56px rgba(44,31,20,.22); display:none;
        flex-direction:column; z-index:8001; overflow:hidden; animation:_gs_cpop .25s cubic-bezier(.34,1.56,.64,1);
        font-family:'DM Sans',sans-serif;
      }
      @keyframes _gs_cpop {
        from{opacity:0;transform:scale(.92) translateY(12px)}
        to{opacity:1;transform:scale(1) translateY(0)}
      }
      ._gs_chat_hdr { padding:.85rem 1rem .75rem; background:linear-gradient(135deg,#2c1f14,#4a3525); color:#fff; display:flex; align-items:center; gap:10px; }
      ._gs_chat_hdr_title { font-size:.9rem; font-weight:700; flex:1; }
      ._gs_chat_close { background:rgba(255,255,255,.15); border:none; color:#fff; width:28px; height:28px; border-radius:50%; cursor:pointer; font-size:.85rem; display:flex; align-items:center; justify-content:center; }
      ._gs_chat_tabs { display:flex; border-bottom:1px solid #e2d9cc; background:#faf8f5; }
      ._gs_chat_tab { flex:1; padding:.6rem .5rem; font-size:.78rem; font-weight:600; color:#7a6a5a; background:none; border:none; cursor:pointer; border-bottom:2px solid transparent; font-family:inherit; }
      ._gs_chat_tab.active { color:#2c1f14; border-bottom-color:#b8892a; }
      ._gs_tab_badge { display:inline-flex; align-items:center; justify-content:center; min-width:16px; height:16px; padding:0 4px; background:#e24b4a; color:#fff; font-size:.6rem; font-weight:700; border-radius:8px; margin-left:4px; }
      ._gs_chat_view { display:none; flex-direction:column; flex:1; min-height:0; }
      ._gs_chat_view.active { display:flex; }
      ._gs_msgs { flex:1; overflow-y:auto; padding:.75rem; display:flex; flex-direction:column; gap:6px; min-height:0; }
      ._gs_msg { display:flex; flex-direction:column; max-width:82%; }
      ._gs_msg.mine { align-self:flex-end; align-items:flex-end; }
      ._gs_msg.theirs { align-self:flex-start; align-items:flex-start; }
      ._gs_msg_meta { font-size:.65rem; color:#7a6a5a; margin-bottom:2px; padding:0 4px; display:flex; gap:6px; align-items:center; }
      ._gs_msg_author { font-weight:700; color:#2c1f14; }
      ._gs_teacher_tag { background:#b8892a; color:#fff; font-size:.58rem; font-weight:700; padding:1px 5px; border-radius:4px; }
      ._gs_grade_tag { background:#3b6d11; color:#fff; font-size:.58rem; font-weight:700; padding:1px 5px; border-radius:4px; }
      ._gs_bubble { padding:.5rem .75rem; border-radius:14px; font-size:.94rem; line-height:1.5; word-break:break-word; }
      ._gs_msg.mine ._gs_bubble { background:linear-gradient(135deg,#2c1f14,#4a3525); color:#fff; border-bottom-right-radius:4px; }
      ._gs_msg.theirs ._gs_bubble { background:#f3ede4; color:#2c1f14; border-bottom-left-radius:4px; }
      ._gs_msg.teacher ._gs_bubble { background:linear-gradient(135deg,#b8892a,#d4a843); color:#fff; border-bottom-left-radius:4px; }
      ._gs_del_btn { background:none; border:none; font-size:.65rem; color:#ccc; cursor:pointer; padding:0 3px; opacity:0; transition:opacity .15s; }
      ._gs_msg:hover ._gs_del_btn { opacity:1; }
      ._gs_del_btn:hover { color:#e24b4a; }
      ._gs_locked { margin:.6rem .75rem; padding:.6rem .85rem; background:#fdf8f0; border:1px solid #f0c896; border-radius:10px; font-size:.75rem; color:#c9650f; text-align:center; }
      ._gs_input_area { padding:.6rem .75rem; border-top:1px solid #e2d9cc; display:flex; gap:8px; align-items:flex-end; background:#faf8f5; }
      ._gs_input { flex:1; min-height:36px; max-height:90px; padding:.45rem .7rem; border:1px solid #e2d9cc; border-radius:12px; font-family:inherit; font-size:.82rem; resize:none; outline:none; }
      ._gs_send { width:36px; height:36px; background:linear-gradient(135deg,#2c1f14,#4a3525); color:#fff; border:none; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      ._gs_wlimit { padding:.28rem .75rem; font-size:.68rem; color:#7a6a5a; border-top:1px solid #e2d9cc; background:#faf8f5; display:flex; justify-content:space-between; }
      ._gs_dm_list { padding:.5rem .6rem; display:flex; flex-direction:column; gap:3px; overflow-y:auto; flex:1; }
      ._gs_dm_item { display:flex; align-items:center; gap:10px; padding:.5rem .65rem; border-radius:12px; cursor:pointer; }
      ._gs_dm_item:hover { background:#f3ede4; }
      ._gs_dm_av { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,#b8892a,#d4a843); color:#fff; font-size:.8rem; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      ._gs_dm_info { flex:1; min-width:0; }
      ._gs_dm_name { font-size:.82rem; font-weight:700; color:#2c1f14; }
      ._gs_dm_prev { font-size:.72rem; color:#7a6a5a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      ._gs_dm_unread { min-width:18px; height:18px; padding:0 4px; background:#e24b4a; color:#fff; font-size:.62rem; font-weight:700; border-radius:9px; display:flex; align-items:center; justify-content:center; }
      ._gs_dm_convo { display:none; flex-direction:column; flex:1; min-height:0; }
      ._gs_dm_convo.active { display:flex; }
      ._gs_dm_convo_hdr { display:flex; align-items:center; gap:8px; padding:.6rem .75rem; border-bottom:1px solid #e2d9cc; background:#faf8f5; }
      ._gs_back { background:none; border:none; cursor:pointer; color:#7a6a5a; font-size:1rem; padding:2px 6px; }
      ._gs_dm_convo_name { font-size:.85rem; font-weight:700; color:#2c1f14; flex:1; }
      @media(max-width:420px){ #_gs_chat_panel { right:8px; left:8px; width:auto; bottom:80px; } #_gs_chat_fab { bottom:16px; right:16px; } }
    `;
    document.head.appendChild(s);
  }

  // DOM Yapısını Oluştur
  const fabEl = document.createElement('button');
  fabEl.id = '_gs_chat_fab';
  fabEl.innerHTML = `💬<span class="_gs_fab_badge" id="_gs_fab_badge">0</span>`;
  document.body.appendChild(fabEl);

  const panelEl = document.createElement('div');
  panelEl.id = '_gs_chat_panel';
  panelEl.innerHTML = `
    <div class="_gs_chat_hdr">
      <div class="_gs_chat_hdr_title">🎸 Gitar Akademi Mesajlaşma</div>
      <button class="_gs_chat_close" id="_gs_chat_close">✕</button>
    </div>
    <div class="_gs_chat_tabs">
      <button class="_gs_chat_tab active" data-tab="general">Genel Sohbet</button>
      <button class="_gs_chat_tab" data-tab="dm">Özel Mesajlar<span class="_gs_tab_badge" id="_gs_dm_tab_badge" style="display:none">0</span></button>
    </div>
    
    <div class="_gs_chat_view active" id="_gs_view_general">
      <div class="_gs_msgs" id="_gs_gen_msgs"></div>
      <div class="_gs_locked" id="_gs_gen_locked" style="display:none">Genel sohbete yazmak için Grade 1 olmalısın.</div>
      <div class="_gs_input_area" id="_gs_gen_input_area">
        <textarea class="_gs_input" id="_gs_gen_input" placeholder="Mesajını yaz..." rows="1"></textarea>
        <button class="_gs_send" id="_gs_gen_send">➤</button>
      </div>
      <div class="_gs_wlimit" id="_gs_gen_wlimit">
        <span>Günlük kelime hakkı</span>
        <span id="_gs_gen_word_text">0 / 100</span>
      </div>
    </div>

    <div class="_gs_chat_view" id="_gs_view_dm">
      <div class="_gs_dm_list" id="_gs_dm_list"></div>
      
      <div class="_gs_dm_convo" id="_gs_dm_convo">
        <div class="_gs_dm_convo_hdr">
          <button class="_gs_back" id="_gs_dm_back">←</button>
          <div class="_gs_dm_convo_name" id="_gs_dm_convo_name">...</div>
        </div>
        <div class="_gs_msgs" id="_gs_dm_msgs"></div>
        <div class="_gs_input_area">
          <textarea class="_gs_input" id="_gs_dm_input" placeholder="Özel mesaj yaz..." rows="1"></textarea>
          <button class="_gs_send" id="_gs_dm_send">➤</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panelEl);

  // ── DURUM YÖNETİMİ ──
  let open = false;
  let activeTab = 'general'; 
  let activeDm = null;      
  const isTeacher = (sid === TEACHER_SID);

  let contacts = [];
  let onlineUsers = {};
  let studentGrades = {};
  let contactMeta = {};
  let unreadDmMap = {};
  let lastReadDm = JSON.parse(localStorage.getItem(`chat_last_read_${sid}`) || '{}');
  let dmConvoUnsub = null;

  const genMsgs = document.getElementById('_gs_gen_msgs');
  const dmListEl = document.getElementById('_gs_dm_list');
  const dmMsgs = document.getElementById('_gs_dm_msgs');

  function gradeOf(studentSid) {
    if (studentSid === TEACHER_SID) return 0;
    return studentGrades[studentSid] || 0;
  }

  function myGrade() {
    return gradeOf(sid);
  }

  async function ensureGradeCached() {
    if (isTeacher) return;
    try {
      const snap = await get(ref(db, `students/${sid}`));
      if (snap.exists()) {
        const sData = snap.val();
        if (sData.grades) {
          const grades = Object.values(sData.grades);
          if (grades.length) {
            const maxG = Math.max(...grades.map(g => parseInt(g || 0)));
            studentGrades[sid] = maxG;
            const lockEl = document.getElementById('_gs_gen_locked');
            const inpEl = document.getElementById('_gs_gen_input_area');
            if (maxG >= 1) {
              if (lockEl) lockEl.style.display = 'none';
              if (inpEl) inpEl.style.display = '';
            } else {
              if (lockEl) lockEl.style.display = 'block';
              if (inpEl) inpEl.style.display = 'none';
            }
          }
        }
      }
    } catch(e) { console.error("Grade cache error:", e); }
  }
  await ensureGradeCached();

  function updateFabBadge() {
    let total = 0;
    for (let k in unreadDmMap) { if (unreadDmMap[k]) total++; }
    const badge = document.getElementById('_gs_fab_badge');
    if (badge) {
      badge.textContent = total;
      badge.style.display = total > 0 ? 'flex' : 'none';
    }
    const tabBadge = document.getElementById('_gs_dm_tab_badge');
    if (tabBadge) {
      tabBadge.textContent = total;
      tabBadge.style.display = total > 0 ? 'inline-flex' : 'none';
    }
  }

  function markDmRead(contactSid) {
    if (unreadDmMap[contactSid]) {
      delete unreadDmMap[contactSid];
      updateFabBadge();
    }
    lastReadDm[contactSid] = Date.now();
    localStorage.setItem(`chat_last_read_${sid}`, JSON.stringify(lastReadDm));
  }

  function refreshWordLimitUI() {
    const txt = document.getElementById('_gs_gen_word_text');
    const wl = document.getElementById('_gs_gen_wlimit');
    if (!txt || !wl) return;
    const used = getUsedWordsTday(sid);
    txt.textContent = `${used} / ${WORD_LIMIT}`;
    wl.className = '_gs_wlimit';
    if (used >= WORD_LIMIT * 0.9) wl.classList.add('danger');
    else if (used >= WORD_LIMIT * 0.7) wl.classList.add('warn');
  }
  refreshWordLimitUI();

  // ── EVENT LISTENERS ──
  fabEl.addEventListener('click', () => {
    open = !open;
    panelEl.style.display = open ? 'flex' : 'none';
    if (open) {
      if (activeTab === 'general') {
        requestAnimationFrame(() => { if (genMsgs) genMsgs.scrollTop = genMsgs.scrollHeight; });
      } else if (activeTab === 'dm' && activeDm) {
        markDmRead(activeDm);
        requestAnimationFrame(() => { if (dmMsgs) dmMsgs.scrollTop = dmMsgs.scrollHeight; });
      }
    }
  });

  document.getElementById('_gs_chat_close').addEventListener('click', () => {
    open = false;
    panelEl.style.display = 'none';
  });

  if (window.visualViewport) {
    let _vvTimer = null;
    function _gsRepos() {
      if (!open) return;
      clearTimeout(_vvTimer);
      _vvTimer = setTimeout(() => {
        panelEl.style.bottom = `${window.innerHeight - window.visualViewport.height + 24}px`;
      }, 50);
    }
    window.visualViewport.addEventListener('resize', _gsRepos);
    window.visualViewport.addEventListener('scroll', _gsRepos);
  }

  panelEl.querySelectorAll('._gs_chat_tab').forEach(t => {
    t.addEventListener('click', () => {
      activeTab = t.dataset.tab;
      panelEl.querySelectorAll('._gs_chat_tab').forEach(x => x.classList.toggle('active', x.dataset.tab === activeTab));
      panelEl.querySelectorAll('._gs_chat_view').forEach(v => v.classList.toggle('active', v.id === `_gs_view_${activeTab}`));
      if (activeTab === 'general') {
        requestAnimationFrame(() => { if (genMsgs) genMsgs.scrollTop = genMsgs.scrollHeight; });
      } else if (activeTab === 'dm' && activeDm) {
        markDmRead(activeDm);
        requestAnimationFrame(() => { if (dmMsgs) dmMsgs.scrollTop = dmMsgs.scrollHeight; });
      }
    });
  });

  // ── REALTIME DATABASE AKIŞLARI ──

  // 1. Genel Sohbet Dinleyicisi
  onValue(ref(db, 'chat/general'), snap => {
    if (!genMsgs) return;
    genMsgs.innerHTML = '';
    const now = Date.now();
    let msgs = [];
    snap.forEach(ch => {
      const m = ch.val();
      if (m && m.ts && (now - m.ts < CHAT_KEEP_MS)) {
        m.key = ch.key;
        msgs.push(m);
      }
    });

    msgs.forEach(m => {
      const isMine = (m.sid === sid);
      const isT = m.isTeacher;
      const canDel = (isTeacher || isMine);
      const div = document.createElement('div');
      div.className = `_gs_msg ${isMine ? 'mine' : isT ? 'teacher theirs' : 'theirs'}`;
      
      let gradeTag = '';
      if (!isT && !isMine) {
        const g = gradeOf(m.sid);
        if (g > 0) gradeTag = `<span class="_gs_grade_tag">Grade ${g}</span>`;
      }

      div.innerHTML = `
        <div class="_gs_msg_meta">
          ${!isMine ? `<span class="_gs_msg_author">${chatEscHtml(m.name)}</span>` : ''}
          ${isT && !isMine ? `<span class="_gs_teacher_tag">Hoca</span>` : ''}
          ${gradeTag}
          <span>${chatFormatTime(m.ts)}</span>
          ${canDel ? `<button class="_gs_del_btn" data-key="${m.key}" data-path="chat/general">🗑</button>` : ''}
        </div>
        <div class="_gs_bubble">${chatEscHtml(m.text)}</div>
      `;
      genMsgs.appendChild(div);
    });

    genMsgs.querySelectorAll('._gs_del_btn').forEach(b => {
      b.addEventListener('click', () => remove(ref(db, `${b.dataset.path}/${b.dataset.key}`)));
    });
    requestAnimationFrame(() => { genMsgs.scrollTop = genMsgs.scrollHeight; });
  });

  // 2. Online Listesi Dinleyicisi
  onValue(ref(db, 'online_users'), snap => {
    onlineUsers = {};
    snap.forEach(ch => {
      const u = ch.val();
      if (u && u.name) onlineUsers[u.name] = true;
    });
    renderDmList();
  });

  // 3. Öğrenciler ve DM Ağaç Tetikleyicileri
  onValue(ref(db, 'students'), snap => {
    contacts = [];
    studentGrades = {};
    
    if (!isTeacher) {
      contacts.push({ id: TEACHER_SID, name: '🎸 Dr. Yunus GEDİK' });
    }

    snap.forEach(ch => {
      const sId = ch.key;
      const sData = ch.val();
      if (!sData || !sData.name) return;

      if (sData.grades) {
        const gVals = Object.values(sData.grades);
        if (gVals.length) {
          studentGrades[sId] = Math.max(...gVals.map(v => parseInt(v || 0)));
        }
      }

      if (sId !== sid) {
        if (isTeacher || gradeOf(sId) >= 1) {
          contacts.push({ id: sId, name: sData.name });
        }
      }
    });

    contacts.forEach(c => {
      if (!contactMeta[c.id]) contactMeta[c.id] = { lastTs: 0, lastText: 'Mesaj yok', unread: false };
      const roomId = getDmRoom(sid, c.id);
      
      onValue(ref(db, `chat/dm/${roomId}`), dmSnap => {
        let last = null;
        dmSnap.forEach(ch => {
          const m = ch.val();
          if (!last || m.ts > last.ts) last = m;
        });

        if (!last) return;
        const lr = lastReadDm[c.id] || 0;
        const unread = (last.ts > lr && last.sid !== sid);
        
        contactMeta[c.id] = {
          lastTs: last.ts,
          lastText: (last.sid === sid ? 'Sen: ' : '') + last.text.slice(0, 40) + (last.text.length > 40 ? '…' : ''),
          unread
        };

        if (unread) {
          unreadDmMap[c.id] = 1;
          if (!open || activeTab !== 'dm' || activeDm !== c.id) updateFabBadge();
        } else {
          if (unreadDmMap[c.id]) { delete unreadDmMap[c.id]; updateFabBadge(); }
        }
        renderDmList();
      });
    });
    renderDmList();
  });

  // ── DM LİSTESİ ÇİZİCİ ──
  function renderDmList() {
    if (!dmListEl) return;
    
    if (activeDm) {
      document.getElementById('_gs_dm_convo').classList.add('active');
      dmListEl.style.display = 'none';
      return;
    } else {
      document.getElementById('_gs_dm_convo').classList.remove('active');
      dmListEl.style.display = '';
    }

    const sorted = [...contacts].sort((a, b) => {
      const aOn = onlineUsers[a.name] ? 1 : 0;
      const bOn = onlineUsers[b.name] ? 1 : 0;
      if (bOn !== aOn) return bOn - aOn;
      return (contactMeta[b.id]?.lastTs || 0) - (contactMeta[a.id]?.lastTs || 0);
    });

    dmListEl.innerHTML = sorted.map(c => {
      const m = contactMeta[c.id] || { lastText: 'Mesaj yok', unread: false };
      const dn = c.id === TEACHER_SID ? '🎸 Dr. Yunus GEDİK' : c.name;
      const ini = c.id === TEACHER_SID ? '🎸' : c.name.charAt(0);
      const isOnline = onlineUsers[c.name] || false;
      return `
        <div class="_gs_dm_item" data-sid="${c.id}" id="_gs_dmi_${c.id}">
          <div class="_gs_dm_av" style="position:relative">
            ${ini}
            ${isOnline ? `<span style="position:absolute;bottom:0;right:0;width:9px;height:9px;background:#3b6d11;border-radius:50%;border:1.5px solid #fff;"></span>` : ''}
          </div>
          <div class="_gs_dm_info">
            <div class="_gs_dm_name">${dn}${isOnline ? ' <span style="font-size:.65rem;color:#3b6d11;font-weight:700;">●</span>' : ''}</div>
            <div class="_gs_dm_prev">${chatEscHtml(m.lastText)}</div>
          </div>
          ${m.unread ? `<div class="_gs_dm_unread">●</div>` : ''}
        </div>
      `;
    }).join('');

    sorted.forEach(c => {
      const el = document.getElementById(`_gs_dmi_${c.id}`);
      if (el) el.addEventListener('click', () => openDmConvo(c));
    });
  }

  // ── DM PENCERESİNİ AÇMA ──
  function openDmConvo(contact) {
    activeDm = contact.id;
    markDmRead(contact.id);
    
    document.getElementById('_gs_dm_convo_name').textContent = contact.id === TEACHER_SID ? '🎸 Dr. Yunus GEDİK' : contact.name;
    dmListEl.style.display = 'none';
    document.getElementById('_gs_dm_convo').classList.add('active');

    if (dmConvoUnsub) { dmConvoUnsub(); dmConvoUnsub = null; }

    const roomId = getDmRoom(sid, contact.id);
    dmConvoUnsub = onValue(ref(db, `chat/dm/${roomId}`), snap => {
      if (!dmMsgs) return;
      dmMsgs.innerHTML = '';
      let msgs = [];
      snap.forEach(ch => {
        const m = ch.val();
        if (m) { m.key = ch.key; msgs.push(m); }
      });

      msgs.forEach(m => {
        const isMine = (m.sid === sid);
        const isT = m.isTeacher;
        const div = document.createElement('div');
        div.className = `_gs_msg ${isMine ? 'mine' : isT ? 'teacher theirs' : 'theirs'}`;
        div.innerHTML = `
          <div class="_gs_msg_meta">
            <span>${chatFormatTime(m.ts)}</span>
            ${(isTeacher || isMine) ? `<button class="_gs_del_btn" data-key="${m.key}" data-path="chat/dm/${roomId}">🗑</button>` : ''}
          </div>
          <div class="_gs_bubble">${chatEscHtml(m.text)}</div>
        `;
        dmMsgs.appendChild(div);
      });

      dmMsgs.querySelectorAll('._gs_del_btn').forEach(b => {
        b.addEventListener('click', () => remove(ref(db, `${b.dataset.path}/${b.dataset.key}`)));
      });

      requestAnimationFrame(() => { dmMsgs.scrollTop = dmMsgs.scrollHeight; });
      markDmRead(contact.id);
    });

    const dmInp = document.getElementById('_gs_dm_input');
    const dmSendBtn = document.getElementById('_gs_dm_send');
    let _dmSending = false;

    async function sendDmMessage() {
      const text = dmInp.value.trim();
      if (!text || _dmSending) return;
      
      _dmSending = true;
      dmSendBtn.disabled = true;
      const saved = text;
      dmInp.value = '';
      dmInp.style.height = 'auto';

      try {
        await push(ref(db, `chat/dm/${roomId}`), {
          sid,
          name,
          text: saved,
          ts: Date.now(),
          isTeacher
        });
      } catch(e) {
        console.error(e);
        dmInp.value = saved;
      } finally {
        _dmSending = false;
        dmSendBtn.disabled = false;
        dmInp.focus();
      }
    }

    dmSendBtn.onclick = sendDmMessage;
    dmInp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDmMessage(); } };
    dmInp.oninput = () => { dmInp.style.height = 'auto'; dmInp.style.height = Math.min(dmInp.scrollHeight, 90) + 'px'; };
  }

  // DM Geri Dönüş Aksiyonu
  document.getElementById('_gs_dm_back').addEventListener('click', () => {
    activeDm = null;
    if (dmConvoUnsub) { dmConvoUnsub(); dmConvoUnsub = null; }
    dmListEl.style.display = '';
    document.getElementById('_gs_dm_convo').classList.remove('active');
    renderDmList();
  });

  // ── GENEL MESAJ GÖNDERME AKSİYONU ──
  const genInp = document.getElementById('_gs_gen_input');
  const genSendBtn = document.getElementById('_gs_gen_send');
  let _genSending = false;

  async function sendGeneralMessage() {
    const text = genInp.value.trim();
    if (!text || _genSending) return;

    if (!isTeacher && myGrade() < 1) {
      alert("Genel sohbet odasına yazabilmek için en az Grade 1 olmalısın!");
      return;
    }

    const wCount = countWords(text);
    const todayUsed = getUsedWordsTday(sid);
    if (!isTeacher && (todayUsed + wCount > WORD_LIMIT)) {
      alert(`Günlük kelime sınırını (${WORD_LIMIT} kelime) aşıyorsun! Kalan hakkın: ${WORD_LIMIT - todayUsed} kelime.`);
      return;
    }

    _genSending = true;
    genSendBtn.disabled = true;
    const saved = text;
    genInp.value = '';
    genInp.style.height = 'auto';

    try {
      await push(ref(db, 'chat/general'), {
        sid,
        name,
        text: saved,
        ts: Date.now(),
        isTeacher
      });
      if (!isTeacher) {
        addUsedWordsTday(sid, wCount);
        refreshWordLimitUI();
      }
    } catch(e) {
      console.error(e);
      genInp.value = saved;
    } finally {
      _genSending = false;
      genSendBtn.disabled = false;
      genInp.focus();
    }
  }

  genSendBtn.onclick = sendGeneralMessage;
  genInp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGeneralMessage(); } };
  genInp.oninput = () => { genInp.style.height = 'auto'; genInp.style.height = Math.min(genInp.scrollHeight, 90) + 'px'; };
}


/* ── SİSTEMLERİ GÜVENLİ BAŞLATMA ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLiveBar();
    setTimeout(initChatSystem, 800);
  });
} else {
  initLiveBar();
  setTimeout(initChatSystem, 800);
}
