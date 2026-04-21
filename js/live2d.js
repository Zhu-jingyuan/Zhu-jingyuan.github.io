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
    // 显示上 3/4，canvas 整体下移 1/4（使头部对齐容器顶部）
    const SHOW_H   = Math.floor(CANVAS_H * 3 / 4);          // 412px 可见区域
    const OFFSET_Y = Math.floor(CANVAS_H / 4);               // 137px 向下偏移量（隐藏上 1/4）

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
                right: 0;
                width: ${CANVAS_W}px;
                height: ${SHOW_H}px;
                overflow: hidden;
                z-index: 1000;
                pointer-events: none;
            }
            #live2d-widget canvas {
                position: absolute;
                top: ${OFFSET_Y}px;
                left: 0;
                pointer-events: auto;
                cursor: pointer;
            }
            /* 小屏幕（手机/平板竖屏）自动隐藏看板娘 */
            @media (max-width: 768px) {
                #live2d-widget {
                    display: none !important;
                }
            }
        `;
        document.head.appendChild(style);
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
        const _origLoad = core.loadParameters.bind(core);
        core.loadParameters = function() {
            _origLoad();
            applyParams();
        };

        // beforeModelUpdate：在 coreModel.update()（渲染）之前执行
        model.internalModel.on('beforeModelUpdate', () => {
            curX += (targetX - curX) * smooth;
            curY += (targetY - curY) * smooth;
            try {
                ensureIndices();
                applyParams();
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
                autoInteract: false,
            });

            app.stage.addChild(model);

            // 5. 缩放与定位（顶部对齐，头部在上，底部被容器裁掉）
            const scale = Math.min(CANVAS_W / model.width, CANVAS_H / model.height);
            model.scale.set(scale);
            model.anchor.set(0.5, 0);
            model.x = CANVAS_W / 2;
            model.y = 0;

            // 禁用内置 updateFocus / eyeBlink / Idle 自动循环
            try {
                model.internalModel.updateFocus = function () {};
                const eyeBlink = model.internalModel.eyeBlink;
                if (eyeBlink) {
                    if (typeof eyeBlink.update === 'function') eyeBlink.update = function () {};
                    model.internalModel.eyeBlink = null;
                }
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

            // 预加载所有 motion 文件的时长（秒），存入 Map，点击时直接查
            const motionDurationMap = new Map();
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

            // 6. 眼睛/头部追踪
            setupMouseTracking(model, app.view);

            // 7. 点击交互（触发对应区域动作，动作结束后复原表情）
            app.view.addEventListener('click', async (e) => {
                const rect = app.view.getBoundingClientRect();
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

                // 找出对应动作
                let motionGroupKey = null, pickedFile = null;
                try {
                    const motions = model.internalModel?.settings?.motions || {};
                    const groupKey = hitMotionGroup
                        ? Object.keys(motions).find(k => k.toLowerCase() === ('tap' + hitMotionGroup).toLowerCase() || k.toLowerCase() === hitMotionGroup.toLowerCase())
                        : null;
                    const group = groupKey ? motions[groupKey] : null;
                    const list = group && group.length ? group : Object.values(motions).flat();
                    const picked = list[Math.floor(Math.random() * list.length)];
                    if (picked) {
                        if (picked.File) pickedFile = picked.File;
                        motionGroupKey = groupKey || Object.keys(motions).find(k => motions[k].includes(picked)) || Object.keys(motions)[0];
                    }
                } catch (_) {}

                // 触发动作，动作播完后强制回到 Idle 清除残留表情
                if (motionGroupKey) {
                    const motionDuration = (pickedFile && motionDurationMap.get(pickedFile)) || 6;

                    try {
                        isMotionPlaying = true;
                        model.motion(motionGroupKey);
                    } catch (_) {}

                    await new Promise(r => setTimeout(r, motionDuration * 1000 + 300));
                    isMotionPlaying = false;

                    try { model.motion('Idle', 0, 2); } catch (_) {}
                }
            });

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
