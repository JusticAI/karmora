/**
 * 错误监控器 - 自动捕获和报告错误
 */

class ErrorMonitor {
    constructor() {
        this.errors = [];
        this.fixedErrors = new Set(); // 已修复的错误指纹
        this.lastSavedFingerprints = new Set(); // 已下载过的错误指纹，避免重复下载
        this.maxErrors = 100;
        this.projectName = 'reddit-community-collector';
        // chrome.downloads 只能保存到 Downloads 目录，用固定文件名便于 cron 检查
        this.downloadFilename = `auto-debug-errors-${this.projectName}.json`;
        this.downloadDebounceTimer = null;
        this.setupInterceptors();
    }

    setupInterceptors() {
        // 拦截 console.error
        const originalError = console.error;
        console.error = (...args) => {
            this.captureError('console.error', args.join(' '));
            originalError.apply(console, args);
        };

        // 拦截未捕获的错误
        window.addEventListener('error', (event) => {
            this.captureError('uncaught', `${event.message} at ${event.filename}:${event.lineno}`);
        });

        // 拦截未处理的 Promise 错误
        window.addEventListener('unhandledrejection', (event) => {
            this.captureError('unhandledrejection', event.reason?.toString() || 'Unknown error');
        });
    }

    captureError(type, message) {
        // 过滤掉一些无用的错误
        if (this.shouldIgnore(message)) return;

        // 生成错误指纹（用于去重）
        const fingerprint = this.getFingerprint(type, message);
        
        // 跳过已修复的错误
        if (this.fixedErrors.has(fingerprint)) return;

        const error = {
            type,
            message: message.substring(0, 500), // 限制长度
            timestamp: new Date().toISOString(),
            url: window.location.href,
            fingerprint, // 添加指纹
        };

        this.errors.push(error);

        // 限制错误数量
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(-this.maxErrors);
        }

        // 保存到 IndexedDB
        this.saveErrors();
    }

    shouldIgnore(message) {
        const ignorePatterns = [
            'kQuotaBytes', // Chrome 存储限制（已用 IndexedDB 解决）
            'karmora_collector_running', // 重复加载检测
            'Receiving end does not exist', // 消息通道问题
            'message port closed', // 消息通道问题
        ];
        // 忽略所有 HTTP 404 相关的 partial 错误（社区不存在）
        if (ignorePatterns.some(pattern => message.includes(pattern))) return true;
        if (message.includes('404') && (message.includes('about_error') || message.includes('rules_error'))) return true;
        // 忽略所有 HTTP 403 相关的 partial 错误（受限/私密/隔离社区的正常响应）
        if (message.includes('403') && (message.includes('moderators_error') || message.includes('submit_text_error') || message.includes('about_error') || message.includes('wiki'))) return true;
        // 忽略 HTTP 503 相关的 wiki 错误（临时服务不可用）
        if (message.includes('503') && message.includes('wiki')) return true;
        if (message.includes('Invalid JSON') && message.includes('submit_text_error')) return true;
        return false;
    }

    getFingerprint(type, message) {
        // 简化错误信息，生成唯一指纹
        // 移除变化的部分（行号、时间戳、UUID、社区名等）
        let simplified = message
            .replace(/:\d+:\d+/g, '') // 移除行列号
            .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '') // 移除时间戳
            .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '') // 移除 UUID
            // 归一化：去掉社区名/变量名，只保留错误模式
            // 匹配 "SomeName: about_error: HTTP 404" 模式 → 去掉 SomeName
            .replace(/^[^:]+:\s*(?=about_error|rules_error|moderators_error|submit_text_error|wiki)/, '')
            // 匹配 "SomeName: HTTP 404" 模式 → 去掉 SomeName
            .replace(/^[^:]+:\s*(?=HTTP \d{3})/, '')
            .substring(0, 200); // 限制长度
        
        // 简单哈希
        let hash = 0;
        for (let i = 0; i < simplified.length; i++) {
            const char = simplified.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        
        return `${type}_${Math.abs(hash).toString(36)}`;
    }

    markAsFixed(fingerprint) {
        this.fixedErrors.add(fingerprint);
        // 同时保存到 IndexedDB
        this.saveFixedErrors();
    }

    async saveFixedErrors() {
        try {
            if (typeof collectorDB !== 'undefined' && collectorDB.db) {
                const state = await collectorDB.loadState();
                state.fixedErrors = Array.from(this.fixedErrors);
                await collectorDB.saveState(state);
            }
        } catch (e) {
            // 忽略
        }
    }

    async loadFixedErrors() {
        try {
            if (typeof collectorDB !== 'undefined' && collectorDB.db) {
                const state = await collectorDB.loadState();
                this.fixedErrors = new Set(state.fixedErrors || []);
            }
        } catch (e) {
            this.fixedErrors = new Set();
        }
    }

    async saveErrors() {
        try {
            if (typeof collectorDB !== 'undefined' && collectorDB.db) {
                const state = await collectorDB.loadState();
                state.errorLog = this.errors;
                await collectorDB.saveState(state);
            }
            
            // 同时保存到 auto-debug 目录（供自动检查脚本使用）
            if (this.errors.length > 0) {
                // 去重：只保存未修复的唯一错误
                const uniqueErrors = [];
                const seen = new Set();
                
                for (const error of this.errors) {
                    const fp = error.fingerprint || this.getFingerprint(error.type, error.message);
                    if (!seen.has(fp) && !this.fixedErrors.has(fp)) {
                        seen.add(fp);
                        uniqueErrors.push(error);
                    }
                }

                if (uniqueErrors.length === 0) {
                    // 所有错误都已下载过，跳过
                    return;
                }

                // 检查是否有新指纹（之前没下载过的）
                const newFingerprints = new Set(uniqueErrors.map(e => e.fingerprint));
                const hasNew = [...newFingerprints].some(fp => !this.lastSavedFingerprints.has(fp));
                
                if (!hasNew) return; // 所有错误都已下载过，跳过

                // 更新已保存指纹集合
                this.lastSavedFingerprints = newFingerprints;

                // 防抖：延迟 3 秒再下载，避免短时间内多次触发
                if (this.downloadDebounceTimer) {
                    clearTimeout(this.downloadDebounceTimer);
                }

                const report = {
                    project: this.projectName,
                    timestamp: new Date().toISOString(),
                    errors: uniqueErrors.slice(-20), // 最多保存20个唯一错误
                    summary: {
                        total: this.errors.length,
                        unique: uniqueErrors.length,
                        fixed: this.fixedErrors.size
                    }
                };
                
                // 通过 background.js 保存到 Downloads（content script 无法直接使用 chrome.downloads）
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    // 防抖：3秒内只触发一次下载
                    this.downloadDebounceTimer = setTimeout(() => {
                        chrome.runtime.sendMessage({
                            type: 'SAVE_ERROR_REPORT',
                            reportData: report,
                            filename: this.downloadFilename
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.log(`[Collector] ❌ 错误报告保存失败: ${chrome.runtime.lastError.message}`);
                            } else {
                                console.log(`[Collector] 📦 错误报告已保存 (${uniqueErrors.length} 个唯一错误)`);
                            }
                        });
                    }, 3000);
                } else {
                    console.log(`[Collector] ❌ chrome.runtime 不可用`);
                }
            }
        } catch (e) {
            // 忽略保存错误
        }
    }

    async loadErrors() {
        try {
            if (typeof collectorDB !== 'undefined' && collectorDB.db) {
                const state = await collectorDB.loadState();
                this.errors = state.errorLog || [];
            }
        } catch (e) {
            this.errors = [];
        }
    }

    getErrors() {
        return this.errors;
    }

    getErrorsSince(minutes = 30) {
        const cutoff = new Date(Date.now() - minutes * 60 * 1000);
        return this.errors.filter(e => new Date(e.timestamp) > cutoff);
    }

    getErrorSummary() {
        const recent = this.getErrorsSince(30);
        const byType = {};
        
        for (const error of recent) {
            const key = error.type;
            if (!byType[key]) byType[key] = [];
            byType[key].push(error);
        }

        return {
            total: this.errors.length,
            recent: recent.length,
            byType: Object.entries(byType).map(([type, errors]) => ({
                type,
                count: errors.length,
                lastError: errors[errors.length - 1]?.message,
            })),
        };
    }

    generateReport() {
        const summary = this.getErrorSummary();
        const recentErrors = this.getErrorsSince(60); // 最近1小时

        let report = `# Collector Bug Report\n`;
        report += `Generated: ${new Date().toISOString()}\n`;
        report += `URL: ${window.location.href}\n\n`;

        report += `## Summary\n`;
        report += `- Total errors: ${summary.total}\n`;
        report += `- Recent (30min): ${summary.recent}\n\n`;

        if (summary.byType.length > 0) {
            report += `## Error Types\n`;
            for (const { type, count, lastError } of summary.byType) {
                report += `- **${type}**: ${count} occurrences\n`;
                report += `  Last: ${lastError}\n`;
            }
            report += `\n`;
        }

        if (recentErrors.length > 0) {
            report += `## Recent Errors (last 1 hour)\n`;
            for (const error of recentErrors.slice(-20)) { // 最多20条
                report += `- [${error.timestamp}] ${error.type}: ${error.message}\n`;
            }
        }

        return report;
    }

    clearErrors() {
        this.errors = [];
        this.lastSavedFingerprints.clear();
        this.saveErrors();
    }

    // 重置下载状态（cron 分析完删除文件后调用，允许下次有新错误时重新下载）
    resetSavedState() {
        this.lastSavedFingerprints.clear();
    }
}

// 全局实例（用 window 确保跨文件可访问）
    try {
        window.errorMonitor = new ErrorMonitor();
    } catch (e) {
        window.errorMonitor = null;
    }

    // 初始化时加载已修复的错误列表（容错处理）
    (async () => {
        try {
            await errorMonitor.loadFixedErrors();
            console.log(`[Collector] 🛡️ 已加载 ${errorMonitor.fixedErrors.size} 个已修复的错误指纹`);
        } catch (e) {
            console.log('[Collector] errorMonitor 初始化警告:', e.message);
        }
    })();
