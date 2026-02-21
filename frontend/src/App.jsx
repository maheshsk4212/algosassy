import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import {
  BarChart3,
  Activity,
  ShieldCheck,
  SlidersHorizontal,
  PieChart,
  FlaskConical,
  HeartPulse,
  FileText,
  Settings,
  AlertOctagon,
  Zap
} from 'lucide-react';
import './App.css';

import { OverviewDashboard } from './pages/OverviewDashboard';
import { RiskControlPanel } from './pages/RiskControlPanel';
import { StrategyPanel } from './pages/StrategyPanel';
import { LiveExecution } from './pages/LiveExecution';
import { PortfolioView } from './pages/PortfolioView';
import { BacktestLab } from './pages/BacktestLab';
import { SystemHealth } from './pages/SystemHealth';
import { EmotionGuard } from './pages/EmotionGuard';
import { SettingsPage } from './pages/SettingsPage';

const GlobalRiskBanner = () => (
  <header className="global-risk-banner">
    <div className="banner-stats">
      <div className="stat-item">
        <span className="stat-label">Trading Status</span>
        <span className="stat-value status-indicator">
          <span className="status-dot active"></span> LIVE
        </span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Kill Switch</span>
        <span className="stat-value text-positive">ARMED</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Drift Monitor</span>
        <span className="stat-value text-cyan">NOMINAL</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Regime State</span>
        <span className="stat-value">TRENDING</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Global Risk</span>
        <span className="stat-value text-warning">ELEVATED</span>
      </div>
    </div>
  </header>
);

const navItems = [
  { path: '/', label: 'Overview', icon: BarChart3 },
  { path: '/execution', label: 'Live Execution', icon: Activity },
  { path: '/risk', label: 'Risk Control', icon: ShieldCheck },
  { path: '/strategies', label: 'Strategies', icon: SlidersHorizontal },
  { path: '/portfolio', label: 'Portfolio', icon: PieChart },
  { path: '/backtest', label: 'Backtest Lab', icon: FlaskConical },
  { path: '/health', label: 'System Health', icon: HeartPulse },
  { path: '/logs', label: 'Audit Logs', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

import { Menu, X } from 'lucide-react';

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <BrowserRouter>
      <div className="app-container">
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="mobile-header">
          <div className="mobile-brand">
            <span className="brand-dot"></span>
            <h2>Quant Cockpit</h2>
          </div>
          <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
            <Menu size={24} />
          </button>
        </div>

        {/* Mobile Overlay */}
        <div
          className={`mobile-overlay ${isMobileMenuOpen ? 'open' : ''}`}
          onClick={closeMobileMenu}
        ></div>

        <nav className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="sidebar-brand">
            <div className="brand-title">
              <span className="brand-dot"></span>
              <h2>Quant Cockpit</h2>
            </div>
            <button className="mobile-close-btn" onClick={closeMobileMenu}>
              <X size={24} />
            </button>
          </div>

          <div className="nav-links">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={closeMobileMenu}
                className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="sidebar-footer">
            <button className="btn btn-danger">
              <AlertOctagon size={14} /> Emergency Guard
            </button>
          </div>
        </nav>

        <main className="main-content">
          <GlobalRiskBanner />
          <div className="content-wrapper">
            <Routes>
              <Route path="/" element={<OverviewDashboard />} />
              <Route path="/execution" element={<LiveExecution />} />
              <Route path="/risk" element={<RiskControlPanel />} />
              <Route path="/strategies" element={<StrategyPanel />} />
              <Route path="/portfolio" element={<PortfolioView />} />
              <Route path="/backtest" element={<BacktestLab />} />
              <Route path="/health" element={<SystemHealth />} />
              <Route path="/audit" element={<EmotionGuard />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
