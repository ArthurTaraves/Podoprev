// Service worker do PodoPrev — só exibe/abre notificações de lembrete de
// prescrição (ver src/mobile/prescriptionReminders.ts). Não intercepta
// requisições nem faz cache: não tem handler de "fetch" de propósito.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/patient/care';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // App já aberto: só traz a aba para frente (navegar recarregaria a página
      // e, no modo demonstração, perderia os dados que só existem em memória).
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
