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

        // 记录导入时产生的冲突
        let pendingConflicts = [];
        let pendingNewData = { daily: [], weekly: [] };

        // Calendar State
        let calDate = new Date(); // Viewing date in calendar
        
        // 日历组件实例
        let bodyCalendar = null;

        // --- Core Funcs ---
        function autoResizeTextarea(el) {
            el.style.height = 'auto'; // Reset inner bound rendering scale mapping
            el.style.height = Math.min(el.scrollHeight, 250) + 'px'; // Stretch seamlessly down scaling max lock bounds at ~250px overlay safe gap offset
        }
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
                    if (!bodyCalendar) {
                        bodyCalendar = new ChuMeComponents.CalendarComponent({
                            containerId: 'cal-days',
                            titleId: 'cal-title',
                            dataSource: async (year, month) => {
                                const historyType = currentTab === 'weekly' ? 'weekly' : 'daily';
                                const history = getHistory(historyType);
                                const dailyData = {};
                                history.forEach(r => { dailyData[r.date] = true; });
                                return dailyData;
                            },
                            markLogic: (dateStr, data, { isSelected }) => {
                                if (!data[dateStr]) return null;
                                return {
                                    symbol: '✓',
                                    colorClass: isSelected ? 'text-white' : 'text-green-500',
                                    sizeStyle: 'text-[10px]'
                                };
                            },
                            onSelect: (dateStr) => {
                                bodyPickDate(dateStr);
                                closeCalendar();
                            },
                            selectedClass: 'bg-chume-orange text-white shadow-md hover:bg-chume-orange/80'
                        });
                    }
                    return true;
                }
            } catch (e) {
                console.error('初始化日历组件失败:', e);
            }
            return false;
        }

        function openCalendar() {
            // 尝试使用组件库
            const useComponent = initBodyCalendar();
            
            if (useComponent && bodyCalendar) {
                // 同步当前选中的日期
                const curStr = getBodyDateStr();
                const parts = curStr.split('-');
                calDate = new Date(parts[0], parts[1] - 1, parts[2]);

                // 使用组件库的模态框，传递字符串 ID 而不是 DOM 元素
                ChuMeComponents.ModalManager.show('calendar-modal');
                
                // 渲染日历
                bodyCalendar.render(calDate, curStr);
            } else {
                // 回退到原有逻辑
                openCalendarLegacy();
            }
        }

        function closeCalendar() {
            const useComponent = (typeof ChuMeComponents !== 'undefined' && ChuMeComponents.ModalManager);
            
            if (useComponent) {
                // 传递字符串 ID
                ChuMeComponents.ModalManager.hide('calendar-modal');
            } else {
                closeCalendarLegacy();
            }
        }

        function closeCalendarOnBg(e) {
            if (e.target.id === 'calendar-modal') closeCalendar();
        }

        function calChangeMonth(offset) {
            if (bodyCalendar) {
                if (offset > 0) bodyCalendar.nextMonth();
                else bodyCalendar.prevMonth();
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
            const wKg = parseFloat(document.getElementById('in-weight-weekly-kg')?.value);
            const waist = parseFloat(document.getElementById('in-waist')?.value);
            const hip = parseFloat(document.getElementById('in-hip')?.value);
            const fatKg = parseFloat(document.getElementById('in-fat')?.value);
            const heightEl = document.getElementById('in-height');
            let height = parseFloat(localStorage.getItem('chume_user_height')) || (heightEl ? parseFloat(heightEl.value) : null);

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
                                badge.innerHTML = '<span class="text-gray-400">-</span>';
                                badge.className = `ios-input-status neutral`;
                            } else {
                                let isGood;
                                if (key === 'ketone') {
                                    isGood = diff > 0 ? (cVal <= 3) : true;
                                } else {
                                    const isLowerGood = BODY_CFG.lowerGood.includes(key);
                                    isGood = (isLowerGood && diff < 0) || (!isLowerGood && diff > 0);
                                }
                                const icon = diff > 0 ? '↑' : '↓';

                                let diffText = Math.abs(diff).toFixed(1);
                                if (key === 'weight') {
                                    // Show in Jin
                                    diffText = (Math.abs(diff) * 2).toFixed(1) + '<span class="text-[0.6rem] ml-0.5">斤</span>';
                                }

                                badge.innerHTML = `<span>${diffText}${icon}</span>`;
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

                        const hColor = diffH > 0 ? 'text-[#FF3B30]' : (diffH < 0 ? 'text-[#34C759]' : 'text-gray-400');
                        const lColor = diffL > 0 ? 'text-[#FF3B30]' : (diffL < 0 ? 'text-[#34C759]' : 'text-gray-400');

                        // Use natural layout without flex-1 to cluster them together
                        const hHtml = `<span class="${hColor} whitespace-nowrap px-1">${diffH !== 0 ? Math.abs(diffH) + (diffH > 0 ? '↑' : '↓') : '-'}</span>`;
                        let lHtml = '';
                        if (record.data['bp-low'] && prevRecord.data['bp-low']) {
                            lHtml = `<span class="${lColor} whitespace-nowrap px-1">${diffL !== 0 ? Math.abs(diffL) + (diffL > 0 ? '↑' : '↓') : '-'}</span>`;
                        }

                        badge.innerHTML = `<div class="flex flex-row items-center justify-center font-normal leading-tight mx-auto">${hHtml}${lHtml}</div>`;
                        badge.className = `ios-input-status`;
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
                if (noteEl) {
                    noteEl.value = record.note || "";
                    if(typeof autoResizeTextarea === 'function') autoResizeTextarea(noteEl);
                }
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
                let html = `<div class="overflow-hidden rounded-xl bg-chume-card"><table class="w-full text-sm text-center"><thead class="text-xs text-chume-brown-light font-semibold border-b border-chume-brown/10 uppercase tracking-wider"><tr><th class="px-4 py-3 text-center">日期</th><th class="px-4 py-3 text-center">数值</th><th class="px-4 py-3 text-center w-28">变化</th></tr></thead><tbody class="divide-y divide-chume-brown/5">`;
                history.forEach((r, idx) => {
                    let diffHtml = '<span class="text-gray-400">-</span>';
                    const prevRecord = history[idx + 1];
                    let displayVal = r.data[sumMetric];
                    if (sumMetric === 'weight') {
                        displayVal = (displayVal * 2).toFixed(1) + '<span class="text-[0.65rem] ml-0.5 text-chume-brown-light font-title">斤</span>';
                    }

                    if (prevRecord && prevRecord.data[sumMetric] !== undefined) {
                        const diff = r.data[sumMetric] - prevRecord.data[sumMetric];
                        if (diff !== 0) {
                            let isGood;
                            if (sumMetric === 'ketone') {
                                isGood = diff > 0 ? (r.data[sumMetric] <= 3) : true;
                            } else {
                                const isLowerGood = BODY_CFG.lowerGood.includes(sumMetric);
                                isGood = (isLowerGood && diff < 0) || (!isLowerGood && diff > 0);
                            }
                            const colorClass = isGood ? 'text-[#34C759]' : 'text-[#FF3B30]';
                            const icon = diff > 0 ? '↑' : '↓';
                            let diffText = Math.abs(diff).toFixed(1);
                            if (sumMetric === 'weight') diffText = (Math.abs(diff) * 2).toFixed(1) + '<span class="text-[0.6rem] ml-0.5">斤</span>';
                            diffHtml = `<span class="${colorClass} font-medium">${diffText}${icon}</span>`;
                        }
                    }
                    html += `<tr class="hover:bg-chume-cream transition-colors"><td class="px-4 py-4 text-center font-medium text-chume-brown">${r.date}</td><td class="px-4 py-4 text-center font-medium text-chume-brown">${displayVal}</td><td class="px-4 py-4 text-center">${diffHtml}</td></tr>`;
                });
                html += "</tbody></table></div>";
                container.innerHTML = html;
            } else {
                const max = Math.max(...history.map(r => r.data[sumMetric])) || 100;
                let html = `<div class="bg-chume-card rounded-card p-4"><div class="flex items-end justify-center gap-3 h-[200px] border-b border-chume-brown/10 pb-2 pt-8 px-4">`;
                history.slice(0, 7).reverse().forEach(r => {
                    const val = r.data[sumMetric]; const h = (val / max) * 150;
                    let displayVal = sumMetric === 'weight' ? (val * 2).toFixed(1) : val;
                    html += `<div class="relative w-8 bg-chume-orange rounded-t-md transition-all group hover:bg-chume-orange/80 shadow-sm" style="height:${h}px"><span class="absolute -top-8 left-1/2 -translate-x-1/2 bg-chume-brown text-white px-2 py-1 rounded-[6px] text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-md">${displayVal}</span><span class="absolute bottom-[-24px] left-1/2 -translate-x-1/2 text-[9px] text-chume-brown-light font-medium whitespace-nowrap">${r.date.slice(5)}</span></div>`;
                });
                html += "</div><p class='text-center text-[10px] font-semibold text-chume-brown-light mt-8 tracking-widest uppercase'>最近7天趋势</p></div>";
                container.innerHTML = html;
            }
        }

        let profileGender = '';
        function checkProfileModal() {
            const h = localStorage.getItem('chume_user_height');
            const g = localStorage.getItem('chume_user_gender');
            if (!h || !g) {
                if (typeof ChuMeComponents !== 'undefined' && ChuMeComponents.ChipSelector) {
                    new ChuMeComponents.ChipSelector({
                        containerSelector: '#chip-gender',
                        chipSelector: 'button',
                        singleSelect: true,
                        selectedClass: 'bg-chume-brown text-white border-chume-brown',
                        deselectedClass: 'bg-white text-chume-brown border-chume-brown/10',
                        onSelect: (el, val) => profileGender = val
                    });
                }
                setTimeout(() => {
                    ChuMeComponents.ModalManager.show('profile-modal', {closeOnEsc: false, closeOnBackdropClick: false});
                }, 100);
            }
        }

        function saveInitialProfile() {
            const h = document.getElementById('profile-height').value;
            if (!h || parseFloat(h) < 50 || parseFloat(h) > 250) {
                if(typeof showToast === 'function') showToast("请填写正确的身高哦", "error");
                else alert("请填写正确的身高");
                return;
            }
            if (!profileGender) {
                if(typeof showToast === 'function') showToast("请选择性别", "error");
                else alert("请选择性别");
                return;
            }
            localStorage.setItem('chume_user_height', parseFloat(h));
            localStorage.setItem('chume_user_gender', profileGender);
            ChuMeComponents.ModalManager.hide('profile-modal');
            calcWeeklyStats();
        }

        // 初始化组件
        window.addEventListener('load', function() {
            if (typeof ChuMeComponents !== 'undefined' && ChuMeComponents.DOMUtils) {
                // 增强DOM操作
                ChuMeComponents.DOMUtils.enhanceDOM();
            }
            checkProfileModal();

            // Backup & Restore import listener
            const fileInput = document.getElementById('import-body-file');
            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        try {
                            const importedData = JSON.parse(event.target.result);
                            
                            if (importedData.app !== 'chume_bodydata') {
                                if (typeof showToast === 'function') showToast('文件格式不匹配', 'error');
                                fileInput.value = '';
                                return;
                            }
                            
                            const localDaily = JSON.parse(localStorage.getItem('chume_log_daily_v13') || "[]");
                            const localWeekly = JSON.parse(localStorage.getItem('chume_log_weekly_v13') || "[]");
                            
                            // Map existing items
                            const dailyMap = new Map(localDaily.map(r => [r.date, r]));
                            const weeklyMap = new Map(localWeekly.map(r => [r.date, r]));
                            
                            pendingConflicts = [];
                            pendingNewData = { daily: [], weekly: [] };
                            
                            function isEqualData(d1, d2) {
                                const k1 = Object.keys(d1 || {}); const k2 = Object.keys(d2 || {});
                                if (k1.length !== k2.length) return false;
                                for (let k of k1) { if (d1[k] !== d2[k]) return false; }
                                return true;
                            }

                            // 合并 Daily
                            if (Array.isArray(importedData.daily)) {
                                importedData.daily.forEach(r => {
                                    if (!dailyMap.has(r.date)) {
                                        pendingNewData.daily.push(r);
                                    } else {
                                        const locR = dailyMap.get(r.date);
                                        const locData = locR.data || {};
                                        const impData = r.data || {};
                                        const locNote = locR.note || '';
                                        const impNote = r.note || '';
                                        if (!isEqualData(locData, impData) || locNote !== impNote) {
                                            pendingConflicts.push({
                                                type: 'daily',
                                                date: r.date,
                                                localData: locData,
                                                importData: impData,
                                                localNote: locNote,
                                                importNote: impNote
                                            });
                                        }
                                    }
                                });
                            }
                            
                            // 合并 Weekly
                            if (Array.isArray(importedData.weekly)) {
                                importedData.weekly.forEach(r => {
                                    if (!weeklyMap.has(r.date)) {
                                        pendingNewData.weekly.push(r);
                                    } else {
                                        const locR = weeklyMap.get(r.date);
                                        const locData = locR.data || {};
                                        const impData = r.data || {};
                                        const locNote = locR.note || '';
                                        const impNote = r.note || '';
                                        if (!isEqualData(locData, impData) || locNote !== impNote) {
                                            pendingConflicts.push({
                                                type: 'weekly',
                                                date: r.date,
                                                localData: locData,
                                                importData: impData,
                                                localNote: locNote,
                                                importNote: impNote
                                            });
                                        }
                                    }
                                });
                            }
                            
                            if (pendingConflicts.length > 0) {
                                showConflictModal();
                            } else {
                                // 没有冲突直接执行原版纯增量逻辑
                                let changed = false;
                                if (pendingNewData.daily.length > 0) {
                                    localDaily.push(...pendingNewData.daily);
                                    localDaily.sort((a, b) => new Date(b.date) - new Date(a.date));
                                    localStorage.setItem('chume_log_daily_v13', JSON.stringify(localDaily));
                                    changed = true;
                                }
                                if (pendingNewData.weekly.length > 0) {
                                    localWeekly.push(...pendingNewData.weekly);
                                    localWeekly.sort((a, b) => new Date(b.date) - new Date(a.date));
                                    localStorage.setItem('chume_log_weekly_v13', JSON.stringify(localWeekly));
                                    changed = true;
                                }
                                
                                if (changed) {
                                    if (typeof showToast === 'function') showToast(`成功导入 ${pendingNewData.daily.length}条每日，${pendingNewData.weekly.length}条每周记录`, 'success');
                                    updateBodyUI();
                                } else {
                                    if (typeof showToast === 'function') showToast('没有任何新数据', 'info');
                                }
                            }
                            
                        } catch (err) {
                            console.error('Import parse error:', err);
                            if (typeof showToast === 'function') showToast('解析失败或格式错误', 'error');
                        }
                        fileInput.value = '';
                    };
                    
                    reader.onerror = function() {
                        if (typeof showToast === 'function') showToast('读取文件失败', 'error');
                        fileInput.value = '';
                    };
                    
                    reader.readAsText(file);
                });
            }
        });

        function showConflictModal() {
            const modal = document.getElementById('conflict-modal');
            const card = document.getElementById('conflict-card');
            if (!modal) return;
            
            document.getElementById('conflict-count').innerText = pendingConflicts.length;
            const listEl = document.getElementById('conflict-list');
            
            let html = '';
            pendingConflicts.forEach((conf, idx) => {
                const typeName = conf.type === 'daily' ? '每日' : '每周';
                
                let diffLocal = [];
                let diffImport = [];
                let bpProcessed = false;
                const allKeys = new Set([...Object.keys(conf.localData || {}), ...Object.keys(conf.importData || {})]);
                
                allKeys.forEach(k => {
                    if ((k === 'bp-high' || k === 'bp-low') && !bpProcessed) {
                        const lH = conf.localData['bp-high']; const lL = conf.localData['bp-low'];
                        const iH = conf.importData['bp-high']; const iL = conf.importData['bp-low'];
                        if (lH !== iH || lL !== iL) {
                            diffLocal.push(`血压:<span class="font-bold text-chume-orange">${lH || '-'}/${lL || '-'} mmHg</span>`);
                            diffImport.push(`血压:<span class="font-bold text-chume-orange">${iH || '-'}/${iL || '-'} mmHg</span>`);
                        }
                        bpProcessed = true;
                    } else if (k !== 'bp-high' && k !== 'bp-low') {
                        const lV = conf.localData[k];
                        const iV = conf.importData[k];
                        if (lV !== iV) {
                            const dict = {weight:'体重',glucose:'血糖',ketone:'血酮',ua:'尿酸',waist:'腰围',hip:'臀围',fat:'体脂',muscle:'肌肉'};
                            let label = dict[k] || k;
                            let unit = '';
                            if (k === 'weight' || k === 'muscle') unit = 'kg';
                            else if (k === 'glucose' || k === 'ketone') unit = 'mmol/L';
                            else if (k === 'ua') unit = 'umol/L';
                            else if (k === 'waist' || k === 'hip') unit = 'cm';
                            else if (k === 'fat') unit = '%';
                            
                            diffLocal.push(`${label}:<span class="font-bold text-chume-orange">${lV !== undefined ? lV + unit : '-'}</span>`);
                            diffImport.push(`${label}:<span class="font-bold text-chume-orange">${iV !== undefined ? iV + unit : '-'}</span>`);
                        }
                    }
                });

                if (conf.localNote !== conf.importNote) {
                    diffLocal.push(`备注:<span class="font-bold text-chume-orange">${conf.localNote || '无'}</span>`);
                    diffImport.push(`备注:<span class="font-bold text-chume-orange">${conf.importNote || '无'}</span>`);
                }

                let localVal = diffLocal.join(' <span class="text-chume-brown-light px-1 shrink-0">|</span> ') || '无差异';
                let importVal = diffImport.join(' <span class="text-chume-brown-light px-1 shrink-0">|</span> ') || '无差异';

                html += `
                <div class="bg-gray-50 rounded-xl p-3 flex justify-between items-center shadow-sm border border-black/5 gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="text-[13px] font-bold text-chume-brown flex items-center gap-1.5 font-num">
                            <span class="bg-chume-orange/10 text-chume-orange px-1.5 py-0.5 rounded text-[10px] leading-none">${typeName}</span>
                            ${conf.date}
                        </div>
                        <div class="text-[11px] text-chume-brown-light mt-1.5 flex flex-col gap-1.5 font-num break-all">
                            <div class="leading-tight flex"><span class="inline-block w-7 shrink-0 text-gray-400">本地:</span> <span class="text-chume-brown leading-[1.3]">${localVal}</span></div>
                            <div class="leading-tight flex"><span class="inline-block w-7 shrink-0 text-gray-400">导入:</span> <span class="text-chume-brown leading-[1.3]">${importVal}</span></div>
                        </div>
                    </div>
                    <div class="shrink-0 flex items-center bg-gray-200/80 rounded-full p-1 cursor-pointer w-[100px] h-[28px] relative transition-colors select-none" onclick="toggleConflict(${idx})">
                        <div id="slider-bg-${idx}" class="absolute left-1 top-1 w-[44px] h-[20px] bg-white rounded-full shadow-sm transition-transform duration-300"></div>
                        <div id="label-local-${idx}" class="relative z-10 w-1/2 text-center text-[11px] font-bold text-chume-brown transition-colors leading-[20px]">本地</div>
                        <div id="label-import-${idx}" class="relative z-10 w-1/2 text-center text-[11px] font-bold text-gray-400 transition-colors leading-[20px]">导入</div>
                        <input type="hidden" id="conflict-choice-${idx}" class="conflict-choice" value="local">
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
                pendingConflicts = []; // clear
            }, 300);

            pendingNewData = { daily: [], weekly: [] };
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
            const localDaily = JSON.parse(localStorage.getItem('chume_log_daily_v13') || "[]");
            const localWeekly = JSON.parse(localStorage.getItem('chume_log_weekly_v13') || "[]");
            
            let dailyResolved = 0;
            let weeklyResolved = 0;
            
            // Execute conflicts
            pendingConflicts.forEach((conf, idx) => {
                const select = document.getElementById(`conflict-choice-${idx}`);
                if (select && select.value === 'import') {
                    if (conf.type === 'daily') {
                        const targetIdx = localDaily.findIndex(r => r.date === conf.date);
                        if (targetIdx >= 0) {
                            localDaily[targetIdx].data = conf.importData;
                            if (conf.importNote) localDaily[targetIdx].note = conf.importNote;
                            dailyResolved++;
                        }
                    } else {
                        const targetIdx = localWeekly.findIndex(r => r.date === conf.date);
                        if (targetIdx >= 0) {
                            localWeekly[targetIdx].data = conf.importData;
                            if (conf.importNote) localWeekly[targetIdx].note = conf.importNote;
                            weeklyResolved++;
                        }
                    }
                }
            });
            
            // Execute pending new (pure inserts)
            if (pendingNewData.daily.length > 0) {
                localDaily.push(...pendingNewData.daily);
                dailyResolved += pendingNewData.daily.length;
            }
            if (pendingNewData.weekly.length > 0) {
                localWeekly.push(...pendingNewData.weekly);
                weeklyResolved += pendingNewData.weekly.length;
            }
            
            if (dailyResolved > 0) {
                localDaily.sort((a, b) => new Date(b.date) - new Date(a.date));
                localStorage.setItem('chume_log_daily_v13', JSON.stringify(localDaily));
            }
            if (weeklyResolved > 0) {
                localWeekly.sort((a, b) => new Date(b.date) - new Date(a.date));
                localStorage.setItem('chume_log_weekly_v13', JSON.stringify(localWeekly));
            }
            
            // Cleanup visually
            const modal = document.getElementById('conflict-modal');
            const card = document.getElementById('conflict-card');
            if (modal) {
                modal.classList.add('opacity-0');
                if (card) {
                    card.classList.remove('translate-y-0', 'sm:scale-100');
                    card.classList.add('translate-y-full', 'sm:scale-95');
                }
                setTimeout(() => {
                    modal.classList.add('hidden');
                    pendingConflicts = [];
                    pendingNewData = { daily: [], weekly: [] };
                    
                    if (typeof showToast === 'function') showToast('合并完成', 'success');
                    updateBodyUI();
                }, 300);
            }
        }

        // --- Backup & Restore (Import/Export) export handlers ---
        function exportBodyData() {
            try {
                const dailyData = JSON.parse(localStorage.getItem('chume_log_daily_v13') || "[]");
                const weeklyData = JSON.parse(localStorage.getItem('chume_log_weekly_v13') || "[]");
                
                const exportObj = {
                    app: 'chume_bodydata',
                    timestamp: Date.now(),
                    daily: dailyData,
                    weekly: weeklyData
                };
                
                const jsonString = JSON.stringify(exportObj);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const d = new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const fileName = `ChuMe_BodyData_${year}${month}${day}.json`;
                
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                
                if (typeof showToast === 'function') showToast('导出成功', 'success');
            } catch (err) {
                console.error('Export body data failed:', err);
                if (typeof showToast === 'function') showToast('导出失败', 'error');
            }
        }

        function triggerBodyImport() {
            const fileInput = document.getElementById('import-body-file');
            if (fileInput) {
                fileInput.value = ''; // 清空以保证再次选择同一文件可以触发 change
                fileInput.click();
            }
        }

        updateBodyUI();
