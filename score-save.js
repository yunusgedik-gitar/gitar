/**
 * score-save.js — Gitar Akademisi · Skor Kayıt Sistemi
 */

(function () {
  const BIN_ID  = '6a2d76d3da38895dfeba83f0';
  const API_KEY = '$2a$10$ens/FDNc9OKl6AEj54jBxuhSsFD/s3CwWmLcuBF394V0CMdBPc2ue';
  const API_URL = 'https://api.jsonbin.io/v3/b/' + BIN_ID;

  function studentName() { return localStorage.getItem('gitar_student_name') || ''; }
  function studentId()   { return localStorage.getItem('gitar_session') || ''; }

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

  window.GitarScores = { save, isLoggedIn: () => !!studentId(), studentName };
})();