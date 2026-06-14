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
		: `⚪ —`;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveBar);
} else {
  initLiveBar();
}

import { push, child } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

// Global fonksiyonları HTML'e bağlıyoruz
window.openOvgüModal = function() {
  document.getElementById('ovguModal').style.display = 'flex';
  listenClouds();
};

window.closeOvgüModal = function() {
  document.getElementById('ovguModal').style.display = 'none';
};

// Övgü Mesajı Gönderme
window.sendOvgu = function() {
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
  }).catch(err => console.error("Hata:", err));
};

// Mesaj Silme (Sadece Yunus Hoca s01 için yetki)
window.deleteOvgu = function(key) {
  if (confirm("Bu övgü bulutunu patlatmak istediğinize emin misiniz?")) {
    const itemRef = ref(db, `ovguler/${key}`);
    set(itemRef, null); // Veritabanından siler
  }
};

// Bulutları Dinle ve Ekrana Bas
let activeListeners = false;
function listenClouds() {
  if (activeListeners) return;
  activeListeners = true;
  
  const currentUid = localStorage.getItem('gitar_session');
  const arena = document.getElementById('cloudArena');
  const ovgulerRef = ref(db, 'ovguler');
  
  onValue(ovgulerRef, (snapshot) => {
    // Önce arenayı temizle
    arena.innerHTML = '';
    const data = snapshot.val() || {};
    
    Object.entries(data).forEach(([key, value]) => {
      createCloudElement(key, value, arena, currentUid);
    });
  });
}

// İnteraktif Bulut Oluşturma ve Sürükle-Fırlat (Throw) Sistemi
function createCloudElement(key, data, arena, currentUid) {
  const cloud = document.createElement('div');
  cloud.className = 'gitar-cloud';
  
  // İçerik Yapısı
  let deleteBtn = '';
  // Eğer giriş yapan kişi Dr. Yunus Gedik (s01) ise silme butonu koy
  if (currentUid === 's01') {
    deleteBtn = `<button class="cloud-del" onclick="event.stopPropagation(); deleteOvgu('${key}')">X</button>`;
  }
  
  cloud.innerHTML = `
    ${deleteBtn}
    <span class="cloud-text">"${data.message}"</span>
    <span class="cloud-author">— ${data.sender}</span>
  `;
  
  // Rastgele Başlangıç Pozisyonu (Arena sınırları dahilinde)
  const arenaWidth = arena.offsetWidth || 500;
  const arenaHeight = arena.offsetHeight || 400;
  
  const posX = Math.random() * (arenaWidth - 240) + 10;
  const posY = Math.random() * (arenaHeight - 120) + 30;
  
  cloud.style.left = `${posX}px`;
  cloud.style.top = `${posY}px`;
  
  arena.appendChild(cloud);
  
  // --- SÜRÜKLE BIRAK VE ELLE İTİNCE UÇURMA MOTORU ---
  let isDragging = false;
  let startX, startY, currentX = posX, currentY = posY;
  let lastX = posX, lastY = posY;
  let vx = 0, vy = 0; // Hız bileşenleri
  let throwAnim;

  cloud.addEventListener('pointerdown', (e) => {
    isDragging = true;
    cloud.style.cursor = 'grabbing';
    cloud.style.zIndex = '50';
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
    
    // Anlık hız hesabı (elle itme hızını yakalamak için)
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
    
    // Eğer fırlatma hızı belliyse kayarak uçma animasyonunu başlat
    if (Math.abs(vx) > 2 || Math.abs(vy) > 2) {
      animateThrow();
    }
  });

  function animateThrow() {
    // Sürtünme katsayısı (yavaş yavaş durması ya da uçup gitmesi için)
    vx *= 0.95;
    vy *= 0.95;
    
    currentX += vx;
    currentY += vy;
    
    cloud.style.left = `${currentX}px`;
    cloud.style.top = `${currentY}px`;
    
    // Ekran dışına fırlatıldıysa (itildiyse) elementi görsel olarak gizle/kapat
    if (currentX < -300 || currentX > arenaWidth + 300 || currentY < -200 || currentY > arenaHeight + 200) {
      cloud.style.display = 'none';
      cancelAnimationFrame(throwAnim);
      return;
    }
    
    if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
      throwAnim = requestAnimationFrame(animateThrow);
    }
  }
}