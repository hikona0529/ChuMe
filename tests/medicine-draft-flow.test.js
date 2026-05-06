const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class ClassList {
    constructor(initial = []) {
        this.classes = new Set(initial);
    }

    add(...names) {
        names.filter(Boolean).forEach(name => this.classes.add(name));
    }

    remove(...names) {
        names.filter(Boolean).forEach(name => this.classes.delete(name));
    }

    contains(name) {
        return this.classes.has(name);
    }
}

class MockElement {
    constructor({ id = '', tagName = 'div', textContent = '', value = '', dataset = {}, classes = [] } = {}) {
        this.id = id;
        this.tagName = tagName.toUpperCase();
        this.textContent = textContent;
        this.innerText = textContent;
        this.value = value;
        this.dataset = { ...dataset };
        this.className = '';
        this.classList = new ClassList(classes);
        this.children = [];
        this.listeners = {};
        this.style = {};
        this.parentElement = null;
        this.attributes = {};
        this._innerHTML = '';
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(value) {
        this._innerHTML = String(value);
        this.children = [];
    }

    addEventListener(type, handler) {
        this.listeners[type] = handler;
    }

    appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }

    remove() {
        if (!this.parentElement) return;
        this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        this.parentElement = null;
    }

    click() {
        if (this.listeners.click) {
            this.listeners.click({ target: this, preventDefault() {}, stopPropagation() {} });
        }
        if (typeof this.onclick === 'function') {
            this.onclick({ target: this, preventDefault() {}, stopPropagation() {} });
        }
    }

    focus() {}

    scrollIntoView() {}

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name)
            ? this.attributes[name]
            : null;
    }

    querySelector(selector) {
        if (selector === 'span' && this._spanChild) {
            return this._spanChild;
        }

        if (selector.startsWith('.')) {
            const className = selector.slice(1);
            return this.children.find(child => child.className.split(' ').includes(className)) || null;
        }

        return null;
    }

    querySelectorAll(selector) {
        if (!selector.startsWith('.')) return [];
        const className = selector.slice(1);
        return this.children.filter(child => child.className.split(' ').includes(className));
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
        dump() {
            return Object.fromEntries(store.entries());
        }
    };
}

function createDocument() {
    const elements = new Map();
    const ids = [
        'search-input',
        'global-actions',
        'global-actions-active',
        'btn-mode-done',
        'btn-delete',
        'form-backdrop',
        'form-sheet',
        'btn-close-form',
        'medicine-form',
        'field-id',
        'field-name',
        'field-brand',
        'tab-manual',
        'tab-history',
        'tab-btn-manual',
        'tab-btn-history',
        'btn-save',
        'calc-header',
        'calc-body',
        'calc-icon',
        'field-produceDate-display',
        'field-customShelfLife',
        'field-expireDate-display',
        'field-capacity',
        'field-stock',
        'field-purchaseDate-display',
        'field-openDate-display',
        'field-unit-custom',
        'ingredients-container',
        'ai-count-modal',
        'ai-count-value',
        'btn-fill-capacity',
        'btn-fill-stock',
        'btn-ai-counter',
        'form-title',
        'med-board',
        'btn-mode-cancel',
        'btn-mode-add',
        'btn-mode-manage',
        'btn-mode-delete'
    ];

    ids.forEach(id => elements.set(id, new MockElement({ id })));

    elements.get('global-actions-active').classList.add('hidden');
    elements.get('form-backdrop').classList.add('backdrop-hidden');
    elements.get('form-sheet').classList.add('sheet-hidden');
    elements.get('tab-history').classList.add('hidden');
    elements.get('calc-body').classList.add('hidden');
    elements.get('ai-count-modal').classList.add('hidden');

    const tabContainer = new MockElement({ id: 'tab-container' });
    elements.get('tab-btn-manual').parentElement = tabContainer;
    elements.get('tab-btn-history').parentElement = tabContainer;

    const calcHeaderSpan = new MockElement({ tagName: 'span', textContent: '保质期计算器 (点我展开)' });
    elements.get('calc-header')._spanChild = calcHeaderSpan;

    const unitChips = ['粒', '片', '克', '包', '条'].map(text => {
        const el = new MockElement({ tagName: 'button', textContent: text });
        el.className = 'unit-chip';
        return el;
    });

    const shelfLifeChips = ['12', '18', '24', '36'].map(months => {
        const el = new MockElement({ tagName: 'button', textContent: months + '个月', dataset: { months } });
        el.className = 'shelf-life-chip';
        return el;
    });

    const document = {
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, new MockElement({ id }));
            }
            return elements.get(id);
        },
        querySelectorAll(selector) {
            if (selector === '.unit-chip') return unitChips;
            if (selector === '.shelf-life-chip') return shelfLifeChips;
            if (selector === '.ingredient-row') {
                return elements.get('ingredients-container').children.filter(child => child.className.includes('ingredient-row'));
            }
            return [];
        },
        createElement(tagName) {
            return new MockElement({ tagName });
        }
    };

    return { document, elements };
}

let activeDocument = null;

class MockChipSelector {
    constructor({ chipSelector, onSelect, onDeselect }) {
        this.chips = activeDocument.querySelectorAll(chipSelector);
        this.onSelect = onSelect || function() {};
        this.onDeselect = onDeselect || function() {};
        this.selectedElement = null;
    }

    deselectAll() {
        this.selectedElement = null;
        this.onDeselect();
    }

    select(value) {
        const chip = this.chips.find(item => item.textContent === value || item.dataset.months === String(value));
        if (!chip) return;
        this.selectedElement = chip;
        this.onSelect(chip, value);
    }

    getSelectedValue() {
        return this.selectedElement ? this.selectedElement.textContent : '';
    }

    getSelectedElement() {
        return this.selectedElement;
    }
}

function runMedicineScript({ localStorage, search = '', confirmQueue = [], inventory = [] }) {
    localStorage.setItem('med_inventory', JSON.stringify(inventory));

    const { document } = createDocument();
    const prompts = [];
    const toasts = [];
    const historyCalls = [];

    const scriptPath = path.join(__dirname, '..', 'medicine-refactored.js');
    const code = fs.readFileSync(scriptPath, 'utf8');

    const sandbox = {
        console,
        document,
        localStorage,
        window: {},
        history: {
            replaceState(...args) {
                historyCalls.push(args);
            }
        },
        location: {
            search,
            pathname: '/medicine.html',
            href: 'medicine.html'
        },
        URLSearchParams,
        Event: class Event {
            constructor(type) {
                this.type = type;
            }
        },
        setTimeout(fn) {
            fn();
            return 0;
        },
        requestAnimationFrame(fn) {
            fn();
            return 0;
        },
        confirm(message) {
            prompts.push(message);
            return confirmQueue.length ? confirmQueue.shift() : true;
        },
        alert() {},
        showToast(message, type) {
            toasts.push({ message, type });
        },
        getCurrentDateString() {
            return '2026-03-28';
        },
        ChuMeComponents: {
            ChipSelector: MockChipSelector
        }
    };

    sandbox.window = sandbox;
    sandbox.window.location = sandbox.location;
    sandbox.window.history = sandbox.history;
    activeDocument = document;

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'medicine-refactored.js' });

    return { sandbox, document, prompts, toasts, historyCalls };
}

function getDraftFromStorage(localStorage, key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
}

(function run() {
    const NEW_DRAFT_KEY = 'chume_medicine_draft_new';
    const EDIT_DRAFT_KEY = 'chume_medicine_draft_edit_med-1';
    const RESUME_KEY = 'chume_medicine_draft_resume_key';

    {
        const storage = createLocalStorage();
        const session = runMedicineScript({
            localStorage: storage,
            confirmQueue: [true, true],
            inventory: []
        });

        session.document.getElementById('btn-mode-add').click();
        session.document.getElementById('field-name').value = '维生素C';
        session.document.getElementById('field-brand').value = 'Swisse';
        session.document.getElementById('field-capacity').value = '120';
        session.document.getElementById('field-stock').value = '100';
        session.document.getElementById('field-unit-custom').value = '片';
        session.document.getElementById('field-expireDate-display').value = '2026/12/31';

        session.document.getElementById('btn-close-form').click();

        const savedDraft = getDraftFromStorage(storage, NEW_DRAFT_KEY);
        assert.ok(savedDraft, 'closing a dirty create form should save a draft when user confirms');
        assert.equal(savedDraft.name, '维生素C', 'saved create draft should keep entered name');

        session.document.getElementById('btn-mode-add').click();
        assert.equal(
            session.document.getElementById('field-name').value,
            '维生素C',
            'reopening create form should restore the saved draft when user agrees'
        );
    }

    {
        const storage = createLocalStorage();
        const inventory = [
            {
                id: 'med-1',
                name: '原始药品',
                brand: '旧品牌',
                capacity: 60,
                stock: 40,
                unit: '片',
                purchaseDate: '2026-01-01',
                openDate: '',
                produceDate: '2025-12-01',
                expireDate: '2026-12-01',
                ingredients: []
            }
        ];

        const firstSession = runMedicineScript({
            localStorage: storage,
            inventory
        });

        firstSession.sandbox.editSheet('med-1');
        firstSession.document.getElementById('field-name').value = '编辑中的药品';
        firstSession.document.getElementById('field-brand').value = '新品牌';
        firstSession.document.getElementById('field-stock').value = '33';
        firstSession.document.getElementById('btn-ai-counter').click();

        const editDraft = getDraftFromStorage(storage, EDIT_DRAFT_KEY);
        assert.ok(editDraft, 'jumping to ai-counter should auto-save the current edit draft');
        assert.equal(storage.getItem(RESUME_KEY), EDIT_DRAFT_KEY, 'ai-counter jump should remember which draft to resume');
        assert.equal(
            firstSession.sandbox.location.href,
            'ai-counter.html?source=medicine',
            'ai-counter button should still navigate away with medicine source context'
        );

        const secondSession = runMedicineScript({
            localStorage: storage,
            search: '?ai_count=88',
            inventory
        });

        assert.equal(
            secondSession.document.getElementById('form-title').textContent,
            '编辑药品',
            'returning from ai-counter should reopen the previous edit form, not a blank create form'
        );
        assert.equal(
            secondSession.document.getElementById('field-name').value,
            '编辑中的药品',
            'returning from ai-counter should restore unsaved edit fields'
        );
        assert.equal(
            secondSession.document.getElementById('ai-count-modal').classList.contains('hidden'),
            false,
            'returning from ai-counter should still present the count target modal'
        );

        secondSession.document.getElementById('btn-fill-stock').click();
        assert.equal(
            secondSession.document.getElementById('field-stock').value,
            '88',
            'choosing current stock should fill the ai-count result into the restored form'
        );
        assert.equal(
            secondSession.document.getElementById('field-brand').value,
            '新品牌',
            'ai-count result fill should preserve the rest of the restored draft'
        );
    }

    console.log('medicine draft flow test passed');
})();
