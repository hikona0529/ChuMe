const APP_KEY = 'chume_fasting_v2';
        const HIST_KEY = 'chume_fasting_log';
        let state = { status: 'IDLE', mode: '16+8', fastHours: 16, eatHours: 8, startTime: null, endTime: null, fastRealEndTime: null, fastStartTime: null, notified: false };
        let editingId = null;

        const ui = {
            status: document.getElementById('status-badge'),
            timer: document.getElementById('timer-display'),
            percent: document.getElementById('timer-percent'),
            startText: document.getElementById('start-time-text'),
            endText: document.getElementById('end-time-text'),
            endLabel: document.getElementById('label-end-time'),
            btn: document.getElementById('main-btn'),
            circle: document.getElementById('progress-circle'),
            modeBtns: { '16+8': document.getElementById('btn-mode-16'), '18+6': document.getElementById('btn-mode-18'), '20+4': document.getElementById('btn-mode-20'), 'custom': document.getElementById('btn-mode-custom') },
            modePanel: document.getElementById('mode-panel'),
            customConfig: document.getElementById('custom-config'),
            startTimeInput: document.getElementById('in-start-time'),
            resetBtn: document.getElementById('reset-btn'),
            inFastH: document.getElementById('in-fast-h'),
            inEatH: document.getElementById('in-eat-h'),
            historyList: document.getElementById('history-list'),
            editModal: document.getElementById('edit-modal'),
            editInputs: { fs: document.getElementById('edit-fs'), fe: document.getElementById('edit-fe'), es: document.getElementById('edit-es'), ee: document.getElementById('edit-ee') }
        };
        const CIRCLE_CIRCUMFERENCE = 339.292;

        function init() {
            const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            ui.startTimeInput.value = now.toISOString().slice(0, 16);
            loadState(); requestNotifPermission(); renderUI(); renderHistory();
            setInterval(tick, 1000);
        }

        function loadState() { const s = localStorage.getItem(APP_KEY); if (s) state = JSON.parse(s); }
        function saveState() { localStorage.setItem(APP_KEY, JSON.stringify(state)); }

        function setMode(m) {
            if (state.status !== 'IDLE') return;
            state.mode = m;
            if (m === 'custom') ui.customConfig.classList.remove('hidden'); else { ui.customConfig.classList.add('hidden'); const [f, e] = m.split('+').map(Number); state.fastHours = f; state.eatHours = e; }
            updateEstimates(); renderUI();
        }

        function updateEstimates() {
            if (state.status !== 'IDLE') return;
            if (state.mode === 'custom') { state.fastHours = parseFloat(ui.inFastH.value) || 16; state.eatHours = parseFloat(ui.inEatH.value) || 8; }
            const stVal = ui.startTimeInput.value;
            const st = stVal ? new Date(stVal).getTime() : Date.now();
            const et = st + (state.fastHours * 3600 * 1000);
            ui.startText.innerText = formatTimeStr(st); ui.endText.innerText = formatTimeStr(et); ui.endLabel.innerText = "预计进食"; ui.timer.innerText = state.fastHours + "小时"; ui.percent.innerText = "断食目标";
        }

        function handleMainBtn() {
            if (state.status === 'IDLE') startFasting();
            else if (state.status === 'FASTING') { if (confirm("结束断食吗？(将记录为未完成)")) { logHistory(state.startTime, Date.now(), null, null); enterIdle(); } }
            else if (state.status === 'WAITING') startEating();
            else if (state.status === 'EATING') { if (confirm("结束进食吗?")) { logHistory(state.startTime, state.fastRealEndTime, Date.now(), state.eatHours); enterIdle(); } }
        }

        function startFasting() {
            if (state.mode === 'custom') { state.fastHours = parseFloat(ui.inFastH.value) || 16; state.eatHours = parseFloat(ui.inEatH.value) || 8; }
            const stVal = ui.startTimeInput.value;
            state.startTime = stVal ? new Date(stVal).getTime() : Date.now();
            state.fastStartTime = state.startTime;
            state.endTime = state.startTime + (state.fastHours * 3600 * 1000);
            state.status = 'FASTING'; state.notified = false; state.fastRealEndTime = null;
            const now = Date.now();
            if (now >= state.endTime) { state.status = 'WAITING'; state.fastRealEndTime = state.endTime; }
            saveState(); renderUI(); tick();
        }

        function startEating() {
            state.status = 'EATING';
            if (!state.fastRealEndTime) state.fastRealEndTime = Date.now();
            state.startTime = Date.now(); // Phase Start
            state.endTime = state.startTime + (state.eatHours * 3600 * 1000);
            state.notified = false;
            saveState(); renderUI(); tick();
        }

        function enterIdle() {
            state.status = 'IDLE'; state.startTime = null; state.endTime = null; state.fastRealEndTime = null; state.fastStartTime = null; state.notified = false;
            saveState(); const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); ui.startTimeInput.value = now.toISOString().slice(0, 16);
            renderUI(); setMode(state.mode);
        }

        function logHistory(fastStart, fastEnd, eatEnd, eatTargetH) {
            const start = state.fastStartTime || fastStart;
            if (!start) return;
            const log = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
            log.unshift({
                id: Date.now(),
                date: new Date(start).toISOString(),
                fastStart: start,
                fastEnd: fastEnd,
                eatStart: fastEnd,
                eatEnd: eatEnd,
                fastDur: (fastEnd - start) || 0,
                eatDur: eatEnd ? (eatEnd - fastEnd) : 0
            });
            localStorage.setItem(HIST_KEY, JSON.stringify(log));
            renderHistory();
        }

        function deleteHistory(id) {
            if (confirm("删除记录?")) {
                let log = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
                log = log.filter(i => i.id !== id);
                localStorage.setItem(HIST_KEY, JSON.stringify(log));
                renderHistory();
            }
        }

        function editHistory(id) {
            const log = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
            const item = log.find(i => i.id === id);
            if (!item) return;

            editingId = id;
            ui.editInputs.fs.value = toInputFormat(item.fastStart);
            ui.editInputs.fe.value = toInputFormat(item.fastEnd);
            ui.editInputs.es.value = toInputFormat(item.eatStart);
            ui.editInputs.ee.value = toInputFormat(item.eatEnd);

            ui.editModal.classList.remove('hidden');
        }

        function saveEdit() {
            if (!editingId) return;
            const log = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
            const idx = log.findIndex(i => i.id === editingId);
            if (idx === -1) return;

            const parseTs = (val) => val ? new Date(val).getTime() : null;
            const fs = parseTs(ui.editInputs.fs.value);
            const fe = parseTs(ui.editInputs.fe.value);
            const es = parseTs(ui.editInputs.es.value);
            const ee = parseTs(ui.editInputs.ee.value);

            if (!fs) { alert("开始时间不能为空"); return; }

            log[idx].fastStart = fs;
            log[idx].fastEnd = fe;
            log[idx].eatStart = es;
            log[idx].eatEnd = ee;

            log[idx].fastDur = (fe && fs) ? (fe - fs) : 0;
            log[idx].eatDur = (ee && es) ? (ee - es) : 0;

            localStorage.setItem(HIST_KEY, JSON.stringify(log));
            renderHistory();
            closeEditModal();
        }

        function closeEditModal() {
            ui.editModal.classList.add('hidden');
            editingId = null;
        }

        function toInputFormat(ts) {
            if (!ts) return "";
            const d = new Date(ts);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().slice(0, 16);
        }

        function renderHistory() {
            const log = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
            if (log.length === 0) { ui.historyList.innerHTML = '<div class="text-center text-gray-300 text-xs py-4">暂无记录</div>'; return; }
            let html = "";
            log.forEach(item => {
                const dateObj = new Date(item.fastStart);
                const dateStr = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;

                const formatFull = (ts) => { if (!ts) return '-'; const d = new Date(ts); return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`; };
                const fs = formatFull(item.fastStart); const fe = formatFull(item.fastEnd);
                const fastH = (item.fastDur / (1000 * 3600)).toFixed(1);

                let eatHtml = `<div class="flex items-center justify-between text-xs mt-1 text-gray-400 bg-gray-50 px-2 py-1 rounded"><span><i class="fas fa-utensils w-4"></i> 未记录进食</span></div>`;
                if (item.eatEnd) {
                    const es = formatFull(item.eatStart); const ee = formatFull(item.eatEnd);
                    const eatH = (item.eatDur / (1000 * 3600)).toFixed(1);
                    eatHtml = `<div class="flex items-center justify-between text-xs mt-1 text-orange-600 bg-orange-50 px-2 py-1 rounded"><span><i class="fas fa-utensils w-4"></i> ${es} - ${ee}</span><span class="font-bold">${eatH}h</span></div>`;
                }

                html += `
                    <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative group">
                        <button onclick="editHistory(${item.id})" class="absolute top-2 right-8 text-gray-300 hover:text-blue-500 p-2 transition-colors"><i class="fas fa-pen"></i></button>
                        <button onclick="deleteHistory(${item.id})" class="absolute top-2 right-1 text-gray-300 hover:text-red-400 p-2 transition-colors"><i class="fas fa-trash-alt"></i></button>
                        
                        <div class="text-xs font-bold text-gray-400 mb-2 pl-1">${dateStr}</div>
                        
                        <div class="flex items-center justify-between text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                            <span><i class="fas fa-leaf w-4"></i> ${fs} - ${fe}</span>
                            <span class="font-bold">${fastH}h</span>
                        </div>
                        ${eatHtml}
                    </div>
                `;
            });
            ui.historyList.innerHTML = html;
        }

        function tick() {
            if (state.status === 'IDLE') return;
            const now = Date.now();
            let totalDuration = 0; let elapsed = 0; let remaining = 0;
            if (state.status === 'FASTING') {
                totalDuration = state.fastHours * 3600 * 1000; elapsed = now - state.startTime; remaining = state.endTime - now;
                if (remaining <= 0) { state.status = 'WAITING'; state.fastRealEndTime = now; sendNotification("断食完成！", "点击进入进食窗口。"); saveState(); renderUI(); return; }
            } else if (state.status === 'EATING') {
                totalDuration = state.eatHours * 3600 * 1000; elapsed = now - state.startTime; remaining = state.endTime - now;
                if (remaining <= 0) { sendNotification("进食窗口结束", "请停止进食。"); logHistory(state.startTime, state.fastRealEndTime, now, state.eatHours); enterIdle(); return; }
            }
            ui.timer.innerText = formatTime(remaining);
            const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
            ui.percent.innerText = percent.toFixed(1) + '%';
            ui.circle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE - (percent / 100) * CIRCLE_CIRCUMFERENCE;
        }

        function renderUI() {
            const s = state.status;
            Object.values(ui.modeBtns).forEach(b => b.className = "flex-1 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm text-gray-500 font-bold text-sm btn-ios hover:bg-gray-50 transition-colors");
            if (ui.modeBtns[state.mode]) ui.modeBtns[state.mode].className += " border-blue-500 text-blue-500 bg-blue-50";

            if (s === 'IDLE') {
                ui.modePanel.classList.remove('hidden'); ui.status.innerText = "准备就绪"; ui.status.className = "px-4 py-1.5 rounded-full bg-gray-100 text-gray-500 font-bold text-sm tracking-wide";
                ui.circle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE; ui.circle.className = "progress-ring__circle text-blue-500";
                ui.btn.innerHTML = '<i class="fas fa-play"></i><span>开始断食</span>'; ui.btn.className = "w-full h-14 rounded-full bg-gradient-fasting text-white font-bold text-lg shadow-lg shadow-indigo-200 btn-ios flex items-center justify-center gap-2 flex-shrink-0";
                ui.resetBtn.classList.add('hidden');
            } else {
                ui.modePanel.classList.add('hidden'); ui.resetBtn.classList.remove('hidden');
                ui.startText.innerText = formatTimeStr(state.startTime); ui.endText.innerText = formatTimeStr(state.endTime);
                if (s === 'FASTING') {
                    ui.status.innerText = "🍃 正在断食"; ui.status.className = "px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm tracking-wide"; ui.endLabel.innerText = "预计进食";
                    ui.btn.innerHTML = '<i class="fas fa-stop"></i><span>放弃断食</span>'; ui.btn.className = "w-full h-14 rounded-full bg-gray-200 text-gray-500 font-bold text-lg btn-ios flex items-center justify-center gap-2 flex-shrink-0"; ui.circle.className = "progress-ring__circle text-indigo-500";
                } else if (s === 'WAITING') {
                    ui.status.innerText = "🎉 断食达标"; ui.status.className = "px-4 py-1.5 rounded-full bg-green-100 text-green-600 font-bold text-sm tracking-wide"; ui.endLabel.innerText = "预计进食";
                    ui.timer.innerText = "完成!"; ui.percent.innerText = "100%"; ui.circle.style.strokeDashoffset = 0; ui.circle.className = "progress-ring__circle text-green-500";
                    ui.btn.innerHTML = '<i class="fas fa-utensils"></i><span>进入进食窗口</span>'; ui.btn.className = "w-full h-14 rounded-full bg-gradient-eating text-white font-bold text-lg shadow-lg shadow-orange-200 btn-ios flex items-center justify-center gap-2 animate-pulse flex-shrink-0";
                } else if (s === 'EATING') {
                    ui.status.innerText = "🥪 进食窗口"; ui.status.className = "px-4 py-1.5 rounded-full bg-orange-100 text-orange-600 font-bold text-sm tracking-wide"; ui.endLabel.innerText = "进食结束";
                    ui.btn.innerHTML = '<i class="fas fa-check"></i><span>结束进食</span>'; ui.btn.className = "w-full h-14 rounded-full bg-orange-500 text-white font-bold text-lg shadow-lg shadow-orange-200 btn-ios flex items-center justify-center gap-2 flex-shrink-0"; ui.circle.className = "progress-ring__circle text-orange-400";
                }
            }
        }
        function formatTimeStr(ts) { if (!ts) return "--:--"; return formatTime(ts); }
        function requestNotifPermission() { if (!("Notification" in window)) return; Notification.requestPermission(); }
        function sendNotification(title, body) { if (!("Notification" in window)) return; if (Notification.permission === "granted") { new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/2921/2921822.png' }); } }
        init();
