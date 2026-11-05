import ReactDOM from 'react-dom/client';
// Global styles load FIRST, so each component's own CSS (pulled in by App
// below) comes later in the bundle and can override the shared basics.
// Self-hosted brand font (bundled with the site, no call to Google Fonts):
import '@fontsource-variable/plus-jakarta-sans';
import './styles/index.css';
import App from './App';
import { initNative } from './native';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);

// Native-only setup (no-op on web)
initNative();
