/**
 * src/registerServiceWorker.js
 *
 * Registers the PLawminary Service Worker to enable offline application shell
 * caching and navigation fallback.
 */

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[SW] Registered successfully with scope:', registration.scope);

          // Listen for new worker installation
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[SW] New version available. Refresh to update.');
                  } else {
                    console.log('[SW] Application shell cached for offline use.');
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.error('[SW] Registration failed:', error);
        });
    });
  }
}
