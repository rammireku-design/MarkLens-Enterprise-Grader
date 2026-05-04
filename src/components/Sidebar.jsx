import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, CheckSquare, History, Activity } from 'lucide-react';
import Settings from './Settings';

// Professional Apple-tier Odometer Counting Animation Engine
const Odometer = ({ target }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!target || target <= 0) {
            setCount(0);
            return;
        }
        
        let start = 0;
        const duration = 900; // ms to reach full count
        const frames = 40; 
        const stepTime = Math.max(16, Math.floor(duration / frames));
        const increment = Math.max(1, Math.ceil(target / frames));

        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(start);
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [target]);

    return <span>{count.toLocaleString()}</span>;
};

const LogoIcon = ({ size, style }) => (
    <div 
        className="marklens-logo-bg theme-switch-anim" 
        style={{ position: 'relative', width: size, height: size, flexShrink: 0, ...style }} 
        aria-label="MarkLens Logo"
    />
);

export default function Sidebar({ activeView, setActiveView, savedSchemes, gradingHistory, onKeySave, theme }) {
    const [showStats, setShowStats] = React.useState(false);

    return (
        <div className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="logo-container" style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'default' }}>
                <LogoIcon key={theme} size={34} className="logo-icon-anim" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 className="logo-text-anim" style={{ fontSize: '1.4rem', margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>
                        <span style={{ color: 'var(--text-main)' }}>Mark</span>
                        <span style={{ color: 'var(--primary)' }}>Lens</span>
                    </h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Grading Assistant</span>
                </div>
            </div>

            <style>{`
                .nav-dashboard:hover svg rect, .nav-dashboard.active svg rect { 
                    animation: tetrisDrop 0.4s ease-out both; 
                    transform-origin: center;
                }
                .nav-dashboard:hover svg rect:nth-child(1), .nav-dashboard.active svg rect:nth-child(1) { animation-delay: 0s; }
                .nav-dashboard:hover svg rect:nth-child(2), .nav-dashboard.active svg rect:nth-child(2) { animation-delay: 0.1s; }
                .nav-dashboard:hover svg rect:nth-child(3), .nav-dashboard.active svg rect:nth-child(3) { animation-delay: 0.2s; }
                .nav-dashboard:hover svg rect:nth-child(4), .nav-dashboard.active svg rect:nth-child(4) { animation-delay: 0.3s; }
                
                @keyframes tetrisDrop {
                    0% { transform: translateY(-8px); opacity: 0; }
                    50% { transform: translateY(2px); opacity: 1; }
                    100% { transform: translateY(0); opacity: 1; }
                }

                .nav-schemes:hover svg .st-line, .nav-schemes.active svg .st-line {
                    stroke-dasharray: 24;
                    stroke-dashoffset: 24;
                    animation: drawSvgPath 0.8s ease-out forwards;
                }
                .nav-schemes:hover svg .st-l1, .nav-schemes.active svg .st-l1 { animation-delay: 0s; }
                .nav-schemes:hover svg .st-l2, .nav-schemes.active svg .st-l2 { animation-delay: 0.3s; }
                .nav-schemes:hover svg .st-l3, .nav-schemes.active svg .st-l3 { animation-delay: 0.6s; }
                
                .nav-grade:hover svg .st-tick, .nav-grade.active svg .st-tick {
                    stroke-dasharray: 35;
                    stroke-dashoffset: 35;
                    animation: drawSvgPath 0.8s ease-out forwards;
                }

                .nav-history:hover svg, .nav-history.active svg { transform-origin: center; animation: popScale 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                .nav-history:hover svg .clock-rim, .nav-history.active svg .clock-rim {
                    stroke-dasharray: 63;
                    stroke-dashoffset: 63;
                    animation: drawSvgPath 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }
                .nav-history:hover svg .clock-hands, .nav-history.active svg .clock-hands {
                    transform-origin: 12px 12px;
                    animation: appleClockSpin 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                @keyframes popScale {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes appleClockSpin {
                    0% { transform: rotate(-720deg) scale(0.5); opacity: 0; stroke: var(--primary); }
                    100% { transform: rotate(0deg) scale(1); opacity: 1; stroke: currentColor; }
                }

                .nav-stats:hover svg, .nav-stats.active svg { animation: heartBeatPulse 0.8s ease-in-out; }
                .nav-stats:hover svg polyline, .nav-stats.active svg polyline {
                    stroke-dasharray: 100;
                    stroke-dashoffset: 100;
                    animation: drawSvgPath 0.7s ease-out forwards;
                }

                @keyframes drawSvgPath {
                    to { stroke-dashoffset: 0; }
                }
                @keyframes heartBeatPulse {
                    0%, 100% { transform: scale(1); }
                    30% { transform: scale(1.2); }
                    50% { transform: scale(1); }
                    70% { transform: scale(1.15); }
                }
            `}</style>

            <div style={{ padding: '24px 0 16px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
                <div className={`nav-item nav-dashboard ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
                    <LayoutDashboard size={20} /> Dashboard
                </div>
                <div className={`nav-item nav-schemes ${activeView === 'schemes' ? 'active' : ''}`} onClick={() => setActiveView('schemes')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line className="st-line st-l3" x1="10" y1="9" x2="8" y2="9"/>
                        <line className="st-line st-l1" x1="16" y1="13" x2="8" y2="13"/>
                        <line className="st-line st-l2" x1="16" y1="17" x2="8" y2="17"/>
                    </svg> Marking Schemes
                </div>
                <div className={`nav-item nav-grade ${activeView === 'grade' ? 'active' : ''}`} onClick={() => setActiveView('grade')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        <polyline className="st-tick" points="9 11 12 14 22 4"/>
                    </svg> Grade Papers
                </div>
                <div className={`nav-item nav-history ${activeView === 'history' ? 'active' : ''}`} onClick={() => setActiveView('history')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" className="clock-rim" />
                        <polyline points="12 6 12 12 16 14" className="clock-hands" />
                    </svg> Analytics & History
                </div>
                
                <div className={`nav-item nav-stats ${showStats ? 'active' : ''}`} onClick={() => setShowStats(!showStats)} style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Activity size={20} /> System Metrics</div>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{showStats ? '−' : '+'}</span>
                </div>

                {showStats && (
                   <div className="spring-up" style={{ margin: '8px 16px', padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Saved Schemes</span>
                           <span style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '15px' }}><Odometer target={savedSchemes?.length || 0} /></span>
                       </div>
                       
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Graded Papers</span>
                           <span style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '15px' }}><Odometer target={(gradingHistory || []).reduce((a,c) => a + c.paperCount, 0)} /></span>
                       </div>

                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Total Sessions</span>
                           <span style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '15px' }}><Odometer target={gradingHistory?.length || 0} /></span>
                       </div>
                   </div>
                )}
            </div>

            <div className="sidebar-dock">
                <Settings onKeySave={onKeySave} theme={theme} />
            </div>
        </div>
    );
}
