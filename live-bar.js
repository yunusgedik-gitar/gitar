const BIN_ID  = '6a2d76d3da38895dfeba83f0';
const API_KEY = '$2a$10$ens/FDNc9OKl6AEj54jBxuhSsFD/s3CwWmLcuBF394V0CMdBPc2ue';
const API_URL = 'https://api.jsonbin.io/v3/b/' + BIN_ID;

async function initLiveBar() {
  console.log("LiveBar module initialized.");
  
  const sid = localStorage.getItem('gitar_session');
  const name = localStorage.getItem('gitar_student_name');
  
  if (!sid || !name) {
    console.warn("No active session found in localStorage. LiveBar stopped.");
    return;
  }

  console.log(`Active user: ${name} (ID: ${sid})`);

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
      const countEl = document.getElementById('_gs_active_count');
      if (countEl) {
        countEl.innerHTML = `🟢 <b>Aktif:</b> ${names.join(', ')}`;
        console.log("LiveBar updated successfully:", names);
      } else {
        console.error("HTML element with ID '_gs_active_count' not found!");
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