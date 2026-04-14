/**
 * Timeline Manager Module
 * Handles the logic for the time slider and playback control
 */
const TimelineManager = (function () {
    let viewer = null;
    let isPlaying = false;
    let playInterval = null;
    let currentYear = 618;
    const minYear = 618;
    const maxYear = 1279;

    // UI Elements
    let playBtn, slider, currentValDisplay;

    function init(cesiumViewer) {
        viewer = cesiumViewer;

        playBtn = document.getElementById('timelinePlayBtn');
        slider = document.getElementById('timelineSlider');
        currentValDisplay = document.getElementById('timelineCurrentVal');

        if (!playBtn || !slider || !currentValDisplay) {
            console.error('Timeline UI elements not found');
            return;
        }

        // Initialize events
        _bindEvents();

        // 初始化时触发一次更新
        _updateDisplay(currentYear);
    }

    function _bindEvents() {
        // Play/Pause button
        playBtn.addEventListener('click', _togglePlay);

        // Slider change
        slider.addEventListener('input', function () {
            currentYear = parseInt(this.value);
            _updateDisplay(currentYear);
            _pause(); // Stop playing if user drags manually
        });
    }

    function _togglePlay() {
        if (isPlaying) {
            _pause();
        } else {
            _play();
        }
    }

    function _play() {
        isPlaying = true;
        playBtn.classList.add('playing');
        // Change icon to pause
        playBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="5" width="4" height="14" fill="currentColor" />
                <rect x="14" y="5" width="4" height="14" fill="currentColor" />
            </svg>
        `;

        if (currentYear >= maxYear) {
            currentYear = minYear;
            slider.value = currentYear;
            _updateDisplay(currentYear);
        }

        playInterval = setInterval(() => {
            currentYear += 3; // 每次递增3年，播放更流畅
            if (currentYear > maxYear) {
                currentYear = maxYear;
                _pause();
            }
            slider.value = currentYear;
            _updateDisplay(currentYear);
        }, 120); // 120ms per tick
    }

    function _pause() {
        isPlaying = false;
        playBtn.classList.remove('playing');
        clearInterval(playInterval);
        // Change icon back to play
        playBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5V19L19 12L8 5Z" fill="currentColor" />
            </svg>
        `;
    }

    function _updateDisplay(year) {
        if (currentValDisplay) {
            // 更细粒度的朝代显示
            let dynasty = '';
            if (year >= 618 && year <= 712) dynasty = '唐初';
            else if (year >= 713 && year <= 765) dynasty = '盛唐';
            else if (year >= 766 && year <= 835) dynasty = '中唐';
            else if (year >= 836 && year <= 907) dynasty = '晚唐';
            else if (year >= 907 && year <= 960) dynasty = '五代';
            else if (year >= 960 && year <= 1127) dynasty = '北宋';
            else if (year >= 1127 && year <= 1279) dynasty = '南宋';

            currentValDisplay.textContent = `${year}年 ${dynasty}`;
        }

        // Trigger a custom event for other modules (like map or charts) to react
        const event = new CustomEvent('timelineUpdate', { detail: { year: year } });
        document.dispatchEvent(event);
    }

    /**
     * 获取当前年份
     */
    function getCurrentYear() {
        return currentYear;
    }

    return {
        init: init,
        getCurrentYear: getCurrentYear
    };
})();
