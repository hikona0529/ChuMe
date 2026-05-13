// water-refactored-v2.js
// 使用共享组件库重构的版本

// 检查组件库是否已加载
if (typeof ChuMeComponents === 'undefined') {
    console.error('ChuMe组件库未加载，请确保components.js已引入');
}

// --- Configuration ---
const DRINK_CONFIG = {
    '白开水': { c: '#3B82F6', i: '🥤' }, // Blue
    '黑咖啡': { c: '#78350F', i: '☕' }, // Dark Brown
    '电解质': { c: '#F59E0B', i: '⚡' }, // Amber
    '柠檬水': { c: '#FCD34D', i: '🍋' }, // Light Yellow
    '淡盐水': { c: '#06B6D4', i: '🧂' }, // Cyan
    '茶': { c: '#10B981', i: '🍵' }, // Green
    'default': { c: '#9CA3AF', i: '❓' }  // Gray
};

let waterViewOffset = 0;
let GOAL_TOTAL = parseInt(getPref('goal_total') || 2000);
let GOAL_ELEC = parseInt(getPref('goal_elec') || 500);
let DEFAULT_VOL = parseInt(getPref('default_vol') || 250);

let quickVol = null; // Current quick volume selection
let calDate = new Date();

// 组件实例
let waterCalendar = null;

// --- Core Logic ---

function parseWaterRecordTime(time) {
    const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return -1;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1;

    return hours * 60 + minutes;
}

function getWaterRecordInsertRank(record, index) {
    const numericId = Number(record && record.id);
    return Number.isFinite(numericId) ? numericId : index;
}

function sortWaterRecordsForDisplay(records) {
    return [...(records || [])]
        .map((record, index) => ({ record, index }))
        .sort((a, b) => {
            const timeDiff = parseWaterRecordTime(b.record.time) - parseWaterRecordTime(a.record.time);
            if (timeDiff !== 0) return timeDiff;

            return getWaterRecordInsertRank(b.record, b.index) - getWaterRecordInsertRank(a.record, a.index);
        })
        .map(item => item.record);
}

function initDrinkScroll() {
    const scroller = document.getElementById('drink-scroll');
    if (!scroller) return;

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let moved = false;
    let activePointerType = '';

    scroller.addEventListener('pointerdown', event => {
        activePointerType = event.pointerType || '';
        if (activePointerType !== 'mouse') return;
        if (event.button !== 0) return;

        isDragging = true;
        moved = false;
        startX = event.clientX;
        startScrollLeft = scroller.scrollLeft;
        scroller.classList.add('cursor-grabbing');
        scroller.classList.remove('cursor-grab');
    });

    scroller.addEventListener('pointermove', event => {
        if (activePointerType !== 'mouse') return;
        if (!isDragging) return;

        const deltaX = event.clientX - startX;
        if (Math.abs(deltaX) > 4) moved = true;
        scroller.scrollLeft = startScrollLeft - deltaX;
    });

    function endDrag(event) {
        if (!isDragging) return;

        isDragging = false;
        activePointerType = '';
        scroller.classList.remove('cursor-grabbing');
        scroller.classList.add('cursor-grab');
    }

    scroller.addEventListener('pointerup', endDrag);
    scroller.addEventListener('pointercancel', endDrag);
    scroller.addEventListener('mouseleave', endDrag);
    scroller.addEventListener('click', event => {
        if (moved) {
            event.preventDefault();
            event.stopPropagation();
            moved = false;
        }
    }, true);
}

// Init Inputs (Run ONCE on load)
function initInputs() {
    const totalInput = document.getElementById('set-goal-total');
    const elecInput = document.getElementById('set-goal-elec');
    const volumeInput = document.getElementById('set-default-vol');
    if (!totalInput || !elecInput || !volumeInput) return;

    const rawT = getPref('goal_total');
    const rawE = getPref('goal_elec');
    const rawV = getPref('default_vol');

    if (rawT !== null && rawT !== "") totalInput.value = rawT;
    else totalInput.value = "";

    if (rawE !== null && rawE !== "") elecInput.value = rawE;
    else elecInput.value = "";

    if (rawV !== null && rawV !== "") volumeInput.value = rawV;
    else volumeInput.value = "250";

    updateSettingsHint();
}

// 初始化日历组件
function initCalendar() {
    if (!ChuMeComponents || !ChuMeComponents.CalendarComponent) {
        console.error('日历组件未加载');
        return;
    }
    
    waterCalendar = new ChuMeComponents.CalendarComponent({
        containerId: 'cal-days',
        titleId: 'cal-title',
        dataSource: async (year, month) => {
            const history = await getAllData('water');
            const dailyTotals = {};
            history.forEach(r => {
                dailyTotals[r.date] = (dailyTotals[r.date] || 0) + r.amount;
            });
            return dailyTotals;
        },
        markLogic: (dateStr, data, { isSelected }) => {
            const total = data[dateStr] || 0;
            if (total === 0) return null;
            
            const isMet = GOAL_TOTAL > 0 && total >= GOAL_TOTAL;
            return {
                symbol: isMet ? '✓' : '×',
                colorClass: isSelected ? 'text-white' : (isMet ? 'text-green-500' : 'text-red-500'),
                sizeStyle: !isMet ? 'text-sm -mb-[2px]' : 'text-[10px]'
            };
        },
        onSelect: (dateStr) => {
            waterPickDate(dateStr);
            if (ChuMeComponents && ChuMeComponents.ModalManager) {
                ChuMeComponents.ModalManager.hide('calendar-modal');
            } else {
                closeCalendarLegacy();
            }
        },
        selectedClass: 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
    });
    updateWaterCalendarViewToggle();
}

// Volume Logic
function selectQuickVol(vol) {
    if (quickVol === vol) {
        quickVol = null;
    } else {
        quickVol = vol;
    }
    updateQuickVolUI();
}

function updateQuickVolUI() {
    document.querySelectorAll('.vol-btn').forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white', 'border-blue-500');
        btn.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
    });
    if (quickVol) {
        const btn = document.getElementById(`btn-vol-${quickVol}`);
        if (btn) {
            btn.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            btn.classList.add('bg-blue-500', 'text-white', 'border-blue-500');
        }
    }
}

// Settings Logic
function saveGoals() {
    const totalInput = document.getElementById('set-goal-total');
    const elecInput = document.getElementById('set-goal-elec');
    const volumeInput = document.getElementById('set-default-vol');
    if (!totalInput || !elecInput || !volumeInput) return;

    const t = totalInput.value;
    const e = elecInput.value;
    const v = volumeInput.value;

    // Allow empty/0: If empty, save as empty string.
    if (t !== "") {
        GOAL_TOTAL = parseInt(t);
        savePref('goal_total', GOAL_TOTAL);
    } else {
        GOAL_TOTAL = 0;
        savePref('goal_total', "");
    }

    if (e !== "") {
        GOAL_ELEC = parseInt(e);
        savePref('goal_elec', GOAL_ELEC);
    } else {
        GOAL_ELEC = 0;
        savePref('goal_elec', "");
    }

    if (v !== "") {
        DEFAULT_VOL = parseInt(v);
        savePref('default_vol', DEFAULT_VOL);
    } else {
        DEFAULT_VOL = 250;
        savePref('default_vol', "");
    }

    updateSettingsHint();
    renderWaterApp();
}

// Date Logic
function waterChangeDate(o) {
    waterViewOffset += o;
    if (waterViewOffset > 0) waterViewOffset = 0;
    renderWaterApp();
}

function waterPickDate(v) {
    if (!v) return;
    const parts = v.split('-');
    const p = new Date(parts[0], parts[1] - 1, parts[2]);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const diffTime = p.getTime() - t.getTime();
    const d = Math.round(diffTime / (1000 * 3600 * 24));
    if (d > 0) {
        showToast('不能选择未来日期哦', 'error');
        return;
    }
    waterViewOffset = d;
    renderWaterApp();
}

function getWaterDateStr() {
    return getDateStr(waterViewOffset);
}

// Add Logic
function addWater(t, e) {
    let v = 0;
    const customInput = document.getElementById('input-vol-custom').value;
    if (customInput && parseInt(customInput) > 0) {
        v = parseInt(customInput);
    } else if (quickVol) {
        v = quickVol;
    } else {
        v = DEFAULT_VOL;
    }

    showToast(`已添加 ${v}ml ${t}`, 'success');
    const newRecord = {
        id: generateId(),
        date: waterViewOffset === 0 ? getCurrentDateString() : getDateStr(waterViewOffset),
        time: waterViewOffset === 0 ? formatTime(new Date()) : "补录",
        type: t,
        amount: v,
        isElec: e
    };
    saveData('water', newRecord).then(() => {
        document.getElementById('input-vol-custom').value = '';
        quickVol = null;
        updateQuickVolUI();
        renderWaterApp();
    }).catch(err => {
        console.error('添加记录失败:', err);
        showToast('添加记录失败', 'error');
    });
}

function delWater(id) {
    if (confirm("删除这条记录？")) {
        deleteData('water', id).then(() => {
            renderWaterApp();
        }).catch(err => {
            console.error('删除记录失败:', err);
            showToast('删除记录失败', 'error');
        });
    }
}

function editWater(id) {
    getData('water', id).then(item => {
        if (item) {
            let newVol = prompt("修改水量 (ml):", item.amount);
            if (newVol && !isNaN(newVol)) {
                item.amount = parseInt(newVol);
                saveData('water', item).then(() => {
                    renderWaterApp();
                }).catch(err => {
                    console.error('更新记录失败:', err);
                    showToast('更新记录失败', 'error');
                });
            }
        }
    }).catch(err => {
        console.error('获取记录失败:', err);
        showToast('获取记录失败', 'error');
    });
}

// Halo Logic
function updateHalo(d, tot) {
    let currentP = 0;
    let gradParts = [];

    let typeStats = {};
    d.forEach(i => {
        typeStats[i.type] = (typeStats[i.type] || 0) + i.amount;
    });

    const sortedTypes = Object.entries(typeStats).sort((a, b) => b[1] - a[1]);

    // Generate Gradient
    if (GOAL_TOTAL > 0) {
        sortedTypes.forEach(([type, amount]) => {
            const config = DRINK_CONFIG[type] || DRINK_CONFIG.default;
            const p = (amount / GOAL_TOTAL) * 100;
            const nextP = currentP + p;
            if (currentP < 100) {
                const drawEnd = Math.min(nextP, 100);
                gradParts.push(`${config.c} ${currentP}% ${drawEnd}%`);
                currentP = drawEnd;
            }
        });
        if (currentP < 100) gradParts.push(`#E5E7EB ${currentP}% 100%`);
    } else {
        gradParts.push(`#E5E7EB 0% 100%`);
    }

    const haloRing = document.getElementById('halo-ring');
    if (gradParts.length > 0) {
        haloRing.style.background = `conic-gradient(${gradParts.join(', ')})`;
    }

    // Update Center Data
    document.getElementById('center-total').innerText = tot;
    const goalLabel = document.getElementById('center-goal');
    if (GOAL_TOTAL > 0) {
        goalLabel.innerText = `/ ${GOAL_TOTAL} ml`;
        goalLabel.classList.remove("text-gray-300");
        goalLabel.classList.add("text-gray-400");
    } else {
        goalLabel.innerText = `/ 未设置`;
        goalLabel.classList.remove("text-gray-400");
        goalLabel.classList.add("text-gray-300");
    }

    // Update Elec Metric (Center)
    let elec = 0;
    d.forEach(i => { if (i.isElec) elec += i.amount; });
    const elecEl = document.getElementById('metric-elec');
    elecEl.innerText = `${elec}/${GOAL_ELEC || '--'}`;
    if (GOAL_ELEC > 0 && elec >= GOAL_ELEC) elecEl.classList.add('text-amber-500');
    else elecEl.classList.remove('text-amber-500');

    // Render Bottom Data Strip (Grid)
    const stripEl = document.getElementById('halo-data-strip');
    if (sortedTypes.length > 0) {
        let sHtml = '';
        sortedTypes.forEach(([type, amount]) => {
            let percent = 0;
            if (GOAL_TOTAL > 0) percent = Math.round((amount / GOAL_TOTAL) * 100);
            else percent = Math.round((amount / tot) * 100);

            const config = DRINK_CONFIG[type] || DRINK_CONFIG.default;

            sHtml += `
                <div class="flex items-center justify-center gap-1.5 bg-gray-50 rounded-full px-2 py-1 box-border border border-gray-100 min-w-0">
                    <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${config.c}"></div>
                    <div class="flex flex-col leading-none text-center overflow-hidden w-full">
                        <span class="text-[10px] text-gray-600 font-bold truncate w-full">${type}</span>
                        <span class="text-[9px] text-gray-400 truncate w-full">${amount}ml <span class="opacity-50">|</span> ${percent}%</span>
                    </div>
                </div>
            `;
        });
        stripEl.innerHTML = sHtml;
    } else {
        stripEl.innerHTML = '<span class="col-span-3 text-center text-xs text-gray-300 py-1">今天还没喝水哦</span>';
    }
}

// Settings Hint Logic
function updateSettingsHint() {
    const totalInput = document.getElementById('set-goal-total');
    const elecInput = document.getElementById('set-goal-elec');
    const volumeInput = document.getElementById('set-default-vol');
    const hint = document.getElementById('settings-hint');
    if (!totalInput || !elecInput || !volumeInput || !hint) return;

    const t = totalInput.value;
    const e = elecInput.value;
    const v = volumeInput.value;
    const isEmpty = (!t || t == 0) && (!e || e == 0) && (!v || v == 0);
    if (isEmpty) hint.classList.remove('hidden');
    else hint.classList.add('hidden');
}

function renderWaterApp() {
    const ds = waterViewOffset === 0 ? getCurrentDateString() : getDateStr(waterViewOffset);
    getDataByIndex('water', 'date', ds).then(d => {

    // Check Hint
    updateSettingsHint();

    // Update Date Display
    const subheaderDate = document.getElementById("subheader-date");
    const nextBtn = document.getElementById("btn-next-day");
    const displayDateStr = ds.replace(/-/g, '/');

    if (waterViewOffset === 0) {
        subheaderDate.innerText = "今天";
        nextBtn.disabled = true;
    } else {
        subheaderDate.innerText = displayDateStr;
        nextBtn.disabled = false;
    }

    // Histroy Mode Visuals
    const bg = document.getElementById("water-dash-bg");
    if (waterViewOffset !== 0) {
        bg.classList.add("bg-gray-100");
        bg.classList.remove("bg-white");
    } else {
        bg.classList.remove("bg-gray-100");
        bg.classList.add("bg-white");
    }

    // Calculate Stats & List
    let tot = 0;
    let html = "";
    d.forEach(i => {
        tot += i.amount;
    });

    sortWaterRecordsForDisplay(d).forEach(i => {
        const c = DRINK_CONFIG[i.type] || DRINK_CONFIG.default;
        html += `
            <div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full" style="background-color: ${c.c}"></div>
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-gray-700">${i.type} <span class="text-gray-400 font-normal">(${i.time})</span></span>
                        <span class="text-xs text-gray-500">${i.amount} ml</span>
                    </div>
                </div>
                <div class="flex gap-2">
                     <button onclick="editWater('${i.id}')" class="text-xs text-blue-400 px-2 py-1 bg-blue-50 rounded shadow-sm hover:opacity-80 active:scale-95 transition-all">改</button>
                     <button onclick="delWater('${i.id}')" class="text-xs text-red-400 px-2 py-1 bg-red-50 rounded shadow-sm hover:opacity-80 active:scale-95 transition-all">删</button>
                </div>
            </div>`;
    });
    document.getElementById('water-list').innerHTML = html || `<div class="text-center py-6 text-gray-300 text-xs">暂无记录，快去喝水吧~</div>`;

    // Update Halo
    updateHalo(d, tot);
}).catch(err => {
    console.error('获取数据失败:', err);
    showToast('获取数据失败', 'error');
});
}

// --- 重构后的日历函数 ---

function openCalendar() {
    const curStr = getWaterDateStr();
    const parts = curStr.split('-');
    calDate = new Date(parts[0], parts[1] - 1, parts[2]);

    // 使用组件库的模态框管理器
    if (ChuMeComponents && ChuMeComponents.ModalManager) {
        ChuMeComponents.ModalManager.show('calendar-modal', {
            animationDuration: 200,
            closeOnBackdropClick: true,
            closeOnEsc: true
        });
    } else {
        // 回退到原始实现
        const modal = document.getElementById('calendar-modal');
        const card = document.getElementById('calendar-card');
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            card.classList.remove('scale-95');
            card.classList.add('scale-100');
        }, 10);
    }
    
    // 渲染日历
    if (waterCalendar) {
        waterCalendar.render(calDate, curStr);
        updateWaterCalendarViewToggle();
    } else {
        console.warn('日历组件未初始化，使用原始渲染');
        renderCalendarLegacy();
    }
}

function closeCalendar() {
    if (ChuMeComponents && ChuMeComponents.ModalManager) {
        ChuMeComponents.ModalManager.hide('calendar-modal', {
            animationDuration: 200
        });
    } else {
        closeCalendarLegacy();
    }
}

// 原始实现（兼容性回退）
function closeCalendarLegacy() {
    const modal = document.getElementById('calendar-modal');
    const card = document.getElementById('calendar-card');
    modal.classList.add('opacity-0');
    card.classList.remove('scale-100');
    card.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

function renderCalendarLegacy() {
    const y = calDate.getFullYear();
    const m = calDate.getMonth();
    const title = document.getElementById('cal-title');
    title.innerText = `${y}年 ${m + 1}月`;

    const dailyTotals = {};
    getAllData('water').then(history => {
        history.forEach(r => {
            dailyTotals[r.date] = (dailyTotals[r.date] || 0) + r.amount;
        });

        const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const grid = document.getElementById('cal-days');
        grid.innerHTML = "";

        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div></div>`;
        }

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const selectedStr = getWaterDateStr();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(y, m, d);
            const mm = (m + 1).toString().padStart(2, '0');
            const dd = d.toString().padStart(2, '0');
            const dStr = `${y}-${mm}-${dd}`;
            const isFuture = dateObj > today;
            const isSelected = dStr === selectedStr;

            let bgClass = "hover:bg-gray-100 text-slate-700 cursor-pointer";
            if (isSelected) bgClass = "bg-blue-500 text-white shadow-md hover:bg-blue-600";
            else if (isFuture) bgClass = "text-gray-300 pointer-events-none";

            const total = dailyTotals[dStr] || 0;
            let mark = '';
            if (total > 0) {
                const isMet = GOAL_TOTAL > 0 && total >= GOAL_TOTAL;
                const symbol = isMet ? '✓' : '×';
                const color = isSelected ? 'text-white' : (isMet ? 'text-green-500' : 'text-red-500');
                const sizeStyle = (!isMet) ? 'text-sm -mb-[2px]' : 'text-[10px]';
                mark = `<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 leading-none ${sizeStyle} ${color}">${symbol}</div>`;
            }

            grid.innerHTML += `
            <div onclick="selectCalDate('${dStr}')" class="relative w-8 h-9 mx-auto flex items-center justify-center rounded-lg text-sm font-medium transition-all ${bgClass}">
                ${d}
                ${mark}
            </div>
            `;
        }
    }).catch(err => {
        console.error('获取历史数据失败:', err);
        showToast('获取历史数据失败', 'error');
    });
}

function calChangeMonth(offset) {
    calDate.setMonth(calDate.getMonth() + offset);
    let selectedDate = getWaterDateStr();
    if (waterCalendar && waterCalendar.viewMode === 'week') {
        calDate = new Date(calDate.getFullYear(), calDate.getMonth(), 1);
        selectedDate = `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, '0')}-01`;
    }
    if (waterCalendar) {
        waterCalendar.render(calDate, selectedDate);
        updateWaterCalendarViewToggle();
    } else {
        renderCalendarLegacy();
    }
}

function toggleWaterCalendarView() {
    if (!waterCalendar) return;
    waterCalendar.toggleViewMode();
    updateWaterCalendarViewToggle();
    waterCalendar.render(calDate, getWaterDateStr());
}

function goToWaterCalendarToday() {
    const today = getCurrentDateString();
    const parts = today.split('-');
    calDate = new Date(parts[0], parts[1] - 1, parts[2]);
    waterPickDate(today);
    if (waterCalendar) {
        waterCalendar.render(calDate, today);
        updateWaterCalendarViewToggle();
    } else {
        renderCalendarLegacy();
    }
}

function updateWaterCalendarViewToggle() {
    const button = document.getElementById('cal-view-toggle');
    if (!button || !waterCalendar) return;
    button.innerText = waterCalendar.getToggleButtonText();
}

function selectCalDate(str) {
    waterPickDate(str);
    closeCalendar();
}

// Init
window.onload = function () {
    initInputs();
    initCalendar();
    initDrinkScroll();
    renderWaterApp();
}

// --- Data Sync & Conflict Resolution ---
let pendingConflicts = [];
let pendingNewData = [];

function exportWaterData() {
    getAllData('water').then(data => {
        const exportObj = {
            signature: 'chume_water_export_v1',
            timestamp: Date.now(),
            waterLog: data
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `ChuMe_Water_${getCurrentDateString().replace(/-/g, '')}.json`);
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        dlAnchorElem.remove();
        if (typeof showToast === 'function') showToast('喝水数据导出成功', 'success');
    }).catch(err => {
        console.error('导出失败:', err);
        if (typeof showToast === 'function') showToast('导出失败', 'error');
    });
}

document.getElementById('import-water-file')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.signature || !importedData.signature.includes('chume_water')) {
                throw new Error("Invalid file format");
            }
            
            // Fetch local data
            getAllData('water').then(localData => {
                const localByDate = new Map();
                localData.forEach(r => {
                    if (!localByDate.has(r.date)) localByDate.set(r.date, []);
                    localByDate.get(r.date).push(r);
                });
                
                const importByDate = new Map();
                if (Array.isArray(importedData.waterLog)) {
                    importedData.waterLog.forEach(r => {
                        if (!importByDate.has(r.date)) importByDate.set(r.date, []);
                        importByDate.get(r.date).push(r);
                    });
                }
                
                pendingConflicts = [];
                pendingNewData = [];
                
                importByDate.forEach((impArr, date) => {
                    if (!localByDate.has(date)) {
                        pendingNewData.push(...impArr);
                    } else {
                        const locArr = localByDate.get(date);
                        let isIdentical = false;
                        if (locArr.length === impArr.length) {
                            const sLoc = [...locArr].sort((a,b) => String(a.time).localeCompare(String(b.time)));
                            const sImp = [...impArr].sort((a,b) => String(a.time).localeCompare(String(b.time)));
                            isIdentical = true;
                            for (let i=0; i<sLoc.length; i++) {
                                let la = sLoc[i], ia = sImp[i];
                                if (la.time !== ia.time || la.type !== ia.type || la.amount !== ia.amount || la.isElec !== ia.isElec) {
                                    isIdentical = false; break;
                                }
                            }
                        }
                        
                        if (!isIdentical) {
                            pendingConflicts.push({ date: date, localArr: locArr, importArr: impArr });
                        }
                    }
                });
                
                if (pendingConflicts.length > 0) {
                    showConflictModal();
                } else {
                    // No conflicts, pure import
                    if (pendingNewData.length > 0) {
                        let promises = pendingNewData.map(record => saveData('water', record));
                        Promise.all(promises).then(() => {
                            if (typeof showToast === 'function') showToast(`成功带入 ${pendingNewData.length}条纯新喝水记录`, 'success');
                            renderWaterApp();
                            if (waterCalendar) waterCalendar.render(calDate, getWaterDateStr());
                        });
                    } else {
                        if (typeof showToast === 'function') showToast('没有发现新的记录', 'success');
                    }
                }
            }).catch(err => {
                console.error("Local DB error:", err);
                if (typeof showToast === 'function') showToast('读取本地数据失败', 'error');
            });
            
        } catch (err) {
            console.error(err);
            if (typeof showToast === 'function') showToast('文件格式不对', 'error');
        } finally {
            document.getElementById('import-water-file').value = '';
        }
    };
    reader.onerror = function() {
        if (typeof showToast === 'function') showToast('读取文件失败', 'error');
        document.getElementById('import-water-file').value = '';
    };
    reader.readAsText(file);
});

function showConflictModal() {
    const modal = document.getElementById('conflict-modal');
    const card = document.getElementById('conflict-card');
    if (!modal) return;
    
    document.getElementById('conflict-count').innerText = pendingConflicts.length;
    const listEl = document.getElementById('conflict-list');
    
    let html = '';
    const sortedConflicts = [...pendingConflicts].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    sortedConflicts.forEach((conf) => {
        const idx = pendingConflicts.indexOf(conf);
        let locRem = [...conf.localArr];
        let impRem = [...conf.importArr];

        for (let i = locRem.length - 1; i >= 0; i--) {
            const l = locRem[i];
            const matchIdx = impRem.findIndex(img => 
                img.time === l.time && img.type === l.type && img.amount === l.amount && img.isElec === l.isElec
            );
            if (matchIdx !== -1) {
                locRem.splice(i, 1);
                impRem.splice(matchIdx, 1);
            }
        }
        
        let diffHtml = '';
        locRem.sort((a,b) => String(a.time).localeCompare(String(b.time)));
        impRem.sort((a,b) => String(a.time).localeCompare(String(b.time)));
        
        locRem.forEach(l => {
            diffHtml += `<div class="leading-tight flex text-[11px]"><span class="inline-block w-11 shrink-0 text-gray-400">本地:</span> <span class="text-chume-brown">${l.time} ${l.type} <span class="font-bold text-chume-orange">${l.amount}ml</span></span></div>`;
        });
        
        impRem.forEach(i => {
            if (diffHtml !== '' && diffHtml.endsWith('</div>') && !diffHtml.includes('导入:')) {
                diffHtml += '<div class="h-1.5 w-full border-t border-dashed border-black/5 my-1"></div>';
            }
            diffHtml += `<div class="leading-tight flex text-[11px]"><span class="inline-block w-11 shrink-0 text-chume-orange/80">导入:</span> <span class="text-chume-brown">${i.time} ${i.type} <span class="font-bold text-chume-orange">${i.amount}ml</span></span></div>`;
        });

        if (diffHtml === '') diffHtml = '<div class="text-[11px] text-gray-400">数据相同（隐性冲突）</div>';

        html += `
        <div class="bg-gray-50 rounded-xl p-3 shadow-sm border border-black/5 mb-3 last:mb-0">
            <div class="text-[13px] font-bold text-chume-brown flex items-center justify-between font-num mb-2 border-b border-chume-brown/10 pb-2">
                <div class="flex items-center gap-1.5">
                    <span class="bg-chume-orange/10 text-chume-orange px-1.5 py-0.5 rounded text-[10px] leading-none">日期</span>
                    ${conf.date}
                </div>
                <div class="shrink-0 flex items-center bg-gray-200/80 rounded-full p-1 cursor-pointer w-[100px] h-[28px] relative transition-colors select-none" onclick="window.toggleConflict(${idx})">
                    <div id="slider-bg-${idx}" class="absolute left-1 top-1 w-[44px] h-[20px] bg-white rounded-full shadow-sm transition-transform duration-300"></div>
                    <div id="label-local-${idx}" class="relative z-10 w-1/2 text-center text-[11px] font-bold text-chume-brown transition-colors leading-[20px]">本地</div>
                    <div id="label-import-${idx}" class="relative z-10 w-1/2 text-center text-[11px] font-bold text-gray-400 transition-colors leading-[20px]">导入</div>
                    <input type="hidden" id="conflict-choice-${idx}" class="conflict-choice" value="local">
                </div>
            </div>
            <div class="bg-white p-2 rounded-lg border border-black/5 flex flex-col gap-1">
                ${diffHtml}
            </div>
        </div>`;
    });
    listEl.innerHTML = html;
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        if (card) {
            card.classList.remove('translate-y-full', 'sm:scale-95');
            card.classList.add('translate-y-0', 'sm:scale-100');
        }
    }, 10);
}

window.toggleConflict = function(idx) {
    const input = document.getElementById(`conflict-choice-${idx}`);
    const slider = document.getElementById(`slider-bg-${idx}`);
    const lLocal = document.getElementById(`label-local-${idx}`);
    const lImport = document.getElementById(`label-import-${idx}`);
    if (!input) return;
    if (input.value === 'local') {
        input.value = 'import';
        slider.style.transform = 'translateX(48px)';
        lLocal.className = "relative z-10 w-1/2 text-center text-[11px] font-bold text-gray-400 transition-colors leading-[20px]";
        lImport.className = "relative z-10 w-1/2 text-center text-[11px] font-bold text-chume-orange transition-colors leading-[20px]";
    } else {
        input.value = 'local';
        slider.style.transform = 'translateX(0)';
        lLocal.className = "relative z-10 w-1/2 text-center text-[11px] font-bold text-chume-brown transition-colors leading-[20px]";
        lImport.className = "relative z-10 w-1/2 text-center text-[11px] font-bold text-gray-400 transition-colors leading-[20px]";
    }
};

function closeConflictModal() {
    const modal = document.getElementById('conflict-modal');
    const card = document.getElementById('conflict-card');
    if (!modal) return;
    
    modal.classList.add('opacity-0');
    if (card) {
        card.classList.remove('translate-y-0', 'sm:scale-100');
        card.classList.add('translate-y-full', 'sm:scale-95');
    }
    setTimeout(() => {
        modal.classList.add('hidden');
        pendingConflicts = []; 
    }, 300);

    pendingNewData = [];
}

function overrideAllConflicts() {
    document.querySelectorAll('.conflict-choice').forEach(input => {
        if (input.value === 'local') {
            const idx = input.id.replace('conflict-choice-', '');
            window.toggleConflict(idx);
        }
    });
}

function confirmConflictMerge() {
    let resolvedCnt = 0;
    let promises = [];
    
    document.querySelectorAll('.conflict-choice').forEach((input) => {
        const idx = parseInt(input.id.replace('conflict-choice-', ''));
        const conf = pendingConflicts[idx];
        if (input.value === 'import') {
            conf.localArr.forEach(r => promises.push(deleteData('water', String(r.id))));
            conf.importArr.forEach(r => promises.push(saveData('water', r)));
            resolvedCnt++;
        }
    });
    
    if (pendingNewData.length > 0) {
        pendingNewData.forEach(r => {
            promises.push(saveData('water', r));
        });
    }
    
    if (promises.length > 0) {
        Promise.all(promises).then(() => {
            const modal = document.getElementById('conflict-modal');
            const card = document.getElementById('conflict-card');
            modal.classList.add('opacity-0');
            if (card) {
                card.classList.remove('translate-y-0', 'sm:scale-100');
                card.classList.add('translate-y-full', 'sm:scale-95');
            }
            setTimeout(() => {
                modal.classList.add('hidden');
                pendingConflicts = [];
                pendingNewData = [];
            }, 300);
            
            if (typeof showToast === 'function') showToast(`成功导入 ${pendingNewData.length}条新记录并覆盖 ${resolvedCnt}条冲突`, 'success');
            renderWaterApp();
            if (waterCalendar) waterCalendar.render(calDate, getWaterDateStr());
        });
    } else {
        closeConflictModal();
    }
}

// 全局导出（供HTML内联事件使用）
window.waterApp = {
    selectQuickVol,
    addWater,
    delWater,
    editWater,
    saveGoals,
    initDrinkScroll,
    sortWaterRecordsForDisplay,
    waterChangeDate,
    openCalendar,
    closeCalendar,
    calChangeMonth,
    selectCalDate,
    exportWaterData,
    closeConflictModal,
    overrideAllConflicts,
    confirmConflictMerge
};
