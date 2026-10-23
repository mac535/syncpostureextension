import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import '../index.css';

export const MonitorApp: React.FC = () => {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#071220' }}>
        <header className="top-nav" style={{ padding: '10px 24px' }}>
          <div className="brand-badge">
            <span className="nav-status-dot" style={{ backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            <span>PostureSync — Live Vision & Ergonomic Monitor</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', fontFamily: 'monospace' }}>
              LOCAL INFERENCE ACTIVE
            </span>
          </div>
        </header>

        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

const rootElem = document.getElementById('root');
if (rootElem) {
  ReactDOM.createRoot(rootElem).render(
    <React.StrictMode>
      <MonitorApp />
    </React.StrictMode>
  );
}
