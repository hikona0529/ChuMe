/**
 * WebOS Utilities
 * Includes: IndexedDB wrapper, LocalStorage helpers, Toast notifications
 */

// --- Constants ---
const DB_NAME = 'Chume_DB';
const DB_VERSION = 3;

// --- IndexedDB Helper ---
const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        reject(event.target.error);
    };

    request.onsuccess = (event) => {
        console.log("IndexedDB opened successfully");
        resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Create object stores if they don't exist
        // Note: New object stores must be created here
        if (!db.objectStoreNames.contains('water')) {
            const waterStore = db.createObjectStore('water', { keyPath: 'id' });
            waterStore.createIndex('date', 'date', { unique: false });
            waterStore.createIndex('isElec', 'isElec', { unique: false });
        }
        if (!db.objectStoreNames.contains('bodydata')) {
            const bodydataStore = db.createObjectStore('bodydata', { keyPath: 'id' });
            bodydataStore.createIndex('date', 'date', { unique: false });
            bodydataStore.createIndex('type', 'type', { unique: false }); // 'daily' or 'weekly'
        }
        if (!db.objectStoreNames.contains('fasting')) {
            const fastingStore = db.createObjectStore('fasting', { keyPath: 'id' });
            fastingStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('medicine')) {
            const medicineStore = db.createObjectStore('medicine', { keyPath: 'id' });
            medicineStore.createIndex('name', 'name', { unique: false });
            medicineStore.createIndex('expireDate', 'expireDate', { unique: false });
        }
        if (!db.objectStoreNames.contains('med_rules')) {
            const medRulesStore = db.createObjectStore('med_rules', { keyPath: 'ruleId' });
            medRulesStore.createIndex('medId', 'medId', { unique: false });
        }
        if (!db.objectStoreNames.contains('med_logs')) {
            const medLogsStore = db.createObjectStore('med_logs', { keyPath: 'logId' });
            medLogsStore.createIndex('date', 'date', { unique: false });
            medLogsStore.createIndex('medId', 'medId', { unique: false });
        }
        console.log("IndexedDB upgrade complete");
    };
});

// --- Data Storage API ---

/**
 * Save data to IndexedDB
 * @param {string} storeName - Name of the object store (e.g., 'notes')
 * @param {object} data - Data object to save (must include 'id' if keyPath is 'id')
 * @returns {Promise}
 */
async function saveData(storeName, data) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get data from IndexedDB
 * @param {string} storeName - Name of the object store
 * @param {string|number} id - Key of the data to retrieve
 * @returns {Promise}
 */
async function getData(storeName, id) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get ALL data from a store (useful for lists)
 * @param {string} storeName 
 * @returns {Promise<Array>}
 */
async function getAllData(storeName) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get data from a store by index
 * @param {string} storeName - Name of the object store
 * @param {string} indexName - Name of the index to use
 * @param {*} value - Value to search for
 * @returns {Promise<Array>}
 */
async function getDataByIndex(storeName, indexName, value) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete data from a store
 * @param {string} storeName - Name of the object store
 * @param {string|number} id - Key of the data to delete
 * @returns {Promise}
 */
async function deleteData(storeName, id) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Batch save multiple data items to a store
 * @param {string} storeName - Name of the object store
 * @param {Array} dataArray - Array of data objects to save
 * @returns {Promise}
 */
async function batchSaveData(storeName, dataArray) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        let completed = 0;
        let errors = [];
        
        dataArray.forEach(data => {
            const request = store.put(data);
            request.onsuccess = () => {
                completed++;
                if (completed === dataArray.length) {
                    if (errors.length === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Some errors occurred: ${errors.join(', ')}`));
                    }
                }
            };
            request.onerror = (event) => {
                errors.push(event.target.error.message);
                completed++;
                if (completed === dataArray.length) {
                    reject(new Error(`Some errors occurred: ${errors.join(', ')}`));
                }
            };
        });
        
        if (dataArray.length === 0) {
            resolve();
        }
    });
}

/**
 * Batch delete multiple data items from a store
 * @param {string} storeName - Name of the object store
 * @param {Array} idArray - Array of keys to delete
 * @returns {Promise}
 */
async function batchDeleteData(storeName, idArray) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        let completed = 0;
        let errors = [];
        
        idArray.forEach(id => {
            const request = store.delete(id);
            request.onsuccess = () => {
                completed++;
                if (completed === idArray.length) {
                    if (errors.length === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Some errors occurred: ${errors.join(', ')}`));
                    }
                }
            };
            request.onerror = (event) => {
                errors.push(event.target.error.message);
                completed++;
                if (completed === idArray.length) {
                    reject(new Error(`Some errors occurred: ${errors.join(', ')}`));
                }
            };
        });
        
        if (idArray.length === 0) {
            resolve();
        }
    });
}

/**
 * Clear all data from a store
 * @param {string} storeName - Name of the object store
 * @returns {Promise}
 */
async function clearStore(storeName) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get data from a store by range
 * @param {string} storeName - Name of the object store
 * @param {string} indexName - Name of the index to use
 * @param {IDBKeyRange} range - Key range to search within
 * @returns {Promise<Array>}
 */
async function getDataByRange(storeName, indexName, range) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(range);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Count items in a store
 * @param {string} storeName - Name of the object store
 * @returns {Promise<number>}
 */
async function countItems(storeName) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// --- Common Utilities ---

/**
 * Generate a unique ID
 * @returns {string} Unique ID based on timestamp
 */
function generateId() {
    return String(Date.now());
}

/**
 * Get current date string in YYYY-MM-DD format
 * @returns {string} Current date string
 */
function getCurrentDateString() {
    return formatDate(new Date());
}

// --- LocalStorage Helper (Shortcuts) ---
// Keys are automatically prefixed with 'chume_'
const PREF_PREFIX = 'chume_';

/**
 * Save preference to LocalStorage with error handling
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 * @returns {boolean} Whether the operation was successful
 */
function savePref(key, value) {
    try {
        localStorage.setItem(PREF_PREFIX + key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Error saving preference:', error);
        showToast('保存设置失败，请检查存储空间', 'error');
        return false;
    }
}

/**
 * Get preference from LocalStorage with error handling
 * @param {string} key - Preference key
 * @param {*} defaultValue - Default value if preference not found
 * @returns {*} Preference value or default value
 */
function getPref(key, defaultValue = null) {
    try {
        const val = localStorage.getItem(PREF_PREFIX + key);
        return val ? JSON.parse(val) : defaultValue;
    } catch (error) {
        console.error('Error getting preference:', error);
        return defaultValue;
    }
}

// --- Date Utilities ---

/**
 * Format date to YYYY-MM-DD string
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get date string for a specific offset from today
 * @param {number} offset - Number of days offset from today
 * @returns {string} Formatted date string
 */
function getDateStr(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return formatDate(d);
}

/**
 * Format time to HH:MM string
 * @param {Date|number} time - Date object or timestamp
 * @returns {string} Formatted time string
 */
function formatTime(time) {
    const date = typeof time === 'number' ? new Date(time) : time;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Format time duration in milliseconds to HH:MM:SS
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// --- Toast Notification System ---

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast: 'success', 'error', 'info'
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300 ${getToastClass(type)}`;
    toast.textContent = message;
    
    // Add to body
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 100);
    
    // Hide and remove toast
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, duration);
}

/**
 * Get toast class based on type
 * @param {string} type - Type of toast
 * @returns {string} CSS class string
 */
function getToastClass(type) {
    switch (type) {
        case 'success':
            return 'bg-green-500 text-white';
        case 'error':
            return 'bg-red-500 text-white';
        case 'info':
        default:
            return 'bg-blue-500 text-white';
    }
}

// --- Factory Reset: Clear ALL data ---

/**
 * Factory Reset: Clear ALL data
 * 1. Clear LocalStorage
 * 2. Delete IndexedDB
 */
async function factoryReset() {
    // 1. Clear LocalStorage
    localStorage.clear();
    console.log("LocalStorage cleared");

    // 2. Delete IndexedDB
    try {
        const db = await dbPromise;
        db.close();
        console.log("IndexedDB connection closed");
    } catch (e) {
        console.warn("Could not close DB:", e);
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);

        request.onsuccess = () => {
            console.log("IndexedDB deleted successfully");
            resolve();
        };

        request.onerror = (event) => {
            console.error("Error deleting IndexedDB:", event.target.error);
            reject(event.target.error);
        };
    });
}

// --- Export functions for use in other files ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        dbPromise,
        saveData,
        getData,
        getAllData,
        getDataByIndex,
        deleteData,
        batchSaveData,
        batchDeleteData,
        clearStore,
        getDataByRange,
        countItems,
        generateId,
        getCurrentDateString,
        savePref,
        getPref,
        formatDate,
        getDateStr,
        formatTime,
        formatDuration,
        showToast,
        factoryReset
    };
}
