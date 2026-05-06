const assert = require('node:assert/strict');
const path = require('node:path');

const {
    addScheduleToData,
    deleteScheduleFromData,
    setMemoForDate,
    getBodySummaryForDate,
    getDefaultColorLabels,
    normalizeColorLabels,
    getPeriodStatus,
    setPeriodEntry,
    shouldHandleContainerDateClick,
    resolveDayClass
} = require(path.join(__dirname, '..', 'calendar.js'));

function findDay(data, date) {
    return data[date] || { schedules: [], memo: '' };
}

(() => {
    const emptyStatus = getPeriodStatus([], '2026-05-06');
    assert.equal(emptyStatus.kind, 'empty');

    const noEndStatus = getPeriodStatus([{ date: '2026-05-01', type: 'start' }], '2026-05-03');
    assert.equal(noEndStatus.kind, 'period');
    assert.equal(noEndStatus.dayCount, 3);

    const endStatus = getPeriodStatus([
        { date: '2026-05-01', type: 'start' },
        { date: '2026-05-06', type: 'end' }
    ], '2026-05-06');
    assert.equal(endStatus.kind, 'ended');
    assert.equal(endStatus.duration, 6);

    const follicular = getPeriodStatus([
        { date: '2026-05-01', type: 'start' },
        { date: '2026-05-06', type: 'end' }
    ], '2026-05-10');
    assert.equal(follicular.kind, 'phase');
    assert.equal(follicular.phase, 'follicular');

    const ovulation = getPeriodStatus([
        { date: '2026-05-01', type: 'start' },
        { date: '2026-05-06', type: 'end' }
    ], '2026-05-16');
    assert.equal(ovulation.phase, 'ovulation');

    const luteal = getPeriodStatus([
        { date: '2026-05-01', type: 'start' },
        { date: '2026-05-06', type: 'end' }
    ], '2026-05-25');
    assert.equal(luteal.phase, 'luteal');

    const delayed = getPeriodStatus([
        { date: '2026-05-01', type: 'start' },
        { date: '2026-05-06', type: 'end' }
    ], '2026-06-05');
    assert.equal(delayed.kind, 'delayed');
    assert.equal(delayed.delayDays, 2);
})();

(() => {
    const initial = {};
    const withSchedule = addScheduleToData(initial, '2026-05-06', 3, '10:00 复诊', () => 'cal_1');

    assert.deepEqual(initial, {}, 'addScheduleToData should not mutate source data');
    assert.equal(findDay(withSchedule, '2026-05-06').schedules.length, 1);
    assert.equal(findDay(withSchedule, '2026-05-06').schedules[0].color, 3);
    assert.equal(findDay(withSchedule, '2026-05-06').schedules[0].text, '10:00 复诊');

    const withMemo = setMemoForDate(withSchedule, '2026-05-06', '早点休息');
    assert.equal(findDay(withMemo, '2026-05-06').memo, '早点休息');

    const withoutMemo = setMemoForDate(withMemo, '2026-05-06', '   ');
    assert.equal(findDay(withoutMemo, '2026-05-06').memo, '');

    const deleted = deleteScheduleFromData(withoutMemo, '2026-05-06', 'cal_1');
    assert.equal(findDay(deleted, '2026-05-06').schedules.length, 0);
})();

(() => {
    const labels = normalizeColorLabels(['经期', '工作']);
    assert.equal(labels.length, 7);
    assert.equal(labels[0], '经期');
    assert.equal(labels[1], '工作');
    assert.equal(labels[6], '');
    assert.deepEqual(getDefaultColorLabels(), ['', '', '', '', '', '', '']);
})();

(() => {
    const dailyHistory = [
        {
            date: '2026-05-06',
            data: {
                glucose: 5.4,
                ketone: 1.2,
                ua: 330
            }
        }
    ];

    const summary = getBodySummaryForDate(dailyHistory, '2026-05-06');
    assert.deepEqual(summary, {
        hasRecord: true,
        glucose: 5.4,
        ketone: 1.2,
        ua: 330
    });

    const missing = getBodySummaryForDate(dailyHistory, '2026-05-07');
    assert.equal(missing.hasRecord, false);
})();

(() => {
    const logs = [];
    const withStart = setPeriodEntry(logs, '2026-05-06', 'start', { confirm: () => true });
    assert.deepEqual(withStart, [{ date: '2026-05-06', type: 'start' }]);

    const changed = setPeriodEntry(withStart, '2026-05-06', 'end', { confirm: () => true });
    assert.deepEqual(changed, [{ date: '2026-05-06', type: 'end' }]);

    const deleted = setPeriodEntry(changed, '2026-05-06', 'end', { confirm: () => true });
    assert.deepEqual(deleted, []);

    const canceled = setPeriodEntry(withStart, '2026-05-06', 'end', { confirm: () => false });
    assert.deepEqual(canceled, withStart);
})();

(() => {
    assert.equal(
        shouldHandleContainerDateClick({ hasSharedCalendar: true }),
        false,
        'container click fallback should stay off when shared calendar binds cell clicks'
    );
    assert.equal(
        shouldHandleContainerDateClick({ hasSharedCalendar: false }),
        true,
        'container click fallback should stay on for legacy rendering'
    );
})();

(() => {
    assert.equal(typeof resolveDayClass, 'function', 'resolveDayClass should be exported for calendar styling tests');

    const todaySelectedClasses = resolveDayClass('2026-05-06', {}, {
        isSelected: true,
        isToday: true,
        day: 6
    }).split(' ');

    assert.ok(todaySelectedClasses.includes('bg-white'));
    assert.ok(todaySelectedClasses.includes('text-chume-brown'));
    assert.ok(todaySelectedClasses.includes('border-2'));
    assert.ok(todaySelectedClasses.includes('border-chume-orange'));
    assert.ok(!todaySelectedClasses.includes('text-white'));
    assert.ok(!todaySelectedClasses.includes('bg-chume-orange'));

    const otherSelectedClasses = resolveDayClass('2026-05-05', {}, {
        isSelected: true,
        isToday: false,
        day: 5
    }).split(' ');

    assert.ok(otherSelectedClasses.includes('bg-white'));
    assert.ok(otherSelectedClasses.includes('text-chume-brown'));
    assert.ok(otherSelectedClasses.includes('border-2'));
    assert.ok(otherSelectedClasses.includes('border-chume-orange'));
    assert.ok(!otherSelectedClasses.includes('text-white'));
    assert.ok(!otherSelectedClasses.includes('bg-chume-orange'));
})();

console.log('calendar logic test passed');
