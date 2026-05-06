const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractDataLayerSlice(filePath) {
    const source = fs.readFileSync(filePath, 'utf8');
    const start = source.indexOf("const SCHEMA_KEY = 'med_inventory';");
    const end = source.indexOf('// 空状态检测');

    if (start === -1 || end === -1 || end <= start) {
        throw new Error(`Could not extract data layer from ${filePath}`);
    }

    return source.slice(start, end);
}

function createLocalStorage(initialData) {
    const store = new Map(Object.entries(initialData));

    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        dump() {
            return Object.fromEntries(store.entries());
        }
    };
}

function loadMedicineFunctions(initialData) {
    const filePath = path.join(__dirname, '..', 'medicine-refactored.js');
    const code = extractDataLayerSlice(filePath);
    const localStorage = createLocalStorage(initialData);
    const toasts = [];

    const context = {
        console,
        localStorage,
        showToast(message, type) {
            toasts.push({ message, type });
        }
    };

    vm.createContext(context);
    vm.runInContext(code, context, { filename: 'medicine-refactored.js' });

    return { context, localStorage, toasts };
}

function parseStore(localStorage, key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
}

function runSingleDeleteCase() {
    const { context, localStorage } = loadMedicineFunctions({
        med_inventory: JSON.stringify([
            { id: 'med-1', name: 'A' },
            { id: 'med-2', name: 'B' }
        ]),
        med_rules: JSON.stringify([
            { ruleId: 'rule-1', medId: 'med-1' },
            { ruleId: 'rule-2', medId: 'med-2' }
        ]),
        med_logs: JSON.stringify([
            { logId: 'log-1', medId: 'med-1', name: 'A' }
        ])
    });

    const deleted = context.deleteMed('med-1');
    assert.equal(deleted, true, 'single delete should succeed');
    assert.deepEqual(
        parseStore(localStorage, 'med_inventory').map(item => item.id),
        ['med-2'],
        'single delete should remove inventory item'
    );
    assert.deepEqual(
        parseStore(localStorage, 'med_rules').map(item => item.ruleId),
        ['rule-2'],
        'single delete should remove associated reminder rules'
    );
    assert.deepEqual(
        parseStore(localStorage, 'med_logs').map(item => item.logId),
        ['log-1'],
        'single delete should preserve medication logs'
    );
}

function runBatchDeleteCase() {
    const { context, localStorage } = loadMedicineFunctions({
        med_inventory: JSON.stringify([
            { id: 'med-1', name: 'A' },
            { id: 'med-2', name: 'B' },
            { id: 'med-3', name: 'C' }
        ]),
        med_rules: JSON.stringify([
            { ruleId: 'rule-1', medId: 'med-1' },
            { ruleId: 'rule-2', medId: 'med-2' },
            { ruleId: 'rule-3', medId: 'med-3' }
        ]),
        med_logs: JSON.stringify([
            { logId: 'log-1', medId: 'med-1', name: 'A' },
            { logId: 'log-2', medId: 'med-2', name: 'B' }
        ])
    });

    const deleted = context.batchDelete(['med-1', 'med-3']);
    assert.equal(deleted, true, 'batch delete should succeed');
    assert.deepEqual(
        parseStore(localStorage, 'med_inventory').map(item => item.id),
        ['med-2'],
        'batch delete should remove selected inventory items'
    );
    assert.deepEqual(
        parseStore(localStorage, 'med_rules').map(item => item.ruleId),
        ['rule-2'],
        'batch delete should remove associated reminder rules'
    );
    assert.deepEqual(
        parseStore(localStorage, 'med_logs').map(item => item.logId),
        ['log-1', 'log-2'],
        'batch delete should preserve medication logs'
    );
}

runSingleDeleteCase();
runBatchDeleteCase();
console.log('medicine delete cascade test passed');
