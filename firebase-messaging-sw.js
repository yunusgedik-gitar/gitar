/* ══════════════════════════════════════════════════════════
   firebase-messaging-sw.js
   Site kapalıyken / sekme arka plandayken gelen push
   bildirimlerini gösteren servis çalışanı (service worker).

   ÖNEMLİ: Bu dosya sitenin KÖK dizininde (domain'in hemen
   altında, örn. https://gitar.yunusgedik.com.tr/firebase-messaging-sw.js)
   durmalı. Bir alt klasöre koyarsanız FCM bildirimleri çalışmaz.

   NOT: Mesajlar "data" payload olarak gönderiliyor (notification
   alanı DEĞİL). Bunun sebebi: eğer mesajda "notification" alanı
   olursa, tarayıcı arka plandayken bildirimi HEM otomatik hem de
   biz burada elle gösterdiğimiz için ÇİFT bildirim çıkıyordu.
   "data" kullanınca otomatik gösterim devre dışı kalıyor, sadece
   aşağıdaki kod bir kez gösteriyor.
══════════════════════════════════════════════════════════ */

importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBkEd729B65y-NZIQ-sxScCgaEvlX-q7yA",
  authDomain: "gitar-yunus.firebaseapp.com",
  databaseURL: "https://gitar-yunus-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gitar-yunus",
  storageBucket: "gitar-yunus.firebasestorage.app",
  messagingSenderId: "184803778782",
  appId: "1:184803778782:web:8f9fbeb4fe625eb386e24f"
});

const messaging = firebase.messaging();

// Site kapalıyken / arka plandayken gelen mesajları bildirim olarak göster.
// data payload kullanıldığı için payload.notification YOK, payload.data var.
messaging.onBackgroundMessage((payload) => {
  const data  = payload.data || {};
  const title = data.title || '🎸 Nota Okuma Turnuvası';
  const body  = data.body  || '';
  const icon  = data.icon  || '/favicon.ico';
  const link  = data.link  || 'https://gitar.yunusgedik.com.tr/';

  self.registration.showNotification(title, {
    body,
    icon,
    badge: '/favicon.ico',
    data: { url: link }
  });
});

// Bildirime tıklanınca siteyi aç / var olan sekmeye odaklan.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || 'https://gitar.yunusgedik.com.tr/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(new URL(url).origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
