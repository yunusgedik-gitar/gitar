import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getDatabase, ref, set, get, update, remove,
  onValue, onDisconnect, serverTimestamp, push
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";
import { ROSTER } from '/roster-data.js';

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

/* ══════════════════════════════════
   ONLINE SAYACI
══════════════════════════════════ */
async function initLiveBar() {
  // Alternatif anahtarları da kontrol ederek güvenceye alıyoruz
  const sid  = localStorage.getItem('gitar_session') || localStorage.getItem('gitar_user_id');
  const name = localStorage.getItem('gitar_student_name') || localStorage.getItem('gitar_name') || localStorage.getItem('gitar_student');

  console.log("[LiveBar] Giriş bilgileri kontrol ediliyor:", { sid, name });

  if (!sid || !name) {
    console.warn("[LiveBar] Başarısız: 'gitar_session' veya 'gitar_student_name' tarayıcı hafızasında bulunamadı!");
    return;
  }

  // _gs_active_count yoksa gizli span olarak body'e ekle (veri taşıyıcı)
  let countEl = document.getElementById('_gs_active_count');
  if (!countEl) {
    const span = document.createElement('span');
    span.id = '_gs_active_count';
    span.style.display = 'none';
    document.body.appendChild(span);
    countEl = span;
  }

  const userRef = ref(db, 'online_users/' + sid);
  
  // Yazma işlemine başarı ve hata takibi ekledik
  set(userRef, { name, online: true })
    .then(() => console.log(`[LiveBar] ${name} başarıyla veritabanına online yazıldı.`))
    .catch(err => console.error("[LiveBar] Veritabanına online yazılırken HATA oluştu (Kuralları kontrol edin):", err));

  onDisconnect(userRef).remove();

  // Okuma işlemine hata takibi ekledik
  onValue(ref(db, 'online_users'), (snapshot) => {
    const users = snapshot.val() || {};
    console.log("[LiveBar] Güncel online veritabanı snapshot'ı alındı:", users);

    const names = Object.values(users)
      .filter(u => u && u.name)
      .map(u => u.name);

    // _gs_active_count guncelle
    if (countEl) {
      countEl.textContent = names.length > 0 ? '\u{1F7E2} ' + names.join(', ') : '\u26AA \u2014';
    }

    // online-badges-row'u dogrudan guncelle
    const row = document.getElementById('online-badges-row');
    if (row) {
      if (names.length === 0) {
        row.innerHTML = '<span class="online-name-badge">\u{1F7E2}</span>';
      } else {
        row.innerHTML = names.map(n => '<span class="online-name-badge">\u{1F7E2} ' + n + '</span>').join('');
      }
    }
  }, (error) => {
    console.error("[LiveBar] Online kullanıcı listesi OKUNURKEN HATA oluştu (Firebase Read izinleri kısıtlı olabilir):", error);
  });

  /* ══════════════════════════════════
     DÜELLO DAVETİ — HER SAYFADA
  ══════════════════════════════════ */
  injectChallengeStyles();
  listenForChallenge(sid, name);

  /* ══════════════════════════════════
     HABER BANDI — HER SAYFADA
  ══════════════════════════════════ */
  initNewsTicker();
}

/* ══════════════════════════════════
   HABER BANDI (kayan yazı)
   - news_feed/{pushId}: { text, ts }
   - Sadece son 24 saatteki haberler gösterilir.
   - Tek satırlık, sürekli kayan marquee.
══════════════════════════════════ */
const NEWS_WINDOW_MS = 24 * 60 * 60 * 1000;   // 24 saat
const NEWS_PRUNE_MS  = 48 * 60 * 60 * 1000;   // temizlik için 2 günden eskileri sil

function injectNewsTickerStyles() {
  if (document.getElementById('_gs_news_ticker_style')) return;
  const style = document.createElement('style');
  style.id = '_gs_news_ticker_style';
  style.textContent = `
    #news-ticker-row {
      overflow: hidden; white-space: nowrap; margin-top: 8px;
      background: linear-gradient(135deg,#fff7e6,#fdebc8);
      border: 1px solid #e8d5a0; border-radius: 20px;
      padding: 6px 0; display: none;
    }
    #news-ticker-row.has-news { display: block; }
    #news-ticker-row ._gs_news_track {
      display: inline-block; white-space: nowrap;
      animation: _gs_news_scroll linear infinite;
      padding-left: 100%;
    }
    #news-ticker-row ._gs_news_item {
      display: inline-block; font-size: .8rem; font-weight: 600;
      color: #8b5a2b; padding: 0 32px;
    }
    @keyframes _gs_news_scroll {
      from { transform: translateX(0); }
      to   { transform: translateX(-100%); }
    }
  `;
  document.head.appendChild(style);
}

function initNewsTicker() {
  const row = document.getElementById('news-ticker-row');
  if (!row) return; // bu sayfada haber bandı markup'ı eklenmemiş
  injectNewsTickerStyles();

  onValue(ref(db, 'news_feed'), snap => {
    const all = snap.val() || {};
    const now = Date.now();
    const items = Object.entries(all)
      .map(([key, v]) => ({ key, ...v }))
      .filter(n => n && n.text && n.ts && (now - n.ts) < NEWS_WINDOW_MS)
      .sort((a, b) => b.ts - a.ts);

    if (!items.length) {
      row.classList.remove('has-news');
      row.innerHTML = '';
      return;
    }

    row.classList.add('has-news');
    const trackHtml = items.map(n => `<span class="_gs_news_item">${chatEscHtml(n.text)}</span>`).join('');
    // Kesintisiz döngü için içerik iki kere art arda yazılır.
    row.innerHTML = `<div class="_gs_news_track">${trackHtml}${trackHtml}</div>`;
    const track = row.querySelector('._gs_news_track');
    if (track) {
      const totalChars = items.reduce((a, n) => a + n.text.length, 0);
      const dur = Math.max(18, totalChars * 0.18); // metin uzunluğuna göre hız
      track.style.animationDuration = dur + 's';
    }

    // Eski haberleri (2 günden fazla) arada bir temizle — herhangi bir
    // kullanıcı bunu tetikleyebilir, zararsız ve gerekli.
    Object.entries(all).forEach(([key, v]) => {
      if (v && v.ts && (now - v.ts) > NEWS_PRUNE_MS) {
        remove(ref(db, `news_feed/${key}`)).catch(() => {});
      }
    });
  }, (error) => {
    console.error('[LiveBar] Haber bandı okunamadı:', error);
  });
}

/* ── Floating davet bildirimi CSS'i enjekte et ── */
function injectChallengeStyles() {
  if (document.getElementById('_gs_duel_styles')) return;
  const style = document.createElement('style');
  style.id = '_gs_duel_styles';
  style.textContent = `
    #_gs_challenge_overlay {
      display: none;
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 32px);
      max-width: 520px;
      z-index: 9999;
      background: #fff;
      border: 2px solid #7b5ea7;
      border-radius: 20px;
      padding: 1.1rem 1.2rem 1rem;
      box-shadow: 0 8px 32px rgba(123,94,167,0.28);
      font-family: 'Lato', sans-serif;
      animation: _gs_slideUp 0.3s ease;
    }
    @keyframes _gs_slideUp {
      from { transform: translateX(-50%) translateY(16px); opacity: 0; }
      to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
    }
    #_gs_challenge_overlay ._gs_title {
      font-weight: 700; font-size: 1rem; color: #5a3e2b; margin-bottom: 0.25rem;
    }
    #_gs_challenge_overlay ._gs_sub {
      font-size: 0.85rem; color: #b09070; margin-bottom: 0.9rem;
    }
    #_gs_challenge_overlay ._gs_timer_bar {
      height: 4px; background: #ede6d8; border-radius: 2px; margin-bottom: 0.85rem; overflow: hidden;
    }
    #_gs_challenge_overlay ._gs_timer_fill {
      height: 100%; width: 100%; background: #7b5ea7; border-radius: 2px;
      transition: width 30s linear;
    }
    ._gs_btn_row { display: flex; gap: 10px; }
    ._gs_btn {
      flex: 1; padding: 9px; font-size: 0.9rem; font-weight: 700;
      border-radius: 12px; cursor: pointer; font-family: inherit;
      transition: filter 0.12s;
    }
    ._gs_btn:hover { filter: brightness(0.93); }
    ._gs_btn_accept {
      background: #f3eeff; border: 1.5px solid #7b5ea7; color: #4a2d8a;
    }
    ._gs_btn_decline {
      background: #fdf0f0; border: 1.5px solid #e24b4a; color: #a32d2d;
    }
  `;
  document.head.appendChild(style);
}

/* ── Davet dinleyici ── */
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

    const _gameLabel = c.totalSecs > 0
      ? `⏱ ${c.totalSecs} saniyelik`
      : `${c.totalRounds} turluk`;
    const _modeLabel = c.mode === 'klavyeden-notaya' ? 'Klavyeden Notaya' : 'Notadan Klavyeye';
    document.getElementById('_gs_challenge_sub').textContent =
      `${c.fromName} seni ${_gameLabel} düelloya davet etti! (${_modeLabel})`;
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveBar);
} else {
  initLiveBar();
}

/* ══════════════════════════════════════════════════════════
   EVRENSEL CHAT SİSTEMİ
══════════════════════════════════════════════════════════ */
const CHAT_KEEP_MS  = 24 * 60 * 60 * 1000;
const WORD_LIMIT    = 100;
const TEACHER_SID   = 's01';

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

async function initChatSystem() {
  const sid  = localStorage.getItem('gitar_session') || localStorage.getItem('gitar_user_id');
  const name = localStorage.getItem('gitar_student_name') || localStorage.getItem('gitar_name') || localStorage.getItem('gitar_student');
  if (!sid || !name) return;

  if (document.getElementById('chat-fab')) return;

  if (!document.getElementById('_gs_chat_css')) {
    const s = document.createElement('style');
    s.id = '_gs_chat_css';
    s.textContent = `
#_gs_chat_fab {
  position:fixed; bottom:24px; right:24px;
  width:54px; height:54px; border-radius:50%;
  background:linear-gradient(135deg,#2c1f14,#4a3525);
  color:#fff; font-size:1.3rem; border:none; cursor:pointer;
  box-shadow:0 4px 20px rgba(44,31,20,.35);
  display:flex; align-items:center; justify-content:center;
  z-index:8000; transition:transform .18s;
}
#_gs_chat_fab:hover { transform:scale(1.09); }
._gs_fab_badge {
  position:absolute; top:-3px; right:-3px;
  min-width:18px; height:18px; padding:0 4px;
  background:#e24b4a; color:#fff; font-size:.65rem; font-weight:700;
  border-radius:9px; display:none; align-items:center; justify-content:center;
  border:2px solid #f7f4ef;
}
#_gs_chat_panel {
  position:fixed; bottom:88px; right:24px;
  width:min(370px,calc(100vw - 24px)); height:min(560px,calc(100vh - 120px));
  background:#fff; border:1px solid #e2d9cc;
  border-radius:22px; box-shadow:0 16px 56px rgba(44,31,20,.22);
  display:none; flex-direction:column; z-index:8001; overflow:hidden;
  animation:_gs_cpop .25s cubic-bezier(.34,1.56,.64,1);
  font-family:'DM Sans',sans-serif;
}
@keyframes _gs_cpop {
  from{opacity:0;transform:scale(.92) translateY(12px)}
  to{opacity:1;transform:scale(1) translateY(0)}
}
._gs_chat_hdr {
  padding:.85rem 1rem .75rem;
  background:linear-gradient(135deg,#2c1f14,#4a3525);
  color:#fff; display:flex; align-items:center; gap:10px;
}
._gs_chat_hdr_title { font-size:.9rem; font-weight:700; flex:1; }
._gs_chat_close {
  background:rgba(255,255,255,.15); border:none; color:#fff;
  width:28px; height:28px; border-radius:50%; cursor:pointer;
  font-size:.85rem; display:flex; align-items:center; justify-content:center;
}
._gs_chat_close:hover { background:rgba(255,255,255,.28); }
._gs_chat_tabs { display:flex; border-bottom:1px solid #e2d9cc; background:#faf8f5; }
._gs_chat_tab {
  flex:1; padding:.6rem .5rem; font-size:.78rem; font-weight:600;
  color:#7a6a5a; background:none; border:none; cursor:pointer;
  border-bottom:2px solid transparent; font-family:inherit;
}
._gs_chat_tab.active { color:#2c1f14; border-bottom-color:#b8892a; }
._gs_tab_badge {
  display:inline-flex; align-items:center; justify-content:center;
  min-width:16px; height:16px; padding:0 4px;
  background:#e24b4a; color:#fff; font-size:.6rem; font-weight:700;
  border-radius:8px; margin-left:4px;
}
._gs_chat_view { display:none; flex-direction:column; flex:1; min-height:0; }
._gs_chat_view.active { display:flex; }
._gs_msgs {
  flex:1; overflow-y:auto; padding:.75rem;
  display:flex; flex-direction:column; gap:6px;
  min-height:0;
}
._gs_msgs::-webkit-scrollbar { width:4px; }
._gs_msgs::-webkit-scrollbar-thumb { background:#e2d9cc; border-radius:2px; }
._gs_msg { display:flex; flex-direction:column; max-width:82%; }
._gs_msg.mine { align-self:flex-end; align-items:flex-end; }
._gs_msg.theirs { align-self:flex-start; align-items:flex-start; }
._gs_msg_meta {
  font-size:.65rem; color:#7a6a5a; margin-bottom:2px; padding:0 4px;
  display:flex; gap:6px; align-items:center;
}
._gs_msg_author { font-weight:700; color:#2c1f14; }
._gs_teacher_tag {
  background:#b8892a; color:#fff; font-size:.58rem; font-weight:700;
  padding:1px 5px; border-radius:4px;
}
._gs_grade_tag {
  background:#eaf3de; color:#3b6d11; font-size:.58rem; font-weight:700;
  padding:1px 6px; border-radius:4px; border:1px solid #b0d890;
  white-space:nowrap;
}
._gs_bubble {
  padding:.5rem .75rem; border-radius:14px;
  font-size:.94rem; line-height:1.5; word-break:break-word;
}
._gs_msg.mine ._gs_bubble { background:linear-gradient(135deg,#2c1f14,#4a3525); color:#fff; border-bottom-right-radius:4px; }
._gs_msg.theirs ._gs_bubble { background:#f3ede4; color:#2c1f14; border-bottom-left-radius:4px; }
._gs_msg.teacher ._gs_bubble { background:linear-gradient(135deg,#b8892a,#d4a843); color:#fff; border-bottom-left-radius:4px; }
._gs_del_btn {
  background:none; border:none; font-size:.65rem; color:#ccc;
  cursor:pointer; padding:0 3px; opacity:0; transition:opacity .15s;
}
._gs_msg:hover ._gs_del_btn { opacity:1; }
._gs_del_btn:hover { color:#e24b4a; }
._gs_locked {
  margin:.6rem .75rem; padding:.6rem .85rem;
  background:#fdf8f0; border:1px solid #f0c896;
  border-radius:10px; font-size:.75rem; color:#c9650f; text-align:center;
}
._gs_input_area {
  padding:.6rem .75rem; border-top:1px solid #e2d9cc;
  display:flex; gap:8px; align-items:flex-end; background:#faf8f5;
}
._gs_input {
  flex:1; min-height:36px; max-height:90px; padding:.45rem .7rem;
  border:1px solid #e2d9cc; border-radius:12px;
  font-family:'DM Sans',sans-serif; font-size:.82rem; color:#2c1f14;
  background:#fff; resize:none; outline:none; transition:border-color .15s;
}
._gs_input:focus { border-color:#b8892a; }
._gs_send {
  width:36px; height:36px; background:linear-gradient(135deg,#2c1f14,#4a3525);
  color:#fff; border:none; border-radius:10px; cursor:pointer;
  font-size:.9rem; display:flex; align-items:center; justify-content:center;
  transition:transform .15s, opacity .15s; flex-shrink:0;
}
._gs_send:hover { transform:scale(1.07); }
._gs_send:disabled { opacity:.4; cursor:not-allowed; transform:none; }
._gs_wlimit {
  padding:.28rem .75rem; font-size:.68rem; color:#7a6a5a;
  border-top:1px solid #e2d9cc; background:#faf8f5;
  display:flex; justify-content:space-between;
}
._gs_wlimit.warn { color:#c9650f; }
._gs_wlimit.danger { color:#a32d2d; font-weight:700; }
._gs_dm_list { padding:.5rem .6rem; display:flex; flex-direction:column; gap:3px; overflow-y:auto; flex:1; }
._gs_dm_item {
  display:flex; align-items:center; gap:10px;
  padding:.5rem .65rem; border-radius:12px; cursor:pointer; transition:background .15s;
}
._gs_dm_item:hover, ._gs_dm_item.active { background:#f3ede4; }
._gs_dm_av {
  width:34px; height:34px; border-radius:50%;
  background:linear-gradient(135deg,#b8892a,#d4a843);
  color:#fff; font-size:.8rem; font-weight:700;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
._gs_dm_info { flex:1; min-width:0; }
._gs_dm_name { font-size:.82rem; font-weight:700; color:#2c1f14; }
._gs_dm_prev { font-size:.72rem; color:#7a6a5a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
._gs_dm_unread {
  min-width:18px; height:18px; padding:0 4px; background:#e24b4a;
  color:#fff; font-size:.62rem; font-weight:700; border-radius:9px;
  display:flex; align-items:center; justify-content:center;
}
._gs_dm_convo { display:none; flex-direction:column; flex:1; min-height:0; }
._gs_dm_convo.active { display:flex; }
._gs_dm_convo_hdr {
  display:flex; align-items:center; gap:8px; padding:.6rem .75rem;
  border-bottom:1px solid #e2d9cc; background:#faf8f5;
}
._gs_back { background:none; border:none; cursor:pointer; color:#7a6a5a; font-size:1rem; padding:2px 6px; border-radius:6px; }
._gs_back:hover { background:#e2d9cc; }
._gs_dm_convo_name { font-size:.85rem; font-weight:700; color:#2c1f14; flex:1; }
._gs_empty {
  flex:1; display:flex; flex-direction:column; align-items:center;
  justify-content:center; color:#7a6a5a; gap:8px; padding:2rem; text-align:center;
}
._gs_empty_icon { font-size:2rem; }
._gs_empty_text { font-size:.8rem; }
@media(max-width:420px){
  #_gs_chat_panel { right:8px; left:8px; width:auto; bottom:80px; }
  #_gs_chat_fab { bottom:16px; right:16px; }
}
    `;
    document.head.appendChild(s);
  }

  if (document.getElementById('_gs_chat_fab')) return;

  const fabEl = document.createElement('button');
  fabEl.id = '_gs_chat_fab';
  fabEl.title = 'Sohbet';
  fabEl.innerHTML = `💬<span class="_gs_fab_badge" id="_gs_fab_badge"></span>`;
  document.body.appendChild(fabEl);

  const panelEl = document.createElement('div');
  panelEl.id = '_gs_chat_panel';
  panelEl.innerHTML = `
    <div class="_gs_chat_hdr">
      <span>🎸</span>
      <span class="_gs_chat_hdr_title">Gitar Akademisi Sohbet</span>
      <button class="_gs_chat_close" id="_gs_chat_close">✕</button>
    </div>
    <div class="_gs_chat_tabs">
      <button class="_gs_chat_tab active" data-tab="general">💬 Genel<span class="_gs_tab_badge" id="_gs_gen_badge" style="display:none"></span></button>
      <button class="_gs_chat_tab" data-tab="dm">✉️ Mesajlar<span class="_gs_tab_badge" id="_gs_dm_badge" style="display:none"></span></button>
    </div>
    <div class="_gs_chat_view active" id="_gs_view_general">
      <div class="_gs_msgs" id="_gs_gen_msgs"></div>
      <div class="_gs_locked" id="_gs_gen_locked" style="display:none">
        🔒 Genel sohbete yazabilmek için en az <b>Grade 1</b> gerekiyor.
      </div>
      <div class="_gs_wlimit" id="_gs_wlimit" style="display:none">
        <span>Günlük kelime hakkı</span><span id="_gs_wlimit_txt"></span>
      </div>
      <div class="_gs_input_area" id="_gs_gen_input_area" style="display:none">
        <textarea class="_gs_input" id="_gs_gen_input" placeholder="Mesajını yaz..." rows="1"></textarea>
        <button class="_gs_send" id="_gs_gen_send">➤</button>
      </div>
    </div>
    <div class="_gs_chat_view" id="_gs_view_dm">
      <div id="_gs_dm_list_view">
        <div class="_gs_dm_list" id="_gs_dm_list"></div>
      </div>
      <div class="_gs_dm_convo" id="_gs_dm_convo">
        <div class="_gs_dm_convo_hdr">
          <button class="_gs_back" id="_gs_dm_back">←</button>
          <span class="_gs_dm_convo_name" id="_gs_dm_convo_name"></span>
        </div>
        <div class="_gs_msgs" id="_gs_dm_msgs"></div>
        <div class="_gs_input_area">
          <textarea class="_gs_input" id="_gs_dm_input" placeholder="Mesajını yaz..." rows="1"></textarea>
          <button class="_gs_send" id="_gs_dm_send">➤</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panelEl);

  let open = false, activeTab = 'general', activeDm = null;
  let unreadGen = 0, unreadDmMap = {};
  let lastReadGen = parseInt(localStorage.getItem('chat_last_general')||'0');
  let lastReadDm  = JSON.parse(localStorage.getItem('chat_last_dm')||'{}');
  let dmConvoUnsub = null;

  function myGrade() {
    if (typeof repProgress !== 'undefined' && repProgress[sid]) {
      const g = Object.keys(repProgress[sid]);
      if (g.length) {
        const max = Math.max(...g.map(Number));
        localStorage.setItem(`chat_grade_${sid}`, max);
        return max;
      }
    }
    return parseInt(localStorage.getItem(`chat_grade_${sid}`) || '0');
  }

  function gradeOf(sid_) {
    if (typeof repProgress !== 'undefined' && repProgress[sid_]) {
      const g = Object.keys(repProgress[sid_]);
      return g.length ? Math.max(...g.map(Number)) : 0;
    }
    return 0;
  }

  const isTeacher = sid === TEACHER_SID;
  let writeable = isTeacher || myGrade() >= 1;

  async function ensureGrade() {
    if (isTeacher || writeable) return;
    try {
      const snap = await get(ref(db, `repertoire/${sid}`));
      if (snap.exists()) {
        const grades = Object.keys(snap.val() || {}).filter(k => !isNaN(Number(k)));
        if (grades.length) {
          const maxG = Math.max(...grades.map(Number));
          localStorage.setItem(`chat_grade_${sid}`, String(maxG));
          if (maxG >= 1) {
            writeable = true;
            const gl = document.getElementById('_gs_gen_locked');
            const gi = document.getElementById('_gs_gen_input_area');
            const wd = document.getElementById('_gs_wlimit');
            if (gl) gl.style.display = 'none';
            if (gi) gi.style.display = 'flex';
            if (wd) wd.style.display = 'flex';
            if (typeof updateWL === 'function') updateWL();
          }
        }
      }
    } catch(e) { console.warn('[chat] grade fetch hatası:', e); }
  }
  ensureGrade();

  function updateFabBadge() {
    const tdm = Object.values(unreadDmMap).reduce((a,b)=>a+b,0);
    const tot = unreadGen + tdm;
    const fb = document.getElementById('_gs_fab_badge');
    if (fb) { fb.textContent = tot; fb.style.display = tot > 0 ? 'flex' : 'none'; }
    const gb = document.getElementById('_gs_gen_badge');
    if (gb) { gb.textContent = unreadGen; gb.style.display = unreadGen > 0 ? 'inline-flex' : 'none'; }
    const db2 = document.getElementById('_gs_dm_badge');
    if (db2) { db2.textContent = tdm; db2.style.display = tdm > 0 ? 'inline-flex' : 'none'; }
  }

  function markGenRead() {
    unreadGen = 0; lastReadGen = Date.now();
    localStorage.setItem('chat_last_general', lastReadGen); updateFabBadge();
  }
  function markDmRead(dsid) {
    unreadDmMap[dsid] = 0; lastReadDm[dsid] = Date.now();
    localStorage.setItem('chat_last_dm', JSON.stringify(lastReadDm)); updateFabBadge();
  }

  fabEl.addEventListener('click', () => {
    open = !open;
    panelEl.style.display = open ? 'flex' : 'none';
    if (open && activeTab === 'general') {
      markGenRead();
      requestAnimationFrame(()=>{ if(genMsgs) genMsgs.scrollTop=genMsgs.scrollHeight; });
    }
    if (open && activeTab === 'dm' && activeDm) {
      markDmRead(activeDm);
      requestAnimationFrame(()=>{ const m=document.getElementById('_gs_dm_msgs'); if(m) m.scrollTop=m.scrollHeight; });
    }
  });
  document.getElementById('_gs_chat_close').addEventListener('click', () => {
    open = false; panelEl.style.display = 'none';
  });

  if (window.visualViewport) {
    let _vvTimer = null;
    function _gsRepos() {
      if (!open) return;
      clearTimeout(_vvTimer);
      _vvTimer = setTimeout(() => {
        const vv   = window.visualViewport;
        const gap  = window.innerHeight - (vv.height + vv.pageTop);
        const bot  = gap > 20 ? gap + 12 : 88;
        panelEl.style.transition = 'bottom .15s ease';
        panelEl.style.bottom = bot + 'px';
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
      if (activeTab === 'general') { markGenRead(); requestAnimationFrame(()=>{ if(genMsgs) genMsgs.scrollTop=genMsgs.scrollHeight; }); }
      if (activeTab === 'dm' && activeDm) { markDmRead(activeDm); requestAnimationFrame(()=>{ const m=document.getElementById('_gs_dm_msgs'); if(m) m.scrollTop=m.scrollHeight; }); }
    });
  });

  const genMsgs   = document.getElementById('_gs_gen_msgs');
  const genLocked = document.getElementById('_gs_gen_locked');
  const genIA     = document.getElementById('_gs_gen_input_area');
  const genInput  = document.getElementById('_gs_gen_input');
  const genSend   = document.getElementById('_gs_gen_send');
  const wlDiv     = document.getElementById('_gs_wlimit');
  const wlTxt     = document.getElementById('_gs_wlimit_txt');

  genLocked.style.display   = writeable ? 'none' : 'block';
  genIA.style.display        = writeable ? 'flex' : 'none';
  wlDiv.style.display        = writeable && !isTeacher ? 'flex' : 'none';

  function updateWL() {
    if (isTeacher) return;
    const rem = WORD_LIMIT - getUsedWordsTday(sid);
    wlTxt.textContent = `${Math.max(0,rem)} / ${WORD_LIMIT} kelime kaldı`;
    wlDiv.className = '_gs_wlimit' + (rem < 15 ? ' danger' : rem < 30 ? ' warn' : '');
    genSend.disabled = rem <= 0;
  }
  if (writeable) updateWL();

  genInput.addEventListener('input', () => {
    genInput.style.height = 'auto';
    genInput.style.height = Math.min(genInput.scrollHeight, 90) + 'px';
  });

  async function sendGen() {
    const text = genInput.value.trim();
    if (!text) return;
    const wc = countWords(text);
    if (!isTeacher) {
      const rem = WORD_LIMIT - getUsedWordsTday(sid);
      if (wc > rem) { genInput.style.borderColor='#e24b4a'; setTimeout(()=>{genInput.style.borderColor='';},1200); return; }
      addUsedWordsTday(sid, wc);
    }
    genSend.disabled = true;
    try {
      await push(ref(db,'chat/general'),{ sid, name, text, ts:Date.now(), isTeacher });
      genInput.value=''; genInput.style.height='auto'; updateWL();
    } catch(e){console.error(e);}
    genSend.disabled = false;
  }
  genSend.addEventListener('click', sendGen);
  genInput.addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendGen();} });

  onValue(ref(db,'chat/general'), snap => {
    const msgs = [];
    snap.forEach(ch => { const m=ch.val(); if(m&&m.ts&&Date.now()-m.ts<CHAT_KEEP_MS) msgs.push({key:ch.key,...m}); });
    msgs.sort((a,b)=> a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

    genMsgs.innerHTML = msgs.length ? '' : `<div class="_gs_empty"><div class="_gs_empty_icon">💬</div><div class="_gs_empty_text">Henüz mesaj yok.<br>İlk mesajı sen gönder!</div></div>`;
    msgs.forEach(m => {
      const isMine = m.sid===sid, isT = m.isTeacher, canDel = isTeacher||isMine;
      const div = document.createElement('div');
      div.className = `_gs_msg ${isMine?'mine':isT?'teacher theirs':'theirs'}`;
      div.innerHTML = `
        <div class="_gs_msg_meta">
          ${!isMine?`<span class="_gs_msg_author">${chatEscHtml(m.name)}</span>`:''}
          ${isT&&!isMine?`<span class="_gs_teacher_tag">Legendary</span>`:''}
          ${(!isT&&!isMine)?(()=>{const g=gradeOf(m.sid);return g>0?`<span class="_gs_grade_tag">Grade ${g}</span>`:'';})():''}
          <span>${chatFormatTime(m.ts)}</span>
          ${canDel?`<button class="_gs_del_btn" data-key="${m.key}" data-path="chat/general">🗑</button>`:''}
        </div>
        <div class="_gs_bubble">${chatEscHtml(m.text)}</div>`;
      genMsgs.appendChild(div);
    });
    genMsgs.querySelectorAll('._gs_del_btn').forEach(b => {
      b.addEventListener('click', ()=>remove(ref(db,`${b.dataset.path}/${b.dataset.key}`)));
    });

    const newCount = msgs.filter(m=>m.ts>lastReadGen&&m.sid!==sid).length;
    if (open && activeTab==='general') { markGenRead(); } else { unreadGen=newCount; updateFabBadge(); }
    genMsgs.scrollTop = genMsgs.scrollHeight;
  });

  // Herkes (öğretmen dahil) tüm diğer kullanıcılarla DM atabilir.
  // window.STUDENTS varsa (örn. index.html'de) ad bilgisi orası ile de
  // güncel kalsın diye onu önceliklendiriyoruz, yoksa ROSTER'a düşüyoruz.
  const fullRoster = (window.STUDENTS && window.STUDENTS.length) ? window.STUDENTS : ROSTER;
  let contacts = fullRoster.filter(s => s.id !== sid);

  let contactMeta = {};
  let onlineUsers = {}; 
  contacts.forEach(c => { contactMeta[c.id]={ lastTs:0, lastText:'—', unread:false }; });

  onValue(ref(db,'online_users'), snap => {
    const raw = snap.val() || {};
    onlineUsers = {};
    Object.values(raw).forEach(u => { if(u.name) onlineUsers[u.name] = true; });
    renderDmList();
  });

  function renderDmList() {
    const dmListEl = document.getElementById('_gs_dm_list');
    if (!dmListEl) return;
    const sorted = [...contacts].sort((a,b)=>{
        const aOn=onlineUsers[a.name]?1:0, bOn=onlineUsers[b.name]?1:0;
        if(bOn!==aOn) return bOn-aOn;
        return (contactMeta[b.id].lastTs||0)-(contactMeta[a.id].lastTs||0);
      });
    dmListEl.innerHTML = sorted.map(c => {
      const m      = contactMeta[c.id];
      const dn     = c.id===TEACHER_SID ? '🎸 Dr. Yunus GEDİK' : c.name;
      const ini    = c.id===TEACHER_SID ? '🎸' : c.name.charAt(0);
      const isOnline = onlineUsers[c.name] || false;
      return `<div class="_gs_dm_item" data-sid="${c.id}" id="_gs_dmi_${c.id}">
        <div class="_gs_dm_av" style="position:relative">
          ${ini}
          ${isOnline ? `<span style="position:absolute;bottom:0;right:0;width:10px;height:10px;background:#3b6d11;border-radius:50%;border:2px solid #fff;"></span>` : ''}
        </div>
        <div class="_gs_dm_info">
          <div class="_gs_dm_name">${dn}${isOnline ? ' <span style="font-size:.65rem;color:#3b6d11;font-weight:700;">● çevrimiçi</span>' : ''}</div>
          <div class="_gs_dm_prev">${chatEscHtml(m.lastText)}</div>
        </div>
        ${m.unread ? `<div class="_gs_dm_unread">●</div>` : ''}
      </div>`;
    }).join('');
    sorted.forEach(c => {
      const el = document.getElementById(`_gs_dmi_${c.id}`);
      if (el) el.addEventListener('click', ()=>openDmConvo(c));
    });
  }

  renderDmList();

  contacts.forEach(c => {
    const roomId = getDmRoom(sid, c.id);
    onValue(ref(db,`chat/dm/${roomId}`), snap => {
      let last = null;
      snap.forEach(ch => { const m=ch.val(); if(!last||m.ts>last.ts) last=m; });
      if (!last) return;
      const lr = lastReadDm[c.id]||0;
      const unread = last.ts>lr && last.sid!==sid;
      contactMeta[c.id] = {
        lastTs: last.ts,
        lastText: (last.sid===sid?'Sen: ':'')+last.text.slice(0,40)+(last.text.length>40?'…':''),
        unread
      };
      if (unread) {
        unreadDmMap[c.id]=1;
        if (!open||activeTab!=='dm'||activeDm!==c.id) updateFabBadge();
      }
      renderDmList();
    });
  });

  function openDmConvo(contact) {
    activeDm = contact.id;
    document.getElementById('_gs_dm_list_view').style.display='none';
    const convo = document.getElementById('_gs_dm_convo');
    convo.classList.add('active');
    document.getElementById('_gs_dm_convo_name').textContent = contact.id===TEACHER_SID ? '🎸 Dr. Yunus GEDİK' : contact.name;

    const dmMsgs  = document.getElementById('_gs_dm_msgs');
    const dmInput = document.getElementById('_gs_dm_input');
    const oldSend = document.getElementById('_gs_dm_send');
    const dmSend  = oldSend.cloneNode(true);
    oldSend.replaceWith(dmSend);

    dmMsgs.innerHTML='';
    markDmRead(contact.id);

    const roomId = getDmRoom(sid, contact.id);
    if (dmConvoUnsub) { dmConvoUnsub(); dmConvoUnsub=null; }

    dmConvoUnsub = onValue(ref(db,`chat/dm/${roomId}`), snap => {
      const msgs=[];
      snap.forEach(ch=>{ const m=ch.val(); if(m&&m.ts&&Date.now()-m.ts<CHAT_KEEP_MS) msgs.push({key:ch.key,...m}); });
      msgs.sort((a,b)=> a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

      dmMsgs.innerHTML = msgs.length ? '' : `<div class="_gs_empty"><div class="_gs_empty_icon">✉️</div><div class="_gs_empty_text">Henüz mesaj yok.</div></div>`;
      msgs.forEach(m => {
        const isMine=m.sid===sid, isT=m.isTeacher, canDel=isTeacher||isMine;
        const div=document.createElement('div');
        div.className=`_gs_msg ${isMine?'mine':isT?'teacher theirs':'theirs'}`;
        div.innerHTML=`
          <div class="_gs_msg_meta">
            ${!isMine?`<span class="_gs_msg_author">${chatEscHtml(m.name)}</span>`:''}
            ${isT&&!isMine?`<span class="_gs_teacher_tag">Legendary</span>`:''}
            ${(!isT&&!isMine)?(()=>{const g=gradeOf(m.sid);return g>0?`<span class="_gs_grade_tag">Grade ${g}</span>`:'';})():''}
            <span>${chatFormatTime(m.ts)}</span>
            ${canDel?`<button class="_gs_del_btn" data-key="${m.key}" data-path="chat/dm/${roomId}">🗑</button>`:''}
          </div>
          <div class="_gs_bubble">${chatEscHtml(m.text)}</div>`;
        dmMsgs.appendChild(div);
      });
      dmMsgs.querySelectorAll('._gs_del_btn').forEach(b=>{
        b.addEventListener('click',()=>remove(ref(db,`${b.dataset.path}/${b.dataset.key}`)));
      });
      requestAnimationFrame(()=>{ dmMsgs.scrollTop=dmMsgs.scrollHeight; });
      markDmRead(contact.id);
    });

    let _dmSending=false;
    async function sendDm() {
      const text=dmInput.value.trim();
      if(!text||_dmSending) return;
      _dmSending=true;
      dmSend.disabled=true;
      const saved=text;
      dmInput.value=''; dmInput.style.height='auto';
      try {
        await push(ref(db,`chat/dm/${roomId}`),{sid,name,text:saved,ts:Date.now(),isTeacher});
      } catch(e){ console.error(e); dmInput.value=saved; }
      finally { _dmSending=false; dmSend.disabled=false; dmInput.focus(); }
    }
    dmSend.onclick=sendDm;
    dmInput.onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendDm();} };
    dmInput.oninput=()=>{ dmInput.style.height='auto'; dmInput.style.height=Math.min(dmInput.scrollHeight,90)+'px'; };
  }

  document.getElementById('_gs_dm_back').addEventListener('click', ()=>{
    activeDm=null;
    if(dmConvoUnsub){dmConvoUnsub();dmConvoUnsub=null;}
    document.getElementById('_gs_dm_list_view').style.display='';
    document.getElementById('_gs_dm_convo').classList.remove('active');
  });
}

setTimeout(initChatSystem, 800);