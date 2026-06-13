import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

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

async function initLiveBar() {
  const sid  = localStorage.getItem('gitar_session');
  const name = localStorage.getItem('gitar_student_name');

  if (!sid || !name) return;

  // Bar elementini oluştur (yoksa)
  let countEl = document.getElementById('_gs_active_count');
  if (!countEl) {
    const header = document.querySelector('header') || document.body;
    const bar = document.createElement('div');
    bar.style.cssText = 'text-align:center; font-size:.82rem; font-weight:600; color:#2c1f14; background:#eaf3de; border: 1px solid #b0c999; border-radius:20px; padding:6px 16px; margin:.5rem auto 1rem; display:inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.04);';
    bar.innerHTML = `<span id="_gs_active_count">🟢 Yükleniyor...</span>`;
    const h1 = header.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', bar);
    else header.prepend(bar);
    countEl = document.getElementById('_gs_active_count');
  }

  // Bu kullanıcıyı online olarak kaydet
  const userRef = ref(db, 'online_users/' + sid);

  set(userRef, { name: name, online: true });

  // Sekme kapanınca otomatik sil — Firebase halleder
  onDisconnect(userRef).remove();

  // Kim online? Gerçek zamanlı dinle
  const onlineRef = ref(db, 'online_users');
  onValue(onlineRef, (snapshot) => {
    const users = snapshot.val() || {};
    const names = Object.values(users).map(u => u.name);
    if (countEl) {
      countEl.innerHTML = names.length > 0
        ? `🟢 ${names.join(', ')}`
        : `🟢 —`;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveBar);
} else {
  initLiveBar();
}