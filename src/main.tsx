import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/700.css';
import '@fontsource/noto-sans-kr/900.css';
import '@fontsource/noto-sans-kr/900.css';
import '@fontsource/black-han-sans';
import './styles/base.css';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('root 엘리먼트를 찾을 수 없습니다.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
