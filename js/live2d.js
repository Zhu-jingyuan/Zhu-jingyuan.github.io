/**
 * Live2D 看板娘 - 丛雨
 * 使用 pixi-live2d-display + PixiJS 渲染
 * 优化CDN源，适配国内访问
 */

(function () {
    'use strict';

    const config = {
        modelPath: '/live2d/Murasame.model3.json',
        canvasWidth: 300,
        canvasHeight: 450,
        showRatio: 0.67,
        scale: 0.28,
        posX: 150,
        posY: 60
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

    // CDN列表（按优先级排列）
    const cdnSources = {
        // PixiJS
        pixi: [
            'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
            'https://unpkg.com/pixi.js@6.5.10/dist/browser/pixi.min.js',
            'https://cdn.bootcdn.net/ajax/libs/pixi.js/6.5.10/pixi.min.js'
        ],
        // Cubism Core
        cubism: [
            'https://cdn.jsdelivr.net/npm/live2d-cubismcore@3.3.1/live2dcubismcore.min.js',
            'https://unpkg.com/live2d-cubismcore@3.3.1/live2dcubismcore.min.js',
            'https://cdn.bootcdn.net/ajax/libs/live2d-cubismcore/3.3.1/live2dcubismcore.min.js'
        ],
        // pixi-live2d-display
        plugin: [
            'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js',
            'https://unpkg.com/pixi-live2d-display@0.4.0/dist/index.min.js'
        ]
    };

    // 注入样式
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
                transition: transform 0.2s, box-shadow 0.2s;
                user-select: none;
            }
            #live2d-toggle:hover {
                transform: scale(1.12);
                box-shadow: 0 6px 20px rgba(102,126,234,0.7);
            }
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
            #live2d-msg.show {
                opacity: 1;
                transform: translateY(0);
            }
            #live2d-loading {
                position: fixed;
                bottom: 80px;
                right: 80px;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 12px;
                z-index: 100000;
            }
        `;
        document.head.appendChild(style);
    }

    // 尝试加载脚本（尝试多个CDN）
    async function loadScriptWithFallback(urls) {
        let lastError = null;
        
        for (const url of urls) {
            try {
                await loadScript(url);
                console.log('[Live2D] 加载成功:', url);
                return;
            } catch (e) {
                console.warn('[Live2D] 加载失败:', url, e.message);
                lastError = e;
            }
        }
        throw lastError || new Error('所有CDN都加载失败');
    }

    // 加载单个脚本
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.crossOrigin = 'anonymous';
            s.onload = resolve;
            s.onerror = () => reject(new Error(src));
            document.head.appendChild(s);
        });
    }

    // 主逻辑
    async function init() {
        createStyles();

        // 显示加载提示
        const loadingEl = document.createElement('div');
        loadingEl.id = 'live2d-loading';
        loadingEl.textContent = 'Loading...';
        document.body.appendChild(loadingEl);

        // 创建容器
        const container = document.createElement('div');
        container.id = 'live2d-widget';
        document.body.appendChild(container);

        try {
            // 1. 加载 PixiJS
            await loadScriptWithFallback(cdnSources.pixi);
            
            // 2. 加载 Cubism Core
            await loadScriptWithFallback(cdnSources.cubism);
            
            // 3. 加载 pixi-live2d-display
            await loadScriptWithFallback(cdnSources.plugin);

            loadingEl.textContent = '加载模型...';

            // 必须暴露到全局
            window.PIXI = window.PIXI || PIXI;

            // 4. 创建 Pixi 应用
            const app = new PIXI.Application({
                width: config.canvasWidth,
                height: config.canvasHeight,
                backgroundAlpha: 0,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });

            container.appendChild(app.view);

            // 5. 加载模型
            const model = await PIXI.live2d.Live2DModel.from(config.modelPath, {
                autoInteract: false
            });

            app.stage.addChild(model);

            // 设置大小和位置
            model.scale.set(config.scale);
            model.x = config.posX;
            model.y = config.posY;
            model.anchor.set(0.5, 0);

            window._live2dModel = model;
            loadingEl.remove();

            // 6. 鼠标跟随
            document.addEventListener('mousemove', (e) => {
                model.focus && model.focus(e.clientX, e.clientY);
            });

            // 7. 点击触发
            app.view.addEventListener('click', () => {
                const motionGroups = Object.keys(model.internalModel?.settings?.motions || {});
                if (motionGroups.length > 0) {
                    const group = motionGroups[Math.floor(Math.random() * motionGroups.length)];
                    model.motion && model.motion(group);
                }
                const msg = messages[Math.floor(Math.random() * messages.length)];
                showMessage(msg);
            });

            // 8. 开关按钮
            createToggle(container);

            // 9. 开场白
            setTimeout(() => showMessage(messages[0]), 2000);

            console.log('[Live2D] 初始化成功!');

        } catch (e) {
            console.error('[Live2D] 加载失败:', e);
            loadingEl.textContent = '加载失败';
            setTimeout(() => loadingEl.remove(), 3000);
        }
    }

    // 显示消息
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

    // 开关
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

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
