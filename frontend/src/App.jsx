import React from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  ChartNoAxesColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  SquareTerminal,
  Wallet,
  X,
} from 'lucide-react';
import './App.css';
import { apiUrl } from './config/api';
import {
  clearAppAccessToken,
  getAccessRequiredEventName,
  getAppAccessToken,
  setAppAccessToken,
} from './config/appAccess';

const STORAGE_MY_STRATEGIES = 'algo_sassy_my_strategies_v2';
const STORAGE_DEPLOYED_STRATEGIES = 'algo_sassy_deployed_strategies_v2';
const STORAGE_BROKER_SETTINGS = 'algo_sassy_broker_settings_v2';

const TEMPLATE_STRATEGIES = [
  { id: 'tpl_1', name: 'GOLDEN CROSSOVER NIFTY BUYING', type: 'Indicator Based' },
  { id: 'tpl_2', name: '1% Strangle Nifty', type: 'Time Based' },
  { id: 'tpl_3', name: 'GOLDEN CROSSOVER NIFTY SELLING', type: 'Indicator Based' },
  { id: 'tpl_4', name: 'Sniper Nifty Option Buying', type: 'Price Action Based' },
  { id: 'tpl_5', name: 'Advanced Delta Neutral', type: 'Time Based' },
  { id: 'tpl_6', name: '1.5 % SL Strangle BNF', type: 'Time Based' },
  { id: 'tpl_7', name: 'Brahmastra Nifty Option Buying', type: 'Indicator Based' },
];

const DAY_OPTIONS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatMoney(value) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function normalizeStrategyName(name) {
  return (name || '').trim() || 'Untitled Strategy';
}

function nowId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function useAuthStatusPoll() {
  const [authStatus, setAuthStatus] = React.useState({
    connected: false,
    userLabel: 'No broker selected',
    reason: '',
  });

  React.useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/auth/status'));
        if (!res.ok) {
          setAuthStatus({ connected: false, userLabel: 'No broker selected', reason: 'Unable to verify broker session.' });
          return;
        }
        const data = await res.json();
        setAuthStatus({
          connected: Boolean(data.authenticated),
          userLabel: data.authenticated ? 'Zerodha (Connected)' : 'No broker selected',
          reason: data.reason || '',
        });
      } catch {
        setAuthStatus({ connected: false, userLabel: 'No broker selected', reason: 'Backend unreachable.' });
      }
    };

    poll();
    timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, []);

  return authStatus;
}

function useOverviewPoll() {
  const [overview, setOverview] = React.useState({
    unrealized_pnl: 0,
    performance_stats: { trades_today: 0 },
  });

  React.useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/dashboard/overview'));
        if (!res.ok) return;
        const data = await res.json();
        setOverview(data || {});
      } catch {
        // no-op
      }
    };
    poll();
    timer = setInterval(poll, 8000);
    return () => clearInterval(timer);
  }, []);

  return overview;
}

function AppAccessGate({ onUnlock }) {
  const [accessKeyInput, setAccessKeyInput] = React.useState('');
  const [isUnlocking, setIsUnlocking] = React.useState(false);
  const [accessError, setAccessError] = React.useState('');

  const handleAccessUnlock = async (event) => {
    event.preventDefault();
    const token = accessKeyInput.trim();
    if (!token) {
      setAccessError('Access key is required.');
      return;
    }

    setIsUnlocking(true);
    setAccessError('');
    setAppAccessToken(token);

    try {
      const response = await fetch(apiUrl('/api/v1/protected/status'), {
        headers: { 'X-App-Token': token },
      });
      if (response.status === 401) throw new Error('Invalid access key.');
      if (!response.ok) throw new Error('Unable to verify access key right now.');
      setAccessKeyInput('');
      onUnlock();
    } catch (error) {
      clearAppAccessToken();
      setAccessError(error.message || 'Access verification failed.');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="access-gate">
      <form className="access-gate-card" onSubmit={handleAccessUnlock}>
        <h1>Private Dashboard Access</h1>
        <p>Enter your app access key to unlock Algo-Sassy.</p>
        <input
          type="password"
          placeholder="Enter access key"
          value={accessKeyInput}
          onChange={(event) => setAccessKeyInput(event.target.value)}
          autoComplete="current-password"
          autoFocus
        />
        {accessError && <p className="access-gate-error">{accessError}</p>}
        <button type="submit" disabled={isUnlocking}>
          {isUnlocking ? 'Verifying...' : 'Unlock Dashboard'}
        </button>
      </form>
    </div>
  );
}

function Sidebar({ mobileOpen, setMobileOpen }) {
  const [backtestOpen, setBacktestOpen] = React.useState(true);

  const navMain = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/broker', label: 'Broker', icon: Wallet },
    { to: '/strategy-builder', label: 'Strategy Builder', icon: LineChart },
    { to: '/strategies', label: 'Strategies', icon: Boxes },
  ];

  const navTail = [{ to: '/reports', label: 'Reports', icon: ChartNoAxesColumn }];

  return (
    <>
      <div className={`left-rail-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
      <aside className={`left-rail ${mobileOpen ? 'open' : ''}`}>
        <div className="left-rail-brand">
          <div className="brand-logo-dot" />
          <strong>Algo-Sassy</strong>
          <button className="icon-btn only-mobile" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="left-rail-nav">
          {navMain.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <button className="rail-item rail-item-button" onClick={() => setBacktestOpen((v) => !v)}>
            <FlaskConical size={17} />
            <span>Backtesting</span>
            <ChevronDown size={15} className={`chevron ${backtestOpen ? 'open' : ''}`} />
          </button>

          {backtestOpen && (
            <div className="rail-submenu">
              <NavLink
                to="/backtesting/strategy-backtest"
                className={({ isActive }) => `rail-subitem ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                Strategy Backtest
              </NavLink>
              <NavLink
                to="/backtesting/simulator"
                className={({ isActive }) => `rail-subitem ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                Simulator
              </NavLink>
            </div>
          )}

          {navTail.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

function TopBar({ onMenuClick }) {
  return (
    <header className="topbar">
      <button className="icon-btn only-mobile" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={18} />
      </button>

      <div className="topbar-right">
        <span className="beta-pill">BETA</span>
        <div className="v-switch">
          <span>V1</span>
          <button className="switch-btn" aria-label="Version switch"><span /></button>
          <span>V2</span>
        </div>
        <button className="icon-btn" aria-label="Automation"><Bot size={16} /></button>
        <button className="icon-btn" aria-label="Theme"><Moon size={16} /></button>
        <button className="icon-btn" aria-label="Notifications"><Bell size={16} /></button>
      </div>
    </header>
  );
}

function StrategyTemplateCard({ template, onAdd }) {
  return (
    <article className="template-card">
      <h4>{template.name}</h4>
      <button onClick={() => onAdd(template)}>Add to my strategy</button>
    </article>
  );
}

function DashboardPage({ brokerState, authStatus, overview, templates, onAddTemplate, deployedCount }) {
  const navigate = useNavigate();
  const pnl = Number(overview?.unrealized_pnl || 0);
  return (
    <section className="page">
      <div className="page-title-row">
        <h1>My Dashboard</h1>
        <span className="title-meta">{authStatus.userLabel}</span>
      </div>

      <div className="dashboard-grid-top">
        <article className="pnl-card">
          <span>Total P&amp;L</span>
          <h2 className={pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatMoney(pnl)}</h2>
          <p>{Number(overview?.performance_stats?.trades_today || 0)} trades today.</p>
          <footer>mahesh sk</footer>
        </article>

        <article className="status-card">
          <div className="status-card-head">
            <h3>Broker</h3>
            <ChevronDown size={16} />
          </div>
          <div className="broker-line">
            <CircleDot size={12} />
            <strong>Zerodha</strong>
            <span className="muted">(LPM816)</span>
          </div>
          <div className="broker-login-state">{authStatus.connected ? 'Connected' : 'Disconnected'}</div>
          <div className="toggle-row">
            <label>Terminal
              <input type="checkbox" checked={brokerState.terminalOn} onChange={(e) => brokerState.setTerminalOn(e.target.checked)} />
            </label>
            <label>Trading Engine
              <input type="checkbox" checked={brokerState.engineOn} onChange={(e) => brokerState.setEngineOn(e.target.checked)} />
            </label>
          </div>
        </article>

        <article className="deploy-card">
          <h3>Strategy Deployed</h3>
          {deployedCount > 0 ? (
            <>
              <div className="deploy-count">{deployedCount}</div>
              <p>Strategies currently deployed.</p>
              <button onClick={() => navigate('/strategies')}>View Deployed</button>
            </>
          ) : (
            <>
              <div className="deploy-empty-icon"><SquareTerminal size={28} /></div>
              <h4>No Strategies Deployed</h4>
              <p>You haven't deployed any trading strategies yet.</p>
              <button onClick={() => navigate('/strategy-builder')}>Create Strategy</button>
            </>
          )}
        </article>
      </div>

      <div className="section-head">
        <h2>Strategy Templates</h2>
      </div>

      <div className="templates-grid">
        {templates.slice(0, 3).map((tpl) => (
          <StrategyTemplateCard key={tpl.id} template={tpl} onAdd={onAddTemplate} />
        ))}
      </div>
    </section>
  );
}

function BrokerPage({ authStatus, brokerState }) {
  return (
    <section className="page">
      <div className="panel page-panel">
        <div className="panel-head">
          <div>
            <h1>Broker</h1>
            <p>Manage your connected brokers</p>
          </div>
          <a className="btn-primary" href={apiUrl('/api/v1/auth/login')}>+ Add Broker</a>
        </div>

        <div className="broker-card">
          <div className="broker-left">
            <div className="broker-logo">⟨</div>
            <div>
              <h3>Zerodha</h3>
              <p>LPM816</p>
              <strong className={authStatus.connected ? 'ok-text' : 'warn-text'}>{authStatus.connected ? 'Connected' : 'Disconnected'}</strong>
            </div>
          </div>

          <div className="broker-mid">
            <span>Strategy Performance</span>
            <strong>{formatMoney(0)}</strong>
          </div>

          <div className="broker-right toggles-inline">
            <label>Terminal
              <input type="checkbox" checked={brokerState.terminalOn} onChange={(e) => brokerState.setTerminalOn(e.target.checked)} />
            </label>
            <label>Trading Engine
              <input type="checkbox" checked={brokerState.engineOn} onChange={(e) => brokerState.setEngineOn(e.target.checked)} />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

function StrategyBuilderPage({ onCreateStrategy }) {
  const [strategyType, setStrategyType] = React.useState({ time: true, indicator: false, priceAction: false });
  const [orderType, setOrderType] = React.useState('MIS');
  const [startTime, setStartTime] = React.useState('09:16');
  const [squareOffTime, setSquareOffTime] = React.useState('15:15');
  const [days, setDays] = React.useState(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  const [strategyName, setStrategyName] = React.useState('');
  const [instrument, setInstrument] = React.useState('NIFTY 50');
  const [advanced, setAdvanced] = React.useState({
    moveSlCost: false,
    exitAll: false,
    prePunchSl: false,
    waitTrade: false,
    premiumDiff: false,
    reEntry: false,
    trailSl: false,
  });
  const [risk, setRisk] = React.useState({ profitCap: '', lossCap: '', noTradeAfter: '15:15', trailingMode: 'No Trailing' });
  const [legs, setLegs] = React.useState([
    {
      id: nowId('leg'),
      side: 'BUY',
      optionType: 'Call',
      quantity: 1,
      expiry: 'WEEKLY',
      strikeCriteria: 'ATM pt',
      strikeType: 'ATM',
      slType: 'SL%',
      slValue: '',
      tpType: 'TP%',
      tpValue: '',
    },
  ]);
  const [status, setStatus] = React.useState('');

  const toggleDay = (day) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const updateLeg = (id, patch) => {
    setLegs((prev) => prev.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)));
  };

  const addLeg = () => {
    setLegs((prev) => [
      ...prev,
      {
        id: nowId('leg'),
        side: 'BUY',
        optionType: 'Call',
        quantity: 1,
        expiry: 'WEEKLY',
        strikeCriteria: 'ATM pt',
        strikeType: 'ATM',
        slType: 'SL%',
        slValue: '',
        tpType: 'TP%',
        tpValue: '',
      },
    ]);
  };

  const removeLeg = (id) => {
    setLegs((prev) => (prev.length > 1 ? prev.filter((leg) => leg.id !== id) : prev));
  };

  const createStrategy = () => {
    const normalizedName = normalizeStrategyName(strategyName);
    const strategyTypeLabel = strategyType.indicator
      ? 'Indicator Based'
      : strategyType.priceAction
        ? 'Price Action Based'
        : 'Time Based';

    onCreateStrategy({
      id: nowId('strat'),
      name: normalizedName,
      startTime,
      endTime: squareOffTime,
      strategyType: strategyTypeLabel,
      segmentType: orderType,
      instrument,
      weekdays: days,
      legs,
      advanced,
      risk,
      createdAt: new Date().toISOString(),
      deployed: false,
      source: 'custom_builder',
    });

    setStatus(`Strategy "${normalizedName}" created.`);
    setStrategyName('');
  };

  return (
    <section className="page">
      <div className="builder-grid">
        <div className="panel">
          <h3>Strategy Type</h3>
          <div className="check-stack">
            <label><input type="checkbox" checked={strategyType.time} onChange={(e) => setStrategyType((v) => ({ ...v, time: e.target.checked }))} /> Time Based</label>
            <label><input type="checkbox" checked={strategyType.indicator} onChange={(e) => setStrategyType((v) => ({ ...v, indicator: e.target.checked }))} /> Indicator Based</label>
            <label><input type="checkbox" checked={strategyType.priceAction} onChange={(e) => setStrategyType((v) => ({ ...v, priceAction: e.target.checked }))} /> Price Action Based</label>
          </div>
        </div>

        <div className="panel">
          <h3>Select Instruments</h3>
          <div className="instrument-picker">
            <input value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="NIFTY 50" />
          </div>
        </div>

        <div className="panel strategy-legs-panel">
          <div className="panel-head compact">
            <h3>Strategy Legs</h3>
            <button className="btn-primary" onClick={addLeg}>+ Add Leg</button>
          </div>

          {legs.map((leg, index) => (
            <div className="leg-card" key={leg.id}>
              <div className="leg-head">
                <strong>Leg {index + 1}</strong>
                <button className="icon-btn danger" onClick={() => removeLeg(leg.id)} aria-label="Delete leg"><X size={14} /></button>
              </div>
              <div className="form-grid-3">
                <label>Qty <input type="number" min="1" value={leg.quantity} onChange={(e) => updateLeg(leg.id, { quantity: Number(e.target.value || 1) })} /></label>
                <label>Position
                  <select value={leg.side} onChange={(e) => updateLeg(leg.id, { side: e.target.value })}>
                    <option>BUY</option>
                    <option>SELL</option>
                  </select>
                </label>
                <label>Option Type
                  <select value={leg.optionType} onChange={(e) => updateLeg(leg.id, { optionType: e.target.value })}>
                    <option>Call</option>
                    <option>Put</option>
                  </select>
                </label>
                <label>Expiry
                  <select value={leg.expiry} onChange={(e) => updateLeg(leg.id, { expiry: e.target.value })}>
                    <option>WEEKLY</option>
                    <option>MONTHLY</option>
                  </select>
                </label>
                <label>Strike Criteria
                  <select value={leg.strikeCriteria} onChange={(e) => updateLeg(leg.id, { strikeCriteria: e.target.value })}>
                    <option>ATM pt</option>
                    <option>OTM by points</option>
                    <option>ITM by points</option>
                  </select>
                </label>
                <label>Strike Type
                  <select value={leg.strikeType} onChange={(e) => updateLeg(leg.id, { strikeType: e.target.value })}>
                    <option>ATM</option>
                    <option>OTM</option>
                    <option>ITM</option>
                  </select>
                </label>
                <label>SL Type
                  <select value={leg.slType} onChange={(e) => updateLeg(leg.id, { slType: e.target.value })}>
                    <option>SL%</option>
                    <option>Points</option>
                  </select>
                </label>
                <label>SL
                  <input value={leg.slValue} onChange={(e) => updateLeg(leg.id, { slValue: e.target.value })} placeholder="e.g. 10" />
                </label>
                <label>TP Type
                  <select value={leg.tpType} onChange={(e) => updateLeg(leg.id, { tpType: e.target.value })}>
                    <option>TP%</option>
                    <option>Points</option>
                  </select>
                </label>
                <label>TP
                  <input value={leg.tpValue} onChange={(e) => updateLeg(leg.id, { tpValue: e.target.value })} placeholder="e.g. 20" />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="panel order-panel">
          <h3>Order Type</h3>
          <div className="inline-radio">
            {['MIS', 'CNC', 'BTST'].map((v) => (
              <label key={v}><input type="radio" name="orderType" checked={orderType === v} onChange={() => setOrderType(v)} /> {v}</label>
            ))}
          </div>
          <div className="form-grid-2">
            <label>Start Time <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
            <label>Square Off <input type="time" value={squareOffTime} onChange={(e) => setSquareOffTime(e.target.value)} /></label>
          </div>
          <div className="weekdays-row">
            {DAY_OPTIONS.map((day) => (
              <button key={day} className={`day-chip ${days.includes(day) ? 'active' : ''}`} onClick={() => toggleDay(day)}>{day}</button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3>Risk Management</h3>
          <p>Control your trading outcomes with global profit/loss limits.</p>
          <div className="form-grid-3">
            <label>Exit When Over All Profit
              <input value={risk.profitCap} onChange={(e) => setRisk((v) => ({ ...v, profitCap: e.target.value }))} placeholder="Amount" />
            </label>
            <label>Exit When Over All Loss
              <input value={risk.lossCap} onChange={(e) => setRisk((v) => ({ ...v, lossCap: e.target.value }))} placeholder="Amount" />
            </label>
            <label>No Trade After
              <input type="time" value={risk.noTradeAfter} onChange={(e) => setRisk((v) => ({ ...v, noTradeAfter: e.target.value }))} />
            </label>
          </div>
          <div className="inline-radio compact">
            {['No Trailing', 'Lock Fix Profit', 'Trail Profit', 'Lock and Trail'].map((mode) => (
              <label key={mode}><input type="radio" name="trailMode" checked={risk.trailingMode === mode} onChange={() => setRisk((v) => ({ ...v, trailingMode: mode }))} /> {mode}</label>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3>Advance Features</h3>
          <p>Use advanced execution controls for dynamic behavior.</p>
          <div className="check-grid-3">
            {[
              ['moveSlCost', 'Move SL to Cost'],
              ['exitAll', 'Exit All on SL/Tgt'],
              ['prePunchSl', 'Pre Punch SL'],
              ['waitTrade', 'Wait & Trade'],
              ['premiumDiff', 'Premium Difference'],
              ['reEntry', 'Re Entry/Execute'],
              ['trailSl', 'Trail SL'],
            ].map(([key, label]) => (
              <label key={key}><input type="checkbox" checked={advanced[key]} onChange={(e) => setAdvanced((v) => ({ ...v, [key]: e.target.checked }))} /> {label}</label>
            ))}
          </div>
        </div>

        <div className="panel create-panel">
          <h3>Strategy Name</h3>
          <input value={strategyName} onChange={(e) => setStrategyName(e.target.value)} placeholder="Enter your strategy name here" />
          <button className="btn-primary large" onClick={createStrategy}>Create</button>
          {status && <div className="status-ok">{status}</div>}
        </div>
      </div>
    </section>
  );
}

function StrategyCard({ row, onBacktest, onDeploy, deployedMode }) {
  return (
    <article className="strategy-card">
      <div className="strategy-card-head">
        <h4>{row.name}</h4>
      </div>

      <div className="strategy-meta-grid">
        <div><span>Start Time</span><strong>{row.startTime || '09:16'}</strong></div>
        <div><span>End Time</span><strong>{row.endTime || '15:15'}</strong></div>
        <div><span>Segment Type</span><strong>{row.segmentType || 'MIS'}</strong></div>
        <div><span>Strategy Type</span><strong>{row.strategyType || 'Time Based'}</strong></div>
      </div>

      <div className="legs-preview">
        {(row.legs || []).slice(0, 2).map((leg) => (
          <div key={leg.id || `${row.id}_${leg.side}_${leg.optionType}`} className="leg-line">
            <span>{`${leg.side} ${row.instrument || 'NIFTY 50'} ${leg.optionType || 'Call'}`}</span>
            <small>Qty: {leg.quantity || 1}</small>
          </div>
        ))}
      </div>

      <div className="strategy-actions">
        <button onClick={() => onBacktest(row)}>Backtest</button>
        {!deployedMode && <button className="btn-primary" onClick={() => onDeploy(row)}>Deploy</button>}
      </div>
    </article>
  );
}

function StrategiesPage({ myStrategies, deployedStrategies, templates, onAddTemplate, onDeploy, onBacktestFromCard }) {
  const navigate = useNavigate();
  const [tab, setTab] = React.useState('my');
  const [search, setSearch] = React.useState('');
  const filtered = myStrategies.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
  const handleBacktest = (row) => {
    onBacktestFromCard(row);
    navigate('/backtesting/strategy-backtest');
  };

  return (
    <section className="page">
      <div className="tabs-row">
        <button className={tab === 'my' ? 'active' : ''} onClick={() => setTab('my')}>My Strategies</button>
        <button className={tab === 'deployed' ? 'active' : ''} onClick={() => setTab('deployed')}>Deployed Strategies</button>
        <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>Strategy Templates</button>
      </div>

      {tab === 'my' && (
        <>
          <div className="search-row">
            <div className="search-box"><Search size={16} /><input placeholder="Search strategies..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <button className="btn-ghost">Strategies</button>
          </div>
          <div className="strategy-grid">
            {filtered.length > 0 ? filtered.map((row) => (
              <StrategyCard key={row.id} row={row} onBacktest={handleBacktest} onDeploy={onDeploy} />
            )) : <div className="empty-inline">No strategies found.</div>}
          </div>
        </>
      )}

      {tab === 'deployed' && (
        <>
          <div className="deployed-head"><button className="btn-link"><RefreshCw size={14} /> Refresh</button></div>
          {deployedStrategies.length > 0 ? (
            <div className="strategy-grid">
              {deployedStrategies.map((row) => (
                <StrategyCard key={row.id} row={row} deployedMode onBacktest={handleBacktest} onDeploy={() => { }} />
              ))}
            </div>
          ) : (
            <div className="deployed-empty">
              <SquareTerminal size={56} />
              <p>No Portfolio summary. Create Bucket!</p>
            </div>
          )}
        </>
      )}

      {tab === 'templates' && (
        <>
          <div className="templates-head-row">
            <h1>Strategy Templates</h1>
            <button className="btn-ghost">Filters</button>
          </div>
          <div className="templates-grid">
            {templates.map((tpl) => (
              <StrategyTemplateCard key={tpl.id} template={tpl} onAdd={onAddTemplate} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BacktestPage({ myStrategies, selectedStrategyName, setSelectedStrategyName, runBacktest, backtestBusy, backtestResult, backtestError, timeRange, setTimeRange }) {
  const ranges = ['1 Month', '3 Months', '6 Months', '1 Year', '2 Years', 'Custom Range'];

  return (
    <section className="page">
      <div className="panel page-panel">
        <div className="panel-head vertical">
          <h1>Choose Strategies to Backtest</h1>
          <p>Pick one or more strategies, select a time range, and run a backtest to view performance.</p>
        </div>

        <div className="backtest-controls-row">
          <div className="select-wrap">
            <select value={selectedStrategyName} onChange={(e) => setSelectedStrategyName(e.target.value)}>
              <option value="">Select Strategies</option>
              {myStrategies.map((strategy) => (
                <option key={strategy.id} value={strategy.name}>{strategy.name}</option>
              ))}
            </select>
          </div>

          <div className="range-buttons">
            {ranges.map((range) => (
              <button
                key={range}
                className={timeRange === range ? 'active' : ''}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="backtest-credit-row">
          <span>Backtest Credit: 50/50</span>
          <button className="btn-primary" disabled={backtestBusy || !selectedStrategyName} onClick={runBacktest}>
            {backtestBusy ? 'Running...' : 'Run Backtest'}
          </button>
        </div>

        <div className="backtest-output">
          {backtestError && <div className="error-inline">{backtestError}</div>}
          {!backtestError && !backtestResult && <div className="empty-inline centered">Select strategies to start</div>}
          {backtestResult && (
            <div className="backtest-result-grid">
              <div><span>CAGR</span><strong>{backtestResult.cagr}%</strong></div>
              <div><span>Max Drawdown</span><strong>{backtestResult.max_drawdown}%</strong></div>
              <div><span>Sharpe Ratio</span><strong>{backtestResult.sharpe_ratio}</strong></div>
              <div><span>Net Adjusted Return</span><strong>{backtestResult.net_adjusted_return}%</strong></div>
              <div><span>Total Trades</span><strong>{backtestResult.total_trades}</strong></div>
              <div><span>Win Rate</span><strong>{(Number(backtestResult.win_rate || 0) * 100).toFixed(1)}%</strong></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SimulatorPage() {
  return (
    <section className="page">
      <div className="panel page-panel centered-panel">
        <SquareTerminal size={48} />
        <h2>Simulator</h2>
        <p>Paper trading simulator UI is reserved for the next phase.</p>
      </div>
    </section>
  );
}

function ReportsPage({ myStrategies, deployedStrategies }) {
  return (
    <section className="page">
      <div className="panel page-panel">
        <h1>Reports</h1>
        <div className="reports-grid">
          <article>
            <span>Total Strategies</span>
            <strong>{myStrategies.length}</strong>
          </article>
          <article>
            <span>Deployed</span>
            <strong>{deployedStrategies.length}</strong>
          </article>
          <article>
            <span>Templates</span>
            <strong>{TEMPLATE_STRATEGIES.length}</strong>
          </article>
        </div>
      </div>
    </section>
  );
}

function ShellApp() {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const authStatus = useAuthStatusPoll();
  const overview = useOverviewPoll();

  const [myStrategies, setMyStrategies] = React.useState(() => readJSON(STORAGE_MY_STRATEGIES, []));
  const [deployedStrategies, setDeployedStrategies] = React.useState(() => readJSON(STORAGE_DEPLOYED_STRATEGIES, []));
  const [brokerSettings, setBrokerSettings] = React.useState(() => readJSON(STORAGE_BROKER_SETTINGS, { terminalOn: true, engineOn: false }));

  const [selectedStrategyName, setSelectedStrategyName] = React.useState('');
  const [timeRange, setTimeRange] = React.useState('1 Month');
  const [backtestBusy, setBacktestBusy] = React.useState(false);
  const [backtestResult, setBacktestResult] = React.useState(null);
  const [backtestError, setBacktestError] = React.useState('');

  React.useEffect(() => {
    writeJSON(STORAGE_MY_STRATEGIES, myStrategies);
  }, [myStrategies]);

  React.useEffect(() => {
    writeJSON(STORAGE_DEPLOYED_STRATEGIES, deployedStrategies);
  }, [deployedStrategies]);

  React.useEffect(() => {
    writeJSON(STORAGE_BROKER_SETTINGS, brokerSettings);
  }, [brokerSettings]);

  const addTemplateAsStrategy = React.useCallback((template) => {
    const newStrategy = {
      id: nowId('strat'),
      name: template.name,
      startTime: '09:16',
      endTime: '15:15',
      strategyType: template.type || 'Time Based',
      segmentType: 'MIS',
      instrument: 'NIFTY 50',
      weekdays: [...DAY_OPTIONS],
      legs: [
        { id: nowId('leg'), side: 'BUY', optionType: 'Call', quantity: 1 },
        { id: nowId('leg'), side: 'SELL', optionType: 'Put', quantity: 1 },
      ],
      advanced: {},
      risk: {},
      deployed: false,
      createdAt: new Date().toISOString(),
      source: 'template',
    };
    setMyStrategies((prev) => [newStrategy, ...prev]);
  }, []);

  const createStrategy = React.useCallback((strategy) => {
    setMyStrategies((prev) => [strategy, ...prev]);
  }, []);

  const deployStrategy = React.useCallback((strategy) => {
    setDeployedStrategies((prev) => {
      if (prev.some((x) => x.id === strategy.id)) return prev;
      return [{ ...strategy, deployed: true, deployedAt: new Date().toISOString() }, ...prev];
    });
  }, []);

  const setTerminalOn = (value) => setBrokerSettings((prev) => ({ ...prev, terminalOn: value }));
  const setEngineOn = (value) => setBrokerSettings((prev) => ({ ...prev, engineOn: value }));

  const brokerState = {
    terminalOn: brokerSettings.terminalOn,
    engineOn: brokerSettings.engineOn,
    setTerminalOn,
    setEngineOn,
  };

  const mapTimeRange = (label) => {
    const lower = (label || '').toLowerCase();
    if (lower.includes('1 month')) return '1m';
    if (lower.includes('3 month')) return '3m';
    if (lower.includes('6 month')) return '6m';
    if (lower.includes('1 year')) return '1y';
    if (lower.includes('2 year')) return '2y';
    return 'ytd';
  };

  const runBacktest = async () => {
    if (!selectedStrategyName) return;
    setBacktestBusy(true);
    setBacktestError('');
    setBacktestResult(null);

    try {
      const res = await fetch(apiUrl('/api/v1/backtest/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_name: selectedStrategyName,
          time_range: mapTimeRange(timeRange),
          symbols: [256265],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Backtest failed.');
      setBacktestResult(data);
    } catch (error) {
      setBacktestError(error.message || 'Backtest failed.');
    } finally {
      setBacktestBusy(false);
    }
  };

  const onBacktestFromCard = (strategy) => {
    setSelectedStrategyName(strategy.name);
  };

  return (
    <BrowserRouter>
      <div className="rebuild-shell">
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

        <div className="rebuild-main">
          <TopBar onMenuClick={() => setMobileOpen(true)} />

          <main className="rebuild-content" onClick={() => mobileOpen && setMobileOpen(false)}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <DashboardPage
                    brokerState={brokerState}
                    authStatus={authStatus}
                    overview={overview}
                    templates={TEMPLATE_STRATEGIES}
                    onAddTemplate={addTemplateAsStrategy}
                    deployedCount={deployedStrategies.length}
                  />
                }
              />
              <Route path="/broker" element={<BrokerPage authStatus={authStatus} brokerState={brokerState} />} />
              <Route path="/strategy-builder" element={<StrategyBuilderPage onCreateStrategy={createStrategy} />} />
              <Route
                path="/strategies"
                element={
                  <StrategiesPage
                    myStrategies={myStrategies}
                    deployedStrategies={deployedStrategies}
                    templates={TEMPLATE_STRATEGIES}
                    onAddTemplate={addTemplateAsStrategy}
                    onDeploy={deployStrategy}
                    onBacktestFromCard={onBacktestFromCard}
                  />
                }
              />
              <Route
                path="/backtesting/strategy-backtest"
                element={
                  <BacktestPage
                    myStrategies={myStrategies}
                    selectedStrategyName={selectedStrategyName}
                    setSelectedStrategyName={setSelectedStrategyName}
                    runBacktest={runBacktest}
                    backtestBusy={backtestBusy}
                    backtestResult={backtestResult}
                    backtestError={backtestError}
                    timeRange={timeRange}
                    setTimeRange={setTimeRange}
                  />
                }
              />
              <Route path="/backtesting/simulator" element={<SimulatorPage />} />
              <Route path="/reports" element={<ReportsPage myStrategies={myStrategies} deployedStrategies={deployedStrategies} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

function App() {
  const [isAccessUnlocked, setIsAccessUnlocked] = React.useState(() => Boolean(getAppAccessToken()));

  React.useEffect(() => {
    const handleAccessRequired = () => {
      setIsAccessUnlocked(false);
    };
    const eventName = getAccessRequiredEventName();
    window.addEventListener(eventName, handleAccessRequired);
    return () => window.removeEventListener(eventName, handleAccessRequired);
  }, []);

  if (!isAccessUnlocked) {
    return <AppAccessGate onUnlock={() => setIsAccessUnlocked(true)} />;
  }

  return <ShellApp />;
}

export default App;
