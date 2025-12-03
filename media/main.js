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

    // Access VS Code API
    const vscode = acquireVsCodeApi();

    // State for pan/zoom
    let state = {
        scale: 1,
        panning: false,
        pointX: 0,
        pointY: 0,
        startX: 0,
        startY: 0
    };

    function updateZoomDisplay() {
        zoomLevelEl.textContent = `${Math.round(state.scale * 100)}%`;
    }

    // Helper to display image
    function displayImage(imgElement, filenameElement, src, filename, isRight = false) {
        imgElement.src = src;
        if (isRight) {
            overlayImage.src = src;
        }

        // Hide placeholder
        const p = imgElement.parentElement.querySelector('.placeholder');
        if (p) p.style.display = 'none';

        // Show filename
        filenameElement.textContent = filename;
        filenameElement.style.display = 'block';

        // Reset view when new image loads
        resetView();
    }

    // --- Sync Zoom & Pan ---
    function updateTransform() {
        const transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
        leftImage.style.transform = transform;
        rightImage.style.transform = transform;
        overlayImage.style.transform = transform;
    }

    function resetView() {
        state = {
            scale: 1,
            panning: false,
            pointX: 0,
            pointY: 0,
            startX: 0,
            startY: 0
        };
        updateTransform();
        updateZoomDisplay();
    }

    // Zoom
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        // const xs = (e.clientX - container.getBoundingClientRect().left) / container.offsetWidth;
        // const ys = (e.clientY - container.getBoundingClientRect().top) / container.offsetHeight;

        // Determine zoom direction
        const delta = e.deltaY > 0 ? 0.9 : 1.1;

        // Adjust scale
        const newScale = state.scale * delta;

        // Limit scale
        if (newScale < 0.1 || newScale > 10) return;

        // Adjust point to zoom towards mouse
        // Simple zoom logic: just scale for now, centering on mouse is complex with dual view
        // Let's stick to simple scaling first, maybe center zoom later if requested.
        // Actually, let's try to zoom relative to current view center to keep it simple for sync.

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
        container.classList.add('overlay-mode');
        // In overlay mode, we want the right container to be exactly on top of the left one.
        // We need to make sure the right image is positioned correctly relative to the left one.
        // Since we use the same transform for both, if the containers are aligned, the images will be aligned.
        // CSS handles the container positioning.
    });

    overlayBtn.addEventListener('mouseup', () => {
        container.classList.remove('overlay-mode');
    });

    // Also handle mouse leave on button just in case
    overlayBtn.addEventListener('mouseleave', () => {
        container.classList.remove('overlay-mode');
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

})();
