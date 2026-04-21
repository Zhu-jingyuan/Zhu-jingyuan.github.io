/**
 * ================================================================
 *  Live2D 看板娘模块 - 丛雨 (Murasame)
 * ================================================================
 *
 *  这是一个独立的 Live2D 看板娘模块，支持通过 HTML data-* 属性
 *  进行配置，无需修改本文件即可调整大部分参数。
 *
 *  文件结构：
 *  live2d-module/
 *  ├── code/                        ← 代码文件
 *  │   ├── live2d.js                ← 本文件（主脚本）
 *  │   ├── live2dcubismcore.min.js  ← Cubism Core 引擎
 *  │   ├── live2d-bundle.js         ← PIXI + pixi-live2d-display
 *  │   └── sw.js                    ← Service Worker（资源缓存）
 *  └── assets/                      ← 模型资源文件
 *      ├── Murasame.model3.json     ← 模型定义
 *      ├── Murasame.moc3            ← 模型二进制
 *      ├── Murasame.physics3.json   ← 物理引擎配置
 *      ├── Murasame.cdi3.json       ← 参数信息
 *      ├── Murasame.4096/           ← 纹理贴图
 *      ├── exp/                     ← 表情文件 (7个)
 *      └── motion/                  ← 动作文件 (12个)
 *
 *  使用方法（在 _config.butterfly.yml 的 inject.bottom 中添加）：
 *
 *  - <script
 *      async
 *      src="/live2d-module/code/live2d.js"
 *      data-enable="true"
 *      data-model="/live2d-module/assets/Murasame.model3.json"
 *      data-side="right"
 *      data-offset-x="0"
 *      data-offset-y="0"
 *      data-width="300"
 *      data-show-ratio="0.75"
 *      data-mobile-breakpoint="768"
 *      data-smooth="0.08"
 *    ></script>
 *
 *  各参数说明见下方 CONFIG 对象的注释。
 *
 *  依赖：
 *  - /live2d-module/code/live2dcubismcore.min.js (Cubism Core)
 *  - /live2d-module/code/live2d-bundle.js (PIXI + pixi-live2d-display)
 * ================================================================
 */

(function () {
    'use strict';

    // ======================== 配置读取 ========================
    // 从 <script data-xxx="..."> 标签读取配置，未指定的参数使用默认值
    // 所有参数均可通过 _config.butterfly.yml 的 inject.bottom 中的
    // <script data-xxx="value"> 形式自定义，无需修改本文件。

    const thisScript = document.currentScript;
    const data = thisScript ? thisScript.dataset : {};

    const CONFIG = {
        // ─── 基础开关 ─────────────────────────────────────────
        // 是否启用看板娘（设为 "false" 则完全不加载，节省资源）
        enable:        data.enable !== 'false',

        // ─── 模型路径 ─────────────────────────────────────────
        // 模型 .model3.json 文件的部署路径（相对于网站根目录）
        model:         data.model || '/live2d-module/assets/Murasame.model3.json',

        // ─── 位置参数 ─────────────────────────────────────────
        // 显示在哪一侧："left" 或 "right"
        side:          data.side || 'right',

        // 水平偏移量（像素），正值远离屏幕边缘
        // 例如 side=right 时 offset-x=20 表示距右边 20px
        offset_x:      parseInt(data.offsetX) || 0,

        // 垂直偏移量（像素），正值向下移动
        offset_y:      parseInt(data.offsetY) || 0,

        // ─── 尺寸参数 ─────────────────────────────────────────
        // Canvas 逻辑宽度（像素）
        width:         parseInt(data.width) || 300,

        // 显示比例（0~1），1 表示显示完整模型，0.75 表示显示上方 3/4
        show_ratio:    parseFloat(data.showRatio) || 0.75,

        // ─── 响应式 ────────────────────────────────────────────
        // 移动端断点（像素），屏幕宽度小于此值时不加载看板娘
        // 设为 0 则在所有设备上都加载
        mobile_breakpoint: parseInt(data.mobileBreakpoint) || 768,

        // ─── 追踪参数 ─────────────────────────────────────────
        // 鼠标追踪平滑度（0~1），越大追踪越灵敏，越小越迟缓
        smooth:        parseFloat(data.smooth) || 0.08,

        // ─── 内部路径（一般不需要修改） ───────────────────────
        // 引擎文件路径
        core_path:     data.corePath  || '/live2d-module/code/live2dcubismcore.min.js',
        bundle_path:   data.bundlePath|| '/live2d-module/code/live2d-bundle.js',
    };

    // ─── 启动检查 ────────────────────────────────────────────
    if (!CONFIG.enable) {
        console.log('[Live2D] 看板娘已禁用（data-enable="false"）');
        return;
    }

    // 计算显示参数
    const CANVAS_W = CONFIG.width;
    const CANVAS_H = Math.floor(CANVAS_W * 550 / 300);  // 按比例缩放（原始模型比例 300:550）
    const SHOW_H   = Math.floor(CANVAS_H * CONFIG.show_ratio);
    const OFFSET_Y = Math.floor(CANVAS_H * (1 - CONFIG.show_ratio));  // 向下偏移量

    // 小屏幕检测
    function isMobile() {
        return CONFIG.mobile_breakpoint > 0 && window.innerWidth < CONFIG.mobile_breakpoint;
    }

    // ======================== 工具函数 ========================

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

    // ======================== 样式生成 ========================

    function createStyles() {
        const side = CONFIG.side;           // 'left' or 'right'
        const ox   = CONFIG.offset_x;      // px
        const oy   = CONFIG.offset_y;      // px

        const style = document.createElement('style');
        style.textContent = `
            #live2d-widget {
                position: fixed;
                bottom: ${oy}px;
                ${side}: ${ox}px;
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
            ${CONFIG.mobile_breakpoint > 0 ? `
            @media (max-width: ${CONFIG.mobile_breakpoint}px) {
                #live2d-widget {
                    display: none !important;
                }
            }
            ` : ''}
        `;
        document.head.appendChild(style);
    }

    // ======================== 鼠标追踪 ========================
    //
    // pixi-live2d-display 帧循环顺序：
    //   motionManager.update → saveParameters → expression/eyeBlink/physics
    //   → beforeModelUpdate → coreModel.update(渲染) → loadParameters(恢复备份)
    //
    // 双重写入策略：
    //   1. beforeModelUpdate（渲染前）写入参数
    //   2. loadParameters hook（渲染后）再次覆写，确保备份值也是我们的值

    let isMotionPlaying = false;

    function setupMouseTracking(model, canvas) {
        let targetX = 0, targetY = 0;
        let curX = 0, curY = 0;
        const smooth = CONFIG.smooth;

        document.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            targetX = Math.max(-1, Math.min(1,
                (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)));
            targetY = Math.max(-1, Math.min(1,
                (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)));
        });

        const core = model.internalModel.coreModel;
        const pv = core._parameterValues;

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
            console.log('[Live2D] Parameter indices:', JSON.stringify(indices));
        }

        function applyParams() {
            if (!pv || !indices) return;
            const safe = (idx, val) => {
                if (idx >= 0 && idx < pv.length) pv[idx] = val;
            };
            // 瞳孔锁定：防止 motion 驱动瞳孔收缩
            safe(indices.pupilL,     0);
            safe(indices.pupilR,     0);
            safe(indices.highlightL, 0);
            safe(indices.highlightR, 0);
            // 头部/眼球追踪：动作播放期间让位
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

        // Hook loadParameters
        const _origLoad = core.loadParameters.bind(core);
        core.loadParameters = function () {
            _origLoad();
            applyParams();
        };

        // beforeModelUpdate
        model.internalModel.on('beforeModelUpdate', () => {
            curX += (targetX - curX) * smooth;
            curY += (targetY - curY) * smooth;
            try {
                ensureIndices();
                applyParams();
            } catch (_) {}
        });
    }

    // ======================== 主初始化 ========================

    async function init() {
        if (isMobile()) {
            console.log('[Live2D] 小屏幕（宽度 < ' + CONFIG.mobile_breakpoint + 'px），跳过加载');
            return;
        }

        createStyles();

        const container = document.createElement('div');
        container.id = 'live2d-widget';
        document.body.appendChild(container);

        try {
            // 1. 加载引擎
            await loadScript(CONFIG.core_path);
            await loadScript(CONFIG.bundle_path);

            if (!window.PIXI || !window.PIXI.live2d || !window.PIXI.live2d.Live2DModel) {
                throw new Error('PIXI.live2d.Live2DModel 未定义');
            }

            // 2. 创建 Pixi Application
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

            // 3. 加载模型
            const model = await PIXI.live2d.Live2DModel.from(CONFIG.model, {
                onError: (e) => console.error('[Live2D] Model error:', e),
                autoInteract: false,
            });

            app.stage.addChild(model);

            // 4. 缩放与定位
            const scale = Math.min(CANVAS_W / model.width, CANVAS_H / model.height);
            model.scale.set(scale);
            model.anchor.set(0.5, 0);
            model.x = CANVAS_W / 2;
            model.y = 0;

            // 5. 禁用内置 updateFocus / eyeBlink / Idle 自动循环
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
            console.log('[Live2D] 模型加载成功！');

            // 6. 预加载 motion 时长
            const motionDurationMap = new Map();
            try {
                // 从模型路径推导资源目录
                const assetBase = CONFIG.model.substring(0, CONFIG.model.lastIndexOf('/') + 1);
                const allMotions = Object.values(model.internalModel?.settings?.motions || {}).flat();
                await Promise.all(allMotions.map(async (m) => {
                    if (!m?.File) return;
                    try {
                        const resp = await fetch(assetBase + m.File);
                        const mj = await resp.json();
                        if (mj?.Meta?.Duration) motionDurationMap.set(m.File, mj.Meta.Duration);
                    } catch (_) {}
                }));
                console.log('[Live2D] 预加载 motion 时长完成，共', motionDurationMap.size, '条');
            } catch (_) {}

            // 7. 鼠标追踪
            setupMouseTracking(model, app.view);

            // 8. 点击交互
            app.view.addEventListener('click', async (e) => {
                const rect = app.view.getBoundingClientRect();
                const localX = (e.clientX - rect.left) / (rect.width / CANVAS_W);
                const localY = (e.clientY - rect.top) / (rect.height / CANVAS_H);

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

    // ======================== Service Worker ========================

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/live2d-module/code/sw.js').then(
                () => console.log('[Live2D] Service Worker 注册成功'),
                (err) => console.warn('[Live2D] Service Worker 注册失败:', err)
            );
        });
    }

    // ======================== 启动 ========================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }

})();
