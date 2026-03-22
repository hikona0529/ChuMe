/**
 * med-reminders.js
 * 功能：处理 med-reminders.html 的所有本地存取、表单弹出与规则管理
 */

// ---------------------------
// 1. 数据常量与全局状态
// ---------------------------
const KEYS = {
    INVENTORY: 'med_inventory', // 由我的药箱提供，只读
    RULES: 'med_rules',         // 本页负责写入的服药规则
    LOGS: 'med_logs'            // 服药打卡记录
};

let currentBoardTab = '早'; // 当前高亮的主渲染时段
window._currentGroups = {}; // 用于存储当前页面的聚合组，方便打卡点击

// 安全解析读取
function readLocal(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveLocal(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// 防 XSS 注入
function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (match) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[match];
    });
}

// ---------------------------
// 2. DOM 映射表
// ---------------------------
const dom = {
    list: document.getElementById('reminder-list'),
    dateTitle: document.getElementById('header-date'),
    boardTabs: document.querySelectorAll('.board-tab-btn'),
    btnAdd: document.getElementById('btn-add-rule'),

    // 抽屉与遮罩
    backdrop: document.getElementById('form-backdrop'),
    sheet: document.getElementById('form-sheet'),
    btnClose: document.getElementById('btn-close-form'),
    formTitle: document.getElementById('form-title'),
    btnSave: document.getElementById('btn-save-rule'),
    btnDeleteEntire: document.getElementById('btn-delete-entire-rule'),

    // 表单元素
    fForm: document.getElementById('rule-form'),
    fId: document.getElementById('rule-id'),
    fMed: document.getElementById('rule-med-select'),
    fDose: document.getElementById('rule-dose'),
    fDoseUnit: document.getElementById('rule-dose-unit'),

    // 分段与周期（使用组件库）
    periodsContainer: '.btn-period-container',
    mealsContainer: '.btn-meal-container',
    weeksContainer: '.week-chips-container',
    
    btnEveryday: document.getElementById('btn-everyday'),
    fStart: document.getElementById('rule-start'),
    fEnd: document.getElementById('rule-end'),

    // 缺货弹窗 DOM
    modalStock: document.getElementById('out-of-stock-modal'),
    modalStockTitle: document.getElementById('out-of-stock-title'),
    btnGotoAddMed: document.getElementById('btn-goto-add-med'),
    btnGotoChangeRule: document.getElementById('btn-goto-change-rule'),
    btnCloseStockModal: document.getElementById('btn-close-stock-modal'),
    modalStockBackdrop: document.getElementById('out-of-stock-backdrop'),
    modalStockCard: document.getElementById('out-of-stock-card')
};

// 组件实例
let boardTabSwitcher = null;
let periodChipSelector = null;
let mealChipSelector = null;
let weekChipSelector = null;

// ---------------------------
// 3. 界面初始化与渲染
// ---------------------------
function init() {
    setHeader();
    initBoardTabs();
    attachGlobalListeners();
    populateMedSelect();
}

function setHeader() {
    const now = new Date();
    const mm = now.getMonth() + 1;
    const dd = now.getDate();
    const w = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    dom.dateTitle.innerText = `${mm}月${dd}日 星期${w}`;
}

// ---------------------------
// 3.5. 顶部大 Tab 的自动响应与挂靠（使用TabSwitcher）
// ---------------------------
function initBoardTabs() {
    const hour = new Date().getHours();

    // 按时间自动定位优先级
    if (hour >= 5 && hour < 11) currentBoardTab = '早';
    else if (hour >= 11 && hour < 16) currentBoardTab = '中';
    else if (hour >= 16 && hour < 21) currentBoardTab = '晚';
    else currentBoardTab = '睡前';

    // 尝试使用TabSwitcher组件
    try {
        if (typeof ChuMeComponents !== 'undefined' && ChuMeComponents.TabSwitcher) {
            boardTabSwitcher = new ChuMeComponents.TabSwitcher({
                containerSelector: '.board-tabs-container',
                tabSelector: '.board-tab-btn',
                onTabChange: (tab, dataPeriod) => {
                    currentBoardTab = dataPeriod;
                    
                    // 触发列表动画刷新
                    dom.list.classList.remove('animate-fade-in');
                    void dom.list.offsetWidth; // 强迫重排以触发动画
                    dom.list.classList.add('animate-fade-in');

                    renderBoard();
                },
                selectedClass: 'bg-chume-pink text-white font-bold shadow-sm border-transparent',
                deselectedClass: 'text-chume-brown-light hover:text-chume-brown border-chume-brown/10',
                activeTab: currentBoardTab
            });
        }
    } catch (e) {
        console.error('初始化TabSwitcher失败:', e);
        initBoardTabsFallback();
    }

    updateBoardTabUI();
    renderBoard();
}

// 兼容性回退
function initBoardTabsFallback() {
    dom.boardTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            currentBoardTab = btn.dataset.period;
            updateBoardTabUI();

            // 触发列表动画刷新
            dom.list.classList.remove('animate-fade-in');
            void dom.list.offsetWidth;
            dom.list.classList.add('animate-fade-in');

            renderBoard();
        });
    });
}

function updateBoardTabUI() {
    // 如果组件可用，使用组件更新
    if (boardTabSwitcher) {
        boardTabSwitcher.setActiveTab(currentBoardTab);
    } else {
        // 回退到原有逻辑
        dom.boardTabs.forEach(btn => {
            if (btn.dataset.period === currentBoardTab) {
                btn.classList.replace('text-chume-brown-light', 'text-white');
                btn.classList.add('bg-chume-pink', 'font-bold', 'shadow-sm', 'border-transparent');
                btn.classList.remove('hover:text-chume-brown', 'border-chume-brown/10');
            } else {
                btn.classList.replace('text-white', 'text-chume-brown-light');
                btn.classList.remove('bg-chume-pink', 'shadow-sm', 'border-transparent');
                btn.classList.add('hover:text-chume-brown');
            }
        });
    }
}

// 获取每种药的平均每日需求
function getDailyConsumptions() {
    const rules = readLocal(KEYS.RULES);
    const consumption = {};

    rules.forEach(rule => {
        let pLen = (rule.period && Array.isArray(rule.period) && rule.period.length > 0) ? rule.period.length : 1;
        let mLen = (rule.meal && Array.isArray(rule.meal) && rule.meal.length > 0) ? rule.meal.length : 1;
        let wLen = (rule.weekdays && Array.isArray(rule.weekdays)) ? rule.weekdays.length : 7;

        let weekly = rule.dose * pLen * mLen * wLen;
        let daily = weekly / 7;

        if (!consumption[rule.medId]) consumption[rule.medId] = 0;
        consumption[rule.medId] += daily;
    });

    return consumption;
}

// 渲染列表结构
function renderBoard() {
    const inv = readLocal(KEYS.INVENTORY);
    const rules = readLocal(KEYS.RULES);

    if (rules.length === 0) {
        dom.list.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full pt-20 text-gray-400 space-y-4">
                <div class="text-6xl text-gray-200"><i class="fa-solid fa-list-check"></i></div>
                <p class="text-[15px]">今天还没有任何服药规则，快来添加吧！</p>
            </div>
        `;
        return;
    }

    // 聚合规则逻辑：只过滤当前选中的 currentBoardTab
    const grouped = {};
    const mealOrder = { '餐前': 1, '随餐': 2, '餐后': 3 };
    let hasRulesInTab = false;

    // 先获取今天的日期用于比对
    const todayStr = new Date().toISOString().split('T')[0];

    rules.forEach(rule => {
        // --- 核心过滤点一：生效日期拦截 ---
        if (rule.startDate && todayStr < rule.startDate) return;
        if (rule.endDate && todayStr > rule.endDate) return;

        const med = inv.find(m => m.id === rule.medId) || { name: '未知药品', unit: '?' };

        let pArr = rule.period && Array.isArray(rule.period) && rule.period.length > 0 ? rule.period : ['未定时段'];
        let mArr = rule.meal && Array.isArray(rule.meal) && rule.meal.length > 0 ? rule.meal : [''];

        // 核心过滤点二：该药品的服药周期是否包含当前点选的时段？
        if (!pArr.includes(currentBoardTab)) return;

        hasRulesInTab = true;

        mArr.forEach(m => {
            let key = m || '无场景限制';

            if (!grouped[key]) {
                grouped[key] = {
                    title: key,
                    mealKey: m,
                    items: []
                };
            }

            grouped[key].items.push({
                ruleId: rule.ruleId,
                medId: rule.medId, // 绑定以用于扣除库存
                name: med.name,
                brand: med.brand,
                dose: rule.dose,
                unit: med.unit,
                weekdays: rule.weekdays,
                stock: Number(med.stock) || 0
            });
        });
    });

    // 每次渲染前清空挂载的分组对象
    window._currentGroups = {};

    if (!hasRulesInTab) {
        dom.list.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full pt-20 text-gray-400 space-y-4">
                <div class="text-6xl text-gray-200"><i class="fa-solid fa-mug-hot"></i></div>
                <p class="text-[15px]">当前时段没有需要服用的药物👏</p>
            </div>
        `;
        return;
    }

    const groupArray = Object.values(grouped);

    // 对分组按照餐前后进行排序
    groupArray.sort((a, b) => {
        let m1 = mealOrder[a.mealKey] || 99;
        let m2 = mealOrder[b.mealKey] || 99;
        return m1 - m2;
    });

    const dailyConsumptions = getDailyConsumptions();
    const logs = readLocal(KEYS.LOGS);
    let html = '';

    groupArray.forEach(group => {
        // 挂载用于打卡回查
        window._currentGroups[group.title] = group;

        // 检查今天此刻该场景是否已打卡过记录
        let takenTimeStr = null;
        let isTaken = false;
        let matchingLogObj = null;

        const matchingLog = logs.find(lg => {
            if (lg.period !== currentBoardTab) return false;
            let lgMeal = lg.meal || '';
            let gMeal = group.mealKey || '';
            if (lgMeal !== gMeal) return false;

            if (!lg.actualTime) return false;
            let logDate = lg.actualTime.split('T')[0];
            return logDate === todayStr;
        });

        if (matchingLog) {
            isTaken = true;
            matchingLogObj = matchingLog;
            const d = new Date(matchingLog.actualTime);
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            takenTimeStr = `今日 ${hh}:${min}`;
        }

        html += `
        <div class="bg-white rounded-[1.25rem] p-4 shadow-sm border border-gray-100 mb-4 relative overflow-hidden group">
            <div class="flex items-center justify-between mb-3 border-b border-gray-50 pb-2.5">
                <span class="text-[17px] font-bold text-gray-800 tracking-tight">${group.title}</span>
            </div>
            
            <div class="space-y-3 mb-4">
        `;

        group.items.forEach(item => {
            let daily = dailyConsumptions[item.medId] || 0;
            let daysLeft = daily > 0 ? Math.floor(item.stock / daily) : Infinity;
            let warningHtml = '';
            if (daysLeft < 7) {
                let timesLeft = item.dose > 0 ? Math.floor(item.stock / item.dose) : 0;
                let txt = timesLeft <= 0 ? '打卡库存不足！' : `还剩 ${item.stock} ${esc(item.unit)}，只够吃 ${timesLeft} 次啦！`;
                warningHtml = `<div class="mt-1.5 text-[11px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded inline-flex items-center space-x-1 w-fit"><i class="fa-solid fa-triangle-exclamation"></i> <span>预警：${txt}</span></div>`;
            }

            html += `
                <div class="bg-gray-50/70 border border-gray-100 rounded-[14px] p-4 flex flex-col group/item hover:bg-white transition-colors relative">
                    <!-- 头部：药名 + 动作按钮水平居右 -->
                    <div class="flex justify-between items-start w-full mb-1">
                        <span class="font-bold text-gray-800 text-[15px] pr-2 break-all">${esc(item.name)}</span>
                        
                        <div class="flex items-center space-x-3 text-gray-400 shrink-0">
                            <button class="w-7 h-7 flex items-center justify-center active:scale-90 transition-all text-[15px] hover:text-gray-600" onclick="editRule('${item.ruleId}')" aria-label="编辑规则">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="w-7 h-7 flex items-center justify-center active:scale-90 transition-all text-[15px] hover:text-gray-600" onclick="copyRule('${item.ruleId}')" aria-label="同配置新增">
                                <i class="fa-solid fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- 底部：星期 + 数量 -->
                    <div class="flex justify-between items-end w-full mt-2">
                        <div class="text-[12px] text-gray-500 bg-white/60 px-2 py-0.5 rounded-md border border-gray-100">
                            ${renderWeekdays(item.weekdays)}
                        </div>
                        <div class="text-right flex items-baseline space-x-1.5">
                            <span class="text-[11px] text-gray-400 font-medium">服用</span>
                            <span class="text-[20px] font-bold text-macaroon-pink tracking-tight leading-none">${item.dose}</span> 
                            <span class="text-[11px] text-gray-500 font-medium">${esc(item.unit)}</span>
                        </div>
                    </div>
                    ${warningHtml}
                </div>
            `;
        });

        let actionBtnHtml = '';
        if (isTaken) {
            actionBtnHtml = `
            <div class="flex items-center space-x-2 w-full mt-2">
                <button disabled class="flex-1 bg-gray-100/80 text-gray-400 rounded-xl py-3 text-[14px] font-bold flex items-center justify-center space-x-2 cursor-not-allowed border border-gray-100">
                    <i class="fa-solid fa-check"></i>
                    <span class="tracking-widest">已完成</span>
                </button>
                <button onclick="editTakenTime('${matchingLogObj.logId}')" class="shrink-0 bg-white border border-gray-200 text-gray-500 hover:text-gray-700 rounded-xl px-4 py-3 text-[13px] font-bold active:scale-95 transition-all flex items-center justify-center">
                    <i class="fa-solid fa-clock mr-1.5"></i> ${takenTimeStr} <i class="fa-solid fa-angle-right ml-2 text-[10px]"></i>
                </button>
            </div>
            `;
        } else {
            actionBtnHtml = `
            <button onclick="takeMedsGroup('${group.title}')" class="w-full bg-macaroon-green/10 text-teal-800 hover:bg-macaroon-green/30 rounded-xl py-3 text-[14px] font-bold active:scale-95 transition-all flex items-center justify-center space-x-2 tracking-widest border border-transparent">
                <i class="fa-solid fa-check-circle"></i>
                <span>打卡</span>
            </button>
            `;
        }

        html += `
            </div>
            ${actionBtnHtml}
        </div>
        `;
    });

    dom.list.innerHTML = html;
}

// 辅助渲染星期几的文本
function renderWeekdays(arr) {
    if (!arr || arr.length === 0) return '无';
    if (arr.length === 7) return '每天';
    const map = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '0': '日' };
    return arr.map(d => map[d]).join('、');
}

// 填充所属药品的选择下拉单
function populateMedSelect() {
    const inv = readLocal(KEYS.INVENTORY);
    dom.fMed.innerHTML = '<option value="">请选择药箱中的药品...</option>';
    inv.forEach(med => {
        const o = document.createElement('option');
        o.value = med.id;
        // 把单位也偷偷存在 data 里，选中的时候好调出来显摆
        o.dataset.unit = med.unit || '单位';
        o.textContent = med.name + (med.brand ? ` (${med.brand})` : '');
        dom.fMed.appendChild(o);
    });
}

// ---------------------------
// 4. 表单交互与滑块核心
// ---------------------------

// 初始化芯片选择器
function initChipSelectors() {
    try {
        if (typeof ChuMeComponents !== 'undefined' && ChuMeComponents.ChipSelector) {
            // 时段选择器
            periodChipSelector = new ChuMeComponents.ChipSelector({
                containerSelector: dom.periodsContainer,
                chipSelector: '.btn-period',
                onSelect: (chip, value) => {},
                onDeselect: () => {},
                singleSelect: false,
                selectedClass: 'bg-macaroon-pink text-white border-transparent font-bold',
                deselectedClass: 'bg-white text-gray-600 border-gray-200'
            });

            // 餐点选择器
            mealChipSelector = new ChuMeComponents.ChipSelector({
                containerSelector: dom.mealsContainer,
                chipSelector: '.btn-meal',
                onSelect: (chip, value) => {},
                onDeselect: () => {},
                singleSelect: false,
                selectedClass: 'bg-macaroon-pink text-white border-transparent font-bold',
                deselectedClass: 'bg-white text-gray-600 border-gray-200'
            });

            // 星期选择器
            weekChipSelector = new ChuMeComponents.ChipSelector({
                containerSelector: dom.weeksContainer,
                chipSelector: '.week-chip',
                onSelect: (chip, value) => {},
                onDeselect: () => {},
                singleSelect: false,
                selectedClass: 'bg-gray-800 text-white border-gray-800',
                deselectedClass: 'text-gray-500 border-gray-200'
            });
        }
    } catch (e) {
        console.error('初始化芯片选择器失败:', e);
    }
}

// 事件挂载大本营
function attachGlobalListeners() {
    // 初始化芯片选择器
    initChipSelectors();

    // 药品选取变化，联动单位展示
    dom.fMed.addEventListener('change', (e) => {
        const selected = e.target.options[e.target.selectedIndex];
        dom.fDoseUnit.innerText = selected.dataset.unit || '粒';
    });

    // 星期全选
    dom.btnEveryday.addEventListener('click', () => {
        if (weekChipSelector) {
            // 全选所有星期
            document.querySelectorAll('.week-chip').forEach(chip => {
                weekChipSelector.select(chip.textContent);
            });
        } else {
            // 回退逻辑
            document.querySelectorAll('.week-chip').forEach(c => {
                c.classList.add('bg-gray-800', 'text-white', 'border-gray-800');
                c.classList.remove('text-gray-500', 'border-gray-200');
            });
        }
    });

    // 抽屉展开与收回
    dom.btnAdd.addEventListener('click', () => {
        resetForm();
        dom.formTitle.innerText = '新增提醒规则';
        openSheet();
    });

    dom.btnClose.addEventListener('click', closeSheet);
    dom.backdrop.addEventListener('click', closeSheet);

    // 缺货弹窗监听
    if (dom.btnCloseStockModal) dom.btnCloseStockModal.addEventListener('click', hideStockModal);
    if (dom.modalStockBackdrop) dom.modalStockBackdrop.addEventListener('click', hideStockModal);

    // 最终存储兵团
    dom.btnSave.addEventListener('click', saveRuleData);

    // 彻底删除兵团
    dom.btnDeleteEntire.addEventListener('click', deleteEntireRule);
}

// 表单擦黑板
function resetForm() {
    dom.fId.value = '';
    dom.fMed.value = '';
    dom.fDose.value = '';
    dom.fDoseUnit.innerText = '-';

    // 还原分段器（使用组件库）
    if (periodChipSelector) {
        periodChipSelector.deselectAll();
    } else {
        document.querySelectorAll('.btn-period').forEach(b => {
            b.classList.remove('bg-macaroon-pink', 'text-white', 'border-transparent', 'font-bold');
            b.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
        });
    }

    if (mealChipSelector) {
        mealChipSelector.deselectAll();
    } else {
        document.querySelectorAll('.btn-meal').forEach(b => {
            b.classList.remove('bg-macaroon-pink', 'text-white', 'border-transparent', 'font-bold');
            b.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
        });
    }

    // 星期还原（默认全灰）
    if (weekChipSelector) {
        weekChipSelector.deselectAll();
    } else {
        document.querySelectorAll('.week-chip').forEach(c => {
            c.classList.remove('bg-gray-800', 'text-white', 'border-gray-800');
            c.classList.add('text-gray-500', 'border-gray-200');
        });
    }

    // 日期重白
    dom.fStart.value = new Date().toISOString().split('T')[0];
    dom.fEnd.value = '';

    // 默认隐藏彻底删除按钮
    dom.btnDeleteEntire.classList.add('hidden');
}

// 辅助方法，展开/合起
function openSheet() {
    dom.backdrop.classList.replace('backdrop-hidden', 'backdrop-visible');
    dom.sheet.classList.replace('sheet-hidden', 'sheet-visible');
}

function closeSheet() {
    dom.sheet.classList.replace('sheet-visible', 'sheet-hidden');
    dom.backdrop.classList.replace('backdrop-visible', 'backdrop-hidden');
}

// 缺货预警 Modal 控制
function showStockModal(medName, ruleId) {
    if (!dom.modalStock) return;

    // 配置文案与事件参数
    if (dom.modalStockTitle) dom.modalStockTitle.innerText = `【${esc(medName)}】`;

    // 去录入新药 -> 跳转
    if (dom.btnGotoAddMed) {
        dom.btnGotoAddMed.onclick = () => {
            window.location.href = 'medicine.html?action=add';
        };
    }

    // 去换药 -> 关弹窗开底边栏
    if (dom.btnGotoChangeRule) {
        dom.btnGotoChangeRule.onclick = () => {
            hideStockModal();
            window.editRule(ruleId);
        };
    }

    // 显形
    dom.modalStock.classList.remove('hidden');
    dom.modalStock.classList.add('flex');

    // 下一帧触发动效
    requestAnimationFrame(() => {
        if (dom.modalStockCard) {
            dom.modalStockCard.classList.remove('scale-95', 'opacity-0');
            dom.modalStockCard.classList.add('scale-100', 'opacity-100');
        }
    });
}

function hideStockModal() {
    if (!dom.modalStock) return;

    if (dom.modalStockCard) {
        dom.modalStockCard.classList.remove('scale-100', 'opacity-100');
        dom.modalStockCard.classList.add('scale-95', 'opacity-0');
    }

    setTimeout(() => {
        dom.modalStock.classList.add('hidden');
        dom.modalStock.classList.remove('flex');
    }, 300); // UI transition 退场延迟
}

// ---------------------------
// 5. 存储、挂载、编辑、复制、删除核心
// ---------------------------

function saveRuleData(e) {
    e.preventDefault();

    if (!dom.fForm.checkValidity()) {
        dom.fForm.reportValidity();
        return;
    }

    // 手工探测星期是否有选
    const pickedDays = [];
    if (weekChipSelector) {
        const selectedWeekChips = weekChipSelector.getSelectedElements();
        selectedWeekChips.forEach(chip => {
            pickedDays.push(chip.dataset.day);
        });
    } else {
        // 回退逻辑
        document.querySelectorAll('.week-chip').forEach(c => {
            if (c.classList.contains('bg-gray-800')) pickedDays.push(c.dataset.day);
        });
    }

    if (pickedDays.length === 0) {
        alert('最少得选一天打卡吃药哦💊');
        return;
    }

    // 提取时间分段（多选提取数组）
    const selectedPeriods = [];
    if (periodChipSelector) {
        const selectedPeriodChips = periodChipSelector.getSelectedElements();
        selectedPeriodChips.forEach(chip => {
            selectedPeriods.push(chip.dataset.val);
        });
    } else {
        // 回退逻辑
        document.querySelectorAll('.btn-period').forEach(b => {
            if (b.classList.contains('bg-macaroon-pink')) selectedPeriods.push(b.dataset.val);
        });
    }

    if (selectedPeriods.length === 0) {
        alert('请至少选择一个服药时段哦💊');
        return;
    }

    const selectedMeals = [];
    if (mealChipSelector) {
        const selectedMealChips = mealChipSelector.getSelectedElements();
        selectedMealChips.forEach(chip => {
            selectedMeals.push(chip.dataset.val);
        });
    } else {
        // 回退逻辑
        document.querySelectorAll('.btn-meal').forEach(b => {
            if (b.classList.contains('bg-macaroon-pink')) selectedMeals.push(b.dataset.val);
        });
    }

    const payload = {
        medId: dom.fMed.value,
        dose: Number(dom.fDose.value),
        weekdays: pickedDays,
        period: selectedPeriods,
        meal: selectedMeals.length > 0 ? selectedMeals : null,
        startDate: dom.fStart.value || null,
        endDate: dom.fEnd.value || null
    };

    let rules = readLocal(KEYS.RULES);
    const ruleId = dom.fId.value;

    if (ruleId) {
        // 更新模式
        rules = rules.map(r => r.ruleId === ruleId ? { ...r, ...payload, ruleId: ruleId } : r);
    } else {
        // 新增模式
        payload.ruleId = 'Rule_' + Date.now();
        rules.push(payload);
    }

    saveLocal(KEYS.RULES, rules);
    closeSheet();
    renderBoard();
}

// 一键填充，提供给编辑和复制用
function fillSheetWithRule(ruleObj, isCopy = false) {
    if (!isCopy) dom.fId.value = ruleObj.ruleId; // 复制时不带身契ID

    // 基础输入恢复
    dom.fMed.value = ruleObj.medId;
    dom.fMed.dispatchEvent(new Event('change')); // 强连带动一次单位的字
    dom.fDose.value = ruleObj.dose;

    // 分段选择恢复
    if (ruleObj.period && Array.isArray(ruleObj.period)) {
        if (periodChipSelector) {
            periodChipSelector.deselectAll();
            ruleObj.period.forEach(val => {
                const chip = document.querySelector(`.btn-period[data-val="${val}"]`);
                if (chip) periodChipSelector.select(chip.textContent);
            });
        } else {
            ruleObj.period.forEach(val => {
                let btn = Array.from(document.querySelectorAll('.btn-period')).find(b => b.dataset.val === val);
                if (btn) btn.classList.add('bg-macaroon-pink', 'text-white', 'border-transparent', 'font-bold');
            });
        }
    }

    if (ruleObj.meal && Array.isArray(ruleObj.meal)) {
        if (mealChipSelector) {
            mealChipSelector.deselectAll();
            ruleObj.meal.forEach(val => {
                const chip = document.querySelector(`.btn-meal[data-val="${val}"]`);
                if (chip) mealChipSelector.select(chip.textContent);
            });
        } else {
            ruleObj.meal.forEach(val => {
                let btn = Array.from(document.querySelectorAll('.btn-meal')).find(b => b.dataset.val === val);
                if (btn) btn.classList.add('bg-macaroon-pink', 'text-white', 'border-transparent', 'font-bold');
            });
        }
    }

    // 星期恢复
    if (weekChipSelector) {
        weekChipSelector.deselectAll();
        ruleObj.weekdays.forEach(day => {
            const chip = document.querySelector(`.week-chip[data-day="${day}"]`);
            if (chip) weekChipSelector.select(chip.textContent);
        });
    } else {
        document.querySelectorAll('.week-chip').forEach(c => {
            if (ruleObj.weekdays.includes(c.dataset.day)) {
                c.classList.remove('text-gray-500', 'border-gray-200');
                c.classList.add('bg-gray-800', 'text-white', 'border-gray-800');
            }
        });
    }

    if (ruleObj.startDate) dom.fStart.value = ruleObj.startDate;
    if (ruleObj.endDate) dom.fEnd.value = ruleObj.endDate;

    openSheet();
}

window.editRule = function (ruleId) {
    const rs = readLocal(KEYS.RULES);
    const tar = rs.find(r => r.ruleId === ruleId);
    if (!tar) return;

    resetForm();
    dom.formTitle.innerText = '编辑预排规则';
    dom.btnDeleteEntire.classList.remove('hidden'); // 编辑时露出彻底删除大招
    // 不带参数2，是编辑专属
    fillSheetWithRule(tar, false);
}

// 快速复制另一条记录全盘属性的魔法（唯独留空 ruleId 以新增）
window.copyRule = function (ruleId) {
    const rs = readLocal(KEYS.RULES);
    const tar = rs.find(r => r.ruleId === ruleId);
    if (!tar) return;

    resetForm();
    dom.formTitle.innerText = '复制排期配置 (快捷新增)';
    fillSheetWithRule(tar, true); // true = 这是复制！
}

function deleteEntireRule(e) {
    e.preventDefault();
    const ruleId = dom.fId.value;
    if (!ruleId) return;

    if (confirm('💣 警告：确定要彻底删除该药品的所有排期记录吗？\n删除后各时段的该药提醒都将被清除。')) {
        let rs = readLocal(KEYS.RULES);
        rs = rs.filter(r => r.ruleId !== ruleId);
        saveLocal(KEYS.RULES, rs);
        closeSheet();
        renderBoard();
    }
}

// Phase 3: 打卡一键服用扣减库存与记账
window.takeMedsGroup = function (groupTitle) {
    const group = window._currentGroups[groupTitle];
    if (!group) return;

    // 先做一轮纯净的库存校验，存在拦截则完全熔断
    const inv = readLocal(KEYS.INVENTORY);

    for (let item of group.items) {
        const medIndex = inv.findIndex(m => m.id === item.medId);
        if (medIndex !== -1) {
            let currentStock = Number(inv[medIndex].stock) || 0;
            if (currentStock < Number(item.dose)) {
                // 缺货阻断！
                showStockModal(item.name, item.ruleId);
                return; // 立刻中断全部后续流程
            }
        }
    }

    if (!confirm(`✅ 确认打卡【${group.title}】的全部药物吗？\n将自动扣除剩余量并记录服药。`)) return;

    const logs = readLocal(KEYS.LOGS);
    const now = new Date().toISOString();
    let changed = false;

    group.items.forEach(item => {
        const medIndex = inv.findIndex(m => m.id === item.medId);
        if (medIndex !== -1) {
            // 扣除余量
            let currentStock = Number(inv[medIndex].stock) || 0;
            currentStock -= Number(item.dose);
            if (currentStock < 0) currentStock = 0;
            inv[medIndex].stock = currentStock;
            changed = true;

            // 洗入日志
            logs.push({
                logId: 'Log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                medId: item.medId,
                name: item.name,
                dose: item.dose,
                unit: item.unit,
                actualTime: now,
                period: currentBoardTab,
                meal: group.mealKey,
                status: '已服'
            });
        }
    });

    if (changed) {
        saveLocal(KEYS.INVENTORY, inv);
        saveLocal(KEYS.LOGS, logs);
        renderBoard(); // 刷新视图重算预警
        alert('🎉 此场景全部服药完毕！您距健康又近了一步。');
    }
}

// 供用户补签/更正具体时间
window.editTakenTime = function (logId) {
    const logs = readLocal(KEYS.LOGS);
    const tar = logs.find(lg => lg.logId === logId);
    if (!tar) return;

    // 弹个窗让用户输入修正时间，简化处理用 prompt 接收 hh:mm 格式
    const currentT = new Date(tar.actualTime);
    const hh = String(currentT.getHours()).padStart(2, '0');
    const min = String(currentT.getMinutes()).padStart(2, '0');

    let input = prompt(`🕙 修改吃药精确时间 (例如直接输入 08:30):\n当前记录为: ${hh}:${min}`, `${hh}:${min}`);
    if (input === null) return; // 取消了

    input = input.trim();
    if (!/^\d{1,2}:\d{2}$/.test(input)) {
        alert('❌ 时间格式不对哦，请按照 08:30 这样的格式输入！');
        return;
    }

    let [newH, newM] = input.split(':');
    let newDate = new Date(tar.actualTime);
    newDate.setHours(Number(newH), Number(newM), 0);

    tar.actualTime = newDate.toISOString();

    // 如果日志是一个批量，寻找同批次的其它药品一起改掉时间
    logs.forEach(lg => {
        // 由于这批药是在 takeMedsGroup 里同一秒射出的，它们时间几乎就是同一个戳甚至同一个 period/meal
        // 这里基于 logId 的前半截戳判定它们是一个批次
        const currentBatchStamp = logId.split('_')[1];
        if (lg.logId.includes(currentBatchStamp)) {
            lg.actualTime = newDate.toISOString();
        }
    });

    saveLocal(KEYS.LOGS, logs);
    renderBoard();
}

// Start Engine
init();