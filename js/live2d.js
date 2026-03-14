/**
 * Live2D 看板娘 - 丛雨
 * 完全本地加载，无CDN依赖
 */

(function () {
    'use strict';

    const config = {
        modelPath: '/live2d/Murasame.model3.json',
        canvasWidth: 300,
        canvasHeight: 450,
        showRatio: 0.67,
        scale: 0.25,
        posX: 150,
        posY: 50
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
                width: ${config.canvasWidth}px;
                height: ${Math.floor(config.canvasHeight * config.showRatio)}px;
                overflow: hidden;
                z-index: 99999;
                pointer-events: none;
            }
            #live2d-widget canvas {
                position: absolute;
                bottom: 0;
                left: 0;
                pointer-events: auto;
                cursor: pointer;
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
            @keyframes spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }

    // 加载脚本
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error(src));
            document.head.appendChild(s);
        });
    }

    // 初始化
    async function init() {
        createStyles();

        const loadingEl = document.createElement('div');
        loadingEl.id = 'live2d-loading';
        loadingEl.innerHTML = '<div class="spinner"></div><span>加载中...</span>';
        document.body.appendChild(loadingEl);

        const container = document.createElement('div');
        container.id = 'live2d-widget';
        document.body.appendChild(container);

        try {
            // 1. 加载本地PixiJS
            await loadScript('/js/lib/pixi.min.js');
            loadingEl.innerHTML = '<div class="spinner"></div><span>加载引擎...</span>';
            
            // 2. 加载本地Cubism Core
            await loadScript('/js/lib/live2dcubismcore.min.js');
            
            // 3. 加载本地pixi-live2d-display (尝试不同的版本)
            // 使用cubism4版本，它支持Cubism 3/4
            const pluginSrc = '/js/lib/pixi-live2d.min.js';
            await loadScript(pluginSrc);
            
            // 检查是否正确加载
            if (!window.PIXI.live2d) {
                // 尝试从全局变量查找
                console.log('PIXI:', window.PIXI);
                console.log('PIXI.live2d:', window.PIXI?.live2d);
                
                // 如果没有，尝试其他方式
                throw new Error('PIXI.live2d 未定义，请尝试使用图片模式');
            }
            
            // 注册插件
            if (window.PIXI.live2d && window.PIXI.live2d.Live2DModel) {
                // 插件已自动注册
            }

            loadingEl.innerHTML = '<div class="spinner"></div><span>加载模型...</span>';

            // 创建Pixi应用
            const app = new PIXI.Application({
                width: config.canvasWidth,
                height: config.canvasHeight,
                backgroundAlpha: 0,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });

            container.appendChild(app.view);

            // 加载Live2D模型
            const model = await PIXI.live2d.Live2DModel.from(config.modelPath);

            app.stage.addChild(model);

            // 设置位置和缩放
            model.scale.set(config.scale);
            model.x = config.posX;
            model.y = config.posY;
            model.anchor.set(0.5, 0);

            window._live2dModel = model;
            loadingEl.remove();

            console.log('[Live2D] 模型加载成功!');

            // 鼠标跟随
            document.addEventListener('mousemove', (e) => {
                if (model.focus) model.focus(e.clientX, e.clientY);
            });

            // 点击交互
            app.view.addEventListener('click', () => {
                try {
                    const motions = Object.keys(model.internalModel?.settings?.motions || {});
                    if (motions.length > 0) {
                        const randomMotion = motions[Math.floor(Math.random() * motions.length)];
                        if (model.motion) model.motion(randomMotion);
                    }
                } catch(e) {}
                
                const msg = messages[Math.floor(Math.random() * messages.length)];
                showMessage(msg);
            });

            createToggle(container);

            // 开场白
            setTimeout(() => showMessage(messages[0]), 2000);

        } catch (e) {
            console.error('[Live2D] 加载失败:', e);
            loadingEl.innerHTML = '<span>渲染引擎不支持，切换图片模式...</span>';
            
            // 回退到图片模式
            setTimeout(() => {
                loadingEl.remove();
                initImageMode(container);
            }, 1500);
        }
    }

    // 图片模式（回退方案）
    function initImageMode(container) {
        const img = document.createElement('img');
        img.id = 'live2d-img';
        img.src = '/live2d/Murasame.4096/texture_00.png';
        img.crossOrigin = 'anonymous';
        img.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            max-width: 120%;
            max-height: 120%;
            clip-path: polygon(0 0, 100% 0, 100% 67%, 0 67%);
            pointer-events: auto;
            cursor: pointer;
            transition: transform 0.15s ease-out;
            animation: breathe 3s ease-in-out infinite;
        `;
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes breathe {
                0%, 100% { transform: translateX(-50%) scale(1); }
                50% { transform: translateX(-50%) scale(1.02); }
            }
        `;
        document.head.appendChild(style);
        
        container.appendChild(img);
        
        // 交互
        let isHover = false;
        img.addEventListener('mouseenter', () => isHover = true);
        img.addEventListener('mouseleave', () => isHover = false);
        img.addEventListener('click', () => {
            const msg = messages[Math.floor(Math.random() * messages.length)];
            showMessage(msg);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isHover) return;
            const centerX = window.innerWidth / 2;
            const offset = ((e.clientX - centerX) / centerX) * 15;
            img.style.transform = `translateX(calc(-50% + ${offset}px)) scale(1.03)`;
        });
        
        createToggle(container);
        setTimeout(() => showMessage(messages[0]), 2000);
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
