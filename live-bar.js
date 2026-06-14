import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, serverTimestamp, push, update, remove } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

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

// Düzenleme modundayken hangi bulutun key'i üzerinde çalışıyoruz
let editingKey = null;

async function initLiveBar() {
  const sid  = localStorage.getItem('gitar_session');
  const name = localStorage.getItem('gitar_student_name');

  if (!sid || !name) return;

  // Online sayaç elementi index.html içinde zaten mevcut (#_gs_active_count)
  const countEl = document.getElementById('_gs_active_count');

  // Bu kullanıcıyı online olarak kaydet
  const userRef = ref(db, 'online_users/' + sid);
  set(userRef, { name: name, online: true });

  // Sekme kapanınca otomatik sil — Firebase halleder
  onDisconnect(userRef).remove();

  // logout için global fonksiyon (index.html doLogout çağırıyor)
  window.firebaseLiveBarLogout = async function () {
    await remove(userRef);
  };

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

  // Övgü köşesi bulutlarını dinle ve input olaylarını bağla
  listenClouds();
  bindOvguEvents();
}

// Buton tıklaması ve Enter olaylarını JavaScript üzerinden doğrudan bağlıyoruz
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

  if (editingKey) {
    // Düzenleme modu: mevcut bulutu güncelle
    const itemRef = ref(db, `ovguler/${editingKey}`);
    update(itemRef, {
      message: text,
      editedAt: serverTimestamp()
    }).then(() => {
      input.value = '';
      exitEditMode();
    }).catch(err => console.error("Firebase Güncelleme Hatası:", err));
    return;
  }

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

function enterEditMode(key, currentText) {
  editingKey = key;
  const input = document.getElementById('ovgu-input');
  const btn = document.getElementById('ovgu-submit-btn');
  if (!input) return;
  input.value = currentText;
  input.focus();
  if (btn) btn.textContent = 'Güncelle';
}

function exitEditMode() {
  editingKey = null;
  const btn = document.getElementById('ovgu-submit-btn');
  if (btn) btn.textContent = 'Gönder';
}

window.deleteOvgu = function (key) {
  if (confirm("Bu övgü bulutunu tamamen silmek istediğinize emin misiniz?")) {
    const itemRef = ref(db, `ovguler/${key}`);
    remove(itemRef);
    if (editingKey === key) {
      exitEditMode();
      const input = document.getElementById('ovgu-input');
      if (input) input.value = '';
    }
  }
};

window.editOvgu = function (key, text) {
  enterEditMode(key, text);
};

// Aktif bulutları key'e göre takip ediyoruz ki her Firebase güncellemesinde
// sürüklenen/uçan bulutlar sıfırlanmasın
const activeClouds = new Map();

function listenClouds() {
  const currentUid = localStorage.getItem('gitar_session');
  const arena = document.getElementById('cloudArena');
  if (!arena) return;
  const ovgulerRef = ref(db, 'ovguler');

  onValue(ovgulerRef, (snapshot) => {
    const data = snapshot.val() || {};
    const incomingKeys = new Set(Object.keys(data));

    // Artık var olmayan (silinmiş) bulutları kaldır
    activeClouds.forEach((cloudInfo, key) => {
      if (!incomingKeys.has(key)) {
        cloudInfo.destroy();
        activeClouds.delete(key);
      }
    });

    // Yeni bulutları ekle veya metni değişen bulutları güncelle
    Object.entries(data).forEach(([key, value]) => {
      if (!activeClouds.has(key)) {
        const cloudInfo = createCloudElement(key, value, arena, currentUid);
        activeClouds.set(key, cloudInfo);
      } else {
        activeClouds.get(key).updateText(value);
      }
    });
  });
}

function createCloudElement(key, data, arena, currentUid) {
  const cloud = document.createElement('div');
  cloud.className = 'gitar-cloud';

  const isMine = currentUid && currentUid === data.uid;

  const textSpan = document.createElement('span');
  textSpan.className = 'cloud-text';
  textSpan.textContent = `"${data.message}"`;

  const authorSpan = document.createElement('span');
  authorSpan.className = 'cloud-author';
  authorSpan.textContent = `— ${data.sender}`;

  if (isMine) {
    const actions = document.createElement('div');
    actions.className = 'cloud-actions';
    actions.innerHTML = `
      <button class="cloud-edit" title="Düzenle">✏️</button>
      <button class="cloud-del" title="Sil">✕</button>
    `;
    cloud.appendChild(actions);
  }
  cloud.appendChild(textSpan);
  cloud.appendChild(authorSpan);

  if (isMine) {
    const editBtn = cloud.querySelector('.cloud-edit');
    const delBtn = cloud.querySelector('.cloud-del');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.editOvgu(key, data.message);
    });
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.deleteOvgu(key);
    });
  }

  // Kutunun boyutlarına göre konum sınırları
  const arenaWidth = arena.offsetWidth || 280;
  const arenaHeight = arena.offsetHeight || 260;

  const posX = Math.random() * Math.max(10, arenaWidth - 150) + 5;
  const posY = Math.random() * Math.max(10, arenaHeight - 140) + 5;

  cloud.style.left = `${posX}px`;
  cloud.style.top = `${posY}px`;

  arena.appendChild(cloud);

  // --- HAREKET MOTORU: sürekli yavaş kayma + sürükle/fırlat ---
  let isDragging = false;
  let startX, startY, currentX = posX, currentY = posY;
  let lastX = posX, lastY = posY;
  let vx = 0, vy = 0;
  let throwAnim;
  let idleAnim;
  let removed = false;

  // Kendiliğinden yavaşça yön değiştirerek kayma
  let ivx = (Math.random() - 0.5) * 0.6;
  let ivy = (Math.random() - 0.5) * 0.6;
  // Çok düşük hız ihtimaline karşı minimum hız garantisi
  if (Math.abs(ivx) < 0.08) ivx = ivx < 0 ? -0.15 : 0.15;
  if (Math.abs(ivy) < 0.08) ivy = ivy < 0 ? -0.15 : 0.15;

  function driftStep() {
    if (removed) return;
    if (!isDragging) {
      const w = arena.offsetWidth || arenaWidth;
      const h = arena.offsetHeight || arenaHeight;
      const maxX = Math.max(10, w - 100);
      const maxY = Math.max(10, h - 70);

      currentX += ivx;
      currentY += ivy;

      if (currentX <= 0 || currentX >= maxX) {
        ivx *= -1;
        currentX = Math.max(0, Math.min(maxX, currentX));
      }
      if (currentY <= 0 || currentY >= maxY) {
        ivy *= -1;
        currentY = Math.max(0, Math.min(maxY, currentY));
      }

      cloud.style.left = `${currentX}px`;
      cloud.style.top = `${currentY}px`;
    }
    idleAnim = requestAnimationFrame(driftStep);
  }
  idleAnim = requestAnimationFrame(driftStep);

  cloud.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.cloud-edit') || e.target.closest('.cloud-del')) return;
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

    const w = arena.offsetWidth || arenaWidth;
    const h = arena.offsetHeight || arenaHeight;

    // Kutunun dışına fırlatıldıysa: ekrandan kaybol, ama Firebase'deki kayıt durur.
    // Bir süre sonra (sayfa açıkken de) tekrar belirebilir.
    if (currentX < -160 || currentX > w + 160 || currentY < -100 || currentY > h + 100) {
      cancelAnimationFrame(throwAnim);
      hideCloud();
      return;
    }

    if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
      throwAnim = requestAnimationFrame(animateThrow);
    }
  }

  function hideCloud() {
    cancelAnimationFrame(idleAnim);
    cloud.classList.add('fading');
    setTimeout(() => {
      removed = true;
      cloud.remove();
      activeClouds.delete(key);
      // Bir süre sonra tekrar belirsin (Firebase'de kayıt hâlâ var)
      setTimeout(() => {
        if (!activeClouds.has(key)) {
          const cloudInfo = createCloudElement(key, data, arena, currentUid);
          activeClouds.set(key, cloudInfo);
        }
      }, 8000 + Math.random() * 6000);
    }, 300);
  }

  return {
    element: cloud,
    destroy() {
      removed = true;
      cancelAnimationFrame(idleAnim);
      cancelAnimationFrame(throwAnim);
      cloud.remove();
    },
    updateText(newData) {
      data = newData;
      textSpan.textContent = `"${newData.message}"`;
      authorSpan.textContent = `— ${newData.sender}`;
    }
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveBar);
} else {
  initLiveBar();
}
