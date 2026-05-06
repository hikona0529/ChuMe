const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MockClassList {
    constructor() {
        this.values = new Set();
    }

    add(...names) {
        names.forEach(name => this.values.add(name));
    }

    remove(...names) {
        names.forEach(name => this.values.delete(name));
    }
}

class MockElement {
    constructor() {
        this.classList = new MockClassList();
    }
}

function extractFunctionSource(filePath, functionName) {
    const source = fs.readFileSync(filePath, 'utf8');
    const signature = `function ${functionName}(`;
    const start = source.indexOf(signature);
    if (start === -1) {
        throw new Error(`Function ${functionName} not found in ${filePath}`);
    }

    let braceIndex = source.indexOf('{', start);
    let depth = 0;
    let end = braceIndex;

    for (; end < source.length; end++) {
        const ch = source[end];
        if (ch === '{') depth++;
        if (ch === '}') {
            depth--;
            if (depth === 0) {
                end++;
                break;
            }
        }
    }

    return source.slice(start, end);
}

function createDocument() {
    const elements = new Map([
        ['conflict-modal', new MockElement()],
        ['conflict-card', new MockElement()]
    ]);

    return {
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, new MockElement());
            }
            return elements.get(id);
        }
    };
}

function normalize(value) {
    return JSON.parse(JSON.stringify(value));
}

async function runWaterCase() {
    const writes = [];
    const context = {
        document: createDocument(),
        pendingConflicts: [{ date: '2026-03-27' }],
        pendingNewData: [{ id: 'new-water' }],
        saveData(storeName, record) {
            writes.push({ storeName, record });
            return Promise.resolve();
        },
        renderWaterApp() {},
        waterCalendar: null,
        calDate: new Date('2026-03-27T00:00:00Z'),
        getWaterDateStr() {
            return '2026-03-27';
        },
        showToast() {},
        setTimeout(fn) {
            fn();
            return 0;
        },
        Promise
    };

    vm.createContext(context);
    vm.runInContext(
        `${extractFunctionSource(path.join(__dirname, '..', 'water-refactored-v2.js'), 'closeConflictModal')}\ncloseConflictModal();`,
        context
    );
    await Promise.resolve();

    assert.equal(writes.length, 0, 'water close should not persist pending data');
    assert.deepEqual(normalize(context.pendingNewData), [], 'water close should clear pending new data');
    assert.deepEqual(normalize(context.pendingConflicts), [], 'water close should clear pending conflicts');
}

async function runFastingCase() {
    let writeCount = 0;
    const storage = new Map([['chume_fasting_log', JSON.stringify([{ id: 1 }])]]);
    const context = {
        document: createDocument(),
        pendingConflicts: [{ id: 'c1' }],
        pendingNewData: [{ id: 2 }],
        HIST_KEY: 'chume_fasting_log',
        localStorage: {
            getItem(key) {
                return storage.has(key) ? storage.get(key) : null;
            },
            setItem(key, value) {
                writeCount++;
                storage.set(key, value);
            }
        },
        renderHistory() {},
        showToast() {},
        setTimeout(fn) {
            fn();
            return 0;
        }
    };

    vm.createContext(context);
    vm.runInContext(
        `${extractFunctionSource(path.join(__dirname, '..', 'fasting.js'), 'closeConflictModal')}\ncloseConflictModal();`,
        context
    );

    assert.equal(writeCount, 0, 'fasting close should not persist pending data');
    assert.deepEqual(normalize(context.pendingNewData), [], 'fasting close should clear pending new data');
    assert.deepEqual(normalize(context.pendingConflicts), [], 'fasting close should clear pending conflicts');
}

async function runBodydataCase() {
    let writeCount = 0;
    const storage = new Map([
        ['chume_log_daily_v13', JSON.stringify([{ date: '2026-03-26' }])],
        ['chume_log_weekly_v13', JSON.stringify([{ date: '2026-03-23' }])]
    ]);
    const context = {
        document: createDocument(),
        pendingConflicts: [{ type: 'daily', date: '2026-03-27' }],
        pendingNewData: {
            daily: [{ date: '2026-03-28' }],
            weekly: [{ date: '2026-03-29' }]
        },
        localStorage: {
            getItem(key) {
                return storage.has(key) ? storage.get(key) : null;
            },
            setItem(key, value) {
                writeCount++;
                storage.set(key, value);
            }
        },
        updateBodyUI() {},
        showToast() {},
        setTimeout(fn) {
            fn();
            return 0;
        },
        JSON
    };

    vm.createContext(context);
    vm.runInContext(
        `${extractFunctionSource(path.join(__dirname, '..', 'bodydata-refactored.js'), 'closeConflictModal')}\ncloseConflictModal();`,
        context
    );

    assert.equal(writeCount, 0, 'bodydata close should not persist pending data');
    assert.deepEqual(
        normalize(context.pendingNewData),
        { daily: [], weekly: [] },
        'bodydata close should clear pending new data'
    );
    assert.deepEqual(normalize(context.pendingConflicts), [], 'bodydata close should clear pending conflicts');
}

(async () => {
    await runWaterCase();
    await runFastingCase();
    await runBodydataCase();
    console.log('conflict modal cancel test passed');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
