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

function loadWaterScript() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'water-refactored-v2.js'), 'utf8');
    const document = createDocument(['import-water-file', 'drink-scroll']);
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
        getPref() {
            return null;
        },
        savePref() {},
        getCurrentDateString() {
            return '2026-05-07';
        },
        getDateStr() {
            return '2026-05-07';
        },
        getDataByIndex() {
            return Promise.resolve([]);
        },
        getAllData() {
            return Promise.resolve([]);
        },
        saveData() {
            return Promise.resolve();
        },
        deleteData() {
            return Promise.resolve();
        },
        getData() {
            return Promise.resolve(null);
        },
        generateId() {
            return '1';
        },
        formatTime() {
            return '10:00';
        },
        showToast() {},
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
    return sandbox;
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

function loadWaterSettingsScript() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'water-settings.js'), 'utf8');
    const document = createDocument([
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
        /Drink Grid[\s\S]*grid-cols-3/,
        'drink options should no longer use the fixed three-column grid'
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
    assert.match(waterSettingsHtml, /id="set-default-vol"/, 'water settings page should include default volume input');
    assert.match(waterSettingsHtml, /water-settings\.js/, 'water settings page should load dedicated settings logic');
})();

(() => {
    const { sandbox, document, prefs, listeners } = loadWaterSettingsScript();
    assert.equal(typeof listeners.load, 'function', 'water settings page should register a load handler');

    listeners.load();

    assert.equal(document.getElementById('set-goal-total').value, '1800');
    assert.equal(document.getElementById('set-goal-elec').value, '600');
    assert.equal(document.getElementById('set-default-vol').value, '300');

    document.getElementById('set-goal-total').value = '2200';
    document.getElementById('set-goal-elec').value = '';
    document.getElementById('set-default-vol').value = '350';
    sandbox.saveWaterSettings();

    assert.equal(prefs.get('goal_total'), 2200);
    assert.equal(prefs.get('goal_elec'), '');
    assert.equal(prefs.get('default_vol'), 350);
    assert.equal(sandbox.window.location.href, 'water.html', 'water settings should return to water page after saving');
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
