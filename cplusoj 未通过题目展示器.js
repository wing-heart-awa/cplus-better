// ==UserScript==
// @name         cplusoj 未通过题目展示器
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在任意域展示所有域所有用户最近已尝试，未通过的 5 道题目
// @author       wing_heart(:
// @match        http://cplusoj.com/contest
// @match        http://cplusoj.com/contest?page=*
// @match        http://cplusoj.com/d/*/contest
// @match        http://cplusoj.com/d/*/contest?page=*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // 重要！！请在这里补充所有域的地址！！
    function getAllDomains() {
        // 支持主域和所有 /d/<子域> 格式
        return [
            'http://cplusoj.com',
            'http://cplusoj.com/d/senior',
            'http://cplusoj.com/d/master'
        ];
    }

    // 自动发现所有用户id（从页面或本地存储收集）
    function getAllUserIds(callback) {
        let ids = [];
        document.querySelectorAll('a[href*="uidOrName="]').forEach(a => {
            const match = a.href.match(/uidOrName=([^&]+)/);
            if (match) ids.push(match[1]);
        });
        document.querySelectorAll('a[href*="/user/"]').forEach(a => {
            const match = a.href.match(/\/user\/([^/?#]+)/);
            if (match) ids.push(match[1]);
        });
        const urlMatch = window.location.href.match(/uidOrName=([^&]+)/);
        if (urlMatch) ids.push(urlMatch[1]);
        ids = Array.from(new Set(ids));
        if (ids.length === 0) {
            const userEl = document.querySelector('.user-name, .nav-user__name');
            if (userEl) ids.push(userEl.textContent.trim());
        }
        callback(ids.filter(Boolean));
    }

    function fetchFailedProblemsFromPage(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function(response) {
                console.log('请求URL:', url);
                console.log('返回内容:', response.responseText.slice(0, 500)); // 只显示前500字符
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');
                const allRows = doc.querySelectorAll('tr[data-rid]');
                console.log('抓到的记录行数:', allRows.length);
                const problemRecords = {};
                allRows.forEach(row => {
                    const problemLink = row.querySelector('.col--problem-name a');
                    const statusElement = row.querySelector('.col--status__text');
                    const statusText = statusElement ? statusElement.textContent.trim() : '';
                    const submitTimeElement = row.querySelector('.col--submit-at .time, td.col--submit-at .time, span.time');
                    let submitTime = '未知';
                    let timestamp = null;
                    if (submitTimeElement) {
                        // 优先用 data-tooltip
                        submitTime = submitTimeElement.getAttribute('data-tooltip') || submitTimeElement.textContent.trim();
                        // 解析时间戳（data-timestamp 或 data-tooltip）
                        const ts = submitTimeElement.getAttribute('data-timestamp');
                        if (ts) {
                            timestamp = Number(ts) * 1000;
                        } else if (submitTime) {
                            // 尝试用 Date.parse 解析
                            const parsed = Date.parse(submitTime.replace(/-/g, '/'));
                            timestamp = isNaN(parsed) ? null : parsed;
                        }
                    }
                    if (problemLink && statusElement) {
                        const problemId = problemLink.querySelector('b').textContent;
                        const problemName = problemLink.textContent.replace(problemId, '').trim();
                        const isPassed = statusElement.querySelector('.record-status--icon').classList.contains('pass') &&
                                         statusText.includes('Accepted');
                        if (!problemRecords[problemId]) {
                            problemRecords[problemId] = [];
                        }
                        problemRecords[problemId].push({
                            id: problemId,
                            name: problemName,
                            status: statusText,
                            isPassed: isPassed,
                            submitTime: submitTime,
                            url: problemLink.href,
                            timestamp: timestamp
                        });
                    }
                });
                const failedProblems = [];
                for (const problemId in problemRecords) {
                    const records = problemRecords[problemId];
                    const hasPassedRecord = records.some(record => record.isPassed);
                    if (!hasPassedRecord) {
                        records.sort((a, b) => b.timestamp - a.timestamp);
                        failedProblems.push(records[0]);
                    }
                }
                console.log('未通过题目:', failedProblems);
                callback(failedProblems);
            }
        });
    }

    function fetchAllFailedProblems(callback) {
        getAllUserIds(function(userIds) {
            const domains = getAllDomains();
            console.log('用户ID:', userIds);
            console.log('域名:', domains);
            let allFailed = [];
            let total = domains.length * userIds.length;
            let finished = 0;
            if (total === 0) callback([]);
            domains.forEach(domain => {
                userIds.forEach(uid => {
                    // 兼容主域和 /d/<子域>，都用 /record?uidOrName=xxx
                    const url = `${domain}/record?uidOrName=${encodeURIComponent(uid)}`;
                    fetchFailedProblemsFromPage(url, function(failed) {
                        allFailed = allFailed.concat(failed);
                        finished++;
                        if (finished === total) {
                            // 按时间从新到旧排序
                            allFailed.sort((a, b) => b.timestamp - a.timestamp);
                            console.log('所有未通过题目合并后:', allFailed);
                            callback(allFailed.slice(0, 5));
                        }
                    });
                });
            });
        });
    }

    function createFailedProblemsPanel(failedProblems) {
        if (document.getElementById('failed-problems-panel')) return;
        const targetContainer = document.querySelector('div.medium-9.columns') || document.body;
        targetContainer.style.position = 'relative';
        const panelContainer = document.createElement('div');
        panelContainer.id = 'failed-problems-panel';
        panelContainer.style.position = 'absolute';
        panelContainer.style.right = '-320px';
        panelContainer.style.top = '20px';
        panelContainer.style.width = '300px';
        panelContainer.style.maxHeight = 'calc(100vh - 40px)';
        panelContainer.style.padding = '1rem';
        panelContainer.style.backgroundColor = '#f5f5f5';
        panelContainer.style.borderRadius = '4px';
        panelContainer.style.boxSizing = 'border-box';
        panelContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        panelContainer.style.zIndex = '9999';
        panelContainer.style.overflowY = 'visible'; // 取消滚动条
        panelContainer.style.maxHeight = 'none'; // 高度自适应
        const title = document.createElement('h3');
        title.textContent = '最近未通过题目';
        title.style.color = '#333';
        title.style.borderBottom = '1px solid #ddd';
        title.style.paddingBottom = '0.5rem';
        title.style.marginTop = '0';
        title.style.fontSize = '1.2rem';
        panelContainer.appendChild(title);
        const problemsList = document.createElement('div');
        problemsList.style.marginTop = '1rem';
        // 卡片悬停高亮
        const cardHoverStyle = document.createElement('style');
        cardHoverStyle.textContent = `
        #failed-problems-panel .problem-card:hover {
            box-shadow: 0 4px 16px rgba(33,150,243,0.15);
            background: #e3f2fd;
            border-color: #2196f3;
        }
        `;
        panelContainer.appendChild(cardHoverStyle);
        failedProblems.forEach(problem => {
            const problemItem = document.createElement('div');
            problemItem.className = 'problem-card';
            problemItem.style.background = 'linear-gradient(90deg,#fff,#f9f9f9 70%)';
            problemItem.style.padding = '1rem';
            problemItem.style.borderRadius = '8px';
            problemItem.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
            problemItem.style.marginBottom = '1rem';
            problemItem.style.position = 'relative';
            problemItem.style.transition = 'box-shadow 0.2s, background 0.2s, border-color 0.2s';

            // 题目链接
            const linkRow = document.createElement('div');
            linkRow.style.display = 'flex';
            linkRow.style.alignItems = 'center';
            const problemLink = document.createElement('a');
            problemLink.href = problem.url;
            problemLink.target = '_blank';
            problemLink.style.color = '#d32f2f';
            problemLink.style.textDecoration = 'none';
            problemLink.style.fontWeight = 'bold';
            problemLink.style.fontSize = '1rem';
            problemLink.textContent = `${problem.id} ${problem.name}`;
            problemLink.style.display = 'inline-block';
            problemLink.style.marginRight = '0.5rem';
            linkRow.appendChild(problemLink);
            problemItem.appendChild(linkRow);

            // 状态（高亮）
            const statusDiv = document.createElement('div');
            statusDiv.style.fontSize = '0.95rem';
            statusDiv.style.fontWeight = 'bold';
            statusDiv.style.color = problem.status.includes('Accepted') ? '#43a047' : '#d32f2f';
            statusDiv.style.background = problem.status.includes('Accepted') ? '#e8f5e9' : '#ffebee';
            statusDiv.style.display = 'inline-block';
            statusDiv.style.padding = '2px 10px';
            statusDiv.style.borderRadius = '4px';
            statusDiv.textContent = `状态: ${problem.status}`;
            problemItem.appendChild(statusDiv);

            // 评测得分（如果有）
            if (problem.status.match(/\d+分/)) {
                const scoreDiv = document.createElement('div');
                scoreDiv.style.fontSize = '0.95rem';
                scoreDiv.style.fontWeight = 'bold';
                scoreDiv.style.color = '#ff9800';
                scoreDiv.style.display = 'inline-block';
                scoreDiv.style.marginLeft = '1rem';
                scoreDiv.textContent = problem.status.match(/\d+分/)[0];
                problemItem.appendChild(scoreDiv);
            }

            // 评测信息
            const infoDiv = document.createElement('div');
            infoDiv.style.fontSize = '0.8rem';
            infoDiv.style.color = '#999';
            infoDiv.style.marginTop = '0.5rem';
            infoDiv.textContent = `时间: ${problem.submitTime}`;
            problemItem.appendChild(infoDiv);

            problemsList.appendChild(problemItem);
        });
        if (failedProblems.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.textContent = '暂无未通过的题目记录';
            emptyItem.style.color = '#666';
            emptyItem.style.padding = '1rem';
            problemsList.appendChild(emptyItem);
        }
        panelContainer.appendChild(problemsList);
        targetContainer.appendChild(panelContainer);
    }

    window.addEventListener('load', () => {
        fetchAllFailedProblems(function(recentFailed) {
            createFailedProblemsPanel(recentFailed);
        });
    });
})();