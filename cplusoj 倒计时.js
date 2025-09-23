// ==UserScript==
// @name         CPlusOJ 倒计时插件
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  在CPlusOJ网站添加倒计时功能
// @author       Your Name
// @match        http://cplusoj.com/*
// @grant        GM_xmlhttpRequest
// @connect      github.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    // 从GitHub获取固定活动数据
    const fetchFixedEvents = () => {
        return new Promise((resolve, reject) => {
            // 替换为你仓库的实际raw地址
            const url = 'https://raw.githubusercontent.com/wing-heart-awa/cplus-better/main/countdown-events.json';
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    try {
                        const events = JSON.parse(response.responseText);
                        resolve(events);
                    } catch (e) {
                        reject('解析固定活动数据失败: ' + e.message);
                    }
                },
                onerror: function(error) {
                    reject('获取固定活动数据失败: ' + error);
                }
            });
        });
    };

    // 从localStorage获取用户自定义活动
    const getCustomEvents = () => {
        const events = localStorage.getItem('cplusoj_custom_events');
        return events ? JSON.parse(events) : [];
    };

    // 保存用户自定义活动到localStorage
    const saveCustomEvents = (events) => {
        localStorage.setItem('cplusoj_custom_events', JSON.stringify(events));
    };

    // 添加新的自定义活动
    const addCustomEvent = (name, date, remark) => {
        const events = getCustomEvents();
        events.push({ name, date, remark });
        saveCustomEvents(events);
        return events;
    };

    // 删除自定义活动
    const deleteCustomEvent = (index) => {
        const events = getCustomEvents();
        events.splice(index, 1);
        saveCustomEvents(events);
        return events;
    };

    // 计算倒计时
    const calculateCountdown = (targetDate) => {
        const now = new Date();
        const target = new Date(targetDate);
        const diffTime = target - now;
        
        if (diffTime <= 0) {
            return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true };
        }
        
        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffTime % (1000 * 60)) / 1000);
        
        return { days, hours, minutes, seconds, passed: false };
    };

    // 创建倒计时元素
    const createCountdownElement = (event, index, isCustom = false) => {
        const countdown = calculateCountdown(event.date);
        const element = document.createElement('div');
        element.className = 'countdown-item';
        element.style.padding = '10px';
        element.style.borderBottom = '1px solid #eee';
        
        let passedText = '';
        if (countdown.passed) {
            passedText = '<span style="color: #999; margin-left: 10px;">(已结束)</span>';
        }
        
        let deleteButton = '';
        if (isCustom) {
            deleteButton = `<button class="delete-event" data-index="${index}" style="margin-left: 10px; color: #f44336; border: none; background: none; cursor: pointer;">删除</button>`;
        }
        
        element.innerHTML = `
            <div style="font-weight: bold;">${event.name} ${passedText}</div>
            <div>日期: ${event.date}</div>
            ${event.remark ? `<div>备注: ${event.remark}</div>` : ''}
            <div style="color: #2196F3; margin-top: 5px;">
                剩余: ${countdown.days}天 ${countdown.hours}时 ${countdown.minutes}分 ${countdown.seconds}秒
            </div>
            ${deleteButton}
        `;
        
        return element;
    };

    // 创建添加活动的表单
    const createAddEventForm = () => {
        const form = document.createElement('form');
        form.id = 'add-event-form';
        form.style.marginTop = '15px';
        form.style.padding = '10px';
        form.style.border = '1px dashed #ccc';
        
        form.innerHTML = `
            <h3 style="margin-top: 0;">添加自定义活动</h3>
            <div style="margin-bottom: 8px;">
                <label>活动名称: </label>
                <input type="text" name="event-name" required style="width: 200px; margin-right: 10px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label>活动日期: </label>
                <input type="date" name="event-date" required style="margin-right: 10px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label>活动备注: </label>
                <input type="text" name="event-remark" style="width: 200px; margin-right: 10px;">
            </div>
            <button type="submit" style="background-color: #4CAF50; color: white; border: none; padding: 5px 10px; cursor: pointer;">添加</button>
        `;
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = form.querySelector('input[name="event-name"]').value;
            const date = form.querySelector('input[name="event-date"]').value;
            const remark = form.querySelector('input[name="event-remark"]').value;
            
            addCustomEvent(name, date, remark);
            renderCountdowns(); // 重新渲染
            form.reset(); // 重置表单
        });
        
        return form;
    };

    // 渲染所有倒计时
    const renderCountdowns = async () => {
        const container = document.getElementById('countdown-container');
        if (!container) return;
        
        // 清空容器
        container.innerHTML = '<h2 style="margin-top: 0;">重要活动倒计时</h2>';
        
        try {
            // 获取固定活动
            const fixedEvents = await fetchFixedEvents();
            
            // 获取自定义活动
            const customEvents = getCustomEvents();
            
            // 添加固定活动
            if (fixedEvents.length > 0) {
                const fixedSection = document.createElement('div');
                fixedSection.style.marginBottom = '15px';
                fixedSection.innerHTML = '<h3>固定活动</h3>';
                
                fixedEvents.forEach((event, index) => {
                    fixedSection.appendChild(createCountdownElement(event, index));
                });
                
                container.appendChild(fixedSection);
            }
            
            // 添加自定义活动
            if (customEvents.length > 0) {
                const customSection = document.createElement('div');
                customSection.style.marginBottom = '15px';
                customSection.innerHTML = '<h3>自定义活动</h3>';
                
                customEvents.forEach((event, index) => {
                    const element = createCountdownElement(event, index, true);
                    customSection.appendChild(element);
                });
                
                container.appendChild(customSection);
            }
            
            // 添加删除事件监听
            document.querySelectorAll('.delete-event').forEach(button => {
                button.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    deleteCustomEvent(index);
                    renderCountdowns();
                });
            });
            
            // 添加添加活动表单
            container.appendChild(createAddEventForm());
            
        } catch (error) {
            container.innerHTML += `<div style="color: #f44336;">加载活动数据失败: ${error}</div>`;
        }
    };

    // 创建倒计时容器并添加到页面
    const initCountdownContainer = () => {
        // 创建容器
        const container = document.createElement('div');
        container.id = 'countdown-container';
        container.style.backgroundColor = '#f9f9f9';
        container.style.padding = '15px';
        container.style.marginBottom = '20px';
        container.style.borderRadius = '5px';
        container.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        
        // 找到要插入的位置（根据提供的test.html，插入到侧边栏最上方）
        const targetElement = document.querySelector('.large-3.columns');
        if (targetElement) {
            // 在第一个子元素前插入
            if (targetElement.firstChild) {
                targetElement.insertBefore(container, targetElement.firstChild);
            } else {
                targetElement.appendChild(container);
            }
            
            // 初始渲染
            renderCountdowns();
            
            // 每秒更新一次倒计时
            setInterval(renderCountdowns, 1000);
        }
    };

    // 页面加载完成后初始化
    window.addEventListener('load', initCountdownContainer);
})();