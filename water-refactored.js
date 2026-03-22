/**
 * water.js - 重构版本
 * 使用共享UI组件库消除重复代码
 */

import { CalendarComponent, ModalManager } from './components.js';

// ==================== 全局变量 ====================
let waterViewOffset = 0;
let quickVol = 0;
let calDate = new Date();

// 目标设置
let GOAL_TOTAL = 0;
let GOAL_ELEC = 0;
let GOAL_TIME = 0;

// 日历组件实例
let waterCalendar = null;

// ==================== 初始化 ====================

/**
 * 初始化喝水应用
 */
function initWaterApp() {
    loadSettings();
    initCalendar();
    initEventListeners();
    renderWaterApp();
}

/**
 * 初始化日历组件
 */
function initCalendar() {
    waterCalendar = new CalendarComponent({
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
            ModalManager.hide('calendar-modal');
        },
        selectedClass: 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
    });
}

/**
 * 初始化事件监听器
 */
function initEventListeners() {
    // 日期导航
    document.getElementById('btn-today')?.addEventListener('click', () => {
        waterViewOffset = 0;
        renderWaterApp();
    });
    
    document.getElementById('btn-prev')?.addEventListener('click', () => {
        waterViewOffset--;
        renderWaterApp();
    });
    
    document.getElementById('btn-next')?.addEventListener('click', () => {
        waterViewOffset++;
        renderWaterApp();
    });
    
    // 快速水量按钮
    document.querySelectorAll('.vol-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const vol = parseInt(e.target.dataset.vol);
            quickVol = vol;
            updateQuickVolUI();
        });
    });
    
    // 日历按钮
    document.getElementById('btn-calendar')?.addEventListener('click', showCalendar);
    
    // 日历导航按钮
    document.getElementById('cal-prev')?.addEventListener('click', () => {
        waterCalendar.prevMonth();
    });
    
    document.getElementById('cal-next')?.addEventListener('click', () => {
        waterCalendar.nextMonth();
    });
    
    document.getElementById('cal-today')?.addEventListener('click', () => {
        waterCalendar.goToToday();
    });
    
    // 设置按钮
    document.getElementById('btn-settings')?.addEventListener('click', () => {
        window.location.href = 'settings.html';
    });
}

// ==================== 核心功能 ====================

/**
 * 渲染喝水应用主界面
 */
function renderWaterApp() {
    const dateStr = getWaterDateStr();
    loadAndRenderData(dateStr);
    updateDateUI();
    updateGoalUI();
    updateQuickVolUI();
}

/**
 * 获取当前显示的日期字符串
 */
function getWaterDateStr() {
    return getDateStr(waterViewOffset);
}

/**
 * 加载并渲染数据
 */
async function loadAndRenderData(dateStr) {
    try {
        const history = await getDataByIndex('water', 'date', dateStr);
        const total = history.reduce((sum, r) => sum + r.amount, 0);
        const elec = history.filter(r => r.isElec).reduce((sum, r) => sum + r.amount, 0);
        
        updateWaterUI(total, elec);
        updateProgress(total);
    } catch (error) {
        console.error('加载数据失败:', error);
        showToast('加载数据失败', 'error');
    }
}

/**
 * 更新水量UI
 */
function updateWaterUI(total, elec) {
    const totalEl = document.getElementById('metric-water');
    const elecEl = document.getElementById('metric-elec');
    
    if (totalEl) totalEl.innerText = `${total} ml`;
    if (elecEl) elecEl.innerText = `${elec} ml`;
    
    // 高亮电解质目标达成
    if (GOAL_ELEC > 0 && elec >= GOAL_ELEC) {
        elecEl.classList.add('text-amber-500');
    } else {
        elecEl.classList.remove('text-amber-500');
    }
}

/**
 * 更新进度条
 */
function updateProgress(total) {
    const progressBar = document.getElementById('water-progress-bar');
    const progressText = document.getElementById('water-progress-text');
    
    if (!progressBar || !progressText) return;
    
    const percent = GOAL_TOTAL > 0 ? Math.min(total / GOAL_TOTAL, 1) : 0;
    const degrees = percent * 360;
    
    progressBar.style.transform = `rotate(${degrees}deg)`;
    progressText.innerText = `${Math.round(percent * 100)}%`;
    
    // 更新颜色
    if (percent >= 1) {
        progressBar.classList.add('text-green-500');
        progressBar.classList.remove('text-blue-500', 'text-yellow-500');
    } else if (percent >= 0.75) {
        progressBar.classList.add('text-yellow-500');
        progressBar.classList.remove('text-blue-500', 'text-green-500');
    } else {
        progressBar.classList.add('text-blue-500');
        progressBar.classList.remove('text-yellow-500', 'text-green-500');
    }
}

/**
 * 更新日期UI
 */
function updateDateUI() {
    const dateEl = document.getElementById('water-date');
    if (!dateEl) return;
    
    const dateStr = getWaterDateStr();
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    
    dateEl.innerText = `${month}月${day}日 ${weekday}`;
    
    // 更新背景色
    const bg = document.getElementById("water-dash-bg");
    if (bg) {
        if (waterViewOffset !== 0) {
            bg.classList.add("bg-gray-100");
            bg.classList.remove("bg-white");
        } else {
            bg.classList.remove("bg-gray-100");
            bg.classList.add("bg-white");
        }
    }
}

/**
 * 更新目标UI
 */
function updateGoalUI() {
    const goalLabel = document.getElementById('water-goal-label');
    if (!goalLabel) return;
    
    if (GOAL_TOTAL > 0) {
        goalLabel.innerText = `/ ${GOAL_TOTAL} ml`;
        goalLabel.classList.remove("text-gray-300");
        goalLabel.classList.add("text-gray-400");
    } else {
        goalLabel.innerText = `/ 未设置`;
        goalLabel.classList.remove("text-gray-400");
        goalLabel.classList.add("text-gray-300");
    }
}

/**
 * 更新快速水量按钮UI
 */
function updateQuickVolUI() {
    document.querySelectorAll('.vol-btn').forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white', 'border-blue-500');
        btn.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
    });
    
    if (quickVol > 0) {
        const btn = document.getElementById(`btn-vol-${quickVol}`);
        if (btn) {
            btn.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            btn.classList.add('bg-blue-500', 'text-white', 'border-blue-500');
        }
    }
}

// ==================== 日历功能 ====================

/**
 * 显示日历
 */
function showCalendar() {
    const parts = getWaterDateStr().split('-');
    calDate = new Date(parts[0], parts[1] - 1, parts[2]);
    
    ModalManager.show('calendar-modal', {
        animationDuration: 200,
        closeOnBackdropClick: true,
        closeOnEsc: true
    });
    
    waterCalendar.render(calDate, getWaterDateStr());
}

/**
 * 关闭日历
 */
function closeCalendar() {
    ModalManager.hide('calendar-modal', {
        animationDuration: 200
    });
}

/**
 * 选择日历日期
 */
function selectCalDate(dateStr) {
    waterPickDate(dateStr);
    closeCalendar();
}

/**
 * 根据日期字符串选择日期
 */
function waterPickDate(dateStr) {
    const today = getDateStr(0);
    const targetDate = new Date(dateStr);
    const todayDate = new Date(today);
    
    const diffTime = targetDate - todayDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    waterViewOffset = diffDays;
    renderWaterApp();
}

// ==================== 数据操作 ====================

/**
 * 记录喝水
 */
async function logWater(amount, isElec = false) {
    const dateStr = getWaterDateStr();
    const record = {
        id: generateId(),
        date: dateStr,
        amount: amount,
        isElec: isElec,
        timestamp: Date.now()
    };
    
    try {
        await saveData('water', record);
        showToast(`${amount}ml 记录成功`, 'success');
        renderWaterApp();
    } catch (error) {
        console.error('记录失败:', error);
        showToast('记录失败', 'error');
    }
}

/**
 * 快速记录喝水
 */
function quickLog() {
    if (quickVol <= 0) {
        showToast('请选择水量', 'warning');
        return;
    }
    
    const isElec = document.getElementById('quick-elec')?.checked || false;
    logWater(quickVol, isElec);
}

/**
 * 自定义记录
 */
function customLog() {
    const amountInput = document.getElementById('custom-amount');
    const amount = parseInt(amountInput?.value) || 0;
    
    if (amount <= 0) {
        showToast('请输入有效水量', 'warning');
        return;
    }
    
    const isElec = document.getElementById('custom-elec')?.checked || false;
    logWater(amount, isElec);
    
    // 清空输入
    if (amountInput) amountInput.value = '';
}

// ==================== 设置相关 ====================

/**
 * 加载设置
 */
function loadSettings() {
    const settings = getPref('water_settings') || {};
    GOAL_TOTAL = settings.totalGoal || 0;
    GOAL_ELEC = settings.elecGoal || 0;
    GOAL_TIME = settings.timeGoal || 0;
    quickVol = settings.quickVol || 0;
}

/**
 * 保存设置
 */
function saveSettings() {
    const settings = {
        totalGoal: GOAL_TOTAL,
        elecGoal: GOAL_ELEC,
        timeGoal: GOAL_TIME,
        quickVol: quickVol
    };
    
    if (savePref('water_settings', settings)) {
        showToast('设置已保存', 'success');
        renderWaterApp();
    }
}

// ==================== 页面加载 ====================

/**
 * 页面加载完成
 */
window.addEventListener('load', () => {
    initWaterApp();
});

// ==================== 全局导出 ====================

// 导出给HTML内联事件使用
window.waterApp = {
    quickLog,
    customLog,
    showCalendar,
    closeCalendar,
    selectCalDate,
    saveSettings,
    prevMonth: () => waterCalendar?.prevMonth(),
    nextMonth: () => waterCalendar?.nextMonth(),
    goToToday: () => waterCalendar?.goToToday()
};