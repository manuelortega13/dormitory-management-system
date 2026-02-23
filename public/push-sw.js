// Immediately activate service worker
self.addEventListener('install', function(event) {
  console.log('[Push SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[Push SW] Activating...');
  event.waitUntil(clients.claim());
});

// Handle messages from the main app
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', function(event) {
  console.log('[Push SW] Push event received');
  
  if (!event.data) {
    console.log('[Push SW] No data in push event');
    return;
  }
  
  try {
    const data = event.data.json();
    console.log('[Push SW] Push data:', data);
    
    const options = {
      body: data.body || data.message || '',
      icon: data.icon || '/favicon.ico',
      badge: data.badge || '/favicon.ico',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/dashboard',
        dateOfArrival: Date.now(),
        primaryKey: 'push-notification'
      },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      requireInteraction: true,
      tag: 'dormitory-notification-' + Date.now()
    };
    
    console.log('[Push SW] Showing notification:', data.title);
    event.waitUntil(
      self.registration.showNotification(data.title || 'Dormitory Management', options)
    );
  } catch (error) {
    console.error('[Push SW] Push notification error:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
