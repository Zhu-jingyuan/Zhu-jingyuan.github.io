/**
 * Live2D 看板娘 - 丛雨
 * 依赖：/js/lib/live2dcubismcore.min.js (Cubism Core)
 *       /js/lib/live2d-bundle.js (PIXI + pixi-live2d-display)
 */

(function () {
    'use strict';

    const MODEL_PATH = '/live2d/Murasame.model3.json';
    const CANVAS_W = 300;
    const CANVAS_H = 550;
    const SHOW_H = Math.floor(CANVAS_H * 3 / 5);  // 只露上半 3/5

    // 语音/对话开关状态（默认关闭），从 localStorage 读取
    let voiceEnabled = localStorage.getItem('live2d_voice') === 'true';

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
                height: ${SHOW_H}px;
                overflow: hidden;
                z-index: 99999;
                pointer-events: none;
            }
            #live2d-widget canvas {
                position: absolute;
                top: 0;
                left: 0;
                pointer-events: auto;
                cursor: pointer;
            }
            /* 语音/对话开关按钮 */
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
                font-size: 20px;
                box-shadow: 0 4px 15px rgba(161,140,209,0.6);
                transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
                user-select: none;
                opacity: 0.5;
            }
            #live2d-toggle.active {
                opacity: 1;
                box-shadow: 0 4px 20px rgba(161,140,209,0.9);
            }
            #live2d-toggle:hover {
                transform: scale(1.15);
                box-shadow: 0 6px 20px rgba(161,140,209,0.8);
            }
            /* 对话气泡 */
            #live2d-msg {
                position: fixed;
                bottom: ${SHOW_H + 15}px;
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

    // 当前播放的音频
    let currentAudio = null;
    let msgTimer = null;

    // 显示对话气泡（受开关控制）
    function showMessage(text, duration) {
        if (!voiceEnabled) return;
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

    // 播放音频（受开关控制）
    function playSound(src) {
        if (!voiceEnabled) return;
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        currentAudio = new Audio(src);
        currentAudio.volume = 0.8;
        currentAudio.play().catch(() => {});
    }

    // 眼睛/头部追踪 —— 终极方案
    //
    // pixi-live2d-display 每帧 update() 调用链：
    //   motionManager.update()   → 动作关键帧写参数
    //   saveParameters()         → 备份当前参数
    //   expressionManager / eyeBlink / updateFocus / physics / pose ...
    //   emit("beforeModelUpdate")  ← ★ 我们在这里写参数
    //   model.update()           → Cubism Core 渲染（读此刻的 _parameterValues）
    //   model.loadParameters()   → 把 savedParameters 写回（已经渲染完，不影响）
    //
    // 在 "beforeModelUpdate" 事件里直接调 setParameterValueById（weight=1 = 直接赋值），
    // 此时动作已跑完、loadParameters 还没执行，值会被 model.update() 读到并渲染。
    function setupMouseTracking(model, canvas) {
        let targetX = 0, targetY = 0;
        let curX = 0, curY = 0;
        const smooth = 0.08;

        document.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            targetX = Math.max(-1, Math.min(1,
                (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)));
            targetY = Math.max(-1, Math.min(1,
                (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)));
        });

        const core = model.internalModel.coreModel;

        // 在 Cubism Core model.update() 前一刻写入参数
        model.internalModel.on('beforeModelUpdate', () => {
            curX += (targetX - curX) * smooth;
            curY += (targetY - curY) * smooth;

            core.setParameterValueById('ParamAngleX',     curX  *  30);
            core.setParameterValueById('ParamAngleY',    -curY  *  30);
            core.setParameterValueById('ParamAngleZ',     curX  * -10);
            core.setParameterValueById('ParamEyeBallX',   curX);
            core.setParameterValueById('ParamEyeBallY',  -curY);
            core.setParameterValueById('ParamBodyAngleX', curX  *  10);
            core.setParameterValueById('ParamBodyAngleY',-curY  *  10);
        });
    }

    // 主初始化
    async function init() {
        createStyles();

        const container = document.createElement('div');
        container.id = 'live2d-widget';
        document.body.appendChild(container);

        try {
            // 1. 加载 Cubism Core
            await loadScript('/js/lib/live2dcubismcore.min.js');
            // 2. 加载 PIXI + pixi-live2d-display bundle
            await loadScript('/js/lib/live2d-bundle.js');

            if (!window.PIXI || !window.PIXI.live2d || !window.PIXI.live2d.Live2DModel) {
                throw new Error('PIXI.live2d.Live2DModel 未定义');
            }

            // 3. 创建 Pixi Application
            const app = new PIXI.Application({
                width: CANVAS_W,
                height: CANVAS_H,
                backgroundAlpha: 0,
                transparent: true,
                antialias: true,
                resolution: Math.min(window.devicePixelRatio || 1, 2),
                autoDensity: true,
            });
            container.appendChild(app.view);

            // 4. 加载模型
            const model = await PIXI.live2d.Live2DModel.from(MODEL_PATH, {
                onError: (e) => console.error('[Live2D] Model error:', e),
                autoInteract: false,   // 关闭内置交互，避免和自定义冲突
            });

            app.stage.addChild(model);

            // 5. 缩放与定位（顶部对齐，头部在上，底部被容器裁掉）
            const scale = Math.min(CANVAS_W / model.width, CANVAS_H / model.height);
            model.scale.set(scale);
            model.anchor.set(0.5, 0);
            model.x = CANVAS_W / 2;
            model.y = 0;

            // 禁用内置 updateFocus（它用 addParameterValueById 叠加写 EyeBall/Angle，
            // 会和我们的 beforeModelUpdate 事件里的写入产生顺序依赖，直接置空）
            // 禁用 Idle 自动循环（motion01 含 EyeBall/Angle 关键帧，会被 beforeModelUpdate 覆盖，
            // 但 loadParameters 之后 Idle 仍会反复触发，保险起见也禁用）
            try {
                // 覆盖 updateFocus 为空函数
                model.internalModel.updateFocus = function () {};
                // 禁用 Idle 重新触发
                const mm = model.internalModel.motionManager;
                if (mm) {
                    if (mm.idleTimeoutSeconds !== undefined) mm.idleTimeoutSeconds = Infinity;
                    const _origStart = mm.startRandomMotion?.bind(mm);
                    if (_origStart) {
                        mm.startRandomMotion = function (group, priority) {
                            if (group && group.toLowerCase() === 'idle') return false;
                            return _origStart(group, priority);
                        };
                    }
                }
            } catch (_) {}

            window._live2dModel = model;
            console.log('[Live2D] 丛雨加载成功！');

            // 6. 眼睛/头部追踪（直接写参数，绕过 focus()）
            setupMouseTracking(model, app.view);

            // 7. 点击交互（触发对应区域动作+音效+对话）
            app.view.addEventListener('click', (e) => {
                const rect = app.view.getBoundingClientRect();
                // 点击坐标转换为模型局部坐标
                const localX = (e.clientX - rect.left) / (rect.width / CANVAS_W);
                const localY = (e.clientY - rect.top) / (rect.height / CANVAS_H);

                // 检测命中区域
                let hitMotionGroup = null;
                try {
                    const hitAreas = model.internalModel?.settings?.hitAreas || [];
                    for (const area of hitAreas) {
                        if (model.hitTest(area.name, localX, localY)) {
                            hitMotionGroup = area.motion || area.name;
                            break;
                        }
                    }
                } catch (_) {}

                // 找出对应动作（含音效和文本）
                let soundSrc = null, text = null;
                try {
                    const motions = model.internalModel?.settings?.motions || {};
                    const groupKey = hitMotionGroup
                        ? Object.keys(motions).find(k => k.toLowerCase() === ('tap' + hitMotionGroup).toLowerCase() || k.toLowerCase() === hitMotionGroup.toLowerCase())
                        : null;
                    const group = groupKey ? motions[groupKey] : null;
                    const list = group && group.length ? group : Object.values(motions).flat();
                    const picked = list[Math.floor(Math.random() * list.length)];
                    if (picked) {
                        if (picked.Sound) soundSrc = '/live2d/' + picked.Sound;
                        if (picked.Text) text = picked.Text;
                        // 触发动作
                        const gk = groupKey || Object.keys(motions).find(k => motions[k].includes(picked)) || Object.keys(motions)[0];
                        if (gk) model.motion(gk);
                    }
                } catch (_) {}

                // 随机消息兜底
                if (!text) text = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

                playSound(soundSrc);
                showMessage(text);
            });

            // 8. 语音/对话开关按钮
            const btn = document.createElement('div');
            btn.id = 'live2d-toggle';
            btn.title = voiceEnabled ? '关闭语音与对话' : '开启语音与对话';
            btn.innerHTML = '🔊';
            if (voiceEnabled) btn.classList.add('active');

            btn.onclick = (e) => {
                e.stopPropagation();
                voiceEnabled = !voiceEnabled;
                localStorage.setItem('live2d_voice', voiceEnabled);
                btn.classList.toggle('active', voiceEnabled);
                btn.title = voiceEnabled ? '关闭语音与对话' : '开启语音与对话';
                if (!voiceEnabled) {
                    // 关闭时停止音频并隐藏气泡
                    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
                    const msg = document.getElementById('live2d-msg');
                    if (msg) msg.classList.remove('show');
                }
            };
            document.body.appendChild(btn);

        } catch (e) {
            console.error('[Live2D] 加载失败，已跳过看板娘:', e.message || e);
            container.remove();
        }
    }

    // 注册 Service Worker（缓存引擎和模型，二次加载无需重新下载）
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(
                () => console.log('[Live2D] Service Worker 注册成功'),
                (err) => console.warn('[Live2D] Service Worker 注册失败:', err)
            );
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }
})();
