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

    // 眼睛/头部追踪 —— 终极正确方案（基于源码分析）
    //
    // pixi-live2d-display Cubism4InternalModel.update() 每帧调用链：
    //   1. motionManager.update()      → 动作关键帧写入 _parameterValues
    //   2. saveParameters()            → _savedParameters = _parameterValues（备份动作值）
    //   3. expressionManager / eyeBlink / updateFocus / physics / pose
    //   4. emit("beforeModelUpdate")   ← 我们在这里写
    //   5. coreModel.update()          → Cubism Core 读 _parameterValues 渲染
    //   6. loadParameters()            → _parameterValues = _savedParameters（恢复动作值）
    //
    // 解决：在步骤4写参数时，同时覆盖 _savedParameters，
    //        这样步骤6恢复的是鼠标值，下一帧动作叠加基准不会被 Idle 重置。
    //
    // 点击动作优先：isMotionPlaying = true 期间不覆盖参数，让动作自由播放；
    //               平滑插值继续运行，动作结束后无缝衔接鼠标追踪。
    let isMotionPlaying = false;

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

        // 用官方 API 预缓存 index（只查一次）
        let indices = null;
        function ensureIndices() {
            if (indices) return;
            indices = {
                angleX:       core.getParameterIndex('ParamAngleX'),
                angleY:       core.getParameterIndex('ParamAngleY'),
                angleZ:       core.getParameterIndex('ParamAngleZ'),
                eyeX:         core.getParameterIndex('ParamEyeBallX'),
                eyeY:         core.getParameterIndex('ParamEyeBallY'),
                bodyX:        core.getParameterIndex('ParamBodyAngleX'),
                bodyY:        core.getParameterIndex('ParamBodyAngleY'),
                // 瞳孔缩放参数——motion 关键帧会驱动这两个参数造成瞳孔不断收缩，
                // 锁定为 0（静止默认值：不收缩也不扩张）
                pupilL:       core.getParameterIndex('ParamYanZhuSuoFangL'),
                pupilR:       core.getParameterIndex('ParamYanZhuSuoFangR'),
                // 高光参数同理，锁定为 0
                highlightL:   core.getParameterIndex('ParamGaoGguangL'),
                highlightR:   core.getParameterIndex('ParamGaoGuangR'),
            };
        }

        model.internalModel.on('beforeModelUpdate', () => {
            // 平滑插值始终运行（动作结束后可无缝衔接，不会突然跳位）
            curX += (targetX - curX) * smooth;
            curY += (targetY - curY) * smooth;

            try {
                ensureIndices();
                const pv = core._parameterValues;   // Float32Array（Cubism底层）
                const sp = core._savedParameters;   // 普通JS数组（saveParameters备份）

                // 瞳孔缩放和高光——无论动作是否在播放都要锁定，防止 motion 驱动瞳孔收缩
                const alwaysWrites = [
                    [indices.pupilL,     0],
                    [indices.pupilR,     0],
                    [indices.highlightL, 0],
                    [indices.highlightR, 0],
                ];
                for (const [idx, val] of alwaysWrites) {
                    if (idx < 0 || idx >= pv.length) continue;
                    pv[idx] = val;
                    if (sp && idx < sp.length) sp[idx] = val;
                }

                // 动作播放期间让位给动作，不强制覆盖头部/眼球方向参数
                if (isMotionPlaying) return;

                const writes = [
                    [indices.angleX,  curX  *  30],
                    [indices.angleY, -curY  *  30],
                    [indices.angleZ,  curX  * -10],
                    [indices.eyeX,    curX],
                    [indices.eyeY,   -curY],
                    [indices.bodyX,   curX  *  10],
                    [indices.bodyY,  -curY  *  10],
                ];
                for (const [idx, val] of writes) {
                    if (idx < 0 || idx >= pv.length) continue;
                    pv[idx] = val;                  // 当前帧供渲染
                    if (sp && idx < sp.length) sp[idx] = val; // 下帧基准
                }
            } catch (_) {}
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

            // ===== 调试：打印全部参数名和 index =====
            try {
                const core = model.internalModel.coreModel;
                const count = core.getParameterCount ? core.getParameterCount() : core._parameterValues.length;
                const names = [];
                for (let i = 0; i < count; i++) {
                    const id = core.getParameterId ? core.getParameterId(i) : ('param_' + i);
                    names.push(i + ': ' + id);
                }
                console.log('[Live2D DEBUG] 全部参数:\n' + names.join('\n'));

                // 监控 motionManager，每次有新 motion 开始时打印
                const mm = model.internalModel.motionManager;
                const _origStartMgr = mm.startMotion?.bind(mm);
                if (_origStartMgr) {
                    mm.startMotion = function(...args) {
                        console.log('[Live2D DEBUG] startMotion called, group/no:', args[0], args[1], 'priority:', args[2]);
                        console.trace();
                        return _origStartMgr(...args);
                    };
                }
                const _origRand = mm.startRandomMotion?.bind(mm);
                if (_origRand) {
                    mm.startRandomMotion = function(group, priority) {
                        console.log('[Live2D DEBUG] startRandomMotion:', group, priority);
                        console.trace();
                        return _origRand(group, priority);
                    };
                }

                // 每帧监控瞳孔参数变化
                let lastPupilL = 0;
                const pupilLIdx = core.getParameterIndex('ParamYanZhuSuoFangL');
                console.log('[Live2D DEBUG] ParamYanZhuSuoFangL index:', pupilLIdx);
                model.internalModel.on('beforeModelUpdate', () => {
                    const v = core._parameterValues[pupilLIdx];
                    if (Math.abs(v - lastPupilL) > 0.01) {
                        console.log('[Live2D DEBUG] 瞳孔L变化:', lastPupilL.toFixed(3), '->', v.toFixed(3));
                        lastPupilL = v;
                    }
                });
            } catch(e) { console.warn('[Live2D DEBUG] 调试初始化失败', e); }
            // ===== 调试结束 =====

            // 6. 眼睛/头部追踪（直接写参数，绕过 focus()）
            setupMouseTracking(model, app.view);

            // 7. 点击交互（触发对应区域动作+音效+对话）
            // 动作播放期间 isMotionPlaying=true，鼠标追踪让位；动作结束后自动恢复。
            app.view.addEventListener('click', async (e) => {
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
                let soundSrc = null, text = null, motionGroupKey = null;
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
                        motionGroupKey = groupKey || Object.keys(motions).find(k => motions[k].includes(picked)) || Object.keys(motions)[0];
                    }
                } catch (_) {}

                // 随机消息兜底
                if (!text) text = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

                playSound(soundSrc);
                showMessage(text);

                // 触发动作，期间暂停鼠标追踪覆盖
                if (motionGroupKey) {
                    try {
                        isMotionPlaying = true;
                        await model.motion(motionGroupKey);
                    } catch (_) {}
                    isMotionPlaying = false;
                }
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
