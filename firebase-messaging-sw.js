/* ══════════════════════════════════════════════════════════
   firebase-messaging-sw.js
   Site kapalıyken / sekme arka plandayken gelen push
   bildirimlerini gösteren servis çalışanı (service worker).

   ÖNEMLİ: Bu dosya sitenin KÖK dizininde (domain'in hemen
   altında, örn. https://gitar.yunusgedik.com.tr/firebase-messaging-sw.js)
   durmalı. Bir alt klasöre koyarsanız FCM bildirimleri çalışmaz.

   NOT: Mesaj "notification" alanıyla gönderiliyor, bu yüzden
   tarayıcı bildirimi ARKA PLANDA OTOMATİK gösteriyor — burada
   elle showNotification() ÇAĞIRMIYORUZ, aksi halde bildirim
   çift çıkar. Bu dosyada sadece bildirime TIKLANINCA ne
   olacağını yönetiyoruz.
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

// firebase.messaging() çağrısı, "notification" alanlı mesajları
// arka planda OTOMATİK gösterecek şekilde SDK'yı devreye sokar.
// Elle bir onBackgroundMessage / showNotification çağrısına gerek yok.
firebase.messaging();

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

