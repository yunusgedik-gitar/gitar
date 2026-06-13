// ── 🌐 KÜRESEL CANLI ODA MODÜLÜ (LİVE-BAR.JS) ──

const BIN_ID  = '6a2d76d3da38895dfeba83f0';
const API_KEY = '$2a$10$ens/FDNc9OKl6AEj54jBxuhSsFD/s3CwWmLcuBF394V0CMdBPc2ue';
const API_URL = 'https://api.jsonbin.io/v3/b/' + BIN_ID;

async function initLiveBar() {
  const sid = localStorage.getItem('gitar_session');
  const name = localStorage.getItem('gitar_student_name');
  if (!sid || !name) return;

  async function updateBar() {
    try {
      const res = await fetch(API_URL, { headers: { 'X-Master-Key': API_KEY } });
      const json = await res.json();
      const record = json.record || {};
      if (!record.online_users) record.online_users = {};

      // Kendimizi odaya "Aktif" olarak yaz/güncelle
      record.online_users[sid] = {
        name: name,
        last_seen: Date.now()
      };

      // 30 saniye boyunca sinyal vermemiş kişileri temizle
      const now = Date.now();
      for (const id in record.online_users) {
        if (now - record.online_users[id].last_seen > 30000) {
          delete record.online_users[id];
        }
      }

      // JSONBin'e odanın son halini gönder
      await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY, 'X-Bin-Versioning': 'false' },
        body: JSON.stringify(record)
      });

      // Sayfadaki aktif alan elementi varsa isimleri bas
      const names = Object.values(record.online_users).map(u => u.name);
      const countEl = document.getElementById('_gs_active_count');
      if (countEl) {
        countEl.innerHTML = `🟢 <b>Aktif:</b> ${names.join(', ')}`;
      }
    } catch (e) { console.error(e); }
  }

  updateBar();
  setInterval(updateBar, 10000); // 10 saniyede bir odayı tazeler
}

// Sayfa yüklendiğinde otomatik çalıştır
document.addEventListener('DOMContentLoaded', () => {
  initLiveBar();
});