(function () {
    const leftContainer = document.getElementById('left-container');
    const rightContainer = document.getElementById('right-container');
    const leftImage = document.getElementById('left-image');
    const rightImage = document.getElementById('right-image');
    const overlayImage = document.getElementById('overlay-image');
    const overlayBtn = document.getElementById('overlayBtn');
    const container = document.querySelector('.container');
    const zoomLevelEl = document.getElementById('zoom-level');
    const leftFilenameEl = document.getElementById('left-filename');
    const rightFilenameEl = document.getElementById('right-filename');
    const diffCanvas = document.getElementById('diff-canvas');
    const overlayDiffCanvas = document.getElementById('overlay-diff-canvas');

    // Mode controls
    const modeSelector = document.getElementById('modeSelector');
    const opacityControl = document.getElementById('opacityControl');
    const opacitySlider = document.getElementById('opacitySlider');
    const differencesControl = document.getElementById('differencesControl');
    const differencesCheckbox = document.getElementById('differencesCheckbox');

    // Access VS Code API
    const vscode = acquireVsCodeApi();

    // State for pan/zoom and mode
    let state = {
        scale: 1,
        panning: false,
        pointX: 0,
        pointY: 0,
        startX: 0,
        startY: 0,
        mode: 'sidebyside',
        showDifferences: false,
        leftImageData: null,
        rightImageData: null
    };

    function updateZoomDisplay() {
        zoomLevelEl.textContent = `${Math.round(state.scale * 100)}%`;
    }

    // Helper to display image
    function displayImage(imgElement, filenameElement, src, filename, isRight = false) {
        imgElement.src = src;
        if (isRight) {
            overlayImage.src = src;
            state.rightImageData = src;
        } else {
            state.leftImageData = src;
        }

        // Hide placeholder
        const p = imgElement.parentElement.querySelector('.placeholder');
        if (p) p.style.display = 'none';

        // Show filename
        filenameElement.textContent = filename;
        filenameElement.style.display = 'block';

        // Update differences if enabled
        if (state.showDifferences && state.leftImageData && state.rightImageData) {
            calculateDifferences();
        }

        // Reset view when new image loads
        resetView();
    }

    // Calculate and display image differences
    function calculateDifferences() {
        if (!state.leftImageData || !state.rightImageData) {
            return;
        }

        // Create temporary images to load the data
        const img1 = new Image();
        const img2 = new Image();

        let loaded = 0;
        const onLoad = () => {
            loaded++;
            if (loaded === 2) {
                processDifferences(img1, img2);
            }
        };

        img1.onload = onLoad;
        img2.onload = onLoad;
        img1.src = state.leftImageData;
        img2.src = state.rightImageData;
    }

    function processDifferences(img1, img2) {
        const width = Math.max(img1.width, img2.width);
        const height = Math.max(img1.height, img2.height);

        diffCanvas.width = width;
        diffCanvas.height = height;
        overlayDiffCanvas.width = width;
        overlayDiffCanvas.height = height;

        const ctx = diffCanvas.getContext('2d');
        const overlayCtx = overlayDiffCanvas.getContext('2d');

        // Draw both images on temporary canvases to get pixel data
        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        canvas2.width = width;
        canvas2.height = height;

        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');

        ctx1.drawImage(img1, 0, 0);
        ctx2.drawImage(img2, 0, 0);

        const imageData1 = ctx1.getImageData(0, 0, width, height);
        const imageData2 = ctx2.getImageData(0, 0, width, height);
        const diffData = ctx.createImageData(width, height);

        // Calculate pixel differences
        for (let i = 0; i < imageData1.data.length; i += 4) {
            const r1 = imageData1.data[i];
            const g1 = imageData1.data[i + 1];
            const b1 = imageData1.data[i + 2];

            const r2 = imageData2.data[i];
            const g2 = imageData2.data[i + 1];
            const b2 = imageData2.data[i + 2];

            // Calculate absolute difference
            const rDiff = Math.abs(r1 - r2);
            const gDiff = Math.abs(g1 - g2);
            const bDiff = Math.abs(b1 - b2);

            // Amplify differences for visibility
            diffData.data[i] = Math.min(255, rDiff * 3);
            diffData.data[i + 1] = Math.min(255, gDiff * 3);
            diffData.data[i + 2] = Math.min(255, bDiff * 3);
            diffData.data[i + 3] = 255; // Full opacity
        }

        ctx.putImageData(diffData, 0, 0);
        overlayCtx.putImageData(diffData, 0, 0);

        // Apply transform to diff canvases
        const transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
        diffCanvas.style.transform = transform;
        overlayDiffCanvas.style.transform = transform;
    }

    // Mode switching
    function switchMode(newMode) {
        state.mode = newMode;

        if (newMode === 'dissolve') {
            // Show dissolve mode
            container.classList.add('dissolve-mode');
            opacityControl.classList.add('active');
            differencesControl.classList.remove('active');

            // Reset differences if it was enabled
            if (state.showDifferences) {
                differencesCheckbox.checked = false;
                state.showDifferences = false;
                hideDifferences();
            }

            // Set initial opacity
            updateOpacity(opacitySlider.value);
        } else {
            // Show side by side mode
            container.classList.remove('dissolve-mode');
            opacityControl.classList.remove('active');
            differencesControl.classList.add('active');

            // Reset right image opacity
            rightContainer.style.opacity = 1;
        }
    }

    // Update opacity for dissolve mode
    function updateOpacity(value) {
        const opacity = value / 100;
        rightContainer.style.opacity = opacity;
    }

    // Show/hide differences
    function toggleDifferences(show) {
        state.showDifferences = show;

        if (show) {
            calculateDifferences();
            rightImage.style.display = 'none';
            diffCanvas.style.display = 'block';
        } else {
            hideDifferences();
        }
    }

    function hideDifferences() {
        rightImage.style.display = 'block';
        diffCanvas.style.display = 'none';
    }

    // Event listeners for mode controls
    modeSelector.addEventListener('change', (e) => {
        switchMode(e.target.value);
    });

    opacitySlider.addEventListener('input', (e) => {
        updateOpacity(e.target.value);
    });

    differencesCheckbox.addEventListener('change', (e) => {
        toggleDifferences(e.target.checked);
    });

    // --- Sync Zoom & Pan ---
    function updateTransform() {
        const transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
        leftImage.style.transform = transform;
        rightImage.style.transform = transform;
        overlayImage.style.transform = transform;
        overlayDiffCanvas.style.transform = transform;

        // Also update diff canvas transform if it's visible
        if (diffCanvas.style.display === 'block') {
            diffCanvas.style.transform = transform;
        }
    }

    function resetView() {
        state.scale = 1;
        state.panning = false;
        state.pointX = 0;
        state.pointY = 0;
        state.startX = 0;
        state.startY = 0;
        updateTransform();
        updateZoomDisplay();
    }

    // Zoom
    container.addEventListener('wheel', (e) => {
        e.preventDefault();

        // Determine zoom direction
        const delta = e.deltaY > 0 ? 0.9 : 1.1;

        // Adjust scale
        const newScale = state.scale * delta;

        // Limit scale
        if (newScale < 0.1 || newScale > 10) return;

        state.scale = newScale;
        updateTransform();
        updateZoomDisplay();
    });

    // Pan
    container.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return; // Don't pan if clicking button
        e.preventDefault();
        state.startX = e.clientX - state.pointX;
        state.startY = e.clientY - state.pointY;
        state.panning = true;
    });

    container.addEventListener('mousemove', (e) => {
        if (!state.panning) return;
        e.preventDefault();
        state.pointX = e.clientX - state.startX;
        state.pointY = e.clientY - state.startY;
        updateTransform();
    });

    container.addEventListener('mouseup', () => {
        state.panning = false;
    });

    container.addEventListener('mouseleave', () => {
        state.panning = false;
    });

    // --- Overlay ---
    overlayBtn.addEventListener('mousedown', () => {
        if (state.showDifferences) {
            // Show difference overlay on left image
            container.classList.add('overlay-diff-mode');
        } else {
            container.classList.add('overlay-mode');
        }
    });

    overlayBtn.addEventListener('mouseup', () => {
        container.classList.remove('overlay-mode');
        container.classList.remove('overlay-diff-mode');
    });

    // Also handle mouse leave on button just in case
    overlayBtn.addEventListener('mouseleave', () => {
        container.classList.remove('overlay-mode');
        container.classList.remove('overlay-diff-mode');
    });

    // --- Message listener for loaded images from extension ---
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'imageLoaded':
                const imgElement = message.isRight ? rightImage : leftImage;
                const filenameElement = message.isRight ? rightFilenameEl : leftFilenameEl;
                displayImage(imgElement, filenameElement, message.data, message.filename, message.isRight);
                break;
        }
    });

    // Notify extension that webview is ready to receive images
    // This prevents race condition where images are sent before webview is loaded
    vscode.postMessage({ command: 'webviewReady' });

})();
