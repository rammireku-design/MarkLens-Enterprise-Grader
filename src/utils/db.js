const DB_NAME = 'ocrGraderDB';
const STORE_NAME = 'historyStore';
const CACHE_STORE = 'cacheStore';
const OFFLINE_QUEUE_STORE = 'offlineQueueStore';
const DB_VERSION = 3; // Bumped to 3 for Offline Action Queue

export const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (e) => reject("IndexedDB error: " + e.target.error);
        
        request.onsuccess = (e) => resolve(e.target.result);
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(CACHE_STORE)) {
                db.createObjectStore(CACHE_STORE);
            }
            if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
                db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id' });
            }
        };
    });
};

export const saveHistory = async (userId, historyArray) => {
    if (!userId) return;
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(historyArray, `appHistory_${userId}`);
        
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject("IndexedDB Save Error: " + e.target.error);
    });
};

export const loadHistory = async (userId) => {
    if (!userId) return [];
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(`appHistory_${userId}`);
        
        request.onsuccess = (e) => resolve(e.target.result || []);
        request.onerror = (e) => reject("IndexedDB Load Error: " + e.target.error);
    });
};

export const setCache = async (key, value) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject("IndexedDB Cache Set Error: " + e.target.error);
    });
};

export const getCache = async (key) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.get(key);
        request.onsuccess = (e) => resolve(e.target.result || null);
        request.onerror = (e) => reject("IndexedDB Cache Get Error: " + e.target.error);
    });
};

export const clearCache = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject("IndexedDB Cache Clear Error: " + e.target.error);
    });
};

export const cleanupLegacyData = async () => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete('appHistory');
    } catch (e) {
        // Ignore if already deleted
    }
    
    localStorage.removeItem('appUsers');
    localStorage.removeItem('savedSchemes');
    localStorage.removeItem('theme');
    localStorage.removeItem('autoDeletePref');
};

export const queueOfflineJob = async (jobData) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(OFFLINE_QUEUE_STORE);
        const request = store.put({ id: Date.now().toString(), data: jobData, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject("Offline Queue Put Error: " + e.target.error);
    });
};

export const getOfflineJobs = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly');
        const store = tx.objectStore(OFFLINE_QUEUE_STORE);
        const request = store.getAll();
        request.onsuccess = (e) => resolve(e.target.result || []);
        request.onerror = (e) => reject("Offline Queue Get Error: " + e.target.error);
    });
};

export const removeOfflineJob = async (jobId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(OFFLINE_QUEUE_STORE);
        const request = store.delete(jobId);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject("Offline Queue Delete Error: " + e.target.error);
    });
};
