import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, serverTimestamp, push } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

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

  const userRef = ref(db, 'online_users/' + sid);
  set(userRef, { name: name, online: true });
  onDisconnect(userRef).remove();

  const onlineRef = ref(db, 'online_users');
  onValue(onlineRef, (snapshot) => {
    const users = snapshot.val() || {};
    const names = Object.values(users).map(u => u.name);
    if (countEl) {
      countEl.innerHTML = names.length > 0 ? `🟢 ${names.join(', ')}` : `⚪ —`;
    }
  });

  // Bulutları dinle ve input tetikleyicilerini güvenli bir şekilde bağla
  listenClouds();
  bindOvguEvents();
}

// Buton tıklaması ve Enter olaylarını JavaScript üzerinden doğrudan bağlıyoruz (Garanti Çözüm)
function bindOvguEvents() {
  const input = document.getElementById('ovgu-input');
  const btn = document.getElementById('ovgu-submit-btn');

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSending();
      }
    });
  }

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      executeSending();
    });
  }
}

function executeSending() {
  const sid = localStorage.getItem('gitar_session');
  const name = localStorage.getItem('gitar_student_name');
  const input = document.getElementById('ovgu-input');
  
  if (!sid || !input || !input.value.trim()) return;
  
  const text = input.value.trim();
  const msgRef = ref(db, 'ovguler');
  
  push(msgRef, {
    uid: sid,
    sender: name,
    message: text,
    timestamp: serverTimestamp()
  }).then(() => {
    input.value = '';
  }).catch(err => console.error("Firebase Gönderim Hatası:", err));
}

// Sadece Yunus Hoca'nın silebilmesi için window nesnesine bağlıyoruz
window.deleteOvgu = function(key) {
  if (confirm("Bu övgü bulutunu tamamen silmek istediğinize emin misiniz?")) {
    const itemRef = ref(db, `ovguler/${key}`);
    set(itemRef, null);
  }
};

function listenClouds() {
  const currentUid = localStorage.getItem('gitar_session');
  const arena = document.getElementById('cloudArena');
  if (!arena) return;
  const ovgulerRef = ref(db, 'ovguler');
  
  onValue(ovgulerRef, (snapshot) => {
    // Sadece eski bulut divlerini temizle, input wrapper'ına dokunma
    const existingClouds = arena.querySelectorAll('.gitar-cloud');
    existingClouds.forEach(c => c.remove());
    
    const data = snapshot.val() || {};
    Object.entries(data).forEach(([key, value]) => {
      createCloudElement(key, value, arena, currentUid);
    });
  });
}

function createCloudElement(key, data, arena, currentUid) {
  const cloud = document.createElement('div');
  cloud.className = 'gitar-cloud';
  
  let deleteBtn = '';
  if (currentUid === 's01') {
    deleteBtn = `<button class="cloud-del" onclick="event.stopPropagation(); window.deleteOvgu('${key}')">X</button>`;
  }
  
  cloud.innerHTML = `
    ${deleteBtn}
    <span class="cloud-text">"${data.message}"</span>
    <span class="cloud-author">— ${data.sender}</span>
  `;
  
  // Kutunun boyutları küçüldüğü için bulutların konumlanacağı alanı sınırlandırıyoruz
  const arenaWidth = arena.offsetWidth || 280;
  const arenaHeight = arena.offsetHeight || 235;
  
  // Bulutları kutunun üst yarısında ve input alanını kapatmayacak şekilde rastgele yerleştir
  const posX = Math.random() * (arenaWidth - 150) + 5;
  const posY = Math.random() * (arenaHeight - 140) + 5;
  
  cloud.style.left = `${posX}px`;
  cloud.style.top = `${posY}px`;
  
  arena.appendChild(cloud);
  
  // --- İNTERAKTİF SÜRÜKLE-FIRLAT MOTORU ---
  let isDragging = false;
  let startX, startY, currentX = posX, currentY = posY;
  let lastX = posX, lastY = posY;
  let vx = 0, vy = 0;
  let throwAnim;

  cloud.addEventListener('pointerdown', (e) => {
    isDragging = true;
    cloud.style.cursor = 'grabbing';
    cloud.style.zIndex = '40';
    cancelAnimationFrame(throwAnim);
    
    startX = e.clientX - currentX;
    startY = e.clientY - currentY;
    lastX = e.clientX;
    lastY = e.clientY;
    
    cloud.setPointerCapture(e.pointerId);
  });

  cloud.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    
    vx = e.clientX - lastX;
    vy = e.clientY - lastY;
    
    lastX = e.clientX;
    lastY = e.clientY;
    
    cloud.style.left = `${currentX}px`;
    cloud.style.top = `${currentY}px`;
  });

  cloud.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    cloud.style.cursor = 'grab';
    cloud.style.zIndex = '5';
    
    if (Math.abs(vx) > 1.2 || Math.abs(vy) > 1.2) {
      animateThrow();
    }
  });

  function animateThrow() {
    vx *= 0.94;
    vy *= 0.94;
    
    currentX += vx;
    currentY += vy;
    
    cloud.style.left = `${currentX}px`;
    cloud.style.top = `${currentY}px`;
    
    // Küçük kutunun dışına fırlatıldıysa elementi tamamen kaldırır
    if (currentX < -160 || currentX > arenaWidth + 160 || currentY < -100 || currentY > arenaHeight + 100) {
      cloud.remove();
      cancelAnimationFrame(throwAnim);
      return;
    }
    
    if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
      throwAnim = requestAnimationFrame(animateThrow);
    }
  }
}

// Başlatıcıyı tetikle
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveBar);
} else {
  initLiveBar();
}