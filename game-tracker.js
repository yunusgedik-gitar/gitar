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
     const tracker = createTracker({ db, ref, push, get, set });

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

   Oturum bittiğinde otomatik olarak:
   - O oyundaki "en çok doğru" ve "en yüksek yarışma skoru" sıralamalarında
     öğrencinin yeri yükseldiyse haber_feed'e bir satır yazılır.
   - Yarışma modunda sınıfın yeni rekoru kırıldıysa ayrıca duyurulur.
══════════════════════════════════════════════════════════ */

import { ROSTER } from '/roster-data.js';

const GAME_NAME_LABELS = {
  nota:   'Nota Okuma',
  tel:    'Tel Egzersizi',
  klavye: 'Klavye Alıştırması',
  kulak:  'Kulak Eğitimi',
  bas:    'Bas Gitar'
};

function rosterName(sid) {
  const r = ROSTER.find(x => x.id === sid);
  return r ? r.name : sid;
}

export function createTracker({ db, ref, push, get, set }) {
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

  async function pushNews(text, meta) {
    if (!push || !ref || !db) return;
    try {
      await push(ref(db, 'news_feed'), { text, ts: Date.now(), ...(meta || {}) });
    }
    catch (e) { console.error('[GameTracker] haber yazılamadı:', e); }
    try {
      await push(ref(db, 'chat/general'), { sid: 'system_news', name: '📰 Haberler', text, ts: Date.now(), isTeacher: false });
    }
    catch (e) { console.error('[GameTracker] haber chat\'e yazılamadı:', e); }
  }

  // Tek bir metrik için (correct toplamı veya en iyi yarışma skoru)
  // sıralama değişimini kontrol eder, yükseldiyse haber üretir,
  // yarışma modunda sınıf rekoruysa ayrıca duyurur.
  async function checkMetricRank(game, metric, sid, agg, valueFn, isRecordMetric, gameLabel) {
    const rows = Object.keys(agg)
      .map(s => ({ sid: s, v: valueFn(agg[s]) }))
      .filter(r => r.v > 0)
      .sort((a, b) => b.v - a.v);

    const idx = rows.findIndex(r => r.sid === sid);
    if (idx < 0) return;
    const newRank = idx + 1;

    const snapRef = ref(db, `rank_snapshots/${game}/${metric}/${sid}`);
    let oldRank = null;
    try {
      const s = await get(snapRef);
      oldRank = s.exists() ? s.val() : null;
    } catch (e) { /* ilk kayıt - sorun değil */ }

    if (oldRank !== null && newRank < oldRank) {
      await pushNews(`📈 ${rosterName(sid)}, ${gameLabel} sıralamasında ${newRank}. sıraya yükseldi!`, { sid, game });
    }
    if (isRecordMetric && newRank === 1 && oldRank !== 1) {
      await pushNews(`🏆 ${rosterName(sid)}, ${gameLabel} yarışmasında yeni sınıf rekoru kırdı! (${rows[0].v} doğru)`, { sid, game });
    }

    try { await set(snapRef, newRank); } catch (e) { /* yoksay */ }
  }

  async function checkGameRankChanges(game, sid) {
    if (!get || !set) return; // eski/eksik bağımlılık enjeksiyonu - sessizce atla
    try {
      const snap = await get(ref(db, 'game_sessions'));
      const all = snap.exists() ? snap.val() : {};
      const agg = {}; // sid -> { correct, bestRace }

      Object.keys(all).forEach(s => {
        Object.values(all[s] || {}).forEach(sess => {
          if (!sess || sess.game !== game) return;
          const b = agg[s] || (agg[s] = { correct: 0, bestRace: 0 });
          b.correct += (sess.correct || 0);
          if (sess.mode && String(sess.mode).indexOf('race') === 0 && (sess.correct || 0) > b.bestRace) {
            b.bestRace = sess.correct;
          }
        });
      });

      const gameLabel = GAME_NAME_LABELS[game] || game;
      await checkMetricRank(game, 'correct', sid, agg, r => r.correct, false, gameLabel);
      if (agg[sid] && agg[sid].bestRace > 0) {
        await checkMetricRank(game, 'race', sid, agg, r => r.bestRace, true, gameLabel);
      }
    } catch (e) {
      console.error('[GameTracker] sıralama kontrolü hatası:', e);
    }
  }

  async function end() {
    if (!session || ended) { return; }
    ended = true;
    const s = session;
    session = null;

    // Öğretmen/test hesapları (s01, s02) hiçbir şekilde istatistiklere/
    // sıralamalara dahil edilmez.
    if (s.sid === 's01' || s.sid === 's02') return;

    const total = s.correct + s.wrong;
    if (total === 0) return; // hiç soru cevaplanmadıysa kayıt atma

    // İstatistikler ve sıralamalar sadece YARIŞMA ve DÜELLO sonuçlarından
    // oluşur. "Zamansız" pratik modu, tel/nota seçimini istediğin gibi
    // daraltabildiğin için adil bir karşılaştırma sağlamaz; bu yüzden
    // hiç Firebase'e yazılmaz, sıralamaya/istatistiklere girmez.
    const modeStr = String(s.mode || '');
    const isCountable = modeStr.indexOf('practice') !== 0;
    if (!isCountable) return;

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
      return;
    }

    // Sıralama / rekor kontrolünü kayıt başarıyla yazıldıktan sonra,
    // ana akışı geciktirmeden arka planda yap.
    checkGameRankChanges(s.game, s.sid);
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

