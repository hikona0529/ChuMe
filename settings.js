// Load Settings on Start
        window.addEventListener('load', () => {
            const userSettings = getPref('user_settings');
            if (userSettings && userSettings.nickname) {
                document.getElementById('nickname-input').value = userSettings.nickname;
            }
        });

        // Save Function
        function saveSettings() {
            const nickname = document.getElementById('nickname-input').value.trim();

            // Save to LocalStorage via utils.js helper
            savePref('user_settings', {
                nickname: nickname
            });

            showToast('设置已保存', 'success');

            // Delay and go back
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }

        // Reset Handler
        async function handleReset() {
            if (confirm('这将删除所有数据（包括文字图片和设置）且无法恢复。\n\n确定吗？')) {
                try {
                    await factoryReset();

                    // Success Callback
                    // 1. Clear View
                    const input = document.getElementById('nickname-input');
                    if (input) input.value = '';

                    // 2. Show Toast
                    showToast('重置成功', 'success');

                    // 3. No Reload (Stay here)

                } catch (err) {
                    console.error(err);
                    showToast('重置失败', 'error');
                }
            }
        }
