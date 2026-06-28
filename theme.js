/**
 * theme.js  –  Gitar Akademisi  |  Açık / Koyu Mod Yöneticisi
 * ─────────────────────────────────────────────────────────────
 * Bu dosya <head> içinde, defer OLMADAN yüklenmelidir.
 * Böylece sayfa render edilmeden önce doğru tema uygulanır
 * ve "beyaz flaş" (FOUC) oluşmaz.
 */

/* ── 1. ANLIK UYGULAMA (FOUC önleme) ── */
(function () {
  var saved = localStorage.getItem('gitar-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

/* ── 2. TOGGLE FONKSİYONU ── */
function toggleTheme() {
  var html    = document.documentElement;
  var current = html.getAttribute('data-theme') || 'light';
  var next    = current === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', next);
  try { localStorage.setItem('gitar-theme', next); } catch (e) {}

  _syncToggleBtn();
}

/* ── 3. BUTON GÖRÜNÜMÜ SENKRONİZASYONU ──
   Sayfada birden fazla tema butonu olabilir (setup + exercise nav).
   Hem #theme-toggle ID'li hem de .theme-toggle class'lı tüm butonları sync et. */
function _syncToggleBtn() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  // Her iki seçiciyle de eşleşen tüm butonları bul
  var btns = document.querySelectorAll('#theme-toggle, .theme-toggle-btn');

  btns.forEach(function(btn) {
    var sun  = btn.querySelector('.th-sun');
    var moon = btn.querySelector('.th-moon');

    if (sun && moon) {
      sun.classList.toggle('th-active', !isDark);
      moon.classList.toggle('th-active', isDark);
    }

    btn.setAttribute('title', isDark ? 'Açık moda geç' : 'Koyu moda geç');
    btn.setAttribute('aria-label', isDark ? 'Açık moda geç' : 'Koyu moda geç');
  });
}

/* ── 4. DOM HAZIR OLUNCA BUTONU SENKRONIZE ET ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _syncToggleBtn);
} else {
  _syncToggleBtn();
}
