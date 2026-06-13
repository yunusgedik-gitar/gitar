/**
 * score-save.js — Gitar Akademisi · Oturum ve İsim Yönetici
 * ──────────────────────────────────────────────────────────
 * Her oyun sayfasının <head>'ine eklendiğinde giriş yapan 
 * öğrencinin ismini üst barda dinamik olarak gösterir.
 * Bulut skor kaydı geçici olarak devre dışı bırakılmıştır.
 */

(function () {

  function isLoggedIn()  { return !!localStorage.getItem('gitar_session'); }
  function studentName() { return localStorage.getItem('gitar_student_name') || ''; }

  /* ── Skor Kaydetme Fonksiyonu (Geçici Olarak Devre Dışı) ── */
  async function save(gameName, data) {
    console.log(`[GitarScores] Skor kaydı geçici olarak devre dışı. (${gameName})`);
    return true; 
  }

  /* ── Sayfa yüklenince online olan öğrencinin ismini basar ── */
  document.addEventListener('DOMContentLoaded', function () {
    const name = studentName();
    if (!name) return; // Eğer giriş yapılmadıysa barı gösterme

    const header = document.querySelector('header');
    if (!header) return;

    // Dinamik Hoşgeldin Barı Tasarımı
    const bar = document.createElement('div');
    bar.style.cssText = [
      'text-align:center', 
      'font-size:.78rem', 
      'font-weight:600',
      'color:#3b6d11', 
      'background:#eaf3de',
      'border-radius:20px', 
      'padding:5px 14px',
      'margin:.5rem auto .6rem', 
      'display:inline-block',
      'letter-spacing:.03em',
      'box-shadow: 0 2px 6px rgba(59,109,17,0.08)'
    ].join(';');
    
    bar.textContent = '👋 Hoşgeldin, ' + name + '!  🟢 Online';
    
    // H1 etiketinin hemen altına yerleştir, yoksa header'ın en tepesine koy
    const h1 = header.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', bar);
    else header.prepend(bar);
  });

  // Global erişim için nesneyi pencerelere bağlıyoruz
  window.GitarScores = { save, isLoggedIn, studentName };

})();