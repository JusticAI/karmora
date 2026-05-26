/**
 * Reddit Community Collector - Popup Script (支持同步阶段1进度)
 */

document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        startBtn: document.getElementById('startBtn'),
        stopBtn: document.getElementById('stopBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        resetBtn: document.getElementById('resetBtn'),
        totalCount: document.getElementById('totalCount'),
        completedCount: document.getElementById('completedCount'),
        errorCount: document.getElementById('errorCount'),
        requestCount: document.getElementById('requestCount'),
        progressFill: document.getElementById('progressFill'),
        statusText: document.getElementById('statusText'),
        stageSelector: document.getElementById('stageSelector'),
        stage1Status: document.getElementById('stage1Status'),
        stage2Status: document.getElementById('stage2Status'),
        stage3Status: document.getElementById('stage3Status'),
    };

    let selectedStage = 2;

    // ============ 阶段选择 ============
    const stageItems = elements.stageSelector.querySelectorAll('.stage-item');
    stageItems.forEach(item => {
        item.addEventListener('click', () => {
            stageItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedStage = parseInt(item.dataset.stage);
        });
    });
    stageItems[1].classList.add('selected');

    // ============ 更新 UI ============
    function updateUI(data) {
        if (!data) return;
        
        elements.totalCount.textContent = data.total || 0;
        elements.completedCount.textContent = data.totalCompleted || 0;
        elements.errorCount.textContent = data.errors || 0;
        elements.requestCount.textContent = data.requests || 0;

        const stageProgress = data.stageProgress || {};
        const total = data.total || 1;
        
        elements.stage1Status.textContent = `${stageProgress[1] || 0} / ${total}`;
        elements.stage2Status.textContent = `${stageProgress[2] || 0} / ${total}`;
        elements.stage3Status.textContent = `${stageProgress[3] || 0} / ${total}`;

        const currentStage = data.currentStage || 1;
        const stageNumbers = elements.stageSelector.querySelectorAll('.stage-number');
        stageNumbers[0].className = 'stage-number' + 
            (currentStage === 1 ? ' active' : (stageProgress[1] >= total ? ' complete' : ''));
        stageNumbers[1].className = 'stage-number' + 
            (currentStage === 2 ? ' active' : (stageProgress[2] >= total ? ' complete' : ''));
        stageNumbers[2].className = 'stage-number' + 
            (currentStage === 3 ? ' active' : (stageProgress[3] >= total ? ' complete' : ''));

        const totalCompleted = data.totalCompleted || 0;
        const totalItems = total * 3;
        const progress = totalItems > 0 ? (totalCompleted / totalItems * 100) : 0;
        elements.progressFill.style.width = `${progress}%`;

        if (data.isComplete) {
            elements.statusText.textContent = '✅ 全部完成!';
            elements.statusText.className = 'status complete';
            elements.startBtn.disabled = true;
            elements.stopBtn.disabled = true;
            elements.downloadBtn.disabled = false;
        } else if (data.isRunning) {
            const stageNames = { 1: '基础信息+规则', 2: '版主+提交指南', 3: 'Wiki内容' };
            elements.statusText.textContent = `⏳ 阶段${currentStage}: ${stageNames[currentStage]}`;
            elements.statusText.className = 'status running';
            elements.startBtn.disabled = true;
            elements.stopBtn.disabled = false;
            elements.downloadBtn.disabled = true;
        } else if (data.total > 0) {
            elements.statusText.textContent = `⏸️ 已暂停 (可选择起始阶段)`;
            elements.statusText.className = 'status';
            elements.startBtn.disabled = false;
            elements.stopBtn.disabled = true;
            elements.downloadBtn.disabled = false;
        } else {
            elements.statusText.textContent = '等待加载数据';
            elements.statusText.className = 'status';
            elements.startBtn.disabled = true;
            elements.stopBtn.disabled = true;
            elements.downloadBtn.disabled = true;
        }
    }

    async function refreshStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url && tab.url.includes('reddit.com')) {
                chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
                    if (chrome.runtime.lastError) return;
                    if (response) updateUI(response);
                });
            }
        } catch (e) {}
    }



    // ============ 开始采集 ============
    elements.startBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, { 
            type: 'START_COLLECTOR',
            startStage: selectedStage
        }, (response) => {
            if (response && response.success) {
                elements.startBtn.disabled = true;
                elements.stopBtn.disabled = false;
                startStatusPolling();
            }
        });
    });

    // ============ 停止采集 ============
    elements.stopBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'STOP_COLLECTOR' }, (response) => {
            if (response && response.success) {
                elements.startBtn.disabled = false;
                elements.stopBtn.disabled = true;
                stopStatusPolling();
                refreshStatus();
            }
        });
    });

    // ============ 下载结果 ============
    elements.downloadBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'DOWNLOAD_ALL' });
    });

    // ============ 重置 ============
    elements.resetBtn.addEventListener('click', async () => {
        if (!confirm('确定要重置所有数据吗？')) return;
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'RESET' }, (response) => {
            if (response && response.success) {
                elements.startBtn.disabled = true;
                elements.stopBtn.disabled = true;
                elements.downloadBtn.disabled = true;
                updateUI({ total: 0, totalCompleted: 0, errors: 0, requests: 0 });
                qualitySection.style.display = 'none';
            }
        });
    });

    // ============ 状态轮询 ============
    let pollingInterval = null;

    function startStatusPolling() {
        if (pollingInterval) return;
        pollingInterval = setInterval(refreshStatus, 3000);
    }

    function stopStatusPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    // ============ 初始化 ============
    refreshStatus();

    // 初始化时检查采集器状态，如果在运行则自动开始轮询
    setTimeout(async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url && tab.url.includes('reddit.com')) {
                chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
                    if (response && response.isRunning) {
                        startStatusPolling();
                    }
                });
            }
        } catch (e) {}
    }, 500);

    // ============ 数据质量检查 ============
    const checkBtn = document.getElementById('checkBtn');
    const qualitySection = document.getElementById('qualitySection');
    const qualityReport = document.getElementById('qualityReport');

    // ============ 错误报告 ============
    const bugReportBtn = document.getElementById('bugReportBtn');

    bugReportBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !tab.url.includes('reddit.com')) {
            alert('请先打开 Reddit 页面');
            return;
        }

        bugReportBtn.textContent = '生成中...';
        bugReportBtn.disabled = true;

        chrome.tabs.sendMessage(tab.id, { type: 'GET_ERROR_REPORT' }, (response) => {
            bugReportBtn.textContent = '🐛 生成错误报告';
            bugReportBtn.disabled = false;

            if (chrome.runtime.lastError) {
                alert('生成报告失败: ' + chrome.runtime.lastError.message);
                return;
            }

            if (response && response.success) {
                const { report, summary = {} } = response;
                
                // 创建可下载的报告文件
                const blob = new Blob([report], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `collector-bug-report-${new Date().toISOString().slice(0, 10)}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                // 显示摘要
                if (summary.recent > 0) {
                    alert(`发现 ${summary.recent} 个最近错误，报告已下载`);
                } else {
                    alert('最近没有错误，报告已下载');
                }
            }
        });
    });

    checkBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !tab.url.includes('reddit.com')) {
            alert('请先打开 Reddit 页面');
            return;
        }

        checkBtn.textContent = '检查中...';
        checkBtn.disabled = true;

        chrome.tabs.sendMessage(tab.id, { type: 'CHECK_QUALITY' }, (response) => {
            checkBtn.textContent = '🔍 检查质量';
            checkBtn.disabled = false;

            if (chrome.runtime.lastError) {
                alert('检查失败: ' + chrome.runtime.lastError.message);
                return;
            }

            if (response && response.success) {
                const report = response.report;
                qualitySection.style.display = 'block';

                let html = `<div style="margin-bottom: 8px;"><strong>质量评分: ${report.qualityScore}/100</strong></div>`;
                html += `<div>📊 总社区数: ${report.total}</div>`;
                html += `<div>✅ 阶段1完成: ${report.stage1Completed}</div>`;
                html += `<div>✅ 阶段2完成: ${report.stage2Completed}</div>`;
                html += `<div>✅ 阶段3完成: ${report.stage3Completed}</div>`;

                if (report.issues.length > 0) {
                    html += `<div style="margin-top: 8px; color: #e74c3c;"><strong>发现的问题:</strong></div>`;
                    for (const issue of report.issues) {
                        html += `<div style="color: #e74c3c;">${issue}</div>`;
                    }
                }

                if (report.recommendations.length > 0) {
                    html += `<div style="margin-top: 8px; color: #f39c12;"><strong>建议:</strong></div>`;
                    for (const rec of report.recommendations) {
                        html += `<div style="color: #f39c12;">${rec}</div>`;
                    }
                }

                qualityReport.innerHTML = html;
            } else {
                alert('检查失败: ' + (response?.error || '未知错误'));
            }
        });
    });
});
