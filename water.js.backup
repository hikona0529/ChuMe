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

        // --- Core Logic ---

        // Init Inputs (Run ONCE on load)
        function initInputs() {
            const rawT = getPref('goal_total');
            const rawE = getPref('goal_elec');
            const rawV = getPref('default_vol');

            if (rawT !== null && rawT !== "") document.getElementById('set-goal-total').value = rawT;
            else document.getElementById('set-goal-total').value = "";

            if (rawE !== null && rawE !== "") document.getElementById('set-goal-elec').value = rawE;
            else document.getElementById('set-goal-elec').value = "";

            if (rawV !== null && rawV !== "") document.getElementById('set-default-vol').value = rawV;
            else document.getElementById('set-default-vol').value = "250";

            updateSettingsHint();
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
            const t = document.getElementById('set-goal-total').value;
            const e = document.getElementById('set-goal-elec').value;
            const v = document.getElementById('set-default-vol').value;

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
            const t = document.getElementById('set-goal-total').value;
            const e = document.getElementById('set-goal-elec').value;
            const v = document.getElementById('set-default-vol').value;
            const hint = document.getElementById('settings-hint');
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
                             <button onclick="editWater(${i.id})" class="text-xs text-blue-400 px-2 py-1 bg-blue-50 rounded">改</button>
                             <button onclick="delWater(${i.id})" class="text-xs text-red-400 px-2 py-1 bg-red-50 rounded">删</button>
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

        // --- Custom Calendar Logic ---
        function openCalendar() {
            const modal = document.getElementById('calendar-modal');
            const card = document.getElementById('calendar-card');

            // Sync calendar logic date to current selected date
            const curStr = getWaterDateStr();
            const parts = curStr.split('-');
            calDate = new Date(parts[0], parts[1] - 1, parts[2]);

            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                card.classList.remove('scale-95');
                card.classList.add('scale-100');
            }, 10);
            renderCalendar();
        }

        function closeCalendar() {
            const modal = document.getElementById('calendar-modal');
            const card = document.getElementById('calendar-card');
            modal.classList.add('opacity-0');
            card.classList.remove('scale-100');
            card.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 200);
        }

        function closeCalendarOnBg(e) {
            if (e.target.id === 'calendar-modal') closeCalendar();
        }

        function calChangeMonth(offset) {
            calDate.setMonth(calDate.getMonth() + offset);
            renderCalendar();
        }

        function renderCalendar() {
            const y = calDate.getFullYear();
            const m = calDate.getMonth(); // 0-11
            const title = document.getElementById('cal-title');
            title.innerText = `${y}年 ${m + 1}月`;

            // Data Logic
            const dailyTotals = {};
            getAllData('water').then(history => {
                history.forEach(r => {
                    dailyTotals[r.date] = (dailyTotals[r.date] || 0) + r.amount;
                });

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

                // Mark Logic: Green Check for met goal, Red Cross for missed goal
                const total = dailyTotals[dStr] || 0;
                let mark = '';
                if (total > 0) {
                    const isMet = GOAL_TOTAL > 0 && total >= GOAL_TOTAL;
                    const symbol = isMet ? '✓' : '×';
                    const color = isSelected ? 'text-white' : (isMet ? 'text-green-500' : 'text-red-500');
                    // Scale up the cross slightly
                    const sizeStyle = (!isMet) ? 'text-sm -mb-[2px]' : 'text-[10px]';

                    mark = `<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 leading-none ${sizeStyle} ${color}">${symbol}</div>`;
                }

                grid.innerHTML += `
                <div onclick="(!${isFuture}) && selectCalDate('${dStr}')" class="relative w-8 h-9 mx-auto flex items-center justify-center rounded-lg text-sm font-medium transition-all ${bgClass}">
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

        function selectCalDate(str) {
            waterPickDate(str);
            closeCalendar();
        }

        // Init
        window.onload = function () {
            initInputs();
            renderWaterApp();
        }
