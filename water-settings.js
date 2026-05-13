window.addEventListener('load', () => {
    loadWaterSettings();
});

const WATER_DEFAULT_TOTAL = 2500;
const WATER_DEFAULT_ELEC = 500;
const WATER_DEFAULT_VOL = 300;
const WATER_DRINK_CONFIG = {
    '白开水': { i: '🥤' },
    '黑咖啡': { i: '☕' },
    '电解质': { i: '⚡' },
    '柠檬水': { i: '🍋' },
    '淡盐水': { i: '🧂' },
    '茶': { i: '🍵' },
    '牛奶': { i: '🥛' },
    '拿铁': { i: '☕' },
    'MCT': { i: '✨' }
};
const WATER_DRINK_NAMES = Object.keys(WATER_DRINK_CONFIG);

function isWaterElectrolyteEnabled() {
    const enabled = getPref('goal_elec_enabled');
    if (enabled !== null && enabled !== '') {
        return enabled === true || enabled === 'true';
    }

    const legacyGoal = getPref('goal_elec');
    return legacyGoal !== null && legacyGoal !== '';
}

function loadWaterSettings() {
    const totalInput = document.getElementById('set-goal-total');
    const elecInput = document.getElementById('set-goal-elec');
    const elecEnabledInput = document.getElementById('set-goal-elec-enabled');
    const volumeInput = document.getElementById('set-default-vol');
    if (!totalInput || !elecInput || !elecEnabledInput || !volumeInput) return;

    const totalGoal = getPref('goal_total');
    const elecGoal = getPref('goal_elec');
    const defaultVolume = getPref('default_vol');

    totalInput.value = totalGoal !== null && totalGoal !== '' ? String(totalGoal) : String(WATER_DEFAULT_TOTAL);
    elecInput.value = elecGoal !== null && elecGoal !== '' ? String(elecGoal) : String(WATER_DEFAULT_ELEC);
    elecEnabledInput.checked = isWaterElectrolyteEnabled();
    volumeInput.value = defaultVolume !== null && defaultVolume !== '' ? String(defaultVolume) : String(WATER_DEFAULT_VOL);
    syncWaterElectrolyteToggle();
    renderWaterSettingsDrinkToggles();
}

function parseEnabledWaterDrinks(raw) {
    if (!raw) return [...WATER_DRINK_NAMES];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [...WATER_DRINK_NAMES];
    } catch (err) {
        return [...WATER_DRINK_NAMES];
    }
}

function normalizeEnabledWaterDrinks(names) {
    const enabled = (names || []).filter(name => WATER_DRINK_CONFIG[name]);
    return enabled.length > 0 ? [...new Set(enabled)] : ['白开水'];
}

function getEnabledWaterDrinks() {
    return normalizeEnabledWaterDrinks(parseEnabledWaterDrinks(getPref('enabled_drinks')));
}

function renderWaterSettingsDrinkToggles() {
    const container = document.getElementById('water-settings-drinks');
    if (!container) return;

    const enabled = new Set(getEnabledWaterDrinks());
    container.innerHTML = WATER_DRINK_NAMES.map(name => {
        const checked = enabled.has(name) ? 'checked' : '';
        return `
            <label class="flex items-center justify-between px-4 py-3 border-b border-chume-brown/10 last:border-b-0">
                <span class="flex items-center gap-2 text-chume-brown font-medium">
                    <span>${WATER_DRINK_CONFIG[name].i}</span>
                    <span>${name}</span>
                </span>
                <span class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="drink-toggle sr-only peer" value="${name}" ${checked}>
                    <span class="w-10 h-6 bg-chume-brown/20 rounded-full peer peer-checked:bg-chume-orange transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:shadow-card after:transition-transform peer-checked:after:translate-x-4"></span>
                </span>
            </label>
        `;
    }).join('');
}

function getCheckedWaterDrinks() {
    const container = document.getElementById('water-settings-drinks');
    if (!container) return getEnabledWaterDrinks();

    const selected = Array.from(container.querySelectorAll('.drink-toggle'))
        .filter(input => input.checked)
        .map(input => input.value);
    return normalizeEnabledWaterDrinks(selected);
}

function syncWaterElectrolyteToggle() {
    const elecInput = document.getElementById('set-goal-elec');
    const elecEnabledInput = document.getElementById('set-goal-elec-enabled');
    if (!elecInput || !elecEnabledInput) return;

    elecInput.disabled = !elecEnabledInput.checked;
    if (elecEnabledInput.checked && elecInput.value === '') {
        elecInput.value = String(WATER_DEFAULT_ELEC);
    }
}

function saveWaterSettings() {
    const totalInput = document.getElementById('set-goal-total');
    const elecInput = document.getElementById('set-goal-elec');
    const elecEnabledInput = document.getElementById('set-goal-elec-enabled');
    const volumeInput = document.getElementById('set-default-vol');
    if (!totalInput || !elecInput || !elecEnabledInput || !volumeInput) return;

    const totalGoal = totalInput.value || String(WATER_DEFAULT_TOTAL);
    const elecGoal = elecInput.value || String(WATER_DEFAULT_ELEC);
    const defaultVolume = volumeInput.value || String(WATER_DEFAULT_VOL);
    const elecEnabled = elecEnabledInput.checked;

    savePref('goal_total', totalGoal !== '' ? parseInt(totalGoal, 10) : '');
    savePref('goal_elec_enabled', elecEnabled);
    savePref('goal_elec', elecEnabled ? parseInt(elecGoal, 10) : '');
    savePref('default_vol', defaultVolume !== '' ? parseInt(defaultVolume, 10) : '');
    savePref('enabled_drinks', JSON.stringify(getCheckedWaterDrinks()));

    showToast('喝水设置已保存', 'success');

    setTimeout(() => {
        window.location.href = 'water.html';
    }, 600);
}
