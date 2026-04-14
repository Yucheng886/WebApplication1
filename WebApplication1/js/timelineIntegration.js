/**
 * Timeline Integration Module
 * 监听时间轴事件，驱动热力图、图表、路线等模块根据年份动态更新
 */
const TimelineIntegration = (function () {
    let viewer = null;
    let currentYear = 618;
    let heatmapInstance = null;
    let isInitialized = false;

    /**
     * 工具函数: 根据年份从 yearData 中获取对应的诗词数量
     * 采用"不超过目标年份的最大key"策略
     */
    function getCountByYear(yearData, targetYear) {
        if (!yearData) return 0;
        const years = Object.keys(yearData).map(Number).sort((a, b) => a - b);
        let result = 0;
        for (let i = 0; i < years.length; i++) {
            if (years[i] <= targetYear) {
                result = yearData[years[i]];
            } else {
                break;
            }
        }
        return result;
    }

    // 同时挂载到 window 供其他模块使用
    window.getCountByYear = getCountByYear;

    // 诗人生卒年（用于判断某年份哪位诗人在世/创作）
    // 大幅扩充名家生卒年，避免各朝代大部分时段显示“暂无”的情况
    const poetLifespan = {
        // --- 隋末唐初 ---
        '虞世南': { birth: 558, death: 638 },
        '魏徵': { birth: 580, death: 643 },
        '王绩': { birth: 585, death: 644 },
        // --- 唐初 ---
        '骆宾王': { birth: 619, death: 684 },
        '卢照邻': { birth: 632, death: 695 },
        '王勃': { birth: 650, death: 676 },
        '杨炯': { birth: 650, death: 692 },
        '陈子昂': { birth: 661, death: 702 },
        '宋之问': { birth: 656, death: 712 },
        // --- 盛唐 ---
        '贺知章': { birth: 659, death: 744 },
        '张九龄': { birth: 678, death: 740 },
        '王之涣': { birth: 688, death: 742 },
        '孟浩然': { birth: 689, death: 740 },
        '王昌龄': { birth: 698, death: 757 },
        '王维': { birth: 701, death: 761 },
        '李白': { birth: 701, death: 762 },
        '高适': { birth: 704, death: 765 },
        '杜甫': { birth: 712, death: 770 },
        '岑参': { birth: 715, death: 770 },
        // --- 中唐 ---
        '孟郊': { birth: 751, death: 814 },
        '韩愈': { birth: 768, death: 824 },
        '刘禹锡': { birth: 772, death: 842 },
        '白居易': { birth: 772, death: 846 },
        '柳宗元': { birth: 773, death: 819 },
        '元稹': { birth: 779, death: 831 },
        '贾岛': { birth: 779, death: 843 },
        '李贺': { birth: 790, death: 816 },
        // --- 晚唐 ---
        '杜牧': { birth: 803, death: 852 },
        '温庭筠': { birth: 812, death: 866 },
        '李商隐': { birth: 813, death: 858 },
        '韦庄': { birth: 836, death: 910 },
        // --- 五代 ---
        '冯延巳': { birth: 903, death: 960 },
        '李煜': { birth: 937, death: 978 },
        // --- 北宋 ---
        '柳永': { birth: 984, death: 1053 },
        '范仲淹': { birth: 989, death: 1052 },
        '晏殊': { birth: 991, death: 1055 },
        '欧阳修': { birth: 1007, death: 1072 },
        '王安石': { birth: 1021, death: 1086 },
        '苏轼': { birth: 1037, death: 1101 },
        '黄庭坚': { birth: 1045, death: 1105 },
        '秦观': { birth: 1049, death: 1100 },
        '贺铸': { birth: 1052, death: 1125 },
        '周邦彦': { birth: 1056, death: 1121 },
        // --- 两宋与南宋 ---
        '李清照': { birth: 1084, death: 1155 },
        '陆游': { birth: 1125, death: 1210 },
        '范成大': { birth: 1126, death: 1193 },
        '杨万里': { birth: 1127, death: 1206 },
        '辛弃疾': { birth: 1140, death: 1207 },
        '姜夔': { birth: 1155, death: 1209 },
        '吴文英': { birth: 1200, death: 1260 },
        '文天祥': { birth: 1236, death: 1283 }
    };

    /**
     * 初始化
     * @param {Object} cesiumViewer - Cesium viewer 实例
     */
    function init(cesiumViewer) {
        viewer = cesiumViewer;

        // 监听时间轴更新事件
        document.addEventListener('timelineUpdate', function (e) {
            currentYear = e.detail.year;
            _onYearUpdate(currentYear);
        });

        isInitialized = true;
        console.log('TimelineIntegration initialized');
    }

    /**
     * 年份更新回调 - 驱动所有模块刷新
     */
    function _onYearUpdate(year) {
        _updateInfoPanel(year);
        _updateHeatmapByYear(year);
        _updateChartsByYear(year);
        _filterRoutesByYear(year);
    }

    /**
     * 根据年份更新热力图数据
     */
    function _updateHeatmapByYear(year) {
        // 触发自定义事件通知热力图模块
        const event = new CustomEvent('heatmapYearFilter', { detail: { year: year } });
        document.dispatchEvent(event);
    }

    /**
     * 根据年份更新 ECharts 图表
     */
    function _updateChartsByYear(year) {
        const poetryData = window.poetryData;
        if (!poetryData) return;

        // 1. 计算各城市当年诗词量 → 更新城市柱状图 TOP5
        const cityCounts = poetryData.map(city => ({
            name: city.name,
            count: getCountByYear(city.yearData, year)
        })).sort((a, b) => b.count - a.count).slice(0, 5);

        if (window.cityBarChart) {
            window.cityBarChart.setOption({
                title: { text: `${year}年 城市诗词排行` },
                xAxis: { data: cityCounts.map(c => c.name) },
                series: [{
                    data: cityCounts.map(c => c.count),
                    type: 'bar',
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#00ffff' },
                            { offset: 1, color: '#0066ff' }
                        ])
                    },
                    barWidth: '40%'
                }]
            });
        }

        // 2. 计算各诗人当年存活和已创作诗词量 → 更新饼图
        const activePoets = [];
        Object.keys(poetLifespan).forEach(name => {
            const span = poetLifespan[name];
            if (year >= span.birth && year <= span.death + 50) {
                // 计算该诗人在当前年份前已知创作量（基于路线数据）
                let poemCount = _countPoetPoemsByYear(name, year);
                if (poemCount > 0) {
                    activePoets.push({ name: name, value: poemCount });
                }
            }
        });

        if (window.authorPieChart) {
            if (activePoets.length > 0) {
                window.authorPieChart.setOption({
                    title: { text: `${year}年 活跃诗人` },
                    series: [{
                        name: '诗人',
                        type: 'pie',
                        radius: ['25%', '45%'],
                        data: activePoets,
                        label: { fontSize: 9 },
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 8,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        }
                    }]
                });
            } else {
                window.authorPieChart.setOption({
                    title: { text: `${year}年 暂无活跃诗人` },
                    series: [{ data: [] }]
                });
            }
        }

        // 3. 生成朝代累计数据 → 更新折线图
        _updateDynastyChart(year);
    }

    /**
     * 统计某诗人在目标年份前的已知创作量
     */
    function _countPoetPoemsByYear(poetName, targetYear) {
        const allRoutes = window.allRoutes;
        if (!allRoutes) return 0;

        const route = allRoutes.find(r => r.name === poetName);
        if (!route) return 0;

        let count = 0;
        route.path.forEach(location => {
            location.poems.forEach(poem => {
                if (parseInt(poem.year) <= targetYear) {
                    count++;
                }
            });
        });
        return count;
    }

    /**
     * 更新朝代折线图 — 显示到当前年为止各朝代的诗词累计
     */
    function _updateDynastyChart(year) {
        if (!window.dynastyLineChart) return;

        const poetryData = window.poetryData;
        if (!poetryData) return;

        // 计算各朝代时间段的总诗词量
        const dynastyPeriods = [
            { name: '唐初(618-712)', endYear: 712 },
            { name: '盛唐(713-765)', endYear: 765 },
            { name: '中唐(766-835)', endYear: 835 },
            { name: '晚唐(836-907)', endYear: 907 },
            { name: '北宋(960-1127)', endYear: 1127 },
            { name: '南宋(1127-1279)', endYear: 1279 }
        ];

        const displayPeriods = dynastyPeriods.filter(p => p.endYear <= year + 50);
        const periodCounts = displayPeriods.map(period => {
            let total = 0;
            poetryData.forEach(city => {
                total += getCountByYear(city.yearData, Math.min(period.endYear, year));
            });
            return total;
        });

        window.dynastyLineChart.setOption({
            title: { text: `截至${year}年 各时期诗词量` },
            xAxis: {
                type: 'category',
                data: displayPeriods.map(p => p.name),
                axisLabel: { color: '#fff', fontSize: 8, rotate: 15 }
            },
            series: [{
                data: periodCounts,
                type: 'line',
                smooth: true,
                itemStyle: { color: '#00ffff' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(0, 255, 255, 0.4)' },
                        { offset: 1, color: 'rgba(0, 255, 255, 0.05)' }
                    ])
                },
                lineStyle: { width: 2 }
            }]
        });
    }

    /**
     * 根据年份过滤路线上的诗词标记
     * 路线标记保持，但标签可视性根据年份变化
     */
    function _filterRoutesByYear(year) {
        const event = new CustomEvent('routeYearFilter', { detail: { year: year } });
        document.dispatchEvent(event);
    }

    /**
     * 更新时间信息面板
     */
    function _updateInfoPanel(year) {
        const infoPanel = document.getElementById('timelineInfoPanel');
        if (!infoPanel) return;

        const poetryData = window.poetryData;
        if (!poetryData) return;

        // 计算当年全国总诗词量
        let totalCount = 0;
        poetryData.forEach(city => {
            totalCount += getCountByYear(city.yearData, year);
        });

        // 找出当年最多的城市
        let topCity = { name: '-', count: 0 };
        poetryData.forEach(city => {
            const cnt = getCountByYear(city.yearData, year);
            if (cnt > topCity.count) {
                topCity = { name: city.name, count: cnt };
            }
        });

        // 在世诗人数
        let alivePoets = [];
        Object.keys(poetLifespan).forEach(name => {
            const span = poetLifespan[name];
            if (year >= span.birth && year <= span.death) {
                alivePoets.push(name);
            }
        });

        // 朝代
        let dynasty = _getDynasty(year);

        infoPanel.innerHTML = `
            <div class="info-row">
                <span class="info-label">朝代</span>
                <span class="info-value dynasty-tag">${dynasty}</span>
            </div>
            <div class="info-row">
                <span class="info-label">累计诗词</span>
                <span class="info-value">${totalCount.toLocaleString()} 首</span>
            </div>
            <div class="info-row">
                <span class="info-label">诗词最多</span>
                <span class="info-value">${topCity.name}</span>
            </div>
            </div>
        `;
    }

    /**
     * 根据年份获取朝代名称
     */
    function _getDynasty(year) {
        if (year >= 618 && year <= 712) return '唐初';
        if (year >= 713 && year <= 765) return '盛唐';
        if (year >= 766 && year <= 835) return '中唐';
        if (year >= 836 && year <= 907) return '晚唐';
        if (year >= 907 && year <= 960) return '五代十国';
        if (year >= 960 && year <= 1127) return '北宋';
        if (year >= 1127 && year <= 1279) return '南宋';
        return '';
    }

    return {
        init: init
    };
})();
