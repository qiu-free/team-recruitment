import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return <main><h1>组队集市</h1><p>项目招募 Demo 正在启动。</p></main>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
