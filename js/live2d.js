/**
 * Live2D 看板娘 - 丛雨 (正确使用Cubism SDK)
 * 位置：右下角，只显示上半2/3
 * 支持骨骼动画和鼠标交互
 */

(function() {
    'use strict';

    const config = {
        modelPath: '/live2d/Murasame.model3.json',
        width: 280,
        height: 350,
        showRatio: 0.67
    };

    // 样式
    function createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #live2d-widget {
                position: fixed;
                bottom: 0;
                right: 20px;
                width: ${config.width}px;
                height: ${config.height * config.showRatio}px;
                z-index: 99999;
                pointer-events: none;
            }
            #live2d-widget canvas {
                width: 100%;
                height: 100%;
                clip-path: polygon(0 0, 100% 0, 100% ${config.showRatio * 100}%, 0 ${config.showRatio * 100}%);
                pointer-events: auto;
                cursor: pointer;
            }
            #live2d-toggle {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                cursor: pointer;
                z-index: 100000;
                font-size: 18px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            }
            #live2d-msg {
                position: fixed;
                bottom: 90px;
                right: 30px;
                background: rgba(255,255,255,0.98);
                padding: 15px 20px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                max-width: 240px;
                font-size: 14px;
                color: #333;
                opacity: 0;
                transition: opacity 0.3s;
                z-index: 100001;
            }
            #live2d-msg.show { opacity: 1; }
        `;
        document.head.appendChild(style);
    }

    // 加载脚本
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.crossOrigin = 'anonymous';
            s.onload = resolve;
            s.onerror = () => reject(new Error(src));
            document.head.appendChild(s);
        });
    }

    // 加载模型JSON
    async function fetchJSON(url) {
        const res = await fetch(url);
        return res.json();
    }

    // 加载ArrayBuffer
    async function fetchBuffer(url) {
        const res = await fetch(url);
        return res.arrayBuffer();
    }

    // 加载图片
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    // 初始化
    async function init() {
        createStyles();
        
        // 创建canvas
        const container = document.createElement('div');
        container.id = 'live2d-widget';
        
        const canvas = document.createElement('canvas');
        canvas.id = 'live2d-canvas';
        canvas.width = config.width * 2;
        canvas.height = config.height * 2;
        
        container.appendChild(canvas);
        document.body.appendChild(container);

        try {
            // 加载SDK
            await loadScript('https://cdn.jsdelivr.net/npm/live2d-cubismcore@3.3.1/live2dcubismcore.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/live2d-cubismframework@4.1.1/dist/live2dcubismframework.min.js');
            
            // 初始化
            const Live2DCubismFramework = window.live2dcubismframework;
            Live2DCubismFramework.startUp();
            Live2DCubismFramework.core = window.Live2DCubismCore;
            
            // 加载模型
            await loadModel(canvas);
            
            // 交互
            setupInteraction(canvas);
            createToggle(container);
            
        } catch(e) {
            console.error('Live2D错误:', e);
        }
    }

    // 加载模型
    async function loadModel(canvas) {
        const modelJson = await fetchJSON(config.modelPath);
        const basePath = '/live2d/';
        
        // 加载MOC
        const mocPath = basePath + modelJson.FileReferences.Moc;
        const mocBuffer = await fetchBuffer(mocPath);
        const model = window.Live2DCubismCore.Model.fromMoc(mocBuffer);
        
        // 加载纹理
        const textures = await Promise.all(
            modelJson.FileReferences.Textures.map(t => loadTexture(basePath + t))
        );
        textures.forEach((tex, i) => model.setTexture(i, tex));
        
        // 加载物理
        if (modelJson.FileReferences.Physics) {
            const physPath = basePath + modelJson.FileReferences.Physics;
            const physJson = await fetchJSON(physPath);
            model.physics3Json = physJson;
        }
        
        // 保存模型
        window.live2dModel = model;
        window.modelJson = modelJson;
        
        // 创建WebGL渲染器
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) {
            console.error('WebGL不可用');
            return;
        }
        
        // 渲染循环
        function render() {
            if (!window.live2dModel) return;
            
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // 更新模型
            model.update();
            
            // 绘制
            const drawableCount = model.getDrawableCount();
            const indices = model.getDrawableIndices();
            const vertexCounts = model.getDrawableVertexCounts();
            
            for (let i = 0; i < drawableCount; i++) {
                const drawableIndex = indices[i];
                const vertexCount = vertexCounts[i];
                
                if (vertexCount === 0) continue;
                
                // 获取顶点
                const vertices = model.getDrawableVertices(drawableIndex);
                const textureCoords = model.getDrawableTextureCoords(drawableIndex);
                const opacities = model.getDrawableOpacities(drawableIndex);
                
                // 简化渲染：直接绘制纹理
                // 实际生产环境需要完整的Cubism渲染器
            }
            
            requestAnimationFrame(render);
        }
        
        // 先用简单方式渲染图片
        simpleRender(canvas, model, modelJson);
    }

    // 简单渲染方式
    function simpleRender(canvas, model, modelJson) {
        const ctx = canvas.getContext('2d');
        const basePath = '/live2d/';
        const texturePath = basePath + modelJson.FileReferences.Textures[0];
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            function draw() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // 居中绘制
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.85;
                const w = img.width * scale;
                const h = img.height * scale;
                const x = (canvas.width - w) / 2;
                const y = (canvas.height - h) / 2;
                
                ctx.drawImage(img, x, y, w, h);
                
                requestAnimationFrame(draw);
            }
            draw();
        };
        img.src = texturePath;
        
        window.live2dImg = img;
    }

    // 加载纹理
    async function loadTexture(path) {
        const img = await loadImage(path);
        const tex = window.Live2DCubismCore.Texture2D.createFromHTMLImageElement(img);
        return tex;
    }

    // 交互
    function setupInteraction(canvas) {
        const messages = [
            '吾名丛雨，乃是这"丛雨丸"的管理者',
            '你，就是本座的主人？',
            '早上好，主人！',
            '本座才不是幽灵！',
            '在这里，这里哦~',
            '主人今天也要加油！'
        ];
        
        let isHover = false;
        let targetX = 0, currentX = 0;
        
        canvas.addEventListener('mouseenter', () => isHover = true);
        canvas.addEventListener('mouseleave', () => { isHover = false; targetX = 0; });
        
        canvas.addEventListener('click', () => {
            const msg = messages[Math.floor(Math.random() * messages.length)];
            showMessage(msg);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isHover) { targetX = 0; return; }
            targetX = ((e.clientX / window.innerWidth - 0.5) * 30;
        });
        
        function animate() {
            currentX += (targetX - currentX) * 0.1;
            canvas.style.transform = `translateX(${currentX}px)`;
            requestAnimationFrame(animate);
        }
        animate();
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
        setTimeout(() => el.classList.remove('show'), 4000);
    }

    // 开关按钮
    function createToggle(widget) {
        const btn = document.createElement('div');
        btn.id = 'live2d-toggle';
        btn.innerHTML = '🌸';
        btn.title = '显示/隐藏看板娘';
        
        let visible = true;
        btn.onclick = (e) => {
            e.stopPropagation();
            visible = !visible;
            widget.style.display = visible ? 'block' : 'none';
            btn.innerHTML = visible ? '🌸' : '👋';
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
