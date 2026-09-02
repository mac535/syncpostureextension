import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Demo } from './pages/Demo';
import { Activity, LayoutDashboard, Home as HomeIcon } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Navigation Bar */}
        <header className="top-nav">
          <NavLink to="/" className="brand-badge">
            <Activity size={24} color="#60a5fa" />
            <span>syncPosture</span>
          </NavLink>

          <nav className="nav-links">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <HomeIcon size={16} /> Home
              </span>
            </NavLink>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Activity size={16} /> Dashboard
              </span>
            </NavLink>
            <NavLink to="/demo" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <LayoutDashboard size={16} /> Demo Website
              </span>
            </NavLink>
          </nav>
        </header>

        {/* Routes */}
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/demo" element={<Demo />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
