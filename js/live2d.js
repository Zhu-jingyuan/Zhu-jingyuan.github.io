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

    // 小屏幕检测（手机/窄屏不加载看板娘，省流量省性能）
    const MOBILE_BREAKPOINT = 768;  // px，低于此宽度视为移动端

    function isMobile() {
        return window.innerWidth < MOBILE_BREAKPOINT;
    }

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
                left: 20px;
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
            /* 语音/对话开关按钮 - 最左下角贴底 */
            #live2d-toggle {
                position: fixed;
                bottom: 10px;
                left: 10px;
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
            /* 对话气泡 - 看板娘正上方 */
            #live2d-msg {
                position: fixed;
                bottom: ${SHOW_H + 12}px;
                left: 20px;
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
            /* 小屏幕（手机/平板竖屏）自动隐藏看板娘 */
            @media (max-width: 768px) {
                #live2d-widget,
                #live2d-toggle,
                #live2d-msg {
                    display: none !important;
                }
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

    // 眼睛/头部追踪 —— 终极方案 v3
    //
    // pixi-live2d-display 帧循环（已从源码确认）：
    //   motionManager.update(coreModel)  → motion关键帧写入 coreModel._parameterValues
    //   coreModel.saveParameters()       → coreModel内部备份（coreModel自己的_savedParameters）
    //   expressionManager / eyeBlink / updateFocus / physics / pose
    //   emit("beforeModelUpdate")
    //   coreModel.update()               → 渲染
    //   coreModel.loadParameters()       → 从coreModel内部备份恢复 _parameterValues
    //
    // 问题根源：coreModel.saveParameters/loadParameters 操作的是 coreModel 原生内部状态，
    //           我们直接写 core._savedParameters 并不能影响这个原生状态。
    //
    // 正确方案：hook coreModel.loadParameters，在原始恢复完成后，
    //           立即把我们需要控制的参数强制覆写，保证最终写入渲染管线的值是我们的。
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
        const pv = core._parameterValues;  // Float32Array，直接引用，每帧读这个渲染

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
                pupilL:       core.getParameterIndex('ParamYanZhuSuoFangL'),
                pupilR:       core.getParameterIndex('ParamYanZhuSuoFangR'),
                highlightL:   core.getParameterIndex('ParamGaoGguangL'),
                highlightR:   core.getParameterIndex('ParamGaoGuangR'),
            };
            console.log('[Live2D] indices:', JSON.stringify(indices));
        }

        // 核心写入函数：把我们的值强制覆写到 pv（_parameterValues Float32Array）
        function applyParams() {
            if (!pv || !indices) return;

            // 瞳孔锁定：无论任何情况都要写，防止motion驱动瞳孔收缩
            const safe = (idx, val) => {
                if (idx >= 0 && idx < pv.length) pv[idx] = val;
            };
            safe(indices.pupilL,     0);
            safe(indices.pupilR,     0);
            safe(indices.highlightL, 0);
            safe(indices.highlightR, 0);

            // 头部/眼球：动作播放期间让位
            if (!isMotionPlaying) {
                safe(indices.angleX,  curX  *  30);
                safe(indices.angleY, -curY  *  30);
                safe(indices.angleZ,  curX  * -10);
                safe(indices.eyeX,    curX);
                safe(indices.eyeY,   -curY);
                safe(indices.bodyX,   curX  *  10);
                safe(indices.bodyY,  -curY  *  10);
            }
        }

        // Hook coreModel.loadParameters —— 它执行后立即强制覆写
        // 这是最后防线：无论 saveParameters 备份了什么值，loadParameters 恢复后我们立刻改掉
        const _origLoad = core.loadParameters.bind(core);
        core.loadParameters = function() {
            _origLoad();       // 先让原始逻辑执行（恢复 motion 的值）
            applyParams();     // 然后立即把我们的值覆盖上去
        };

        // beforeModelUpdate：在 coreModel.update()（渲染）之前执行，这里是覆盖参数的正确时机
        // 帧循环真实顺序：motionManager.update → saveParameters → [此事件] → coreModel.update(渲染) → loadParameters
        // 必须在这里写 pv，才能让渲染看到我们的值。loadParameters hook 作为双重保险。
        model.internalModel.on('beforeModelUpdate', () => {
            curX += (targetX - curX) * smooth;
            curY += (targetY - curY) * smooth;
            try {
                ensureIndices();
                applyParams();  // 在渲染前强制覆写参数（覆盖 motion 关键帧写入的瞳孔值等）
            } catch(_) {}
        });
    }

    // 主初始化
    async function init() {
        // 移动端/小屏幕不加载看板娘（节省流量和性能）
        if (isMobile()) {
            console.log('[Live2D] 检测到小屏幕（宽度 < ' + MOBILE_BREAKPOINT + 'px），跳过看板娘加载');
            return;
        }

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
            // 禁用 eyeBlink（眨眼写 ParamEyeLOpen，该参数通过 .moc3 内部参数绑定联动驱动瞳孔
            // 缩放参数 ParamYanZhuSuoFang，导致每次眨眼时瞳孔收缩，无法从参数层面修复）
            try {
                // 覆盖 updateFocus 为空函数
                model.internalModel.updateFocus = function () {};
                // 禁用 eyeBlink（彻底断开眨眼→瞳孔收缩的联动）
                const eyeBlink = model.internalModel.eyeBlink;
                if (eyeBlink) {
                    // 方案1：直接置空 update 方法
                    if (typeof eyeBlink.update === 'function') {
                        eyeBlink.update = function () {};
                    }
                    // 方案2：将 eyeBlink 引用置 null（部分版本通过 eyeBlink?.update 调用）
                    model.internalModel.eyeBlink = null;
                }
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

            // 预加载所有 motion 文件的时长（秒），存入 Map，点击时直接查，避免每次 fetch
            const motionDurationMap = new Map(); // key: "motion/motionXX.motion3.json", value: seconds
            try {
                const allMotions = Object.values(model.internalModel?.settings?.motions || {}).flat();
                await Promise.all(allMotions.map(async (m) => {
                    if (!m?.File) return;
                    try {
                        const resp = await fetch('/live2d/' + m.File);
                        const mj = await resp.json();
                        if (mj?.Meta?.Duration) motionDurationMap.set(m.File, mj.Meta.Duration);
                    } catch (_) {}
                }));
                console.log('[Live2D] 预加载 motion 时长完成，共', motionDurationMap.size, '条');
            } catch (_) {}

            // ===== 调试：打印关键状态 =====
            try {
                const dbgCore = model.internalModel.coreModel;
                const pv = dbgCore._parameterValues;
                const idxEyeLOpen  = dbgCore.getParameterIndex('ParamEyeLOpen');
                const idxEyeROpen  = dbgCore.getParameterIndex('ParamEyeROpen');
                const idxPupilL    = dbgCore.getParameterIndex('ParamYanZhuSuoFangL');
                const idxPupilR    = dbgCore.getParameterIndex('ParamYanZhuSuoFangR');
                console.log('[DBG] eyeBlink after disable:', model.internalModel.eyeBlink);
                console.log('[DBG] ParamEyeLOpen idx:', idxEyeLOpen, ' ParamEyeROpen idx:', idxEyeROpen);
                console.log('[DBG] PupilL idx:', idxPupilL, ' PupilR idx:', idxPupilR);
                // 每隔200ms打印一次眼睛参数，持续4秒，观察是否有变化
                let dbgCount = 0;
                const dbgTimer = setInterval(() => {
                    if (++dbgCount > 20) { clearInterval(dbgTimer); return; }
                    console.log('[DBG frame]',
                        'EyeLOpen=', pv[idxEyeLOpen]?.toFixed(3),
                        'EyeROpen=', pv[idxEyeROpen]?.toFixed(3),
                        'PupilL=',   pv[idxPupilL]?.toFixed(3),
                        'PupilR=',   pv[idxPupilR]?.toFixed(3)
                    );
                }, 200);
            } catch(e) { console.warn('[DBG] 失败', e); }
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
                let soundSrc = null, text = null, motionGroupKey = null, pickedFile = null;
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
                        if (picked.File) pickedFile = picked.File; // 记录文件路径，用于查询时长
                        motionGroupKey = groupKey || Object.keys(motions).find(k => motions[k].includes(picked)) || Object.keys(motions)[0];
                    }
                } catch (_) {}

                // 随机消息兜底
                if (!text) text = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

                playSound(soundSrc);
                showMessage(text);

                // 触发动作，期间暂停鼠标追踪；动作播完后强制回到 Idle 清除残留表情
                if (motionGroupKey) {
                    // 直接从预加载缓存查询动作时长（秒）
                    const motionDuration = (pickedFile && motionDurationMap.get(pickedFile)) || 6;

                    try {
                        isMotionPlaying = true;
                        model.motion(motionGroupKey); // 触发动作（不 await，Promise 在动作开始时就 resolve）
                    } catch (_) {}

                    // 等待动作实际播完再复原（+300ms 缓冲，避免 Idle 截断末帧）
                    await new Promise(r => setTimeout(r, motionDuration * 1000 + 300));
                    isMotionPlaying = false;

                    // 高优先级播放 Idle，强制打断任何残留动作，让表情复原
                    try { model.motion('Idle', 0, 2); } catch (_) {}
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
