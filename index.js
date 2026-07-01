/* ══════════════════════════════════════════════════════════
   functions/index.js
   Turnuva push bildirimleri:
   - Yeni eşleşme belli olduğunda her iki oyuncuya
   - Rakip "Hazırım" dediğinde diğer oyuncuya ("sıra sende")
   - Turnuva bittiğinde tüm katılımcılara (şampiyon duyurusu)

   KURULUM:
     1) firebase-tools kurulu değilse: npm install -g firebase-tools
     2) Bu "functions" klasörünü projenizin köküne koyun (index.html
        ile aynı seviyede olmasına gerek yok, ayrı bir klasör).
     3) Proje kökünde: firebase init functions
        (zaten fonksiyon varsa bu adımı atlayıp dosyaları birleştirin)
     4) functions klasöründe:  npm install
     5) Deploy:  firebase deploy --only functions
══════════════════════════════════════════════════════════ */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.database();
const messaging = admin.messaging();

async function getTokensFor(sid) {
  const snap = await db.ref(`fcm_tokens/${sid}`).once('value');
  const val = snap.val() || {};
  return Object.keys(val); // her key bir FCM token'ı
}

async function sendToPlayer(sid, title, body) {
  if (!sid) return;
  const tokens = await getTokensFor(sid);
  if (!tokens.length) return;

  const message = {
    tokens,
    notification: { title, body },
    webpush: {
      fcmOptions: { link: 'https://gitar.yunusgedik.com.tr/' },
      notification: { icon: '/favicon.ico' }
    }
  };

  const res = await messaging.sendEachForMulticast(message);

  // Geçersiz/süresi dolmuş token'ları veritabanından temizle.
  const removals = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        removals.push(db.ref(`fcm_tokens/${sid}/${tokens[i]}`).remove());
      }
    }
  });
  await Promise.all(removals);
}

// ── Öğretmen bir duyuru gönderdiğinde: bildirimlerini açmış TÜM
//    öğrencilere (fcm_tokens altındaki her sid'e) push at ──
exports.onBroadcastCreate = functions.database
  .ref('broadcast_notifications/{pushId}')
  .onCreate(async (snap) => {
    const data = snap.val() || {};
    const text = (data.text || '').trim();
    if (!text) return;

    const tokensSnap = await db.ref('fcm_tokens').once('value');
    const allTokensBySid = tokensSnap.val() || {};
    const sids = Object.keys(allTokensBySid);
    if (!sids.length) return;

    await Promise.all(
      sids.map((sid) => sendToPlayer(sid, '📢 Duyuru', text))
    );
  });

// ── Bir turnuva maçı güncellendiğinde: yeni eşleşme / sıra bildirimi ──
exports.onTournamentMatchUpdate = functions.database
  .ref('tournaments/{tid}/bracket/rounds/{rIdx}/{mIdx}')
  .onUpdate(async (change) => {
    const before = change.before.val() || {};
    const after  = change.after.val()  || {};

    // Yeni eşleşme belli oldu (önce p1 ya da p2 boştu, şimdi ikisi de dolu).
    const pairingJustCompleted = (!before.p1 || !before.p2) && after.p1 && after.p2;
    if (pairingJustCompleted) {
      await Promise.all([
        sendToPlayer(
          after.p1,
          '🎾 Eşleşmen belli oldu!',
          `Rakibin: ${after.p2Name}. Turnuvaya dönüp "Hazırım" de.`
        ),
        sendToPlayer(
          after.p2,
          '🎾 Eşleşmen belli oldu!',
          `Rakibin: ${after.p1Name}. Turnuvaya dönüp "Hazırım" de.`
        )
      ]);
      return; // aynı güncellemede ready bilgisi de değişmiş olamaz, çık
    }

    // Rakip "Hazırım" dedi, karşı taraf henüz demedi → "sıra sende" bildirimi.
    if (!before.readyP1 && after.readyP1 && !after.readyP2 && after.p2) {
      await sendToPlayer(
        after.p2,
        '⚡ Rakibin hazır!',
        `${after.p1Name} hazır, sıra sende. Maçın başlaması için sen de "Hazırım" de.`
      );
    }
    if (!before.readyP2 && after.readyP2 && !after.readyP1 && after.p1) {
      await sendToPlayer(
        after.p1,
        '⚡ Rakibin hazır!',
        `${after.p2Name} hazır, sıra sende. Maçın başlaması için sen de "Hazırım" de.`
      );
    }
  });

// ── Turnuva bitince tüm katılımcılara şampiyonluk duyurusu ──
exports.onTournamentFinished = functions.database
  .ref('tournaments/{tid}/status')
  .onUpdate(async (change, context) => {
    if (change.after.val() !== 'finished') return;

    const tid = context.params.tid;
    const tourSnap = await db.ref(`tournaments/${tid}`).once('value');
    const tour = tourSnap.val();
    if (!tour || !tour.participants) return;

    const championName = tour.championName || 'Bilinmiyor';
    const sids = Object.keys(tour.participants);
    await Promise.all(
      sids.map((sid) =>
        sendToPlayer(
          sid,
          '🏆 Turnuva Bitti!',
          `Şampiyon: ${championName}. Sonuçları görmek için turnuva tablosuna göz at.`
        )
      )
    );
  });
