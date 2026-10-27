/**
 * Anima Tools - 共享图片加载优化工具
 * 提供内存级 URL 缓存，在三个选择器中共用
 */

// 全局已加载图片 URL 缓存（跨弹窗共享，浏览器会话内有效）
if (!window._animaLoadedImageUrls) {
    window._animaLoadedImageUrls = new Set();
}

/**
 * 标记 URL 已成功加载
 */
export function markImageLoaded(url) {
    if (url && !url.startsWith("data:")) {
        window._animaLoadedImageUrls.add(url);
        // 控制缓存大小，防止内存泄漏
        if (window._animaLoadedImageUrls.size > 2000) {
            const first = window._animaLoadedImageUrls.values().next().value;
            window._animaLoadedImageUrls.delete(first);
        }
    }
}

/**
 * 检查 URL 是否已加载过
 */
export function isImageLoaded(url) {
    return url && window._animaLoadedImageUrls.has(url);
}
