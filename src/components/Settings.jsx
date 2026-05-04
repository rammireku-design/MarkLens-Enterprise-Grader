import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Save, HardDrive, RefreshCcw } from 'lucide-react';
import { clearCache } from '../utils/db';

export default function Settings({ theme }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [storageInfo, setStorageInfo] = useState('Calculating...');

    const [successState, setSuccessState] = useState(false);

    const updateStorage = () => {
        if (navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate().then(estimate => {
                const rawMB = estimate.usage ? (estimate.usage / (1024 * 1024)) : 0;
                // Subtract 1.3MB of invisible browser overhead (service workers, localforage baseline)
                const adjustedMB = Math.max(0, rawMB - 1.30).toFixed(2);
                
                const quotaGB = estimate.quota ? (estimate.quota / (1024 * 1024 * 1024)).toFixed(1) : '400.0';
                setStorageInfo(`${adjustedMB} MB / ${quotaGB} GB`);
            }).catch(() => {
                setStorageInfo('0.00 MB / 400.0 GB');
            });
        } else {
            setStorageInfo('0.00 MB / 400.0 GB');
        }
    };

    useEffect(() => {
        if (isOpen) {
            updateStorage();
            setSuccessState(false);
        }
    }, [isOpen]);

    const handleClearCache = async () => {
        setIsClearing(true);
        try {
            await clearCache();
            setTimeout(() => {
                updateStorage();
                setIsClearing(false);
                setSuccessState(true);
                setTimeout(() => setSuccessState(false), 3000); // Revert button after 3s
            }, 800);
        } catch (e) {
            console.error("Format failure", e);
            setIsClearing(false);
        }
    };

    return (
        <>
            <div
                className="nav-item opacity-80 hover:opacity-100"
                onClick={() => setIsOpen(true)}
                title="Data & Storage Management"
            >
                <HardDrive size={20} className="gear-icon" /> Data & Storage
            </div>

            {isOpen && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div className="glass-panel slide-up" style={{ width: '90%', maxWidth: '440px', position: 'relative', border: 'none', background: 'transparent', padding: '0' }}>
                        
                        {/* Decorative Corners */}
                        <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '20px', height: '20px', borderTop: `3px solid ${theme === 'dark' ? 'var(--primary)' : '#ffffff'}`, borderLeft: `3px solid ${theme === 'dark' ? 'var(--primary)' : '#ffffff'}`, borderTopLeftRadius: '12px', zIndex: 10 }}></div>
                        <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', borderTop: `3px solid ${theme === 'dark' ? 'var(--primary)' : '#ffffff'}`, borderRight: `3px solid ${theme === 'dark' ? 'var(--primary)' : '#ffffff'}`, borderTopRightRadius: '12px', zIndex: 10 }}></div>
                        <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '20px', height: '20px', borderBottom: `3px solid ${theme === 'dark' ? 'var(--primary)' : '#ffffff'}`, borderLeft: `3px solid ${theme === 'dark' ? 'var(--primary)' : '#ffffff'}`, borderBottomLeftRadius: '12px', zIndex: 10 }}></div>
                        <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px', borderBottom: `3px solid ${theme === 'dark' ? 'var(--primary)' : '#ffffff'}`, borderRight: `3px solid ${theme === 'dark' ? 'var(--primary)' : '#ffffff'}`, borderBottomRightRadius: '12px', zIndex: 10 }}></div>

                        <div style={{ 
                            background: '#121212', 
                            borderRadius: '12px', 
                            padding: '28px 24px', 
                            border: '1px solid rgba(255, 255, 255, 0.05)', 
                            height: '100%', 
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' 
                        }}>
                            <button
                                className="btn"
                                onClick={() => setIsOpen(false)}
                                style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px', background: 'transparent', border: 'none', color: '#ffffff', opacity: 0.7, zIndex: 20 }}
                                onMouseOver={e => e.currentTarget.style.opacity = 1}
                                onMouseOut={e => e.currentTarget.style.opacity = 0.7}
                            >
                                <X size={20} />
                            </button>
                            
                            <div className="flex items-center gap-2 mb-6">
                                <SettingsIcon size={22} style={{ color: '#ffffff' }} />
                                <h2 style={{ color: '#ffffff', margin: 0, fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '0.3px' }}>Data & Memory Management</h2>
                            </div>



                            <div className="mb-6 p-4 rounded-lg" style={{ background: 'transparent', border: 'none', padding: '0' }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <HardDrive size={16} style={{ color: '#ffffff' }} />
                                    <label style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 600 }}>
                                        Saved Tests & App Data
                                    </label>
                                </div>
                                <div className="flex items-center gap-2 mb-4" style={{ fontSize: '0.85rem' }}>
                                    <span style={{ color: '#ffffff', fontWeight: 'bold', opacity: 0.9 }}>Total Size:</span>
                                    <span style={{ color: theme === 'dark' ? 'var(--primary)' : '#ffffff', fontWeight: 'bold' }}>{storageInfo}</span>
                                </div>
                                
                                <button 
                                    className="btn w-full flex justify-center items-center gap-2 transition-all" 
                                    onClick={handleClearCache}
                                    disabled={isClearing || successState}
                                    style={{ 
                                        background: successState ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                                        color: successState ? '#34d399' : '#fca5a5', 
                                        border: `1px solid ${successState ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                        fontSize: '0.85rem',
                                        padding: '10px 8px',
                                        fontWeight: 'bold',
                                        borderRadius: '8px',
                                        cursor: isClearing || successState ? 'default' : 'pointer'
                                    }}
                                    onMouseOver={e => { if(!successState && !isClearing) { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; } }}
                                    onMouseOut={e => { if(!successState && !isClearing) { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; } }}
                                >
                                    <RefreshCcw size={14} className={isClearing ? 'animate-spin' : ''} /> 
                                    {isClearing ? 'Refreshing...' : successState ? 'Memory Refreshed Successfully!' : 'Refresh AI Memory'}
                                </button>
                                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '10px', lineHeight: 1.4 }}>
                                    Clears temporary processing data to resolve grading errors.<br/>Your saved records remain unaffected.
                                </div>
                            </div>


                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
