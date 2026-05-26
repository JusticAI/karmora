/**
 * Reddit Community Collector - Background Service Worker
 */

// ============ Service Worker 错误捕获 ============
const _bgErrors = [];
const _bgOriginalError = console.error;
console.error = (...args) => {
    _bgErrors.push({ type: 'console.error', message: args.join(' ').substring(0, 500), ts: new Date().toISOString() });
    _bgOriginalError.apply(console, args);
};
self.addEventListener('error', (e) => {
    _bgErrors.push({ type: 'uncaught', message: `${e.message} at ${e.filename}:${e.lineno}`, ts: new Date().toISOString() });
});
self.addEventListener('unhandledrejection', (e) => {
    _bgErrors.push({ type: 'unhandledrejection', message: e.reason?.toString()?.substring(0, 500) || 'Unknown', ts: new Date().toISOString() });
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATUS_UPDATE') {
        // 转发状态更新到 popup
        chrome.runtime.sendMessage(message).catch(() => {});
    } else if (message.type === 'SAVE_ERROR_REPORT') {
        // content script 请求保存错误报告（content script 无法直接使用 chrome.downloads）
        const { reportData, filename } = message;
        // 合并 background.js 自身的错误
        if (_bgErrors.length > 0) {
            reportData.bg_errors = _bgErrors.splice(0); // 取出并清空
        }
        const jsonStr = JSON.stringify(reportData, null, 2);
        const dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(jsonStr)));
        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: false,
            conflictAction: 'overwrite'
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.log('[Collector] ❌ 下载失败:', chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, downloadId });
            }
        });
        return true; // 保持 sendResponse 通道开放
    } else if (message.type === 'GET_BG_ERRORS') {
        // 获取 background.js 自身的错误
        sendResponse({ errors: _bgErrors.splice(0) });
    }
    return false;
});

// 安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Collector] 扩展已安装');
});
