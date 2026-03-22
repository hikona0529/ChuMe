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

// 新增药品
function addMed(payload) {
    const inventory = getInventory();
    const med = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        ...payload,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
    };
    inventory.push(med);
    if (saveInventory(inventory)) {
        showToast('药品添加成功！', 'success');
        return med.id;
    }
    return false;
}

// 更新药品
function updateMed(id, payload) {
    const inventory = getInventory();
    const index = inventory.findIndex(m => m.id === id);
    if (index === -1) return false;
    const med = inventory[index];
    inventory[index] = {
        ...med,
        ...payload,
        updated: new Date().toISOString()
    };
    if (saveInventory(inventory)) {
        showToast('药品更新成功！', 'success');
        return true;
    }
    return false;
}

// 删除药品
function deleteMed(id) {
    const inventory = getInventory();
    const index = inventory.findIndex(m => m.id === id);
    if (index === -1) return false;
    inventory.splice(index, 1);
    if (saveInventory(inventory)) {
        showToast('药品已删除', 'success');
        return true;
    }
    return false;
}

// 批量删除
function batchDelete(ids) {
    const inventory = getInventory();
    const filtered = inventory.filter(m => !ids.includes(m.id));
    if (saveInventory(filtered)) {
        showToast(`已删除 ${ids.length} 项药品`, 'success');
        return true;
    }
    return false;
}

// 空状态检测
function isEmptyInventory() {
    const inventory = getInventory();
    return !inventory || inventory.length === 0;
}

/**
 * =========================================
 * 业务层 (Business Layer)
 * 功能：核心业务逻辑
 * =========================================
 */
const globalMode = 'NORMAL'; // NORMAL | EDIT | DELETE
const selectedIds = new Set();

// 核心 DOM 引用（内存中缓存）
const dom = {
    searchInput: document.getElementById('search-input'),
    globalActions: document.getElementById('global-actions'),
    globalActionsActive: document.getElementById('global-actions-active'),
    btnModeDone: document.getElementById('btn-mode-done'),
    btnDelete: document.getElementById('btn-delete'),

    // 表单层
    formBackdrop: document.getElementById('form-backdrop'),
    formSheet: document.getElementById('form-sheet'),
    btnCloseForm: document.getElementById('btn-close-form'),
    formEl: document.getElementById('medicine-form'),

    // 表单字段
    fId: document.getElementById('field-id'),
    fName: document.getElementById('field-name'),
    fBrand: document.getElementById('field-brand'),
    tabManual: document.getElementById('tab-manual'),
    tabHistory: document.getElementById('tab-history'),

    btnSave: document.getElementById('btn-save'),
    calcHeader: document.getElementById('calc-header'),
    calcBody: document.getElementById('calc-body'),
    calcIcon: document.getElementById('calc-icon'),
    fProduce: document.getElementById('field-produceDate'),
    fCustomShelfLife: document.getElementById('field-customShelfLife'),

    fExpire: document.getElementById('field-expireDate'),
    fCapacity: document.getElementById('field-capacity'),
    fStock: document.getElementById('field-stock'),

    // 单位元素（使用组件库）
    unitChipsContainer: '.unit-chips-container',
    fUnitCustom: document.getElementById('field-unit-custom'),
    
    // 保质期元素（使用组件库）
    shelfLifeChipsContainer: '.shelf-life-chips-container'
};

// 芯片选择器实例
let unitChipSelector = null;
let shelfLifeChipSelector = null;

// ----------------------------
// 单行 6位数字 日期组件封装
// ----------------------------
function initDateFields(baseId) {
    const display = document.getElementById(`${baseId}-display`);
    if (!display) return;

    const inputs = [];
    for (let i = 0; i < 6; i++) {
        const input = document.getElementById(`${baseId}-${i}`);
        if (!input) continue;
        inputs.push(input);

        // Auto-tab
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            const idx = parseInt(e.target.dataset.idx);

            if (val.length === 1) {
                if (idx < 5) {
                    const next = document.getElementById(`${baseId}-${idx + 1}`);
                    if (next) {
                        next.focus();
                        next.select();
                    }
                } else {
                    e.target.blur();
                }
            } else if (val.length === 0 && idx > 0) {
                const prev = document.getElementById(`${baseId}-${idx - 1}`);
                if (prev) {
                    prev.focus();
                    prev.select();
                }
            }
        });

        // Delete handling
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && e.target.dataset.idx > 0) {
                e.preventDefault();
                const prev = document.getElementById(`${baseId}-${parseInt(e.target.dataset.idx) - 1}`);
                if (prev) {
                    prev.focus();
                    prev.select();
                }
            }
        });

        // Auto-fill default 0 for month/day when year partially filled
        if (idx === 2) {
            input.addEventListener('blur', () => {
                const y1 = document.getElementById(`${baseId}-0`).value || '';
                const y2 = document.getElementById(`${baseId}-1`).value || '';
                if ((y1 || y2) && !input.value) {
                    input.value = '0';
                    setTimeout(() => {
                        const next = document.getElementById(`${baseId}-3`);
                        if (next) next.focus();
                    }, 10);
                }
            });
        }
    }

    // Display update
    const updateDisplay = () => {
        let str = '';
        inputs.forEach(inp => str += (inp.value || '_'));
        display.textContent = str.replace(/(.{4})(.{2})/, '$1-$2-');
    };
    inputs.forEach(inp => inp.addEventListener('input', updateDisplay));
    updateDisplay();
}

// 设置日期
function setThreeSegmentDate(baseId, isoStr) {
    if (!isoStr) {
        for (let i = 0; i < 6; i++) {
            const el = document.getElementById(`${baseId}-${i}`);
            if (el) el.value = '';
        }
        return;
    }
    const y = isoStr.slice(0, 4);
    const m = isoStr.slice(5, 7);
    const d = isoStr.slice(8, 10);
    const parts = y + m + d; // YYYYMMDD

    for (let i = 0; i < 6; i++) {
        const el = document.getElementById(`${baseId}-${i}`);
        if (el) el.value = parts[i] || '';
    }
}

// 获取日期
function getThreeSegmentDate(baseId) {
    let str = '';
    for (let i = 0; i < 6; i++) {
        const el = document.getElementById(`${baseId}-${i}`);
        if (!el) return '';
        const v = el.value.trim();
        if (!v) return '';
        str += v;
    }
    if (str.length !== 6) return '';
    return str.slice(0, 4) + '-' + str.slice(4, 6) + '-' + str.slice(6, 8);
}

// 保质期计算
function calculateExpireDate(months) {
    if (!months) return;

    const prodStr = getThreeSegmentDate('field-produceDate');
    if (!prodStr) {
        alert('请先输入生产日期');
        return;
    }

    const prod = new Date(prodStr + 'T00:00:00');
    const exp = new Date(prod);
    exp.setMonth(exp.getMonth() + months);
    setThreeSegmentDate('field-expireDate', exp.toISOString().split('T')[0]);

    // 如果是12个月以下，直接设置余量 = 总量
    if (months <= 12) {
        const capVal = dom.fCapacity.value;
        if (capVal) {
            dom.fStock.value = capVal;
        }
    }
}

// 同步保质期状态
function syncShelfLifeState() {
    const prodStr = getThreeSegmentDate('field-produceDate');
    const expStr = getThreeSegmentDate('field-expireDate');
    const customVal = dom.fCustomShelfLife.value;

    // 当生产日期变化时
    if (prodStr) {
        // 清除旧的快捷选择
        if (shelfLifeChipSelector) {
            shelfLifeChipSelector.deselectAll();
        }
    }

    // 当生产日期和保质期都有值时，反算月份
    if (prodStr && expStr) {
        const prod = new Date(prodStr + 'T00:00:00');
        const exp = new Date(expStr + 'T00:00:00');

        let monthsDiff = (exp.getFullYear() - prod.getFullYear()) * 12;
        monthsDiff += (exp.getMonth() - prod.getMonth());

        // 四舍五入到整数
        const roundedMonths = Math.round(monthsDiff);
        dom.fCustomShelfLife.value = roundedMonths;
        
        // 清除快捷选择
        if (shelfLifeChipSelector) {
            shelfLifeChipSelector.deselectAll();
        }
    } else if (customVal) {
        // 清除快捷选择
        if (shelfLifeChipSelector) {
            shelfLifeChipSelector.deselectAll();
        }
    }
}

// 打开表单（新增）
function openSheet() {
    dom.formBackdrop.classList.remove('hidden');
    dom.formSheet.classList.remove('hidden');

    setTimeout(() => {
        dom.formBackdrop.classList.remove('opacity-0');
        dom.formSheet.classList.remove('translate-y-full');
    }, 10);

    // 切换到手动录入
    dom.tabManual.classList.remove('hidden');
    dom.tabHistory.classList.add('hidden');

    // 清空表单
    clearForm();
}

// 编辑表单
function editSheet(id) {
    const inventory = getInventory();
    const med = inventory.find(m => m.id === id);
    if (!med) return;

    openSheet();

    // 填入ID
    dom.fId.value = med.id;
    dom.fName.value = med.name || '';
    dom.fBrand.value = med.brand || '';
    dom.fCapacity.value = med.capacity !== undefined ? med.capacity : '';
    dom.fStock.value = med.stock !== undefined ? med.stock : '';

    // 重置并填充单位
    if (unitChipSelector) {
        unitChipSelector.deselectAll();
        if (med.unit) {
            const chip = Array.from(document.querySelectorAll('.unit-chip')).find(c => c.textContent === med.unit);
            if (chip) {
                unitChipSelector.select(chip.textContent);
            } else {
                dom.fUnitCustom.value = med.unit;
            }
        }
    }

    // 日期逻辑
    setThreeSegmentDate('field-purchaseDate', med.purchaseDate || '');
    setThreeSegmentDate('field-openDate', med.openDate || '');
    setThreeSegmentDate('field-produceDate', med.produceDate || '');
    setThreeSegmentDate('field-expireDate', med.expireDate || '');

    // 保质期逻辑
    if (med.produceDate && med.expireDate) {
        const prod = new Date(med.produceDate + 'T00:00:00');
        const exp = new Date(med.expireDate + 'T00:00:00');
        let monthsDiff = (exp.getFullYear() - prod.getFullYear()) * 12;
        monthsDiff += (exp.getMonth() - prod.getMonth());
        const roundedMonths = Math.round(monthsDiff);
        dom.fCustomShelfLife.value = roundedMonths;
    } else if (med.shelfLifeMonths) {
        dom.fCustomShelfLife.value = med.shelfLifeMonths;
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

// 清空表单
function clearForm() {
    dom.fId.value = '';
    dom.fName.value = '';
    dom.fBrand.value = '';

    setThreeSegmentDate('field-purchaseDate', '');
    setThreeSegmentDate('field-openDate', '');
    setThreeSegmentDate('field-produceDate', '');
    dom.fCustomShelfLife.value = '';
    
    if (shelfLifeChipSelector) {
        shelfLifeChipSelector.deselectAll();
    }

    setThreeSegmentDate('field-expireDate', '');
    dom.fCapacity.value = '';
    dom.fStock.value = '';

    // 清除单位选择状态
    if (unitChipSelector) {
        unitChipSelector.deselectAll();
    }
    dom.fUnitCustom.value = '';

    // 默认折叠计算器
    if (!dom.calcBody.classList.contains('hidden')) {
        dom.calcBody.classList.add('hidden');
        dom.calcHeader.querySelector('span').textContent = '保质期计算器 (点我展开)';
        dom.calcIcon.style.transform = 'rotate(0deg)';
    }

    // 清空成分
    const ingredientsContainer = document.getElementById('ingredients-container');
    if (ingredientsContainer) ingredientsContainer.innerHTML = '';
}

// 关闭表单
function closeSheet() {
    dom.formBackdrop.classList.add('opacity-0');
    dom.formSheet.classList.add('translate-y-full');
    setTimeout(() => {
        dom.formBackdrop.classList.add('hidden');
        dom.formSheet.classList.add('hidden');
    }, 300);
}

// 提交数据
function submitData() {
    // 利用浏览器原生 Validity API 检查必填项
    if (!dom.formEl.checkValidity()) {
        dom.formEl.reportValidity();
        return;
    }

    // 提取单位
    let finalUnit = '';
    if (unitChipSelector) {
        finalUnit = unitChipSelector.getSelectedValue();
    }
    if (!finalUnit) {
        finalUnit = dom.fUnitCustom.value.trim();
    }

    // 手动验证必填组：必须有单位
    if (!finalUnit) {
        alert('请选择或输入药品单位哦💊');
        return;
    }

    // 提取保质期
    let shelfLifeMonths = null;
    if (shelfLifeChipSelector) {
        const selectedChip = shelfLifeChipSelector.getSelectedElement();
        if (selectedChip) {
            shelfLifeMonths = parseInt(selectedChip.dataset.months);
        }
    }
    if (!shelfLifeMonths && dom.fCustomShelfLife.value) {
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
// 初始化
// ----------------------------
function init() {
    // 初始化日期字段
    initDateFields('field-purchaseDate');
    initDateFields('field-openDate');
    initDateFields('field-produceDate');
    initDateFields('field-expireDate');

    // 初始化芯片选择器（如果组件库可用）
    try {
        if (typeof ChuMeComponents !== 'undefined' && ChuMeComponents.ChipSelector) {
            // 单位芯片选择器
            unitChipSelector = new ChuMeComponents.ChipSelector({
                containerSelector: dom.unitChipsContainer,
                chipSelector: '.unit-chip',
                onSelect: (chip, value) => {
                    dom.fUnitCustom.value = '';
                },
                onDeselect: () => {},
                singleSelect: true,
                selectedClass: 'bg-macaroon-green text-teal-900 border-macaroon-green',
                deselectedClass: 'bg-white text-gray-600 border-gray-200'
            });

            // 保质期芯片选择器
            shelfLifeChipSelector = new ChuMeComponents.ChipSelector({
                containerSelector: dom.shelfLifeChipsContainer,
                chipSelector: '.shelf-life-chip',
                onSelect: (chip, value) => {
                    dom.fCustomShelfLife.value = '';
                    calculateExpireDate(parseInt(chip.dataset.months));
                },
                onDeselect: () => {},
                singleSelect: true,
                selectedClass: 'bg-macaroon-purple text-white border-macaroon-purple',
                deselectedClass: 'bg-white text-gray-600 border-gray-200'
            });
        }
    } catch (e) {
        console.error('初始化芯片选择器失败:', e);
        initFallbackEventHandlers();
    }

    // 关闭表单
    dom.btnCloseForm.addEventListener('click', closeSheet);
    dom.formBackdrop.addEventListener('click', closeSheet);

    // 提交保存
    dom.btnSave.addEventListener('click', submitData);

    // 自定义输入交互
    dom.fUnitCustom.addEventListener('input', () => {
        if (unitChipSelector) {
            unitChipSelector.deselectAll();
        }
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

    dom.fCustomShelfLife.addEventListener('input', () => {
        if (shelfLifeChipSelector) {
            shelfLifeChipSelector.deselectAll();
        }
    });

    dom.fCustomShelfLife.addEventListener('blur', (e) => {
        if (e.target.value) {
            calculateExpireDate(parseInt(e.target.value));
        }
    });

    // 日期变更监听
    dom.fProduce.addEventListener('input', syncShelfLifeState);

    // 渲染初始界面
    renderBoard();

    // 绑定全局事件
    bindGlobalEvents();
}

// 兼容性回退：如果组件库不可用，使用原有的事件处理
function initFallbackEventHandlers() {
    // 单位芯片回退
    document.querySelectorAll('.unit-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            document.querySelectorAll('.unit-chip').forEach(c => {
                c.classList.remove('bg-macaroon-green', 'text-teal-900', 'border-macaroon-green');
                c.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
            });
            e.target.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            e.target.classList.add('bg-macaroon-green', 'text-teal-900', 'border-macaroon-green');
            dom.fUnitCustom.value = '';
        });
    });

    // 保质期芯片回退
    document.querySelectorAll('.shelf-life-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            document.querySelectorAll('.shelf-life-chip').forEach(c => {
                c.classList.remove('bg-macaroon-purple', 'text-white', 'border-macaroon-purple');
                c.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
            });
            e.target.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            e.target.classList.add('bg-macaroon-purple', 'text-white', 'border-macaroon-purple');
            dom.fCustomShelfLife.value = '';
            calculateExpireDate(parseInt(e.target.dataset.months));
        });
    });
}

// 渲染主界面
function renderBoard(searchTerm = '') {
    const inventory = getInventory();
    const container = document.getElementById('med-board');

    if (!container) return;

    // 空状态
    if (isEmptyInventory()) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-[50vh] px-8 text-center text-gray-400">
                <i class="fas fa-pills text-6xl mb-4 opacity-30"></i>
                <p class="text-sm font-semibold mb-2">药箱还是空的哦💊</p>
                <p class="text-xs">点击下方按钮添加你的第一份药品吧！</p>
            </div>
        `;
        return;
    }

    // 筛选逻辑
    let filtered = inventory;
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = inventory.filter(m => 
            (m.name && m.name.toLowerCase().includes(term)) ||
            (m.brand && m.brand.toLowerCase().includes(term))
        );
    }

    // 按更新时间倒序
    filtered.sort((a, b) => new Date(b.updated) - new Date(a.updated));

    let html = '<div class="grid gap-3">';
    filtered.forEach(med => {
        const isSelected = selectedIds.has(med.id);
        const selectedClass = isSelected ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white';
        const selectedIcon = isSelected ? '<div class="absolute top-2 left-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"><i class="fas fa-check text-white text-[8px]"></i></div>' : '';

        html += `
            <div class="relative border rounded-2xl p-4 ${selectedClass} transition-all" onclick="${globalMode === 'NORMAL' ? `editSheet('${med.id}')` : `toggleSelect('${med.id}')`}">
                ${selectedIcon}
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-900">${escapeStr(med.name)}</h4>
                        <p class="text-xs text-gray-500 mt-1">${escapeStr(med.brand || '无品牌')}</p>
                    </div>
                    <div class="text-right text-sm">
                        <div class="font-medium text-gray-900">余${med.stock}/${med.capacity}${med.unit}</div>
                        <div class="text-xs text-gray-400 mt-1">${shortDate(med.expireDate)}到期</div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// 绑定全局事件
function bindGlobalEvents() {
    // 搜索
    dom.searchInput.addEventListener('input', (e) => {
        renderBoard(e.target.value.trim());
    });

    // 全局模式
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

    // 删除操作
    dom.btnDelete.addEventListener('click', () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`确认删除 ${selectedIds.size} 项药品吗？此操作不可撤销。`)) return;
        batchDelete(Array.from(selectedIds));
        setMode('NORMAL');
    });

    // 完成操作
    dom.btnModeDone.addEventListener('click', () => {
        setMode('NORMAL');
    });

    // 新增按钮
    document.getElementById('btn-add').addEventListener('click', openSheet);
}

// Go!
init();