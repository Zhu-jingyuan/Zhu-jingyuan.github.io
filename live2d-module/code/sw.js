/**
 * Service Worker - Live2D 资源缓存
 * 缓存 Live2D 引擎文件和模型资源，实现一次加载后离线可用
 */

const CACHE_NAME = 'live2d-cache-v4';

// 需要缓存的资源列表（路径已迁移到 live2d-module/ 下）
const CACHE_URLS = [
    '/live2d-module/code/live2dcubismcore.min.js',
    '/live2d-module/code/live2d-bundle.js',
    '/live2d-module/code/live2d.js',
    '/live2d-module/assets/Murasame.model3.json',
    '/live2d-module/assets/Murasame.moc3',
    '/live2d-module/assets/Murasame.cdi3.json',
    '/live2d-module/assets/Murasame.physics3.json',
    '/live2d-module/assets/Murasame.4096/texture_00.png',
    '/live2d-module/assets/motion/motion01.motion3.json',
    '/live2d-module/assets/motion/motion02.motion3.json',
    '/live2d-module/assets/motion/motion03.motion3.json',
    '/live2d-module/assets/motion/motion04.motion3.json',
    '/live2d-module/assets/motion/motion05.motion3.json',
    '/live2d-module/assets/motion/motion06.motion3.json',
    '/live2d-module/assets/motion/motion07.motion3.json',
    '/live2d-module/assets/motion/motion08.motion3.json',
    '/live2d-module/assets/motion/motion09.motion3.json',
    '/live2d-module/assets/motion/motion10.motion3.json',
    '/live2d-module/assets/motion/motion11.motion3.json',
    '/live2d-module/assets/motion/motion12.motion3.json',
    '/live2d-module/assets/exp/exp1.exp3.json',
    '/live2d-module/assets/exp/exp2.exp3.json',
    '/live2d-module/assets/exp/exp3.exp3.json',
    '/live2d-module/assets/exp/exp4.exp3.json',
    '/live2d-module/assets/exp/exp5.exp3.json',
    '/live2d-module/assets/exp/exp6.exp3.json',
    '/live2d-module/assets/exp/exp7.exp3.json',
];

// 安装时预缓存所有资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] 预缓存 Live2D 资源...');
            return Promise.allSettled(
                CACHE_URLS.map(url =>
                    cache.add(url).catch(err => console.warn('[SW] 缓存失败:', url, err.message))
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// 请求拦截：缓存优先，网络兜底
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 只处理同源请求，且只处理 Live2D 相关路径
    if (url.origin !== location.origin) return;
    const isLive2D = url.pathname.startsWith('/live2d-module/');
    if (!isLive2D) return;

    // 主脚本用网络优先（保证每次部署的新代码生效），其余资源用缓存优先
    const isScript = url.pathname === '/live2d-module/code/live2d.js';

    if (isScript) {
        event.respondWith(
            fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => caches.match(event.request))
        );
    } else {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
    }
});
