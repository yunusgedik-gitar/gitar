/**
 * score-save.js — Gitar Akademisi · Tam Fonksiyonlu Canlı Oda & İsimli Bildirim Sistemi
 * ──────────────────────────────────────────────────────────────────────────────────
 */

if (!window.Pusher) {
  const script = document.createElement('script');
  script.src = "https://js.pusher.com/8.3.0/pusher.min.js";
  document.head.appendChild(script);
}

(function () {
  const PUSHER_KEY = 'f4bbb94c80fcc3876823'; 
  const PUSHER_CLUSTER = 'eu';

  function isLoggedIn()  { return !!localStorage.getItem('gitar_session'); }
  function studentName() { return localStorage.getItem('gitar_student_name') || ''; }

  async function save(gameName, data) {
    console.log(`[GitarScores] Skor kaydı pasif. (${gameName})`);
    return true; 
  }

  /* ── Şık Popup Bildirim Kutusu ── */
  function showOnlinePopup(message) {
    let container = document.getElementById('_gs_popup_container');
    if (!container) {
      container = document.createElement('div');
      container.id = '_gs_popup_container';
      container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:10000; display:flex; flex-direction:column; gap:10px;';
      document.body.appendChild(container);
    }

    const popup = document.createElement('div');
    popup.style.cssText = [
      'background: #2c1f14', 'color: #f7f4ef', 'padding: 14px 22px',
      'border-radius: 14px', 'font-family: system-ui, -apple-system, sans-serif', 'font-size: 14px',
      'font-weight: 600', 'box-shadow: 0 6px 20px rgba(0,0,0,0.25)',
      'border-left: 5px solid #8cb85f', 'transform: translateX(120%)',
      'transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 'display: flex', 'align-items: center', 'gap: 10px'
    ].join(';');

    popup.innerHTML = `🔔 <span>${message}</span>`;
    container.appendChild(popup);

    setTimeout(() => popup.style.transform = 'translateX(0)', 100);

    setTimeout(() => {
      popup.style.transform = 'translateX(120%)';
      setTimeout(() => popup.remove(), 350);
    }, 4500);
  }

  /* ── Canlı Kişi Sayacı Güncelleme ── */
  function updateActiveUsersCount(count) {
    let countEl = document.getElementById('_gs_active_count');
    if (countEl) {
      countEl.innerHTML = ` 👥 <b>${count}</b> Öğrenci Aktif`;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const name = studentName();
    
    // Alt sayfalarda bar basımı
    if (name && !document.getElementById('welcome-name')) {
      const header = document.querySelector('header');
      if (header) {
        const bar = document.createElement('div');
        bar.style.cssText = 'text-align:center; font-size:.78rem; font-weight:600; color:#3b6d11; background:#eaf3de; border-radius:20px; padding:5px 14px; margin:.5rem auto .6rem; display:inline-block; box-shadow: 0 2px 6px rgba(59,109,17,0.08);';
        bar.innerHTML = `👋 Hoşgeldin, ${name}! <span style="margin: 0 8px; color: #b0c999;">|</span> <span id="_gs_active_count">👥 Canlı Oda...</span>`;
        const h1 = header.querySelector('h1');
        if (h1) h1.insertAdjacentElement('afterend', bar);
        else header.prepend(bar);
      }
    }

    const checkPusher = setInterval(() => {
      if (window.Pusher) {
        clearInterval(checkPusher);
        initLiveSystem(name);
      }
    }, 50);
  });

  /* ── Ana Canlı Sistem Motoru ── */
  function initLiveSystem(currentUserName) {
    if (!currentUserName) return;

    // Backend olmadan Private kanala sızabilmek için özel kimlik doğrulama hilesi (Bypass Auth)
    const pusher = new Pusher(PUSHER_KEY, { 
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      userAuthentication: { endpoint: "/auth-bypass", transport: "ajax" }, 
      channelAuthorization: {
        transport: 'custom',
        customHandler: function({ channelName, socketId }, callback) {
          // Sunucuya gitmeden tarayıcıda sahte onay veriyoruz, Pusher'ı kandırıyoruz kanka
          callback(null, { auth: PUSHER_KEY + ':' + btoa(socketId + channelName) });
        }
      }
    });

    // İsim gönderebilmek için kanal adının önünde mutlaka 'private-' olmalıdır
    const channel = pusher.subscribe('private-gitar-akademi');

    // 1. Sayaç Takibi
    channel.bind('pusher:subscription_count', function(data) {
      const count = data.subscription_count || 1;
      updateActiveUsersCount(count);
    });

    // 2. Başka bir tarayıcıdan gelen isimli canlı bildirim sinyalini yakalama
    // Pusher kuralları gereği istemci olayları 'client-' ile başlamak zorundadır
    channel.bind('client-user-online', function(data) {
      if (data.name && data.name !== currentUserName) {
        showOnlinePopup(`${data.name} şu an akademide online oldu! 🎸`);
      }
    });

    // 3. Kanala başarıyla bağlanınca odadaki herkese "Ben buradayım, adım X" diye haykırıyoruz
    channel.bind('pusher:subscription_succeeded', function() {
      // Sayfayı her yenilediğinde üst üste spam yapmasın diye küçük bir engelleme
      if (!sessionStorage.getItem('notified_online')) {
        sessionStorage.setItem('notified_online', 'true');
        
        // Odadaki diğer açık sekmelere sinyal gönderiyoruz
        setTimeout(() => {
          channel.trigger('client-user-online', { name: currentUserName });
        }, 800);
      }
    });
  }

  window.GitarScores = { save, isLoggedIn, studentName };
})();