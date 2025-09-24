// ==UserScript==
// @name         cplusoj 倒计时
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  首页显示倒计时
// @author       wing_heart(:
// @match        http://cplusoj.com
// @match        http://cplusoj.com/d/*/
// @grant        GM_xmlhttpRequest
// @connect      github.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    // 从GitHub获取固定活动数据
    const fetchFixedEvents = () => {
        return new Promise((resolve, reject) => {
            const url = 'https://raw.githubusercontent.com/wing-heart-awa/cplus-better/main/倒计时.json';

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    try {
                        const events = JSON.parse(response.responseText);
                        events.forEach(event => event.isFixed = true);
                        resolve(events);
                    } catch (e) {
                        reject(`解析解析JSON失败: ${e.message}`);
                    }
                },
                onerror: function() {
                    reject('网络请求失败: 无法连接到服务器');
                }
            });
        });
    };

    // 本地存储相关函数
    const getCustomEvents = () => {
        const events = localStorage.getItem('cplusoj_custom_events');
        return events ? JSON.parse(events).map(event => ({...event, isFixed: false})) : [];
    };

    const saveCustomEvents = (events) => {
        localStorage.setItem('cplusoj_custom_events', JSON.stringify(events));
    };

    const addCustomEvent = (name, date, remark) => {
        const events = getCustomEvents();
        events.push({ name, date, remark, isFixed: false });
        saveCustomEvents(events);
        return events;
    };

    const deleteCustomEvent = (index) => {
        const events = getCustomEvents();
        events.splice(index, 1);
        saveCustomEvents(events);
        return events;
    };

    // 切换活动管理区域折叠状态
    const toggleManagementCollapse = () => {
        const isCollapsed = localStorage.getItem('countdown_management_collapsed') !== 'false';
        localStorage.setItem('countdown_management_collapsed', !isCollapsed);
        updateManagementCollapseState(!isCollapsed);
    };

    // 更新活动管理区域折叠状态UI
    const updateManagementCollapseState = (isCollapsed) => {
        const content = document.getElementById('management-content');
        const toggleBtn = document.getElementById('management-toggle');

        if (content && toggleBtn) {
            content.style.display = isCollapsed ? 'none' : 'block';
            toggleBtn.textContent = isCollapsed ? '展开' : '折叠';
        }
    };

    // 计算倒计时（精确到天）
    const calculateCountdown = (targetDate) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const target = new Date(targetDate);
        target.setHours(0, 0, 0, 0);

        const diffTime = target - now;
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
            days: Math.max(0, days),
            passed: days <= 0,
            timestamp: target.getTime()
        };
    };

    // 更新倒计时显示
    const updateCountdownDisplay = (element, event) => {
        const countdown = calculateCountdown(event.date);
        const daysElement = element.querySelector('.countdown-days');
        const passedElement = element.querySelector('.countdown-passed');
        const daysContainer = element.querySelector('.countdown-days-container');

        if (daysElement) {
            daysElement.textContent = countdown.days;
        }

        if (passedElement) {
            passedElement.style.display = countdown.passed ? 'inline' : 'none';
        }

        // 更新天数容器样式 - 根据新要求调整颜色
        if (daysContainer) {
            if (countdown.passed) {
                daysContainer.style.color = '#9e9e9e';
                daysContainer.style.backgroundColor = '#f5f5f5';
            } else if (countdown.days <= 7) {
                // 7天内 - 红色系
                daysContainer.style.color = '#d32f2f';
                daysContainer.style.backgroundColor = '#ffebee';
            } else if (countdown.days <= 28) {
                // 28天内 - 橙色系
                daysContainer.style.color = '#f57c00';
                daysContainer.style.backgroundColor = '#fff3e0';
            } else if (countdown.days <= 60) {
                // 60天内 - 蓝色系
                daysContainer.style.color = '#1976d2';
                daysContainer.style.backgroundColor = '#e3f2fd';
            } else {
                // 60天以上 - 绿色系
                daysContainer.style.color = '#2e7d32';
                daysContainer.style.backgroundColor = '#e8f5e9';
            }
        }
    };

    // 创建倒计时元素
    const createCountdownElement = (event, index) => {
        const countdown = calculateCountdown(event.date);
        const element = document.createElement('div');
        element.className = 'countdown-item';
        element.style.padding = '12px 15px';
        element.style.borderRadius = '8px';
        element.style.marginBottom = '10px';
        element.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
        element.style.backgroundColor = 'white';
        element.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
        element.dataset.eventDate = event.date;
        element.dataset.eventIndex = index;

        // 鼠标悬停效果
        element.addEventListener('mouseenter', () => {
            element.style.transform = 'translateY(-2px)';
            element.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.transform = 'translateY(0)';
            element.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
        });

        // 为固定活动添加标识
        const fixedBadge = event.isFixed ?
            '<span style="background-color: #e3f2fd; color: #0d47a1; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px; font-weight: normal;">固定</span>' : '';

        let passedStyle = countdown.passed ? 'display: inline;' : 'display: none;';

        // 只有自定义活动显示删除按钮
        let deleteButton = '';
        if (!event.isFixed) {
            deleteButton = `<button class="delete-event" data-index="${index}" style="margin-left: 10px; color: #f44336; border: none; background: none; cursor: pointer; font-size: 0.9rem; opacity: 0.7; transition: opacity 0.2s;">删除</button>`;
        }

        // 根据剩余天数设置不同样式 - 根据新要求调整颜色
        let daysStyle = '';
        if (countdown.passed) {
            daysStyle = 'color: #9e9e9e; background-color: #f5f5f5;';
        } else if (countdown.days <= 7) {
            // 7天内 - 红色系
            daysStyle = 'color: #d32f2f; background-color: #ffebee;';
        } else if (countdown.days <= 28) {
            // 28天内 - 橙色系
            daysStyle = 'color: #f57c00; background-color: #fff3e0;';
        } else if (countdown.days <= 60) {
            // 60天内 - 蓝色系
            daysStyle = 'color: #1976d2; background-color: #e3f2fd;';
        } else {
            // 60天以上 - 绿色系
            daysStyle = 'color: #2e7d32; background-color: #e8f5e9;';
        }

        element.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span>${event.name} ${fixedBadge}
                    <span class="countdown-passed" style="color: #999; margin-left: 10px; ${passedStyle}; font-weight: normal;">(已结束)</span>
                </span>
                ${deleteButton}
            </div>
            <div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">日期: ${event.date}</div>
            ${event.remark ? `<div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">备注: ${event.remark}</div>` : ''}
            <div class="countdown-days-container" style="${daysStyle} display: inline-block; padding: 3px 10px; border-radius: 4px; margin-top: 5px; font-weight: bold;">
                剩余: <span class="countdown-days">${countdown.days}</span> 天
            </div>
        `;

        // 为删除按钮添加悬停效果
        const delBtn = element.querySelector('.delete-event');
        if (delBtn) {
            delBtn.addEventListener('mouseenter', () => {
                delBtn.style.opacity = '1';
            });
            delBtn.addEventListener('mouseleave', () => {
                delBtn.style.opacity = '0.7';
            });
        }

        return element;
    };

    // 创建添加活动的表单
    const createAddEventForm = () => {
        const form = document.createElement('form');
        form.id = 'add-event-form';
        form.style.marginTop = '10px';
        form.style.padding = '15px';
        form.style.border = '1px dashed #ccc';
        form.style.borderRadius = '8px';
        form.style.backgroundColor = 'white';

        form.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 1.1rem; color: #424242;">添加自定义活动</h3>
            <div style="margin-bottom: 12px; width: 100%; box-sizing: border-box;">
                <label style="display: inline-block; width: 70px; font-size: 0.9rem; color: #666;">名称: </label>
                <input type="text" name="event-name" required style="width: calc(100% - 80px); padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; transition: border 0.2s;">
            </div>
            <div style="margin-bottom: 12px; width: 100%; box-sizing: border-box;">
                <label style="display: inline-block; width: 70px; font-size: 0.9rem; color: #666;">日期: </label>
                <input type="date" name="event-date" required style="width: calc(100% - 80px); padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 12px; width: 100%; box-sizing: border-box;">
                <label style="display: inline-block; width: 70px; font-size: 0.9rem; color: #666;">备注: </label>
                <input type="text" name="event-remark" style="width: calc(100% - 80px); padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; transition: border 0.2s;">
            </div>
            <button type="submit" style="background-color: #4CAF50; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; transition: background-color 0.2s;">添加活动</button>
        `;

        // 为输入框添加焦点效果
        const inputs = form.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.border = '1px solid #4CAF50';
                input.style.borderColor = '#4CAF50';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#ddd';
            });
        });

        // 为按钮添加悬停效果
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.addEventListener('mouseenter', () => {
            submitBtn.style.backgroundColor = '#3d9140';
        });
        submitBtn.addEventListener('mouseleave', () => {
            submitBtn.style.backgroundColor = '#4CAF50';
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = form.querySelector('input[name="event-name"]').value;
            const date = form.querySelector('input[name="event-date"]').value;
            const remark = form.querySelector('input[name="event-remark"]').value;

            addCustomEvent(name, date, remark);
            renderCountdowns();
            form.reset();
        });

        return form;
    };

    // 创建活动管理区域（默认折叠）
    const createManagementSection = () => {
    // 默认折叠（始终初始为折叠）
    const isCollapsed = true;

        const section = document.createElement('div');
        section.className = 'management-section';
        section.style.marginTop = '15px';
        section.style.borderRadius = '8px';
        section.style.overflow = 'hidden';
        section.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';

        // 标题栏
        const header = document.createElement('div');
        header.style.backgroundColor = '#f5f5f5';
        header.style.padding = '10px 15px';
        header.style.fontWeight = 'bold';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.cursor = 'pointer';

        header.innerHTML = `
            <span style="color: #424242;">添加活动</span>
            <button id="management-toggle" class="collapse-toggle" style="background: #e0e0e0; border: none; border-radius: 4px; padding: 3px 10px; cursor: pointer; font-size: 0.8rem; transition: background 0.2s;">
                ${isCollapsed ? '展开' : '折叠'}
            </button>
        `;

        // 内容区域
        const content = document.createElement('div');
        content.id = 'management-content';
        content.style.display = isCollapsed ? 'none' : 'block';

        content.appendChild(createAddEventForm());

        section.appendChild(header);
        section.appendChild(content);

        // 添加折叠/展开事件
        header.addEventListener('click', toggleManagementCollapse);
        
        // 按钮悬停效果
        const toggleBtn = header.querySelector('.collapse-toggle');
        toggleBtn.addEventListener('mouseenter', () => {
            toggleBtn.style.background = '#d0d0d0';
        });
        toggleBtn.addEventListener('mouseleave', () => {
            toggleBtn.style.background = '#e0e0e0';
        });

        return section;
    };

    // 初始渲染所有倒计时
    const renderCountdowns = async () => {
        const container = document.getElementById('countdown-container');
        if (!container) return;

        // 清空容器并添加标题（移除更新日期）
        container.innerHTML = `
            <div style="margin-bottom: 15px;">
                <h2 style="margin: 0; font-size: 1.3rem; color: #212121;">重要活动倒计时</h2>
            </div>
        `;

        try {
            // 获取所有活动并合并
            const fixedEvents = await fetchFixedEvents();
            const customEvents = getCustomEvents();
            let allEvents = [...fixedEvents, ...customEvents];

            // 按日期排序（最近的在前面）
            allEvents.sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return dateA - dateB;
            });

            // 创建活动列表容器
            const eventsList = document.createElement('div');
            eventsList.style.marginBottom = '10px';

            // 添加所有活动（为自定义活动重新计算索引）
            let customIndex = 0;
            allEvents.forEach((event, index) => {
                // 仅为自定义活动计算实际索引
                const displayIndex = event.isFixed ? index : customIndex++;
                eventsList.appendChild(createCountdownElement(event, displayIndex));
            });

            // 如果没有活动
            if (allEvents.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.style.textAlign = 'center';
                emptyState.style.padding = '20px';
                emptyState.style.color = '#757575';
                emptyState.style.backgroundColor = 'white';
                emptyState.style.borderRadius = '8px';
                emptyState.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                emptyState.innerHTML = '暂无活动数据<br>可在下方添加自定义活动';
                eventsList.appendChild(emptyState);
            }

            container.appendChild(eventsList);

            // 添加删除事件监听（只针对自定义活动）
            document.querySelectorAll('.delete-event').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation(); // 防止触发父元素事件
                    const index = parseInt(e.target.dataset.index);
                    deleteCustomEvent(index);
                    renderCountdowns();
                });
            });

            // 添加活动管理区域（默认折叠）
            container.appendChild(createManagementSection());

        } catch (error) {
            console.error('加载活动数据失败:', error);
            container.innerHTML += `
                <div style="color: #d32f2f; margin-top: 10px; padding: 15px; background-color: #ffebee; border-radius: 8px; border-left: 4px solid #d32f2f;">
                    <div style="font-weight: bold; margin-bottom: 5px;">加载活动数据失败</div>
                    <div style="font-size: 0.9rem;">${error}</div>
                    <div style="font-size: 0.85rem; margin-top: 8px; color: #757575;">
                        请检查网络连接或JSON文件是否正确
                    </div>
                </div>
            `;
        }
    };

    // 更新所有倒计时数值
    const updateAllCountdowns = () => {
        document.querySelectorAll('.countdown-item').forEach(element => {
            const eventDate = element.dataset.eventDate;
            if (eventDate) {
                updateCountdownDisplay(element, { date: eventDate });
            }
        });
    };

    // 初始化函数
    const initCountdownContainer = () => {
        // 创建容器
        const container = document.createElement('div');
        container.id = 'countdown-container';
        container.style.backgroundColor = '#f9f9f9';
        container.style.padding = '20px';
        container.style.marginBottom = '20px';
        container.style.borderRadius = '10px';
        container.style.boxShadow = '0 3px 10px rgba(0,0,0,0.08)';
        container.style.maxWidth = '100%';
        container.style.boxSizing = 'border-box';

        // 插入到页面
        const targetElement = document.querySelector('.large-3.columns') ||
                             document.querySelector('.container') ||
                             document.body;

        if (targetElement) {
            if (targetElement.firstChild) {
                targetElement.insertBefore(container, targetElement.firstChild);
            } else {
                targetElement.appendChild(container);
            }

            // 初始渲染
            renderCountdowns();

            // 设置每天午夜更新
            const now = new Date();
            const midnight = new Date(now);
            midnight.setHours(24, 0, 0, 0);
            const timeToMidnight = midnight - now;

            setTimeout(() => {
                updateAllCountdowns();
                setInterval(updateAllCountdowns, 24 * 60 * 60 * 1000);
            }, timeToMidnight);
        }
    };

    // 页面加载完成后初始化
    window.addEventListener('load', initCountdownContainer);
})();