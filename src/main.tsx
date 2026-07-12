import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { initNative } from './native';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);

// Native-only setup (no-op on web)
initNative();
