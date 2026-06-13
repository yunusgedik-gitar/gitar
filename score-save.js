/**
 * score-save.js — Gitar Akademisi · JSONBin Skor Kaydedici
 * ──────────────────────────────────────────────────────────
 * Her oyun sayfasının <head>'ine ekle:
 *   <script src="/score-save.js"></script>
 *
 * showFinalResults() içine ekle:
 *   GitarScores.save('klavye', { correct: correctCount, wrong: wrongCount, total: TOTAL_QUESTIONS_COUNT, time_ms: elapsed });
 */

(function () {

  const BIN_ID  = '6a2d76d3da38895dfeba83f0';
  const API_KEY = '$2a$10$ens/FDNc9OKl6AEj54jBxuhSsFD/s3CwWmLcuBF394V0CMdBPc2ue';
  const API_URL = 'https://api.jsonbin.io/v3/b/' + BIN_ID;

  /* ── Yardımcılar ────────────────────────────────────────── */
  async function getAll() {
    const res = await fetch(API_URL, {
      headers: { 'X-Master-Key': API_KEY }
    });
    const json = await res.json();
    return json.record && json.record.scores ? json.record.scores : {};
  }

  async function putAll(scores) {
    await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
        'X-Bin-Versioning': 'false'
      },
      body: JSON.stringify({ scores })
    });
  }

  /* ── Küçük "Kaydediliyor…" overlay ─────────────────────── */
  function showSaving() {
    const d = document.createElement('div');
    d.id = '_gs_saving';
    d.style.cssText = [
      'position:fixed', 'bottom:18px', 'right:18px',
      'background:rgba(44,31,20,.88)', 'color:#f5e6d3',
      'font-family:sans-serif', 'font-size:13px', 'font-weight:600',
      'padding:8px 16px', 'border-radius:20px',
      'z-index:9999', 'box-shadow:0 4px 12px rgba(0,0,0,.3)'
    ].join(';');
    d.textContent = '💾 Skor kaydediliyor…';
    document.body.appendChild(d);
    return d;
  }

  function hideSaving(el, ok) {
    if (!el) return;
    el.textContent = ok ? '✅ Skor kaydedildi!' : '⚠️ Kayıt başarısız';
    el.style.background = ok ? 'rgba(59,109,17,.9)' : 'rgba(163,45,45,.9)';
    setTimeout(() => el.remove(), 2000);
  }

  /* ── Ana fonksiyon ──────────────────────────────────────── */
  async function save(gameName, data) {
    const sid = localStorage.getItem('gitar_session');
    if (!sid) return false;

    const overlay = showSaving();
    try {
      const all = await getAll();

      if (!all[sid])          all[sid] = {};
      if (!all[sid][gameName]) all[sid][gameName] = [];

      all[sid][gameName].push({
        d:  new Date().toISOString(),
        c:  data.correct  || 0,
        w:  data.wrong    || 0,
        t:  data.total    || 0,
        ms: data.time_ms  || 0
      });

      await putAll(all);
      hideSaving(overlay, true);
      return true;
    } catch (e) {
      console.error('[GitarScores] Hata:', e);
      hideSaving(overlay, false);
      return false;
    }
  }

  function isLoggedIn()  { return !!localStorage.getItem('gitar_session'); }
  function studentName() { return localStorage.getItem('gitar_student_name') || ''; }

  /* ── Sayfa yüklenince hoşgeldin satırı ──────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    const name = studentName();
    if (!name) return;
    const header = document.querySelector('header');
    if (!header) return;
    const bar = document.createElement('div');
    bar.style.cssText = [
      'text-align:center', 'font-size:.78rem', 'font-weight:600',
      'color:#3b6d11', 'background:#eaf3de',
      'border-radius:20px', 'padding:4px 14px',
      'margin:.4rem auto .6rem', 'display:inline-block',
      'letter-spacing:.03em'
    ].join(';');
    bar.textContent = '👋 Hoşgeldin, ' + name + '!  🟢 Online';
    const h1 = header.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', bar);
    else header.prepend(bar);
  });

  window.GitarScores = { save, isLoggedIn, studentName };

})();
