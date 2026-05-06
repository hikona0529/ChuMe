// ai-settings.js
// AI 设置页 —— 预设管理模块（重构版）

// ========== 常量和预设默认值 ==========

/**
 * AI 模型来源对应的默认基础 URL
 */
var AI_SOURCE_DEFAULTS = {
    openai: '',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    deepseek: 'https://api.deepseek.com/v1'
};

/**
 * AI 模型来源的显示名称
 */
var AI_SOURCE_LABELS = {
    openai: 'OpenAI兼容',
    gemini: 'Gemini',
    deepseek: 'Deepseek'
};


// ========== 数据读写 ==========

/**
 * 获取所有预设列表
 */
function getPresets() {
    return getPref('ai_presets') || [];
}

/**
 * 保存预设列表
 */
function savePresets(presets) {
    savePref('ai_presets', presets);
}

/**
 * 获取当前激活的预设 ID
 */
function getActivePresetId() {
    return getPref('active_ai_preset_id') || '';
}

/**
 * 保存当前激活的预设 ID
 */
function saveActivePresetId(id) {
    savePref('active_ai_preset_id', id);
}

/**
 * 根据 ID 查找预设
 */
function findPresetById(id) {
    var presets = getPresets();
    return presets.find(function(p) { return p.id === id; }) || null;
}


// ========== HTML 转义工具 ==========

/**
 * 防 XSS：对插入 innerHTML 的文本做转义
 */
function _escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 截断过长的文本，超出指定长度则加"..."
 */
function _truncateText(str, maxLen) {
    if (!str) return '';
    if (str.length > maxLen) {
        return str.substring(0, maxLen) + '...';
    }
    return str;
}


// ========== UI 渲染 ==========

/**
 * 渲染当前激活预设的状态卡片
 */
function renderActivePreset() {
    var container = document.getElementById('active-preset-content');
    if (!container) return;

    var activeId = getActivePresetId();
    var preset = activeId ? findPresetById(activeId) : null;

    if (!preset) {
        container.innerHTML = '<p class="text-sm text-chume-brown-light text-center py-2">请在下方选择或添加预设</p>';
        return;
    }

    var sourceLabel = AI_SOURCE_LABELS[preset.source] || preset.source;
    // 对 API 密钥做脱敏处理，只显示前 4 位
    var maskedKey = preset.apiKey ? (preset.apiKey.substring(0, 4) + '••••••') : '未设置';

    container.innerHTML =
        '<div class="space-y-2">' +
            '<div class="flex items-center justify-between">' +
                '<span class="text-sm font-medium text-chume-brown">' + _escapeHtml(preset.name) + '</span>' +
                '<span class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600 font-medium">已激活</span>' +
            '</div>' +
            '<div class="text-xs text-chume-brown-light space-y-1">' +
                '<div class="flex justify-between"><span>来源</span><span>' + _escapeHtml(sourceLabel) + '</span></div>' +
                '<div class="flex justify-between"><span>模型</span><span class="font-num">' + _escapeHtml(preset.model || '未设置') + '</span></div>' +
                '<div class="flex justify-between"><span>密钥</span><span class="font-num">' + _escapeHtml(maskedKey) + '</span></div>' +
            '</div>' +
        '</div>';
}

/**
 * 渲染预设列表（重构版 —— 三段式布局 + 复制/删除/编辑）
 */
function renderPresetList() {
    var container = document.getElementById('preset-list');
    if (!container) return;

    var presets = getPresets();
    var activeId = getActivePresetId();

    if (presets.length === 0) {
        container.innerHTML =
            '<div class="px-4 py-6 text-center text-sm text-chume-brown-light">' +
                '还没有预设，点击右上角「新增」开始吧' +
            '</div>';
        return;
    }

    // 清空容器
    container.innerHTML = '';

    presets.forEach(function(preset, index) {
        var isActive = preset.id === activeId;
        var sourceLabel = AI_SOURCE_LABELS[preset.source] || preset.source;
        var isLast = index === presets.length - 1;

        // 创建行容器
        var row = document.createElement('div');
        row.className = 'flex items-center px-4 py-3' + (isLast ? '' : ' border-b border-chume-brown/10');

        // ========= 左侧信息区（可点击编辑） =========
        var leftArea = document.createElement('div');
        leftArea.className = 'flex-1 min-w-0 mr-3 cursor-pointer';
        leftArea.setAttribute('data-edit-id', preset.id);

        // 第1行：预设名称
        var nameLine = document.createElement('div');
        nameLine.className = 'text-sm font-semibold text-chume-brown truncate';
        nameLine.textContent = preset.name || '未命名';

        // 第2行：模型来源
        var sourceLine = document.createElement('div');
        sourceLine.className = 'text-xs text-chume-brown-light mt-0.5';
        sourceLine.textContent = sourceLabel;

        // 第3行：模型名称（超过20字截断）
        var modelLine = document.createElement('div');
        modelLine.className = 'text-xs text-chume-brown-light mt-0.5 font-num';
        modelLine.textContent = _truncateText(preset.model || '未设置模型', 20);

        leftArea.appendChild(nameLine);
        leftArea.appendChild(sourceLine);
        leftArea.appendChild(modelLine);

        // 点击左侧 → 编辑该预设
        leftArea.addEventListener('click', function() {
            showPresetModal(preset);
        });

        // ========= 右侧操作区 =========
        var rightArea = document.createElement('div');
        rightArea.className = 'flex items-center gap-1 shrink-0';

        // 【设为激活】按钮
        var activateBtn = document.createElement('button');
        if (isActive) {
            activateBtn.className = 'text-xs text-chume-brown-light px-2 py-1 min-h-[44px] cursor-default';
            activateBtn.textContent = '已激活';
            activateBtn.disabled = true;
        } else {
            activateBtn.className = 'text-xs text-chume-orange font-medium px-2 py-1 min-h-[44px] active:opacity-50';
            activateBtn.textContent = '激活';
            activateBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                activatePreset(preset.id);
            });
        }

        // 【复制】按钮
        var copyBtn = document.createElement('button');
        copyBtn.className = 'text-xs px-1.5 py-1 min-h-[44px] active:opacity-50';
        copyBtn.textContent = '📋';
        copyBtn.title = '复制预设';
        copyBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            copyPreset(preset.id);
        });

        // 【删除】按钮
        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-xs text-chume-pink px-1.5 py-1 min-h-[44px] active:opacity-50';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = '删除预设';
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deletePreset(preset.id);
        });

        rightArea.appendChild(activateBtn);
        rightArea.appendChild(copyBtn);
        rightArea.appendChild(deleteBtn);

        // 组装行
        row.appendChild(leftArea);
        row.appendChild(rightArea);
        container.appendChild(row);
    });
}

/**
 * 刷新整个页面的 UI
 */
function refreshUI() {
    renderActivePreset();
    renderPresetList();
}


// ========== 模态框控制 ==========

/**
 * 显示预设表单模态框（支持新增/编辑两种模式）
 */
function showPresetModal(editPreset) {
    var modal = document.getElementById('preset-modal');
    var title = document.getElementById('modal-title');
    if (!modal) return;

    // 清空表单
    document.getElementById('form-preset-id').value = '';
    document.getElementById('form-preset-name').value = '';
    document.getElementById('form-model-source').value = 'openai';
    document.getElementById('form-base-url').value = '';
    document.getElementById('form-api-key').value = '';
    document.getElementById('form-model-name').value = '';

    // 清空 datalist
    var datalist = document.getElementById('ai_model_list');
    if (datalist) datalist.innerHTML = '';

    // 如果是编辑模式，回填数据
    if (editPreset) {
        title.textContent = '编辑预设';
        document.getElementById('form-preset-id').value = editPreset.id;
        document.getElementById('form-preset-name').value = editPreset.name || '';
        document.getElementById('form-model-source').value = editPreset.source || 'openai';
        document.getElementById('form-base-url').value = editPreset.baseUrl || '';
        document.getElementById('form-api-key').value = editPreset.apiKey || '';
        document.getElementById('form-model-name').value = editPreset.model || '';
    } else {
        title.textContent = '新增预设';
    }

    // 显示模态框
    modal.classList.remove('hidden');
}

/**
 * 隐藏预设表单模态框
 */
function hidePresetModal() {
    var modal = document.getElementById('preset-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}


// ========== 核心交互逻辑 ==========

/**
 * 保存预设（新增或编辑）
 */
function savePresetFromForm() {
    var idField = document.getElementById('form-preset-id');
    var nameField = document.getElementById('form-preset-name');
    var sourceField = document.getElementById('form-model-source');
    var urlField = document.getElementById('form-base-url');
    var keyField = document.getElementById('form-api-key');
    var modelField = document.getElementById('form-model-name');

    var name = nameField.value.trim();
    var source = sourceField.value;
    var baseUrl = urlField.value.trim();
    var apiKey = keyField.value.trim();
    var model = modelField.value.trim();

    // 基本校验
    if (!name) {
        showToast('请填写预设名称', 'error');
        return;
    }

    var presets = getPresets();
    var editId = idField.value;

    if (editId) {
        // 编辑模式 —— 更新已有预设
        var found = false;
        presets = presets.map(function(p) {
            if (p.id === editId) {
                found = true;
                return {
                    id: editId,
                    name: name,
                    source: source,
                    baseUrl: baseUrl,
                    apiKey: apiKey,
                    model: model
                };
            }
            return p;
        });
        if (!found) {
            showToast('预设不存在', 'error');
            return;
        }
        showToast('预设已更新', 'success');
    } else {
        // 新增模式
        var newPreset = {
            id: String(Date.now()),
            name: name,
            source: source,
            baseUrl: baseUrl,
            apiKey: apiKey,
            model: model
        };
        presets.push(newPreset);
        showToast('预设已添加', 'success');
    }

    savePresets(presets);
    hidePresetModal();
    refreshUI();
}

/**
 * 激活指定预设
 */
function activatePreset(id) {
    var preset = findPresetById(id);
    if (!preset) {
        showToast('预设不存在', 'error');
        return;
    }

    saveActivePresetId(id);
    showToast('已切换至「' + preset.name + '」', 'success');
    refreshUI();
}

/**
 * 复制指定预设
 */
function copyPreset(id) {
    var preset = findPresetById(id);
    if (!preset) {
        showToast('预设不存在', 'error');
        return;
    }

    if (!confirm('是否快速复制该预设？')) {
        return;
    }

    var presets = getPresets();
    var newPreset = {
        id: String(Date.now()),
        name: preset.name + '-副本',
        source: preset.source,
        baseUrl: preset.baseUrl,
        apiKey: preset.apiKey,
        model: preset.model
    };
    presets.push(newPreset);
    savePresets(presets);

    showToast('已复制预设', 'success');
    refreshUI();
}

/**
 * 删除指定预设
 */
function deletePreset(id) {
    var presets = getPresets();
    var target = presets.find(function(p) { return p.id === id; });

    if (!target) {
        showToast('预设不存在', 'error');
        return;
    }

    if (!confirm('确认删除该预设？此操作不可恢复。')) {
        return;
    }

    presets = presets.filter(function(p) { return p.id !== id; });
    savePresets(presets);

    // 如果删除的是当前激活项，清空激活 ID
    if (getActivePresetId() === id) {
        saveActivePresetId('');
    }

    showToast('已删除', 'success');
    refreshUI();
}


// ========== 智能联动 ==========

/**
 * 模型来源切换后，自动填充基础 URL
 * 仅在 URL 为空或等于某个预设默认值时自动填充
 */
function handleSourceChange() {
    var sourceEl = document.getElementById('form-model-source');
    var urlEl = document.getElementById('form-base-url');
    if (!sourceEl || !urlEl) return;

    var currentUrl = urlEl.value.trim();
    var source = sourceEl.value;

    // 判断当前 URL 是否可以自动填充（空 或 等于某个预设默认值）
    var canAutoFill = currentUrl === '';
    if (!canAutoFill) {
        var isDefaultUrl = Object.values(AI_SOURCE_DEFAULTS).some(function(defaultUrl) {
            return defaultUrl === currentUrl;
        });
        canAutoFill = isDefaultUrl;
    }

    if (canAutoFill && AI_SOURCE_DEFAULTS[source] !== undefined) {
        urlEl.value = AI_SOURCE_DEFAULTS[source];
    }
}


// ========== 动态拉取模型列表 ==========

/**
 * 点击「获取列表」按钮：拉取远程模型列表填入 datalist
 */
async function fetchModelList() {
    var urlEl = document.getElementById('form-base-url');
    var keyEl = document.getElementById('form-api-key');
    var fetchBtn = document.getElementById('btn-fetch-models');
    var datalist = document.getElementById('ai_model_list');

    if (!urlEl || !keyEl || !fetchBtn) return;

    var baseUrl = urlEl.value.trim();
    var apiKey = keyEl.value.trim();

    // 校验必填字段
    if (!baseUrl) {
        showToast('请先填写基础 URL', 'error');
        return;
    }
    if (!apiKey) {
        showToast('请先填写 API 密钥', 'error');
        return;
    }

    // 更新按钮状态 —— 请求中
    fetchBtn.textContent = '拉取中...';
    fetchBtn.disabled = true;
    fetchBtn.classList.add('opacity-50');

    try {
        // 拼接请求地址，处理末尾斜杠
        var url = baseUrl.replace(/\/+$/, '') + '/models';

        var response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + apiKey
            }
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }

        var result = await response.json();

        // 解析标准格式 { "data": [ {"id": "..."} ] }
        var models = result.data || [];

        if (datalist) {
            // 清空旧选项
            datalist.innerHTML = '';

            // 填充新选项
            models.forEach(function(model) {
                var option = document.createElement('option');
                option.value = model.id || model.name || '';
                datalist.appendChild(option);
            });
        }

        showToast('拉取成功，共 ' + models.length + ' 个模型', 'success');

    } catch (err) {
        console.error('拉取模型列表失败:', err);
        showToast('拉取失败，请手动填写模型名称', 'error');
    } finally {
        // 无论成败，恢复按钮状态
        fetchBtn.textContent = '🔄 获取模型列表';
        fetchBtn.disabled = false;
        fetchBtn.classList.remove('opacity-50');
    }
}


// ========== 连通性测试 ==========

/**
 * 测试当前激活预设的 API 连通性
 * 发送极简请求到 /chat/completions，max_tokens: 5 以节省成本
 */
async function testConnection() {
    var testBtn = document.getElementById('btn-test-connection');
    if (!testBtn) return;

    // 1. 前置校验：读取当前激活预设
    var activeId = getActivePresetId();
    var preset = activeId ? findPresetById(activeId) : null;

    if (!preset || !preset.baseUrl || !preset.apiKey || !preset.model) {
        showToast('请先完善并激活一个 API 预设', 'error');
        return;
    }

    // 2. 状态更新：禁用按钮
    testBtn.textContent = '连接测试中...';
    testBtn.disabled = true;
    testBtn.classList.add('opacity-50');

    try {
        // 3. 组装请求
        var url = preset.baseUrl.replace(/\/+$/, '') + '/chat/completions';

        var response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + preset.apiKey
            },
            body: JSON.stringify({
                model: preset.model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5
            })
        });

        // 4. 结果处理
        if (response.ok) {
            showToast('连接成功！该预设可正常使用', 'success');
        } else {
            showToast('连接失败，请检查 API 密钥或基础 URL 是否正确', 'error');
        }

    } catch (err) {
        console.error('连通性测试失败:', err);
        showToast('连接失败，请检查 API 密钥或基础 URL 是否正确', 'error');
    } finally {
        // 无论成败，恢复按钮状态
        testBtn.textContent = '🔌 测试连通性';
        testBtn.disabled = false;
        testBtn.classList.remove('opacity-50');
    }
}


// ========== 事件绑定与初始化 ==========

window.addEventListener('load', function() {

    // 1. 初始渲染
    refreshUI();

    // 2. 「新增预设」按钮
    var addBtn = document.getElementById('btn-add-preset');
    if (addBtn) {
        addBtn.addEventListener('click', function() {
            showPresetModal(null);
        });
    }

    // 3. 模态框关闭按钮 + 遮罩点击关闭
    var closeBtn = document.getElementById('btn-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', hidePresetModal);
    }

    var backdrop = document.getElementById('preset-modal-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', hidePresetModal);
    }

    // 4. 模态框「取消」按钮
    var cancelBtn = document.getElementById('btn-form-cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hidePresetModal);
    }

    // 5. 模态框「保存」按钮
    var saveBtn = document.getElementById('btn-form-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', savePresetFromForm);
    }

    // 6. 模型来源切换 → 智能联动
    var sourceSelect = document.getElementById('form-model-source');
    if (sourceSelect) {
        sourceSelect.addEventListener('change', handleSourceChange);
    }

    // 7. 「获取列表」按钮
    var fetchBtn = document.getElementById('btn-fetch-models');
    if (fetchBtn) {
        fetchBtn.addEventListener('click', fetchModelList);
    }

    // 8. 「测试连通性」按钮
    var testBtn = document.getElementById('btn-test-connection');
    if (testBtn) {
        testBtn.addEventListener('click', testConnection);
    }

});
