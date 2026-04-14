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
        const tk = 'e9c554f6b646a275bf04f777f4c69afa';

        // 创建 Cesium viewer，不使用内置底图选择器
        viewer = new Cesium.Viewer(containerId, {
            imageryProvider: false, // 初始不加载默认图层，我们手动添加
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
            requestRenderMode: false,
            vrButton: false
        });

        const il = viewer.scene.imageryLayers;

        // 1. 矢量 (Index 0, 2)
        layers.vec = il.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${tk}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
        }));
        layers.cva = il.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${tk}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
        }));

        // 2. 影像 (Index 1, 3)
        layers.img = il.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
        }));
        layers.cia = il.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=${tk}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
        }));

        // 3. 地形背景 (Index 4, 5) - 这才是视觉上的地形图（晕渲图）
        layers.ter = il.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/DataServer?T=ter_w&x={x}&y={y}&l={z}&tk=${tk}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
        }));
        layers.cta = il.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/DataServer?T=cta_w&x={x}&y={y}&l={z}&tk=${tk}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
        }));

        // 初始可见性设置
        Object.keys(layers).forEach(k => layers[k].show = false);
        layers.vec.show = true;
        layers.cva.show = true;

        // 设置初始视角
        viewer.camera.setView({
            destination: Cesium.Rectangle.fromDegrees(73.0, 18.0, 150.0, 53.0)
        });

        // 默认地形：平坦
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();

        // 移除版权信息
        if (viewer._cesiumWidget._creditContainer) {
            viewer._cesiumWidget._creditContainer.style.display = "none";
        }

        // 初始化流动线材质
        _initMaterials();

        return viewer;
    }

    /**
     * 初始化自定义材质
     */
    function _initMaterials() {
        // 定义流动线材质 - 升级版：纯着色器实现流光，无需贴图
        function PolylineFlowMaterialProperty(color, speed) {
            this._definitionChanged = new Cesium.Event();
            this._color = undefined;
            this.color = color || Cesium.Color.AQUA;
            this._speed = speed || 1.0;
            this._time = performance.now();
        }

        Object.defineProperties(PolylineFlowMaterialProperty.prototype, {
            isConstant: { get: () => false },
            definitionChanged: { get: function () { return this._definitionChanged; } },
            color: Cesium.createPropertyDescriptor('color')
        });

        PolylineFlowMaterialProperty.prototype.getType = () => 'PolylineFlow';
        PolylineFlowMaterialProperty.prototype.getValue = function (time, result) {
            if (!Cesium.defined(result)) result = {};
            result.color = Cesium.Property.getValueOrClonedDefault(this._color, time, Cesium.Color.WHITE, result.color);
            // 传给着色器的时间比率 (0-1)
            result.time = ((performance.now() - this._time) * this._speed % 1000) / 1000;
            return result;
        };

        Cesium.Material.PolylineFlowType = 'PolylineFlow';
        Cesium.Material.PolylineFlowSource = `
            czm_material czm_getMaterial(czm_materialInput materialInput) {
                czm_material material = czm_getDefaultMaterial(materialInput);
                vec2 st = materialInput.st;
                
                // 计算流光核心
                // s 是 0-1 的长度百分比，time 是 0-1 的随时间循环值
                float flow = fract(st.s - time);
                
                // 创建一个带尾巴的渐变
                float strength = pow(flow, 3.0); 
                
                vec3 finalColor = color.rgb * strength;
                material.diffuse = finalColor * 2.0; // 增强亮度
                material.alpha = color.a * strength;
                
                return material;
            }
        `;
        Cesium.PolylineFlowMaterialProperty = PolylineFlowMaterialProperty;
    }

    /**
     * 切换底图类型
     * @param {string} type - 'vec' (矢量), 'img' (影像), 'ter' (地形)
     */
    function switchBaseLayer(type) {
        if (!viewer) return;

        // 隐藏所有
        Object.keys(layers).forEach(k => { if (layers[k]) layers[k].show = false; });

        if (type === 'vec') {
            if (layers.vec) layers.vec.show = true;
            if (layers.cva) layers.cva.show = true;
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        } else if (type === 'img') {
            if (layers.img) layers.img.show = true;
            if (layers.cia) layers.cia.show = true;
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        } else if (type === 'ter') {
            if (layers.ter) layers.ter.show = true;
            if (layers.cta) layers.cta.show = true;
            
            // 异步加载 3D 地形高度
            if (Cesium.CesiumTerrainProvider && Cesium.CesiumTerrainProvider.fromIonAssetId) {
                Cesium.CesiumTerrainProvider.fromIonAssetId(1)
                    .then(p => viewer.terrainProvider = p)
                    .catch(() => {
                        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
                    });
            }
        }
    }

    return {
        init: init,
        switchBaseLayer: switchBaseLayer,
        getViewer: () => viewer
    };
})();
