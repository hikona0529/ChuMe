const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MockElement {
    constructor({ id = '' } = {}) {
        this.id = id;
        this.value = '';
        this.innerText = '';
        this.className = '';
        this.listeners = {};
        this.files = [];
    }

    addEventListener(type, handler) {
        this.listeners[type] = handler;
    }

    click() {
        if (this.listeners.click) {
            this.listeners.click({ target: this });
        }
    }
}

function createLocalStorage(initialEntries = {}) {
    const store = new Map(Object.entries(initialEntries));

    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
        key(index) {
            return Array.from(store.keys())[index] ?? null;
        },
        get length() {
            return store.size;
        },
        dump() {
            return Object.fromEntries(store.entries());
        }
    };
}

function createDocument() {
    const elements = new Map();
    const ids = ['nickname-input', 'gender-input', 'btn-gender-1', 'btn-gender-2', 'height-input', 'import-file'];
    ids.forEach(id => elements.set(id, new MockElement({ id })));

    return {
        body: {
            appendChild() {},
            removeChild() {}
        },
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, new MockElement({ id }));
            }
            return elements.get(id);
        },
        createElement() {
            return new MockElement();
        }
    };
}

function createMockDb(storeData) {
    const db = {
        objectStoreNames: Object.keys(storeData),
        transaction(storeNames) {
            const names = Array.isArray(storeNames) ? storeNames : [storeNames];
            return {
                objectStore(storeName) {
                    if (!names.includes(storeName)) {
                        throw new Error(`Unexpected store access: ${storeName}`);
                    }

                    return {
                        getAll() {
                            const request = {};
                            queueMicrotask(() => {
                                request.result = JSON.parse(JSON.stringify(storeData[storeName] || []));
                                if (request.onsuccess) request.onsuccess({ target: request });
                            });
                            return request;
                        },
                        clear() {
                            const request = {};
                            queueMicrotask(() => {
                                storeData[storeName] = [];
                                if (request.onsuccess) request.onsuccess({ target: request });
                            });
                            return request;
                        },
                        put(value) {
                            const request = {};
                            queueMicrotask(() => {
                                storeData[storeName].push(JSON.parse(JSON.stringify(value)));
                                if (request.onsuccess) request.onsuccess({ target: request });
                            });
                            return request;
                        }
                    };
                }
            };
        }
    };

    return {
        db,
        dump() {
            return JSON.parse(JSON.stringify(storeData));
        }
    };
}

function loadScripts() {
    const utilsPath = path.join(__dirname, '..', 'utils.js');
    const settingsPath = path.join(__dirname, '..', 'settings.js');
    const utilsCode = fs.readFileSync(utilsPath, 'utf8');
    const settingsCode = fs.readFileSync(settingsPath, 'utf8');

    const localStorage = createLocalStorage({
        chume_user_gender: '2',
        old_only_key: 'stale-value'
    });
    const document = createDocument();
    const dbState = createMockDb({
        water: [{ id: 'water-legacy', amount: 999 }],
        bodydata: [],
        fasting: [],
        medicine: [],
        med_rules: [],
        med_logs: []
    });

    const sandbox = {
        console,
        localStorage,
        document,
        window: {},
        indexedDB: {
            open() {
                const request = {};
                queueMicrotask(() => {
                    if (request.onsuccess) {
                        request.onsuccess({ target: { result: dbState.db } });
                    }
                });
                return request;
            },
            deleteDatabase() {
                const request = {};
                queueMicrotask(() => {
                    if (request.onsuccess) request.onsuccess({ target: request });
                });
                return request;
            }
        },
        setTimeout: fn => {
            fn();
            return 0;
        },
        URL: {
            createObjectURL(blob) {
                sandbox.__lastBlob = blob;
                return 'blob:mock';
            },
            revokeObjectURL() {}
        },
        Blob: class Blob {
            constructor(parts) {
                this.parts = parts;
            }
            async text() {
                return this.parts.join('');
            }
        },
        confirm: () => true,
        showToast() {},
        savePref(key, value) {
            localStorage.setItem(`chume_${key}`, JSON.stringify(value));
            return true;
        },
        getPref() {
            return null;
        },
        factoryReset: async () => {},
        FileReader: class FileReader {},
        Event: class Event {
            constructor(type) {
                this.type = type;
            }
        }
    };

    sandbox.window = sandbox;
    sandbox.window.addEventListener = () => {};
    sandbox.window.location = { reload() {}, href: '' };
    sandbox.queueMicrotask = queueMicrotask;

    vm.createContext(sandbox);
    vm.runInContext(utilsCode, sandbox, { filename: 'utils.js' });
    vm.runInContext(settingsCode, sandbox, { filename: 'settings.js' });

    return { sandbox, localStorage, dbState };
}

(async () => {
    const { sandbox, localStorage, dbState } = loadScripts();

    assert.equal(typeof sandbox.exportBackupData, 'function', 'expected exportBackupData helper');
    assert.equal(typeof sandbox.restoreBackupData, 'function', 'expected restoreBackupData helper');

    const exported = await sandbox.exportBackupData();
    assert.deepEqual(exported.indexedDB.water, [{ id: 'water-legacy', amount: 999 }], 'backup should include IndexedDB water data');

    await sandbox.restoreBackupData({
        version: 1,
        localStorage: {
            chume_user_gender: '1',
            restored_only_key: 'new-value'
        },
        indexedDB: {
            water: [{ id: 'water-new', amount: 250 }],
            bodydata: [],
            fasting: [],
            medicine: [],
            med_rules: [],
            med_logs: []
        }
    });

    assert.equal(localStorage.getItem('restored_only_key'), 'new-value', 'restore should write incoming localStorage keys');
    assert.equal(localStorage.getItem('old_only_key'), null, 'restore should clear stale localStorage keys before importing');
    assert.deepEqual(dbState.dump().water, [{ id: 'water-new', amount: 250 }], 'restore should replace old IndexedDB water data');

    const legacyRun = loadScripts();
    await assert.rejects(
        () => legacyRun.sandbox.restoreBackupData({
            chume_user_gender: '1',
            restored_only_key: 'legacy-value'
        }),
        /完整备份文件/
    );
    assert.equal(
        legacyRun.localStorage.getItem('old_only_key'),
        'stale-value',
        'invalid legacy backups should not mutate localStorage'
    );
    assert.deepEqual(
        legacyRun.dbState.dump().water,
        [{ id: 'water-legacy', amount: 999 }],
        'invalid legacy backups should not mutate IndexedDB stores'
    );

    console.log('settings backup roundtrip test passed');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
