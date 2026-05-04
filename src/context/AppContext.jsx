import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase, fetchMarkingSchemesFromCloud, syncMarkingSchemesToCloud, syncHistoryBatchToCloud, deleteHistoryBatchFromCloud } from '../utils/supabaseClient';
import toast from 'react-hot-toast';

const AppContext = createContext();

export function AppProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [authInitialized, setAuthInitialized] = useState(false);
    
    const [theme, setTheme] = useState('dark');
    const [savedSchemes, setSavedSchemesDirect] = useState([]);
    const [gradingHistory, setGradingHistoryDirect] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // UI Global State that replaces prop drilling
    const [activeHistoryBatch, setActiveHistoryBatch] = useState(null);
    const [activePreviewScript, setActivePreviewScript] = useState(null);
    const [globalCreateMode, setGlobalCreateMode] = useState(false);
    const [isGeminiReady, setIsGeminiReady] = useState(true); // Assuming always ready via Edge function

    // Custom Undo/Redo tracking
    const isTimeTraveling = useRef(false);
    const [undoStack, setUndoStack] = useState([]);
    
    // Auth Initialization
    const augmentUserWithLocalProfile = (user) => {
        if (!user) return null;
        try {
            const localProfile = JSON.parse(localStorage.getItem(`profile_${user.id}`));
            return localProfile ? { ...user, ...localProfile } : user;
        } catch { return user; }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setIsAuthenticated(true);
                setCurrentUser(augmentUserWithLocalProfile(session.user));
            }
            setAuthInitialized(true);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

    // Theme logic
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

    // Secure custom setters for Undo functionality
    const setSavedSchemes = useCallback((val) => {
        setSavedSchemesDirect(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            if (next !== prev && !isTimeTraveling.current) {
                if ((next ? next.length : 0) < (prev ? prev.length : 0)) {
                    toast('Scheme Deleted', {
                        icon: '🗑️',
                        action: {
                            label: 'Undo',
                            onClick: () => {
                                isTimeTraveling.current = true;
                                setSavedSchemesDirect(prev);
                                setTimeout(() => isTimeTraveling.current = false, 50);
                            }
                        }
                    });
                }
            }
            return next;
        });
    }, []);

    const setGradingHistory = useCallback((val) => {
        setGradingHistoryDirect(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            if (next !== prev && !isTimeTraveling.current) {
                if ((next ? next.length : 0) < (prev ? prev.length : 0)) {
                    const deletedItems = prev.filter(p => !next.find(n => n.id === p.id));
                    
                    toast('History Deleted', {
                        icon: '🗑️',
                        duration: 4000,
                        action: {
                            label: 'Undo',
                            onClick: () => {
                                isTimeTraveling.current = true;
                                setGradingHistoryDirect(prev);
                                setTimeout(() => isTimeTraveling.current = false, 50);
                            }
                        }
                    });

                    // Background cleanup if not undone
                    setTimeout(() => {
                        if (!isTimeTraveling.current) {
                           deletedItems.forEach(item => {
                               deleteHistoryBatchFromCloud(item.id, item.batchName).catch(console.error);
                           });
                        }
                    }, 4000);
                }
            }
            return next;
        });
    }, []);

    const value = {
        isAuthenticated, setIsAuthenticated,
        currentUser, setCurrentUser,
        authInitialized,
        theme, toggleTheme,
        savedSchemes, setSavedSchemes, setSavedSchemesDirect,
        gradingHistory, setGradingHistory, setGradingHistoryDirect,
        searchQuery, setSearchQuery,
        activeHistoryBatch, setActiveHistoryBatch,
        activePreviewScript, setActivePreviewScript,
        globalCreateMode, setGlobalCreateMode,
        isGeminiReady, setIsGeminiReady
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}
