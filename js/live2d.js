/**
 * Live2D 看板娘 - 丛雨
 * 简单稳定版：直接显示图片 + CSS动画
 */

(function () {
    'use strict';

    const config = {
        imagePath: '/live2d/Murasame.4096/texture_00.png',
        width: 280,
        height: 400,
        showRatio: 0.67,
        loadTimeout: 15000 // 15秒超时
    };

    const messages = [
        '吾名丛雨，乃是这"丛雨丸"的管理者……',
        '你，就是本座的主人？',
        '早上好，主人！',
        '本座才不是幽灵！完全不是！',
        '在这里，这里哦~',
        '主人今天也要加油！',
        '你醒了吗，主人。早上好~',
        '本座不是幻觉，更不是幽灵，主人！'
    ];

    // 样式
    function createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #live2d-widget {
                position: fixed;
                bottom: 0;
                right: 20px;
                width: ${config.width}px;
                height: ${Math.floor(config.height * config.showRatio)}px;
                overflow: hidden;
                z-index: 99999;
                pointer-events: none;
            }
            #live2d-img {
                position: absolute;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
                max-width: 120%;
                max-height: 120%;
                object-fit: contain;
                clip-path: polygon(0 0, 100% 0, 100% ${config.showRatio * 100}%, 0 ${config.showRatio * 100}%);
                pointer-events: auto;
                cursor: pointer;
                transition: transform 0.15s ease-out;
                user-select: none;
                -webkit-user-drag: none;
                opacity: 0;
            }
            #live2d-img.loaded {
                opacity: 1;
            }
            #live2d-img:hover {
                transform: translateX(-50%) scale(1.03);
            }
            @keyframes live2d-breathe {
                0%, 100% { transform: translateX(-50%) scale(1); }
                50% { transform: translateX(-50%) scale(1.02); }
            }
            #live2d-img.breathing {
                animation: live2d-breathe 3s ease-in-out infinite;
            }
            @keyframes live2d-talk {
                0%, 100% { transform: translateX(-50%) scale(1); }
                25% { transform: translateX(-50%) scale(1.04); }
                75% { transform: translateX(-50%) scale(1.02); }
            }
            #live2d-img.talking {
                animation: live2d-talk 0.5s ease-in-out;
            }
            #live2d-toggle {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 42px;
                height: 42px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 100000;
                font-size: 20px;
                box-shadow: 0 4px 15px rgba(102,126,234,0.5);
                transition: transform 0.2s;
                user-select: none;
            }
            #live2d-toggle:hover { transform: scale(1.12); }
            #live2d-msg {
                position: fixed;
                bottom: 90px;
                right: 25px;
                background: rgba(255,255,255,0.97);
                padding: 12px 18px;
                border-radius: 14px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.13);
                max-width: 220px;
                font-size: 13px;
                line-height: 1.7;
                color: #444;
                opacity: 0;
                transform: translateY(8px);
                transition: opacity 0.3s, transform 0.3s;
                z-index: 100001;
                pointer-events: none;
            }
            #live2d-msg.show { opacity: 1; transform: translateY(0); }
            #live2d-loading {
                position: fixed;
                bottom: 20px;
                right: 80px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 25px;
                font-size: 13px;
                z-index: 100000;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #live2d-loading .spinner {
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            #live2d-loading.error {
                background: rgba(255,100,100,0.9);
            }
        `;
        document.head.appendChild(style);
    }

    // 初始化
    function init() {
        createStyles();

        // 加载提示
        const loadingEl = document.createElement('div');
        loadingEl.id = 'live2d-loading';
        loadingEl.innerHTML = '<div class="spinner"></div><span>加载丛雨中...</span>';
        document.body.appendChild(loadingEl);

        // 创建容器
        const container = document.createElement('div');
        container.id = 'live2d-widget';

        const img = document.createElement('img');
        img.id = 'live2d-img';
        img.src = config.imagePath;
        img.alt = 'Live2D 丛雨';
        
        // 设置图片加载超时
        let loaded = false;
        let timeoutId = setTimeout(() => {
            if (!loaded) {
                loadingEl.classList.add('error');
                loadingEl.innerHTML = '<span>图片太大，尝试重新加载...</span>';
                // 尝试重新加载一次
                img.src = '';
                img.src = config.imagePath;
                // 再等15秒
                setTimeout(() => {
                    if (!loaded) {
                        loadingEl.innerHTML = '<span>加载超时，请刷新页面</span>';
                    }
                }, 15000);
            }
        }, config.loadTimeout);
        
        img.onload = function() {
            loaded = true;
            clearTimeout(timeoutId);
            console.log('[Live2D] 图片加载成功');
            img.classList.add('loaded', 'breathing');
            loadingEl.remove();
            
            // 开场白
            setTimeout(() => showMessage(messages[0]), 1000);
        };
        
        img.onerror = function() {
            console.error('[Live2D] 图片加载失败:', config.imagePath);
            loadingEl.classList.add('error');
            loadingEl.innerHTML = '<span>加载失败</span>';
        };

        container.appendChild(img);
        document.body.appendChild(container);

        setupInteraction(img);
        createToggle(container);
    }

    function setupInteraction(img) {
        let isHover = false;
        let targetX = 0, currentX = 0, isTalking = false;

        img.addEventListener('mouseenter', () => isHover = true);
        img.addEventListener('mouseleave', () => { isHover = false; targetX = 0; });

        img.addEventListener('click', () => {
            if (!isTalking) {
                isTalking = true;
                img.classList.remove('breathing');
                img.classList.add('talking');
                setTimeout(() => {
                    img.classList.remove('talking');
                    img.classList.add('breathing');
                    isTalking = false;
                }, 500);
            }
            const msg = messages[Math.floor(Math.random() * messages.length)];
            showMessage(msg);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isHover) { targetX = 0; return; }
            const centerX = window.innerWidth / 2;
            targetX = ((e.clientX - centerX) / centerX) * 15;
        });

        function animate() {
            currentX += (targetX - currentX) * 0.1;
            const baseTransform = isHover ? 'translateX(calc(-50% + ' + currentX + 'px)) scale(1.03)' : 'translateX(-50%)';
            if (!img.classList.contains('talking')) {
                img.style.transform = baseTransform;
            }
            requestAnimationFrame(animate);
        }
        animate();
    }

    function showMessage(text) {
        let el = document.getElementById('live2d-msg');
        if (!el) {
            el = document.createElement('div');
            el.id = 'live2d-msg';
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 5000);
    }

    function createToggle(widget) {
        const btn = document.createElement('div');
        btn.id = 'live2d-toggle';
        btn.textContent = '🌸';
        btn.title = '显示/隐藏看板娘';
        let visible = true;
        btn.onclick = (e) => {
            e.stopPropagation();
            visible = !visible;
            widget.style.display = visible ? 'block' : 'none';
            btn.textContent = visible ? '🌸' : '👋';
        };
        document.body.appendChild(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
