/* ══════════════════════════════════════════════════════════
   game-tracker.js
   Tüm mini-oyunlarda (nota, tel, klavye, kulak, bas) ortak
   kullanılan basit performans takip modülü.

   Bu modül kendi Firebase bağlantısını AÇMAZ — her oyun zaten
   kendi firebase app/db'sini kuruyor, biz onu parametre olarak
   alırız (çift "initializeApp" çağrısı / çakışma olmasın diye).

   KULLANIM (her oyun sayfasında, mevcut firebase importunun
   olduğu <script type="module"> içinde):

     import { createTracker } from '/game-tracker.js';
     const tracker = createTracker({ db, ref, push });

     // Egzersiz başladığında (practice/race):
     tracker.start(sid, 'nota', mode);

     // Her doğru/yanlış cevapta:
     tracker.log(true);                       // doğru
     tracker.log(false, 'e/3', 'Mi (6. tel)'); // yanlış + hata anahtarı + okunabilir etiket

     // Egzersiz bittiğinde (endGame / goBackToMenu / sayfadan çıkış):
     tracker.end();

   Veri şu yola yazılır: game_sessions/{sid}/{pushId}
   { game, mode, startTs, endTs, durationSec, correct, wrong,
     errors: { [key]: count }, errorLabels: { [key]: label } }
══════════════════════════════════════════════════════════ */

export function createTracker({ db, ref, push }) {
  let session = null;
  let ended = false;

  function start(sid, game, mode) {
    if (!sid) { session = null; return; }
    session = {
      sid, game, mode: mode || 'practice',
      startTs: Date.now(),
      correct: 0, wrong: 0,
      errors: {}, errorLabels: {}
    };
    ended = false;
  }

  function log(isCorrect, errorKey, errorLabel) {
    if (!session) return;
    if (isCorrect) {
      session.correct++;
    } else {
      session.wrong++;
      if (errorKey != null) {
        const k = String(errorKey);
        session.errors[k] = (session.errors[k] || 0) + 1;
        if (errorLabel) session.errorLabels[k] = errorLabel;
      }
    }
  }

  async function end() {
    if (!session || ended) { return; }
    ended = true;
    const s = session;
    session = null;

    const total = s.correct + s.wrong;
    if (total === 0) return; // hiç soru cevaplanmadıysa kayıt atma

    const endTs = Date.now();
    const durationSec = Math.max(1, Math.round((endTs - s.startTs) / 1000));

    try {
      await push(ref(db, `game_sessions/${s.sid}`), {
        game: s.game,
        mode: s.mode,
        startTs: s.startTs,
        endTs,
        durationSec,
        correct: s.correct,
        wrong: s.wrong,
        errors: s.errors,
        errorLabels: s.errorLabels
      });
    } catch (e) {
      console.error('[GameTracker] kayıt yazılırken hata:', e);
    }
  }

  // Sekme kapatılırken / sayfadan ayrılırken yarım kalan (özellikle
  // zamansız 'practice' modundaki) oturumları kaybetmemek için.
  const flush = () => { if (session && !ended) end(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  return { start, log, end };
}
