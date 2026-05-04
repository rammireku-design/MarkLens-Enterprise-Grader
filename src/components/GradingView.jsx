import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Wand2, ShieldAlert, XCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BatchScriptUpload from './BatchScriptUpload';
import { extractTextWithGemini, gradeWithGemini } from '../utils/geminiService';
import { syncHistoryBatchToCloud } from '../utils/supabaseClient';
import { generateUUID } from '../utils/uuid';

const AdaptiveSelect = ({ value, onChange, options, placeholder }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const ref = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value);

    return (
        <div ref={ref} className="w-full mb-6" style={{ position: 'relative', zIndex: 9999 }}>
            <div 
                className="w-full flex justify-between items-center transition-colors cursor-pointer"
                style={{ 
                    background: 'var(--bg-main)', 
                    border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border-color)', 
                    borderRadius: '6px',
                    padding: '2px 8px',
                    color: 'var(--text-main)'
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={`font-medium truncate text-sm ${!selectedOption ? 'mock-placeholder' : ''}`} style={{ paddingLeft: '4px' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.5, marginLeft: '8px' }}>
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            </div>

            {isOpen && (
                <div 
                    className="w-full mt-1" 
                    style={{ 
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 9999,
                        backgroundColor: 'var(--bg-card, #ffffff)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '6px', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        maxHeight: '125px',
                        overflowX: 'hidden',
                        overflowY: 'auto',
                        overscrollBehavior: 'contain'
                    }}
                >
                    {options.length === 0 ? (
                        <div className="px-5 py-3 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No options available.</div>
                    ) : null}

                    {value && (
                        <div 
                            className="text-sm transition-colors cursor-pointer flex items-center justify-between"
                            style={{ 
                                padding: '4px 10px', 
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                                background: 'transparent',
                                borderBottom: '1px solid rgba(120, 120, 128, 0.1)'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(120, 120, 128, 0.04)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            onClick={() => { onChange(''); setIsOpen(false); }}
                        >
                            <span className="truncate">Default</span>
                        </div>
                    )}
                    
                    {options.map((opt, i) => (
                        <div 
                            key={i}
                            className="text-sm transition-colors cursor-pointer flex items-center justify-between"
                            style={{ 
                                padding: '2px 8px', 
                                color: 'var(--text-main)',
                                background: value === opt.value ? 'rgba(120, 120, 128, 0.08)' : 'transparent',
                                fontWeight: value === opt.value ? '600' : '400'
                            }}
                            onMouseEnter={(e) => {
                                if (value !== opt.value) e.currentTarget.style.background = 'rgba(120, 120, 128, 0.04)';
                            }}
                            onMouseLeave={(e) => {
                                if (value !== opt.value) e.currentTarget.style.background = 'transparent';
                            }}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                        >
                            <span className="truncate">{opt.label}</span>
                            {value === opt.value && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary)' }}>
                                    <path d="M20 6L9 17l-5-5"/>
                                </svg>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function GradingView({ savedSchemes, gradingHistory, setGradingHistory, isGeminiReady, setActivePreviewScript, searchQuery = '', retryPayload, setRetryPayload }) {
    const filteredSchemes = savedSchemes;

    const [selectedSchemeId, setSelectedSchemeId] = useState('');
    const [scripts, setScripts] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [batchName, setBatchName] = useState('');
    const [isStrictMode, setIsStrictMode] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [retryHistoryId, setRetryHistoryId] = useState(null);
    const abortSignalRef = useRef(false);

    // Auto-trigger when a retry payload is received from App.jsx
    React.useEffect(() => {
        if (retryPayload) {
            setBatchName(retryPayload.rawBatchName || retryPayload.batchName.split(' (')[0]);
            setSelectedSchemeId(retryPayload.schemeId);
            setScripts(retryPayload.scripts);
            setRetryHistoryId(retryPayload.id);
            if (setRetryPayload) setRetryPayload(null);
            
            // Allow state to settle before automatically starting
            setTimeout(() => {
                document.getElementById('start-grading-btn')?.click();
            }, 500);
        }
    }, [retryPayload, setRetryPayload]);

    const selectedScheme = savedSchemes.find(s => s.id === selectedSchemeId);

    const playSuccessChime = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
            gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) { console.error("Audio playback blocked", e); }
    };

    const startGrading = async () => {
        if (!isGeminiReady) { toast.error("AI Service is not ready."); return; }
        if (!selectedScheme) { toast.error("Please select a valid scheme!"); return; }
        if (scripts.length === 0) { toast.error("Please add student papers!"); return; }
        if (!batchName) { toast.error("Please name this batch (e.g. Section A)"); return; }

        try {
            if ("Notification" in window && Notification.permission === "default") {
                await Notification.requestPermission();
            }
        } catch (e) { }

        abortSignalRef.current = false;
        setIsProcessing(true);

        // Keep a local accurate array to inject right into History since state updates are async
        let finalizedScripts = [...scripts];

        // Turbo Engine: Parallel Chunking (Processes 15 papers simultaneously to safely cruise under the 360 RPM limit)
        const CHUNK_SIZE = 15;
        for (let i = 0; i < scripts.length; i += CHUNK_SIZE) {
            if (abortSignalRef.current) {
                setIsProcessing(false);
                return;
            }

            const chunk = scripts.slice(i, i + CHUNK_SIZE);

            await Promise.all(chunk.map(async (script, chunkIndex) => {
                const actualIndex = i + chunkIndex;
                if (abortSignalRef.current) return;
                if (finalizedScripts[actualIndex].status !== 'pending' && finalizedScripts[actualIndex].status !== 'error') return;

                setScripts(prev => prev.map((s, idx) => idx === actualIndex ? { ...s, status: 'extracting' } : s));
                try {
                    const payloadArray = finalizedScripts[actualIndex].dataUrls || [finalizedScripts[actualIndex].dataUrl];
                    const extractedText = await extractTextWithGemini(payloadArray);

                    if (abortSignalRef.current) return;

                    setScripts(prev => prev.map((s, idx) => idx === actualIndex ? { ...s, status: 'grading' } : s));
                    
                    const gradeResult = await gradeWithGemini(selectedScheme.text, extractedText, selectedScheme.constraints, isStrictMode);

                    const finalName = finalizedScripts[actualIndex].name;
                    const gradedItem = { 
                        ...finalizedScripts[actualIndex], 
                        name: finalName, 
                        extractedText: extractedText, 
                        gradeResult: gradeResult, 
                        status: 'done' 
                    };

                    setScripts(prev => prev.map((s, idx) => idx === actualIndex ? gradedItem : s));
                    finalizedScripts[actualIndex] = gradedItem;
                } catch (error) {
                    const errItem = { ...finalizedScripts[actualIndex], status: 'error', error: error.message };
                    setScripts(prev => prev.map((s, idx) => idx === actualIndex ? errItem : s));
                    finalizedScripts[actualIndex] = errItem;
                }
            }));
        }

        const successCount = finalizedScripts.filter(s => s.status === 'done').length;
        const errorCount = finalizedScripts.filter(s => s.status === 'error').length;

        if (successCount === 0 && errorCount > 0) {
            toast.error(`All ${scripts.length} papers failed to grade. Batch not saved to history.`);
            setIsProcessing(false);
            setIsStrictMode(false);
            return; // Do not save empty/failed history
        }

        let batchStatus = 'Completed';
        if (errorCount > 0) batchStatus = 'Partial Error';

        const historyIdToUse = retryHistoryId || generateUUID();

        const newHistory = {
            id: historyIdToUse,
            batchName: batchName + " (" + selectedScheme.name + ")",
            rawBatchName: batchName,
            schemeId: selectedScheme.id,
            paperCount: scripts.length,
            dateCreated: new Date().toISOString(),
            status: batchStatus,
            type: 'Test Papers',
            scripts: finalizedScripts
        };

        setGradingHistory(prev => {
            const exists = prev.some(h => h.id === historyIdToUse);
            if (exists) {
                return prev.map(h => h.id === historyIdToUse ? newHistory : h);
            }
            return [newHistory, ...prev];
        });
        
        setRetryHistoryId(null); // Clear the retry lock after finishing
        
        if (errorCount > 0) {
            playErrorChime();
            toast.error(`Graded ${successCount} papers. ${errorCount} papers failed.`);
        } else {
            playSuccessChime();
            toast.success(`Successfully graded all ${scripts.length} papers!`);
        }
        
        setIsProcessing(false);
        setIsStrictMode(false); // Revert back to Normal dynamically after batch completes

        // Fire-and-forget Cloud Sync (Hybrid Offline-First architecture)
        try {
            const { data: { session } } = await import('../utils/supabaseClient').then(m => m.supabase.auth.getSession());
            if (session?.user) {
                syncHistoryBatchToCloud(session.user.id, newHistory);
            }
        } catch (e) {
            console.error("Background cloud sync failed to initiate:", e);
        }

        try {
            if ("Notification" in window && Notification.permission === "granted") {
                const notif = new Notification("OCR Processing Complete", {
                    body: `Successfully graded ${scripts.length} papers for "${batchName}". Click to view results.`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/1903/1903162.png',
                    requireInteraction: true,
                    vibrate: [200, 100, 200]
                });
                notif.onclick = function (e) {
                    e.preventDefault(); // Stop Chrome from spawning a new blank application frame
                    window.focus();
                    this.close();
                };
            } else if ("Notification" in window && Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        } catch (e) {
            console.error("OS Notification failed to dispatch:", e);
        }
    };

    return (
        <div className="slide-up" style={{ paddingBottom: '120px' }}>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-main m-0" style={{ WebkitTextFillColor: 'unset', background: 'none' }}>Grade Test Papers</h1>
                <p className="text-muted mt-1">Select a master key and load student scripts to instantly grade them.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: '2rem' }}>
                <div className="flex flex-col gap-6" style={{ flex: 1, minWidth: '350px' }}>
                    <div className="card" style={{ position: 'relative', zIndex: 50, overflow: 'visible' }}>
                        <h3 className="font-semibold mb-4 text-lg">1. Configuration</h3>

                        <label className="block text-muted mb-2 font-semibold text-xs tracking-wide uppercase" style={{ opacity: 0.8 }}>Target Marking Scheme</label>
                        <AdaptiveSelect 
                            value={selectedSchemeId} 
                            onChange={setSelectedSchemeId} 
                            options={filteredSchemes.map(s => ({ value: s.id, label: s.name }))} 
                            placeholder="-- Select Target Marking Scheme --" 
                        />

                        <label className="block text-muted mb-2 font-semibold text-xs tracking-wide uppercase" style={{ opacity: 0.8 }}>Batch Name / Section</label>
                        <input
                            type="text"
                            className="w-full font-medium mb-6 transition-colors"
                            style={{ 
                                background: 'var(--bg-main)', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '6px',
                                outline: 'none', 
                                color: 'var(--text-main)',
                                fontSize: '13px',
                                padding: '2px 8px'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                            placeholder="e.g. Bio 101 - Thursday Section"
                            value={batchName}
                            onChange={e => setBatchName(e.target.value)}
                        />

                        <div className="flex items-center justify-between mb-4 mt-2" style={{ gap: '16px' }}>
                            <div style={{ flex: 1, minWidth: 0, overflow: 'visible' }}>
                                <div className="font-semibold text-main whitespace-nowrap" style={{ fontSize: '15px', letterSpacing: '-0.3px' }}>Evaluation Mode</div>
                                <div className="text-muted mt-0.5 whitespace-nowrap" style={{ fontSize: '13px', transition: 'opacity 0.2s' }}>
                                    {isStrictMode ? 'Keywords required' : 'General understanding'}
                                </div>
                            </div>
                            
                            <div style={{
                                display: 'flex',
                                background: 'rgba(120, 120, 128, 0.16)',
                                borderRadius: '8px',
                                padding: '2px',
                                position: 'relative',
                                width: '140px',
                                flexShrink: 0
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '2px',
                                    bottom: '2px',
                                    left: isStrictMode ? '70px' : '2px',
                                    width: '66px',
                                    background: 'var(--bg-card)',
                                    borderRadius: '6px',
                                    boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 3px 1px rgba(0,0,0,0.06), 0 0 0 1px rgba(16, 185, 129, 0.25)',
                                    transition: 'left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.2)'
                                }} />

                                <div 
                                    onClick={() => setIsStrictMode(false)}
                                    style={{
                                        flex: 1, padding: '4px 0', textAlign: 'center', fontSize: '13px',
                                        fontWeight: isStrictMode ? '500' : '600',
                                        color: isStrictMode ? 'var(--text-muted)' : 'var(--text-main)',
                                        position: 'relative', zIndex: 1, cursor: 'pointer', transition: 'color 0.2s', userSelect: 'none'
                                    }}
                                >Normal</div>
                                <div 
                                    onClick={() => setIsStrictMode(true)}
                                    style={{
                                        flex: 1, padding: '4px 0', textAlign: 'center', fontSize: '13px',
                                        fontWeight: isStrictMode ? '600' : '500',
                                        color: isStrictMode ? 'var(--text-main)' : 'var(--text-muted)',
                                        position: 'relative', zIndex: 1, cursor: 'pointer', transition: 'color 0.2s', userSelect: 'none'
                                    }}
                                >Strict</div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="font-semibold mb-4 text-lg">2. Upload Submissions</h3>
                        <BatchScriptUpload 
                            onUploadBatch={(newScripts) => {
                            const initialized = newScripts.map((s, i) => ({ ...s, id: Date.now() + i }));
                            setScripts(prev => {
                                const combined = [...prev, ...initialized];
                                return combined.sort((a,b) => (a.name || '').localeCompare((b.name || ''), undefined, {numeric: true}));
                            });
                        }} />
                    </div>

                    {isProcessing ? (
                        <div className="flex gap-4">
                            <button className="btn text-lg font-bold" disabled style={{ padding: '16px', flex: 1, cursor: 'not-allowed', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="loader !w-6 !h-6" style={{ borderWidth: '3px', borderRightColor: 'var(--primary)' }}></div>
                                    Grading in Progress...
                                </div>
                            </button>
                        </div>
                    ) : (
                        <button
                            id="start-grading-btn"
                            className="btn btn-primary w-full text-lg font-bold"
                            style={{ padding: '16px' }}
                            onClick={startGrading}
                            disabled={scripts.length === 0 || !selectedSchemeId || !batchName}
                        >
                            <div className="flex items-center justify-center gap-3">
                                <Wand2 size={24} /> Start Intelligent Grading
                            </div>
                        </button>
                    )}
                </div>

                <div className="card" style={{ flex: 2, minWidth: '400px', position: 'relative', padding: 0 }}>
                    <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', right: '1.5rem', bottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                        <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-lg m-0">Grading Queue</h3>
                        <div className="flex items-center gap-4">
                            {scripts.length > 0 && (
                                isProcessing ? (
                                    <button 
                                        className="btn btn-sm text-danger" 
                                        style={{ 
                                            padding: '4px 14px', 
                                            fontSize: '13px', 
                                            border: '1px solid rgba(239, 68, 68, 0.4)', 
                                            borderRadius: '24px',
                                            background: 'rgba(239, 68, 68, 0.1)', 
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 2px 10px rgba(239, 68, 68, 0.1)'
                                        }} 
                                        onClick={() => { abortSignalRef.current = true; }}
                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                        onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                    >
                                        Stop Grading
                                    </button>
                                ) : (
                                    <button 
                                        className="btn btn-sm text-danger" 
                                        style={{ 
                                            padding: '4px 14px', 
                                            fontSize: '13px', 
                                            border: '1px solid rgba(239, 68, 68, 0.4)', 
                                            borderRadius: '24px',
                                            background: 'rgba(239, 68, 68, 0.08)', 
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 2px 10px rgba(239, 68, 68, 0.1)'
                                        }} 
                                        onClick={() => setShowClearConfirm(true)}
                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                                        onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                                    >
                                        Clear Queue
                                    </button>
                                )
                            )}
                            <div className="badge badge-primary">{scripts.length} Papers</div>
                        </div>
                    </div>

                    {scripts.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-50 border-2 border-dashed rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
                            <UploadCloud size={64} className="mb-4 text-muted" />
                            <p className="text-muted">Upload student papers to get started.</p>
                        </div>
                    ) : (
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px', minHeight: 0 }}>
                            {scripts.slice().sort((a,b) => (a.name || '').localeCompare((b.name || ''), undefined, {numeric: true})).map((s, idx) => {
                                // Unified professional layout, removing arbitrary scale assumptions
                                let borderLogic = 'var(--text-muted)';
                                let cardBg = 'var(--bg-card)';
                                let shimmerClass = '';
                                
                                if (s.status === 'done') {
                                    borderLogic = 'var(--primary)';
                                } else if (s.status === 'error') {
                                    borderLogic = 'var(--danger)';
                                    cardBg = 'rgba(239, 68, 68, 0.05)';
                                } else if (s.status === 'extracting' || s.status === 'grading') {
                                    borderLogic = 'var(--primary)';
                                    cardBg = 'rgba(16, 185, 129, 0.02)';
                                    shimmerClass = 'shimmer-sheen';
                                }

                                return (
                                <div
                                    key={s.id}
                                    className={`mb-3 rounded-xl overflow-hidden shadow-sm flex flex-col transform transition-all group queue-card-hover slide-in-right ${shimmerClass}`}
                                    data-interactive={s.status !== 'error' ? 'true' : 'false'}
                                    onClick={() => s.status !== 'error' ? setActivePreviewScript(s) : null}
                                    style={{
                                        cursor: s.status !== 'error' ? 'pointer' : 'default',
                                        backgroundColor: cardBg,
                                        border: '1px solid var(--border-color)',
                                        borderLeft: `4px solid ${borderLogic}`,
                                        animationDelay: `${idx * 0.05}s`
                                    }}
                                >
                                    <div className="flex-1 px-6 py-3 flex justify-between items-center bg-black bg-opacity-10 border-b border-gray-800" style={{ borderColor: 'var(--border-color)', paddingLeft: '32px' }}>
                                        <div className="font-bold text-main flex items-center gap-2 truncate text-md">
                                            <FileText size={16} className="opacity-70 text-primary" />
                                            {s.name} 
                                            {s.dataUrls && s.dataUrls.length > 1 && (
                                                <span className="badge" style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                                                    {s.dataUrls.length} Pgs
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {s.status === 'done' && <div className="text-xs font-black tracking-widest uppercase bg-primary bg-opacity-20 text-primary px-3 py-1 rounded">Score: {s.gradeResult.score}</div>}
                                            {s.status === 'error' && <div className="text-xs font-bold text-danger uppercase tracking-wider bg-red-500 bg-opacity-10 px-3 py-1 rounded">Failed</div>}
                                            {(s.status === 'extracting' || s.status === 'grading') && <div className="loader" style={{ width: '16px', height: '16px', borderColor: 'rgba(255,255,255,0.2)', borderRightColor: 'var(--primary)' }}></div>}
                                        </div>
                                    </div>
                                    <div className="px-6 py-3 text-sm font-medium" style={{ color: 'var(--text-muted)', paddingLeft: '32px' }}>
                                        {s.status === 'pending' && <span className="opacity-70 italic">Idle in queue...</span>}
                                        {s.status === 'extracting' && <span><span className="text-primary font-bold animate-pulse mr-1">•</span> Vision processing handwriting block...</span>}
                                        {s.status === 'grading' && <span><span className="text-primary font-bold animate-pulse mr-1">•</span> Constructing semantic evaluation logic...</span>}
                                        {s.status === 'done' && (
                                            <span className="text-success font-bold flex items-center gap-1"><span className="text-success text-lg leading-none mb-1">✓</span> Graded Successfully</span>
                                        )}
                                        {s.status === 'error' && <span className="text-danger font-semibold">{s.error}</span>}
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {/* Custom Clear Queue Confirmation Modal */}
            {showClearConfirm && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
                }}>
                    <div className="glass-panel spring-up" style={{ 
                        width: '90%', maxWidth: '340px', padding: '32px 24px', 
                        background: 'var(--bg-card)', 
                        borderRadius: '24px', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', 
                        textAlign: 'center' 
                    }}>
                        <div style={{ display: 'inline-flex', color: 'var(--danger)', marginBottom: '16px', opacity: 0.9 }}>
                            <Trash2 size={36} strokeWidth={1.5} />
                        </div>
                        <h3 style={{ fontSize: '1.35rem', fontWeight: '700', margin: '0 0 8px 0', color: 'var(--text-main)', letterSpacing: '-0.3px' }}>Clear Queue</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '32px', lineHeight: 1.4, padding: '0 10px' }}>Are you sure you want to clear all student papers from the queue?</p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn w-full" onClick={() => setShowClearConfirm(false)} style={{ background: 'rgba(150,150,150,0.1)', border: 'none', color: 'var(--text-main)', padding: '14px', fontWeight: '600', borderRadius: '12px', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(150,150,150,0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(150,150,150,0.1)'}>Cancel</button>
                            <button className="btn w-full flex items-center justify-center gap-2" onClick={() => { setScripts([]); setShowClearConfirm(false); }} style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '14px', fontWeight: '600', borderRadius: '12px', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>Clear All</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
