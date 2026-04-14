/**
 * 地图管理模块
 * 负责 Cesium Viewer 的初始化、底图加载、地形加载及图层切换
 */

const MapManager = (function () {
    let viewer = null;
    let layers = {};

    // 配置 Cesium token
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYjQ4NGNlYi1kZmRmLTRhMzktYWJkNS0xNWMyMzg1OTU4ZmYiLCJpZCI6MTg3NTI4LCJpYXQiOjE3MDI4NzIyMjB9.qKtVGR1TuAi4kbHhkF_Gq8G0OMrwQO_-vagkqBk_zDo';

    /**
     * 初始化地图
     * @param {string} containerId - 容器ID
     */
    function init(containerId) {
        // 创建 Cesium viewer
        viewer = new Cesium.Viewer(containerId, {
            imageryProvider: new Cesium.UrlTemplateImageryProvider({
                url: "https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=e9c554f6b646a275bf04f777f4c69afa",
                subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
                minimumLevel: 1,
                maximumLevel: 18
            }),
            baseLayerPicker: false,
            geocoder: false,
            navigationHelpButton: false,
            homeButton: false,
            sceneModePicker: false,
            animation: false,
            timeline: false,
            infoBox: false,
            selectionIndicator: false,
            fullscreenButton: false,
            // 确保 Cesium 不会阻止其他元素的交互
            requestRenderMode: false,
            targetFrameRate: 60,
            vrButton: false
        });

        // 记录基础矢量图层
        layers.vec = viewer.imageryLayers.get(0);

        // 添加天地图标注图层
        layers.cva = viewer.scene.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
                url: "https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=e9c554f6b646a275bf04f777f4c69afa",
                subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
            })
        );

        // 添加天地图影像图层（初始隐藏）
        layers.img = viewer.scene.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
                url: "https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=e9c554f6b646a275bf04f777f4c69afa",
                subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
                minimumLevel: 1,
                maximumLevel: 18
            })
        );
        layers.img.show = false;

        // 设置初始视角
        viewer.camera.setView({
            destination: Cesium.Rectangle.fromDegrees(
                73.0,   // 西边界经度
                18.0,   // 南边界纬度
                150.0,  // 东边界经度
                53.0    // 北边界纬度
            )
        });

        // 使用 Cesium 内置的地形服务
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();

        // 移除版信息
        viewer._cesiumWidget._creditContainer.style.display = "none";

        // 初始化流动线材质
        _initMaterials();

        return viewer;
    }

    /**
     * 初始化自定义材质
     */
    function _initMaterials() {
        // 定义流动线材质
        function PolylineFlowMaterialProperty(color) {
            this._definitionChanged = new Cesium.Event();
            this._color = undefined;
            this.color = color;
            this._time = new Date().getTime();
        }

        Object.defineProperties(PolylineFlowMaterialProperty.prototype, {
            isConstant: {
                get: function () {
                    return false;
                }
            },
            definitionChanged: {
                get: function () {
                    return this._definitionChanged;
                }
            },
            color: Cesium.createPropertyDescriptor('color')
        });

        PolylineFlowMaterialProperty.prototype.getType = function () {
            return 'PolylineFlow';
        };

        PolylineFlowMaterialProperty.prototype.getValue = function (time, result) {
            if (!Cesium.defined(result)) {
                result = {};
            }
            result.color = Cesium.Property.getValueOrClonedDefault(this._color, time, Cesium.Color.WHITE, result.color);
            result.time = (((new Date().getTime() - this._time) % 2000) / 2000);
            return result;
        };

        Cesium.Material.PolylineFlowType = 'PolylineFlow';
        Cesium.Material.PolylineFlowSource = `
            czm_material czm_getMaterial(czm_materialInput materialInput) {
                czm_material material = czm_getDefaultMaterial(materialInput);
                vec2 st = materialInput.st;
                float t = time;
                vec4 colorImage = texture2D(image, vec2(fract(st.s - t), st.t));
                material.alpha = colorImage.a * color.a;
                material.diffuse = color.rgb;
                return material;
            }
        `;

        // 挂载到全局 Cesium 对象上（如果需要）或者通过工厂方法创建
        Cesium.PolylineFlowMaterialProperty = PolylineFlowMaterialProperty;
    }

    /**
     * 切换底图类型
     * @param {string} type - 'vec' (矢量), 'img' (影像), 'ter' (地形)
     */
    function switchBaseLayer(type) {
        if (!viewer) return;

        if (type === 'vec') {
            layers.vec.show = true;
            layers.img.show = false;
            layers.cva.show = true; // 开启注记
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        } else if (type === 'img') {
            layers.vec.show = false;
            layers.img.show = true;
            layers.cva.show = true; // 开启注记
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        } else if (type === 'ter') {
            // 地形模式下通常使用影像底图
            layers.vec.show = false;
            layers.img.show = true;
            layers.cva.show = true;
            // 启用地形
            viewer.terrainProvider = Cesium.createWorldTerrain();
        }
    }

    return {
        init: init,
        switchBaseLayer: switchBaseLayer,
        getViewer: () => viewer
    };
})();
