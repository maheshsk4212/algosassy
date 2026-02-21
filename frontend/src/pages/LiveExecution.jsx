import React, { useState, useEffect, useRef } from 'react';
import { Activity, ZapOff, Zap } from 'lucide-react';
import { StatusBadge } from '../components/shared/StatusBadge';
import './LiveExecution.css';

export const LiveExecution = () => {
    const [orders, setOrders] = useState([]);
    const [cpuWarning, setCpuWarning] = useState(false);
    const eventBufferRef = useRef([]);

    useEffect(() => {
        const initial = Array.from({ length: 15 }).map((_, i) => ({
            id: `ord_${1000 - i}`,
            symbol: ['BTC/USD', 'ETH/USD', 'SOL/USD'][i % 3],
            side: i % 2 === 0 ? 'BUY' : 'SELL',
            size: (Math.random() * 2).toFixed(4),
            price: (Math.random() * 50000 + 1000).toFixed(2),
            status: 'FILLED',
            time: new Date(Date.now() - i * 14000).toISOString()
        }));
        setOrders(initial);

        let frameId;
        let lastRenderTime = performance.now();
        let eventsSinceLastSecond = 0;
        let lastSecondTick = performance.now();

        const mockWS = setInterval(() => {
            const now = performance.now();
            eventsSinceLastSecond++;
            if (now - lastSecondTick >= 1000) {
                setCpuWarning(eventsSinceLastSecond > 20);
                eventsSinceLastSecond = 0;
                lastSecondTick = now;
            }
            eventBufferRef.current.push({
                id: `mkt_${Math.floor(Math.random() * 100000)}`,
                symbol: ['BTC/USD', 'ETH/USD', 'SOL/USD'][Math.floor(Math.random() * 3)],
                side: Math.random() > 0.5 ? 'BUY' : 'SELL',
                size: (Math.random() * 0.5).toFixed(4),
                price: (55000 + Math.random() * 100).toFixed(2),
                status: Math.random() > 0.8 ? 'CANCELED' : 'FILLED',
                time: new Date().toISOString()
            });
        }, 45);

        const renderLoop = (time) => {
            if (time - lastRenderTime >= 250) {
                if (eventBufferRef.current.length > 0) {
                    setOrders(prev => [...eventBufferRef.current, ...prev].slice(0, 50));
                    eventBufferRef.current = [];
                    lastRenderTime = time;
                }
            }
            frameId = requestAnimationFrame(renderLoop);
        };
        frameId = requestAnimationFrame(renderLoop);

        return () => { clearInterval(mockWS); cancelAnimationFrame(frameId); };
    }, []);

    return (
        <div className="execution-page">
            <div className="execution-header">
                <div className="header-left">
                    <h2><Activity size={20} /> Live Execution</h2>
                    <p>Direct exchange API gateway states</p>
                </div>
                <div className="header-right">
                    {cpuWarning && (
                        <div className="cpu-warning"><ZapOff size={12} /> HF Animations Disabled</div>
                    )}
                    <div className="section-badge"><Zap size={11} /> 250ms Buffer Active</div>
                </div>
            </div>

            <div className="glass-panel order-table">
                <div className="order-header">
                    <span>Time</span>
                    <span>Symbol</span>
                    <span>Side</span>
                    <span>Size</span>
                    <span>Price</span>
                    <span>State</span>
                </div>
                <div className="order-body">
                    {orders.map((order, idx) => (
                        <div key={order.id + idx} className={`order-row ${!cpuWarning && idx === 0 ? 'new-row' : ''}`}>
                            <span className="col-time">
                                {new Date(order.time).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 })}
                            </span>
                            <span className="col-symbol">{order.symbol}</span>
                            <span className={order.side === 'BUY' ? 'col-side-buy' : 'col-side-sell'}>{order.side}</span>
                            <span className="col-right">{order.size}</span>
                            <span className="col-right">${order.price}</span>
                            <span className="col-status">
                                <StatusBadge status={order.status} type={order.status === 'FILLED' ? 'profit' : 'loss'} />
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
