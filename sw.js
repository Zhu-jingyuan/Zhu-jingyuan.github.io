/**
 * Service Worker - Live2D 资源缓存
 * 缓存 Live2D 引擎文件和模型资源，实现一次加载后离线可用
 */

const CACHE_NAME = 'live2d-cache-v1';

// 需要缓存的资源列表
const CACHE_URLS = [
    '/js/lib/live2dcubismcore.min.js',
    '/js/lib/live2d-bundle.js',
    '/js/live2d.js',
    '/live2d/Murasame.model3.json',
    '/live2d/Murasame.moc3',
    '/live2d/Murasame.4096/texture_00.png',
    '/live2d/Murasame.physics3.json',
    '/live2d/motion/motion01.motion3.json',
    '/live2d/motion/motion02.motion3.json',
    '/live2d/motion/motion03.motion3.json',
    '/live2d/motion/motion04.motion3.json',
    '/live2d/motion/motion05.motion3.json',
    '/live2d/motion/motion06.motion3.json',
    '/live2d/motion/motion07.motion3.json',
    '/live2d/motion/motion08.motion3.json',
    '/live2d/motion/motion09.motion3.json',
    '/live2d/motion/motion10.motion3.json',
    '/live2d/motion/motion11.motion3.json',
    '/live2d/motion/motion12.motion3.json',
    '/live2d/exp/exp1.exp3.json',
    '/live2d/exp/exp2.exp3.json',
    '/live2d/exp/exp3.exp3.json',
    '/live2d/exp/exp4.exp3.json',
    '/live2d/exp/exp5.exp3.json',
    '/live2d/exp/exp6.exp3.json',
    '/live2d/exp/exp7.exp3.json',
    '/live2d/sounds/bandicam 2021-11-23 02-18-04-516.mp4.wav',
    '/live2d/sounds/bandicam 2021-11-23 02-19-03-123.mp4.wav',
    '/live2d/sounds/bandicam 2021-11-23 02-19-13-234.mp4.wav',
    '/live2d/sounds/bandicam 2021-11-23 02-19-22-154.mp4.wav',
    '/live2d/sounds/bandicam 2021-11-23 02-19-30-578.mp4.wav',
    '/live2d/sounds/bandicam 2021-11-23 02-19-37-560.mp4.wav',
    '/live2d/sounds/bandicam 2021-11-23 02-19-47-794.mp4.wav',
    '/live2d/sounds/bandicam 2021-11-23 02-19-58-125.mp4.wav',
    '/live2d/sounds/bandicam 2021-11-23 02-20-13-844.mp4.wav',
    '/live2d/sounds/bandicam 2021-11-23 02-20-24-955.mp4.wav',
    '/live2d/sounds/bandicam 2021-11-23 02-20-39-029.mp4.wav',
];

// 安装时预缓存所有资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] 预缓存 Live2D 资源...');
            // 逐个缓存，避免单个失败导致整体失败
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
    const isLive2D = url.pathname.startsWith('/live2d/') ||
                     url.pathname.startsWith('/js/lib/live2d') ||
                     url.pathname === '/js/lib/live2dcubismcore.min.js' ||
                     url.pathname === '/js/live2d.js';
    if (!isLive2D) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // 未缓存则从网络获取并存入缓存
            return fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
