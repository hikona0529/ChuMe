const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCalendarComponent() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'components.js'), 'utf8');
    const sandbox = {
        console,
        window: {}
    };

    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'components.js' });
    return sandbox.ChuMeComponents.CalendarComponent;
}

const CalendarComponent = loadCalendarComponent();

(() => {
    const calendar = new CalendarComponent({
        renderDayContent(dateStr, context) {
            if (dateStr === '2026-05-06') {
                return `<span class="custom-marker">${context.day}</span>`;
            }
            return '';
        }
    });

    calendar.selectedDate = '2026-05-06';
    const html = calendar.generateCalendarHTML(2026, 4, {});

    assert.ok(
        html.includes('<span class="custom-marker">6</span>'),
        'CalendarComponent should render custom full-page day content'
    );
})();

(() => {
    const calendar = new CalendarComponent({
        markLogic(dateStr) {
            if (dateStr === '2026-05-06') {
                return {
                    symbol: '✓',
                    colorClass: 'text-green-500',
                    sizeStyle: 'text-xs'
                };
            }
            return null;
        }
    });

    calendar.selectedDate = '2026-05-06';
    const html = calendar.generateCalendarHTML(2026, 4, {});

    assert.ok(
        html.includes('text-green-500') && html.includes('✓'),
        'CalendarComponent should preserve legacy markLogic markers'
    );
})();

(() => {
    let selected = null;
    const calendar = new CalendarComponent({
        mode: 'full',
        onSelect(dateStr) {
            selected = dateStr;
        }
    });

    assert.doesNotThrow(() => {
        calendar.selectDate('2026-05-06', { dataset: { date: '2026-05-06' } });
    }, 'Full-page calendar selection should delegate to page render without compact DOM class updates');
    assert.equal(selected, '2026-05-06');
    assert.equal(calendar.selectedDate, '2026-05-06');
})();

console.log('components calendar rendering test passed');
