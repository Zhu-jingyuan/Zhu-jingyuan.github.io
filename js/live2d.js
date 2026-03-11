/**
 * Live2D 看板娘 - 丛雨
 * 位置：右下角，只显示上半2/3
 * 支持鼠标交互
 */

(function() {
    // 配置
    const config = {
        modelPath: '/live2d/Murasame.model3.json',
        width: 280,
        height: 350,
        showRatio: 0.67
    };

    // 创建样式
    function createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #live2d-container {
                position: fixed;
                bottom: 0;
                right: 20px;
                width: ${config.width}px;
                height: ${config.height * config.showRatio}px;
                z-index: 99999;
                pointer-events: none;
            }
            
            #live2d-canvas {
                width: 100%;
                height: 100%;
                /* 只显示上半2/3 */
                clip-path: polygon(0 0, 100% 0, 100% ${config.showRatio * 100}%, 0 ${config.showRatio * 100}%);
                pointer-events: auto;
                cursor: pointer;
            }
            
            #live2d-loading {
                position: fixed;
                bottom: 20px;
                right: 80px;
                padding: 8px 15px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 20px;
                font-size: 13px;
                z-index: 100000;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            
            #live2d-toggle {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                cursor: pointer;
                z-index: 100000;
                font-size: 18px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                transition: transform 0.3s, box-shadow 0.3s;
            }
            
            #live2d-toggle:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0,0,0,0.4);
            }
            
            #live2d-message {
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
                transform: translateY(10px);
                transition: opacity 0.3s, transform 0.3s;
                z-index: 100001;
                pointer-events: none;
                line-height: 1.6;
            }
            
            #live2d-message.show {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }

    // 加载脚本
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = () => reject(new Error('加载失败: ' + src));
            document.head.appendChild(script);
        });
    }

    // 初始化
    async function init() {
        createStyles();
        
        const loadingEl = document.createElement('div');
        loadingEl.id = 'live2d-loading';
        loadingEl.textContent = 'Loading 丛雨...';
        document.body.appendChild(loadingEl);

        try {
            // 加载 Cubism Core SDK
            await loadScript('https://cdn.jsdelivr.net/npm/live2d-cubismcore@3.3.1/live2dcubismcore.min.js');
            
            // 加载模型
            await loadLive2D();
            
            loadingEl.textContent = '';
            loadingEl.remove();
        } catch (error) {
            console.error('Live2D 加载失败:', error);
            loadingEl.textContent = '加载失败';
            setTimeout(() => loadingEl.remove(), 3000);
        }
    }

    // 加载Live2D模型
    async function loadLive2D() {
        const container = document.createElement('div');
        container.id = 'live2d-container';
        
        const canvas = document.createElement('canvas');
        canvas.id = 'live2d-canvas';
        canvas.width = config.width * 2;
        canvas.height = config.height * 2;
        
        container.appendChild(canvas);
        document.body.appendChild(container);

        // 加载模型JSON
        const modelRes = await fetch(config.modelPath);
        const modelJson = await modelRes.json();
        
        // 模型尺寸
        const modelWidth = 600;
        const modelHeight = 800;
        
        // 加载纹理图片
        const texturePath = '/live2d/' + modelJson.FileReferences.Textures[0];
        const img = await loadImage(texturePath);
        
        window.live2dModel = { img, modelJson };
        
        // 渲染
        const ctx = canvas.getContext('2d');
        
        function draw() {
            if (!window.live2dModel || !window.live2dModel.img) {
                requestAnimationFrame(draw);
                return;
            }
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 绘制模型图片
            const scale = canvas.height / modelHeight * 0.9;
            const drawWidth = modelWidth * scale;
            const drawHeight = modelHeight * scale;
            const x = (canvas.width - drawWidth) / 2;
            const y = 0;
            
            ctx.drawImage(window.live2dModel.img, x, y, drawWidth, drawHeight);
            
            requestAnimationFrame(draw);
        }
        
        draw();
        
        // 设置交互
        setupInteraction(canvas, modelJson);
        createToggleButton(container);
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
    function setupInteraction(canvas, modelJson) {
        let isHovering = false;
        let targetX = 0;
        let currentX = 0;
        
        canvas.addEventListener('mouseenter', () => {
            isHovering = true;
        });
        
        canvas.addEventListener('mouseleave', () => {
            isHovering = false;
            targetX = 0;
        });
        
        canvas.addEventListener('click', () => {
            if (!modelJson || !modelJson.FileReferences.Motions) return;
            
            const motions = modelJson.FileReferences.Motions;
            const motionNames = Object.keys(motions);
            const randomMotion = motionNames[Math.floor(Math.random() * motionNames.length)];
            
            if (motions[randomMotion] && motions[randomMotion].length > 0) {
                const motionData = motions[randomMotion][0];
                
                if (motionData.Text) {
                    showMessage(motionData.Text);
                }
            }
        });
        
        // 鼠标移动时看板娘轻微跟随
        document.addEventListener('mousemove', (e) => {
            if (!isHovering) {
                targetX = 0;
                return;
            }
            targetX = (e.clientX / window.innerWidth - 0.5) * 30;
        });
        
        // 平滑移动
        function animate() {
            currentX += (targetX - currentX) * 0.1;
            canvas.style.transform = `translateX(${currentX}px)`;
            requestAnimationFrame(animate);
        }
        animate();
    }

    // 显示消息
    function showMessage(text) {
        let msgEl = document.getElementById('live2d-message');
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.id = 'live2d-message';
            document.body.appendChild(msgEl);
        }
        msgEl.textContent = text;
        msgEl.classList.add('show');
        
        setTimeout(() => {
            msgEl.classList.remove('show');
        }, 4000);
    }

    // 创建开关按钮
    function createToggleButton(widget) {
        const btn = document.createElement('div');
        btn.id = 'live2d-toggle';
        btn.innerHTML = '🌸';
        btn.title = '显示/隐藏看板娘';
        
        let visible = true;
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            visible = !visible;
            widget.style.display = visible ? 'block' : 'none';
            btn.innerHTML = visible ? '🌸' : '👋';
        });
        
        document.body.appendChild(btn);
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
