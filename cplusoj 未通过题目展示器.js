// ==UserScript==
// @name         cplusoj 未通过题目展示器
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在比赛界面展示最近已尝试，未通过的 5 道题目
// @author       wing_heart(:
// @match        http://cplusoj.com/d/*/record?*uidOrName=*
// @match        http://cplusoj.com/d/*/contest?page=*
// @match        http://cplusoj.com/d/*/contest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // 处理记录页面 - 爬取未通过题目
    if (window.location.href.includes('/record?')) {
        function crawlFailedProblems() {
            // 1. 收集所有提交记录
            const allRows = document.querySelectorAll('tr[data-rid]');
            const problemRecords = {}; // 按题目ID分组存储记录 {id: [records...]}
            
            allRows.forEach(row => {
                const problemLink = row.querySelector('.col--problem-name a');
                const statusElement = row.querySelector('.col--status__text');
                const statusText = statusElement ? statusElement.textContent.trim() : '';
                const timeElement = row.querySelector('.col--time');
                const memoryElement = row.querySelector('.col--memory');
                const submitTimeElement = row.querySelector('.col--submit-at .time');
                
                if (problemLink && statusElement) {
                    // 提取题目ID（从<b>标签中）
                    const problemId = problemLink.querySelector('b').textContent;
                    const problemName = problemLink.textContent.replace(problemId, '').trim();
                    
                    // 更准确的通过状态判断（基于class和文本）
                    const isPassed = statusElement.querySelector('.record-status--icon').classList.contains('pass') && 
                                   statusText.includes('Accepted');
                    
                    const time = timeElement ? timeElement.textContent : '未知';
                    const memory = memoryElement ? memoryElement.textContent : '未知';
                    const submitTime = submitTimeElement ? submitTimeElement.getAttribute('data-tooltip') : '未知';
                    const timestamp = new Date(submitTime).getTime();
                    
                    // 按题目ID分组存储
                    if (!problemRecords[problemId]) {
                        problemRecords[problemId] = [];
                    }
                    problemRecords[problemId].push({
                        id: problemId,
                        name: problemName,
                        status: statusText,
                        isPassed: isPassed,
                        time: time,
                        memory: memory,
                        submitTime: submitTime,
                        url: problemLink.href,
                        timestamp: timestamp
                    });
                }
            });
            
            // 2. 过滤出从未通过的题目
            const failedProblems = [];
            for (const problemId in problemRecords) {
                const records = problemRecords[problemId];
                // 检查该题目是否有通过记录
                const hasPassedRecord = records.some(record => record.isPassed);
                
                if (!hasPassedRecord) {
                    // 取最新的一条失败记录
                    records.sort((a, b) => b.timestamp - a.timestamp);
                    failedProblems.push(records[0]);
                }
            }
            
            // 3. 按时间排序并限制数量
            failedProblems.sort((a, b) => b.timestamp - a.timestamp);
            if (failedProblems.length > 20) {
                failedProblems.splice(20); // 避免直接赋值引起的变量声明问题
            }
            
            GM_setValue('failedProblems', failedProblems);
        }
        
        // 页面加载完成后执行，对于动态加载的内容可能需要延迟
        window.addEventListener('load', () => {
            setTimeout(crawlFailedProblems, 1000); // 增加延迟确保内容加载完成
        });
    }
    
    // 处理比赛页面 - 展示未通过题目
    else if (window.location.href.includes('/contest')) {
        // 保持原有的展示逻辑不变
        function createFailedProblemsPanel(failedProblems) {
            if (document.getElementById('failed-problems-panel')) {
                return;
            }
            
            const targetContainer = document.querySelector('div.medium-9.columns');
            if (!targetContainer) {
                console.error('未找到medium-9.columns容器，无法创建面板');
                return;
            }
            
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
            panelContainer.style.overflowY = 'auto';
            
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
            
            failedProblems.forEach(problem => {
                const problemItem = document.createElement('div');
                problemItem.style.backgroundColor = 'white';
                problemItem.style.padding = '0.8rem';
                problemItem.style.borderRadius = '4px';
                problemItem.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                problemItem.style.marginBottom = '0.8rem';
                
                const problemLink = document.createElement('a');
                problemLink.href = problem.url;
                problemLink.target = '_blank';
                problemLink.style.color = '#d32f2f';
                problemLink.style.textDecoration = 'none';
                problemLink.style.fontWeight = 'bold';
                problemLink.style.fontSize = '0.9rem';
                problemLink.textContent = `${problem.id} ${problem.name}`;
                problemLink.style.display = 'block';
                problemLink.style.marginBottom = '0.3rem';
                
                const statusDiv = document.createElement('div');
                statusDiv.style.fontSize = '0.8rem';
                statusDiv.style.color = '#666';
                statusDiv.textContent = `状态: ${problem.status}`;
                
                const infoDiv = document.createElement('div');
                infoDiv.style.fontSize = '0.7rem';
                infoDiv.style.color = '#999';
                infoDiv.textContent = `时间: ${problem.time} | 内存: ${problem.memory}`;
                
                problemItem.appendChild(problemLink);
                problemItem.appendChild(statusDiv);
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
            const allFailed = GM_getValue('failedProblems', []);
            const recentFailed = allFailed.slice(0, 5);
            createFailedProblemsPanel(recentFailed);
        });
    }
})();