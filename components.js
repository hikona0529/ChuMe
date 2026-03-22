/**
 * ChuMe 共享UI组件库
 * 消除重复代码，提供一致的UI交互模式
 */

// ==================== 日历组件 ====================

/**
 * 通用日历组件
 * 统一管理日历的渲染和交互逻辑
 */
export class CalendarComponent {
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
export class ModalManager {
    static defaultOptions = {
        animationDuration: 200,
        useBackdrop: true,
        closeOnBackdropClick: true,
        closeOnEsc: true
    };

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

        // 移除隐藏类
        modal.classList.remove('hidden');
        
        // 如果有动画，延迟添加显示类
        if (config.animationDuration > 0) {
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                // 其他可能的动画类
                const card = modal.querySelector('[data-modal-card]');
                if (card) {
                    card.classList.remove('scale-95');
                    card.classList.add('scale-100');
                }
            }, 10);
        }

        // 添加ESC键关闭监听
        if (config.closeOnEsc) {
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.hide(modalId, config);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
            modal.dataset.escHandler = escHandler;
        }

        // 添加背景点击关闭
        if (config.closeOnBackdropClick) {
            const backdropClickHandler = (e) => {
                if (e.target === modal || e.target.hasAttribute('data-modal-backdrop')) {
                    this.hide(modalId, config);
                }
            };
            modal.addEventListener('click', backdropClickHandler);
            modal.dataset.backdropHandler = backdropClickHandler;
        }

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

            // 延迟移除模态框
            setTimeout(() => {
                modal.classList.add('hidden');
                this.cleanup(modal);
            }, config.animationDuration);
        } else {
            modal.classList.add('hidden');
            this.cleanup(modal);
        }

        return true;
    }

    /**
     * 清理事件监听器
     */
    static cleanup(modal) {
        // 移除ESC监听器
        if (modal.dataset.escHandler) {
            document.removeEventListener('keydown', modal.dataset.escHandler);
            delete modal.dataset.escHandler;
        }

        // 移除背景点击监听器
        if (modal.dataset.backdropHandler) {
            modal.removeEventListener('click', modal.dataset.backdropHandler);
            delete modal.dataset.backdropHandler;
        }
    }
}

// ==================== 选项卡切换器 ====================

/**
 * 统一管理选项卡切换逻辑
 */
export class TabSwitcher {
    constructor(containerId, options = {}) {
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

        this.tabs = [];
        this.activeTab = null;
        this.initialize();
    }

    /**
     * 初始化选项卡
     */
    initialize() {
        // 收集所有选项卡按钮
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

            this.tabs.push(tab);

            // 设置初始状态
            if (tab.isActive) {
                this.activeTab = tab;
            }

            // 绑定点击事件
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTo(tabId);
            });
        });

        // 如果没有活跃选项卡，激活第一个
        if (!this.activeTab && this.tabs.length > 0) {
            this.switchTo(this.tabs[0].id);
        }
    }

    /**
     * 切换到指定选项卡
     */
    switchTo(tabId) {
        const newTab = this.tabs.find(t => t.id === tabId);
        if (!newTab || newTab === this.activeTab) return;

        // 切换前事件
        if (this.options.onBeforeSwitch) {
            const shouldSwitch = this.options.onBeforeSwitch(this.activeTab?.id, tabId);
            if (shouldSwitch === false) return;
        }

        // 更新旧选项卡
        if (this.activeTab) {
            this.activeTab.button.className = this.options.inactiveClass;
            this.activeTab.target.classList.add(this.options.pageInactiveClass);
            this.activeTab.target.classList.remove(this.options.pageActiveClass);
            if (this.options.animationClass) {
                this.activeTab.target.classList.remove(this.options.animationClass);
            }
        }

        // 更新新选项卡
        newTab.button.className = this.options.activeClass;
        newTab.target.classList.remove(this.options.pageInactiveClass);
        newTab.target.classList.add(this.options.pageActiveClass);
        if (this.options.animationClass) {
            newTab.target.classList.add(this.options.animationClass);
        }

        // 保存活跃状态
        this.activeTab = newTab;

        // 切换后事件
        if (this.options.onAfterSwitch) {
            this.options.onAfterSwitch(tabId);
        }
    }

    /**
     * 获取当前活跃选项卡
     */
    getActiveTab() {
        return this.activeTab;
    }

    /**
     * 添加新选项卡
     */
    addTab(tabId, buttonElement, targetElement) {
        const tab = {
            id: tabId,
            button: buttonElement,
            target: targetElement,
            isActive: false
        };

        this.tabs.push(tab);

        // 设置初始样式
        buttonElement.className = this.options.inactiveClass;
        targetElement.classList.add(this.options.pageInactiveClass);

        // 绑定事件
        buttonElement.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchTo(tabId);
        });

        return tab;
    }
}

// ==================== 芯片选择器 ====================

/**
 * 统一管理芯片选择器逻辑
 */
export class ChipSelector {
    constructor(containerSelector, options = {}) {
        this.chips = Array.from(document.querySelectorAll(containerSelector));
        if (this.chips.length === 0) {
            console.warn(`No chips found with selector: ${containerSelector}`);
        }

        this.options = {
            activeClass: 'bg-blue-500 text-white border-blue-500',
            inactiveClass: 'bg-white text-gray-600 border-gray-200',
            multiple: false,
            dataAttribute: 'data-value',
            ...options
        };

        this.selectedChips = new Set();
        this.initialize();
    }

    /**
     * 初始化芯片
     */
    initialize() {
        this.chips.forEach(chip => {
            // 检查初始选中状态
            if (chip.classList.contains(this.options.activeClass.split(' ')[0])) {
                const value = chip.getAttribute(this.options.dataAttribute) || chip.textContent;
                this.selectedChips.add(value);
            }

            // 绑定点击事件
            chip.addEventListener('click', (e) => {
                this.handleChipClick(chip, e);
            });
        });
    }

    /**
     * 处理芯片点击
     */
    handleChipClick(chip, event) {
        const value = chip.getAttribute(this.options.dataAttribute) || chip.textContent;
        
        if (this.options.multiple) {
            // 多选模式
            if (this.selectedChips.has(value)) {
                this.deselectChip(chip, value);
            } else {
                this.selectChip(chip, value);
            }
        } else {
            // 单选模式
            if (!this.selectedChips.has(value)) {
                // 取消选择其他芯片
                this.chips.forEach(c => {
                    const chipValue = c.getAttribute(this.options.dataAttribute) || c.textContent;
                    if (this.selectedChips.has(chipValue)) {
                        this.deselectChip(c, chipValue);
                    }
                });
                
                // 选择当前芯片
                this.selectChip(chip, value);
            }
            // 如果已经选中，在单选模式下不做任何事（保持选中）
        }

        // 触发回调
        if (this.options.onChange) {
            this.options.onChange(this.getSelectedValues(), this.selectedChips);
        }
    }

    /**
     * 选择芯片
     */
    selectChip(chip, value) {
        // 更新样式
        const inactiveClasses = this.options.inactiveClass.split(' ');
        const activeClasses = this.options.activeClass.split(' ');
        
        inactiveClasses.forEach(cls => chip.classList.remove(cls));
        activeClasses.forEach(cls => chip.classList.add(cls));
        
        // 更新选中状态
        this.selectedChips.add(value);
        
        // 触发选择回调
        if (this.options.onSelect) {
            this.options.onSelect(value, chip);
        }
    }

    /**
     * 取消选择芯片
     */
    deselectChip(chip, value) {
        // 更新样式
        const inactiveClasses = this.options.inactiveClass.split(' ');
        const activeClasses = this.options.activeClass.split(' ');
        
        activeClasses.forEach(cls => chip.classList.remove(cls));
        inactiveClasses.forEach(cls => chip.classList.add(cls));
        
        // 更新选中状态
        this.selectedChips.delete(value);
        
        // 触发取消选择回调
        if (this.options.onDeselect) {
            this.options.onDeselect(value, chip);
        }
    }

    /**
     * 获取选中的值
     */
    getSelectedValues() {
        return Array.from(this.selectedChips);
    }

    /**
     * 获取选中的第一个值
     */
    getSelectedValue() {
        return this.selectedChips.values().next().value || null;
    }

    /**
     * 设置选中的值
     */
    setSelectedValues(values) {
        // 清空当前选择
        this.chips.forEach(chip => {
            const chipValue = chip.getAttribute(this.options.dataAttribute) || chip.textContent;
            if (this.selectedChips.has(chipValue)) {
                this.deselectChip(chip, chipValue);
            }
        });

        // 设置新选择
        const valuesArray = Array.isArray(values) ? values : [values];
        valuesArray.forEach(value => {
            const chip = this.chips.find(c => {
                const chipValue = c.getAttribute(this.options.dataAttribute) || c.textContent;
                return chipValue === value;
            });
            
            if (chip) {
                this.selectChip(chip, value);
            }
        });
    }

    /**
     * 重置所有选择
     */
    reset() {
        this.chips.forEach(chip => {
            const value = chip.getAttribute(this.options.dataAttribute) || chip.textContent;
            if (this.selectedChips.has(value)) {
                this.deselectChip(chip, value);
            }
        });
        
        this.selectedChips.clear();
    }
}

// ==================== 工具函数 ====================

/**
 * DOM操作工具函数
 */
export const DOMUtils = {
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
    }
};

// ==================== 导出所有组件 ====================

export default {
    CalendarComponent,
    ModalManager,
    TabSwitcher,
    ChipSelector,
    DOMUtils
};