const SpatialAnalysisManager = (function() {
    let viewer = null;
    let handler = null;
    let activeShapePoints = [];
    let activeShape = null;
    let floatingPoint = null;
    let currentMode = null; // 'rect' | 'circle'
    let drawnEntities = []; // store drawn entities

    function init(cesiumViewer) {
        viewer = cesiumViewer;
        handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

        document.getElementById('btnDrawRect').addEventListener('click', () => startDrawing('rect'));
        document.getElementById('btnDrawCircle').addEventListener('click', () => startDrawing('circle'));
        document.getElementById('btnClearSpatial').addEventListener('click', clearAll);
        document.getElementById('closeSpatialResultBtn').addEventListener('click', closeResultPanel);

        // 初始化文化漫游事件
        const themeBtns = document.querySelectorAll('.culture-theme-btn');
        themeBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const themeId = this.getAttribute('data-theme');
                activateCulturalTheme(themeId);
            });
        });
    }

    function createPoint(worldPosition) {
        return viewer.entities.add({
            position: worldPosition,
            point: {
                color: Cesium.Color.AQUA,
                pixelSize: 5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    }

    function drawShape(positionData) {
        if (currentMode === 'rect') {
            return viewer.entities.add({
                rectangle: {
                    coordinates: new Cesium.CallbackProperty(function () {
                        const pos1 = Cesium.Cartographic.fromCartesian(activeShapePoints[0]);
                        const pos2 = Cesium.Cartographic.fromCartesian(positionData[1] || positionData[0]);
                        return Cesium.Rectangle.fromCartographicArray([pos1, pos2]);
                    }, false),
                    material: Cesium.Color.AQUA.withAlpha(0.3),
                    outline: true,
                    outlineColor: Cesium.Color.AQUA
                }
            });
        } else if (currentMode === 'circle') {
             return viewer.entities.add({
                ellipse: {
                    semiMinorAxis: new Cesium.CallbackProperty(function () {
                        return getRadius(activeShapePoints[0], positionData[1] || positionData[0]);
                    }, false),
                    semiMajorAxis: new Cesium.CallbackProperty(function () {
                        return getRadius(activeShapePoints[0], positionData[1] || positionData[0]);
                    }, false),
                    material: Cesium.Color.AQUA.withAlpha(0.3),
                    outline: true,
                    outlineColor: Cesium.Color.AQUA
                },
                position: activeShapePoints[0]
            });
        }
    }
    
    function getRadius(centerPoint, edgePoint) {
        const center = Cesium.Cartographic.fromCartesian(centerPoint);
        const edge = Cesium.Cartographic.fromCartesian(edgePoint);
        const geodesic = new Cesium.EllipsoidGeodesic(center, edge);
        return Math.max(geodesic.surfaceDistance, 100);
    }

    function startDrawing(mode) {
        clearAll();
        currentMode = mode;
        viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        
        handler.setInputAction(function (event) {
            const ray = viewer.camera.getPickRay(event.position);
            // 这里可能会 Pick 到空，加入判断以允许在纯天空点击（为了稳妥，尽量pick earth）
            const earthPosition = viewer.scene.globe.pick(ray, viewer.scene);
            
            if (Cesium.defined(earthPosition)) {
                if (activeShapePoints.length === 0) {
                    floatingPoint = createPoint(earthPosition);
                    // 必须进栈两次：第一个作为定点锚点，第二个作为可移动的浮动点
                    activeShapePoints.push(earthPosition);
                    activeShapePoints.push(earthPosition);
                    activeShape = drawShape(activeShapePoints);
                    drawnEntities.push(floatingPoint, activeShape);
                } else {
                    // Second click finishes drawing
                    activeShapePoints.pop(); // 弹出最后的浮动点
                    activeShapePoints.push(earthPosition); // 压入真实的终点
                    terminateShape();
                    analyzeRegion();
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(function (event) {
            if (Cesium.defined(floatingPoint)) {
                const ray = viewer.camera.getPickRay(event.endPosition);
                const newPosition = viewer.scene.globe.pick(ray, viewer.scene);
                if (Cesium.defined(newPosition)) {
                    floatingPoint.position.setValue(newPosition);
                    activeShapePoints.pop(); // 弹出上一次的浮动点
                    activeShapePoints.push(newPosition); // 更新最新的位置
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    function terminateShape() {
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        if (floatingPoint) {
            viewer.entities.remove(floatingPoint);
            floatingPoint = undefined;
        }
    }

    function clearAll() {
        if (handler) {
            handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        }
        drawnEntities.forEach(entity => viewer.entities.remove(entity));
        drawnEntities = [];
        
        // 移除文化板块自定义动态加载的 geojson 地图来源
        if (window.themeGeoJsonSource) {
            viewer.dataSources.remove(window.themeGeoJsonSource);
            window.themeGeoJsonSource = null;
        }

        activeShapePoints = [];
        activeShape = null;
        floatingPoint = null;
        closeResultPanel();
    }

    function analyzeRegion() {
        if (!window.poetryData) return;
        
        let foundCities = [];
        
        const pos1Carto = Cesium.Cartographic.fromCartesian(activeShapePoints[0]);
        const pos2Carto = Cesium.Cartographic.fromCartesian(activeShapePoints[1]);
        
        if (currentMode === 'rect') {
            const rect = Cesium.Rectangle.fromCartographicArray([pos1Carto, pos2Carto]);
            const west = Cesium.Math.toDegrees(rect.west);
            const south = Cesium.Math.toDegrees(rect.south);
            const east = Cesium.Math.toDegrees(rect.east);
            const north = Cesium.Math.toDegrees(rect.north);
            
            window.poetryData.forEach(city => {
                if (city.lon >= west && city.lon <= east && city.lat >= south && city.lat <= north) {
                    foundCities.push(city);
                }
            });
        } else if (currentMode === 'circle') {
            const radius = getRadius(activeShapePoints[0], activeShapePoints[1]);
            const centerEllipsoid = pos1Carto;
            
            window.poetryData.forEach(city => {
                const cityCarto = Cesium.Cartographic.fromDegrees(city.lon, city.lat);
                const geodesic = new Cesium.EllipsoidGeodesic(centerEllipsoid, cityCarto);
                if (geodesic.surfaceDistance <= radius) {
                    foundCities.push(city);
                }
            });
        }
        
        // ============== 新增：给选中的城市添加地图上的实物炫光高亮标 =============
        foundCities.forEach(city => {
            const highlightEntity = viewer.entities.add({
                name: 'SelectedCityHighlight_' + city.name,
                position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat),
                point: {
                    pixelSize: 12,
                    color: Cesium.Color.fromCssColorString('#ff3333'), // 醒目的警示红或暗金色
                    outlineColor: Cesium.Color.YELLOW,
                    outlineWidth: 3,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                },
                label: {
                    text: city.name,
                    font: '14pt sans-serif',
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 2,
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(15, -10),
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                }
            });
            drawnEntities.push(highlightEntity);
        });
        
        showResultPanel(foundCities);
    }

    function showResultPanel(cities, customTitle = null) {
        cities.sort((a, b) => b.count - a.count);
        
        const panel = document.getElementById('spatialResultPanel');
        const content = document.getElementById('spatialResultContent');
        const titleEl = document.getElementById('spatialResultTitle');
        const countSpan = document.getElementById('spatialCityCount');
        const poemSpan = document.getElementById('spatialPoemCount');
        
        const totalPoems = cities.reduce((sum, c) => sum + c.count, 0);
        countSpan.innerText = cities.length;
        poemSpan.innerText = totalPoems;
        
        if (customTitle) {
            titleEl.innerText = customTitle + " 分析报告";
        } else {
            titleEl.innerText = "空间区域分析发现";
        }
        
        content.innerHTML = '';
        cities.forEach(c => {
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.justifyContent = 'space-between';
            el.style.alignItems = 'center';
            el.style.padding = '10px';
            el.style.marginBottom = '8px';
            el.style.background = 'rgba(0, 255, 255, 0.05)';
            el.style.border = '1px solid rgba(0, 255, 255, 0.2)';
            el.style.borderRadius = '4px';
            el.style.transition = 'all 0.3s ease';
            
            el.onmouseover = function() { this.style.background = 'rgba(0, 255, 255, 0.15)'; };
            el.onmouseout = function() { this.style.background = 'rgba(0, 255, 255, 0.05)'; };
            
            el.innerHTML = `
                <div style="flex: 1;">
                    <strong style="color:#0ff; font-size:15px; letter-spacing: 1px;">${c.name}</strong>
                    <span style="color:#ddd; font-size:12px; margin-left:8px;">${c.count} 首</span>
                </div>
                <button class="spatial-view-btn" style="background:linear-gradient(135deg, rgba(0,240,255,0.8), rgba(0,180,255,0.8)); color:#000; font-weight:bold; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; white-space:nowrap; box-shadow:0 0 10px rgba(0,255,255,0.3);">
                    查看诗词
                </button>
            `;
            
            el.querySelector('.spatial-view-btn').addEventListener('click', () => {
                closeResultPanel(); // 关键修正：关闭空间面板，防止遮盖诗词面板
                if (window.showLocationPoems) {
                    window.showLocationPoems({ name: c.name, count: c.count });
                }
            });
            content.appendChild(el);
        });
        
        if (cities.length === 0) {
            content.innerHTML = '<div style="color:#aaa; text-align:center; padding:30px;">未在该区域内找到相关的城市数据与诗词。<br>请尝试调整框选范围。</div>';
        }
        
        panel.style.display = 'block';
    }

    function closeResultPanel() {
        const p = document.getElementById('spatialResultPanel');
        if(p) p.style.display = 'none';
    }

    function activateCulturalTheme(themeId) {
        if (!viewer || !window.poetryData) return;
        clearAll(); // 清除之前的分析画笔和高亮

        const themes = {
            zhongyuan: { name: "中原故土", color: Cesium.Color.GOLD, rect: [107.0, 33.0, 115.0, 36.5], pitch: -65, provinces: ["河南省", "陕西省", "山西省"] },
            bashu: { name: "巴蜀险道", color: Cesium.Color.SPRINGGREEN, rect: [102.0, 28.0, 108.0, 33.0], pitch: -60, provinces: ["四川省", "重庆市"] },
            jiangnan: { name: "江南水乡", color: Cesium.Color.AQUA, rect: [118.0, 29.0, 122.5, 33.0], pitch: -60, provinces: ["江苏省", "浙江省", "上海市", "安徽省"] },
            frontier: { name: "大漠边塞", color: Cesium.Color.ORANGERED, rect: [75.0, 35.0, 105.0, 42.0], pitch: -50, provinces: ["新疆维吾尔自治区", "甘肃省", "宁夏回族自治区", "内蒙古自治区"] },
            lingnan: { name: "岭南逐客", color: Cesium.Color.PURPLE, rect: [108.0, 18.0, 117.0, 25.0], pitch: -60, provinces: ["广东省", "广西壮族自治区", "海南省"] },
            jingchu: { name: "荆楚云梦", color: Cesium.Color.DODGERBLUE, rect: [110.0, 28.0, 116.0, 32.0], pitch: -65, provinces: ["湖北省", "湖南省"] },
            qilu: { name: "齐鲁名山", color: Cesium.Color.LIGHTSEAGREEN, rect: [115.0, 34.5, 122.0, 38.0], pitch: -65, provinces: ["山东省", "河北省"] }
        };

        const theme = themes[themeId];
        if (!theme) return;

        // 1. 生成并飞向区域边界中心
        const rect = Cesium.Rectangle.fromDegrees(theme.rect[0], theme.rect[1], theme.rect[2], theme.rect[3]);
        viewer.camera.flyTo({
            destination: rect,
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(theme.pitch), 
                roll: 0.0
            },
            duration: 2.5
        });

        // 2. 动态加载省市边界GeoJSON，替代原来的简单矩形框
        const drawBoundaries = (geoJsonData) => {
            const filteredGeoJson = {
                type: "FeatureCollection",
                features: geoJsonData.features.filter(f => theme.provinces.includes(f.properties.name))
            };

            Cesium.GeoJsonDataSource.load(filteredGeoJson, {
                stroke: theme.color,
                fill: theme.color.withAlpha(0.15),
                strokeWidth: 4,
                clampToGround: true // 贴地渲染
            }).then(function(dataSource) {
                window.themeGeoJsonSource = dataSource;
                viewer.dataSources.add(dataSource);
            });
        };

        if (!window.chinaGeoJson) {
            fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
                .then(res => res.json())
                .then(data => {
                    window.chinaGeoJson = data;
                    drawBoundaries(data);
                })
                .catch(err => {
                    console.error("无法加载省份边界数据降级为框型:", err);
                    const highlightMask = viewer.entities.add({
                        name: 'ThemeMask_Fallback_' + themeId,
                        rectangle: {
                            coordinates: rect,
                            material: theme.color.withAlpha(0.15),
                            outline: true,
                            outlineColor: theme.color,
                            outlineWidth: 4,
                            height: 0
                        }
                    });
                    drawnEntities.push(highlightMask);
                });
        } else {
            drawBoundaries(window.chinaGeoJson);
        }

        // 3. 空间筛选提取城市数据（基于相近范围辐射框选计算，保证查询快速及边缘涵括度）
        const foundCities = [];
        window.poetryData.forEach(city => {
            if (city.lon >= theme.rect[0] && city.lon <= theme.rect[2] && 
                city.lat >= theme.rect[1] && city.lat <= theme.rect[3]) {
                foundCities.push(city);
            }
        });

        // 4. 为提取的主题城市添加特制光晕大头针
        foundCities.forEach(city => {
            const pinEntity = viewer.entities.add({
                name: 'ThemeCity_' + city.name,
                position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat),
                point: {
                    pixelSize: 14,
                    color: theme.color,
                    outlineColor: Cesium.Color.fromCssColorString('#ffffff'),
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                },
                label: {
                    text: city.name,
                    font: 'bold 15pt sans-serif',
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 3,
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: theme.color.withAlpha(0.8),
                    horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(15, -10),
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                }
            });
            drawnEntities.push(pinEntity);
        });

        // 5. 展开空间统计面板并挂载专享标题
        showResultPanel(foundCities, theme.name);
    }

    return { init: init };
})();

window.SpatialAnalysisManager = SpatialAnalysisManager;
