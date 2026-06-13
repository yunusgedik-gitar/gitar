/**
 * score-save.js — Gitar Akademisi · Canlı İsimli Oda Sistemi (JSONBin Tabanlı)
 * ──────────────────────────────────────────────────────────────────────────────────
 */

(function () {
  const BIN_ID  = '6a2d76d3da38895dfeba83f0';
  const API_KEY = '$2a$10$ens/FDNc9OKl6AEj54jBxuhSsFD/s3CwWmLcuBF394V0CMdBPc2ue';
  const API_URL = 'https://api.jsonbin.io/v3/b/' + BIN_ID;

  function studentName() { return localStorage.getItem('gitar_student_name') || ''; }
  function studentId()   { return localStorage.getItem('gitar_session') || ''; }

  // Skor kaydetme fonksiyonun (orijinal haline dokunmadık, aynen kalıyor)
  async function save(gameName, data) {
    try {
      const res = await fetch(API_URL, { headers: { 'X-Master-Key': API_KEY } });
      const json = await res.json();
      const record = json.record || {};
      if (!record.scores) record.scores = {};
      
      const sid = studentId();
      if (!sid) return false;

      if (!record.scores[sid]) record.scores[sid] = {};
      if (!record.scores[sid][gameName]) record.scores[sid][gameName] = [];

      record.scores[sid][gameName].push({
        d:  new Date().toISOString(),
        c:  data.correct  || 0,
        w:  data.wrong    || 0,
        t:  data.total    || 0,
        ms: data.time_ms  || 0
      });

      await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY, 'X-Bin-Versioning': 'false' },
        body: JSON.stringify(record)
      });
      return true;
    } catch (e) {
      console.error('[GitarScores] Skor hatası:', e);
      return false;
    }
  }

  /* ── CANLI ONLINE SİSTEMİ MOTORU ── */
  async function heartbeat() {
    const name = studentName();
    const sid = studentId();
    if (!name || !sid) return;

    try {
      // 1. Mevcut veriyi çek
      const res = await fetch(API_URL, { headers: { 'X-Master-Key': API_KEY } });
      const json = await res.json();
      const record = json.record || {};
      
      if (!record.online_users) record.online_users = {};

      // 2. Kendimizi "Şu an aktif" olarak işaretle (Zaman damgası ekle)
      record.online_users[sid] = {
        name: name,
        last_seen: Date.now()
      };

      // 3. 30 saniyeden uzun süredir sinyal vermeyen (sayfayı kapatmış) kişileri temizle
      const now = Date.now();
      for (const id in record.online_users) {
        if (now - record.online_users[id].last_seen > 30000) {
          delete record.online_users[id];
        }
      }

      // 4. Güncel listeyi JSONBin'e geri yaz
      await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY, 'X-Bin-Versioning': 'false' },
        body: JSON.stringify(record)
      });

      // 5. Ekrandaki isim listesi barını güncelle
      updateOnlineBar(record.online_users);

    } catch (e) {
      console.error('[GitarOnline] Canlı liste güncellenemedi:', e);
    }
  }

  /* ── Arayüzde İsimleri Basma Alanı ── */
  function updateOnlineBar(onlineUsers) {
    let barEl = document.getElementById('_gs_online_names_list');
    if (!barEl) return;

    // Aktif olanların isimlerini ayıkla
    const names = Object.values(onlineUsers).map(u => u.name);
    
    if (names.length === 0) {
      barEl.innerHTML = 'Kimse yok';
    } else {
      // İsimleri virgülle ayırarak yan yana yaz kanka
      barEl.innerHTML = names.join(', ');
    }
  }

  // Sayfa yüklenince barları bas ve canlandırma döngüsünü başlat
  document.addEventListener('DOMContentLoaded', function () {
    const name = studentName();
    if (!name) return;

    const header = document.querySelector('header');
    if (header) {
      const bar = document.createElement('div');
      bar.style.cssText = 'text-align:center; font-size:.82rem; font-weight:600; color:#2c1f14; background:#eaf3de; border: 1px solid #b0c999; border-radius:20px; padding:6px 16px; margin:.5rem auto 1rem; display:inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.04);';
      bar.innerHTML = `🟢 <b>Aktif Çalışanlar:</b> <span id="_gs_online_names_list" style="color:#3b6d11;">Yükleniyor...</span>`;
      
      const h1 = header.querySelector('h1');
      if (h1) h1.insertAdjacentElement('afterend', bar);
      else header.prepend(bar);
    }

    // İlk girişte hemen çalıştır, sonra her 10 saniyede bir listeyi tazele
    heartbeat();
    setInterval(heartbeat, 10000);
  });

  window.GitarScores = { save, isLoggedIn: () => !!studentId(), studentName };
})();