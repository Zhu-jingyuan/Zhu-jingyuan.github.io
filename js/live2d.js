/**
 * Live2D 看板娘 - 丛雨
 * 使用 pixi-live2d-display 引擎
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
        `;
        document.head.appendChild(style);
    }

    // 加载脚本 - 支持多个CDN回退
    async function loadScript(urls) {
        let lastError = null;
        
        for (const url of urls) {
            try {
                await new Promise((resolve, reject) => {
                    if (document.querySelector(`script[src="${url}"]`)) {
                        resolve();
                        return;
                    }
                    const s = document.createElement('script');
                    s.src = url;
                    s.crossOrigin = 'anonymous';
                    s.onload = resolve;
                    s.onerror = () => reject(new Error(url));
                    document.head.appendChild(s);
                });
                console.log('[Live2D] 加载成功:', url);
                return true;
            } catch (e) {
                console.warn('[Live2D] 加载失败:', url);
                lastError = e;
            }
        }
        throw lastError || new Error('所有CDN都加载失败');
    }

    // 初始化
    async function init() {
        createStyles();

        const container = document.createElement('div');
        container.id = 'live2d-widget';
        document.body.appendChild(container);

        try {
            // CDN列表（按优先级）
            const cdnList = {
                // PixiJS
                pixi: [
                    'https://cdn.jsdelivr.net/npm/pixi.js@7.3.2/dist/browser/pixi.min.js',
                    'https://unpkg.com/pixi.js@7.3.2/dist/browser/pixi.min.js',
                    'https://cdn.bootcdn.net/ajax/libs/pixi.js/7.3.2/pixi.min.js'
                ],
                // Cubism Core
                cubism: [
                    'https://cdn.jsdelivr.net/npm/live2d-cubismcore@3.3.1/live2dcubismcore.min.js',
                    'https://unpkg.com/live2d-cubismcore@3.3.1/live2dcubismcore.min.js'
                ],
                // pixi-live2d-display (使用cubism4版本支持Cubism3)
                plugin: [
                    'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js',
                    'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js',
                    'https://unpkg.com/pixi-live2d-display@0.4.0/dist/cubism4.min.js'
                ]
            };

            // 加载PixiJS
            await loadScript(cdnList.pixi);
            
            // 加载Cubism Core
            await loadScript(cdnList.cubism);
            
            // 加载pixi-live2d-display
            await loadScript(cdnList.plugin);

            // 等待DOM加载完成
            await new Promise(resolve => {
                if (document.readyState === 'complete') resolve();
                else window.addEventListener('load', resolve);
            });

            // 创建Pixi应用
            const app = new PIXI.Application({
                width: config.canvasWidth,
                height: config.canvasHeight,
                backgroundAlpha: 0,
                antialias: true,
                resolution: Math.min(window.devicePixelRatio, 2),
                autoDensity: true
            });

            container.appendChild(app.view);

            // 加载模型
            const model = await PIXI.live2d.Live2DModel.from(config.modelPath);

            app.stage.addChild(model);

            // 设置位置
            model.scale.set(config.scale);
            model.x = config.posX;
            model.y = config.posY;
            model.anchor.set(0.5, 0);

            window._live2dModel = model;
            console.log('[Live2D] 丛雨加载成功!');

            // 鼠标跟随
            document.addEventListener('mousemove', (e) => {
                if (model.focus) model.focus(e.clientX, e.clientY);
            });

            // 点击交互
            app.view.addEventListener('click', () => {
                try {
                    const motions = model.internalModel?.settings?.motions || {};
                    const motionNames = Object.keys(motions);
                    if (motionNames.length > 0) {
                        const randomMotion = motionNames[Math.floor(Math.random() * motionNames.length)];
                        model.motion && model.motion(randomMotion);
                    }
                } catch(e) {}
                
                const msg = messages[Math.floor(Math.random() * messages.length)];
                showMessage(msg);
            });

            // 开场白
            setTimeout(() => showMessage(messages[0]), 2000);

        } catch (e) {
            console.error('[Live2D] 加载失败:', e);
            // 引擎加载失败，移除容器
            container.remove();
            return;
        }

        // 创建开关按钮
        const btn = document.createElement('div');
        btn.id = 'live2d-toggle';
        btn.textContent = '🌸';
        btn.title = '显示/隐藏看板娘';
        let visible = true;
        btn.onclick = (e) => {
            e.stopPropagation();
            visible = !visible;
            container.style.display = visible ? 'block' : 'none';
            btn.textContent = visible ? '🌸' : '👋';
        };
        document.body.appendChild(btn);
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

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
