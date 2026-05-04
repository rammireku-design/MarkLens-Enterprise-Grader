import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { History, Layout, ArrowRight, Trash2, Settings, ChevronDown, Check } from 'lucide-react';
import { deleteHistoryBatchFromCloud } from '../utils/supabaseClient';

export default function HistoryView({ gradingHistory = [], setGradingHistory, setActiveHistoryBatch, searchQuery = '', currentUser, isLoading = false }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const [autoDeletePref, setAutoDeletePref] = useState(() => {
        if (!currentUser) return 'never';
        return localStorage.getItem(`autoDeletePref_${currentUser.id}`) || 'never';
    });
    const [isPolicyMenuOpen, setIsPolicyMenuOpen] = useState(false);
    const [menuRect, setMenuRect] = useState(null);
    const dropdownRef = useRef(null);
    const menuRef = useRef(null);

    // Global click-outside detection for the portal menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isPolicyMenuOpen && 
                dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                menuRef.current && !menuRef.current.contains(event.target)) {
                setIsPolicyMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        // Also close on window resize to prevent floating menu detachment
        window.addEventListener('resize', () => setIsPolicyMenuOpen(false));
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('resize', () => setIsPolicyMenuOpen(false));
        };
    }, [isPolicyMenuOpen]);

    const toggleMenu = () => {
        if (isPolicyMenuOpen) {
            setIsPolicyMenuOpen(false);
        } else {
            if (dropdownRef.current) {
                setMenuRect(dropdownRef.current.getBoundingClientRect());
                setIsPolicyMenuOpen(true);
            }
        }
    };

    const handlePrefChangeCustom = (val) => {
        setAutoDeletePref(val);
        if (currentUser) {
            localStorage.setItem(`autoDeletePref_${currentUser.id}`, val);
        }
        setIsPolicyMenuOpen(false);
        if (val !== 'never') {
            const limitMs = val === '1week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            setGradingHistory(prev => prev.filter(h => (now - new Date(h.dateCreated || h.date).getTime()) <= limitMs));
        }
    };

    const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);

    const filteredHistory = gradingHistory.filter(item => 
        (item.name || item.batchName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const toggleSelect = (id) => {
        setSelectedHistoryIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const deleteSelected = async () => {
        const itemsToDelete = gradingHistory.filter(h => selectedHistoryIds.includes(h.id));
        setGradingHistory(prev => prev.filter(h => !selectedHistoryIds.includes(h.id)));
        setSelectedHistoryIds([]);
        
        // Permanently delete from Supabase cloud
        for (const item of itemsToDelete) {
            try {
                await deleteHistoryBatchFromCloud(item.id, item.batchName);
            } catch (err) {
                console.error("Failed to delete from cloud:", err);
            }
        }
    };

    return (
        <div className="slide-up">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-main m-0" style={{ WebkitTextFillColor: 'unset', background: 'none' }}>Grading History</h1>
                    <p className="text-muted mt-1">Review past grading batches, performance insights, and extracted scripts.</p>
                </div>
                
                {/* Standard macOS/iOS pattern: Label outside, purely functional dropdown button inside */}
                <div className="flex items-center gap-3 slide-up">
                    <div className="text-xs font-bold uppercase tracking-wider flex items-center" style={{ color: 'var(--text-muted)', gap: '8px' }}>
                        <History size={15} style={{ opacity: 0.8 }} /> Keep History
                    </div>
                    
                    <div 
                        ref={dropdownRef} 
                        className="select-none flex items-center justify-between" 
                        onClick={toggleMenu}
                        style={{ 
                            background: 'var(--bg-card)', 
                            border: '1px solid var(--border-color)', 
                            padding: '6px 12px', 
                            borderRadius: '8px', 
                            minWidth: '110px', 
                            transition: 'all 0.15s ease', 
                            cursor: 'pointer', 
                            boxShadow: isPolicyMenuOpen ? '0 0 0 2px var(--primary)' : '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                        onMouseOver={(e) => { if(!isPolicyMenuOpen) e.currentTarget.style.borderColor = 'var(--text-muted)' }}
                        onMouseOut={(e) => { if(!isPolicyMenuOpen) e.currentTarget.style.borderColor = 'var(--border-color)' }}
                    >
                        <div className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                            {autoDeletePref === 'never' ? 'Forever' : autoDeletePref === '1week' ? '7 Days' : '30 Days'}
                        </div>
                        <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: '8px', transform: isPolicyMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                    </div>
                </div>

                {/* React Portal: Adaptive Theme UI */}
                {isPolicyMenuOpen && menuRect && createPortal(
                    <div 
                        ref={menuRef}
                        className="slide-down"
                        style={{ 
                            position: 'fixed', 
                            top: menuRect.bottom + 8, 
                            left: menuRect.right - 220, 
                            width: '220px',
                            zIndex: 999999, 
                            background: 'var(--bg-card)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '12px', 
                            padding: '6px', 
                            boxShadow: '0 15px 35px rgba(0,0,0,0.15)', 
                        }}
                    >
                        {[
                            { value: 'never', label: 'Forever' },
                            { value: '1week', label: '7 Days' },
                            { value: '1month', label: '30 Days' }
                        ].map((opt) => (
                            <div 
                                key={opt.value} 
                                onClick={() => handlePrefChangeCustom(opt.value)} 
                                className="flex items-center justify-between transition-colors" 
                                style={{ 
                                    padding: '10px 12px', 
                                    borderRadius: '8px', 
                                    fontSize: '0.85rem', 
                                    fontWeight: 600, 
                                    color: autoDeletePref === opt.value ? 'var(--text-main)' : 'var(--text-muted)', 
                                    background: autoDeletePref === opt.value ? 'rgba(16, 185, 129, 0.1)' : 'transparent', 
                                    cursor: 'pointer' 
                                }} 
                                onMouseOver={e => { if(autoDeletePref !== opt.value) { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'rgba(128,128,128,0.1)'; } }} 
                                onMouseOut={e => { if(autoDeletePref !== opt.value) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; } }}
                            >
                                {opt.label}
                                {autoDeletePref === opt.value && <Check size={16} strokeWidth={2.5} style={{ color: 'var(--primary)' }} />}
                            </div>
                        ))}
                    </div>,
                    document.body
                )}
            </div>

            {selectedHistoryIds.length > 0 && (
                <div className="flex items-center gap-4 mb-6 slide-up w-full" style={{ paddingLeft: '1.5rem', paddingRight: '0.5rem' }}>
                    <div className="flex items-center">
                        <span className="text-danger font-bold text-sm">
                            {selectedHistoryIds.length} record{selectedHistoryIds.length === 1 ? '' : 's'} selected for deletion
                        </span>
                    </div>
                    <button className="btn btn-sm ml-auto transition-colors" style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '6px 16px', fontWeight: 'bold' }} onClick={deleteSelected}>
                        <Trash2 size={14} className="mr-2" /> Permanently Delete
                    </button>
                    <button className="btn btn-sm btn-outline hover:bg-gray-800 transition-colors" style={{ padding: '6px 16px', color: 'var(--text-main)', borderColor: 'var(--border-color)' }} onClick={() => setSelectedHistoryIds([])}>
                        Cancel
                    </button>
                </div>
            )}

            {isLoading ? (
                <div className="card custom-scrollbar" style={{ padding: 0, overflowY: 'auto', maxHeight: '600px' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', paddingLeft: '20px' }}></th>
                                <th>DOCUMENT NAME</th>
                                <th>GRADED PAPERS</th>
                                <th>DATE CREATED</th>
                                <th>STATUS</th>
                                <th>INSPECT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...Array(5)].map((_, i) => (
                                <tr key={i}>
                                    <td style={{ paddingLeft: '20px' }}>
                                        <div className="shimmer-sheen" style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(120,120,128,0.1)' }}></div>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="shimmer-sheen" style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(120,120,128,0.1)' }}></div>
                                            <div className="shimmer-sheen" style={{ width: '150px', height: '16px', borderRadius: '4px', background: 'rgba(120,120,128,0.1)' }}></div>
                                        </div>
                                    </td>
                                    <td><div className="shimmer-sheen" style={{ width: '60px', height: '16px', borderRadius: '4px', background: 'rgba(120,120,128,0.1)' }}></div></td>
                                    <td><div className="shimmer-sheen" style={{ width: '80px', height: '16px', borderRadius: '4px', background: 'rgba(120,120,128,0.1)' }}></div></td>
                                    <td><div className="shimmer-sheen" style={{ width: '70px', height: '24px', borderRadius: '12px', background: 'rgba(120,120,128,0.1)' }}></div></td>
                                    <td><div className="shimmer-sheen" style={{ width: '90px', height: '32px', borderRadius: '6px', background: 'rgba(120,120,128,0.1)' }}></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : filteredHistory.length === 0 ? (
                <div className="text-center p-10 card flex flex-col items-center justify-center" style={{ minHeight: '300px', borderStyle: 'dashed', borderColor: 'var(--border-color)' }}>
                    <History size={48} className="text-muted mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold mb-2">No history records found</h3>
                    <p className="text-muted mb-6">Your graded batches and historical reports will appear here securely.</p>
                </div>
            ) : (
                <div className="card custom-scrollbar" style={{ padding: 0, overflowY: 'auto', maxHeight: '600px' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', paddingLeft: '20px' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedHistoryIds.length > 0 && selectedHistoryIds.length === filteredHistory.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedHistoryIds(filteredHistory.map(h => h.id));
                                            } else {
                                                setSelectedHistoryIds([]);
                                            }
                                        }}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                    />
                                </th>
                                <th>DOCUMENT NAME</th>
                                <th>GRADED PAPERS</th>
                                <th>DATE CREATED</th>
                                <th>STATUS</th>
                                <th>INSPECT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedHistory.map((item, i) => (
                                <tr
                                    key={i}
                                    className="table-row-hover"
                                    style={{
                                        backgroundColor: selectedHistoryIds.includes(item.id) ? 'rgba(239,68,68,0.05)' : undefined
                                    }}
                                    onClick={() => setActiveHistoryBatch(item)}
                                >
                                    <td style={{ paddingLeft: '20px' }} onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedHistoryIds.includes(item.id)}
                                            onChange={() => toggleSelect(item.id)}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                        />
                                    </td>
                                    <td className="font-semibold" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>
                                            <Layout size={18} className="text-muted" />
                                        </div>
                                        {item.name || item.batchName}
                                    </td>
                                    <td className="text-muted">{item.paperCount} Scripts</td>
                                    <td className="text-muted">{item.date || new Date(item.dateCreated).toLocaleDateString()}</td>
                                    <td>
                                        <span className={`badge ${item.status === 'Completed' || item.status === 'done' ? 'badge-success' : 'badge-warning'}`}>
                                            <span style={{ marginRight: '6px', fontSize: '12px' }}>●</span> {item.status === 'done' ? 'Completed' : item.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); setActiveHistoryBatch(item); }}>
                                                View Report <ArrowRight size={14} className="ml-1" />
                                            </button>
                                            <button className="btn btn-outline" style={{ padding: '6px 8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }} onClick={async (e) => { 
                                                e.stopPropagation(); 
                                                setGradingHistory(prev => prev.filter(h => h.id !== item.id)); 
                                                try {
                                                    await deleteHistoryBatchFromCloud(item.id, item.batchName);
                                                } catch (err) {
                                                    console.error("Failed to delete from cloud", err);
                                                }
                                            }} title="Delete Record">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center border-t p-4" style={{ borderColor: 'var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                            <div className="text-sm text-muted font-medium">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredHistory.length)} of {filteredHistory.length} results
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    className="btn btn-outline btn-sm" 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                >
                                    Previous
                                </button>
                                <div className="flex items-center gap-1 mx-2">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button 
                                            key={i}
                                            className={`btn btn-sm ${currentPage === i + 1 ? 'btn-primary' : 'btn-outline'}`}
                                            style={{ minWidth: '32px', padding: '4px 8px' }}
                                            onClick={() => setCurrentPage(i + 1)}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                                <button 
                                    className="btn btn-outline btn-sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
