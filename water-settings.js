window.addEventListener('load', () => {
    loadWaterSettings();
});

function loadWaterSettings() {
    const totalInput = document.getElementById('set-goal-total');
    const elecInput = document.getElementById('set-goal-elec');
    const volumeInput = document.getElementById('set-default-vol');
    if (!totalInput || !elecInput || !volumeInput) return;

    const totalGoal = getPref('goal_total');
    const elecGoal = getPref('goal_elec');
    const defaultVolume = getPref('default_vol');

    totalInput.value = totalGoal !== null && totalGoal !== '' ? String(totalGoal) : '';
    elecInput.value = elecGoal !== null && elecGoal !== '' ? String(elecGoal) : '';
    volumeInput.value = defaultVolume !== null && defaultVolume !== '' ? String(defaultVolume) : '250';
}

function saveWaterSettings() {
    const totalInput = document.getElementById('set-goal-total');
    const elecInput = document.getElementById('set-goal-elec');
    const volumeInput = document.getElementById('set-default-vol');
    if (!totalInput || !elecInput || !volumeInput) return;

    const totalGoal = totalInput.value;
    const elecGoal = elecInput.value;
    const defaultVolume = volumeInput.value;

    savePref('goal_total', totalGoal !== '' ? parseInt(totalGoal, 10) : '');
    savePref('goal_elec', elecGoal !== '' ? parseInt(elecGoal, 10) : '');
    savePref('default_vol', defaultVolume !== '' ? parseInt(defaultVolume, 10) : '');

    showToast('喝水设置已保存', 'success');

    setTimeout(() => {
        window.location.href = 'water.html';
    }, 600);
}
