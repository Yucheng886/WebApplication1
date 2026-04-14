/**
 * UI 管理模块
 * 负责面板的开关、按钮交互及 DOM 事件绑定
 */

const UIManager = (function () {

    // 初始化 UI 事件监听
    function init() {
        _initChartPanels();
        _initRouteSelectPanel();
        _initBaseLayerButtons();
        _initControlGroups();
    }

    // 初始化图表面板交互
    function _initChartPanels() {
        // 关闭按钮逻辑
        document.querySelectorAll('.chart-close-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const chartType = this.getAttribute('data-chart');
                const panel = document.getElementById(`${chartType}ChartPanel`);
                const toggleBtn = document.getElementById(`btn${chartType.charAt(0).toUpperCase() + chartType.slice(1)}Chart`);

                if (panel) panel.classList.remove('visible');
                if (toggleBtn) toggleBtn.classList.remove('active');
            });
        });

        // 切换按钮逻辑
        document.querySelectorAll('.chart-toggle-icon').forEach(btn => {
            btn.addEventListener('click', function () {
                // 如果是热力图按钮，不做面板切换
                if (this.id === 'btnHeatmap') return;

                const btnId = this.id; // e.g., btnDynastyChart
                const chartType = btnId.replace('btn', '').replace('Chart', '').toLowerCase(); // e.g., dynasty
                const panel = document.getElementById(`${chartType}ChartPanel`);

                if (!panel) return;

                // 切换状态
                if (panel.classList.contains('visible')) {
                    panel.classList.remove('visible');
                    this.classList.remove('active');
                } else {
                    // 关闭其他面板
                    document.querySelectorAll('.chart-panel').forEach(p => p.classList.remove('visible'));
                    document.querySelectorAll('.chart-toggle-icon').forEach(b => b.classList.remove('active'));

                    panel.classList.add('visible');
                    this.classList.add('active');

                    // 触发图表 resize，防止渲染大小错误
                    window.dispatchEvent(new Event('resize'));
                }
            });
        });
    }

    // 初始化路线选择面板交互
    function _initRouteSelectPanel() {
        const btnRoute = document.getElementById('btnRoute');
        const routeSelectPanel = document.getElementById('routeSelectPanel');
        const routeSelectToggle = document.getElementById('routeSelectToggle');
        const routePanelCloseBtn = document.getElementById('routePanelCloseBtn');
        const routeSelectContent = document.getElementById('routeSelectContent');

        if (!btnRoute || !routeSelectPanel) return;

        // 路线图按钮点击 - 切换面板展开/收起
        btnRoute.addEventListener('click', (e) => {
            e.stopPropagation();
            _toggleRouteSelectPanel();
        });

        // 标题栏点击 - 切换展开/收起
        if (routeSelectToggle) {
            routeSelectToggle.addEventListener('click', (e) => {
                // 如果点击的是关闭按钮，不触发切换
                if (e.target === routePanelCloseBtn || routePanelCloseBtn.contains(e.target)) {
                    return;
                }
                _toggleRouteSelectPanel();
            });
        }

        // 关闭按钮点击 - 收起面板
        if (routePanelCloseBtn) {
            routePanelCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _hideRouteSelectPanel();
            });
        }
    }

    // 切换路线选择面板展开/收起
    function _toggleRouteSelectPanel() {
        const panel = document.getElementById('routeSelectPanel');
        if (panel.classList.contains('expanded')) {
            _hideRouteSelectPanel();
        } else {
            _showRouteSelectPanel();
        }
    }

    // 显示路线选择面板
    function _showRouteSelectPanel() {
        const panel = document.getElementById('routeSelectPanel');
        panel.classList.remove('collapsed');
        panel.classList.add('expanded');

        // 触发自定义事件，通知 RouteManager 生成面板内容
        const event = new Event('RequestGenerateRoutePanel');
        document.dispatchEvent(event);
    }

    // 隐藏路线选择面板
    function _hideRouteSelectPanel() {
        const panel = document.getElementById('routeSelectPanel');
        panel.classList.remove('expanded');
        panel.classList.add('collapsed');
    }

    // 初始化底图切换按钮
    function _initBaseLayerButtons() {
        const layers = ['Vec', 'Img', 'Ter'];

        layers.forEach(type => {
            const btn = document.getElementById(`btn${type}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    MapManager.switchBaseLayer(type.toLowerCase());

                    // 更新按钮激活状态
                    layers.forEach(t => {
                        const b = document.getElementById(`btn${t}`);
                        if (b) b.classList.remove('active');
                    });
                    btn.classList.add('active');
                });
            }
        });
    }

    // 初始化控制组（折叠菜单）
    function _initControlGroups() {
        const groupToggles = document.querySelectorAll('.group-toggle');

        groupToggles.forEach(toggle => {
            toggle.addEventListener('click', function (e) {
                e.stopPropagation();

                // 查找对应的子菜单（假设结构是 button.group-toggle + div.sub-menu）
                // 或者是父容器中的 .sub-menu
                let subMenu = this.nextElementSibling;
                while (subMenu && !subMenu.classList.contains('sub-menu')) {
                    subMenu = subMenu.nextElementSibling;
                }

                if (subMenu) {
                    const isExpanding = !subMenu.classList.contains('expanded');

                    // 如果是手风琴模式（一次只展开一个），则先关闭其他
                    if (isExpanding) {
                        document.querySelectorAll('.sub-menu').forEach(menu => {
                            menu.classList.remove('expanded');
                        });
                        document.querySelectorAll('.group-toggle').forEach(btn => {
                            btn.classList.remove('active');
                        });
                    }

                    // 切换当前的状态
                    if (isExpanding) {
                        subMenu.classList.add('expanded');
                        this.classList.add('active');
                    } else {
                        subMenu.classList.remove('expanded');
                        this.classList.remove('active');
                    }
                }
            });
        });
    }

    return {
        init: init
    };
})();
