import React, { useState, useEffect, useRef } from 'react';
import { Search, LogOut, FileText, Layout, ArrowRight, User, Edit3, Camera, Sun, Moon } from 'lucide-react';

export default function TopBar({ onLogout, searchQuery, setSearchQuery, savedSchemes = [], gradingHistory = [], setActiveView, setActiveHistoryBatch, setActivePreviewScript, currentUser, setCurrentUser, theme, toggleTheme }) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    // Edit Profile State
    const [editName, setEditName] = useState(currentUser?.name || '');
    const [editPosition, setEditPosition] = useState(currentUser?.position || '');
    const [editAvatar, setEditAvatar] = useState(currentUser?.avatar || null);

    const dropdownRef = useRef(null);
    const profileRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileModalOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSaveProfile = () => {
        const updatedUser = { ...currentUser, name: editName, position: editPosition, avatar: editAvatar };

        setCurrentUser(updatedUser);
        localStorage.setItem(`profile_${currentUser.id}`, JSON.stringify(updatedUser));

        setIsProfileModalOpen(false);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditAvatar(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Perform omni-search using a deep atomic stringifier to check literally every nested property
    const q = searchQuery.toLowerCase();
    const deepSearch = (obj, term) => {
        if (!obj || !term) return false;
        try { return JSON.stringify(obj).toLowerCase().includes(term); } 
        catch { return false; }
    };

    const matchedSchemes = savedSchemes.filter(s => deepSearch(s, q));
    
    const matchedHistory = gradingHistory.filter(h => {
        // Evaluate batch-level properties but exclude checking inside the deep `scripts` array (which are matched individually)
        const shallowBatchObj = { ...h, scripts: undefined }; 
        return deepSearch(shallowBatchObj, q);
    });

    const matchedScripts = [];
    if (q.trim().length > 0) {
        gradingHistory.forEach(h => {
            if (h.scripts) {
                h.scripts.forEach(s => {
                    if (deepSearch(s, q)) {
                        matchedScripts.push({ ...s, parentBatch: h });
                    }
                });
            }
        });
    }

    const showDropdown = isDropdownOpen && searchQuery.trim().length > 0;

    return (
        <div className="topbar">
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px', marginRight: '2rem' }} ref={dropdownRef}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    className="search-input w-full"
                    style={{ outline: 'none' }}
                    placeholder="Search marking schemes, test papers, or history..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery && setSearchQuery(e.target.value);
                        setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                />

                {/* Omnisearch Dropdown */}
                {showDropdown && (
                    <div className="spring-up card" style={{
                        position: 'absolute', top: '100%', left: 0, width: '600px', marginTop: '8px', zIndex: 1000,
                        maxHeight: '400px', overflowY: 'auto', padding: '12px', cursor: 'default'
                    }}>
                        {matchedSchemes.length === 0 && matchedHistory.length === 0 && matchedScripts.length === 0 ? (
                            <div className="p-4 text-center text-muted">No results found for "{searchQuery}"</div>
                        ) : (
                            <>
                                {matchedSchemes.length > 0 && (
                                    <div className="mb-4">
                                        <div className="text-xs text-muted font-bold uppercase tracking-wider mb-2 px-2">Marking Schemes</div>
                                        {matchedSchemes.map(s => (
                                            <div key={s.id} className="p-3 mb-1 rounded-lg flex items-center justify-between transition-colors"
                                                style={{ cursor: 'pointer' }}
                                                onMouseOver={e => e.currentTarget.style.background = 'rgba(16,185,129,0.05)'}
                                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                onClick={() => {
                                                    if (setActiveView) setActiveView('schemes');
                                                    if (setSearchQuery) setSearchQuery('');
                                                    setIsDropdownOpen(false);
                                                }}>
                                                <div className="flex items-center gap-3">
                                                    <FileText size={16} className="text-primary" />
                                                    <span className="font-semibold text-main">{s.name}</span>
                                                </div>
                                                <ArrowRight size={14} className="text-muted" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {matchedHistory.length > 0 && (
                                    <div>
                                        <div className="text-xs text-muted font-bold uppercase tracking-wider mb-2 px-2">Grading History</div>
                                        {matchedHistory.map(h => (
                                            <div key={h.id} className="p-3 mb-1 rounded-lg flex items-center justify-between transition-colors"
                                                style={{ cursor: 'pointer' }}
                                                onMouseOver={e => e.currentTarget.style.background = 'rgba(16,185,129,0.05)'}
                                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                onClick={() => {
                                                    if (setActiveView) setActiveView('history');
                                                    if (setActiveHistoryBatch) setActiveHistoryBatch(h);
                                                    if (setSearchQuery) setSearchQuery('');
                                                    setIsDropdownOpen(false);
                                                }}>
                                                <div className="flex items-center gap-3">
                                                    <Layout size={16} className="text-muted" />
                                                    <div>
                                                        <div className="font-semibold text-main">{h.batchName || h.name}</div>
                                                        <div className="text-xs text-muted">{h.paperCount} Scripts &middot; {new Date(h.dateCreated).toLocaleDateString()}</div>
                                                    </div>
                                                </div>
                                                <ArrowRight size={14} className="text-muted" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {matchedScripts.length > 0 && (
                                    <div>
                                        <div className="text-xs text-muted font-bold uppercase tracking-wider mt-2 mb-2 px-2">Student Scripts</div>
                                        {matchedScripts.map(s => (
                                            <div key={s.id + '_s'} className="p-3 mb-1 rounded-lg flex items-center justify-between transition-colors"
                                                style={{ cursor: 'pointer' }}
                                                onMouseOver={e => e.currentTarget.style.background = 'rgba(16,185,129,0.05)'}
                                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                onClick={() => {
                                                    if (setActiveView) setActiveView('history');
                                                    if (setActiveHistoryBatch) setActiveHistoryBatch(s.parentBatch);
                                                    if (setActivePreviewScript) setActivePreviewScript(s);
                                                    if (setSearchQuery) setSearchQuery('');
                                                    setIsDropdownOpen(false);
                                                }}>
                                                <div className="flex items-center gap-3 border-l-2 pl-2" style={{ borderColor: 'var(--success)' }}>
                                                    <FileText size={16} className="text-success" />
                                                    <div>
                                                        <div className="font-semibold text-main">{s.name} <span className="text-xs text-muted font-normal ml-1">in {s.parentBatch.batchName}</span></div>
                                                        <div className="text-xs text-success font-bold">Score: {s.gradeResult?.score ?? 'N/A'}</div>
                                                    </div>
                                                </div>
                                                <ArrowRight size={14} className="text-success" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }} ref={profileRef}>
                <div
                    className="theme-toggle"
                    onClick={toggleTheme}
                    title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
                    style={{
                        position: 'relative',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        transition: 'color 0.3s ease',
                        overflow: 'hidden'
                    }}
                    onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'}
                    onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    <div style={{
                        position: 'absolute',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: theme === 'dark' ? 'translateY(0) rotate(0) scale(1)' : 'translateY(30px) rotate(90deg) scale(0)',
                        opacity: theme === 'dark' ? 1 : 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%', height: '100%'
                    }}>
                        <Moon size={18} strokeWidth={2} />
                    </div>

                    <div style={{
                        position: 'absolute',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: theme === 'light' ? 'translateY(0) rotate(0) scale(1)' : 'translateY(-30px) rotate(-90deg) scale(0)',
                        opacity: theme === 'light' ? 1 : 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%', height: '100%'
                    }}>
                        <Sun size={18} strokeWidth={2.5} />
                    </div>
                </div>

                <div
                    onClick={() => setIsLogoutModalOpen(true)}
                    title="Sign Out"
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', 
                        padding: '6px 16px', borderRadius: '8px', transition: 'all 0.2s',
                        background: theme === 'dark' 
                            ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.25) 100%)' 
                            : 'var(--primary)',
                        color: theme === 'dark' ? 'var(--primary)' : '#ffffff',
                        border: theme === 'dark' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--primary)',
                        boxShadow: '0 0 10px rgba(16, 185, 129, 0.1)'
                    }}
                    onMouseOver={e => { 
                        if (theme === 'dark') {
                            e.currentTarget.style.background = 'linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.35) 100%)'; 
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.2)'; 
                            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)';
                        } else {
                            e.currentTarget.style.boxShadow = '0 6px 15px rgba(16, 185, 129, 0.3)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                    }}
                    onMouseOut={e => { 
                        if (theme === 'dark') {
                            e.currentTarget.style.background = 'linear-gradient(90deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.25) 100%)'; 
                            e.currentTarget.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.1)'; 
                            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                        } else {
                            e.currentTarget.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }
                    }}
                >
                    <LogOut size={16} strokeWidth={2.5} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Log Out</span>
                </div>

                <div style={{ height: '30px', width: '1px', background: 'var(--border-color)', margin: '0 8px' }}></div>

                <div style={{ position: 'relative' }}>
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', transition: 'background 0.2s' }}
                        onClick={() => {
                            setEditName(currentUser?.name || 'Academic Evaluator');
                            setEditPosition(currentUser?.position || 'Lecturer');
                            setEditAvatar(currentUser?.avatar || null);
                            setIsProfileModalOpen(!isProfileModalOpen);
                        }}
                        title="Edit Your Profile Settings"
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(16,185,129,0.05)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{currentUser?.name || 'Administrator'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{currentUser?.position || 'Lecturer'}</div>
                        </div>
                        <div style={{ position: 'relative', flexShrink: 0, width: '42px', height: '42px', minWidth: '42px', borderRadius: '50%', background: 'var(--bg-card)', padding: '2px', border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', position: 'relative' }}>
                                <img src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'A')}&background=10b981&color=fff&rounded=true`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '50%', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', padding: '4px' }}>
                            <Edit3 size={14} className="text-main" />
                        </div>
                    </div>

                    {/* Editor Modal */}
                    {isProfileModalOpen && (
                        <div className="spring-up card" style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: '12px',
                            zIndex: 1000, padding: '24px', width: '320px', cursor: 'default'
                        }} onClick={e => e.stopPropagation()}>
                            <h3 className="font-bold text-main mb-6 flex items-center gap-2 m-0 text-lg border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                                <User size={20} className="text-primary" /> Identity Settings
                            </h3>

                            <div className="mb-6 flex justify-center">
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'relative', width: '96px', height: '96px', borderRadius: '50%', background: 'var(--bg-main)', padding: '4px', border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.2), 0 0 0 4px rgba(16, 185, 129, 0.05)' }}>
                                        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
                                            <img src={editAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(editName || 'A')}&background=10b981&color=fff&rounded=true`} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '50%', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.4)', pointerEvents: 'none' }} />
                                        </div>
                                    </div>
                                    <label style={{ position: 'absolute', bottom: '0px', right: '0px', width: '34px', height: '34px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', border: '3px solid var(--bg-card)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', transition: 'transform 0.2s, background 0.2s', zIndex: 10 }} onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = 'var(--primary-hover)' }} onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'var(--primary)' }} title="Click to upload new profile photo">
                                        <Camera size={14} strokeWidth={2.5} />
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                                    </label>
                                </div>
                            </div>

                            <div className="mb-5">
                                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Display Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    placeholder="Prof. Anderson"
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full font-semibold"
                                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '12px 14px', borderRadius: '8px', outline: 'none', color: 'var(--text-main)' }}
                                />
                            </div>

                            <div className="mb-6">
                                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Professional Title</label>
                                <input
                                    type="text"
                                    value={editPosition}
                                    placeholder="Senior Lecturer"
                                    onChange={e => setEditPosition(e.target.value)}
                                    className="w-full font-semibold"
                                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '12px 14px', borderRadius: '8px', outline: 'none', color: 'var(--text-main)' }}
                                />
                            </div>

                            <button onClick={handleSaveProfile} className="btn btn-primary w-full py-3 mt-2 font-bold justify-center flex hover:brightness-110 transition-all">Submit & Apply Config</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Popup Modal */}
            {isLogoutModalOpen && (
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
                            <LogOut size={36} strokeWidth={1.5} />
                        </div>
                        <h3 style={{ fontSize: '1.35rem', fontWeight: '700', margin: '0 0 8px 0', color: 'var(--text-main)', letterSpacing: '-0.3px' }}>Sign Out</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '32px', lineHeight: 1.4, padding: '0 10px' }}>Are you sure you want to log out of MarkLens?</p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn w-full" onClick={() => setIsLogoutModalOpen(false)} style={{ background: 'rgba(150,150,150,0.1)', border: 'none', color: 'var(--text-main)', padding: '14px', fontWeight: '600', borderRadius: '12px', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(150,150,150,0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(150,150,150,0.1)'}>Cancel</button>
                            <button className="btn w-full flex items-center justify-center gap-2" onClick={() => { setIsLogoutModalOpen(false); onLogout(); }} style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '14px', fontWeight: '600', borderRadius: '12px', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>Sign Out</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
