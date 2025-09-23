// ==UserScript==
// @name         cplusoj 补题情况
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  对已参加的比赛，以 zroj 风格展示补题情况，绿色代表通过，灰色代表未通过。
// @author       wing_heart(:
// @match        http://cplusoj.com/d/*/contest*
// @grant        GM_xmlhttpRequest
// @connect      cplusoj.com
// ==/UserScript==

(function() {
    'use strict';

    // 存储已处理的比赛链接，避免重复处理
    const processedContests = new Set();

    // 初始化
    function init() {
        console.log('CPlusOJ 补题情况插件已初始化');
        processContestItems();

        // 监听页面变化（用于分页加载）
        setupMutationObserver();

        // 监听分页链接点击
        setupPaginationListener();
    }

    // 处理所有比赛项目
    function processContestItems() {
        const contestItems = document.querySelectorAll('li.section__list__item.contest__item.contest-type--oi');
        console.log(`找到 ${contestItems.length} 个比赛项目`);

        contestItems.forEach(item => {
            const titleLink = item.querySelector('h1.contest__title a');
            if (!titleLink) return;

            const contestLink = titleLink.href;

            // 只处理未处理过的比赛
            if (!processedContests.has(contestLink)) {
                processedContests.add(contestLink);
                const problemsUrl = `${contestLink}/problems`;
                console.log(`获取补题情况: ${problemsUrl}`);

                fetchSupplementStatus(problemsUrl)
                    .then(statusData => {
                        // 检查元素是否仍然存在于DOM中
                        if (document.contains(titleLink)) {
                            displaySupplementStatusAsDots(titleLink, statusData);
                        }
                    })
                    .catch(error => {
                        console.error(`获取 ${problemsUrl} 补题情况失败:`, error);
                    });
            }
        });
    }

    // 设置页面变化监听器
    function setupMutationObserver() {
        // 找到比赛列表容器（根据页面结构调整选择器）
        const container = document.querySelector('.section__list') || document.body;

        // 创建观察者实例
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                // 检查是否有新节点添加
                if (mutation.addedNodes.length > 0) {
                    console.log('检测到页面内容更新，重新处理比赛项目');
                    processContestItems();
                }
            });
        });

        // 配置观察选项
        const config = {
            childList: true,
            subtree: true
        };

        // 开始观察目标节点
        observer.observe(container, config);
    }

    // 设置分页链接监听器
    function setupPaginationListener() {
        // 监听所有点击事件，判断是否点击了分页链接
        document.addEventListener('click', (e) => {
            const paginationLink = e.target.closest('.pagination a');
            if (paginationLink && paginationLink.href.includes('page=')) {
                console.log('检测到分页操作，准备重新处理比赛项目');

                // 延迟处理，等待新页面加载完成
                setTimeout(() => {
                    processContestItems();
                }, 1000); // 可根据页面加载速度调整延迟时间
            }
        });
    }

    // 获取补题情况数据
    function fetchSupplementStatus(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    if (response.status === 200) {
                        const statusData = parseSupplementStatusHTML(response.responseText);
                        resolve(statusData);
                    } else {
                        reject(new Error(`请求失败，状态码: ${response.status}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // 解析补题情况HTML
    function parseSupplementStatusHTML(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const statusCells = tempDiv.querySelectorAll('td.col--status.record-status--border.col--correction');
        const statusData = [];

        statusCells.forEach(cell => {
            const isPassed = cell.classList.contains('pass');
            const scoreElem = cell.querySelector('.record-status--text span');
            const score = scoreElem ? scoreElem.textContent.trim() : '0';
            const statusText = cell.querySelector('.record-status--text').textContent.trim().replace(score, '').trim();

            statusData.push({
                passed: isPassed,
                score: score,
                status: statusText
            });
        });

        return statusData;
    }

    // 显示补题情况（点式）
    function displaySupplementStatusAsDots(titleElement, statusData) {
        // 检查是否已添加过圆点，避免重复添加
        if (titleElement.nextSibling && titleElement.nextSibling.style.display === 'inline-flex') {
            return;
        }

        const dotsContainer = document.createElement('span');
        dotsContainer.style.marginLeft = '8px';
        dotsContainer.style.display = 'inline-flex';
        dotsContainer.style.gap = '4px';
        dotsContainer.title = '补题情况：绿色表示已完成，深灰色表示未完成';

        statusData.forEach((item, index) => {
            const dot = document.createElement('span');
            dot.style.display = 'inline-block';
            dot.style.width = '8px';
            dot.style.height = '8px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = item.passed ? '#25ad40' : '#888888';
            dot.title = `题目 ${index + 1}: ${item.score} ${item.status}`;

            dotsContainer.appendChild(dot);
        });

        titleElement.parentNode.insertBefore(dotsContainer, titleElement.nextSibling);
    }

    // 页面加载完成后初始化
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
})();
