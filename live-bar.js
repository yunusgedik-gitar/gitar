const BIN_ID  = '6a2d76d3da38895dfeba83f0';
const API_KEY = '$2a$10$ens/FDNc9OKl6AEj54jBxuhSsFD/s3CwWmLcuBF394V0CMdBPc2ue';
const API_URL = 'https://api.jsonbin.io/v3/b/' + BIN_ID;

async function initLiveBar() {
  const sid = localStorage.getItem('gitar_session');
  const name = localStorage.getItem('gitar_student_name');
  
  if (!sid || !name) return;

  // Alt sayfalarda (nota, tel vb.) eğer hazır element yoksa otomatik bar oluşturur
  let countEl = document.getElementById('_gs_active_count');
  if (!countEl) {
    const header = document.querySelector('header') || document.body;
    const bar = document.createElement('div');
    bar.style.cssText = 'text-align:center; font-size:.82rem; font-weight:600; color:#2c1f14; background:#eaf3de; border: 1px solid #b0c999; border-radius:20px; padding:6px 16px; margin:.5rem auto 1rem; display:inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.04);';
    bar.innerHTML = `<span id="_gs_active_count">🟢 <b>Aktif:</b> Yükleniyor...</span>`;
    
    const h1 = header.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', bar);
    else header.prepend(bar);
    
    countEl = document.getElementById('_gs_active_count');
  }

  async function updateBar() {
    try {
      const res = await fetch(API_URL, { headers: { 'X-Master-Key': API_KEY } });
      const json = await res.json();
      const record = json.record || {};
      if (!record.online_users) record.online_users = {};

      record.online_users[sid] = {
        name: name,
        last_seen: Date.now()
      };

      const now = Date.now();
      for (const id in record.online_users) {
        if (now - record.online_users[id].last_seen > 30000) {
          delete record.online_users[id];
        }
      }

      await fetch(API_URL, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'X-Master-Key': API_KEY, 
          'X-Bin-Versioning': 'false' 
        },
        body: JSON.stringify(record)
      });

      const names = Object.values(record.online_users).map(u => u.name);
      if (countEl) {
        countEl.innerHTML = `🟢 <b>Aktif:</b> ${names.join(', ')}`;
      }
    } catch (e) { 
      console.error("Error updating LiveBar:", e); 
    }
  }

  updateBar();
  setInterval(updateBar, 10000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveBar);
} else {
  initLiveBar();
}