// ai-counter.js
// 拍图数药 —— 沉浸全屏打点重构版

// ========== 状态变量 ==========

/** 当前轮次的标记点数组，每个元素 { x, y }（相对于图片实际像素坐标） */
var currentPoints = [];

/** 之前所有轮次的累计数量 */
var totalCount = 0;

/** 每轮的计数记录（用于保存历史） */
var roundRecords = [];

/** 工作图对象（Image/Canvas，作为多次重绘和坐标判定基准） */
var originalImage = null;

/** 拍图数药记录存储 Key */
var COUNTER_HISTORY_KEY = 'ai_counter_history';


// ========== DOM 引用 ==========

function getDOM() {
    return {
        // 主页面
        btnBack: document.getElementById('btn-counter-back'),
        backLabel: document.getElementById('counter-back-label'),
        fileInput: document.getElementById('ai-count-file'),
        uploadArea: document.getElementById('btn-upload').parentElement,
        btnUpload: document.getElementById('btn-upload'),
        previewContainer: document.getElementById('preview-container'),
        previewCanvas: document.getElementById('preview-canvas'),
        historyCard: document.getElementById('history-card'),
        historyList: document.getElementById('history-list'),
        bottomConsole: document.getElementById('bottom-console'),
        roundCount: document.getElementById('round-count'),
        totalCount: document.getElementById('total-count'),
        btnNextRound: document.getElementById('btn-next-round'),
        btnDone: document.getElementById('btn-done'),
        
        // 全屏沉浸 UI
        fullscreenModal: document.getElementById('fullscreen-mark-modal'),
        fullscreenCanvas: document.getElementById('fullscreen-canvas'),
        fullscreenCount: document.getElementById('fullscreen-count'),
        btnFinishMark: document.getElementById('btn-finish-mark')
    };
}

function initCounterBackLink() {
    var d = getDOM();
    if (!d.btnBack) return;

    var urlParams = new URLSearchParams(window.location.search);
    var source = urlParams.get('source');
    var backHref = source === 'medicine' ? 'medicine.html' : 'index.html';
    var backText = source === 'medicine' ? '返回药箱' : '返回桌面';
    d.btnBack.setAttribute('href', backHref);
    if (d.backLabel) {
        d.backLabel.textContent = backText;
    }
}


// ========== 拍图数药历史记录 ==========

function getCounterHistory() {
    try {
        var raw = localStorage.getItem('chume_' + COUNTER_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveCounterHistory(records) {
    try {
        localStorage.setItem('chume_' + COUNTER_HISTORY_KEY, JSON.stringify(records));
    } catch (e) {
        console.error('保存拍图数药记录失败:', e);
    }
}

function addCounterRecord(rounds, finalCount) {
    var records = getCounterHistory();
    var now = new Date();
    var dateStr = now.getFullYear() + '/' +
        String(now.getMonth() + 1).padStart(2, '0') + '/' +
        String(now.getDate()).padStart(2, '0');
    var timeStr = String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');

    records.unshift({
        id: String(Date.now()),
        date: dateStr,
        time: timeStr,
        rounds: rounds,
        totalRounds: rounds.length,
        finalCount: finalCount
    });

    if (records.length > 50) records = records.slice(0, 50);
    saveCounterHistory(records);
}

function deleteCounterRecord(id) {
    var records = getCounterHistory();
    records = records.filter(function(r) { return r.id !== id; });
    saveCounterHistory(records);
    renderHistory();
    showToast('记录已删除', 'success');
}

function normalizeCounterRecord(record) {
    var safeRecord = record && typeof record === 'object' ? record : {};
    var rounds = Array.isArray(safeRecord.rounds) ? safeRecord.rounds : [];
    var safeRounds = rounds
        .map(function(round) {
            var num = Number(round);
            return isFinite(num) && num >= 0 ? String(num) : null;
        })
        .filter(function(round) {
            return round !== null;
        });
    var finalCount = Number(safeRecord.finalCount);

    if (!isFinite(finalCount) || finalCount < 0) {
        finalCount = safeRounds.reduce(function(sum, round) {
            return sum + Number(round);
        }, 0);
    }

    return {
        id: safeRecord.id ? String(safeRecord.id) : '',
        date: safeRecord.date ? String(safeRecord.date) : '--/--/--',
        time: safeRecord.time ? String(safeRecord.time) : '',
        rounds: safeRounds,
        totalRounds: safeRounds.length,
        finalCount: finalCount
    };
}

function createHistoryRow(record, isLast) {
    var safeRecord = normalizeCounterRecord(record);
    var row = document.createElement('div');
    row.className = 'flex items-center px-4 py-3' + (isLast ? '' : ' border-b border-chume-brown/10');

    var infoWrap = document.createElement('div');
    infoWrap.className = 'flex-1 min-w-0 mr-3';

    var titleLine = document.createElement('div');
    titleLine.className = 'flex items-center gap-2';

    var dateSpan = document.createElement('span');
    dateSpan.className = 'text-sm font-semibold text-chume-brown font-num';
    dateSpan.textContent = safeRecord.date;

    var timeSpan = document.createElement('span');
    timeSpan.className = 'text-xs text-chume-brown-light font-num';
    timeSpan.textContent = safeRecord.time;

    titleLine.appendChild(dateSpan);
    titleLine.appendChild(timeSpan);

    var roundsLine = document.createElement('div');
    roundsLine.className = 'text-xs text-chume-brown-light mt-1';
    roundsLine.textContent = '共 ' + safeRecord.totalRounds + ' 轮（' +
        (safeRecord.rounds.length > 0 ? safeRecord.rounds.join(' + ') : '--') + '）';

    var resultLine = document.createElement('div');
    resultLine.className = 'text-xs mt-0.5';
    resultLine.textContent = '结果：';

    var resultSpan = document.createElement('span');
    resultSpan.className = 'font-num font-bold text-chume-orange';
    resultSpan.textContent = String(safeRecord.finalCount);
    resultLine.appendChild(resultSpan);

    infoWrap.appendChild(titleLine);
    infoWrap.appendChild(roundsLine);
    infoWrap.appendChild(resultLine);

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'text-chume-pink text-xs px-2 py-1 min-h-[44px] active:opacity-50 shrink-0';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = '删除记录';
    deleteBtn.setAttribute('data-delete-id', safeRecord.id);
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
            if (confirm('确认删除这条拍图数药记录？')) {
            deleteCounterRecord(safeRecord.id);
        }
    });

    row.appendChild(infoWrap);
    row.appendChild(deleteBtn);

    return row;
}

function renderHistory() {
    var d = getDOM();
    if (!d.historyList) return;

    var records = getCounterHistory();
    d.historyList.innerHTML = '';

    if (records.length === 0) {
        var emptyState = document.createElement('div');
        emptyState.className = 'px-4 py-5 text-center text-xs text-chume-brown-light';
        emptyState.textContent = '还没有拍图数药记录';
        d.historyList.appendChild(emptyState);
        return;
    }

    records.forEach(function(record, index) {
        d.historyList.appendChild(createHistoryRow(record, index === records.length - 1));
    });
}


// ========== 核心业务：图片加载、绘制与交互 ==========

function getWorkingImageSpec(width, height, maxLongSide) {
    var longSideLimit = maxLongSide || 1024;
    var shouldRotate = width > height;
    var rotatedWidth = shouldRotate ? height : width;
    var rotatedHeight = shouldRotate ? width : height;
    var longSide = Math.max(rotatedWidth, rotatedHeight);
    var scale = longSide > longSideLimit ? (longSideLimit / longSide) : 1;

    return {
        shouldRotate: shouldRotate,
        canvasWidth: Math.max(1, Math.round(rotatedWidth * scale)),
        canvasHeight: Math.max(1, Math.round(rotatedHeight * scale)),
        sourceDrawWidth: Math.max(1, Math.round(width * scale)),
        sourceDrawHeight: Math.max(1, Math.round(height * scale))
    };
}

function buildWorkingImageCanvas(img, maxLongSide) {
    var spec = getWorkingImageSpec(img.width, img.height, maxLongSide);
    var canvas = document.createElement('canvas');
    canvas.width = spec.canvasWidth;
    canvas.height = spec.canvasHeight;

    var ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    if ('imageSmoothingEnabled' in ctx) {
        ctx.imageSmoothingEnabled = true;
    }
    if ('imageSmoothingQuality' in ctx) {
        ctx.imageSmoothingQuality = 'high';
    }

    if (spec.shouldRotate) {
        ctx.translate(spec.canvasWidth / 2, spec.canvasHeight / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(
            img,
            -spec.sourceDrawWidth / 2,
            -spec.sourceDrawHeight / 2,
            spec.sourceDrawWidth,
            spec.sourceDrawHeight
        );
    } else {
        ctx.drawImage(img, 0, 0, spec.canvasWidth, spec.canvasHeight);
    }

    return canvas;
}

/**
 * 通用重绘函数，将原图和红点绘制到指定 Canvas 上
 */
function drawToCanvas(canvasObj) {
    if (!originalImage || !canvasObj) return;
    
    var ctx = canvasObj.getContext('2d');
    ctx.clearRect(0, 0, canvasObj.width, canvasObj.height);
    
    // 绘制原尺寸底图
    ctx.drawImage(originalImage, 0, 0, canvasObj.width, canvasObj.height);

    // 计算实际显示在屏幕时的缩放比例，使得红点在不同画布呈现时视觉大小一致
    var rect = canvasObj.getBoundingClientRect();
    var displayScale = rect.width > 0 ? (canvasObj.width / rect.width) : 1;
    var outerRadius = 10 * displayScale;
    var innerRadius = 6 * displayScale;

    // 绘制打好的红点
    currentPoints.forEach(function(point) {
        // 白边
        ctx.beginPath();
        ctx.arc(point.x, point.y, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();

        // 红心
        ctx.beginPath();
        ctx.arc(point.x, point.y, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#EF4444';
        ctx.fill();
    });
}

/**
 * 碰撞检测：判断真实坐标 x,y 是否命中了现有药片点
 */
function findHitPoint(x, y) {
    var d = getDOM();
    var canvas = d.fullscreenCanvas;
    var rect = canvas.getBoundingClientRect();
    var displayScale = rect.width > 0 ? (canvas.width / rect.width) : 1;
    
    var hitRadius = 24 * displayScale; // 保证在物理屏幕上拥有 24px 大小的极易触发容错圈
    for (var i = 0; i < currentPoints.length; i++) {
        var p = currentPoints[i];
        var dx = p.x - x;
        var dy = p.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < hitRadius) return i;
    }
    return -1;
}

/**
 * 处理沉浸式画布内的坐标点计算和增删
 */
function handleFullscreenInteraction(clientX, clientY) {
    var d = getDOM();
    var canvas = d.fullscreenCanvas;
    
    // 1. 获取屏幕上画布 CSS 所占的物理边界尺寸
    var rect = canvas.getBoundingClientRect();
    
    // 2. 计算画布虚拟像素尺寸 与 屏幕实际占据的 CSS 尺寸 之比例映射
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    
    // 3. 计算在原生像素尺寸内的真实(x,y)
    var realX = (clientX - rect.left) * scaleX;
    var realY = (clientY - rect.top) * scaleY;

    // 4. 碰撞判定与增删
    var hitIndex = findHitPoint(realX, realY);
    if (hitIndex >= 0) {
        currentPoints.splice(hitIndex, 1);
    } else {
        currentPoints.push({ x: realX, y: realY });
    }

    // 更新画面和计数器
    drawToCanvas(canvas);
    if (d.fullscreenCount) d.fullscreenCount.textContent = currentPoints.length;
}

/**
 * 读取图片，进入初始化状态
 */
function initImageProcess(file) {
    var reader = new FileReader();

    reader.onload = function(e) {
        var base64Data = e.target.result;
        var img = new Image();
        
        img.onload = function() {
            var d = getDOM();
            var workingImage = buildWorkingImageCanvas(img, 1024);
            var drawWidth = workingImage.width;
            var drawHeight = workingImage.height;

            // 将横图先顺时针旋转成竖版工作图，后续预览/全屏/标点统一基于这张图
            originalImage = workingImage;
            
            // 清理上一轮旧数据点
            currentPoints = [];
            
            // 为全屏沉浸 Canvas 设置真实分辨率尺寸
            if (d.fullscreenCanvas) {
                d.fullscreenCanvas.width = drawWidth;
                d.fullscreenCanvas.height = drawHeight;
            }
            // 为预览 Canvas 设置相同的分辨率尺寸
            if (d.previewCanvas) {
                d.previewCanvas.width = drawWidth;
                d.previewCanvas.height = drawHeight;
            }

            // 更新主页面视图状态
            d.uploadArea.classList.add('hidden');
            d.historyCard.classList.add('hidden');
            d.previewContainer.classList.remove('hidden');
            d.previewContainer.classList.add('flex');
            d.bottomConsole.classList.remove('hidden');

            // 画主预览区（初始为空白图像，没有点）
            drawToCanvas(d.previewCanvas);
            
            // 同步计数器
            if (d.roundCount) d.roundCount.textContent = "0";
            if (d.totalCount) d.totalCount.textContent = totalCount;
        };

        img.src = base64Data;
    };

    reader.readAsDataURL(file);
}


// ========== 控制闭环 ==========

/**
 * 开启全屏标点模态框，立刻刷新同步
 */
function openFullscreen() {
    var d = getDOM();
    if (!originalImage || !d.fullscreenModal) return;

    d.fullscreenModal.classList.remove('hidden');
    drawToCanvas(d.fullscreenCanvas); // 首次进入刷底涂
    if (d.fullscreenCount) d.fullscreenCount.textContent = currentPoints.length;
}

/**
 * 从全屏确认返回，关闭模态框并在小尺寸上同步
 */
function closeFullscreen() {
    var d = getDOM();
    d.fullscreenModal.classList.add('hidden');
    drawToCanvas(d.previewCanvas);
    
    if (d.roundCount) d.roundCount.textContent = currentPoints.length;
    if (d.totalCount) d.totalCount.textContent = totalCount + currentPoints.length;
}

/**
 * 继续下一张操作
 */
function nextRound() {
    var d = getDOM();
    if (!originalImage) return;

    // 清理封存上一轮数据
    if (currentPoints.length > 0) {
        roundRecords.push(currentPoints.length);
        totalCount += currentPoints.length;
    }
    
    currentPoints = [];
    originalImage = null;

    // 退回上传形态
    d.previewContainer.classList.add('hidden');
    d.previewContainer.classList.remove('flex');
    d.bottomConsole.classList.add('hidden');
    d.uploadArea.classList.remove('hidden');
    
    if (d.roundCount) d.roundCount.textContent = "0";
    if (d.totalCount) d.totalCount.textContent = totalCount;

    // 直接拉起文件选择器
    if (d.fileInput) {
        d.fileInput.value = '';
        d.fileInput.click();
    }
}

/**
 * 全部数完了，归档回药箱页面
 */
function finishCounting() {
    if (originalImage && currentPoints.length > 0) {
        roundRecords.push(currentPoints.length);
        totalCount += currentPoints.length;
    }

    if (totalCount <= 0) {
        showToast('还没有任何有效标定哦', 'error');
        return;
    }

    // 存储这次漫长的清点工作并结账
    addCounterRecord(roundRecords, totalCount);
    window.location.href = 'medicine.html?ai_count=' + totalCount;
}


// ========== 初始化与事件绑定 ==========

window.addEventListener('load', function() {
    var d = getDOM();

    initCounterBackLink();
    
    // 初始化历史列表
    renderHistory();

    // ======================================
    //     主流程入口判定
    // ======================================
    if (d.btnUpload) {
        d.btnUpload.addEventListener('click', function() {
            if (d.fileInput) {
                d.fileInput.value = '';
                d.fileInput.click();
            }
        });
    }

    if (d.fileInput) {
        d.fileInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file || !file.type.startsWith('image/')) {
                if (file) showToast('请选择有效的图片', 'error');
                return;
            }
            initImageProcess(file);
        });
    }

    // ======================================
    //     桥接全屏状态
    // ======================================
    if (d.previewCanvas) {
        d.previewCanvas.addEventListener('click', openFullscreen);
    }
    
    if (d.btnFinishMark) {
        d.btnFinishMark.addEventListener('click', closeFullscreen);
    }

    // ======================================
    //     全屏坐标运算层
    // ======================================
    if (d.fullscreenCanvas) {
        // 单击支持
        d.fullscreenCanvas.addEventListener('click', function(e) {
            handleFullscreenInteraction(e.clientX, e.clientY);
        });

        // 触摸屏原生支持
        d.fullscreenCanvas.addEventListener('touchend', function(e) {
            // 防止重触发 click
            e.preventDefault();
            var touch = e.changedTouches[0];
            if (touch) {
                handleFullscreenInteraction(touch.clientX, touch.clientY);
            }
        });
    }

    // ======================================
    //     底栏按钮确认提交操作
    // ======================================
    if (d.btnNextRound) {
        d.btnNextRound.addEventListener('click', nextRound);
    }

    if (d.btnDone) {
        d.btnDone.addEventListener('click', finishCounting);
    }
});
