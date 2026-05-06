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
            ui.timer.innerText = formatDuration(remaining);
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

        // --- Data Sync & Conflict Resolution ---
        let pendingConflicts = [];
        let pendingNewData = [];

        function exportFastingData() {
            const log = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
            const exportObj = {
                signature: 'chume_fasting_export_v1',
                timestamp: Date.now(),
                fastingLog: log
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            const dateStr = typeof getCurrentDateString === 'function' ? getCurrentDateString().replace(/-/g, '') : new Date().toISOString().slice(0,10).replace(/-/g, '');
            dlAnchorElem.setAttribute("download", `ChuMe_Fasting_${dateStr}.json`);
            document.body.appendChild(dlAnchorElem);
            dlAnchorElem.click();
            dlAnchorElem.remove();
            if (typeof showToast === 'function') showToast('轻断食数据导出成功', 'success');
        }

        document.getElementById('import-fasting-file')?.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (!importedData.signature || !importedData.signature.includes('chume_fasting')) {
                        throw new Error("Invalid file format");
                    }
                    
                    const localLog = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
                    const localById = new Map();
                    localLog.forEach(r => localById.set(String(r.id), r));
                    
                    pendingConflicts = [];
                    pendingNewData = [];
                    
                    if (Array.isArray(importedData.fastingLog)) {
                        importedData.fastingLog.forEach(imp => {
                            const impId = String(imp.id);
                            if (!localById.has(impId)) {
                                pendingNewData.push(imp);
                            } else {
                                const loc = localById.get(impId);
                                if (loc.fastStart !== imp.fastStart || loc.fastEnd !== imp.fastEnd || loc.eatStart !== imp.eatStart || loc.eatEnd !== imp.eatEnd) {
                                    pendingConflicts.push({ id: impId, localRec: loc, importRec: imp });
                                }
                            }
                        });
                    }
                    
                    if (pendingConflicts.length > 0) {
                        showConflictModal();
                    } else {
                        if (pendingNewData.length > 0) {
                            const updatedLog = [...pendingNewData, ...localLog].sort((a,b) => b.id - a.id);
                            localStorage.setItem(HIST_KEY, JSON.stringify(updatedLog));
                            if (typeof showToast === 'function') showToast(`成功带入 ${pendingNewData.length}条纯新断食记录`, 'success');
                            renderHistory();
                        } else {
                            if (typeof showToast === 'function') showToast('没有发现新的记录', 'success');
                        }
                    }
                    
                } catch (err) {
                    console.error(err);
                    if (typeof showToast === 'function') showToast('文件格式不对', 'error');
                } finally {
                    document.getElementById('import-fasting-file').value = '';
                }
            };
            reader.onerror = function() {
                if (typeof showToast === 'function') showToast('读取文件失败', 'error');
                document.getElementById('import-fasting-file').value = '';
            };
            reader.readAsText(file);
        });

        function showConflictModal() {
            const modal = document.getElementById('conflict-modal');
            const card = document.getElementById('conflict-card');
            if (!modal) return;
            
            document.getElementById('conflict-count').innerText = pendingConflicts.length;
            const listEl = document.getElementById('conflict-list');
            
            const formatFull = (ts) => { if (!ts) return '-'; const d = new Date(ts); return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`; };
            const formatDate = (ts) => { if (!ts) return '-'; const d = new Date(ts); return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`; };

            let html = '';
            pendingConflicts.forEach((conf) => {
                const idx = pendingConflicts.indexOf(conf);
                const l = conf.localRec;
                const i = conf.importRec;
                
                let diffHtml = `
                    <div class="leading-tight flex flex-col gap-1 text-[11px]">
                        <div class="flex"><span class="inline-block w-11 shrink-0 text-gray-400">本地:</span> <span class="text-chume-brown">断食 ${formatFull(l.fastStart)}~${formatFull(l.fastEnd)} | 进食 ${formatFull(l.eatStart)}~${formatFull(l.eatEnd)}</span></div>
                        <div class="h-1.5 w-full border-t border-dashed border-black/5 my-0.5"></div>
                        <div class="flex"><span class="inline-block w-11 shrink-0 text-chume-orange/80">导入:</span> <span class="text-chume-brown font-bold">断食 ${formatFull(i.fastStart)}~${formatFull(i.fastEnd)} | 进食 ${formatFull(i.eatStart)}~${formatFull(i.eatEnd)}</span></div>
                    </div>
                `;

                html += `
                <div class="bg-gray-50 rounded-xl p-3 shadow-sm border border-black/5 mb-3 last:mb-0">
                    <div class="text-[13px] font-bold text-chume-brown flex items-center justify-between font-num mb-2 border-b border-chume-brown/10 pb-2">
                        <div class="flex items-center gap-1.5">
                            <span class="bg-chume-orange/10 text-chume-orange px-1.5 py-0.5 rounded text-[10px] leading-none">日期</span>
                            ${formatDate(l.fastStart)}
                        </div>
                        <div class="shrink-0 flex items-center bg-gray-200/80 rounded-full p-1 cursor-pointer w-[100px] h-[28px] relative transition-colors select-none" onclick="window.toggleConflict(${idx})">
                            <div id="slider-bg-${idx}" class="absolute left-1 top-1 w-[44px] h-[20px] bg-white rounded-full shadow-sm transition-transform duration-300"></div>
                            <div id="label-local-${idx}" class="relative z-10 w-1/2 text-center text-[11px] font-bold text-chume-brown transition-colors leading-[20px]">本地</div>
                            <div id="label-import-${idx}" class="relative z-10 w-1/2 text-center text-[11px] font-bold text-gray-400 transition-colors leading-[20px]">导入</div>
                            <input type="hidden" id="conflict-choice-${idx}" class="conflict-choice" value="local">
                        </div>
                    </div>
                    <div class="bg-white p-2 rounded-lg border border-black/5 flex flex-col">
                        ${diffHtml}
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
                pendingConflicts = []; 
            }, 300);

            pendingNewData = [];
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
            let resolvedCnt = 0;
            const localLog = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
            const localById = new Map();
            localLog.forEach(r => localById.set(String(r.id), r));
            
            document.querySelectorAll('.conflict-choice').forEach((input) => {
                const idx = parseInt(input.id.replace('conflict-choice-', ''));
                const conf = pendingConflicts[idx];
                if (input.value === 'import') {
                    localById.set(String(conf.importRec.id), conf.importRec);
                    resolvedCnt++;
                }
            });
            
            pendingNewData.forEach(r => {
                localById.set(String(r.id), r);
            });
            
            const updatedLog = Array.from(localById.values()).sort((a,b) => b.id - a.id);
            localStorage.setItem(HIST_KEY, JSON.stringify(updatedLog));
            
            const modal = document.getElementById('conflict-modal');
            const card = document.getElementById('conflict-card');
            if (modal) modal.classList.add('opacity-0');
            if (card) {
                card.classList.remove('translate-y-0', 'sm:scale-100');
                card.classList.add('translate-y-full', 'sm:scale-95');
            }
            setTimeout(() => {
                if(modal) modal.classList.add('hidden');
                pendingConflicts = [];
                pendingNewData = [];
            }, 300);
            
            if (typeof showToast === 'function') showToast(`成功导入 ${pendingNewData.length}条新记录并覆盖 ${resolvedCnt}条冲突`, 'success');
            renderHistory();
        }
