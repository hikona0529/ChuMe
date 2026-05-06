const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class ClassList {
    constructor() {
        this.classes = new Set();
    }

    add(...names) {
        names.filter(Boolean).forEach(name => this.classes.add(name));
    }

    remove(...names) {
        names.filter(Boolean).forEach(name => this.classes.delete(name));
    }

    replace(oldName, newName) {
        this.remove(oldName);
        if (newName) this.add(newName);
    }

    contains(name) {
        return this.classes.has(name);
    }
}

class MockElement {
    constructor({ id = '', dataset = {}, value = '' } = {}) {
        this.id = id;
        this.dataset = { ...dataset };
        this.value = value;
        this.innerHTML = '';
        this.innerText = '';
        this.textContent = '';
        this.className = '';
        this.classList = new ClassList();
        this.children = [];
        this.listeners = {};
        this.style = {};
        this.options = [];
        this.selectedIndex = 0;
    }

    addEventListener(type, handler) {
        this.listeners[type] = handler;
    }

    appendChild(child) {
        this.children.push(child);
        if (this.id === 'rule-med-select') {
            this.options.push(child);
        }
        return child;
    }

    dispatchEvent() {
        return true;
    }
}

function createDocument() {
    const elements = new Map();

    const ids = [
        'reminder-list',
        'header-date',
        'btn-add-rule',
        'form-backdrop',
        'form-sheet',
        'btn-close-form',
        'form-title',
        'btn-save-rule',
        'btn-delete-entire-rule',
        'rule-form',
        'rule-id',
        'rule-med-select',
        'rule-dose',
        'rule-dose-unit',
        'btn-everyday',
        'rule-start',
        'rule-end',
        'out-of-stock-modal',
        'out-of-stock-title',
        'btn-goto-add-med',
        'btn-goto-change-rule',
        'btn-close-stock-modal',
        'out-of-stock-backdrop',
        'out-of-stock-card'
    ];

    ids.forEach(id => elements.set(id, new MockElement({ id })));

    elements.get('rule-form').checkValidity = () => true;
    elements.get('rule-form').reportValidity = () => true;

    const boardTabs = ['早', '中', '晚', '睡前'].map(period => new MockElement({ dataset: { period } }));

    return {
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, new MockElement({ id }));
            }
            return elements.get(id);
        },
        querySelectorAll(selector) {
            if (selector === '.board-tab-btn') return boardTabs;
            return [];
        },
        createElement(tagName) {
            return new MockElement({ id: tagName });
        }
    };
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
        removeItem(key) {
            store.delete(key);
        }
    };
}

function createFixedDate(isoString) {
    const RealDate = Date;
    const fixed = new RealDate(isoString);

    return class FakeDate extends RealDate {
        constructor(...args) {
            if (args.length === 0) {
                super(fixed.getTime());
                return;
            }
            super(...args);
        }

        static now() {
            return fixed.getTime();
        }
    };
}

function runReminderScript({ rules, inventory, today }) {
    const document = createDocument();
    const scriptPath = path.join(__dirname, '..', 'med-reminders-refactored.js');
    const code = fs.readFileSync(scriptPath, 'utf8');

    const sandbox = {
        console,
        document,
        localStorage: createLocalStorage({
            med_rules: JSON.stringify(rules),
            med_inventory: JSON.stringify(inventory),
            med_logs: JSON.stringify([])
        }),
        window: {},
        alert: () => {},
        confirm: () => true,
        requestAnimationFrame: cb => cb(),
        setTimeout: cb => cb(),
        getCurrentDateString: () => today.slice(0, 10),
        Date: createFixedDate(today),
        Event: class Event {
            constructor(type) {
                this.type = type;
            }
        }
    };

    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'med-reminders-refactored.js' });

    return document.getElementById('reminder-list').innerHTML;
}

const html = runReminderScript({
    today: '2026-03-27T09:00:00+08:00',
    inventory: [
        { id: 'med-1', name: '维生素C', unit: '片', stock: 12 }
    ],
    rules: [
        {
            ruleId: 'rule-1',
            medId: 'med-1',
            dose: 1,
            weekdays: ['1'],
            period: ['早'],
            meal: ['餐后'],
            startDate: '2026-03-01',
            endDate: '2026-03-31'
        }
    ]
});

assert.ok(
    !html.includes('维生素C'),
    'Friday should not render a rule that only repeats on Monday'
);

console.log('med-reminders weekday filter test passed');
