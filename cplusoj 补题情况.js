// ==UserScript==
// @name         cplusoj 补题情况
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  对已参加的比赛，以 zroj 风格展示补题情况，绿色代表通过，灰色代表未通过。
// @author       wing_heart(:
// @match        http://cplusoj.com/*contest*
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
        // 匹配比赛列表中的OI和IOI类型比赛元素
        const contestItems = document.querySelectorAll(
            'li.section__list__item.contest__item.contest-type--oi, ' +
            'li.section__list__item.contest__item.contest-type--ioi'
        );
        console.log(`找到 ${contestItems.length} 个比赛项目`);

        contestItems.forEach(item => {
            // 只处理已参加的比赛
            const attended = item.querySelector('ul.supplementary.list .contest__info-attended');
            if (!attended) return;

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

    // 解析补题情况HTML（只爬取题目区块，参考test.html结构）
    function parseSupplementStatusHTML(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        // 精确定位第一个题目区块
        const h1 = tempDiv.querySelector('.medium-9.columns > div:nth-child(1) > div.section__header > h1');
        if (!h1 || h1.textContent.trim() !== '题目') {
            console.warn('[补题情况] 未找到第一个题目区块的h1');
            return [];
        }
        // 获取题目区块div.section
        const problemSection = h1.closest('div.section');
        if (!problemSection) {
            console.warn('[补题情况] 未找到题目区块的section');
            return [];
        }
        // 直接在题目区块下查找所有tr（不依赖tbody）
        const rows = problemSection.querySelectorAll('tr');
        console.log('[补题情况] 题目区块tr数量:', rows.length);
        const statusData = [];
        rows.forEach((row, i) => {
            // 题目名和链接
            const problemCell = row.querySelector('td.col--problem.col--problem-name');
            const problemLink = problemCell ? problemCell.querySelector('a') : null;
            if (!problemLink) return;
            const problemName = problemLink.textContent.trim();
            const problemUrl = problemLink.href;
            // 补题状态
            const correctionCell = row.querySelector('td.col--status.record-status--border.col--correction');
            const isPassed = correctionCell && correctionCell.classList.contains('pass');
            const correctionStatus = correctionCell ? correctionCell.textContent.trim() : '';
            // 赛时提交状态（分数和状态）
            const statusCell = row.querySelector('td.col--status.record-status--border');
            let score = '';
            let statusText = '';
            if (statusCell) {
                const scoreSpan = statusCell.querySelector('span[style*="color"]');
                score = scoreSpan ? scoreSpan.textContent.trim() : '';
                const statusA = statusCell.querySelector('a.record-status--text');
                statusText = statusA ? statusA.textContent.trim() : statusCell.textContent.trim();
            }
            // 状态优先级：补题 > 赛时 > 未提交
            let showStatus = '未提交';
            if (correctionStatus) {
                showStatus = correctionStatus;
            } else if (statusText) {
                showStatus = statusText;
            }
            statusData.push({
                passed: isPassed,
                name: problemName,
                url: problemUrl,
                status: showStatus,
                score: score
            });
        });
        return statusData;
    }

    // 显示补题情况（点式，优化悬浮卡片UI）
    function displaySupplementStatusAsDots(titleElement, statusData) {
        // 检查是否已添加过圆点，避免重复添加
        if (titleElement.nextSibling && titleElement.nextSibling.style.display === 'inline-flex') {
            return;
        }
        const dotsContainer = document.createElement('span');
        dotsContainer.style.marginLeft = '10px';
        dotsContainer.style.display = 'inline-flex';
        dotsContainer.style.gap = '12px'; // 间距更大
        dotsContainer.style.verticalAlign = 'middle';
        dotsContainer.style.position = 'relative';
        dotsContainer.style.top = '-2px';

        // 只创建一个全局悬浮卡片，所有圆点共用
        let hoverCard = document.getElementById('cplusoj-hover-card');
        if (!hoverCard) {
            hoverCard = document.createElement('div');
            hoverCard.id = 'cplusoj-hover-card';
            hoverCard.style.position = 'fixed';
            hoverCard.style.zIndex = '9999';
            hoverCard.style.background = '#fff';
            hoverCard.style.border = '1px solid #e0e0e0';
            hoverCard.style.borderRadius = '8px';
            hoverCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
            hoverCard.style.padding = '8px 16px';
            hoverCard.style.fontSize = '14px';
            hoverCard.style.color = '#333';
            hoverCard.style.pointerEvents = 'none';
            hoverCard.style.display = 'none';
            document.body.appendChild(hoverCard);
        }

        statusData.forEach((item, index) => {
            const dot = document.createElement('span');
            dot.style.display = 'inline-block';
            dot.style.width = '12px'; // 更大
            dot.style.height = '12px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = item.passed ? '#25ad40' : '#9b9b9bff';
            dot.style.cursor = 'pointer';
            dot.addEventListener('mouseenter', (e) => {
                hoverCard.innerHTML = `<b style='font-size:15px;'>${item.name}</b><br><span style='color:${item.passed ? '#25ad40' : '#9b9b9b'};'>${item.status}${item.score ? '（得分：'+item.score+'）' : ''}</span>`;
                hoverCard.style.display = 'block';
            });
            dot.addEventListener('mousemove', (e) => {
                // 跟随鼠标实时定位
                hoverCard.style.left = e.clientX + 18 + 'px';
                hoverCard.style.top = e.clientY - 8 + 'px';
            });
            dot.addEventListener('mouseleave', () => {
                hoverCard.style.display = 'none';
            });
            dot.addEventListener('click', () => {
                if (item.url) window.open(item.url, '_blank');
            });
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
