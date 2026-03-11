/**
 * Live2D 看板娘 - 丛雨
 * 位置：右下角，只显示上半2/3
 * 优化版：直接显示图片，鼠标悬停交互
 */

(function() {
    // 配置
    const config = {
        imagePath: '/live2d/Murasame.4096/texture_00.png',
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
                transition: transform 0.3s ease;
            }
            
            #live2d-img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                /* 只显示上半2/3 */
                clip-path: polygon(0 0, 100% 0, 100% ${config.showRatio * 100}%, 0 ${config.showRatio * 100}%);
                pointer-events: auto;
                cursor: pointer;
                transition: transform 0.2s ease;
                user-select: none;
                -webkit-user-drag: none;
            }
            
            #live2d-img:hover {
                transform: scale(1.02);
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

    // 丛雨对话文案
    const messages = [
        '吾名丛雨，乃是这"丛雨丸"的管理者',
        '你，就是本座的主人？',
        '早上好，主人！',
        '本座才不是幽灵！',
        '在这里，这里哦~',
        '主人今天也要加油！',
        '不要把本座和幽灵相提并论！',
        '你醒了吗？'
    ];

    // 初始化
    function init() {
        createStyles();
        
        // 创建容器
        const container = document.createElement('div');
        container.id = 'live2d-container';
        
        // 创建图片
        const img = document.createElement('img');
        img.id = 'live2d-img';
        img.src = config.imagePath;
        img.alt = 'Live2D 丛雨';
        img.crossOrigin = 'anonymous';
        
        // 加载失败处理
        img.onerror = function() {
            console.error('Live2D 图片加载失败');
            container.remove();
        };
        
        img.onload = function() {
            console.log('Live2D 丛雨加载成功');
        };
        
        container.appendChild(img);
        document.body.appendChild(container);

        // 交互
        setupInteraction(img);
        
        // 开关按钮
        createToggleButton(container);
    }

    // 交互
    function setupInteraction(img) {
        let isHovering = false;
        let targetX = 0;
        let currentX = 0;
        
        img.addEventListener('mouseenter', () => {
            isHovering = true;
        });
        
        img.addEventListener('mouseleave', () => {
            isHovering = false;
            targetX = 0;
        });
        
        // 点击显示随机对话
        img.addEventListener('click', () => {
            const msg = messages[Math.floor(Math.random() * messages.length)];
            showMessage(msg);
        });
        
        // 鼠标移动时看板娘轻微跟随
        document.addEventListener('mousemove', (e) => {
            if (!isHovering) {
                targetX = 0;
                return;
            }
            // 根据鼠标位置计算偏移
            const centerX = window.innerWidth / 2;
            const mouseX = e.clientX;
            targetX = ((mouseX - centerX) / centerX) * 25;
        });
        
        // 平滑移动动画
        function animate() {
            currentX += (targetX - currentX) * 0.08;
            const scale = isHovering ? 1.02 : 1;
            img.style.transform = `translateX(${currentX}px) scale(${scale})`;
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
