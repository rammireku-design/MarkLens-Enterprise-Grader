import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import DashboardView from './components/DashboardView';
import MarkingSchemeView from './components/MarkingSchemeView';
import GradingView from './components/GradingView';
import HistoryView from './components/HistoryView';
import LoginView from './components/LoginView';
import { loadHistory, saveHistory, cleanupLegacyData } from './utils/db';
import { Download, FileText, ArrowRight, X } from 'lucide-react';
import { jsPDF } from "jspdf";
import { supabase, fetchMarkingSchemesFromCloud, syncMarkingSchemesToCloud, syncHistoryBatchToCloud, fetchHistoryFromCloud, deleteHistoryBatchFromCloud } from './utils/supabaseClient';
import { Toaster } from 'react-hot-toast';
import { initOfflineSync } from './utils/offlineSync';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  const augmentUserWithLocalProfile = (user) => {
    if (!user) return null;
    try {
        const localProfile = JSON.parse(localStorage.getItem(`profile_${user.id}`));
        return localProfile ? { ...user, ...localProfile } : user;
    } catch { return user; }
  };

  useEffect(() => {
    initOfflineSync();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        setCurrentUser(augmentUserWithLocalProfile(session.user));
      }
      setAuthInitialized(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsAuthenticated(true);
        setCurrentUser(augmentUserWithLocalProfile(session.user));
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);


  const [activeView, setActiveView] = useState('dashboard');
  const [activePreviewScript, setActivePreviewScript] = useState(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [showFullReportModal, setShowFullReportModal] = useState(false);

  const [globalCreateMode, setGlobalCreateMode] = useState(false);

  useEffect(() => {
    if (activePreviewScript) setActivePageIndex(0);
  }, [activePreviewScript]);
  const [activeHistoryBatch, setActiveHistoryBatch] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [retryPayload, setRetryPayload] = useState(null);

  const handleRetryBatch = (batch) => {
    setRetryPayload(batch);
    setActiveView('grade');
    setActiveHistoryBatch(null);
  };

  const getExtractedTextForPage = (fullText, pageIndex) => {
    if (!fullText) return "";
    if (!/---\s*PAGE\s+\d+\s*---/i.test(fullText)) {
        return pageIndex === 0 ? fullText : "";
    }
    const parts = fullText.split(/---\s*PAGE\s+\d+\s*---/i).filter(s => s.trim().length > 0);
    return parts[pageIndex] ? parts[pageIndex].trim() : ""; 
  };

  const isTimeTraveling = React.useRef(false);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [savedSchemesDirect, setSavedSchemesDirect] = useState([]);

  const setSavedSchemes = React.useCallback((val) => {
    setSavedSchemesDirect(prev => {
        const next = typeof val === 'function' ? val(prev) : val;
        if (next !== prev && !isTimeTraveling.current) {
            const nextL = next ? next.length : 0;
            const prevL = prev ? prev.length : 0;
            if (nextL < prevL) {
                const label = 'Deleted Scheme';
                setUndoStack(s => [...s, { type: 'savedSchemes', old: prev, next, label }]);
                setRedoStack([]);
                setToastMessage(`${label} (Press Ctrl+Z to undo)`);
                setShowToast(true);
                setTimeout(() => setShowToast(false), 4000);
            }
        }
        return next;
    });
  }, []);
  const savedSchemes = savedSchemesDirect;
  
  // Theme Engine Controller
  const [theme, setTheme] = useState('dark');
  
  useEffect(() => {
    if (currentUser) {
        const userTheme = localStorage.getItem(`theme_${currentUser.id}`) || 'dark';
        setTheme(userTheme);
    }
  }, [currentUser]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (currentUser) {
        localStorage.setItem(`theme_${currentUser.id}`, theme);
    }
  }, [theme, currentUser]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Scalable IndexedDB Engine Hooks
  const [gradingHistoryDirect, setGradingHistoryDirect] = useState([]);
  
  const setGradingHistory = React.useCallback((val) => {
    setGradingHistoryDirect(prev => {
        const next = typeof val === 'function' ? val(prev) : val;
        if (next !== prev && !isTimeTraveling.current) {
            const nextL = next ? next.length : 0;
            const prevL = prev ? prev.length : 0;
            if (nextL < prevL) {
                const label = 'Deleted Record';
                const deletedItems = prev.filter(p => !next.find(n => n.id === p.id));
                
                // Professional Delayed Deletion System (like Gmail's Undo Send)
                const timerId = setTimeout(() => {
                    setShowToast(false);
                    deletedItems.forEach(item => {
                        deleteHistoryBatchFromCloud(item.id, item.batchName).catch(console.error);
                    });
                }, 4000);

                setUndoStack(s => [...s, { type: 'gradingHistory', old: prev, next, label, timerId }]);
                setRedoStack([]);
                setToastMessage(`${label} (Press Ctrl+Z to undo)`);
                setShowToast(true);
            }
        }
        return next;
    });
  }, []);
  const gradingHistory = gradingHistoryDirect;
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [isSchemesLoaded, setIsSchemesLoaded] = useState(false);

  useEffect(() => {
    const bootCloudSchemes = async () => {
        if (!currentUser) {
            setSavedSchemesDirect([]);
            setIsSchemesLoaded(false);
            return;
        }
        try {
            // 1. Instant Offline Load
            const localKey = `savedSchemes_${currentUser.id}`;
            const localSchemes = JSON.parse(localStorage.getItem(localKey)) || [];
            setSavedSchemesDirect(localSchemes);

            // 2. Background Cloud Sync Pull
            const cloudSchemes = await fetchMarkingSchemesFromCloud(currentUser.id);
            if (cloudSchemes && cloudSchemes.length > 0) {
                // Cloud takes precedence as master backup
                setSavedSchemesDirect(cloudSchemes);
                localStorage.setItem(localKey, JSON.stringify(cloudSchemes));
            }
            setIsSchemesLoaded(true);
        } catch (e) {
            console.error("Failed to load cloud schemes", e);
            setIsSchemesLoaded(true);
        }
    };
    bootCloudSchemes();
  }, [currentUser]);

  useEffect(() => {
    if (!isSchemesLoaded || !currentUser) return;

    if (savedSchemes.length > 0) {
        // Sync to cloud in background
        syncMarkingSchemesToCloud(currentUser.id, savedSchemes).catch(e => console.error(e));
        // Also keep local copy for immediate offline load
        localStorage.setItem(`savedSchemes_${currentUser.id}`, JSON.stringify(savedSchemes));
    } else {
        syncMarkingSchemesToCloud(currentUser.id, []).catch(e => console.error(e));
        localStorage.removeItem(`savedSchemes_${currentUser.id}`);
    }
  }, [savedSchemes, currentUser, isSchemesLoaded]);
  
  useEffect(() => {
    const migrateAndBootDB = async () => {
      if (!currentUser) return;
      try {
        // Run lightweight cleanup to delete old unsecured prototype data
        cleanupLegacyData();

        // 1. Instant Offline Load
        let dbHistory = await loadHistory(currentUser.id);
        setGradingHistoryDirect(dbHistory);
        
        // 2. Background Cloud Sync Pull
        const cloudHistory = await fetchHistoryFromCloud(currentUser.id);
        
        // Very simple naive merge based on batch ID (UUID vs Timestamp)
        // For MVP: Prefer cloud history if it contains the same or more items. 
        // In production, we'd use a sophisticated Map/Reduce merge on `updated_at`.
        if (cloudHistory && cloudHistory.length > 0) {
            // Keep local records not found in cloud, and append cloud records.
            const cloudIds = new Set(cloudHistory.map(c => c.batchName)); // Match by name since UUIDs are different for legacy
            const mergedHistory = [
                ...cloudHistory,
                ...dbHistory.filter(h => !cloudIds.has(h.batchName))
            ];
            
            // Clean up Auto-Delete prefs for the merged set
            let finalHistory = mergedHistory;
            const autoDelPref = localStorage.getItem(`autoDeletePref_${currentUser.id}`) || 'never';
            if (autoDelPref !== 'never') {
                const limitMs = autoDelPref === '1week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
                const now = Date.now();
                
                // Identify and permanently delete expired records from the cloud
                const expiredItems = finalHistory.filter(h => (now - new Date(h.dateCreated || h.date).getTime()) > limitMs);
                expiredItems.forEach(item => {
                    deleteHistoryBatchFromCloud(item.id, item.batchName).catch(console.error);
                });
                
                finalHistory = finalHistory.filter(h => (now - new Date(h.dateCreated || h.date).getTime()) <= limitMs);
            }
            
            setGradingHistoryDirect(finalHistory);
            await saveHistory(currentUser.id, finalHistory); // Re-cache locally
        } else {
            // If cloud is empty but local isn't, apply auto-delete to local
            const autoDelPref = localStorage.getItem(`autoDeletePref_${currentUser.id}`) || 'never';
            if (autoDelPref !== 'never') {
                const limitMs = autoDelPref === '1week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
                const now = Date.now();
                const startLen = dbHistory.length;
                
                const expiredItems = dbHistory.filter(h => (now - new Date(h.dateCreated || h.date).getTime()) > limitMs);
                expiredItems.forEach(item => {
                    deleteHistoryBatchFromCloud(item.id, item.batchName).catch(console.error);
                });
                
                dbHistory = dbHistory.filter(h => (now - new Date(h.dateCreated || h.date).getTime()) <= limitMs);
                if (dbHistory.length < startLen) await saveHistory(currentUser.id, dbHistory);
            }
            setGradingHistoryDirect(dbHistory);
        }
        
        setIsHistoryLoaded(true);
      } catch (err) {
        console.error("Critical DB Boot Failure:", err);
        setIsHistoryLoaded(true);
      }
    };
    
    if (currentUser) {
        migrateAndBootDB();
    } else {
        setGradingHistoryDirect([]);
        setIsHistoryLoaded(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isHistoryLoaded && currentUser) saveHistory(currentUser.id, gradingHistory).catch(e => console.error(e));
  }, [gradingHistory, isHistoryLoaded, currentUser]);



  const handleLogin = (user) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const downloadCSV = (batch) => {
    if (!batch || !batch.scripts || batch.scripts.length === 0) return;
    
    // Explicitly add BOM (Byte Order Mark) for UTF-8 so Excel enforces string formats cleanly
    const BOM = "\uFEFF";
    const headers = ['Student Index Number', 'Final AI Score'];
    
    // Prefixing index numbers with a tab \t specifically forces older Excel versions to 
    // treat the numbers strictly as TEXT (preventing Scientific Notation), without ruining the structural CSV integrity.
    const rows = batch.scripts.map(s => {
        const score = s.gradeResult ? s.gradeResult.score : 'N/A';
        return `"\t${s.name}","${score}"`;
    });
    
    const csvString = BOM + [headers.join(','), ...rows].join('\n');
    const finalName = `${batch.batchName ? batch.batchName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'batch'}_scores.csv`;
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = url;
    link.download = finalName;
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 1000);
  };

  const downloadJustificationsPDF = (batch) => {
    if (!batch || !batch.scripts || batch.scripts.length === 0) return;
    
    const doc = new jsPDF();
    let y = 20;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("EXAM JUSTIFICATION REPORT", 105, y, null, null, "center");
    y += 10;
    
    doc.setFontSize(12);
    doc.text(`Batch Name: ${batch.batchName}`, 20, y);
    y += 7;
    doc.text(`Processed On: ${new Date(batch.dateCreated).toLocaleString()}`, 20, y);
    y += 15;
    
    batch.scripts.forEach(s => {
        if (y > 270) { doc.addPage(); y = 20; }
        
        doc.setFont("helvetica", "bold");
        doc.text(`INDEX NUMBER: ${s.name}`, 20, y);
        y += 7;
        
        doc.setFillColor(230, 255, 230);
        doc.rect(20, y - 5, 40, 8, 'F');
        doc.text(`Score: ${s.gradeResult ? s.gradeResult.score : 'N/A'}`, 22, y);
        y += 10;
        
        doc.setFont("helvetica", "normal");
        const justificationText = s.gradeResult ? (s.gradeResult.comprehensive_report || s.gradeResult.justification || 'No justification recorded.') : 'No justification recorded.';
        const splitText = doc.splitTextToSize(justificationText, 170); // Wrap at A4 margins
        
        if (y + (splitText.length * 7) > 280) {
            doc.addPage();
            y = 20;
        }
        
        doc.text(splitText, 20, y);
        y += (splitText.length * 7) + 10;
        
        doc.setDrawColor(200, 200, 200);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(20, y - 5, 190, y - 5);
        doc.setLineDashPattern([], 0);
        y += 5;
    });
    
    const safeName = batch.batchName ? batch.batchName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'batch';
    const finalName = `${safeName}_justifications.pdf`;
    
    // Use native jsPDF save which explicitly negotiates the filename attribute with the browser
    doc.save(finalName);
  };

  const downloadSingleStudentPDF = (script, batchName) => {
    if (!script) return;
    
    const doc = new jsPDF();
    let y = 20;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("COMPREHENSIVE ANALYTICAL REPORT", 105, y, null, null, "center");
    y += 10;
    
    doc.setFontSize(12);
    doc.text(`Student Index: ${script.name || 'Unknown'}`, 20, y);
    y += 7;
    doc.text(`Batch Reference: ${batchName || 'Unknown Sandbox'}`, 20, y);
    y += 7;
    doc.text(`Processed On: ${new Date().toLocaleString()}`, 20, y);
    y += 15;
    
    doc.setFillColor(230, 255, 230);
    doc.rect(20, y - 5, 40, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text(`Score: ${script.gradeResult ? script.gradeResult.score : 'N/A'}`, 22, y);
    y += 15;
    
    doc.setFont("helvetica", "normal");
    const justificationText = script.gradeResult ? (script.gradeResult.comprehensive_report || script.gradeResult.justification || 'No justification recorded.') : 'No justification recorded.';
    const splitText = doc.splitTextToSize(justificationText, 170);
    
    // Auto page pagination logic for long text
    splitText.forEach((line) => {
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
        doc.text(line, 20, y);
        y += 7;
    });
    
    const safeName = script.name ? script.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'student';
    const finalName = `${safeName}_comprehensive_report.pdf`;
    
    // Use native jsPDF save which explicitly negotiates the filename attribute with the browser
    doc.save(finalName);
  };

  const handleUndo = React.useCallback(() => {
    if (undoStack.length === 0) return;
    const stack = [...undoStack];
    const action = stack.pop();
    
    // Intercept and destroy the cloud-kill timer if the user undoes the action!
    if (action.timerId) clearTimeout(action.timerId);

    setUndoStack(stack);
    setRedoStack(r => [...r, action]);
    
    isTimeTraveling.current = true;
    if (action.type === 'gradingHistory') setGradingHistoryDirect(action.old || []);
    else if (action.type === 'savedSchemes') setSavedSchemesDirect(action.old || []);
    setTimeout(() => isTimeTraveling.current = false, 50);

    setShowToast(false);
  }, [undoStack]);

  const handleRedo = React.useCallback(() => {
    if (redoStack.length === 0) return;
    const stack = [...redoStack];
    const action = stack.pop();
    
    setRedoStack(stack);
    setUndoStack(u => [...u, action]);

    isTimeTraveling.current = true;
    if (action.type === 'gradingHistory') setGradingHistoryDirect(action.next);
    else if (action.type === 'savedSchemes') setSavedSchemesDirect(action.next);
    setTimeout(() => isTimeTraveling.current = false, 50);

    setShowToast(false);
  }, [redoStack]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault(); handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  if (!authInitialized) {
    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
            <div className="loader"></div>
        </div>
    );
  }

  if (!isAuthenticated) return <LoginView onLogin={handleLogin} />;

  return (
    <div className="dashboard-layout relative">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        savedSchemes={savedSchemes}
        gradingHistory={gradingHistory}
        theme={theme}
      />
      <div className="main-content relative bg-texture">
        <TopBar
          onLogout={handleLogout}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          savedSchemes={savedSchemes}
          gradingHistory={gradingHistory}
          setActiveView={setActiveView}
          setActiveHistoryBatch={setActiveHistoryBatch}
          setActivePreviewScript={setActivePreviewScript}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          theme={theme}
          toggleTheme={toggleTheme}
        />



        {/* Routers */}
        <div style={{ display: activeView === 'dashboard' ? 'block' : 'none', height: '100%' }}>
          <DashboardView
            savedSchemes={savedSchemes}
            gradingHistory={gradingHistory}
            setGradingHistory={setGradingHistory}
            setActiveView={setActiveView}
            searchQuery={searchQuery}
            setActiveHistoryBatch={setActiveHistoryBatch}
            currentUser={currentUser}
            setGlobalCreateMode={setGlobalCreateMode}
          />
        </div>

        <div style={{ display: activeView === 'schemes' ? 'block' : 'none', height: '100%' }}>
          <MarkingSchemeView
            savedSchemes={savedSchemes}
            setSavedSchemes={setSavedSchemes}
            isGeminiReady={true}
            searchQuery={searchQuery}
            globalCreateMode={globalCreateMode}
            setGlobalCreateMode={setGlobalCreateMode}
          />
        </div>

        <div style={{ display: activeView === 'grade' ? 'block' : 'none', height: '100%' }}>
          <GradingView
            savedSchemes={savedSchemes}
            gradingHistory={gradingHistory}
            setGradingHistory={setGradingHistory}
            isGeminiReady={true}
            setActivePreviewScript={setActivePreviewScript}
            searchQuery={searchQuery}
            retryPayload={retryPayload}
            setRetryPayload={setRetryPayload}
          />
        </div>

        <div style={{ display: activeView === 'history' ? 'block' : 'none', height: '100%' }}>
          <HistoryView
            gradingHistory={gradingHistory}
            setGradingHistory={setGradingHistory}
            setActiveHistoryBatch={setActiveHistoryBatch}
            searchQuery={searchQuery}
            currentUser={currentUser}
            isLoading={!isHistoryLoaded}
          />
        </div>
      </div>

      {/* Batch History Master Modal */}
      {activeHistoryBatch && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', zIndex: 9998, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)'
        }}>
          <div className="card slide-up" style={{ width: '90%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8)' }}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700" style={{ borderColor: 'var(--border-color)' }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: '20px' }}>
                <h2 className="text-xl font-bold m-0 text-main truncate">Historical Record: {activeHistoryBatch.batchName}</h2>
                <div className="text-muted text-sm mt-1 truncate">Processed on: {new Date(activeHistoryBatch.dateCreated).toLocaleString()} &middot; {activeHistoryBatch.paperCount} Papers</div>
              </div>
              <div className="flex items-center gap-3">
                {activeHistoryBatch.scripts && activeHistoryBatch.scripts.length > 0 && (
                  <>
                    {(activeHistoryBatch.status === 'Completed' || activeHistoryBatch.status === 'done') ? (
                        <>
                            <button 
                            className="btn-action-outline" 
                            onClick={() => downloadJustificationsPDF(activeHistoryBatch)}
                            >
                            <FileText size={16} /> Download Justifications (PDF)
                            </button>
                            <button 
                            className="btn-action-outline" 
                            onClick={() => downloadCSV(activeHistoryBatch)}
                            >
                            <Download size={16} /> Export Scores (Excel)
                            </button>
                        </>
                    ) : (
                        <button 
                            className="btn btn-primary"
                            onClick={() => handleRetryBatch(activeHistoryBatch)}
                        >
                            <span className="flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                Retry Failed Papers
                            </span>
                        </button>
                    )}
                  </>
                )}
                <button className="btn btn-outline flex items-center justify-center gap-2 text-muted" onClick={() => setActiveHistoryBatch(null)}><X size={16} strokeWidth={2.5}/> Close Record</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem' }}>
              {!activeHistoryBatch.scripts || activeHistoryBatch.scripts.length === 0 ? (
                <div className="text-center p-10 text-muted border border-dashed rounded" style={{ borderColor: 'var(--border-color)' }}>
                  Old legacy scripts from earlier prototypes were not stored recursively. Future test paper batches will appear here!
                </div>
              ) : (
                activeHistoryBatch.scripts.slice().sort((a,b) => (a.name || '').localeCompare((b.name || ''), undefined, {numeric: true})).map(s => {
                  return (
                  <div 
                    key={s.id} 
                    className="mb-4 rounded-xl overflow-hidden shadow-sm flex items-stretch transform transition-all group queue-card-hover" 
                    data-interactive="true"
                    style={{ 
                        backgroundColor: 'var(--bg-card)', 
                        border: '1px solid var(--border-color)', 
                        borderLeft: '4px solid var(--primary)', 
                        cursor: 'pointer' 
                    }} 
                    onClick={() => setActivePreviewScript(s)}
                  >
                    <div className="flex-1 p-5 overflow-hidden flex flex-col justify-center" style={{ paddingLeft: '40px' }}>
                      <div className="font-bold text-main truncate text-md mb-2 flex items-center gap-2">
                          <FileText size={16} className="text-muted opacity-60" />
                          {s.name}
                      </div>
                      <div className="text-sm font-medium leading-relaxed pr-6" style={{ color: 'var(--text-muted)' }}>
                        {s.status === 'done' ? <span className="text-success font-semibold flex items-center gap-2"><span className="text-lg leading-none mb-1">✓</span> Graded Successfully</span> : <span className="text-danger font-semibold">Vision parsing or grading execution failed critically.</span>}
                      </div>
                    </div>
                    <div className="p-6 flex items-center justify-center border-l bg-black bg-opacity-20" style={{ borderColor: 'var(--border-color)', minWidth: '130px' }}>
                      {s.status === 'done' ? (
                          <div className="text-3xl font-black text-primary tracking-tight">{s.gradeResult.score}</div>
                      ) : (
                          <div className="text-sm font-bold text-danger">Error</div>
                      )}
                    </div>
                  </div>
                )})
              )}
            </div>
          </div>
        </div>
      )}

      {/* Script Detailed Preview Modal */}
      {activePreviewScript && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(15px)'
        }}>
          <div className="card slide-up" style={{ width: '90%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2rem', border: '1px solid var(--border-color)' }}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <h2 className="text-xl font-bold m-0 text-main">{activePreviewScript.name}</h2>
                <div className="text-muted text-sm mt-1">Status: {activePreviewScript.status.toUpperCase()}</div>
              </div>
              <button className="btn btn-outline flex items-center justify-center gap-2 text-muted" onClick={() => setActivePreviewScript(null)}><X size={16} strokeWidth={2.5}/> Close Document</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', flex: 1, overflow: 'hidden' }}>
              
              {/* IMAGE TRAY */}
              <div className="flex gap-3 h-full" style={{ minWidth: 0, height: '100%', minHeight: 0 }}>
                
                {/* PDF-Style Thumbnail Navigation Strip */}
                <div style={{ width: '85px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
                  {(activePreviewScript.dataUrls || [activePreviewScript.dataUrl]).map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePageIndex(idx)}
                      className="transition-all"
                      style={{
                        padding: 0,
                        border: activePageIndex === idx ? '2px solid var(--primary)' : '2px solid transparent',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: 'rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        height: '110px',
                        display: 'flex',
                        flexDirection: 'column',
                        opacity: activePageIndex === idx ? 1 : 0.5,
                        flexShrink: 0
                      }}
                      onMouseOver={e => e.currentTarget.style.opacity = 1}
                      onMouseOut={e => { if(activePageIndex !== idx) e.currentTarget.style.opacity = 0.5 }}
                    >
                      <img src={url} alt={`Thumb ${idx + 1}`} style={{ width: '100%', flex: 1, objectFit: 'cover' }} />
                      <div style={{ fontSize: '10px', fontWeight: 'bold', padding: '4px 0', background: 'var(--bg-main)', color: 'var(--text-main)', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                        Page {idx + 1}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Main Expanded View */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12px', overflow: 'hidden' }}>
                    <img 
                      src={(activePreviewScript.dataUrls || [activePreviewScript.dataUrl])[activePageIndex]} 
                      alt={`Active Script Page ${activePageIndex + 1}`} 
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }} 
                    />
                </div>
              </div>

              {/* TEXT TRAY */}
              <div className="flex flex-col h-full items-start" style={{ minWidth: 0, height: '100%', minHeight: 0 }}>
                
                {/* Scrollable Extraction Content */}
                <div style={{ flex: 1, overflowY: 'auto', paddingLeft: '1rem', paddingRight: '1rem', paddingBottom: '20px' }}>
                    {activePreviewScript.extractedText && (
                      <div className="mb-6">
                        <strong className="text-primary block mb-4 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                            <FileText size={16} /> AI Hand-writing Extraction (Page {activePageIndex + 1})
                        </strong>
                        <div className="text-sm font-medium text-main leading-relaxed px-2" style={{ whiteSpace: 'pre-wrap', opacity: 0.9 }}>
                          {getExtractedTextForPage(activePreviewScript.extractedText, activePageIndex) || <span className="text-muted italic">No text extracted specifically for this page boundary.</span>}
                        </div>
                      </div>
                    )}
                </div>

                 {/* PREMIUM VERDICT CARD (Pinned Bottom) */}
                {activePreviewScript.gradeResult && (
                  <div className="rounded-xl overflow-hidden shadow-lg mt-2 mx-2 flex flex-shrink-0" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderLeft: `4px solid var(--success)`, minHeight: '120px' }}>
                     <div className="flex flex-col justify-center items-center px-6 py-4 border-r" style={{ borderColor: 'var(--border-color)', background: 'rgba(16,185,129,0.05)', minWidth: '160px' }}>
                        <span className="text-success font-black tracking-tight" style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', lineHeight: 1 }}>{activePreviewScript.gradeResult.score}</span>
                        <span className="text-success font-bold text-xs uppercase mt-2 tracking-widest opacity-80">Score</span>
                     </div>
                     <div className="flex flex-col justify-center flex-1" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px 24px' }}>
                        <span className="text-muted font-bold text-xs tracking-widest uppercase mb-2">Final Recommendation</span>
                        <button 
                            className="btn-action-primary flex items-center justify-center gap-2" 
                            style={{ padding: '8px 18px', fontSize: '0.95rem', width: 'fit-content', borderRadius: '8px', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)' }}
                            onClick={() => setShowFullReportModal(true)}
                        >
                            View Full Analytical Report <ArrowRight size={16} strokeWidth={2.5} />
                        </button>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL REPORT OVERLAY */}
      {showFullReportModal && activePreviewScript && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'
        }}>
          <div className="card slide-up" style={{ width: '90%', maxWidth: '850px', height: '85vh', display: 'flex', flexDirection: 'column', padding: '2.5rem', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}>
            <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-700" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <h2 className="text-2xl font-bold m-0 text-main flex items-center gap-3">
                  Comprehensive Analytical Report 
                  <span className="badge badge-success px-4 py-1 text-sm tracking-widest font-black" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>SCORE: {activePreviewScript.gradeResult.score}</span>
                </h2>
                <div className="text-muted text-md mt-3 flex items-center gap-2 font-medium">
                  <FileText size={18} className="opacity-70" /> Student / Index Code: <span className="text-main font-bold">{activePreviewScript.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <button 
                   className="btn-action-outline" 
                   onClick={() => downloadSingleStudentPDF(activePreviewScript, activeHistoryBatch?.batchName)}
                 >
                   <Download size={18} /> Download PDF
                 </button>
                 <button className="btn btn-outline text-muted" onClick={() => setShowFullReportModal(false)}>Close</button>
              </div>
            </div>

            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem', paddingBottom: '2rem' }}>
              <div className="font-medium leading-relaxed" style={{ fontSize: '1.05rem', whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>
                 {activePreviewScript.gradeResult.comprehensive_report || activePreviewScript.gradeResult.justification || 'No comprehensive report generated for this script.'}
              </div>
            </div>
          </div>
        </div>
      )}
      <div 
        style={{
            position: 'fixed', bottom: showToast ? '30px' : '-100px', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            padding: '12px 24px', borderRadius: '30px', zIndex: 99999,
            transition: 'bottom 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-main)',
            overflow: 'hidden'
        }}
      >
        <div style={{
            position: 'absolute', bottom: 0, left: 0, height: '3px',
            background: 'var(--primary)',
            width: showToast ? '0%' : '100%',
            transition: showToast ? 'width 4s linear' : 'none'
        }} />
        <div style={{ flex: 1, fontWeight: 600, fontSize: '14px', position: 'relative', zIndex: 2 }}>{toastMessage}</div>
        <div style={{ display: 'flex', gap: '8px', position: 'relative', zIndex: 2 }}>
            {undoStack.length > 0 && <button className="btn hover-glow" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--primary)', color: '#fff', borderRadius: '20px', border: 'none' }} onClick={handleUndo}>Undo</button>}
        </div>
      </div>
      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            borderRadius: '12px'
          },
          success: {
            iconTheme: {
              primary: 'var(--primary)',
              secondary: 'white',
            },
          },
        }}
      />
    </div>
  );
}
