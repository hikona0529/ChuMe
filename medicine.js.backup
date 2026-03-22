/**
 * =========================================
 * 数据层 (Data Layer)
 * 功能：与 localStorage 交互
 * =========================================
 */
const SCHEMA_KEY = 'med_inventory';

// 读取数据
function getInventory() {
    try {
        const data = localStorage.getItem(SCHEMA_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Core Data Error:', e);
        return [];
    }
}

// 保存数据
function saveInventory(data) {
    try {
        localStorage.setItem(SCHEMA_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('保存数据失败:', e);
        showToast('保存数据失败，请检查存储空间', 'error');
        return false;
    }
}

// 新增
function addMed(item) {
    const list = getInventory();
    item.id = String(Date.now()); // 用时间戳做唯一标识
    list.push(item);
    saveInventory(list);
}

// 更新
function updateMed(id, updatedItem) {
    let list = getInventory();
    list = list.map(item => item.id === id ? { ...item, ...updatedItem } : item);
    saveInventory(list);
}

// 删除
function deleteMed(id) {
    let list = getInventory();
    list = list.filter(item => item.id !== id);
    saveInventory(list);
}

// 查单个
function getMedById(id) {
    return getInventory().find(item => item.id === id) || null;
}

/**
 * =========================================
 * 视图与事件层 (View & Event Layer)
 * =========================================
 */
let globalMode = 'NORMAL';
let selectedIds = new Set();

// DOM 映射
const dom = {
    list: document.getElementById('med-list'),
    formBackdrop: document.getElementById('form-backdrop'),
    formSheet: document.getElementById('form-sheet'),
    btnCloseForm: document.getElementById('btn-close-form'),
    btnSave: document.getElementById('btn-save'),
    formTitle: document.getElementById('form-title'),
    formEl: document.getElementById('med-form'),

    // 全局管理模式元素
    btnModeAdd: document.getElementById('btn-mode-add'),
    btnModeManage: document.getElementById('btn-mode-manage'),
    btnModeDelete: document.getElementById('btn-mode-delete'),
    btnModeDone: document.getElementById('btn-mode-done'),
    btnModeCancel: document.getElementById('btn-mode-cancel'),

    globalActions: document.getElementById('global-actions'),
    globalActionsActive: document.getElementById('global-actions-active'),

    // 搜索元素
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),

    // 选项卡元素
    tabBtnManual: document.getElementById('tab-btn-manual'),
    tabBtnHistory: document.getElementById('tab-btn-history'),
    tabManual: document.getElementById('tab-manual'),
    tabHistory: document.getElementById('tab-history'),

    // 表单元素
    fId: document.getElementById('field-id'),
    fName: document.getElementById('field-name'),
    fBrand: document.getElementById('field-brand'),
    fPurchase: document.getElementById('field-purchaseDate'),
    fOpen: document.getElementById('field-openDate'),

    // 保质期计算器元素
    calcHeader: document.getElementById('calc-header'),
    calcBody: document.getElementById('calc-body'),
    calcIcon: document.getElementById('calc-icon'),
    fProduce: document.getElementById('field-produceDate'),
    fCustomShelfLife: document.getElementById('field-customShelfLife'),

    fExpire: document.getElementById('field-expireDate'),
    fCapacity: document.getElementById('field-capacity'),
    fStock: document.getElementById('field-stock'),

    // 单位元素
    unitChips: document.querySelectorAll('.unit-chip'),
    fUnitCustom: document.getElementById('field-unit-custom')
};

// ----------------------------
// 单行 6位数字 日期组件封装
// ----------------------------
function initDateFields(baseId) {
    const display = document.getElementById(`${baseId}-display`);
    if (!display) return;

    display.addEventListener('input', (e) => {
        let val = display.value;
        let prev = display.dataset.prev || '';

        let digits = val.replace(/\D/g, '');
        let prevDigits = prev.replace(/\D/g, '');

        if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteWordBackward') {
            if (digits.length === prevDigits.length) {
                // 如果长度没变，说明刚刚按退格删掉的是分隔符。此时连同前一位数字一并删除，保证手感流畅。
                digits = digits.slice(0, -1);
            }
        }

        digits = digits.slice(0, 6);

        let formatted = '';
        if (digits.length > 4) {
            formatted = `${digits.slice(0, 2)} / ${digits.slice(2, 4)} / ${digits.slice(4)}`;
        } else if (digits.length > 2) {
            formatted = `${digits.slice(0, 2)} / ${digits.slice(2)}`;
            if (digits.length === 4 && e.inputType !== 'deleteContentBackward') formatted += ' / ';
        } else {
            formatted = digits;
            if (digits.length === 2 && digits.length !== prevDigits.length && e.inputType !== 'deleteContentBackward') formatted += ' / ';
        }

        display.value = formatted;
        display.dataset.prev = formatted;
    });

    display.addEventListener('blur', () => {
        let digits = display.value.replace(/\D/g, '');
        if (digits.length === 0) {
            display.dataset.prev = '';
            return;
        }

        let y = digits.slice(0, 2);
        let m = digits.slice(2, 4);
        let d = digits.slice(4, 6);

        if (y.length === 1) y = '0' + y;
        if (digits.length >= 3 && m.length === 1) m = '0' + m;
        if (digits.length >= 5 && d.length === 1) d = '0' + d;

        if (m && parseInt(m) > 12) m = '12';
        if (m === '00') m = '01';
        if (d && parseInt(d) > 31) d = '31';
        if (d === '00') d = '01';

        let formatted = '';
        if (y && m && d) {
            formatted = `${y} / ${m} / ${d}`;
        } else if (y && m) {
            formatted = `${y} / ${m} / `;
        } else if (y) {
            formatted = `${y} / `;
        }

        display.value = formatted;
        display.dataset.prev = formatted;
    });
}

function getThreeSegmentDate(baseId) {
    const display = document.getElementById(`${baseId}-display`);
    if (!display) return '';
    let digits = display.value.replace(/\D/g, '');
    if (digits.length !== 6) return '';

    let y = digits.slice(0, 2);
    let m = digits.slice(2, 4);
    let d = digits.slice(4, 6);

    return `20${y}-${m}-${d}`;
}

function setThreeSegmentDate(baseId, dateStr) {
    const display = document.getElementById(`${baseId}-display`);
    if (!display) return;

    if (dateStr) {
        const [y, m, d] = dateStr.split('-');
        if (y && m && d) {
            display.value = `${y.slice(2)} / ${m} / ${d}`;
            display.dataset.prev = display.value;
        }
    } else {
        display.value = '';
        display.dataset.prev = '';
    }
}

// 应用初始化
function init() {
    renderBoard();
    attachListeners();

    // 监听换药页面的一键新增参数
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'add') {
        // 自动触发新增表单逻辑
        resetForm();
        dom.formTitle.textContent = '新增药品';
        openSheet();

        // 阅后即焚清理 url，防止刷新始终卡在加药抽屉
        if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
    }
}

// 渲染列表
function renderBoard(filterText = '') {
            let data = getInventory();

            // 如果有搜索词，进行过滤（忽略大小写）
            if (filterText) {
                const lowerFilter = filterText.toLowerCase();
                data = data.filter(med =>
                    (med.name && med.name.toLowerCase().includes(lowerFilter)) ||
                    (med.brand && med.brand.toLowerCase().includes(lowerFilter))
                );
            }

            // 空状态设计
            if (data.length === 0) {
                dom.list.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full pt-32 text-chume-brown-light space-y-4">
          <div class="text-6xl text-chume-card">
            <div class="icon-container"><i class="fa-solid fa-box-open"></i></div>
          </div>
          <p class="text-[15px]">${filterText ? '未找到匹配的药品' : '药箱空空如也，点击右上角添加'}</p>
        </div>
      `;
                return;
            }

            // 按过期时间排序 (越近的越靠前)
            data.sort((a, b) => {
                if (!a.expireDate) return 1;
                if (!b.expireDate) return -1;
                return new Date(a.expireDate) - new Date(b.expireDate);
            });

            let html = '';
            const todayStr = new Date().toISOString().split('T')[0];

            data.forEach(med => {
                // 预警逻辑判断：计算过期状态
                let stateBadge = '';
                let isOverdue = false;
                let isWarning = false;

                if (med.expireDate) {
                    const msPerDay = 1000 * 60 * 60 * 24;
                    const diffDays = Math.ceil((new Date(med.expireDate) - new Date(todayStr)) / msPerDay);

                    if (diffDays < 0) {
                        isOverdue = true;
                        stateBadge = `<span class="bg-chume-pink/20 text-chume-pink px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide">已过期</span>`;
                    } else if (diffDays <= 30) {
                        isWarning = true;
                        stateBadge = `<span class="bg-chume-orange-light text-chume-orange px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide">${diffDays}天过期</span>`;
                    }
                }

                const titleClasses = isOverdue ? 'text-chume-pink' : 'text-chume-brown';
                const indicatorColor = isOverdue ? 'bg-chume-pink' : (isWarning ? 'bg-chume-orange' : 'bg-transparent');

        // ==== Mode Responsiveness ====
        let cardClasses = "bg-white rounded-[1.25rem] p-4 shadow-card border border-chume-brown/10 relative overflow-hidden group transition-all duration-200 flex items-center gap-3";
        let cardClick = "";
        let prefixHtml = "";

        if (globalMode === 'EDIT') {
            cardClasses = "bg-white rounded-[1.25rem] p-4 shadow-card border-2 border-chume-brown/40 border-dashed relative overflow-hidden group transition-all duration-200 flex items-center gap-3 cursor-pointer hover:bg-chume-card";
            cardClick = `onclick="triggerEdit('${med.id}')"`;
        } else if (globalMode === 'DELETE') {
            const isSelected = selectedIds.has(med.id);
            cardClasses = `bg-white rounded-[1.25rem] p-4 shadow-card border ${isSelected ? 'border-chume-brown/40 bg-chume-card' : 'border-chume-brown/10'} relative overflow-hidden group transition-all duration-200 flex items-center gap-3 cursor-pointer select-none`;
            cardClick = `onclick="toggleSelect('${med.id}')"`;
            prefixHtml = `
            <div class="shrink-0 flex items-center justify-center w-5 h-5 rounded-full border-2 ${isSelected ? 'border-chume-brown bg-chume-brown' : 'border-chume-brown/30'} transition-all duration-200">
                ${isSelected ? '<i class="fa-solid fa-check text-white text-[10px]"></i>' : ''}
            </div>
            `;
        }

        // 药品卡片 HTML 渲染
        html += `
        <div class="${cardClasses}" ${cardClick}>
          <!-- 左侧彩色警示条 -->
          <div class="absolute left-0 top-0 bottom-0 w-1.5 ${indicatorColor}"></div>
          
          ${prefixHtml}
          
          <div class="flex-1 min-w-0 flex flex-col justify-center py-1">
            <div class="flex justify-between items-center mb-3">
              <div class="flex-1 overflow-hidden pr-2">
                <div class="flex items-center space-x-2">
                  <h3 class="text-lg font-bold ${titleClasses} truncate">${escapeStr(med.name)}</h3>
                  ${stateBadge}
                </div>
                ${med.brand ? `<p class="text-xs text-chume-brown-light mt-0.5 truncate">${escapeStr(med.brand)}</p>` : ''}
              </div>
              <div class="shrink-0 text-right flex flex-col items-end justify-center">
                 <div class="flex items-baseline space-x-1">
                   <span class="text-2xl font-bold text-chume-brown drop-shadow-sm">${med.stock}</span>
                   <span class="text-sm font-normal text-chume-brown-light">/ ${med.capacity || '-'} ${escapeStr(med.unit)}</span>
                 </div>
              </div>
            </div>
            
            <!-- 日期信息区 -->
            <div class="bg-chume-card rounded-2xl p-2.5 text-[12px] text-chume-brown-light flex justify-between items-center pl-3 border border-chume-brown/10">
               <span class="flex items-center space-x-1.5">
                 <span class="text-chume-brown-light"><div class="icon-container"><i class="fa-regular fa-clock"></i></div></span>
                 <span>到期 <span class="${isOverdue ? 'text-chume-pink font-bold' : ''} ${isWarning ? 'text-chume-orange font-bold' : ''}">${shortDate(med.expireDate)}</span></span>
               </span>
               ${med.openDate ? `
               <span class="flex items-center space-x-1.5">
                 <span class="text-chume-brown-light"><div class="icon-container"><i class="fa-solid fa-box-open text-[10px]"></i></div></span>
                 <span>开封 ${shortDate(med.openDate)}</span>
               </span>` : `
               <span class="bg-chume-brown/10 text-chume-brown-light px-2.5 py-1 rounded-lg text-xs font-bold shrink-0">
                 未开封
               </span>`}
               <span class="flex items-center space-x-1.5">
                 <span class="text-chume-brown-light"><div class="icon-container"><i class="fa-solid fa-cart-shopping text-[10px]"></i></div></span>
                 <span>购入 ${shortDate(med.purchaseDate)}</span>
               </span>
            </div>
          </div>
        </div>
      `;
    });

    dom.list.innerHTML = html;
}

// 渲染历史模板
function renderHistoryTemplates() {
    const list = getInventory();

    // 去重，以 name + brand 为 key
    const uniqueMap = new Map();
    list.forEach(med => {
        const key = `${med.name}_${med.brand}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, med);
        }
    });

    const uniqueTemplates = Array.from(uniqueMap.values());

    if (uniqueTemplates.length === 0) {
        dom.tabHistory.innerHTML = '<div class="text-center text-sm text-gray-400 py-10">暂无历史记录</div>';
        return;
    }

    let html = '<div class="space-y-3 mt-2">';
    uniqueTemplates.forEach(med => {
        html += `
        <div class="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-2xl shadow-sm">
            <div>
                <div class="font-bold text-gray-800 text-[15px]">${escapeStr(med.name)}</div>
                ${med.brand ? `<div class="text-xs text-gray-400 mt-0.5">${escapeStr(med.brand)}</div>` : ''}
            </div>
            <button type="button" class="bg-macaroon-blue/20 text-blue-700 px-4 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform" onclick="importTemplate('${med.id}')">
                选用
            </button>
        </div>
        `;
    });
    html += '</div>';

    dom.tabHistory.innerHTML = html;
}

// 导入模板
window.importTemplate = function (id) {
    const med = getMedById(id);
    if (!med) return;

    // 切回手动填写界面
    dom.tabBtnManual.className = 'bg-white shadow-sm text-gray-800 transition-all duration-300 rounded-lg py-2 text-sm font-semibold w-1/2';
    dom.tabBtnHistory.className = 'text-gray-500 hover:text-gray-700 transition-all duration-300 rounded-lg py-2 text-sm font-semibold w-1/2';
    dom.tabManual.classList.remove('hidden');
    dom.tabHistory.classList.add('hidden');

    // 自动填充
    dom.fName.value = med.name || '';
    dom.fBrand.value = med.brand || '';
    dom.fCapacity.value = med.capacity !== undefined ? med.capacity : '';
    dom.fStock.value = med.capacity !== undefined ? med.capacity : ''; // 智能余量填充：余量 = 总量

    // 重置并填充单位
    resetUnitChips();
    dom.fUnitCustom.value = '';
    if (med.unit) {
        const chip = Array.from(dom.unitChips).find(c => c.textContent === med.unit);
        if (chip) {
            chip.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            chip.classList.add('bg-macaroon-green', 'text-teal-900', 'border-macaroon-green');
        } else {
            dom.fUnitCustom.value = med.unit;
        }
    }

    // 日期逻辑
    setThreeSegmentDate('field-purchaseDate', new Date().toISOString().split('T')[0]);
    setThreeSegmentDate('field-openDate', '');
    setThreeSegmentDate('field-expireDate', '');
    setThreeSegmentDate('field-produceDate', '');

    // 保质期记忆
    resetChips();
    dom.fCustomShelfLife.value = '';
    if (med.shelfLifeMonths) {
        const chip = Array.from(document.querySelectorAll('.shelf-life-chip')).find(chip => parseInt(chip.dataset.months) === med.shelfLifeMonths);
        if (chip) {
            chip.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            chip.classList.add('bg-macaroon-purple', 'text-white', 'border-macaroon-purple');
        } else {
            dom.fCustomShelfLife.value = med.shelfLifeMonths;
        }
    }

    // 清除并回显成分
    const ingredientsContainer = document.getElementById('ingredients-container');
    if (ingredientsContainer) {
        ingredientsContainer.innerHTML = '';
        if (med.ingredients && med.ingredients.length > 0) {
            med.ingredients.forEach(ing => {
                addIngredientRow(ing.name, ing.amount, ing.unit);
            });
        }
    }

    syncShelfLifeState();
}

// 重置单位胶囊的样式
function resetUnitChips() {
    dom.unitChips.forEach(c => {
        c.classList.remove('bg-macaroon-green', 'text-teal-900', 'border-macaroon-green');
        c.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
    });
}

// 重置快捷保质期的样式
function resetChips() {
    document.querySelectorAll('.shelf-life-chip').forEach(c => {
        c.classList.remove('bg-macaroon-purple', 'text-white', 'border-macaroon-purple');
        c.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
    });
}

// 同步保质期按钮可用状态
function syncShelfLifeState() {
    const produceDateStr = getThreeSegmentDate('field-produceDate');
    const chips = document.querySelectorAll('.shelf-life-chip');
    const customInput = document.getElementById('field-customShelfLife');

    if (!produceDateStr) {
        chips.forEach(c => c.classList.add('opacity-40', 'pointer-events-none'));
        if (customInput) customInput.classList.add('opacity-40', 'pointer-events-none');
    } else {
        chips.forEach(c => c.classList.remove('opacity-40', 'pointer-events-none'));
        if (customInput) customInput.classList.remove('opacity-40', 'pointer-events-none');
    }
}

// 计算到期时间并填充
function calculateExpireDate(months) {
    const produceDateStr = getThreeSegmentDate('field-produceDate');
    if (!produceDateStr || isNaN(months)) return;

    const produceDate = new Date(produceDateStr);
    produceDate.setMonth(produceDate.getMonth() + months);

    // 格式化为 YYYY-MM-DD
    const yyyy = produceDate.getFullYear();
    const mm = String(produceDate.getMonth() + 1).padStart(2, '0');
    const dd = String(produceDate.getDate()).padStart(2, '0');

    setThreeSegmentDate('field-expireDate', `${yyyy}-${mm}-${dd}`);
}

// 绑定交互监听
function attachListeners() {
    initDateFields('field-purchaseDate');
    initDateFields('field-openDate');
    initDateFields('field-produceDate');
    initDateFields('field-expireDate');

    const produceDisplay = document.getElementById('field-produceDate-display');
    if (produceDisplay) {
        produceDisplay.addEventListener('input', syncShelfLifeState);
        produceDisplay.addEventListener('blur', syncShelfLifeState);
    }

    // 搜索相关监听
    dom.searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) {
            dom.searchClear.classList.remove('hidden');
        } else {
            dom.searchClear.classList.add('hidden');
        }
        renderBoard(val);
    });

    dom.searchClear.addEventListener('click', () => {
        dom.searchInput.value = '';
        dom.searchClear.classList.add('hidden');
        dom.searchInput.focus();
        renderBoard('');
    });

    // 选项卡切换监听
    dom.tabBtnManual.addEventListener('click', () => {
        // UI 状态切换
        dom.tabBtnManual.className = 'bg-white shadow-sm text-gray-800 transition-all duration-300 rounded-lg py-2 text-sm font-semibold w-1/2';
        dom.tabBtnHistory.className = 'text-gray-500 hover:text-gray-700 transition-all duration-300 rounded-lg py-2 text-sm font-semibold w-1/2';

        // 内容区切换
        dom.tabManual.classList.remove('hidden');
        dom.tabHistory.classList.add('hidden');
    });

    dom.tabBtnHistory.addEventListener('click', () => {
        // UI 状态切换
        dom.tabBtnHistory.className = 'bg-white shadow-sm text-gray-800 transition-all duration-300 rounded-lg py-2 text-sm font-semibold w-1/2';
        dom.tabBtnManual.className = 'text-gray-500 hover:text-gray-700 transition-all duration-300 rounded-lg py-2 text-sm font-semibold w-1/2';

        // 内容区切换
        dom.tabHistory.classList.remove('hidden');
        dom.tabManual.classList.add('hidden');

        // 加载历史模板
        renderHistoryTemplates();
    });

    // 唤起表单
    dom.btnModeAdd.addEventListener('click', () => {
        resetForm();
        dom.formTitle.textContent = '新增药品';
        openSheet();
    });

    // 关闭表单
    dom.btnCloseForm.addEventListener('click', closeSheet);
    dom.formBackdrop.addEventListener('click', closeSheet);

    // 提交保存
    dom.btnSave.addEventListener('click', submitData);

    // 快捷单位选项互动
    dom.unitChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            resetUnitChips();
            e.target.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            e.target.classList.add('bg-macaroon-green', 'text-teal-900', 'border-macaroon-green');
            dom.fUnitCustom.value = ''; // 选中胶囊时，清空自定义输入
        });
    });

    dom.fUnitCustom.addEventListener('input', () => {
        resetUnitChips(); // 若用户正在手打字段，清除任何现存胶囊选择
    });

    // 保质期折叠面板逻辑
    dom.calcHeader.addEventListener('click', () => {
        const isHidden = dom.calcBody.classList.contains('hidden');
        if (isHidden) {
            dom.calcBody.classList.remove('hidden');
            dom.calcHeader.querySelector('span').textContent = '保质期计算器 (点我收起)';
            dom.calcIcon.style.transform = 'rotate(180deg)';
        } else {
            dom.calcBody.classList.add('hidden');
            dom.calcHeader.querySelector('span').textContent = '保质期计算器 (点我展开)';
            dom.calcIcon.style.transform = 'rotate(0deg)';
        }
    });

    // 保质期快捷选项计算
    document.querySelectorAll('.shelf-life-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            resetChips();
            e.target.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            e.target.classList.add('bg-macaroon-purple', 'text-white', 'border-macaroon-purple');

            dom.fCustomShelfLife.value = ''; // 清空自定义
            calculateExpireDate(parseInt(e.target.dataset.months));
        });
    });

    dom.fCustomShelfLife.addEventListener('input', () => {
        resetChips();
    });

    dom.fCustomShelfLife.addEventListener('blur', (e) => {
        if (e.target.value) {
            calculateExpireDate(parseInt(e.target.value));
        }
    });

    dom.fCustomShelfLife.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.target.value) {
                calculateExpireDate(parseInt(e.target.value));
            }
        }
    });

    // 新增成分监听
    const btnAddIngredient = document.getElementById('btn-add-ingredient');
    if (btnAddIngredient) {
        btnAddIngredient.addEventListener('click', () => {
            addIngredientRow();
        });
    }

    // 全局管理模式监听
    dom.btnModeManage.addEventListener('click', () => setMode('EDIT'));
    dom.btnModeDelete.addEventListener('click', () => setMode('DELETE'));
    dom.btnModeCancel.addEventListener('click', () => setMode('NORMAL'));

    dom.btnModeDone.addEventListener('click', () => {
        if (globalMode === 'DELETE') {
            if (selectedIds.size === 0) {
                setMode('NORMAL');
                return;
            }

            // 【级联检查与提示】批量删除
            let rulesList = getRules();
            let haveAssociatedRules = false;
            let affectedRuleIds = new Set();

            for (let id of selectedIds) {
                if (rulesList.some(r => r.medId === id)) {
                    haveAssociatedRules = true;
                    break;
                }
            }

            let confirmMsg = `💊 确定要删除选中的 ${selectedIds.size} 项记录吗？处理后无法恢复。`;
            if (haveAssociatedRules) {
                confirmMsg = `⚠️ 选中药品中部分已设置【服药提醒】。\n删除后相关的提醒规则也会一并失效。确认删除吗？`;
            }

            if (confirm(confirmMsg)) {
                let list = getInventory();
                list = list.filter(item => !selectedIds.has(item.id));
                saveInventory(list);

                // 级联删排期
                if (haveAssociatedRules) {
                    rulesList = rulesList.filter(r => !selectedIds.has(r.medId));
                    saveRules(rulesList);
                }

                selectedIds.clear();
                setMode('NORMAL');
                renderBoard(dom.searchInput.value.trim()); // respect active search
            }
        } else {
            // EDIT mode 退出
            setMode('NORMAL');
        }
    });
}

// 辅助函数：打开底栏
function openSheet() {
    dom.formBackdrop.classList.replace('backdrop-hidden', 'backdrop-visible');
    dom.formSheet.classList.replace('sheet-hidden', 'sheet-visible');
}

// 辅助函数：关闭底栏
function closeSheet() {
    dom.formSheet.classList.replace('sheet-visible', 'sheet-hidden');
    dom.formBackdrop.classList.replace('backdrop-visible', 'backdrop-hidden');
    // 折叠计算器
    if (!dom.calcBody.classList.contains('hidden')) {
        dom.calcBody.classList.add('hidden');
        dom.calcHeader.querySelector('span').textContent = '保质期计算器 (点我展开)';
        dom.calcIcon.style.transform = 'rotate(0deg)';
    }
}

// 表单逻辑：清空/重置
function resetForm() {
    // 强制重置选项卡为“手动填写”
    dom.tabBtnManual.className = 'bg-white shadow-sm text-gray-800 transition-all duration-300 rounded-lg py-2 text-sm font-semibold w-1/2';
    dom.tabBtnHistory.className = 'text-gray-500 hover:text-gray-700 transition-all duration-300 rounded-lg py-2 text-sm font-semibold w-1/2';
    dom.tabManual.classList.remove('hidden');
    dom.tabHistory.classList.add('hidden');

    dom.fId.value = '';
    dom.fName.value = '';
    dom.fBrand.value = '';
    setThreeSegmentDate('field-purchaseDate', new Date().toISOString().split('T')[0]); // 默认今天
    setThreeSegmentDate('field-openDate', '');

    setThreeSegmentDate('field-produceDate', '');
    dom.fCustomShelfLife.value = '';
    resetChips();

    setThreeSegmentDate('field-expireDate', '');
    dom.fCapacity.value = '';
    dom.fStock.value = '';

    // 清除单位选择状态
    resetUnitChips();
    dom.fUnitCustom.value = '';

    // 默认折叠计算器
    if (!dom.calcBody.classList.contains('hidden')) {
        dom.calcBody.classList.add('hidden');
        dom.calcHeader.querySelector('span').textContent = '保质期计算器 (点我展开)';
        dom.calcIcon.style.transform = 'rotate(0deg)';
    }

    // 清空成分
    const ingredientsContainer = document.getElementById('ingredients-container');
    if (ingredientsContainer) {
        ingredientsContainer.innerHTML = '';
    }

    syncShelfLifeState();
}

// 全局暴露：编辑触发器
window.triggerEdit = function (id) {
    const med = getMedById(id);
    if (!med) return;

    // 强制重置选项卡为“手动填写”
    dom.tabBtnManual.className = 'bg-white shadow-sm text-gray-800 transition-all duration-300 rounded-lg py-2 text-sm font-semibold w-1/2';
    dom.tabBtnHistory.className = 'text-gray-500 hover:text-gray-700 transition-all duration-300 rounded-lg py-2 text-sm font-semibold w-1/2';
    dom.tabManual.classList.remove('hidden');
    dom.tabHistory.classList.add('hidden');

    dom.formTitle.textContent = '编辑记录';
    dom.fId.value = med.id;
    dom.fName.value = med.name || '';
    dom.fBrand.value = med.brand || '';
    setThreeSegmentDate('field-purchaseDate', med.purchaseDate || '');
    setThreeSegmentDate('field-openDate', med.openDate || '');

    // 清理辅助填写的字段
    setThreeSegmentDate('field-produceDate', '');
    dom.fCustomShelfLife.value = '';
    resetChips();

    // 尝试恢复保质期快捷选项
    if (med.shelfLifeMonths) {
        const chip = Array.from(document.querySelectorAll('.shelf-life-chip')).find(chip => parseInt(chip.dataset.months) === med.shelfLifeMonths);
        if (chip) {
            chip.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            chip.classList.add('bg-macaroon-purple', 'text-white', 'border-macaroon-purple');
        } else {
            dom.fCustomShelfLife.value = med.shelfLifeMonths;
        }
    }

    setThreeSegmentDate('field-expireDate', med.expireDate || '');
    dom.fCapacity.value = med.capacity !== undefined ? med.capacity : '';
    dom.fStock.value = med.stock !== undefined ? med.stock : '';

    // 重置并填充单位
    resetUnitChips();
    dom.fUnitCustom.value = '';
    if (med.unit) {
        const chip = Array.from(dom.unitChips).find(c => c.textContent === med.unit);
        if (chip) {
            chip.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            chip.classList.add('bg-macaroon-green', 'text-teal-900', 'border-macaroon-green');
        } else {
            dom.fUnitCustom.value = med.unit;
        }
    }

    // 清除并回显成分
    const ingredientsContainer = document.getElementById('ingredients-container');
    if (ingredientsContainer) {
        ingredientsContainer.innerHTML = '';
        if (med.ingredients && med.ingredients.length > 0) {
            med.ingredients.forEach(ing => {
                addIngredientRow(ing.name, ing.amount, ing.unit);
            });
        }
    }

    syncShelfLifeState();
    openSheet();
}

// 读取排期规则数据
function getRules() {
    try {
        const data = localStorage.getItem('med_rules');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

// 写入排期规则数据
function saveRules(data) {
    localStorage.setItem('med_rules', JSON.stringify(data));
}

// 全局暴露：删除触发器 (修改加入级联逻辑)
window.triggerDelete = function (id) {
    let rulesList = getRules();
    let isAssociated = rulesList.some(r => r.medId === id);

    let confirmMsg = '💊 确定要将该药品移出药箱吗？处理后无法恢复。';
    if (isAssociated) {
        confirmMsg = '⚠️ 该药品已设置服药提醒，删除后相关的提醒规则也会一并失效。确认删除吗？';
    }

    if (confirm(confirmMsg)) {
        deleteMed(id);

        // 【级联清洗】干掉所有绑定在孤岛上的规则
        if (isAssociated) {
            rulesList = rulesList.filter(r => r.medId !== id);
            saveRules(rulesList);
        }

        renderBoard();
    }
}

// 处理数据提交
function submitData(e) {
    e.preventDefault();

    // 利用浏览器原生 Validity API 检查必填项（屏蔽了隐藏的 unit输入框后的定制处理）
    // 注意，我们移除了原生的 field-unit input。需要手动检查单位。
    if (!dom.formEl.checkValidity()) {
        dom.formEl.reportValidity();
        return;
    }

    // 提取单位
    let finalUnit = '';
    const activeUnitChip = Array.from(dom.unitChips).find(chip => chip.classList.contains('bg-macaroon-green'));
    if (activeUnitChip) {
        finalUnit = activeUnitChip.textContent;
    } else {
        finalUnit = dom.fUnitCustom.value.trim();
    }

    // 手动验证必填组：必须有单位
    if (!finalUnit) {
        alert('请选择或输入药品单位哦💊');
        return;
    }

    // 保质期记忆逻辑：判断哪个按钮被选中，或者自定义输入框的值
    let shelfLifeMonths = null;
    const activeChip = Array.from(document.querySelectorAll('.shelf-life-chip')).find(chip => chip.classList.contains('bg-macaroon-purple'));

    if (activeChip) {
        shelfLifeMonths = parseInt(activeChip.dataset.months);
    } else if (dom.fCustomShelfLife.value) {
        shelfLifeMonths = parseInt(dom.fCustomShelfLife.value);
    }

    // 提取成分数组
    const ingredients = [];
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    ingredientRows.forEach(row => {
        const iName = row.querySelector('.ing-name').value.trim();
        const iAmount = row.querySelector('.ing-amount').value;
        const iUnit = row.querySelector('.ing-unit').value.trim();

        if (iName) { // 只要有名字就算有效数据
            ingredients.push({
                name: iName,
                amount: iAmount ? Number(iAmount) : null,
                unit: iUnit
            });
        }
    });

    // 手动验证余量 <= 包装总量
    const capacityVal = Number(dom.fCapacity.value);
    const stockVal = Number(dom.fStock.value);
    if (stockVal > capacityVal) {
        alert('当前余量不能超过包装总量哦💊');
        dom.fStock.classList.add('animate-error-blink');
        setTimeout(() => {
            dom.fStock.value = ''; // 闪烁完毕后自动帮用户清空错误的数字
            dom.fStock.classList.remove('animate-error-blink');
        }, 1200);
        return;
    }

    // 构造 payload，严格符合 Schema
    const payload = {
        name: dom.fName.value.trim(),
        brand: dom.fBrand.value.trim(),
        purchaseDate: getThreeSegmentDate('field-purchaseDate'),
        openDate: getThreeSegmentDate('field-openDate'),
        expireDate: getThreeSegmentDate('field-expireDate'),
        capacity: Number(dom.fCapacity.value),
        stock: Number(dom.fStock.value),
        unit: finalUnit,
        shelfLifeMonths: shelfLifeMonths,
        ingredients: ingredients
    };

    const editId = dom.fId.value;

    if (editId) {
        updateMed(editId, payload);
    } else {
        addMed(payload);
    }

    closeSheet();
    renderBoard();
}

// 辅助功能：精简日期显示 - 使用utils.js中的shortDate函数

// 动态添加成分行
function addIngredientRow(name = '', amount = '', unit = '') {
    const container = document.getElementById('ingredients-container');
    if (!container) return;
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    const row = document.createElement('div');
    row.className = 'flex items-center space-x-2 ingredient-row';
    row.id = `ing-${id}`;

    // Convert null to empty string for amount
    const valAmount = amount === null || amount === undefined ? '' : amount;

    row.innerHTML = `
        <input type="text" placeholder="成分名" value="${escapeStr(name)}" class="ing-name flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-macaroon-green transition-all text-sm min-w-0">
        <input type="number" step="any" inputmode="decimal" placeholder="数值" value="${valAmount}" class="ing-amount w-16 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-macaroon-green transition-all text-sm text-center">
        <input type="text" placeholder="单位" value="${escapeStr(unit)}" class="ing-unit w-16 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-macaroon-green transition-all text-sm text-center">
        <button type="button" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 active:scale-90 transition-transform shrink-0" onclick="removeIngredientRow('${row.id}')">
            <div class="icon-container"><i class="fa-solid fa-circle-xmark text-lg"></i></div>
        </button>
    `;
    container.appendChild(row);

    // 如果是用户手动新增（无预设名字），新增后自动滑入视野中间
    if (!name) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

window.removeIngredientRow = function (id) {
    const row = document.getElementById(id);
    if (row) row.remove();
}

// 安全过滤 (防止 XSS)
function escapeStr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ----------------------------
// 全局管理模式响应 API
// ----------------------------
window.setMode = function (mode) {
    globalMode = mode;
    selectedIds.clear();

    // Header UI toggling
    dom.globalActions.classList.add('hidden');
    dom.globalActionsActive.classList.add('hidden');

    if (mode === 'NORMAL') {
        dom.globalActions.classList.remove('hidden');
    } else {
        dom.globalActionsActive.classList.remove('hidden');
        if (mode === 'DELETE') {
            updateDeleteBtn();
        } else {
            // Start of EDIT mode setup
            dom.btnModeDone.textContent = '完成';
            dom.btnModeDone.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    renderBoard(dom.searchInput.value.trim());
};

window.toggleSelect = function (id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
    renderBoard(dom.searchInput.value.trim());
    if (globalMode === 'DELETE') {
        updateDeleteBtn();
    }
};

function updateDeleteBtn() {
    if (globalMode === 'DELETE') {
        if (selectedIds.size > 0) {
            dom.btnModeDone.textContent = `完成 (${selectedIds.size})`;
            dom.btnModeDone.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            dom.btnModeDone.textContent = `完成`;
            dom.btnModeDone.classList.add('opacity-50', 'pointer-events-none');
        }
    }
}

// Go!
init();
