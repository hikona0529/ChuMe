/**
 * ChuMe 共享UI组件库
 * 消除重复代码，提供一致的UI交互模式
 */

// ==================== 日历组件 ====================

/**
 * 通用日历组件
 * 统一管理日历的渲染和交互逻辑
 */
class CalendarComponent {
    constructor(options) {
        this.containerId = options.containerId || 'cal-days';
        this.titleId = options.titleId || 'cal-title';
        this.dataSource = options.dataSource; // 必须提供，返回Promise
        this.markLogic = options.markLogic || (() => null);
        this.onSelect = options.onSelect;
        this.selectedClass = options.selectedClass || 'bg-blue-500 text-white shadow-md hover:bg-blue-600';
        this.defaultClass = options.defaultClass || 'hover:bg-gray-100 text-slate-700 cursor-pointer';
        this.futureClass = options.futureClass || 'text-gray-300 pointer-events-none';
        this.markSymbol = options.markSymbol || {
            default: '✓',
            success: '✓',
            warning: '×'
        };
        
        this.container = null;
        this.titleElement = null;
        this.currentDate = new Date();
        this.selectedDate = null;
    }

    /**
     * 渲染指定月份的日历
     * @param {Date} date - 要显示的月份
     * @param {string} selectedDateStr - 当前选中的日期字符串 (YYYY-MM-DD)
     */
    async render(date, selectedDateStr = null) {
        if (!this.container) {
            this.container = document.getElementById(this.containerId);
            this.titleElement = document.getElementById(this.titleId);
            if (!this.container || !this.titleElement) {
                console.error(`Calendar container not found: ${this.containerId} or ${this.titleId}`);
                return;
            }
        }

        this.currentDate = new Date(date);
        this.selectedDate = selectedDateStr;
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // 更新标题
        this.titleElement.innerText = `${year}年 ${month + 1}月`;

        try {
            // 获取数据
            const data = await this.dataSource(year, month, selectedDateStr);
            
            // 生成日历HTML
            const html = this.generateCalendarHTML(year, month, data);
            this.container.innerHTML = html;
            
            // 绑定事件
            this.bindEvents();
            
        } catch (error) {
            console.error('Calendar render error:', error);
            this.container.innerHTML = '<div class="text-center text-gray-400 py-8">加载失败</div>';
        }
    }

    /**
     * 生成日历HTML
     */
    generateCalendarHTML(year, month, data) {
        const firstDay = new Date(year, month, 1).getDay(); // 0=周日, 6=周六
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let html = '';
        
        // 空白的起始单元格
        for (let i = 0; i < firstDay; i++) {
            html += '<div></div>';
        }
        
        // 日期单元格
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dateStr = this.formatDateString(year, month + 1, day);
            const isFuture = dateObj > today;
            const isSelected = this.selectedDate === dateStr;
            
            // 应用标记逻辑
            const markInfo = this.markLogic(dateStr, data, { isSelected, isFuture });
            
            // 确定样式类
            let cellClass = this.defaultClass;
            if (isSelected) {
                cellClass = this.selectedClass;
            } else if (isFuture) {
                cellClass = this.futureClass;
            }
            
            // 标记HTML
            let markHtml = '';
            if (markInfo) {
                const sizeStyle = markInfo.sizeStyle || 'text-[10px]';
                const colorClass = markInfo.colorClass || 'text-green-500';
                const symbol = markInfo.symbol || this.markSymbol.default;
                
                markHtml = `
                    <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 leading-none ${sizeStyle} ${colorClass}">
                        ${symbol}
                    </div>
                `;
            }
            
            html += `
                <div data-date="${dateStr}" 
                     class="relative w-8 h-9 mx-auto flex items-center justify-center rounded-lg text-sm font-medium transition-all ${cellClass}">
                    ${day}
                    ${markHtml}
                </div>
            `;
        }
        
        return html;
    }

    /**
     * 格式化日期字符串
     */
    formatDateString(year, month, day) {
        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${year}-${mm}-${dd}`;
    }

    /**
     * 绑定单元格点击事件
     */
    bindEvents() {
        const cells = this.container.querySelectorAll('[data-date]');
        cells.forEach(cell => {
            const dateStr = cell.dataset.date;
            const isFuture = cell.classList.contains(this.futureClass.split(' ')[0]);
            
            if (!isFuture) {
                cell.addEventListener('click', () => {
                    this.selectDate(dateStr, cell);
                });
            }
        });
    }

    /**
     * 选择日期
     */
    selectDate(dateStr, element) {
        if (this.onSelect) {
            this.onSelect(dateStr, element);
        }
        this.selectedDate = dateStr;
        
        // 更新选中状态
        const cells = this.container.querySelectorAll('[data-date]');
        cells.forEach(cell => {
            if (cell.dataset.date === dateStr) {
                cell.className = cell.className.replace(this.defaultClass, this.selectedClass);
                cell.className = cell.className.replace(this.futureClass, this.selectedClass);
            } else {
                cell.className = cell.className.replace(this.selectedClass, this.defaultClass);
                // 保持未来日期的样式
                if (!cell.classList.contains(this.futureClass.split(' ')[0])) {
                    cell.className = cell.className.replace(this.selectedClass, this.defaultClass);
                }
            }
        });
    }

    /**
     * 导航到上一个月
     */
    prevMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        return this.render(this.currentDate, this.selectedDate);
    }

    /**
     * 导航到下一个月
     */
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        return this.render(this.currentDate, this.selectedDate);
    }

    /**
     * 导航到今天
     */
    goToToday() {
        this.currentDate = new Date();
        const todayStr = this.formatDateString(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth() + 1,
            this.currentDate.getDate()
        );
        return this.render(this.currentDate, todayStr);
    }
}

// ==================== 模态框管理器 ====================

/**
 * 统一管理模态框的显示和隐藏
 */
class ModalManager {
    static defaultOptions = {
        animationDuration: 200,
        useBackdrop: true,
        closeOnBackdropClick: true,
        closeOnEsc: true
    };

    // 使用 Map 保存事件回调引用（dataset 只能存字符串，无法存函数）
    static _handlers = new Map();

    /**
     * 显示模态框
     */
    static show(modalId, options = {}) {
        const config = { ...this.defaultOptions, ...options };
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal not found: ${modalId}`);
            return false;
        }

        // 清理之前可能残留的事件监听
        this.cleanup(modal, modalId);

        // 移除隐藏类
        modal.classList.remove('hidden');
        
        // 如果有动画，延迟添加显示类
        if (config.animationDuration > 0) {
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                const card = modal.querySelector('[data-modal-card]');
                if (card) {
                    card.classList.remove('scale-95');
                    card.classList.add('scale-100');
                }
            }, 10);
        }

        const handlers = {};

        // 添加ESC键关闭监听
        if (config.closeOnEsc) {
            handlers.escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.hide(modalId, config);
                }
            };
            document.addEventListener('keydown', handlers.escHandler);
        }

        // 添加背景点击关闭
        if (config.closeOnBackdropClick) {
            handlers.backdropHandler = (e) => {
                if (e.target === modal || e.target.hasAttribute('data-modal-backdrop')) {
                    this.hide(modalId, config);
                }
            };
            modal.addEventListener('click', handlers.backdropHandler);
        }

        // 将回调引用保存到 Map 中
        this._handlers.set(modalId, handlers);

        return true;
    }

    /**
     * 隐藏模态框
     */
    static hide(modalId, options = {}) {
        const config = { ...this.defaultOptions, ...options };
        const modal = document.getElementById(modalId);
        if (!modal) return false;

        // 开始隐藏动画
        if (config.animationDuration > 0) {
            modal.classList.add('opacity-0');
            const card = modal.querySelector('[data-modal-card]');
            if (card) {
                card.classList.remove('scale-100');
                card.classList.add('scale-95');
            }

            setTimeout(() => {
                modal.classList.add('hidden');
                this.cleanup(modal, modalId);
            }, config.animationDuration);
        } else {
            modal.classList.add('hidden');
            this.cleanup(modal, modalId);
        }

        return true;
    }

    /**
     * 清理事件监听器（从 Map 中取出真实函数引用）
     */
    static cleanup(modal, modalId) {
        const handlers = this._handlers.get(modalId);
        if (!handlers) return;

        if (handlers.escHandler) {
            document.removeEventListener('keydown', handlers.escHandler);
        }
        if (handlers.backdropHandler) {
            modal.removeEventListener('click', handlers.backdropHandler);
        }

        this._handlers.delete(modalId);
    }
}

// ==================== 选项卡切换器 ====================

/**
 * 统一管理选项卡切换逻辑
 */
class TabSwitcher {
    /**
     * 支持两种构造方式：
     * 1. new TabSwitcher(containerId, options)  — 原有方式（通过 data-tab 属性关联页面）
     * 2. new TabSwitcher(options)              — 新方式（仅控制 tab 按钮样式，无页面切换）
     *    options: { containerSelector, tabSelector, onTabChange, selectedClass, deselectedClass, activeTab }
     */
    constructor(firstArg, secondArg) {
        // 判断调用方式
        if (typeof firstArg === 'object' && firstArg !== null && !secondArg) {
            // 新方式：传入 options 对象
            this._initFromOptions(firstArg);
        } else {
            // 原有方式：传入 containerId + options
            this._initFromContainerId(firstArg, secondArg || {});
        }
    }

    /**
     * 新方式初始化（med-reminders 等页面使用）
     */
    _initFromOptions(opts) {
        this.mode = 'simple'; // 仅切换按钮样式，不管理页面
        this.options = {
            selectedClass: opts.selectedClass || 'bg-white text-black shadow-sm',
            deselectedClass: opts.deselectedClass || 'text-gray-500 hover:text-gray-900',
            onTabChange: opts.onTabChange || null,
            activeTab: opts.activeTab || null
        };

        // 通过选择器找到容器和按钮
        const container = document.querySelector(opts.containerSelector);
        if (!container) {
            console.error(`TabSwitcher 容器未找到: ${opts.containerSelector}`);
            return;
        }

        const tabSelector = opts.tabSelector || '[data-period]';
        this.tabs = Array.from(container.querySelectorAll(tabSelector));
        this.activeTabElement = null;

        // 绑定点击事件
        this.tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const dataVal = btn.dataset.period || btn.dataset.tab || btn.dataset.val || btn.textContent.trim();
                this.setActiveTab(dataVal);
            });
        });

        // 设置初始激活
        if (this.options.activeTab) {
            this.setActiveTab(this.options.activeTab);
        }
    }

    /**
     * 原有方式初始化（bodydata 等页面使用）
     */
    _initFromContainerId(containerId, options) {
        this.mode = 'page'; // 管理页面切换
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Tab container not found: ${containerId}`);
        }

        this.options = {
            activeClass: 'bg-white text-black shadow-sm',
            inactiveClass: 'text-gray-500 hover:text-gray-900',
            pageActiveClass: '',
            pageInactiveClass: 'hidden',
            animationClass: 'animate-fade-in',
            animationDuration: 300,
            ...options
        };

        this.tabsList = [];
        this.activeTabObj = null;
        this._initPageMode();
    }

    _initPageMode() {
        const tabButtons = this.container.querySelectorAll('[data-tab]');
        
        tabButtons.forEach(button => {
            const tabId = button.dataset.tab;
            const targetId = button.dataset.target || `tab-${tabId}`;
            const target = document.getElementById(targetId);
            
            if (!target) {
                console.warn(`Tab target not found: ${targetId}`);
                return;
            }

            const tab = {
                id: tabId,
                button,
                target,
                isActive: button.classList.contains(this.options.activeClass.split(' ')[0])
            };

            this.tabsList.push(tab);

            if (tab.isActive) {
                this.activeTabObj = tab;
            }

            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTo(tabId);
            });
        });

        if (!this.activeTabObj && this.tabsList.length > 0) {
            this.switchTo(this.tabsList[0].id);
        }
    }

    /**
     * 设置当前激活的 tab（simple 模式专用，通过 data 属性匹配）
     */
    setActiveTab(tabValue) {
        if (this.mode === 'simple') {
            const selectedClasses = this.options.selectedClass.split(' ').filter(Boolean);
            const deselectedClasses = this.options.deselectedClass.split(' ').filter(Boolean);

            this.tabs.forEach(btn => {
                const dataVal = btn.dataset.period || btn.dataset.tab || btn.dataset.val || btn.textContent.trim();
                if (dataVal === tabValue) {
                    deselectedClasses.forEach(c => btn.classList.remove(c));
                    selectedClasses.forEach(c => btn.classList.add(c));
                    this.activeTabElement = btn;
                } else {
                    selectedClasses.forEach(c => btn.classList.remove(c));
                    deselectedClasses.forEach(c => btn.classList.add(c));
                }
            });

            // 触发回调
            if (this.options.onTabChange) {
                this.options.onTabChange(this.activeTabElement, tabValue);
            }
        } else {
            // page 模式下调用 switchTo
            this.switchTo(tabValue);
        }
    }

    /**
     * 切换到指定选项卡（page 模式专用）
     */
    switchTo(tabId) {
        if (this.mode !== 'page') return;

        const newTab = this.tabsList.find(t => t.id === tabId);
        if (!newTab || newTab === this.activeTabObj) return;

        if (this.options.onBeforeSwitch) {
            const shouldSwitch = this.options.onBeforeSwitch(this.activeTabObj?.id, tabId);
            if (shouldSwitch === false) return;
        }

        if (this.activeTabObj) {
            this.activeTabObj.button.className = this.options.inactiveClass;
            this.activeTabObj.target.classList.add(this.options.pageInactiveClass);
            this.activeTabObj.target.classList.remove(this.options.pageActiveClass);
            if (this.options.animationClass) {
                this.activeTabObj.target.classList.remove(this.options.animationClass);
            }
        }

        newTab.button.className = this.options.activeClass;
        newTab.target.classList.remove(this.options.pageInactiveClass);
        newTab.target.classList.add(this.options.pageActiveClass);
        if (this.options.animationClass) {
            newTab.target.classList.add(this.options.animationClass);
        }

        this.activeTabObj = newTab;

        if (this.options.onAfterSwitch) {
            this.options.onAfterSwitch(tabId);
        }
    }

    /**
     * 获取当前活跃选项卡
     */
    getActiveTab() {
        return this.mode === 'page' ? this.activeTabObj : this.activeTabElement;
    }
}

// ==================== 芯片选择器 ====================

/**
 * 统一管理芯片选择器逻辑
 */
class ChipSelector {
    /**
     * 支持两种构造方式：
     * 1. new ChipSelector(cssSelector, options) — 原有方式
     * 2. new ChipSelector(options)             — 新方式
     *    options: { containerSelector, chipSelector, singleSelect, selectedClass, deselectedClass, onSelect, onDeselect }
     */
    constructor(firstArg, secondArg) {
        if (typeof firstArg === 'object' && firstArg !== null && !secondArg) {
            // 新方式：单个 options 对象
            this._initFromOptions(firstArg);
        } else {
            // 原有方式：(selectorString, options)
            this._initFromSelector(firstArg, secondArg || {});
        }
    }

    /**
     * 新方式初始化（medicine-refactored / med-reminders 使用）
     */
    _initFromOptions(opts) {
        // 在容器内查找芯片
        const container = document.querySelector(opts.containerSelector);
        const chipSelector = opts.chipSelector || '[data-value]';
        
        if (container) {
            this.chips = Array.from(container.querySelectorAll(chipSelector));
        } else {
            // 如果容器找不到，尝试全局查找
            this.chips = Array.from(document.querySelectorAll(chipSelector));
        }

        if (this.chips.length === 0) {
            console.warn(`ChipSelector: 未找到芯片元素 (container: ${opts.containerSelector}, chip: ${chipSelector})`);
        }

        this.options = {
            activeClass: opts.selectedClass || 'bg-blue-500 text-white border-blue-500',
            inactiveClass: opts.deselectedClass || 'bg-white text-gray-600 border-gray-200',
            multiple: opts.singleSelect === false || opts.multiple === true, // singleSelect=false → 多选
            dataAttribute: 'data-value',
            onSelect: opts.onSelect || null,
            onDeselect: opts.onDeselect || null,
            onChange: opts.onChange || null
        };

        this.selectedChips = new Set();
        this._selectedElements = new Map(); // value → DOM element 映射
        this._bindEvents();
    }

    /**
     * 原有方式初始化
     */
    _initFromSelector(containerSelector, options) {
        this.chips = Array.from(document.querySelectorAll(containerSelector));
        if (this.chips.length === 0) {
            console.warn(`No chips found with selector: ${containerSelector}`);
        }

        this.options = {
            activeClass: options.activeClass || 'bg-blue-500 text-white border-blue-500',
            inactiveClass: options.inactiveClass || 'bg-white text-gray-600 border-gray-200',
            multiple: options.multiple || false,
            dataAttribute: options.dataAttribute || 'data-value',
            onSelect: options.onSelect || null,
            onDeselect: options.onDeselect || null,
            onChange: options.onChange || null
        };

        this.selectedChips = new Set();
        this._selectedElements = new Map();
        this._bindEvents();
    }

    /**
     * 绑定点击事件
     */
    _bindEvents() {
        this.chips.forEach(chip => {
            // 检查初始选中状态
            if (chip.classList.contains(this.options.activeClass.split(' ')[0])) {
                const value = this._getChipValue(chip);
                this.selectedChips.add(value);
                this._selectedElements.set(value, chip);
            }

            chip.addEventListener('click', (e) => {
                this._handleClick(chip, e);
            });
        });
    }

    /**
     * 获取芯片的值
     */
    _getChipValue(chip) {
        return chip.getAttribute(this.options.dataAttribute) || chip.textContent.trim();
    }

    /**
     * 处理芯片点击
     */
    _handleClick(chip, event) {
        const value = this._getChipValue(chip);
        
        if (this.options.multiple) {
            // 多选模式：切换
            if (this.selectedChips.has(value)) {
                this._doDeselect(chip, value);
            } else {
                this._doSelect(chip, value);
            }
        } else {
            // 单选模式
            if (!this.selectedChips.has(value)) {
                // 先取消已有选中
                this.chips.forEach(c => {
                    const cv = this._getChipValue(c);
                    if (this.selectedChips.has(cv)) {
                        this._doDeselect(c, cv);
                    }
                });
                this._doSelect(chip, value);
            }
        }

        if (this.options.onChange) {
            this.options.onChange(this.getSelectedValues(), this.selectedChips);
        }
    }

    /**
     * 内部：选中一个芯片
     */
    _doSelect(chip, value) {
        const inactiveClasses = this.options.inactiveClass.split(' ').filter(Boolean);
        const activeClasses = this.options.activeClass.split(' ').filter(Boolean);
        
        inactiveClasses.forEach(cls => chip.classList.remove(cls));
        activeClasses.forEach(cls => chip.classList.add(cls));
        
        this.selectedChips.add(value);
        this._selectedElements.set(value, chip);
        
        if (this.options.onSelect) {
            this.options.onSelect(chip, value);
        }
    }

    /**
     * 内部：取消选中一个芯片
     */
    _doDeselect(chip, value) {
        const inactiveClasses = this.options.inactiveClass.split(' ').filter(Boolean);
        const activeClasses = this.options.activeClass.split(' ').filter(Boolean);
        
        activeClasses.forEach(cls => chip.classList.remove(cls));
        inactiveClasses.forEach(cls => chip.classList.add(cls));
        
        this.selectedChips.delete(value);
        this._selectedElements.delete(value);
        
        if (this.options.onDeselect) {
            this.options.onDeselect(chip, value);
        }
    }

    // ========== 公共 API ==========

    /**
     * 通过值选中一个芯片（业务代码调用）
     */
    select(value) {
        const chip = this.chips.find(c => this._getChipValue(c) === value);
        if (!chip) return;

        if (!this.options.multiple) {
            // 单选模式下先清空
            this.chips.forEach(c => {
                const cv = this._getChipValue(c);
                if (this.selectedChips.has(cv)) {
                    this._doDeselect(c, cv);
                }
            });
        }
        this._doSelect(chip, value);
    }

    /**
     * 取消所有选中（业务代码常用）
     */
    deselectAll() {
        this.chips.forEach(chip => {
            const value = this._getChipValue(chip);
            if (this.selectedChips.has(value)) {
                this._doDeselect(chip, value);
            }
        });
        this.selectedChips.clear();
        this._selectedElements.clear();
    }

    /**
     * 获取所有选中的值数组
     */
    getSelectedValues() {
        return Array.from(this.selectedChips);
    }

    /**
     * 获取第一个选中的值（单选模式常用）
     */
    getSelectedValue() {
        return this.selectedChips.values().next().value || null;
    }

    /**
     * 获取第一个选中的 DOM 元素
     */
    getSelectedElement() {
        return this._selectedElements.values().next().value || null;
    }

    /**
     * 获取所有选中的 DOM 元素
     */
    getSelectedElements() {
        return Array.from(this._selectedElements.values());
    }

    /**
     * 设置选中的值（批量）
     */
    setSelectedValues(values) {
        this.deselectAll();
        const valuesArray = Array.isArray(values) ? values : [values];
        valuesArray.forEach(value => {
            this.select(value);
        });
    }

    /**
     * 重置（别名，等同 deselectAll）
     */
    reset() {
        this.deselectAll();
    }
}

// ==================== 工具函数 ====================

/**
 * DOM操作工具函数
 */
const DOMUtils = {
    /**
     * 安全设置innerHTML，提供基本的XSS防护
     */
    safeSetInnerHTML(element, html) {
        if (!element) return;
        
        // 简单的XSS防护 - 在实际项目中应该使用更严格的库
        const sanitized = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, 'data-disabled=');
            
        element.innerHTML = sanitized;
    },

    /**
     * 显示元素
     */
    show(element, animationClass = '') {
        if (!element) return;
        
        element.classList.remove('hidden');
        if (animationClass) {
            element.classList.add(animationClass);
        }
    },

    /**
     * 隐藏元素
     */
    hide(element, animationClass = '', delay = 0) {
        if (!element) return;
        
        if (animationClass) {
            element.classList.add(animationClass);
        }
        
        if (delay > 0) {
            setTimeout(() => {
                element.classList.add('hidden');
            }, delay);
        } else {
            element.classList.add('hidden');
        }
    },

    /**
     * 切换元素的显示/隐藏状态
     */
    toggle(element, animationClass = '') {
        if (!element) return;
        
        if (element.classList.contains('hidden')) {
            this.show(element, animationClass);
        } else {
            this.hide(element, animationClass);
        }
    },

    /**
     * 添加多个CSS类
     */
    addClasses(element, ...classes) {
        if (!element) return;
        element.classList.add(...classes);
    },

    /**
     * 移除多个CSS类
     */
    removeClasses(element, ...classes) {
        if (!element) return;
        element.classList.remove(...classes);
    },

    /**
     * 切换多个CSS类
     */
    toggleClasses(element, ...classes) {
        if (!element) return;
        classes.forEach(cls => {
            element.classList.toggle(cls);
        });
    },

    /**
     * 增强 DOM 元素的交互体验
     * 自动为带有 data-enhance 属性的按钮添加按压效果等
     */
    enhanceDOM(container = document) {
        // 为所有按钮添加按压缩放效果（如果尚未添加）
        container.querySelectorAll('button:not([data-enhanced])').forEach(btn => {
            btn.setAttribute('data-enhanced', 'true');
            btn.addEventListener('touchstart', () => {
                btn.style.transform = 'scale(0.95)';
            }, { passive: true });
            btn.addEventListener('touchend', () => {
                btn.style.transform = '';
            }, { passive: true });
        });
    },

    /**
     * 安全转义 HTML 字符串（使用 textContent 方案，防 XSS）
     */
    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }
};

// ==================== 全局注册 ====================

// 全局导出（非模块环境）
if (typeof window !== 'undefined') {
    window.ChuMeComponents = {
        CalendarComponent,
        ModalManager,
        TabSwitcher,
        ChipSelector,
        DOMUtils
    };
}