const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MockClassList {
    add() {}
    remove() {}
    contains() {
        return false;
    }
}

class MockElement {
    constructor({ id = '', tagName = 'div' } = {}) {
        this.id = id;
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.className = '';
        this.classList = new MockClassList();
        this.parentElement = null;
        this.textContent = '';
        this._innerHTML = '';
        this.value = '';
        this.disabled = false;
        this.title = '';
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(value) {
        this._innerHTML = String(value);
        this.children = [];
    }

    appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name)
            ? this.attributes[name]
            : null;
    }

    addEventListener(type, handler) {
        this.listeners[type] = handler;
    }

    querySelectorAll(selector) {
        const results = [];

        function visit(node) {
            if (!(node instanceof MockElement)) return;

            if (selector === '[data-delete-id]' && node.getAttribute('data-delete-id') !== null) {
                results.push(node);
            }

            node.children.forEach(visit);
        }

        this.children.forEach(visit);
        return results;
    }
}

function createDocument() {
    const elements = new Map();
    const ids = [
        'ai-count-file',
        'btn-upload',
        'preview-container',
        'preview-canvas',
        'history-card',
        'history-list',
        'bottom-console',
        'round-count',
        'total-count',
        'btn-next-round',
        'btn-done',
        'fullscreen-mark-modal',
        'fullscreen-canvas',
        'fullscreen-count',
        'btn-finish-mark'
    ];

    ids.forEach(id => elements.set(id, new MockElement({ id })));
    elements.get('btn-upload').parentElement = new MockElement({ id: 'upload-area' });

    return {
        body: new MockElement({ id: 'body', tagName: 'body' }),
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, new MockElement({ id }));
            }
            return elements.get(id);
        },
        createElement(tagName) {
            return new MockElement({ tagName });
        }
    };
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
        }
    };
}

function loadAiCounter(localStorage, document) {
    const aiCounterPath = path.join(__dirname, '..', 'ai-counter.js');
    const code = fs.readFileSync(aiCounterPath, 'utf8');

    const sandbox = {
        console,
        localStorage,
        document,
        window: {},
        confirm: () => true,
        showToast() {}
    };

    sandbox.window = sandbox;
    sandbox.window.addEventListener = () => {};

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'ai-counter.js' });
    return sandbox;
}

(function run() {
    const payload = [
        {
            id: '" onclick="alert(1)',
            date: '<img src=x onerror=alert(1)>',
            time: '<svg/onload=alert(2)>',
            rounds: ['<b>1</b>', '2'],
            totalRounds: 2,
            finalCount: 3
        }
    ];

    const localStorage = createLocalStorage({
        chume_ai_counter_history: JSON.stringify(payload)
    });
    const document = createDocument();
    const sandbox = loadAiCounter(localStorage, document);

    assert.equal(typeof sandbox.renderHistory, 'function', 'expected renderHistory helper');

    sandbox.renderHistory();

    const historyList = document.getElementById('history-list');
    assert.equal(
        historyList.innerHTML.includes('<img'),
        false,
        'history render should not inject raw HTML from storage into innerHTML'
    );
    assert.equal(historyList.children.length > 0, true, 'history render should build DOM nodes for records');
    assert.equal(
        historyList.querySelectorAll('[data-delete-id]').length,
        1,
        'history render should keep delete actions when using safe DOM construction'
    );

    console.log('ai-counter history sanitization test passed');
})();
