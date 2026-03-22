// --- Config & State ---
        const BODY_CFG = { lowerGood: ['weight', 'glucose', 'ketone', 'ua', 'bp-high', 'bp-low', 'fat', 'waist', 'hip'], higherGood: ['muscle'] };
        const SUMMARY_METRICS = {
            daily: [{ id: 'weight', name: '体重', unit: 'kg' }, { id: 'glucose', name: '血糖', unit: 'mmol/L' }, { id: 'ketone', name: '血酮', unit: 'mmol/L' }, { id: 'ua', name: '尿酸', unit: 'umol/L' }],
            weekly: [{ id: 'weight', name: '体重', unit: 'kg' }, { id: 'waist', name: '腰围', unit: 'cm' }, { id: 'fat', name: '体脂', unit: 'kg' }, { id: 'muscle', name: '肌肉', unit: 'kg' }]
        };

        let bodyViewOffset = 0;
        let currentTab = 'daily';
        let sumSource = 'daily';
        let sumMetric = 'weight';
        let sumView = 'table';

        // Calendar State
        let calDate = new Date(); // Viewing date in calendar
        
        // 日历组件实例
        let bodyCalendar = null;

        // --- Core Funcs ---
        function getBodyDateStr() {
            return getDateStr(bodyViewOffset);
        }

        function updateDateDisplay() {
            const ds = getBodyDateStr();
            document.getElementById('body-date-display').innerText = bodyViewOffset === 0 ? "今天" : ds;
        }

        function bodyChangeDate(o) {
            bodyViewOffset += o;
            if (bodyViewOffset > 0) bodyViewOffset = 0;
            updateBodyUI();
        }

        function bodyPickDate(dateStr) {
            if (!dateStr) return;
            const parts = dateStr.split('-');
            const p = new Date(parts[0], parts[1] - 1, parts[2]);
            const t = new Date(); t.setHours(0, 0, 0, 0);
            bodyViewOffset = Math.round((p - t) / 86400000);
            if (bodyViewOffset > 0) bodyViewOffset = 0;
            updateBodyUI();
        }

        // --- 使用组件库的日历逻辑 ---
        function initBodyCalendar() {
            try {
                // 检查组件库是否可用
                if (typeof ChuMeComponents !== 'undefined' && ChuMeComponents.CalendarComponent) {
                    bodyCalendar = new ChuMeComponents.CalendarComponent({
                        target: '#calendar-card',
                        onDateSelect: (dateStr) => {
                            bodyPickDate(dateStr);
                            closeCalendar();
                        },
                        getCurrentDate: () => {
                            const curStr = getBodyDateStr();
                            const parts = curStr.split('-');
                            return new Date(parts[0], parts[1] - 1, parts[2]);
                        },
                        getMarkedDates: () => {
                            const historyType = currentTab === 'weekly' ? 'weekly' : 'daily';
                            const history = getHistory(historyType);
                            return new Set(history.map(r => r.date));
                        },
                        i18n: {
                            monthYear: (y, m) => `${y}年 ${m + 1}月`,
                            today: '今天'
                        },
                        dateFormat: 'YYYY-MM-DD'
                    });
                    return true;
                }
            } catch (e) {
                console.error('初始化日历组件失败:', e);
            }
            return false;
        }

        function openCalendar() {
            const modal = document.getElementById('calendar-modal');
            const card = document.getElementById('calendar-card');

            // 尝试使用组件库
            const useComponent = initBodyCalendar();
            
            if (useComponent && bodyCalendar) {
                // 使用组件库的模态框
                ChuMeComponents.ModalManager.show(modal);
                
                // 渲染日历
                bodyCalendar.render();
            } else {
                // 回退到原有逻辑
                openCalendarLegacy();
            }
        }

        function closeCalendar() {
            const modal = document.getElementById('calendar-modal');
            const useComponent = (typeof ChuMeComponents !== 'undefined' && ChuMeComponents.ModalManager);
            
            if (useComponent) {
                ChuMeComponents.ModalManager.hide(modal);
            } else {
                closeCalendarLegacy();
            }
        }

        function closeCalendarOnBg(e) {
            if (e.target.id === 'calendar-modal') closeCalendar();
        }

        function calChangeMonth(offset) {
            if (bodyCalendar) {
                bodyCalendar.changeMonth(offset);
                bodyCalendar.render();
            } else {
                calChangeMonthLegacy(offset);
            }
        }

        // --- 兼容性回退函数 ---
        function openCalendarLegacy() {
            const modal = document.getElementById('calendar-modal');
            const card = document.getElementById('calendar-card');

            // Sync calendar logic date to current selected date
            const curStr = getBodyDateStr();
            const parts = curStr.split('-');
            calDate = new Date(parts[0], parts[1] - 1, parts[2]);

            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                card.classList.remove('scale-95');
                card.classList.add('scale-100');
            }, 10);

            renderCalendarLegacy();
        }

        function closeCalendarLegacy() {
            const modal = document.getElementById('calendar-modal');
            const card = document.getElementById('calendar-card');
            modal.classList.add('opacity-0');
            card.classList.remove('scale-100');
            card.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 200);
        }

        function calChangeMonthLegacy(offset) {
            calDate.setMonth(calDate.getMonth() + offset);
            renderCalendarLegacy();
        }

        function renderCalendarLegacy() {
            const y = calDate.getFullYear();
            const m = calDate.getMonth(); // 0-11
            const title = document.getElementById('cal-title');
            title.innerText = `${y}年 ${m + 1}月`;

            // Get data history to mark dates
            const historyType = currentTab === 'weekly' ? 'weekly' : 'daily';
            const history = getHistory(historyType);
            const recordedDates = new Set(history.map(r => r.date));

            const firstDay = new Date(y, m, 1).getDay(); // 0(Sun) - 6(Sat)
            const daysInMonth = new Date(y, m + 1, 0).getDate();

            const grid = document.getElementById('cal-days');
            grid.innerHTML = "";

            // Empty slots
            for (let i = 0; i < firstDay; i++) {
                grid.innerHTML += `<div></div>`;
            }

            // Days
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const selectedStr = getBodyDateStr(); // Currently selected date in UI

            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(y, m, d);
                const mm = (m + 1).toString().padStart(2, '0');
                const dd = d.toString().padStart(2, '0');
                const dStr = `${y}-${mm}-${dd}`;

                const isFuture = dateObj > today;
                const isSelected = dStr === selectedStr;
                const hasData = recordedDates.has(dStr);

                let bgClass = "hover:bg-gray-100 text-slate-700 cursor-pointer";
                if (isSelected) bgClass = "bg-chume-orange text-white shadow-md hover:bg-chume-orange/80";
                else if (isFuture) bgClass = "text-gray-300 pointer-events-none";

                // Mark Indicator (Checkmark)
                const mark = hasData ? `<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] ${isSelected ? 'text-white' : 'text-green-500'}">✓</div>` : '';

                grid.innerHTML += `
                <div onclick="(!${isFuture}) && selectCalDate('${dStr}')" class="relative w-8 h-9 mx-auto flex items-center justify-center rounded-lg text-sm font-medium transition-all ${bgClass}">
                    ${d}
                    ${mark}
                </div>
            `;
            }
        }

        function selectCalDate(str) {
            bodyPickDate(str);
            closeCalendar();
        }

        // --- Tab & UI Update ---
        function switchBodyTab(tab) {
            currentTab = tab;
            ['daily', 'weekly', 'summary'].forEach(t => {
                const btn = document.getElementById('tab-btn-' + t);
                const page = document.getElementById('page-' + t);
                if (t === tab) {
                    btn.className = "flex-1 rounded-[7px] bg-white text-black shadow-sm transition-all duration-300 cursor-default";
                    page.classList.remove('hidden');
                    page.classList.add('animate-fade-in');
                } else {
                    btn.className = "flex-1 rounded-[7px] text-gray-500 hover:text-gray-900 transition-all duration-300 cursor-pointer";
                    page.classList.add('hidden');
                    page.classList.remove('animate-fade-in');
                }
            });
            const navBar = document.getElementById('body-nav-bar');
            if (navBar) navBar.style.display = (tab === 'summary') ? 'none' : 'flex';

            if (tab === 'summary') initSummary(); else updateBodyUI();
        }

        function updateBodyUI() {
            updateDateDisplay();
            loadInputData(currentTab);
        }

        function syncWeight(source, type, unit) {
            const val = parseFloat(source.value);
            const kgIn = document.getElementById(`in-weight-${type}-kg`);
            const jinIn = document.getElementById(`in-weight-${type}-jin`);
            if (isNaN(val)) { if (source.value === "") { if (kgIn) kgIn.value = ""; if (jinIn) jinIn.value = ""; } return; }
            if (unit === 'kg') { if (jinIn) jinIn.value = (val * 2).toFixed(1); }
            else { if (kgIn) kgIn.value = (val / 2).toFixed(1); }
        }

        function calcWeeklyStats() {
            const wKg = parseFloat(document.getElementById('in-weight-weekly-kg').value);
            const waist = parseFloat(document.getElementById('in-waist').value);
            const hip = parseFloat(document.getElementById('in-hip').value);
            const fatKg = parseFloat(document.getElementById('in-fat').value);
            let height = parseFloat(localStorage.getItem('chume_user_height')) || parseFloat(document.getElementById('in-height').value);

            document.getElementById('calc-bmi').innerText = (wKg && height) ? (wKg / ((height / 100) ** 2)).toFixed(1) : "-";
            document.getElementById('calc-whr').innerText = (waist && hip) ? (waist / hip).toFixed(2) : "-";
            document.getElementById('calc-fatrate').innerText = (fatKg && wKg) ? ((fatKg / wKg) * 100).toFixed(1) + '%' : "-";
        }

        function getHistory(type) {
            return JSON.parse(localStorage.getItem(type === 'daily' ? 'chume_log_daily_v13' : 'chume_log_weekly_v13') || "[]");
        }

        // --- AUTO SAVE FUNCTION (Replaces saveRecord) ---
        function autoSave(type) {
            const dateStr = getBodyDateStr();
            const ids = type === 'daily' ? ['glucose', 'ketone', 'ua', 'bp-high', 'bp-low'] : ['waist', 'hip', 'fat', 'muscle', 'height'];
            let data = {};

            // Collect data
            let hasData = false;
            ids.forEach(id => {
                const el = document.getElementById('in-' + id);
                if (el && el.value !== "") {
                    data[id] = parseFloat(el.value);
                    hasData = true;
                }
            });
            const wEl = document.getElementById(type === 'daily' ? 'in-weight-daily-kg' : 'in-weight-weekly-kg');
            if (wEl && wEl.value !== "") {
                data.weight = parseFloat(wEl.value);
                hasData = true;
            }

            const noteEl = document.getElementById(`in-note-${type}`);
            const note = noteEl ? noteEl.value : "";
            if (note) hasData = true;

            let history = getHistory(type);
            const idx = history.findIndex(r => r.date === dateStr);

            if (!hasData) {
                // If all cleared, maybe delete key? For now, we update with empty data or keep it.
                // If user clears input, we should remove the data point.
                if (idx !== -1) {
                    // If it was just cleared, remove it so calendar unchecked?
                    // Or keep it as empty? Let's check if data object is empty.
                    if (Object.keys(data).length === 0 && !note) {
                        history.splice(idx, 1);
                    } else {
                        history[idx] = { date: dateStr, data, note };
                    }
                }
            } else {
                const entry = { date: dateStr, data, note };
                if (idx !== -1) history[idx] = entry; else history.unshift(entry);
                history.sort((a, b) => new Date(b.date) - new Date(a.date));
            }

            // Save
            localStorage.setItem(type === 'daily' ? 'chume_log_daily_v13' : 'chume_log_weekly_v13', JSON.stringify(history));

            if (type === 'weekly' && data.height) {
                localStorage.setItem('chume_user_height', data.height);
            }

            // Update UI (Diffs only)
            updateDiffBadges(type);
        }

        // --- Update Diffs Only (Doesn't reset inputs) ---
        function updateDiffBadges(type) {
            if (type === 'summary') return;
            const dateStr = getBodyDateStr();
            const history = getHistory(type);
            const record = history.find(r => r.date === dateStr);
            const prevRecord = history.find(r => new Date(r.date) < new Date(dateStr));

            // Reset badges first
            document.querySelectorAll(`#page-${type} .ios-input-status`).forEach(b => {
                b.innerHTML = '';
                b.className = 'ios-input-status';
            });

            if (record && prevRecord) {
                Object.keys(record.data).forEach(key => {
                    const cVal = record.data[key]; const pVal = prevRecord.data[key];
                    if (pVal !== undefined && pVal !== null && cVal !== undefined && cVal !== null) {
                        const diff = cVal - pVal;
                        // Show badge even if diff is 0

                        let badgeId = 'diff-' + key; if (key === 'weight') badgeId = `diff-weight-${type}`;
                        const badge = document.getElementById(badgeId);
                        if (badge) {
                            if (diff === 0) {
                                badge.innerHTML = '<span class="text-gray-400 font-bold">-</span>';
                                badge.className = `ios-input-status neutral`;
                            } else {
                                const isLowerGood = BODY_CFG.lowerGood.includes(key);
                                const isGood = (isLowerGood && diff < 0) || (!isLowerGood && diff > 0);
                                const icon = diff > 0 ? '<i class="fas fa-caret-up"></i>' : '<i class="fas fa-caret-down"></i>';

                                let diffText = Math.abs(diff).toFixed(1);
                                if (key === 'weight') {
                                    // Show in Jin
                                    diffText = (Math.abs(diff) * 2).toFixed(1) + ' <span class="text-[0.6rem]">斤</span>';
                                }

                                badge.innerHTML = `${icon}<span>${diffText}</span>`;
                                badge.className = `ios-input-status ${isGood ? 'good' : 'bad'}`;
                            }
                        }
                    }
                });
                // BP Logic (High & Low)
                if (type === 'daily' && record.data['bp-high'] && prevRecord.data['bp-high']) {
                    const diffH = record.data['bp-high'] - prevRecord.data['bp-high'];
                    let diffL = 0;
                    if (record.data['bp-low'] && prevRecord.data['bp-low']) {
                        diffL = record.data['bp-low'] - prevRecord.data['bp-low'];
                    }

                    const badge = document.getElementById('diff-bp');
                    if (badge) {

                        const hColor = diffH > 0 ? 'text-ios-red' : (diffH < 0 ? 'text-ios-green' : 'text-gray-400');
                        const lColor = diffL > 0 ? 'text-ios-red' : (diffL < 0 ? 'text-ios-green' : 'text-gray-400');

                        // Use flex-1 to center each part in the 88px space
                        const hHtml = `<span class="${hColor} flex-1 text-center">H${diffH !== 0 ? Math.abs(diffH) + (diffH > 0 ? '↑' : '↓') : '-'}</span>`;
                        let lHtml = '';
                        if (record.data['bp-low'] && prevRecord.data['bp-low']) {
                            lHtml = `<span class="${lColor} flex-1 text-center ml-1">L${diffL !== 0 ? Math.abs(diffL) + (diffL > 0 ? '↑' : '↓') : '-'}</span>`;
                        }

                        badge.innerHTML = `<div class="flex items-center justify-center w-full text-[10px] font-bold leading-none px-1">${hHtml}${lHtml}</div>`;
                        badge.className = `ios-input-status border-transparent bg-gray-50`;
                    }
                }
            }
        }

        function loadInputData(type) {
            if (type === 'summary') return;
            const dateStr = getBodyDateStr();
            const history = getHistory(type);
            const record = history.find(r => r.date === dateStr);

            // Clear all inputs first - this is only called when DATE changes or TAB changes
            document.querySelectorAll(`#page-${type} input`).forEach(i => i.value = '');
            document.querySelectorAll(`#page-${type} textarea`).forEach(t => t.value = '');

            if (record) {
                Object.keys(record.data).forEach(k => {
                    let el = document.getElementById('in-' + k);
                    if (el) el.value = record.data[k];
                    if (k === 'weight') {
                        const kgEl = document.getElementById(`in-weight-${type}-kg`);
                        if (kgEl) kgEl.value = record.data[k];
                        const jinEl = document.getElementById(`in-weight-${type}-jin`);
                        if (jinEl) jinEl.value = (record.data[k] * 2).toFixed(1);
                    }
                });
                const noteEl = document.getElementById(`in-note-${type}`);
                if (noteEl) noteEl.value = record.note || "";
                if (type === 'weekly') calcWeeklyStats();
            }

            // Update badges
            updateDiffBadges(type);
        }

        // Summary funcs ... (kept same)
        function initSummary() { setSummarySource('daily'); }
        function setSummarySource(src) {
            sumSource = src;
            const btnD = document.getElementById('btn-src-daily');
            const btnW = document.getElementById('btn-src-weekly');
            if (src === 'daily') {
                btnD.className = "flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-black transition-all";
                btnW.className = "flex-1 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-gray-600 transition-all";
            } else {
                btnW.className = "flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-black transition-all";
                btnD.className = "flex-1 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-gray-600 transition-all";
            }
            const metrics = SUMMARY_METRICS[src];
            let html = "";
            metrics.forEach((m, index) => {
                const activeClass = index === 0 ? 'bg-chume-orange text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100';
                html += `<div class="whitespace-nowrap px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-all ${activeClass}" onclick="setSummaryMetric('${m.id}', this)" data-id="${m.id}">${m.name}</div>`;
            });
            document.getElementById('metric-nav').innerHTML = html;
            if (metrics.length > 0) { sumMetric = metrics[0].id; renderSummary(); }
        }
        function setSummaryMetric(id, el) {
            sumMetric = id;
            document.querySelectorAll('#metric-nav div').forEach(c => c.className = "whitespace-nowrap px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-all bg-white text-gray-500 border border-gray-100");
            if (el) el.className = "whitespace-nowrap px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-all bg-chume-orange text-white shadow-md border-transparent";
            renderSummary();
        }
        function setSummaryView(v) { sumView = v; renderSummary(); }
        function renderSummary() {
            const history = getHistory(sumSource).filter(r => r.data[sumMetric]);
            const container = document.getElementById('summary-content');
            container.innerHTML = "";
            if (!history.length) { container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-gray-300"><i class="fas fa-folder-open text-4xl mb-3"></i><p class="text-sm font-medium">暂无数据</p></div>`; return; }
            if (sumView === 'table') {
                let html = `<div class="overflow-hidden rounded-xl bg-white"><table class="w-full text-sm text-left"><thead class="text-xs text-gray-400 font-semibold bg-gray-50 uppercase tracking-wider"><tr><th class="px-5 py-3">日期</th><th class="px-5 py-3 text-right">数值</th></tr></thead><tbody class="divide-y divide-gray-50">`;
                history.forEach(r => html += `<tr class="bg-white hover:bg-blue-50/30 transition-colors"><td class="px-5 py-4 font-medium text-gray-700">${r.date}</td><td class="px-5 py-4 text-right font-medium text-black">${r.data[sumMetric]}</td></tr>`);
                html += "</tbody></table></div>";
                container.innerHTML = html;
            } else {
                const max = Math.max(...history.map(r => r.data[sumMetric])) || 100;
                let html = `<div class="flex items-end justify-center gap-3 h-[200px] border-b border-gray-100 pb-2 pt-8 px-4">`;
                history.slice(0, 7).reverse().forEach(r => {
                    const val = r.data[sumMetric]; const h = (val / max) * 150;
                    html += `<div class="relative w-8 bg-chume-orange rounded-t-md transition-all group hover:bg-chume-orange/80 shadow-sm" style="height:${h}px"><span class="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded-[6px] text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">${val}</span><span class="absolute bottom-[-24px] left-1/2 -translate-x-1/2 text-[9px] text-gray-400 font-medium whitespace-nowrap">${r.date.slice(5)}</span></div>`;
                });
                html += "</div><p class='text-center text-[10px] font-semibold text-gray-300 mt-8 tracking-widest uppercase'>最近7天趋势</p>";
                container.innerHTML = html;
            }
        }

        // 初始化组件
        window.addEventListener('load', function() {
            if (typeof ChuMeComponents !== 'undefined' && ChuMeComponents.DOMUtils) {
                // 增强DOM操作
                ChuMeComponents.DOMUtils.enhanceDOM();
            }
        });

        updateBodyUI();