import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initNativePush } from './utils/native';

initNativePush();   // نیٹو Android ایپ میں آواز کے چینل بنتے ہیں؛ ویب پر کچھ نہیں کرتا

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
