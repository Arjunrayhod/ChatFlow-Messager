/**
 * @file ChatFlow Service Worker (sw.js)
 * Enables background notifications for calls and messages when the app window is
 * minimized, backgrounded, locked, or completely closed.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Listen for background Push events (from Web Push / Server)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'ChatFlow';
  const type = data.type || (data.data && data.data.type) || 'message';
  const isCall = type === 'incoming_call';

  const options = {
    body: data.body || (isCall ? 'Incoming call...' : 'New message received'),
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || (isCall ? `call_${data.callId || Date.now()}` : `msg_${data.chatId || Date.now()}`),
    vibrate: isCall
      ? [0, 500, 250, 500, 250, 500, 250, 500]
      : [0, 250, 250, 250],
    requireInteraction: isCall,
    data: {
      url: data.url || '/',
      callId: data.callId,
      chatId: data.chatId,
      type,
    },
    actions: isCall
      ? [
          { action: 'answer', title: '✅ Answer' },
          { action: 'decline', title: '❌ Decline' },
        ]
      : [
          { action: 'open', title: '💬 Open Chat' },
        ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Handle notification click (User taps notification in phone notification bar)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a ChatFlow tab is already open, focus it
      for (const client of windowClients) {
        if ('focus' in client) {
          if (data.type === 'incoming_call' && event.action === 'decline') {
            client.postMessage({ type: 'CALL_DECLINED', callId: data.callId });
            return;
          }
          if (data.type === 'incoming_call' && event.action === 'answer') {
            client.postMessage({ type: 'CALL_ANSWERED', callId: data.callId });
          }
          return client.focus();
        }
      }

      // If no window is open (app completely closed), open ChatFlow
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 3. Listen for postMessages from the active client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});
