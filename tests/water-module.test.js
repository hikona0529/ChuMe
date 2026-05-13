const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MockClassList {
    constructor() {
        this.classes = new Set();
    }

    add(...names) {
        names.forEach(name => this.classes.add(name));
    }

    remove(...names) {
        names.forEach(name => this.classes.delete(name));
    }

    contains(name) {
        return this.classes.has(name);
    }
}

class MockElement {
    constructor({ id = '' } = {}) {
        this.id = id;
        this.value = '';
        this.checked = false;
        this.innerText = '';
        this.innerHTML = '';
        this.className = '';
        this.disabled = false;
        this.files = [];
        this.style = {};
        this.scrollLeft = 0;
        this.classList = new MockClassList();
        this.listeners = {};
    }

    addEventListener(type, handler) {
        this.listeners[type] = handler;
    }

    querySelectorAll(selector) {
        return Array.from(this.innerHTML.matchAll(/<input[^>]*>/g), match => {
            const tag = match[0];
            if (selector === '.drink-toggle' && !/class="[^"]*\bdrink-toggle\b[^"]*"/.test(tag)) {
                return null;
            }

            const id = tag.match(/id="([^"]+)"/);
            const value = tag.match(/value="([^"]+)"/);
            const checked = /\bchecked\b/.test(tag);
            return {
                id: id ? id[1] : '',
                value: value ? value[1] : '',
                checked
            };
        }).filter(Boolean);
    }

    setPointerCapture() {}

    releasePointerCapture() {}

    click() {
        if (this.listeners.click) {
            this.listeners.click({ target: this });
        }
    }
}

function createDocument(initialIds = []) {
    const elements = new Map();
    initialIds.forEach(id => elements.set(id, new MockElement({ id })));

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
        },
        querySelectorAll() {
            return [];
        }
    };
}

function loadWaterScript(options = {}) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'water-refactored-v2.js'), 'utf8');
    const document = createDocument([
        'import-water-file',
        'drink-scroll',
        'quick-setup-modal',
        'quick-setup-total',
        'quick-setup-elec',
        'quick-setup-elec-enabled',
        'quick-setup-default-vol',
        'quick-setup-drinks',
        'halo-ring',
        'center-total',
        'center-goal',
        'metric-elec',
        'halo-data-strip',
        'subheader-date',
        'btn-next-day',
        'water-dash-bg',
        'water-list',
        'input-vol-custom',
        'edit-water-modal',
        'edit-water-time',
        'edit-water-amount'
    ]);
    const prefs = new Map();
    const records = new Map((options.records || []).map(record => [String(record.id), { ...record }]));
    const savedRecords = [];
    const toasts = [];
    const promptResponses = [...(options.promptResponses || [])];
    const sandbox = {
        console: {
            log() {},
            warn() {},
            error() {}
        },
        document,
        window: {},
        localStorage: {
            getItem() {
                return null;
            },
            setItem() {}
        },
        ChuMeComponents: {
            CalendarComponent: class CalendarComponent {},
            ModalManager: {
                show() {},
                hide() {}
            }
        },
        getPref(key) {
            return prefs.has(key) ? prefs.get(key) : null;
        },
        savePref(key, value) {
            prefs.set(key, value);
            return true;
        },
        getCurrentDateString() {
            return '2026-05-07';
        },
        getDateStr() {
            return '2026-05-07';
        },
        getDataByIndex(store, index, value) {
            return Promise.resolve(Array.from(records.values()).filter(record => record[index] === value));
        },
        getAllData() {
            return Promise.resolve([]);
        },
        saveData(store, record) {
            records.set(String(record.id), { ...record });
            savedRecords.push({ ...record });
            return Promise.resolve();
        },
        deleteData() {
            return Promise.resolve();
        },
        getData(store, id) {
            return Promise.resolve(records.get(String(id)) || null);
        },
        generateId() {
            return '1';
        },
        formatTime() {
            return '10:00';
        },
        showToast(message, type) {
            toasts.push({ message, type });
        },
        prompt() {
            return promptResponses.shift();
        },
        confirm() {
            return true;
        },
        setTimeout(fn) {
            fn();
            return 0;
        },
        FileReader: class FileReader {}
    };

    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'water-refactored-v2.js' });
    return { ...sandbox, prefs, records, savedRecords, toasts };
}

function loadSettingsScript({ search = '' } = {}) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'settings.js'), 'utf8');
    const document = createDocument([
        'nickname-input',
        'gender-input',
        'btn-gender-1',
        'btn-gender-2',
        'height-input',
        'import-file',
        'set-goal-total',
        'set-goal-elec',
        'set-default-vol'
    ]);
    const prefs = new Map([
        ['goal_total', 1800],
        ['goal_elec', 600],
        ['default_vol', 300]
    ]);
    const listeners = {};
    const sandbox = {
        console,
        document,
        window: {
            location: {
                search,
                href: '',
                reload() {}
            },
            addEventListener(type, handler) {
                listeners[type] = handler;
            }
        },
        localStorage: {
            getItem() {
                return null;
            },
            setItem() {},
            clear() {},
            key() {
                return null;
            },
            get length() {
                return 0;
            }
        },
        getPref(key) {
            return prefs.has(key) ? prefs.get(key) : null;
        },
        savePref(key, value) {
            prefs.set(key, value);
            return true;
        },
        showToast() {},
        setTimeout(fn) {
            fn();
            return 0;
        },
        confirm() {
            return true;
        },
        factoryReset: async () => {},
        FileReader: class FileReader {},
        URL: {
            createObjectURL() {
                return 'blob:mock';
            },
            revokeObjectURL() {}
        },
        Blob: class Blob {}
    };

    sandbox.URLSearchParams = URLSearchParams;
    sandbox.window.window = sandbox.window;
    sandbox.window.document = document;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'settings.js' });

    return { sandbox, document, prefs, listeners };
}

function loadWaterSettingsScript(initialPrefs) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'water-settings.js'), 'utf8');
    const document = createDocument([
        'set-goal-total',
        'set-goal-elec',
        'set-goal-elec-enabled',
        'set-default-vol',
        'water-settings-drinks'
    ]);
    const prefs = new Map(initialPrefs || [
        ['goal_total', 1800],
        ['goal_elec', 600],
        ['goal_elec_enabled', true],
        ['default_vol', 300]
    ]);
    const listeners = {};
    const sandbox = {
        console,
        document,
        window: {
            location: {
                href: ''
            },
            addEventListener(type, handler) {
                listeners[type] = handler;
            }
        },
        getPref(key) {
            return prefs.has(key) ? prefs.get(key) : null;
        },
        savePref(key, value) {
            prefs.set(key, value);
            return true;
        },
        showToast() {},
        setTimeout(fn) {
            fn();
            return 0;
        }
    };

    sandbox.window.window = sandbox.window;
    sandbox.window.document = document;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'water-settings.js' });

    return { sandbox, document, prefs, listeners };
}

(() => {
    const { waterApp } = loadWaterScript();

    assert.equal(
        typeof waterApp.sortWaterRecordsForDisplay,
        'function',
        'water module should expose a display-only water record sorter'
    );

    const source = [
        { id: '1000', time: '08:30', type: '白开水', amount: 250 },
        { id: '3000', time: '09:10', type: '茶', amount: 300 },
        { id: '2000', time: '09:10', type: '柠檬水', amount: 200 },
        { id: '4000', time: '补录', type: '淡盐水', amount: 100 },
        { id: '5000', time: '补录', type: '电解质', amount: 100 }
    ];

    const sorted = waterApp.sortWaterRecordsForDisplay(source);

    assert.deepEqual(
        Array.from(sorted, record => record.type),
        ['茶', '柠檬水', '白开水', '电解质', '淡盐水'],
        'records should render newest time first and keep later-added same-time items above earlier ones'
    );
    assert.deepEqual(
        Array.from(source, record => record.type),
        ['白开水', '茶', '柠檬水', '淡盐水', '电解质'],
        'display sorting should not mutate IndexedDB result order'
    );
})();

(() => {
    const { waterApp, document, prefs } = loadWaterScript();

    assert.deepEqual(
        Array.from(waterApp.getAllDrinkNames()),
        ['白开水', '黑咖啡', '电解质', '柠檬水', '淡盐水', '茶', '牛奶', '拿铁', 'MCT'],
        'water module should expose the full drink catalog including milk, latte, and MCT'
    );

    prefs.set('enabled_drinks', JSON.stringify(['牛奶', 'MCT']));
    waterApp.renderDrinkOptions();

    const html = document.getElementById('drink-scroll').innerHTML;
    assert.match(html, /牛奶/);
    assert.match(html, /MCT/);
    assert.doesNotMatch(html, /白开水/);
    assert.doesNotMatch(html, /拿铁/);
})();

(() => {
    const { waterApp, prefs } = loadWaterScript();

    prefs.set('enabled_drinks', JSON.stringify([]));

    assert.deepEqual(
        Array.from(waterApp.getEnabledDrinkNames()),
        ['白开水'],
        'water page should keep at least plain water enabled when every drink is turned off'
    );
})();

(() => {
    const waterHtml = fs.readFileSync(path.join(__dirname, '..', 'water.html'), 'utf8');

    assert.match(
        waterHtml,
        /href="water-settings\.html"/,
        'water page should have a top-right settings link to the dedicated water settings page'
    );
    assert.doesNotMatch(
        waterHtml,
        /settings\.html\?from=water/,
        'water page should not route water goals through system settings'
    );
    assert.doesNotMatch(
        waterHtml,
        />\s*目标设置\s*</,
        'water page should not render the inline goal settings panel'
    );
    assert.match(
        waterHtml,
        /id="drink-scroll"[^>]*overflow-x-auto/,
        'drink options should be arranged in a horizontally scrollable row with a stable hook'
    );
    assert.match(
        waterHtml,
        /id="drink-scroll"[^>]*touch-pan-x/,
        'drink options should opt into horizontal touch panning'
    );
    assert.doesNotMatch(
        waterHtml,
        /waterApp\.addWater\('白开水'/,
        'water page should render drink cards from the drink catalog instead of hard-coding cards'
    );
    assert.match(
        waterHtml,
        /id="quick-setup-modal"/,
        'water page should include a first-visit quick setup modal'
    );
    assert.match(
        waterHtml,
        /id="quick-setup-elec-enabled"/,
        'quick setup should include an electrolyte enable switch'
    );
    assert.match(
        waterHtml,
        /id="quick-setup-drinks"/,
        'quick setup should include configurable default drink switches'
    );
})();

(() => {
    const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'settings.html'), 'utf8');

    assert.doesNotMatch(settingsHtml, /id="set-goal-total"/, 'system settings should not include total water goal input');
    assert.doesNotMatch(settingsHtml, /id="set-goal-elec"/, 'system settings should not include electrolyte goal input');
    assert.doesNotMatch(settingsHtml, /id="set-default-vol"/, 'system settings should not include default volume input');
})();

(() => {
    const waterSettingsHtml = fs.readFileSync(path.join(__dirname, '..', 'water-settings.html'), 'utf8');

    assert.match(waterSettingsHtml, /<title>喝水设置<\/title>/, 'water settings page should have its own page title');
    assert.match(waterSettingsHtml, /id="set-goal-total"/, 'water settings page should include total water goal input');
    assert.match(waterSettingsHtml, /id="set-goal-elec"/, 'water settings page should include electrolyte goal input');
    assert.match(waterSettingsHtml, /id="set-goal-elec-enabled"/, 'water settings page should include electrolyte enable switch');
    assert.match(waterSettingsHtml, /id="set-default-vol"/, 'water settings page should include default volume input');
    assert.match(waterSettingsHtml, /id="water-settings-drinks"/, 'water settings page should include configurable default drink switches');
    assert.match(waterSettingsHtml, /water-settings\.js/, 'water settings page should load dedicated settings logic');
})();

(() => {
    const { sandbox, document, prefs, listeners } = loadWaterSettingsScript();
    assert.equal(typeof listeners.load, 'function', 'water settings page should register a load handler');

    listeners.load();

    assert.equal(document.getElementById('set-goal-total').value, '1800');
    assert.equal(document.getElementById('set-goal-elec').value, '600');
    assert.equal(document.getElementById('set-goal-elec-enabled').checked, true);
    assert.equal(document.getElementById('set-default-vol').value, '300');
    assert.match(document.getElementById('water-settings-drinks').innerHTML, /牛奶/);

    document.getElementById('set-goal-total').value = '2200';
    document.getElementById('set-goal-elec-enabled').checked = false;
    document.getElementById('set-goal-elec').value = '';
    document.getElementById('set-default-vol').value = '350';
    document.getElementById('water-settings-drinks').innerHTML = `
        <input class="drink-toggle" value="白开水" checked>
        <input class="drink-toggle" value="牛奶" checked>
        <input class="drink-toggle" value="MCT">
    `;
    sandbox.saveWaterSettings();

    assert.equal(prefs.get('goal_total'), 2200);
    assert.equal(prefs.get('goal_elec_enabled'), false);
    assert.equal(prefs.get('goal_elec'), '');
    assert.equal(prefs.get('default_vol'), 350);
    assert.equal(prefs.get('enabled_drinks'), JSON.stringify(['白开水', '牛奶']));
    assert.equal(sandbox.window.location.href, 'water.html', 'water settings should return to water page after saving');
})();

(() => {
    const { sandbox, document, prefs, listeners } = loadWaterSettingsScript(new Map());
    listeners.load();

    assert.equal(document.getElementById('set-goal-total').value, '2500');
    assert.equal(document.getElementById('set-goal-elec').value, '500');
    assert.equal(document.getElementById('set-goal-elec-enabled').checked, false);
    assert.equal(document.getElementById('set-goal-elec').disabled, true);
    assert.equal(document.getElementById('set-default-vol').value, '300');

    document.getElementById('set-goal-elec-enabled').checked = true;
    sandbox.syncWaterElectrolyteToggle();
    sandbox.saveWaterSettings();

    assert.equal(prefs.get('goal_total'), 2500);
    assert.equal(prefs.get('goal_elec_enabled'), true);
    assert.equal(prefs.get('goal_elec'), 500);
    assert.equal(prefs.get('default_vol'), 300);
})();

(() => {
    const { document, listeners } = loadWaterSettingsScript(new Map([
        ['goal_total', 2000],
        ['goal_elec', 450],
        ['default_vol', 280]
    ]));
    listeners.load();

    assert.equal(
        document.getElementById('set-goal-elec-enabled').checked,
        true,
        'legacy electrolyte goal should keep electrolyte tracking enabled'
    );
    assert.equal(document.getElementById('set-goal-elec').disabled, false);
})();

(() => {
    const { waterApp, document, prefs } = loadWaterScript();
    assert.equal(typeof waterApp.showQuickSetupIfNeeded, 'function');
    assert.equal(typeof waterApp.saveQuickSetup, 'function');

    waterApp.showQuickSetupIfNeeded();

    assert.equal(document.getElementById('quick-setup-modal').classList.contains('hidden'), false);
    assert.equal(document.getElementById('quick-setup-total').value, '2500');
    assert.equal(document.getElementById('quick-setup-default-vol').value, '300');
    assert.equal(document.getElementById('quick-setup-elec').value, '500');
    assert.equal(document.getElementById('quick-setup-elec-enabled').checked, false);
    assert.equal(document.getElementById('quick-setup-elec').disabled, true);
    assert.match(document.getElementById('quick-setup-drinks').innerHTML, /拿铁/);

    document.getElementById('quick-setup-elec-enabled').checked = true;
    waterApp.syncQuickSetupElectrolyteToggle();
    document.getElementById('quick-setup-total').value = '2600';
    document.getElementById('quick-setup-default-vol').value = '320';
    document.getElementById('quick-setup-elec').value = '550';
    document.getElementById('quick-setup-drinks').innerHTML = `
        <input class="drink-toggle" value="黑咖啡" checked>
        <input class="drink-toggle" value="拿铁" checked>
    `;
    waterApp.saveQuickSetup();

    assert.equal(prefs.get('goal_total'), 2600);
    assert.equal(prefs.get('default_vol'), 320);
    assert.equal(prefs.get('goal_elec_enabled'), true);
    assert.equal(prefs.get('goal_elec'), 550);
    assert.equal(prefs.get('enabled_drinks'), JSON.stringify(['黑咖啡', '拿铁']));
    assert.equal(prefs.get('water_quick_setup_done'), true);
    assert.equal(document.getElementById('quick-setup-modal').classList.contains('hidden'), true);
})();

(() => {
    const { waterApp, document, savedRecords } = loadWaterScript({
        records: [{ id: 'w1', date: '2026-05-07', time: '09:10', type: '茶', amount: 300, isElec: false }],
    });

    waterApp.editWater('w1');

    Promise.resolve().then(() => {
        assert.equal(document.getElementById('edit-water-modal').classList.contains('hidden'), false);
        assert.equal(document.getElementById('edit-water-time').value, '09:10');
        assert.equal(document.getElementById('edit-water-amount').value, '300');

        document.getElementById('edit-water-time').value = '14:25';
        document.getElementById('edit-water-amount').value = '450';
        waterApp.saveWaterEdit();
    }).then(() => Promise.resolve()).then(() => {
        assert.equal(savedRecords.length, 1);
        assert.equal(savedRecords[0].time, '14:25');
        assert.equal(savedRecords[0].amount, 450);
        assert.equal(document.getElementById('edit-water-modal').classList.contains('hidden'), true);
    });
})();

(() => {
    const { waterApp, document, savedRecords, toasts } = loadWaterScript({
        records: [{ id: 'w2', date: '2026-05-07', time: '09:10', type: '茶', amount: 300, isElec: false }],
    });

    waterApp.editWater('w2');

    Promise.resolve().then(() => {
        document.getElementById('edit-water-time').value = '25:99';
        document.getElementById('edit-water-amount').value = '450';
        waterApp.saveWaterEdit();
    }).then(() => {
        assert.equal(savedRecords.length, 0);
        assert.equal(toasts.at(-1).type, 'error');
        assert.equal(document.getElementById('edit-water-modal').classList.contains('hidden'), false);
    });
})();

(() => {
    const waterHtml = fs.readFileSync(path.join(__dirname, '..', 'water.html'), 'utf8');

    assert.match(waterHtml, /id="edit-water-modal"/, 'water page should include a unified edit record modal');
    assert.match(waterHtml, /id="edit-water-time"/, 'edit modal should include a time input');
    assert.match(waterHtml, /id="edit-water-amount"/, 'edit modal should include an amount input');
})();

(() => {
    const waterJs = fs.readFileSync(path.join(__dirname, '..', 'water-refactored-v2.js'), 'utf8');

    assert.match(waterJs, /fa-(pen|pencil)/, 'record edit button should use a pencil icon');
    assert.match(waterJs, /fa-trash/, 'record delete button should use a trash icon');
    assert.doesNotMatch(waterJs, />改<\/button>/, 'record edit button should not use text label');
    assert.doesNotMatch(waterJs, />删<\/button>/, 'record delete button should not use text label');
    assert.doesNotMatch(
        waterJs,
        /text-\[9px\][\s\S]{0,120}truncate/,
        'halo amount and percentage line should not truncate on mobile'
    );
})();

(() => {
    const { waterApp, document } = loadWaterScript();

    assert.equal(
        typeof waterApp.initDrinkScroll,
        'function',
        'water module should expose desktop drag scrolling initializer for drink row'
    );

    const scroller = document.getElementById('drink-scroll');
    waterApp.initDrinkScroll();
    scroller.scrollLeft = 20;
    scroller.listeners.pointerdown({
        pointerType: 'mouse',
        button: 0,
        clientX: 120,
        pointerId: 1
    });
    scroller.listeners.pointermove({
        clientX: 80
    });
    scroller.listeners.pointerup({
        pointerId: 1
    });

    assert.equal(scroller.scrollLeft, 60, 'dragging left should scroll the drink row to the right on desktop');
})();

(() => {
    const { waterApp, document } = loadWaterScript();
    const scroller = document.getElementById('drink-scroll');
    waterApp.initDrinkScroll();

    scroller.listeners.pointerdown({
        pointerType: 'touch',
        clientX: 120,
        pointerId: 2
    });
    scroller.listeners.pointermove({
        clientX: 113
    });
    scroller.listeners.pointerup({
        pointerId: 2
    });

    let prevented = false;
    let stopped = false;
    scroller.listeners.click({
        preventDefault() {
            prevented = true;
        },
        stopPropagation() {
            stopped = true;
        }
    });

    assert.equal(prevented, false, 'touch taps on drink cards should not be blocked by drag suppression');
    assert.equal(stopped, false, 'touch taps on drink cards should still reach the inline addWater handler');
})();

console.log('water module test passed');
