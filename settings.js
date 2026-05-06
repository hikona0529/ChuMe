// Load Settings on Start
window.addEventListener('load', () => {
    const userSettings = getPref('user_settings');
    if (userSettings && userSettings.nickname) {
        document.getElementById('nickname-input').value = userSettings.nickname;
    }
    const gender = localStorage.getItem('chume_user_gender');
    if (gender) {
        setSettingsGender(gender);
    }
    const height = localStorage.getItem('chume_user_height');
    if (height) {
        document.getElementById('height-input').value = height;
    }

    // 监听文件选择用于恢复备份
    const fileInput = document.getElementById('import-file');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    const parsedData = JSON.parse(event.target.result);
                    const backup = normalizeBackupPayload(parsedData);
                    
                    if (confirm('这将清空并覆盖当前所有本地数据与应用记录，确认恢复吗？')) {
                        await restoreBackupData(backup);
                        
                        if (typeof showToast === 'function') showToast('完整恢复成功', 'success');
                        
                        // 延迟 1 秒后刷新页面
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }
                } catch (err) {
                    console.error('Import parse error:', err);
                    if (typeof showToast === 'function') {
                        showToast(err.message || '文件格式错误', 'error');
                    }
                }
            };
            
            reader.onerror = function() {
                if (typeof showToast === 'function') showToast('读取文件失败', 'error');
            };
            
            reader.readAsText(file);
        });
    }
});

// Segmented Control JS
function setSettingsGender(val) {
    const hidden = document.getElementById('gender-input');
    if (hidden) hidden.value = val;
    const b1 = document.getElementById('btn-gender-1');
    const b2 = document.getElementById('btn-gender-2');
    if (b1 && b2) {
        if (val === '1') {
            b1.className = "flex-1 py-1.5 text-center rounded-md font-medium bg-white text-chume-brown shadow-sm transition-all";
            b2.className = "flex-1 py-1.5 text-center rounded-md font-medium text-chume-brown-light hover:text-chume-brown transition-all";
        } else if (val === '2') {
            b2.className = "flex-1 py-1.5 text-center rounded-md font-medium bg-white text-chume-brown shadow-sm transition-all";
            b1.className = "flex-1 py-1.5 text-center rounded-md font-medium text-chume-brown-light hover:text-chume-brown transition-all";
        } else {
            b1.className = "flex-1 py-1.5 text-center rounded-md font-medium text-chume-brown-light hover:text-chume-brown transition-all";
            b2.className = "flex-1 py-1.5 text-center rounded-md font-medium text-chume-brown-light hover:text-chume-brown transition-all";
        }
    }
}

// Save Function
function saveSettings() {
    const nickname = document.getElementById('nickname-input').value.trim();
    const genderInput = document.getElementById('gender-input').value;
    const heightInput = document.getElementById('height-input').value;

    // Save to LocalStorage via utils.js helper
    savePref('user_settings', {
        nickname: nickname
    });

    if (genderInput) localStorage.setItem('chume_user_gender', genderInput);
    if (heightInput) localStorage.setItem('chume_user_height', parseFloat(heightInput));

    showToast('设置已保存', 'success');

    // Delay and go back
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Reset Handler
async function handleReset() {
    if (confirm('这将删除所有数据（包括文字图片和设置）且无法恢复。\n\n确定吗？')) {
        try {
            await factoryReset();

            // Success Callback
            // 1. Clear View
            const input = document.getElementById('nickname-input');
            if (input) input.value = '';
            if (typeof setSettingsGender === 'function') setSettingsGender('');
            document.getElementById('height-input').value = '';

            // 2. Show Toast
            showToast('重置成功', 'success');

            // 3. No Reload (Stay here)

        } catch (err) {
            console.error(err);
            showToast('重置失败', 'error');
        }
    }
}

// Backup & Restore Handlers
function getBackupStoreNames(db) {
    if (!db || !db.objectStoreNames) return [];
    return Array.from(db.objectStoreNames);
}

function normalizeBackupPayload(parsedData) {
    if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
        throw new Error('备份文件格式错误');
    }

    const hasLocalStorage = Object.prototype.hasOwnProperty.call(parsedData, 'localStorage');
    const hasIndexedDB = Object.prototype.hasOwnProperty.call(parsedData, 'indexedDB');

    if (!hasLocalStorage || !hasIndexedDB) {
        throw new Error('这不是完整备份文件，无法恢复');
    }

    if (
        !parsedData.localStorage ||
        typeof parsedData.localStorage !== 'object' ||
        Array.isArray(parsedData.localStorage) ||
        !parsedData.indexedDB ||
        typeof parsedData.indexedDB !== 'object' ||
        Array.isArray(parsedData.indexedDB)
    ) {
        throw new Error('备份文件格式错误');
    }

    return {
        version: parsedData.version || 1,
        timestamp: parsedData.timestamp || Date.now(),
        localStorage: parsedData.localStorage,
        indexedDB: parsedData.indexedDB
    };
}

function readAllRecords(store) {
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

function clearObjectStore(store) {
    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function clearStoreRecords(db, storeName) {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return clearObjectStore(store);
}

function putAllRecords(store, records) {
    if (!Array.isArray(records) || records.length === 0) {
        return Promise.resolve();
    }

    return Promise.all(records.map(record => new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    })));
}

function writeStoreRecords(db, storeName, records) {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return putAllRecords(store, records);
}

async function exportBackupData() {
    const backup = {
        version: 1,
        timestamp: Date.now(),
        localStorage: {},
        indexedDB: {}
    };

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        backup.localStorage[key] = localStorage.getItem(key);
    }

    if (typeof dbPromise !== 'undefined') {
        const db = await dbPromise;
        const storeNames = getBackupStoreNames(db);
        for (const storeName of storeNames) {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            backup.indexedDB[storeName] = await readAllRecords(store);
        }
    }

    return backup;
}

async function restoreBackupData(parsedData) {
    const backup = normalizeBackupPayload(parsedData);

    localStorage.clear();
    Object.entries(backup.localStorage).forEach(([key, value]) => {
        localStorage.setItem(key, value);
    });

    if (typeof dbPromise !== 'undefined') {
        const db = await dbPromise;
        const storeNames = getBackupStoreNames(db);

        for (const storeName of storeNames) {
            await clearStoreRecords(db, storeName);
            await writeStoreRecords(db, storeName, backup.indexedDB[storeName] || []);
        }
    }
}

async function exportGlobalData() {
    try {
        const data = await exportBackupData();
        const jsonString = JSON.stringify(data);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // 动态生成带日期的文件名
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const fileName = `ChuMe_Backup_${year}${month}${day}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // 清理虚拟链接
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        if (typeof showToast === 'function') showToast('导出成功', 'success');
    } catch (err) {
        console.error('Export failed:', err);
        if (typeof showToast === 'function') showToast('导出失败', 'error');
    }
}

function triggerImport() {
    const fileInput = document.getElementById('import-file');
    if (fileInput) {
        fileInput.value = ''; // 清空选中，保证下次选择同一文件也能触发 change
        fileInput.click();
    }
}
