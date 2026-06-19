import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getDatabase, ref, set, get, update, remove,
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

/* ══════════════════════════════════
   ONLINE SAYACI (mevcut özellik)
══════════════════════════════════ */
async function initLiveBar() {
  const sid  = localStorage.getItem('gitar_session');
  const name = localStorage.getItem('gitar_student_name');
  if (!sid || !name) return;

  let countEl = document.getElementById('_gs_active_count');
  if (!countEl) {
    const header = document.querySelector('header') || document.body;
    const bar = document.createElement('div');
    bar.style.cssText = 'text-align:center;font-size:.82rem;font-weight:600;color:#2c1f14;background:#eaf3de;border:1px solid #b0c999;border-radius:20px;padding:6px 16px;margin:.5rem auto 1rem;display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.04);';
    bar.innerHTML = `<span id="_gs_active_count">🟢 Yükleniyor...</span>`;
    const h1 = header.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', bar);
    else header.prepend(bar);
    countEl = document.getElementById('_gs_active_count');
  }

  const userRef = ref(db, 'online_users/' + sid);
  set(userRef, { name, online: true });
  onDisconnect(userRef).remove();

  onValue(ref(db, 'online_users'), (snapshot) => {
    const users = snapshot.val() || {};
    const names = Object.values(users).map(u => u.name);
    if (countEl) {
      countEl.innerHTML = names.length > 0 ? `🟢 ${names.join(', ')}` : `⚪ —`;
    }
  });

  /* ══════════════════════════════════
     DÜELLO DAVETİ — HER SAYFADA
  ══════════════════════════════════ */
  injectChallengeStyles();
  listenForChallenge(sid, name);
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

    // Overlay DOM oluştur (yoksa)
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

    document.getElementById('_gs_challenge_sub').textContent =
      `${c.fromName} seni ${c.totalRounds} turluk düelloya davet etti!`;
    overlay.style.display = 'block';

    // 30 saniyelik sayaç çubuğu
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

    // Butonları her seferinde yeniden bağla (eski listener birikmesin)
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
    status: 'active'
  });
  await update(ref(db, `duel_challenges/${mySid}`), { status: 'accepted' });

  // Oyun verisini localStorage'a yaz, /nota/ sayfasına yönlendir
  localStorage.setItem('gitar_duel_handoff', JSON.stringify({
    roomCode:    c.roomCode,
    oppSid:      c.fromSid,
    oppName:     c.fromName,
    strings:     c.strings,
    totalRounds: c.totalRounds
  }));

  window.location.href = '/nota/';
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

/* ── Başlat ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveBar);
} else {
  initLiveBar();
}
