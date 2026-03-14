/**
 * Live2D 看板娘 - 丛雨
 * 使用 pixi-live2d-display + PixiJS 完整渲染
 */

(function () {
    'use strict';

    const config = {
        modelPath: '/live2d/Murasame.model3.json',
        canvasWidth: 300,
        canvasHeight: 450,
        showRatio: 0.67,   // 只露出上半2/3
        scale: 0.28,
        posX: 150,         // 模型在canvas中的X坐标
        posY: 60           // 模型在canvas中的Y坐标（偏上）
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
        `;
        document.head.appendChild(style);
    }

    // 按顺序加载脚本
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // 防止重复加载
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.crossOrigin = 'anonymous';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed: ' + src));
            document.head.appendChild(s);
        });
    }

    // 主逻辑
    async function init() {
        createStyles();

        // 创建容器
        const container = document.createElement('div');
        container.id = 'live2d-widget';
        document.body.appendChild(container);

        try {
            // 1. 加载 PixiJS 6
            await loadScript('https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js');

            // 2. 加载 Cubism Core (官方SDK，支持Cubism3/4)
            await loadScript('https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js');

            // 3. 加载 pixi-live2d-display (支持Cubism3+4)
            await loadScript('https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js');

            // 必须暴露到全局
            window.PIXI = window.PIXI || PIXI;

            // 4. 创建 Pixi 应用
            const app = new PIXI.Application({
                width: config.canvasWidth,
                height: config.canvasHeight,
                backgroundAlpha: 0,   // 透明背景
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });

            container.appendChild(app.view);

            // 5. 加载模型
            const model = await PIXI.live2d.Live2DModel.from(config.modelPath, {
                autoInteract: false  // 手动处理交互
            });

            app.stage.addChild(model);

            // 设置大小和位置
            model.scale.set(config.scale);
            model.x = config.posX;
            model.y = config.posY;
            model.anchor.set(0.5, 0);

            // 保存引用
            window._live2dModel = model;

            // 6. 鼠标跟随
            document.addEventListener('mousemove', (e) => {
                const rect = app.view.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                model.focus(e.clientX, e.clientY);
            });

            // 7. 点击触发随机动作 + 对话
            app.view.addEventListener('click', () => {
                const motionGroups = Object.keys(model.internalModel.settings.motions || {});
                if (motionGroups.length > 0) {
                    const group = motionGroups[Math.floor(Math.random() * motionGroups.length)];
                    model.motion(group);
                }
                const msg = messages[Math.floor(Math.random() * messages.length)];
                showMessage(msg);
            });

            // 8. 开关按钮
            createToggle(container);

            // 9. 随机开场白
            setTimeout(() => {
                showMessage(messages[0]);
            }, 2000);

        } catch (e) {
            console.error('[Live2D] 加载失败:', e);
            // 失败则移除容器，不影响页面
            container.remove();
        }
    }

    // 显示气泡消息
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

    // 开关按钮
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
