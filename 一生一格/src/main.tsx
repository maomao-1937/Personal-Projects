import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource-variable/manrope';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The page remains usable when this browser does not allow offline caching.
    });
  });
}
