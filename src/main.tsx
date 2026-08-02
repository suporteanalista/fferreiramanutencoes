import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.update();
    });
  });

  caches.keys().then((cacheNames) => {
    cacheNames.forEach((cacheName) => {
      if (cacheName.includes('workbox-precache') || cacheName.includes('runtime')) {
        caches.delete(cacheName);
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
