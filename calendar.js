// calendar.js
// ChuMe 打卡日历业务逻辑与页面编排

(function initCalendarModule(global) {
    const CALENDAR_DATA_KEY = 'chume_calendar_data_v1';
    const COLOR_LABELS_KEY = 'chume_calendar_color_labels_v1';
    const PERIOD_LOG_KEY = 'chume_period_log_v1';

    const SCHEDULE_COLORS = [
        '#F7B7B2',
        '#F8DF8B',
        '#BFE3C0',
        '#BFC9EA',
        '#D9BFE8',
        '#F1C98E',
        '#9BDDDD'
    ];

    function cloneCalendarData(data) {
        return JSON.parse(JSON.stringify(data || {}));
    }

    function ensureDateBucket(data, dateStr) {
        if (!data[dateStr]) {
            data[dateStr] = { schedules: [], memo: '' };
        }
        if (!Array.isArray(data[dateStr].schedules)) {
            data[dateStr].schedules = [];
        }
        if (typeof data[dateStr].memo !== 'string') {
            data[dateStr].memo = '';
        }
        return data[dateStr];
    }

    function getDefaultColorLabels() {
        return ['', '', '', '', '', '', ''];
    }

    function normalizeColorLabels(labels) {
        const normalized = getDefaultColorLabels();
        if (!Array.isArray(labels)) return normalized;

        labels.slice(0, 7).forEach((label, index) => {
            normalized[index] = label ? String(label) : '';
        });
        return normalized;
    }

    function addScheduleToData(data, dateStr, color, text, idFactory) {
        const next = cloneCalendarData(data);
        const trimmedText = String(text || '').trim();
        if (!dateStr || !trimmedText) return next;

        const bucket = ensureDateBucket(next, dateStr);
        const safeColor = Math.min(Math.max(parseInt(color, 10) || 1, 1), 7);
        const makeId = idFactory || (() => `cal_${Date.now()}`);

        bucket.schedules.push({
            id: makeId(),
            color: safeColor,
            text: trimmedText
        });
        return next;
    }

    function deleteScheduleFromData(data, dateStr, scheduleId) {
        const next = cloneCalendarData(data);
        if (!next[dateStr] || !Array.isArray(next[dateStr].schedules)) return next;

        next[dateStr].schedules = next[dateStr].schedules.filter(item => {
            return String(item.id) !== String(scheduleId);
        });
        return next;
    }

    function setMemoForDate(data, dateStr, memo) {
        const next = cloneCalendarData(data);
        if (!dateStr) return next;

        const bucket = ensureDateBucket(next, dateStr);
        bucket.memo = String(memo || '').trim();
        return next;
    }

    function parseLocalDate(dateStr) {
        const [year, month, day] = String(dateStr).split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function diffDays(fromDateStr, toDateStr) {
        const from = parseLocalDate(fromDateStr);
        const to = parseLocalDate(toDateStr);
        return Math.floor((to - from) / 86400000);
    }

    function getPeriodStatus(logs, selectedDateStr) {
        const safeLogs = Array.isArray(logs) ? logs : [];
        if (safeLogs.length === 0) {
            return { kind: 'empty' };
        }

        const selected = parseLocalDate(selectedDateStr);
        const starts = safeLogs
            .filter(log => log.type === 'start' && parseLocalDate(log.date) <= selected)
            .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
        const lastStart = starts[0];

        if (!lastStart) {
            return { kind: 'none' };
        }

        const ends = safeLogs
            .filter(log => log.type === 'end' && parseLocalDate(log.date) >= parseLocalDate(lastStart.date))
            .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
        const cycleEnd = ends[0];
        const dayCount = diffDays(lastStart.date, selectedDateStr) + 1;

        if (!cycleEnd) {
            return { kind: 'period', dayCount };
        }

        const endDate = parseLocalDate(cycleEnd.date);

        if (selected.getTime() === endDate.getTime()) {
            return {
                kind: 'ended',
                duration: diffDays(lastStart.date, cycleEnd.date) + 1
            };
        }

        if (selected < endDate) {
            return { kind: 'period', dayCount };
        }

        const daysFromEnd = diffDays(cycleEnd.date, selectedDateStr);
        if (daysFromEnd > 28) {
            return {
                kind: 'delayed',
                delayDays: daysFromEnd - 28,
                daysFromEnd
            };
        }

        let phase = 'luteal';
        if (daysFromEnd <= 7) phase = 'follicular';
        else if (daysFromEnd <= 12) phase = 'ovulation';

        return {
            kind: 'phase',
            phase,
            daysFromEnd
        };
    }

    function setPeriodEntry(logs, dateStr, type, options = {}) {
        const confirmFn = options.confirm || (() => true);
        const next = Array.isArray(logs) ? logs.map(log => ({ ...log })) : [];
        const existingIndex = next.findIndex(log => log.date === dateStr);

        if (existingIndex !== -1) {
            const existing = next[existingIndex];
            if (existing.type === type) {
                if (!confirmFn('delete', existing)) return next;
                next.splice(existingIndex, 1);
            } else {
                if (!confirmFn('change', existing)) return next;
                next[existingIndex] = { date: dateStr, type };
            }
        } else {
            if (!confirmFn('add', { date: dateStr, type })) return next;
            next.push({ date: dateStr, type });
        }

        return next.sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
    }

    function getBodySummaryForDate(dailyHistory, dateStr) {
        const record = Array.isArray(dailyHistory)
            ? dailyHistory.find(item => item.date === dateStr)
            : null;

        if (!record || !record.data) {
            return { hasRecord: false };
        }

        return {
            hasRecord: true,
            glucose: record.data.glucose ?? null,
            ketone: record.data.ketone ?? null,
            ua: record.data.ua ?? null
        };
    }

    function safeJsonParse(rawValue, fallback) {
        try {
            return rawValue ? JSON.parse(rawValue) : fallback;
        } catch (error) {
            console.error('Calendar JSON parse failed:', error);
            return fallback;
        }
    }

    function readLocalStorageJson(key, fallback) {
        if (!global.localStorage) return fallback;
        return safeJsonParse(global.localStorage.getItem(key), fallback);
    }

    function writeLocalStorageJson(key, value) {
        if (!global.localStorage) return;
        global.localStorage.setItem(key, JSON.stringify(value));
    }

    function getCalendarData() {
        return readLocalStorageJson(CALENDAR_DATA_KEY, {});
    }

    function saveCalendarData(data) {
        writeLocalStorageJson(CALENDAR_DATA_KEY, data || {});
    }

    function getColorLabels() {
        return normalizeColorLabels(readLocalStorageJson(COLOR_LABELS_KEY, getDefaultColorLabels()));
    }

    function saveColorLabels(labels) {
        writeLocalStorageJson(COLOR_LABELS_KEY, normalizeColorLabels(labels));
    }

    function getPeriodLog() {
        return readLocalStorageJson(PERIOD_LOG_KEY, []);
    }

    function savePeriodLog(logs) {
        writeLocalStorageJson(PERIOD_LOG_KEY, Array.isArray(logs) ? logs : []);
    }

    function getDailyBodyHistory() {
        return readLocalStorageJson('chume_log_daily_v13', []);
    }

    function getGoalTotal() {
        if (typeof global.getPref === 'function') {
            const goal = parseInt(global.getPref('goal_total') || 2000, 10);
            return Number.isFinite(goal) ? goal : 2000;
        }
        return 2000;
    }

    function formatMonthTitle(date) {
        return `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
    }

    function formatReadableDate(dateStr) {
        const date = parseLocalDate(dateStr);
        const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        return `${date.getMonth() + 1}月${date.getDate()}日 ${weekDays[date.getDay()]}`;
    }

    function getTodayString() {
        if (typeof global.getCurrentDateString === 'function') {
            return global.getCurrentDateString();
        }
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function shouldHandleContainerDateClick(options = {}) {
        return !options.hasSharedCalendar;
    }

    function escapeHTML(value) {
        if (global.ChuMeComponents && global.ChuMeComponents.DOMUtils) {
            return global.ChuMeComponents.DOMUtils.escapeHTML(value);
        }
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    let pageState = {
        currentMonth: new Date(),
        selectedDate: '',
        monthMarkers: {},
        calendar: null
    };

    function getElement(id) {
        return global.document ? global.document.getElementById(id) : null;
    }

    async function loadWaterTotals() {
        const totals = {};
        if (typeof global.getAllData !== 'function') return totals;

        try {
            const records = await global.getAllData('water');
            records.forEach(record => {
                if (!record || !record.date) return;
                totals[record.date] = (totals[record.date] || 0) + (parseInt(record.amount, 10) || 0);
            });
        } catch (error) {
            console.error('读取喝水数据失败:', error);
            if (typeof global.showToast === 'function') {
                global.showToast('读取喝水数据失败', 'error');
            }
        }
        return totals;
    }

    async function loadMonthMarkers() {
        const calendarData = getCalendarData();
        const waterTotals = await loadWaterTotals();
        const goalTotal = getGoalTotal();
        const markers = {};

        Object.keys(calendarData).forEach(dateStr => {
            const dayInfo = calendarData[dateStr] || {};
            markers[dateStr] = {
                schedules: Array.isArray(dayInfo.schedules) ? dayInfo.schedules : [],
                memo: dayInfo.memo || '',
                waterTotal: waterTotals[dateStr] || 0,
                waterMet: goalTotal > 0 && (waterTotals[dateStr] || 0) >= goalTotal
            };
        });

        Object.keys(waterTotals).forEach(dateStr => {
            if (!markers[dateStr]) {
                markers[dateStr] = { schedules: [], memo: '' };
            }
            markers[dateStr].waterTotal = waterTotals[dateStr];
            markers[dateStr].waterMet = goalTotal > 0 && waterTotals[dateStr] >= goalTotal;
        });

        pageState.monthMarkers = markers;
        return markers;
    }

    function renderDayContent(dateStr, context) {
        const marker = pageState.monthMarkers[dateStr] || {};
        const schedules = Array.isArray(marker.schedules) ? marker.schedules : [];
        const visibleSchedules = schedules.slice(0, 8);
        const scheduleDots = visibleSchedules.map(item => {
            const color = SCHEDULE_COLORS[(parseInt(item.color, 10) || 1) - 1] || SCHEDULE_COLORS[0];
            return `<span class="w-1.5 h-1.5 rounded-full border border-white/70" style="background:${color}"></span>`;
        }).join('');
        const moreDot = schedules.length > 8
            ? '<span class="text-[9px] leading-none text-chume-brown-light">+</span>'
            : '';
        const waterMark = marker.waterTotal > 0
            ? `<span class="text-[10px] font-bold ${marker.waterMet ? 'text-green-500' : 'text-red-400'}">${marker.waterMet ? '✓' : '×'}</span>`
            : '';
        const memoDot = marker.memo
            ? '<span class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-chume-orange"></span>'
            : '';

        return `
            <div class="relative w-full h-full min-h-[52px] flex flex-col items-center justify-start pt-1.5 px-1">
                ${memoDot}
                <span class="text-[13px] font-bold leading-none">${context.day}</span>
                <div class="mt-1 min-h-[12px] flex flex-wrap justify-center gap-0.5">
                    ${scheduleDots}${moreDot}
                </div>
                <div class="mt-auto leading-none">${waterMark}</div>
            </div>
        `;
    }

    function resolveDayClass(dateStr, data, context) {
        const base = 'rounded-xl border';
        if (context.isSelected) {
            return `${base} bg-white text-chume-brown border-2 border-chume-orange shadow-card`;
        }
        if (context.isToday) {
            return `${base} bg-white text-chume-brown border-2 border-chume-orange`;
        }
        return `${base} bg-white text-chume-brown border-chume-brown/10 active:scale-95`;
    }

    async function renderCalendarGrid() {
        const title = getElement('calendar-month-title');
        if (title) title.innerText = formatMonthTitle(pageState.currentMonth);
        updateCalendarViewToggle();

        await loadMonthMarkers();

        if (pageState.calendar) {
            await pageState.calendar.render(pageState.currentMonth, pageState.selectedDate);
            updateCalendarViewToggle();
            return;
        }

        const grid = getElement('calendar-days');
        if (!grid) return;
        const year = pageState.currentMonth.getFullYear();
        const month = pageState.currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let html = '';

        for (let i = 0; i < firstDay; i++) html += '<div></div>';
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = dateStr === pageState.selectedDate;
            const isToday = dateStr === getTodayString();
            html += `
                <button data-date="${dateStr}" class="${resolveDayClass(dateStr, {}, { isSelected, isToday, day })}">
                    ${renderDayContent(dateStr, { day })}
                </button>
            `;
        }
        grid.innerHTML = html;
    }

    function renderHealthSummary(dateStr) {
        const container = getElement('calendar-health-summary');
        if (!container) return;

        const summary = getBodySummaryForDate(getDailyBodyHistory(), dateStr);
        if (!summary.hasRecord) {
            container.innerHTML = '<div class="text-center text-xs text-chume-brown-light py-3">今日无身体数据</div>';
            return;
        }

        const items = [
            { label: '血糖', value: summary.glucose, unit: 'mmol/L' },
            { label: '血酮', value: summary.ketone, unit: 'mmol/L' },
            { label: '尿酸', value: summary.ua, unit: 'umol/L' }
        ];

        container.innerHTML = items.map(item => `
            <div class="bg-chume-card rounded-xl px-3 py-2 text-center min-w-0">
                <div class="text-[11px] text-chume-brown-light">${item.label}</div>
                <div class="mt-1 font-num font-bold text-chume-brown truncate">${item.value ?? '-'}</div>
                <div class="text-[9px] text-chume-brown-light">${item.unit}</div>
            </div>
        `).join('');
    }

    function getPeriodText(status) {
        if (status.kind === 'empty') return '还没有设置过生理周期哦';
        if (status.kind === 'none') return '当前日期之前没有周期记录';
        if (status.kind === 'period') return `生理周期第 ${status.dayCount} 天（月经期）`;
        if (status.kind === 'ended') return `本次月经结束（共持续 ${status.duration} 天）`;
        if (status.kind === 'delayed') return `月经延迟 ${status.delayDays} 天`;
        if (status.kind === 'phase') {
            const phaseNames = {
                follicular: '卵泡期 - 状态不错',
                ovulation: '排卵期 - 易受孕',
                luteal: '黄体期 - 注意情绪'
            };
            return `距离结束第 ${status.daysFromEnd} 天（${phaseNames[status.phase]}）`;
        }
        return '';
    }

    function renderPeriodPanel(dateStr) {
        const statusEl = getElement('calendar-period-status');
        const startBtn = getElement('calendar-period-start');
        const endBtn = getElement('calendar-period-end');
        if (!statusEl || !startBtn || !endBtn) return;

        const logs = getPeriodLog();
        const current = logs.find(log => log.date === dateStr);
        const status = getPeriodStatus(logs, dateStr);

        statusEl.innerText = getPeriodText(status);
        startBtn.classList.toggle('bg-chume-pink', current && current.type === 'start');
        startBtn.classList.toggle('text-white', current && current.type === 'start');
        endBtn.classList.toggle('bg-chume-pink', current && current.type === 'end');
        endBtn.classList.toggle('text-white', current && current.type === 'end');
    }

    function renderColorOptions() {
        const container = getElement('calendar-color-options');
        if (!container) return;

        const labels = getColorLabels();
        container.innerHTML = SCHEDULE_COLORS.map((color, index) => {
            const label = labels[index] ? escapeHTML(labels[index]) : '';
            return `
                <button data-color="${index + 1}" class="calendar-color-btn min-w-[42px] flex flex-col items-center gap-1 rounded-xl px-2 py-2 active:scale-95 transition-transform">
                    <span class="w-5 h-5 rounded-full border border-chume-brown/20" style="background:${color}"></span>
                    <span class="max-w-[46px] text-[10px] text-chume-brown-light truncate">${label}</span>
                </button>
            `;
        }).join('');
    }

    function renderScheduleList(dateStr) {
        const container = getElement('calendar-schedule-list');
        if (!container) return;

        const data = getCalendarData();
        const schedules = (data[dateStr] && Array.isArray(data[dateStr].schedules))
            ? data[dateStr].schedules
            : [];

        if (schedules.length === 0) {
            container.innerHTML = '<div class="text-center text-xs text-chume-brown-light py-4">暂无行程</div>';
            return;
        }

        container.innerHTML = schedules.map(item => {
            const color = SCHEDULE_COLORS[(parseInt(item.color, 10) || 1) - 1] || SCHEDULE_COLORS[0];
            return `
                <div class="flex items-start gap-3 rounded-xl bg-chume-card px-3 py-2">
                    <span class="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style="background:${color}"></span>
                    <span class="flex-1 text-sm text-chume-brown leading-relaxed break-words">${escapeHTML(item.text)}</span>
                    <button data-schedule-id="${escapeHTML(item.id)}" class="calendar-delete-schedule text-chume-pink text-sm font-bold px-1 active:scale-95">删</button>
                </div>
            `;
        }).join('');
    }

    function renderMemo(dateStr) {
        const memo = getElement('calendar-memo');
        if (!memo) return;
        const data = getCalendarData();
        memo.value = data[dateStr] && data[dateStr].memo ? data[dateStr].memo : '';
    }

    function renderSelectedDayDetail(dateStr) {
        const title = getElement('calendar-selected-date');
        if (title) title.innerText = formatReadableDate(dateStr);

        renderHealthSummary(dateStr);
        renderPeriodPanel(dateStr);
        renderColorOptions();
        renderScheduleList(dateStr);
        renderMemo(dateStr);
    }

    async function selectCalendarDate(dateStr) {
        pageState.selectedDate = dateStr;
        pageState.currentMonth = parseLocalDate(dateStr);
        await renderCalendarGrid();
        renderSelectedDayDetail(dateStr);
    }

    async function changeCalendarMonth(delta) {
        pageState.currentMonth.setMonth(pageState.currentMonth.getMonth() + delta);
        if (pageState.calendar && pageState.calendar.viewMode === 'week') {
            pageState.selectedDate = `${pageState.currentMonth.getFullYear()}-${String(pageState.currentMonth.getMonth() + 1).padStart(2, '0')}-01`;
            pageState.currentMonth = parseLocalDate(pageState.selectedDate);
            renderSelectedDayDetail(pageState.selectedDate);
        }
        await renderCalendarGrid();
    }

    async function toggleCalendarView() {
        if (!pageState.calendar) return;
        pageState.calendar.toggleViewMode();
        updateCalendarViewToggle();
        await renderCalendarGrid();
    }

    async function goToCalendarToday() {
        pageState.selectedDate = getTodayString();
        pageState.currentMonth = parseLocalDate(pageState.selectedDate);
        await renderCalendarGrid();
        renderSelectedDayDetail(pageState.selectedDate);
    }

    function updateCalendarViewToggle() {
        const button = getElement('calendar-view-toggle');
        if (!button || !pageState.calendar) return;
        button.innerText = pageState.calendar.getToggleButtonText();
    }

    async function addSchedule(color) {
        const text = global.prompt ? global.prompt('请输入行程内容') : '';
        if (!text || !text.trim()) return;

        const next = addScheduleToData(
            getCalendarData(),
            pageState.selectedDate,
            color,
            text,
            () => `cal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        );
        saveCalendarData(next);
        await renderCalendarGrid();
        renderScheduleList(pageState.selectedDate);
    }

    async function deleteSchedule(scheduleId) {
        if (global.confirm && !global.confirm('删除这条行程？')) return;
        saveCalendarData(deleteScheduleFromData(getCalendarData(), pageState.selectedDate, scheduleId));
        await renderCalendarGrid();
        renderScheduleList(pageState.selectedDate);
    }

    async function saveSelectedMemo() {
        const memo = getElement('calendar-memo');
        if (!memo) return;
        saveCalendarData(setMemoForDate(getCalendarData(), pageState.selectedDate, memo.value));
        await renderCalendarGrid();
    }

    async function togglePeriod(type) {
        const messages = {
            add: `确认标记 ${pageState.selectedDate} 为月经${type === 'start' ? '开始' : '结束'}日吗？`,
            change: `确认将今天改为月经${type === 'start' ? '开始' : '结束'}日吗？`,
            delete: '确认删除这条记录吗？'
        };

        const next = setPeriodEntry(getPeriodLog(), pageState.selectedDate, type, {
            confirm(action) {
                return global.confirm ? global.confirm(messages[action]) : true;
            }
        });
        savePeriodLog(next);
        renderPeriodPanel(pageState.selectedDate);
    }

    function bindCalendarPageEvents() {
        getElement('calendar-prev-month')?.addEventListener('click', () => changeCalendarMonth(-1));
        getElement('calendar-next-month')?.addEventListener('click', () => changeCalendarMonth(1));
        getElement('calendar-view-toggle')?.addEventListener('click', toggleCalendarView);
        getElement('calendar-today')?.addEventListener('click', goToCalendarToday);
        getElement('calendar-memo')?.addEventListener('change', saveSelectedMemo);
        getElement('calendar-period-start')?.addEventListener('click', () => togglePeriod('start'));
        getElement('calendar-period-end')?.addEventListener('click', () => togglePeriod('end'));

        getElement('calendar-days')?.addEventListener('click', event => {
            if (!shouldHandleContainerDateClick({ hasSharedCalendar: !!pageState.calendar })) return;
            const target = event.target.closest('[data-date]');
            if (target && target.dataset.date) selectCalendarDate(target.dataset.date);
        });

        getElement('calendar-color-options')?.addEventListener('click', event => {
            const target = event.target.closest('[data-color]');
            if (target && target.dataset.color) addSchedule(target.dataset.color);
        });

        getElement('calendar-schedule-list')?.addEventListener('click', event => {
            const target = event.target.closest('[data-schedule-id]');
            if (target && target.dataset.scheduleId) deleteSchedule(target.dataset.scheduleId);
        });
    }

    async function initCalendarPage() {
        if (!global.document) return;

        pageState.selectedDate = getTodayString();
        pageState.currentMonth = parseLocalDate(pageState.selectedDate);

        if (global.ChuMeComponents && global.ChuMeComponents.CalendarComponent) {
            pageState.calendar = new global.ChuMeComponents.CalendarComponent({
                containerId: 'calendar-days',
                titleId: 'calendar-month-title',
                dataSource: async () => pageState.monthMarkers,
                renderDayContent,
                cellClassResolver: resolveDayClass,
                onSelect: selectCalendarDate,
                allowFuture: true,
                mode: 'full'
            });
        }

        bindCalendarPageEvents();
        await renderCalendarGrid();
        renderSelectedDayDetail(pageState.selectedDate);
    }

    const logic = {
        CALENDAR_DATA_KEY,
        COLOR_LABELS_KEY,
        PERIOD_LOG_KEY,
        SCHEDULE_COLORS,
        addScheduleToData,
        deleteScheduleFromData,
        setMemoForDate,
        getBodySummaryForDate,
        getDefaultColorLabels,
        normalizeColorLabels,
        getPeriodStatus,
        setPeriodEntry,
        shouldHandleContainerDateClick,
        resolveDayClass,
        readLocalStorageJson,
        writeLocalStorageJson,
        getCalendarData,
        saveCalendarData,
        getColorLabels,
        saveColorLabels,
        getPeriodLog,
        savePeriodLog,
        getPeriodText,
        initCalendarPage
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = logic;
    }

    global.ChuMeCalendarLogic = logic;
})(typeof window !== 'undefined' ? window : globalThis);
