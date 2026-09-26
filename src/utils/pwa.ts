// PWA registration and install prompt handler

let deferredInstallPrompt: any = null;

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Heirloom ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('Heirloom ServiceWorker registration failed:', err);
        });
    });

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      window.dispatchEvent(new Event('can-install-pwa'));
    });
  }
}

export function promptPwaInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    return Promise.resolve(false);
  }
  deferredInstallPrompt.prompt();
  return deferredInstallPrompt.userChoice.then((choiceResult: any) => {
    deferredInstallPrompt = null;
    return choiceResult.outcome === 'accepted';
  });
}
