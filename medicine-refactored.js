/**
 * =========================================
 * 数据层 (Data Layer)
 * 功能：与 localStorage 交互
 * =========================================
 */
const SCHEMA_KEY = 'med_inventory';
const MED_RULES_KEY = 'med_rules';
const MEDICINE_DRAFT_NEW_KEY = 'chume_medicine_draft_new';
const MEDICINE_DRAFT_EDIT_PREFIX = 'chume_medicine_draft_edit_';
const MEDICINE_DRAFT_RESUME_KEY = 'chume_medicine_draft_resume_key';

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

function removeAssociatedReminderRules(medIds) {
    try {
        const rawRules = localStorage.getItem(MED_RULES_KEY);
        if (!rawRules) {
            return { ok: true, removedCount: 0 };
        }

        const rules = JSON.parse(rawRules);
        if (!Array.isArray(rules)) {
            return { ok: true, removedCount: 0 };
        }

        const medIdSet = new Set(medIds.map(id => String(id)));
        const filteredRules = rules.filter(rule => !medIdSet.has(String(rule.medId)));
        const removedCount = rules.length - filteredRules.length;

        if (removedCount > 0) {
            localStorage.setItem(MED_RULES_KEY, JSON.stringify(filteredRules));
        }

        return { ok: true, removedCount };
    } catch (e) {
        console.error('清理关联提醒规则失败:', e);
        return { ok: false, removedCount: 0 };
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
        const cleanupResult = removeAssociatedReminderRules([id]);
        if (cleanupResult.ok) {
            const message = cleanupResult.removedCount > 0
                ? `药品已删除，并清理 ${cleanupResult.removedCount} 条提醒规则`
                : '药品已删除';
            showToast(message, 'success');
        } else {
            showToast('药品已删除，但清理提醒规则失败', 'error');
        }
        return true;
    }
    return false;
}

// 批量删除
function batchDelete(ids) {
    const inventory = getInventory();
    const filtered = inventory.filter(m => !ids.includes(m.id));
    if (saveInventory(filtered)) {
        const cleanupResult = removeAssociatedReminderRules(ids);
        if (cleanupResult.ok) {
            const message = cleanupResult.removedCount > 0
                ? `已删除 ${ids.length} 项药品，并清理 ${cleanupResult.removedCount} 条提醒规则`
                : `已删除 ${ids.length} 项药品`;
            showToast(message, 'success');
        } else {
            showToast(`已删除 ${ids.length} 项药品，但清理提醒规则失败`, 'error');
        }
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
let globalMode = 'NORMAL'; // NORMAL | EDIT | DELETE
const selectedIds = new Set();
let currentFormBaseline = null;

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
    formEl: document.getElementById('medicine-form') || document.getElementById('med-form'),

    // 表单字段
    fId: document.getElementById('field-id'),
    fName: document.getElementById('field-name'),
    fBrand: document.getElementById('field-brand'),
    tabManual: document.getElementById('tab-manual'),
    tabHistory: document.getElementById('tab-history'),
    tabBtnManual: document.getElementById('tab-btn-manual'),
    tabBtnHistory: document.getElementById('tab-btn-history'),

    btnSave: document.getElementById('btn-save'),
    calcHeader: document.getElementById('calc-header'),
    calcBody: document.getElementById('calc-body'),
    calcIcon: document.getElementById('calc-icon'),
    fProduce: document.getElementById('field-produceDate-display'),
    fCustomShelfLife: document.getElementById('field-customShelfLife'),

    fExpire: document.getElementById('field-expireDate-display'),
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
// 单行日期输入组件封装
// 用户在 type=tel 的输入框中输入连续数字（如260504），失去焦点时自动补全并格式化为 2026/05/04
// ----------------------------
function initDateFields(baseId) {
    const display = document.getElementById(`${baseId}-display`);
    if (!display) return;

    // 确保输入框属性正确
    display.setAttribute('inputmode', 'numeric');
    display.setAttribute('maxlength', '10'); // YYYY/MM/DD = 10字符

    // 输入时只允许保留数字和斜杠，不再强制打断用户连续输入
    display.addEventListener('input', (e) => {
        const oldVal = e.target.value;
        const newVal = oldVal.replace(/[^\d/]/g, '');
        if (oldVal !== newVal) {
            e.target.value = newVal;
        }
    });

    // 失去焦点时自动补全与格式化
    display.addEventListener('blur', (e) => {
        const val = e.target.value;
        if (!val) return;

        let digits = val.replace(/\D/g, '');

        // 6位数字自动补齐 20xx
        if (digits.length === 6) {
            digits = '20' + digits;
        }

        // 8位数字自动格式化
        if (digits.length === 8) {
            const y = digits.slice(0, 4);
            const m = digits.slice(4, 6);
            const d = digits.slice(6, 8);
            
            // 简单校验有效性
            const mn = parseInt(m, 10);
            const dn = parseInt(d, 10);
            if (mn >= 1 && mn <= 12 && dn >= 1 && dn <= 31) {
                e.target.value = `${y}/${m}/${d}`;
                // 触发 input 以通知可能依赖此字段的计算器
                e.target.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });
}

// 设置日期（回填到 display 输入框）
function setThreeSegmentDate(baseId, isoStr) {
    const display = document.getElementById(`${baseId}-display`);
    if (!display) return;
    
    if (!isoStr) {
        display.value = '';
        return;
    }
    // isoStr 格式为 YYYY-MM-DD，转为显示格式 YYYY/MM/DD
    display.value = isoStr.replace(/-/g, '/');
}

// 获取日期
// 从 display 输入框中读取，输出标准 YYYY-MM-DD 格式
function getThreeSegmentDate(baseId) {
    const display = document.getElementById(`${baseId}-display`);
    if (!display) return '';
    
    const raw = display.value.trim();
    if (!raw) return '';
    
    // 提取纯数字
    const digits = raw.replace(/\D/g, '');
    
    // 必须是8位完整日期
    if (digits.length === 8) {
        const year = digits.slice(0, 4);
        const month = digits.slice(4, 6);
        const day = digits.slice(6, 8);
        
        // 基本校验：月份1-12，日期1-31
        const m = parseInt(month);
        const d = parseInt(day);
        if (m < 1 || m > 12 || d < 1 || d > 31) return '';
        
        return `${year}-${month}-${day}`;
    } else if (digits.length === 6) {
        // 6位数字：假设 YYMMDD（20xx年）
        const year = '20' + digits.slice(0, 2);
        const month = digits.slice(2, 4);
        const day = digits.slice(4, 6);
        
        const m = parseInt(month);
        const d = parseInt(day);
        if (m < 1 || m > 12 || d < 1 || d > 31) return '';
        
        return `${year}-${month}-${day}`;
    }
    return '';
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

function getDraftKey(mode, medId) {
    if (mode === 'edit' && medId) {
        return MEDICINE_DRAFT_EDIT_PREFIX + String(medId);
    }
    return MEDICINE_DRAFT_NEW_KEY;
}

function getDateDisplayValue(baseId) {
    const display = document.getElementById(`${baseId}-display`);
    return display ? display.value : '';
}

function setDateDisplayValue(baseId, value) {
    const display = document.getElementById(`${baseId}-display`);
    if (display) {
        display.value = value || '';
    }
}

function getSelectedUnitChipValue() {
    if (unitChipSelector) {
        return unitChipSelector.getSelectedValue() || '';
    }
    return '';
}

function getSelectedShelfLifeChipValue() {
    if (!shelfLifeChipSelector) return '';
    const selectedChip = shelfLifeChipSelector.getSelectedElement();
    return selectedChip ? String(selectedChip.dataset.months || '') : '';
}

function collectIngredientDrafts() {
    return Array.from(document.querySelectorAll('.ingredient-row')).map(row => {
        const nameInput = row.querySelector('.ing-name');
        const amountInput = row.querySelector('.ing-amount');
        const unitInput = row.querySelector('.ing-unit');
        return {
            name: nameInput ? String(nameInput.value || '') : '',
            amount: amountInput ? String(amountInput.value || '') : '',
            unit: unitInput ? String(unitInput.value || '') : ''
        };
    });
}

function normalizeIngredientDrafts(ingredients) {
    if (!Array.isArray(ingredients)) return [];
    return ingredients.map(ingredient => ({
        name: ingredient && ingredient.name ? String(ingredient.name) : '',
        amount: ingredient && ingredient.amount !== undefined && ingredient.amount !== null ? String(ingredient.amount) : '',
        unit: ingredient && ingredient.unit ? String(ingredient.unit) : ''
    }));
}

function normalizeDraftSnapshot(snapshot) {
    const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const mode = safeSnapshot.mode === 'edit' ? 'edit' : 'create';
    const medId = mode === 'edit' && safeSnapshot.medId ? String(safeSnapshot.medId) : '';

    return {
        mode: mode,
        medId: medId,
        name: safeSnapshot.name ? String(safeSnapshot.name) : '',
        brand: safeSnapshot.brand ? String(safeSnapshot.brand) : '',
        purchaseDateDisplay: safeSnapshot.purchaseDateDisplay ? String(safeSnapshot.purchaseDateDisplay) : '',
        openDateDisplay: safeSnapshot.openDateDisplay ? String(safeSnapshot.openDateDisplay) : '',
        produceDateDisplay: safeSnapshot.produceDateDisplay ? String(safeSnapshot.produceDateDisplay) : '',
        expireDateDisplay: safeSnapshot.expireDateDisplay ? String(safeSnapshot.expireDateDisplay) : '',
        capacity: safeSnapshot.capacity !== undefined && safeSnapshot.capacity !== null ? String(safeSnapshot.capacity) : '',
        stock: safeSnapshot.stock !== undefined && safeSnapshot.stock !== null ? String(safeSnapshot.stock) : '',
        selectedUnit: safeSnapshot.selectedUnit ? String(safeSnapshot.selectedUnit) : '',
        customUnit: safeSnapshot.customUnit ? String(safeSnapshot.customUnit) : '',
        selectedShelfLife: safeSnapshot.selectedShelfLife ? String(safeSnapshot.selectedShelfLife) : '',
        customShelfLife: safeSnapshot.customShelfLife ? String(safeSnapshot.customShelfLife) : '',
        ingredients: normalizeIngredientDrafts(safeSnapshot.ingredients)
    };
}

function collectCurrentFormSnapshot() {
    return normalizeDraftSnapshot({
        mode: dom.fId && dom.fId.value ? 'edit' : 'create',
        medId: dom.fId ? dom.fId.value : '',
        name: dom.fName ? dom.fName.value : '',
        brand: dom.fBrand ? dom.fBrand.value : '',
        purchaseDateDisplay: getDateDisplayValue('field-purchaseDate'),
        openDateDisplay: getDateDisplayValue('field-openDate'),
        produceDateDisplay: getDateDisplayValue('field-produceDate'),
        expireDateDisplay: getDateDisplayValue('field-expireDate'),
        capacity: dom.fCapacity ? dom.fCapacity.value : '',
        stock: dom.fStock ? dom.fStock.value : '',
        selectedUnit: getSelectedUnitChipValue(),
        customUnit: dom.fUnitCustom ? dom.fUnitCustom.value : '',
        selectedShelfLife: getSelectedShelfLifeChipValue(),
        customShelfLife: dom.fCustomShelfLife ? dom.fCustomShelfLife.value : '',
        ingredients: collectIngredientDrafts()
    });
}

function hasMeaningfulDraftContent(snapshot) {
    const safeSnapshot = normalizeDraftSnapshot(snapshot);
    const hasMainContent = [
        safeSnapshot.name,
        safeSnapshot.brand,
        safeSnapshot.purchaseDateDisplay,
        safeSnapshot.openDateDisplay,
        safeSnapshot.produceDateDisplay,
        safeSnapshot.expireDateDisplay,
        safeSnapshot.capacity,
        safeSnapshot.stock,
        safeSnapshot.selectedUnit,
        safeSnapshot.customUnit,
        safeSnapshot.selectedShelfLife,
        safeSnapshot.customShelfLife
    ].some(Boolean);

    if (hasMainContent) return true;

    return safeSnapshot.ingredients.some(ingredient => ingredient.name || ingredient.amount || ingredient.unit);
}

function areSnapshotsEqual(a, b) {
    return JSON.stringify(normalizeDraftSnapshot(a)) === JSON.stringify(normalizeDraftSnapshot(b));
}

function hasUnsavedFormChanges() {
    if (!currentFormBaseline) {
        return hasMeaningfulDraftContent(collectCurrentFormSnapshot());
    }
    return !areSnapshotsEqual(collectCurrentFormSnapshot(), currentFormBaseline);
}

function readDraftByKey(key) {
    if (!key) return null;
    try {
        const raw = localStorage.getItem(key);
        return raw ? normalizeDraftSnapshot(JSON.parse(raw)) : null;
    } catch (e) {
        console.error('读取药品草稿失败:', e);
        return null;
    }
}

function writeDraftByKey(key, snapshot) {
    if (!key) return false;
    try {
        localStorage.setItem(key, JSON.stringify(normalizeDraftSnapshot(snapshot)));
        return true;
    } catch (e) {
        console.error('保存药品草稿失败:', e);
        showToast('保存草稿失败，请检查存储空间', 'error');
        return false;
    }
}

function removeDraftByKey(key) {
    if (key) {
        localStorage.removeItem(key);
    }
}

function clearResumeDraftKey() {
    localStorage.removeItem(MEDICINE_DRAFT_RESUME_KEY);
}

function rememberCurrentFormBaseline(snapshot) {
    currentFormBaseline = normalizeDraftSnapshot(snapshot || collectCurrentFormSnapshot());
}

function setUnitSelection(selectedUnit, customUnit) {
    const finalCustomUnit = customUnit || '';
    if (unitChipSelector) {
        unitChipSelector.deselectAll();
    }
    if (dom.fUnitCustom) {
        dom.fUnitCustom.value = '';
    }

    if (selectedUnit) {
        const chip = Array.from(document.querySelectorAll('.unit-chip')).find(c => c.textContent === selectedUnit);
        if (chip && unitChipSelector) {
            unitChipSelector.select(chip.textContent);
            return;
        }
        if (dom.fUnitCustom) {
            dom.fUnitCustom.value = selectedUnit;
            return;
        }
    }

    if (dom.fUnitCustom) {
        dom.fUnitCustom.value = finalCustomUnit;
    }
}

function setShelfLifeSelection(selectedShelfLife, customShelfLife) {
    if (shelfLifeChipSelector) {
        shelfLifeChipSelector.deselectAll();
    }
    if (dom.fCustomShelfLife) {
        dom.fCustomShelfLife.value = customShelfLife || selectedShelfLife || '';
    }
}

function applyIngredientDrafts(ingredients) {
    const ingredientsContainer = document.getElementById('ingredients-container');
    if (!ingredientsContainer) return;

    ingredientsContainer.innerHTML = '';
    normalizeIngredientDrafts(ingredients).forEach(ingredient => {
        if (ingredient.name || ingredient.amount || ingredient.unit) {
            addIngredientRow(ingredient.name, ingredient.amount, ingredient.unit);
        }
    });
}

function applyDraftToForm(snapshot) {
    const safeSnapshot = normalizeDraftSnapshot(snapshot);

    if (dom.fId) {
        dom.fId.value = safeSnapshot.mode === 'edit' ? safeSnapshot.medId : '';
    }
    if (dom.fName) dom.fName.value = safeSnapshot.name;
    if (dom.fBrand) dom.fBrand.value = safeSnapshot.brand;

    setDateDisplayValue('field-purchaseDate', safeSnapshot.purchaseDateDisplay);
    setDateDisplayValue('field-openDate', safeSnapshot.openDateDisplay);
    setDateDisplayValue('field-produceDate', safeSnapshot.produceDateDisplay);
    setDateDisplayValue('field-expireDate', safeSnapshot.expireDateDisplay);

    if (dom.fCapacity) dom.fCapacity.value = safeSnapshot.capacity;
    if (dom.fStock) dom.fStock.value = safeSnapshot.stock;
    if (dom.fCustomShelfLife) dom.fCustomShelfLife.value = safeSnapshot.customShelfLife;

    setUnitSelection(safeSnapshot.selectedUnit, safeSnapshot.customUnit);
    setShelfLifeSelection(safeSnapshot.selectedShelfLife, safeSnapshot.customShelfLife);
    applyIngredientDrafts(safeSnapshot.ingredients);
    syncShelfLifeState();
}

function saveCurrentFormDraft(options) {
    const opts = options || {};
    const snapshot = collectCurrentFormSnapshot();

    if (!opts.force && !hasUnsavedFormChanges()) {
        return '';
    }

    if (opts.force && snapshot.mode === 'create' && !hasMeaningfulDraftContent(snapshot)) {
        return '';
    }

    const draftKey = getDraftKey(snapshot.mode, snapshot.medId);
    if (!writeDraftByKey(draftKey, snapshot)) {
        return '';
    }

    if (opts.rememberBaseline) {
        rememberCurrentFormBaseline(snapshot);
    }

    return draftKey;
}

function maybeRestoreDraft(mode, medId, options) {
    const opts = options || {};
    const draftKey = getDraftKey(mode, medId);
    const draft = readDraftByKey(draftKey);

    if (!draft) {
        rememberCurrentFormBaseline();
        return false;
    }

    let shouldUseDraft = true;
    if (!opts.skipPrompt) {
        shouldUseDraft = confirm('检测到上次未保存的草稿，是否直接继续编辑？');
    }

    if (shouldUseDraft) {
        applyDraftToForm(draft);
        rememberCurrentFormBaseline(draft);
        return true;
    }

    removeDraftByKey(draftKey);
    rememberCurrentFormBaseline();
    return false;
}

function openFormShell(mode) {
    if (dom.formBackdrop) {
        dom.formBackdrop.classList.remove('backdrop-hidden');
        dom.formBackdrop.classList.add('backdrop-visible');
    }
    if (dom.formSheet) {
        dom.formSheet.classList.remove('sheet-hidden');
        dom.formSheet.classList.add('sheet-visible');
    }

    const formTitle = document.getElementById('form-title');
    if (formTitle) {
        formTitle.textContent = mode === 'edit' ? '编辑药品' : '新增药品';
    }

    if (dom.tabBtnManual && dom.tabBtnManual.parentElement) {
        if (mode === 'edit') {
            dom.tabBtnManual.parentElement.classList.add('hidden');
        } else {
            dom.tabBtnManual.parentElement.classList.remove('hidden');
        }
    }

    if (dom.tabBtnManual) {
        dom.tabBtnManual.click();
    }
}

function fillFormFromMedicine(med) {
    if (!med) return;

    if (dom.fId) dom.fId.value = med.id;
    if (dom.fName) dom.fName.value = med.name || '';
    if (dom.fBrand) dom.fBrand.value = med.brand || '';
    if (dom.fCapacity) dom.fCapacity.value = med.capacity !== undefined ? med.capacity : '';
    if (dom.fStock) dom.fStock.value = med.stock !== undefined ? med.stock : '';

    setThreeSegmentDate('field-purchaseDate', med.purchaseDate || '');
    setThreeSegmentDate('field-openDate', med.openDate || '');
    setThreeSegmentDate('field-produceDate', med.produceDate || '');
    setThreeSegmentDate('field-expireDate', med.expireDate || '');

    if (med.produceDate && med.expireDate) {
        const prod = new Date(med.produceDate + 'T00:00:00');
        const exp = new Date(med.expireDate + 'T00:00:00');
        let monthsDiff = (exp.getFullYear() - prod.getFullYear()) * 12;
        monthsDiff += (exp.getMonth() - prod.getMonth());
        if (dom.fCustomShelfLife) {
            dom.fCustomShelfLife.value = Math.round(monthsDiff);
        }
    } else if (med.shelfLifeMonths && dom.fCustomShelfLife) {
        dom.fCustomShelfLife.value = med.shelfLifeMonths;
    }

    setUnitSelection(med.unit || '', '');
    setShelfLifeSelection('', dom.fCustomShelfLife ? dom.fCustomShelfLife.value : '');
    applyIngredientDrafts(med.ingredients || []);
    syncShelfLifeState();
}

function requestCloseSheet() {
    if (!hasUnsavedFormChanges()) {
        closeSheet();
        return;
    }

    if (confirm('检测到未保存内容，是否保存为草稿？')) {
        if (saveCurrentFormDraft({ rememberBaseline: true })) {
            showToast('草稿已保存', 'success');
        }
    }

    closeSheet();
}

function resumeDraftAfterAiCount(aiCount) {
    const resumeDraftKey = localStorage.getItem(MEDICINE_DRAFT_RESUME_KEY);
    const resumeDraft = readDraftByKey(resumeDraftKey);
    clearResumeDraftKey();

    if (resumeDraft) {
        openFormShell(resumeDraft.mode);
        clearForm();
        applyDraftToForm(resumeDraft);
        rememberCurrentFormBaseline(resumeDraft);
    } else {
        openSheet();
    }

    const modal = document.getElementById('ai-count-modal');
    const valueSpan = document.getElementById('ai-count-value');
    const btnCapacity = document.getElementById('btn-fill-capacity');
    const btnStock = document.getElementById('btn-fill-stock');
    if (modal && valueSpan && btnCapacity && btnStock) {
        valueSpan.textContent = aiCount;
        modal.classList.remove('hidden');
        btnCapacity.onclick = function() {
            dom.fCapacity.value = aiCount;
            modal.classList.add('hidden');
            saveCurrentFormDraft({ force: true, rememberBaseline: true });
            showToast('已填入包装总量：' + aiCount, 'success');
        };
        btnStock.onclick = function() {
            dom.fStock.value = aiCount;
            modal.classList.add('hidden');
            saveCurrentFormDraft({ force: true, rememberBaseline: true });
            showToast('已填入当前余量：' + aiCount, 'success');
        };
    }
}

// 打开表单（新增）
function openSheet() {
    openFormShell('create');
    clearForm();
    maybeRestoreDraft('create', '', { skipPrompt: false });
}

// 编辑表单
function editSheet(id) {
    const inventory = getInventory();
    const med = inventory.find(m => m.id === id);
    if (!med) return;

    openFormShell('edit');
    clearForm();
    fillFormFromMedicine(med);
    maybeRestoreDraft('edit', id, { skipPrompt: false });
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
    if (dom.formBackdrop) {
        dom.formBackdrop.classList.remove('backdrop-visible');
        dom.formBackdrop.classList.add('backdrop-hidden');
    }
    if (dom.formSheet) {
        dom.formSheet.classList.remove('sheet-visible');
        dom.formSheet.classList.add('sheet-hidden');
    }
}

// 提交数据
function submitData() {
    // 1. 手动必填项校验 (替代不可靠的原生 checkValidity 气泡)
    if (!dom.fName.value.trim()) {
        showToast('请填写药品名称', 'error');
        dom.fName.focus();
        return;
    }

    if (!getThreeSegmentDate('field-expireDate')) {
        showToast('请填写完整且正确的到期时间', 'error');
        dom.fExpire.focus();
        return;
    }

    const capacityVal = Number(dom.fCapacity.value);
    if (!dom.fCapacity.value || isNaN(capacityVal) || capacityVal <= 0) {
        showToast('请填写正确的包装总量（需大于0）', 'error');
        dom.fCapacity.focus();
        return;
    }

    const stockVal = Number(dom.fStock.value);
    if (!dom.fStock.value || isNaN(stockVal) || stockVal < 0) {
        showToast('请填写正确的当前余量', 'error');
        dom.fStock.focus();
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
        produceDate: getThreeSegmentDate('field-produceDate'),
        expireDate: getThreeSegmentDate('field-expireDate'),
        capacity: Number(dom.fCapacity.value),
        stock: Number(dom.fStock.value),
        unit: finalUnit,
        shelfLifeMonths: shelfLifeMonths,
        ingredients: ingredients
    };

    const editId = dom.fId ? dom.fId.value : '';

    let saveOk = false;
    try {
        if (editId) {
            saveOk = updateMed(editId, payload);
        } else {
            saveOk = !!addMed(payload);
        }
    } catch (err) {
        console.error("Save error:", err);
        alert("保存逻辑发生内部错误: " + err.message);
        return;
    }

    if (!saveOk) return;

    removeDraftByKey(getDraftKey(editId ? 'edit' : 'create', editId));
    clearResumeDraftKey();
    currentFormBaseline = null;

    try {
        closeSheet();
        renderBoard();
    } catch (err) {
        console.error("UI update error:", err);
        alert("刷新界面时发生错误: " + err.message);
    }
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

// 安全过滤 (防止 XSS) — 使用 textContent 方案，彻底防止绕过
function escapeStr(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// 日期缩略显示
function shortDate(isoStr) {
    if (!isoStr) return '未知';
    // 支持 YYYY-MM-DD 格式
    const parts = isoStr.split('-');
    if (parts.length === 3) {
        return parts.join('.');
    }
    return isoStr;
}

// 渲染历史模板
function renderHistoryTemplates() {
    const inventory = getInventory();
    const container = dom.tabHistory;
    if (!container) return;

    // 获取唯一药品（去重：同一名称和品牌只留一个）
    const templates = [];
    const seen = new Set();
    const reversed = [...inventory].reverse();
    
    reversed.forEach(med => {
        const key = med.name + '|' + (med.brand || '');
        if (!seen.has(key)) {
            seen.add(key);
            templates.push(med);
        }
    });

    if (templates.length === 0) {
        container.innerHTML = `<div class="text-center text-sm text-chume-brown-light py-10">暂无历史记录</div>`;
        return;
    }

    let html = '<div class="grid gap-3 pt-2">';
    templates.forEach(med => {
        html += `
            <div class="border border-chume-brown/10 rounded-2xl p-4 bg-white active:scale-95 transition-all cursor-pointer shadow-sm" onclick="useTemplate('${med.id}')">
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-900">${escapeStr(med.name)}</h4>
                    <p class="text-xs text-gray-500 mt-1">${escapeStr(med.brand || '无品牌')} | 包装总量: ${escapeStr(String(med.capacity))}${escapeStr(med.unit)}</p>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// 使用模板快速填表
window.useTemplate = function(id) {
    const inventory = getInventory();
    const med = inventory.find(m => m.id === id);
    if (!med) return;

    dom.fName.value = med.name || '';
    dom.fBrand.value = med.brand || '';
    dom.fCapacity.value = med.capacity !== undefined ? med.capacity : '';
    
    // 清空日期、余量及保质期选项（新开药品应重填）
    dom.fStock.value = '';
    setThreeSegmentDate('field-purchaseDate', '');
    setThreeSegmentDate('field-openDate', '');
    setThreeSegmentDate('field-produceDate', '');
    setThreeSegmentDate('field-expireDate', '');
    dom.fCustomShelfLife.value = '';

    // 回显单位
    if (unitChipSelector) {
        unitChipSelector.deselectAll();
        if (med.unit) {
            const chip = Array.from(document.querySelectorAll('.unit-chip')).find(c => c.textContent === med.unit);
            if (chip) unitChipSelector.select(chip.textContent);
            else dom.fUnitCustom.value = med.unit;
        }
    } else {
        dom.fUnitCustom.value = med.unit || '';
    }

    // 回显成分
    const ingredientsContainer = document.getElementById('ingredients-container');
    if (ingredientsContainer) {
        ingredientsContainer.innerHTML = '';
        if (med.ingredients && med.ingredients.length > 0) {
            med.ingredients.forEach(ing => addIngredientRow(ing.name, ing.amount, ing.unit));
        }
    }

    if (shelfLifeChipSelector) shelfLifeChipSelector.deselectAll();

    // 切换回手动面板自动继续
    if (dom.tabBtnManual) dom.tabBtnManual.click();
    showToast('已载入模板信息', 'success', 1500);
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
                selectedClass: 'bg-chume-orange/5 text-chume-orange border-chume-orange border-2 font-bold',
                deselectedClass: 'bg-white text-chume-brown-light border-chume-brown/10 border font-medium'
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
    dom.btnCloseForm.addEventListener('click', requestCloseSheet);
    dom.formBackdrop.addEventListener('click', requestCloseSheet);

    // 提交保存
    dom.btnSave.addEventListener('click', submitData);

    // 历史模板切换机制
    if (dom.tabBtnManual && dom.tabBtnHistory) {
        dom.tabBtnManual.addEventListener('click', () => {
            dom.tabManual.classList.remove('hidden');
            dom.tabHistory.classList.add('hidden');
            dom.tabBtnManual.classList.remove('text-chume-brown-light', 'hover:text-chume-brown');
            dom.tabBtnManual.classList.add('bg-white', 'shadow-card', 'text-chume-brown');
            dom.tabBtnHistory.classList.remove('bg-white', 'shadow-card', 'text-chume-brown');
            dom.tabBtnHistory.classList.add('text-chume-brown-light', 'hover:text-chume-brown');
        });

        dom.tabBtnHistory.addEventListener('click', () => {
            dom.tabHistory.classList.remove('hidden');
            dom.tabManual.classList.add('hidden');
            dom.tabBtnHistory.classList.remove('text-chume-brown-light', 'hover:text-chume-brown');
            dom.tabBtnHistory.classList.add('bg-white', 'shadow-card', 'text-chume-brown');
            dom.tabBtnManual.classList.remove('bg-white', 'shadow-card', 'text-chume-brown');
            dom.tabBtnManual.classList.add('text-chume-brown-light', 'hover:text-chume-brown');
            // 实时渲染历史列表
            renderHistoryTemplates();
        });
    }

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

    // ========== 拍图数药：URL 参数解析 ==========
    var urlParams = new URLSearchParams(window.location.search);
    var aiCount = urlParams.get('ai_count');
    if (aiCount && dom.fCapacity) {
        // 清除 URL 参数，保持地址栏干净
        history.replaceState(null, '', window.location.pathname);
        resumeDraftAfterAiCount(aiCount);
    }

    // 渲染初始界面
    renderBoard();

    // 绑定全局事件
    bindGlobalEvents();

    // ========== 拍图数药按钮跳转 ==========
    var aiCounterBtn = document.getElementById('btn-ai-counter');
    if (aiCounterBtn) {
        aiCounterBtn.addEventListener('click', function() {
            var draftKey = saveCurrentFormDraft({ force: true });
            if (draftKey) {
                localStorage.setItem(MEDICINE_DRAFT_RESUME_KEY, draftKey);
            } else {
                clearResumeDraftKey();
            }
            window.location.href = 'ai-counter.html?source=medicine';
        });
    }
}

// 兼容性回退：如果组件库不可用，使用原有的事件处理
function initFallbackEventHandlers() {
    // 单位芯片回退
    document.querySelectorAll('.unit-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            document.querySelectorAll('.unit-chip').forEach(c => {
                c.classList.remove('bg-chume-orange/5', 'text-chume-orange', 'border-chume-orange', 'border-2', 'font-bold');
                c.classList.add('bg-white', 'text-chume-brown-light', 'border-chume-brown/10', 'border', 'font-medium');
            });
            e.target.classList.remove('bg-white', 'text-chume-brown-light', 'border-chume-brown/10', 'border', 'font-medium');
            e.target.classList.add('bg-chume-orange/5', 'text-chume-orange', 'border-chume-orange', 'border-2', 'font-bold');
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

        let expireHtml = '';
        if (med.expireDate) {
            const todayDate = new Date(getCurrentDateString() + 'T00:00:00');
            const expDate = new Date(med.expireDate + 'T00:00:00');
            const diffTime = expDate - todayDate;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
                const overdueDays = Math.abs(diffDays);
                expireHtml = `<span class="inline-block ml-2 px-1.5 py-0.5 bg-red-50 text-red-500 text-[10px] leading-tight rounded flex-shrink-0 align-middle">已经过期${overdueDays}天</span>`;
            } else if (diffDays <= 30) {
                expireHtml = `<span class="inline-block ml-2 px-1.5 py-0.5 bg-orange-50 text-orange-500 text-[10px] leading-tight rounded flex-shrink-0 align-middle">还有${diffDays}天过期</span>`;
            } else {
                expireHtml = ``;
            }
        } else {
            expireHtml = ``;
        }

        html += `
            <div class="relative border rounded-2xl p-4 ${selectedClass} transition-all" onclick="${globalMode === 'NORMAL' ? `editSheet('${med.id}')` : `toggleSelect('${med.id}')`}">
                ${selectedIcon}
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-900 flex items-center flex-wrap">${escapeStr(med.name)}${expireHtml}</h4>
                        <p class="text-xs text-gray-500 mt-1">${escapeStr(med.brand || '无品牌')}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-xl font-bold text-chume-orange leading-none align-baseline">${escapeStr(String(med.stock))}</span>
                        <span class="text-xs text-gray-400 font-medium align-baseline ml-[1px]">/${escapeStr(String(med.capacity))}${escapeStr(med.unit)}</span>
                    </div>
                </div>
                <div class="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center text-[10px] sm:text-[11px] text-gray-400">
                    <span class="text-left w-1/3 truncate">购于: ${med.purchaseDate ? escapeStr(shortDate(med.purchaseDate)) : '未知'}</span>
                    <span class="text-center w-1/3 truncate">${med.openDate ? '开封: ' + escapeStr(shortDate(med.openDate)) : '未开封'}</span>
                    <span class="text-right w-1/3 truncate">到期: ${med.expireDate ? escapeStr(shortDate(med.expireDate)) : '未知'}</span>
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

    // 删除操作 —— 在 DELETE 模式下，"完成"按钮执行删除
    // btnDelete 不存在独立按钮，删除逻辑已合并到 btnModeDone 的 click 中

    // 完成/取消操作
    dom.btnModeDone.addEventListener('click', () => {
        if (globalMode === 'DELETE' && selectedIds.size > 0) {
            if (!confirm(`确认删除 ${selectedIds.size} 项药品吗？此操作不可撤销。`)) return;
            batchDelete(Array.from(selectedIds));
        }
        setMode('NORMAL');
    });

    // 取消按钮
    const btnCancel = document.getElementById('btn-mode-cancel');
    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            setMode('NORMAL');
        });
    }

    // 新增按钮
    const btnAdd = document.getElementById('btn-mode-add');
    if (btnAdd) btnAdd.addEventListener('click', openSheet);

    // 编辑模式按钮
    const btnManage = document.getElementById('btn-mode-manage');
    if (btnManage) btnManage.addEventListener('click', () => setMode('EDIT'));

    // 删除模式按钮
    const btnDeleteMode = document.getElementById('btn-mode-delete');
    if (btnDeleteMode) btnDeleteMode.addEventListener('click', () => setMode('DELETE'));
}

// Go!
init();
