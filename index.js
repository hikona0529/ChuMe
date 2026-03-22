// --- Widget Logic ---

        function updateDateAndTime() {
            const now = new Date();

            // 1. Status Bar Time (HH:MM)
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            document.getElementById('status-time').innerText = `${hours}:${minutes}`;

            // 2. Widget Big Time (HH:MM)
            const widgetTime = document.getElementById('widget-time');
            if (widgetTime) widgetTime.innerText = `${hours}:${minutes}`;

            // 3. Widget Date (M月D日 星期X)
            const widgetDate = document.getElementById('widget-date');
            if (widgetDate) {
                const month = now.getMonth() + 1;
                const date = now.getDate();
                const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                widgetDate.innerText = `${month}月${date}日 ${weekDays[now.getDay()]}`;
            }

            // 4. Greeting
            updateGreeting(now.getHours());
        }

        function updateGreeting(hour) {
            const widgetGreeting = document.getElementById('widget-greeting');
            if (!widgetGreeting) return;

            // Get User Nickname
            const settings = getPref('user_settings');
            const nickname = (settings && settings.nickname) ? settings.nickname : '体验者';

            let greeting = '你好';
            if (hour >= 5 && hour < 12) greeting = '早上好';
            else if (hour >= 12 && hour < 18) greeting = '下午好';
            else greeting = '晚上好';

            widgetGreeting.innerText = `${greeting}，${nickname}`;
        }

        setInterval(updateDateAndTime, 1000);
        updateDateAndTime();

        // Welcome Toast
        window.addEventListener('load', () => {
            // Optional: only show welcome toast nicely
            // showToast('欢迎回来', 'success');
        });
