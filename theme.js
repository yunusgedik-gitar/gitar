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

/* ── 3. BUTON GÖRÜNÜMÜ SENKRONİZASYONU ── */
function _syncToggleBtn() {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var sun    = btn.querySelector('.th-sun');
  var moon   = btn.querySelector('.th-moon');

  if (sun && moon) {
    /* Açık modda: ☀️ aktif | Koyu modda: 🌙 aktif */
    sun.classList.toggle('th-active', !isDark);
    moon.classList.toggle('th-active', isDark);
  }

  btn.setAttribute('title', isDark ? 'Açık moda geç' : 'Koyu moda geç');
  btn.setAttribute('aria-label', isDark ? 'Açık moda geç' : 'Koyu moda geç');
}

/* ── 4. DOM HAZIR OLUNCA BUTONU SENKRONIZE ET ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _syncToggleBtn);
} else {
  _syncToggleBtn();
}

/* ── ORTAK YANLIŞLIK MESAJLARI — tüm oyunlar buradan okur ──
   Güncelleme için sadece bu listeyi düzenle.                */
window.GITAR_ERRORS = [
  "Yazıklar olsun!",
  "Kulaklarımız kanadı...",
  "Sende hiç utanma yok mu yaa",
  "Instagram'dan ekle beni seni engellim",
  "Tüm başarılar Yunus Hocadan, bunun gibi hatalar ise senden..",
  "Yunus Hoca bunu görmemiş olsun...",
  "Gitarı yavaşça yere bırak...",
  "Sen daha iyi enstrümanlara layıksın",
  "Aynen knk aynen sensin",
  "Iyyy yine mi hata",
  "Ağır popçusun belli knk",
  "Lâ havle..",
  "Sen en iyisi flüt çal knk",
  "Tekrar deneme, yeter.",
  "Bir yerde bırakmak lazım sanki",
  "Bir durun olsun beea",
  "Sen öyle bil aynen",
  "En sevmediğim öğrencim naber",
  "Ex'den Next olur senden öğrenci olmaz :D"
];
