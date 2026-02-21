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
import { apiUrl } from './config/api';
import { withAdminHeaders } from './config/admin';

import { OverviewDashboard } from './pages/OverviewDashboard';
import { RiskControlPanel } from './pages/RiskControlPanel';
import { StrategyPanel } from './pages/StrategyPanel';
import { LiveExecution } from './pages/LiveExecution';
import { PortfolioView } from './pages/PortfolioView';
import { BacktestLab } from './pages/BacktestLab';
import { SystemHealth } from './pages/SystemHealth';
import { EmotionGuard } from './pages/EmotionGuard';
import { AuditLogPage } from './pages/AuditLogPage';
import { SettingsPage } from './pages/SettingsPage';

const GlobalRiskBanner = () => {
  const [bannerData, setBannerData] = React.useState({
    trading_status: 'CONNECTING',
    kill_switch: '--',
    drift_monitor: '--',
    regime_state: '--',
    global_risk: '--',
    drawdown_percent: 0,
  });
  const [lastUpdated, setLastUpdated] = React.useState(null);

  React.useEffect(() => {
    const fetchBannerData = async () => {
      try {
        const [govRes, stateRes] = await Promise.all([
          fetch(apiUrl('/api/v1/governance/status')),
          fetch(apiUrl('/api/v1/protected/status'))
        ]);
        const gov = await govRes.json();
        const state = await stateRes.json();
        const dd = gov.drawdown_percent || 0;
        setBannerData({
          trading_status: state.state === 'READY' ? 'Trading Active' : state.state,
          kill_switch: 'Kill Switch Armed',
          drift_monitor: gov.active_sizing_penalty < 1.0 ? 'DEGRADED' : 'NOMINAL',
          regime_state: gov.current_market_regime || 'TRENDING',
          global_risk: dd > 5 ? 'HIGH' : dd > 2 ? 'ELEVATED' : 'NORMAL',
          drawdown_percent: dd,
        });
        setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour12: false }));
      } catch {
        setBannerData(prev => ({ ...prev, trading_status: 'OFFLINE' }));
      }
    };
    fetchBannerData();
    const t = setInterval(fetchBannerData, 2000);
    return () => clearInterval(t);
  }, []);

  const isLive = bannerData.trading_status === 'Trading Active';
  const riskLevel = bannerData.global_risk; // NORMAL | ELEVATED | HIGH

  const bannerClass = ['global-risk-banner',
    riskLevel === 'HIGH' ? 'risk-banner-high' :
      riskLevel === 'ELEVATED' ? 'risk-banner-elevated' : ''
  ].join(' ');

  return (
    <header className={bannerClass}>
      <div className="banner-inner">
        {/* PRIMARY TIER — Risk dominance. Human eye lands here first. */}
        <div className="banner-primary">
          <div className="stat-item primary-stat">
            <span className="stat-label stat-label-primary">Global Risk</span>
            <span className={`stat-value stat-value-primary ${riskLevel === 'HIGH' ? 'text-alert' :
              riskLevel === 'ELEVATED' ? 'text-warning' : 'text-positive'
              }`}>{bannerData.global_risk}</span>
          </div>
          <div className="banner-divider" />
          <div className="stat-item primary-stat">
            <span className="stat-label stat-label-primary">Kill Switch</span>
            <span className="stat-value stat-value-primary text-positive">{bannerData.kill_switch}</span>
          </div>
        </div>

        {/* SECONDARY TIER — Operational states, visually muted */}
        <div className="banner-secondary">
          <div className="stat-item">
            <span className="stat-label">Status</span>
            <span className="stat-value status-indicator">
              <span className={`status-dot ${isLive ? 'active' : 'critical'}`}></span>
              {bannerData.trading_status}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Regime</span>
            <span className="stat-value stat-muted">{bannerData.regime_state}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Drift</span>
            <span className={`stat-value stat-muted ${bannerData.drift_monitor === 'NOMINAL' ? 'text-cyan' : 'text-warning'}`}>
              {bannerData.drift_monitor}
            </span>
          </div>
        </div>

        {/* TIMESTAMP — governance transparency */}
        {lastUpdated && (
          <div className="banner-timestamp">
            <span className="ts-label">Updated</span>
            <span className="ts-value">{lastUpdated}</span>
          </div>
        )}
      </div>
    </header>
  );
};

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

const bottomNavItems = [
  { path: '/', label: 'Overview', icon: BarChart3 },
  { path: '/execution', label: 'Execution', icon: Activity },
  { path: '/risk', label: 'Risk', icon: ShieldCheck },
  { path: '/portfolio', label: 'Portfolio', icon: PieChart },
];

import { Menu, X, Link2, CheckCircle, WifiOff } from 'lucide-react';

/** Polls the backend every 3s to show Kite session state in the sidebar */
const KiteSessionStatus = () => {
  const [status, setStatus] = React.useState('checking'); // checking | ready | disconnected

  React.useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/protected/status'));
        if (!res.ok) { setStatus('disconnected'); return; }
        const data = await res.json();
        setStatus(data.state === 'READY' ? 'ready' : 'disconnected');
      } catch {
        setStatus('disconnected');
      }
    };
    check();
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, []);

  if (status === 'ready') {
    return (
      <div className="kite-session-badge kite-session-connected">
        <CheckCircle size={12} />
        <span>Kite Connected</span>
      </div>
    );
  }

  if (status === 'disconnected') {
    return (
      <a
        className="kite-login-btn"
        href={apiUrl('/api/v1/auth/login')}
        title="Login with your Zerodha account to start live trading"
      >
        <Link2 size={13} />
        Connect Kite Account
      </a>
    );
  }

  return (
    <div className="kite-session-badge kite-session-checking">
      <WifiOff size={12} />
      <span>Connecting...</span>
    </div>
  );
};

const EmergencyGuardButton = () => {
  const [isLiquidating, setIsLiquidating] = React.useState(false);

  const handleKillSwitch = async () => {
    if (!window.confirm("🚨 CRITICAL ACTION REQUIRED 🚨\n\nThis will immediately:\n1. Flatten ALL open positions (Market Orders)\n2. Cancel ALL pending orders\n3. Disable the trading engine\n\nAre you absolutely sure?")) {
      return;
    }

    setIsLiquidating(true);
    try {
      const res = await fetch(
        apiUrl('/api/v1/protected/kill-switch'),
        withAdminHeaders({ method: 'POST' })
      );
      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to trigger kill switch: ${data.detail || 'Unknown error'}`);
      } else {
        alert("Emergency Liquidation Protocol Initiated.");
      }
    } catch {
      alert("Network error while triggering emergency guard.");
    } finally {
      setIsLiquidating(false);
    }
  };

  return (
    <button
      className={`btn btn-danger ${isLiquidating ? 'loading' : ''}`}
      onClick={handleKillSwitch}
      disabled={isLiquidating}
    >
      <AlertOctagon size={14} className={isLiquidating ? 'spin' : ''} />
      {isLiquidating ? 'LIQUIDATING...' : 'Emergency Guard'}
    </button>
  );
};

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Session-long fatigue reduction: after 4hrs, de-saturate accents by 15%
  // This reduces cognitive fatigue without alarming the trader
  React.useEffect(() => {
    const fourHours = 4 * 60 * 60 * 1000;
    const timer = setTimeout(() => {
      document.body.classList.add('session-long');
    }, fourHours);
    return () => clearTimeout(timer);
  }, []);

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
            <KiteSessionStatus />
            <EmergencyGuardButton />
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
              <Route path="/logs" element={<AuditLogPage />} />
              <Route path="/audit" element={<EmotionGuard />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        {/* Mobile Bottom Navigation (Hidden on Desktop) */}
        <nav className="mobile-bottom-nav">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={closeMobileMenu}
              className={({ isActive }) => isActive ? 'bottom-nav-item active' : 'bottom-nav-item'}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button className="bottom-nav-item menu-toggle" onClick={toggleMobileMenu}>
            <Menu size={20} />
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </BrowserRouter>
  );
}

export default App;
