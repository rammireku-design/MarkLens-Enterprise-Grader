import React from 'react';
import { FileText, CheckCircle, UploadCloud, PlusCircle, FileCheck, MoreVertical, Layout, Trash2, Zap, FilePlus, CheckSquare, ClipboardCheck, Layers } from 'lucide-react';

export default function DashboardView({ savedSchemes = [], gradingHistory = [], setGradingHistory, setActiveView, searchQuery = '', setActiveHistoryBatch, currentUser, setGlobalCreateMode }) {
    let displayName = "Professor";
    if (currentUser?.name && currentUser.name !== 'New Administrator' && currentUser.name !== 'Demo Professor') {
        displayName = currentUser.name;
    }

    const recentActivity = gradingHistory.slice(0, 5);

    return (
        <div className="slide-up">
            {/* The Analytics Cards have been moved to the System Health Sidebar dropdown for better layout */}

            {/* Quick Actions */}
            <div className="flex items-center gap-3 mb-4">
                <style>{`
                    .zap-wrapper { position: relative; perspective: 1000px; display: flex; align-items: center; }
                    
                    .zap-glow { 
                        animation: googleAuraFlux 6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                        transform-origin: center;
                        will-change: transform, filter;
                    }
                    [data-theme="light"] .zap-glow { 
                        animation: googleAuraFluxLight 6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    }

                    @keyframes googleAuraFlux {
                        0%, 100% { 
                            transform: translateY(0) scale(1); 
                            filter: drop-shadow(0 2px 5px rgba(16, 185, 129, 0.4)) brightness(1); 
                        }
                        33% { 
                            transform: translateY(-3px) scale(1.03); 
                            filter: drop-shadow(0 12px 20px rgba(16, 185, 129, 0.7)) brightness(1.2); 
                        }
                        66% { 
                            transform: translateY(2px) scale(0.98); 
                            filter: drop-shadow(0 8px 15px rgba(16, 185, 129, 0.8)) brightness(1.1); 
                        }
                    }

                    @keyframes googleAuraFluxLight {
                        0%, 100% { 
                            transform: translateY(0) scale(1); 
                            filter: drop-shadow(0 2px 4px rgba(16, 185, 129, 0.2)) brightness(1); 
                        }
                        33% { 
                            transform: translateY(-3px) scale(1.03); 
                            filter: drop-shadow(0 6px 12px rgba(16, 185, 129, 0.5)) brightness(1.1); 
                        }
                        66% { 
                            transform: translateY(2px) scale(0.98); 
                            filter: drop-shadow(0 6px 12px rgba(16, 185, 129, 0.6)) brightness(1.05); 
                        }
                    }
                `}</style>
                <div style={{ color: 'var(--primary)' }} className="zap-wrapper">
                    <canvas 
                        id="boltCanvas"
                        className="zap-glow"
                        style={{ height: '26px', width: 'auto', objectFit: 'contain' }}
                        ref={canvas => {
                            if (!canvas) return;
                            const img = new Image();
                            img.src = '/bolt.jpg';
                            img.onload = () => {
                                // Dynamically shrink canvas to match image aspect ratio
                                canvas.width = img.width;
                                canvas.height = img.height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0);
                                
                                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                const data = imgData.data;
                                
                                for (let i = 0; i < data.length; i += 4) {
                                    const r = data[i], g = data[i+1], b = data[i+2];
                                    // Extract pure green logic (ignores white, black, gray)
                                    const greenness = g - Math.max(r, b);
                                    
                                    if (greenness > 15 && g > 40) {
                                        let alpha = Math.min(255, (greenness - 15) * 4);
                                        data[i] = 16; data[i+1] = 185; data[i+2] = 129; data[i+3] = alpha;
                                    } else {
                                        data[i+3] = 0; // Destroy background pixels completely
                                    }
                                }
                                ctx.putImageData(imgData, 0, 0);
                            };
                        }}
                    />
                </div>
                <h3 className="font-bold text-2xl m-0 tracking-tight">Quick Actions</h3>
            </div>

            <div className="flex gap-6 mb-10">
                <div className="card card-primary-action flex-1 flex flex-col justify-center bump-hover" onClick={() => { setActiveView('schemes'); setGlobalCreateMode(true); }}>
                    <div className="icon-bump" style={{ marginBottom: '1rem', zIndex: 2 }}>
                        <PlusCircle size={32} color="var(--primary)" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2" style={{ zIndex: 2 }}>Create New Marking Scheme</h3>
                    <p className="text-muted" style={{ maxWidth: '85%', lineHeight: 1.5, zIndex: 2 }}>Add a marking scheme for grading.</p>
                    <FileText size={200} style={{ position: 'absolute', right: '-30px', bottom: '-40px', opacity: 0.05, color: 'var(--primary)', zIndex: 1 }} />
                </div>

                <div className="card card-interactive flex-1 flex flex-col justify-center bump-hover" onClick={() => setActiveView('grade')}>
                    <div className="icon-bump" style={{ marginBottom: '1rem', color: 'var(--primary)', zIndex: 2 }}>
                        <ClipboardCheck size={32} />
                    </div>
                    <h3 className="text-2xl font-bold mb-2" style={{ zIndex: 2 }}>Grade New Papers</h3>
                    <p className="text-muted" style={{ maxWidth: '85%', lineHeight: 1.5, zIndex: 2 }}>Upload student test papers to be graded.</p>
                    <CheckSquare size={200} style={{ position: 'absolute', right: '-30px', bottom: '-40px', opacity: 0.05, color: 'var(--primary)', zIndex: 1 }} />
                </div>
            </div>

            {/* Recent Activity */}
            <div className="flex justify-between items-center mb-4 mt-8">
                <h3 className="font-bold text-xl m-0">Recent Activity</h3>
                <a href="#" className="text-primary font-semibold text-sm" onClick={(e) => { e.preventDefault(); setActiveView('history'); }} style={{ textDecoration: 'none' }}>View all reports</a>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>DOCUMENT NAME</th>
                            <th>TYPE</th>
                            <th>DATE CREATED</th>
                            <th>STATUS</th>
                            <th>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentActivity.map((item, i) => (
                            <tr
                                key={i}
                                className="table-row-hover"
                                onClick={() => setActiveHistoryBatch ? setActiveHistoryBatch(item) : undefined}
                            >
                                <td className="font-semibold">
                                    <div className="flex items-center gap-3">
                                        {item.type === 'Test Papers' ? (
                                            <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" className="text-muted" style={{ opacity: 0.8 }}>
                                                <path d="M256 16L0 144v16l256 128 256-128v-16L256 16zm0 336L30.9 239.5l-30.8 15.4v16L256 400l256-129.1v-16l-30.8-15.4L256 352zm0 96L30.9 335.5l-30.8 15.4v16L256 496l256-129.1v-16l-30.8-15.4L256 448z"/>
                                            </svg>
                                        ) : (
                                            <FileText size={18} className="text-muted" style={{ opacity: 0.8 }} />
                                        )}
                                        <span style={{ marginLeft: '2px' }}>{item.name || item.batchName}</span>
                                    </div>
                                </td>
                                <td className="text-muted">{item.type || 'Test Papers'}</td>
                                <td className="text-muted">{item.date || new Date(item.dateCreated).toLocaleDateString()}</td>
                                <td>
                                    <span className={`badge ${item.status === 'Completed' || item.status === 'done' ? 'badge-success' : 'badge-warning'}`}>
                                        <span style={{ marginRight: '6px', fontSize: '12px' }}>●</span> {item.status === 'done' ? 'Completed' : item.status}
                                    </span>
                                </td>
                                <td>
                                    <div className="flex items-center gap-2">
                                        <button className="btn" style={{ background: 'transparent', padding: '4px' }} onClick={(e) => { e.stopPropagation(); setActiveHistoryBatch ? setActiveHistoryBatch(item) : undefined; }} title="View Report"><MoreVertical size={18} className="text-muted" /></button>
                                        <button className="btn-delete-icon" onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setGradingHistory(prev => prev.filter(h => h.id !== item.id)); 
                                        }} title="Delete Record"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Injected physical scroller extension block as requested */}
            <div style={{ height: '150px', width: '100%' }}></div>

        </div>
    );
}
