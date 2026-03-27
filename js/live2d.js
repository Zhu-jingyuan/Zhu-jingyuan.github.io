/**
 * Live2D 看板娘 - 丛雨
 * 依赖：/js/lib/live2dcubismcore.min.js (Cubism Core)
 *       /js/lib/live2d-bundle.js (PIXI + pixi-live2d-display)
 */

(function () {
    'use strict';

    const MODEL_PATH = '/live2d/Murasame.model3.json';
    // canvas 宽高（实际渲染尺寸）
    const CANVAS_W = 300;
    const CANVAS_H = 550;

    const MESSAGES = [
        '吾名丛雨，乃是这"丛雨丸"的管理者……',
        '你，就是本座的主人？',
        '早上好，主人！今天也要加油~',
        '本座才不是幽灵！完全不是！',
        '在这里，这里哦~',
        '主人今天也要加油！',
        '本座不是幻觉，更不是幽灵，主人！',
        '有什么烦恼可以和本座说哦~',
        '欢迎来到主人的博客！',
        '点击本座试试？'
    ];

    // 加载脚本（Promise封装）
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve(); return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.crossOrigin = 'anonymous';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Script load failed: ' + src));
            document.head.appendChild(s);
        });
    }

    // 创建样式
    function createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #live2d-widget {
                position: fixed;
                bottom: 0;
                right: 20px;
                width: ${CANVAS_W}px;
                height: ${CANVAS_H}px;
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
                width: 44px;
                height: 44px;
                background: linear-gradient(135deg, #a18cd1, #fbc2eb);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 100000;
                font-size: 22px;
                box-shadow: 0 4px 15px rgba(161,140,209,0.6);
                transition: transform 0.2s, box-shadow 0.2s;
                user-select: none;
            }
            #live2d-toggle:hover {
                transform: scale(1.15);
                box-shadow: 0 6px 20px rgba(161,140,209,0.8);
            }
            #live2d-msg {
                position: fixed;
                bottom: ${CANVAS_H + 15}px;
                right: 25px;
                background: rgba(255,255,255,0.96);
                padding: 10px 16px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.12);
                max-width: 230px;
                font-size: 13px;
                line-height: 1.7;
                color: #444;
                opacity: 0;
                transform: translateY(6px);
                transition: opacity 0.35s, transform 0.35s;
                z-index: 100001;
                pointer-events: none;
                border-left: 3px solid #a18cd1;
            }
            #live2d-msg.show {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }

    // 显示消息气泡
    let msgTimer = null;
    function showMessage(text, duration) {
        duration = duration || 5000;
        let el = document.getElementById('live2d-msg');
        if (!el) {
            el = document.createElement('div');
            el.id = 'live2d-msg';
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(msgTimer);
        msgTimer = setTimeout(() => el.classList.remove('show'), duration);
    }

    // 主初始化
    async function init() {
        createStyles();

        const container = document.createElement('div');
        container.id = 'live2d-widget';
        document.body.appendChild(container);

        try {
            // 1. 加载 Cubism Core（必须在 bundle 之前）
            await loadScript('/js/lib/live2dcubismcore.min.js');
            console.log('[Live2D] Cubism Core loaded, Live2DCubismCore:', typeof window.Live2DCubismCore);

            // 2. 加载打包好的 PIXI + pixi-live2d-display bundle
            await loadScript('/js/lib/live2d-bundle.js');
            console.log('[Live2D] Bundle loaded, PIXI:', typeof window.PIXI, 'live2d:', typeof window.PIXI?.live2d);

            // 确认加载成功
            if (!window.PIXI || !window.PIXI.live2d || !window.PIXI.live2d.Live2DModel) {
                throw new Error('PIXI.live2d.Live2DModel 未定义，bundle加载失败');
            }

            // 3. 创建 Pixi Application
            const app = new PIXI.Application({
                width: CANVAS_W,
                height: CANVAS_H,
                backgroundAlpha: 0,
                transparent: true,
                antialias: true,
                resolution: Math.min(window.devicePixelRatio || 1, 2),
                autoDensity: true
            });
            container.appendChild(app.view);

            // 4. 加载 Live2D 模型
            console.log('[Live2D] Loading model from:', MODEL_PATH);
            const model = await PIXI.live2d.Live2DModel.from(MODEL_PATH, {
                onError: (e) => console.error('[Live2D] Model error:', e)
            });
            console.log('[Live2D] Model loaded:', model);

            app.stage.addChild(model);

            // 5. 调整模型大小和位置（填满 canvas，完整显示全身）
            const scaleX = CANVAS_W / model.width;
            const scaleY = CANVAS_H / model.height;
            const scale = Math.min(scaleX, scaleY);
            model.scale.set(scale);
            // 水平居中，垂直从顶部开始（完整全身）
            model.anchor.set(0.5, 0);
            model.x = CANVAS_W / 2;
            model.y = 0;

            window._live2dModel = model;
            console.log('[Live2D] 丛雨加载成功！');

            // 6. 鼠标跟随（视线追踪）
            document.addEventListener('mousemove', (e) => {
                if (model.focus) model.focus(e.clientX, e.clientY);
            });

            // 7. 点击交互
            app.view.addEventListener('click', () => {
                // 触发随机动作
                try {
                    const motions = model.internalModel?.settings?.motions || {};
                    const keys = Object.keys(motions);
                    if (keys.length > 0) {
                        const key = keys[Math.floor(Math.random() * keys.length)];
                        model.motion(key);
                    }
                } catch (e) {}
                // 显示随机对话
                showMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
            });

            // 8. 开场白
            setTimeout(() => showMessage('欢迎来到主人的博客！本座在此等候~', 6000), 2000);

            // 9. 开关按钮（在加载成功后才添加）
            const btn = document.createElement('div');
            btn.id = 'live2d-toggle';
            btn.innerHTML = '🌸';
            btn.title = '显示/隐藏看板娘';
            let visible = true;
            btn.onclick = (e) => {
                e.stopPropagation();
                visible = !visible;
                container.style.display = visible ? 'block' : 'none';
                btn.innerHTML = visible ? '🌸' : '👋';
            };
            document.body.appendChild(btn);

        } catch (e) {
            console.error('[Live2D] 加载失败，已跳过看板娘:', e.message || e);
            container.remove();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }
})();
