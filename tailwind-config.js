// 啾咪设计系统 - Tailwind CSS 配置
tailwind.config = {
    theme: {
        extend: {
            colors: {
                chume: {
                    cream: '#F8E8C1',
                    orange: '#FF9F43',
                    'orange-light': '#FFF0DB',
                    brown: '#5C4B43',
                    'brown-light': '#8B7B74',
                    card: '#F4EFEA',
                    green: '#C8E6C9',
                    pink: '#F2A19B',
                }
            },
            boxShadow: {
                'soft': '0 8px 24px rgba(92, 75, 67, 0.08)',
                'card': '0 2px 12px rgba(92, 75, 67, 0.06)',
            },
            borderRadius: {
                'card': '24px',
                'btn': '999px',
            },
            fontFamily: {
                'num': ['Nunito', 'sans-serif'],
                'title': ['Nunito', 'PingFang SC', '-apple-system', 'sans-serif'],
                'body': ['Nunito', 'PingFang SC', '-apple-system', 'sans-serif'],
            }
        }
    }
};