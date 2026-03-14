/**
 * Live2D 看板娘 - 丛雨
 * 使用 Cubism Web SDK 完整渲染
 */

(function() {
    'use strict';

    const config = {
        modelPath: '/live2d/Murasame.model3.json',
        width: 280,
        height: 350,
        showRatio: 0.67
    };

    const messages = [
        '吾名丛雨，乃是这"丛雨丸"的管理者',
        '你，就是本座的主人？',
        '早上好，主人！',
        '本座才不是幽灵！',
        '在这里，这里哦~',
        '主人今天也要加油！'
    ];

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
                transition: transform 0.2s;
            }
            #live2d-toggle:hover { transform: scale(1.1); }
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

    // 初始化
    async function init() {
        createStyles();
        
        const container = document.createElement('div');
        container.id = 'live2d-widget';
        
        const canvas = document.createElement('canvas');
        canvas.id = 'live2d-canvas';
        canvas.width = config.width;
        canvas.height = config.height;
        
        container.appendChild(canvas);
        document.body.appendChild(container);

        try {
            // 加载Cubism SDK
            await loadScript('https://cdn.jsdelivr.net/npm/live2d-cubismcore@3.3.1/live2dcubismcore.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/live2d-cubismframework@4.1.1/dist/live2dcubismframework.min.js');
            
            // 初始化
            const CubismFramework = window.live2dcubismframework.Live2DCubismFramework;
            CubismFramework.startUp();
            CubismFramework.core = window.Live2DCubismCore;
            
            // 加载模型
            await loadModel(canvas);
            
            // 交互
            setupInteraction(canvas);
            createToggle(container);
            
        } catch(e) {
            console.error('Live2D加载失败:', e);
        }
    }

    // 加载模型
    async function loadModel(canvas) {
        const modelJson = await fetch(config.modelPath).then(r => r.json());
        const basePath = '/live2d/';
        
        // 加载MOC文件
        const mocPath = basePath + modelJson.FileReferences.Moc;
        const mocBuffer = await fetch(mocPath).then(r => r.arrayBuffer());
        
        // 创建模型
        const model = window.Live2DCubismCore.Model.fromMoc(mocBuffer);
        
        // 加载纹理
        const textures = await Promise.all(
            modelJson.FileReferences.Textures.map(async (texPath) => {
                const img = await loadImage(basePath + texPath);
                return window.Live2DCubismCore.Texture2D.createFromHTMLImageElement(img);
            })
        );
        
        textures.forEach((tex, i) => model.setTexture(i, tex));
        
        // 渲染
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) {
            // 回退到2D
            render2D(canvas, model, modelJson);
            return;
        }
        
        // WebGL渲染
        renderWebGL(gl, model, canvas);
    }

    // 2D渲染（回退方案）
    function render2D(canvas, model, modelJson) {
        const ctx = canvas.getContext('2d');
        const basePath = '/live2d/';
        
        // 加载纹理
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
        img.src = basePath + modelJson.FileReferences.Textures[0];
    }

    // WebGL渲染
    function renderWebGL(gl, model, canvas) {
        const vertexShader = `
            attribute vec2 a_position;
            attribute float a_opacity;
            uniform vec2 u_resolution;
            uniform float u_scale;
            uniform vec2 u_translate;
            varying float v_opacity;
            void main() {
                vec2 pos = (a_position + u_translate) * u_scale;
                vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                v_opacity = a_opacity;
            }
        `;
        
        const fragmentShader = `
            precision mediump float;
            uniform sampler2D u_texture;
            varying float v_opacity;
            void main() {
                vec4 color = texture2D(u_texture, gl_FragCoord.xy / vec2(512.0, 512.0));
                gl_FragColor = vec4(color.rgb, color.a * v_opacity);
            }
        `;
        
        function createShader(type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            return shader;
        }
        
        const vs = createShader(gl.VERTEX_SHADER, vertexShader);
        const fs = createShader(gl.FRAGMENT_SHADER, fragmentShader);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        
        gl.useProgram(program);
        
        function render() {
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            model.update();
            
            requestAnimationFrame(render);
        }
        
        render();
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

    // 交互
    function setupInteraction(canvas) {
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
            targetX = ((e.clientX / window.innerWidth) - 0.5) * 30;
        });
        
        function animate() {
            currentX += (targetX - currentX) * 0.1;
            canvas.style.transform = `translateX(${currentX}px)`;
            requestAnimationFrame(animate);
        }
        animate();
    }

    // 消息
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

    // 开关
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
