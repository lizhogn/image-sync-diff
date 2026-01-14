(function () {
    const imagesContainer = document.getElementById('images-container');
    const overlayBtn = document.getElementById('overlayBtn');
    const container = document.querySelector('.container');
    const zoomLevelEl = document.getElementById('zoom-level');
    const differencesCheckbox = document.getElementById('differencesCheckbox');
    const referenceSelector = document.getElementById('referenceSelector');

    const vscode = acquireVsCodeApi();

    const state = {
        scale: 1,
        panning: false,
        pointX: 0,
        pointY: 0,
        startX: 0,
        startY: 0,
        showDifferences: false,
        images: [],
        referenceIndex: 0,
        imageContainers: [],
        expectedImageCount: 0,
        loadedImageCount: 0
    };

    function getFilename(path) {
        return path.split(/[/\\]/).pop();
    }

    function updateZoomDisplay() {
        zoomLevelEl.textContent = `${Math.round(state.scale * 100)}%`;
    }

    function updateReferenceSelector() {
        referenceSelector.innerHTML = '';
        state.images.forEach((img, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = getFilename(img.filename);
            option.selected = index === state.referenceIndex;
            referenceSelector.appendChild(option);
        });
    }

    function createImageContainers() {
        imagesContainer.innerHTML = '';
        state.imageContainers = [];
        imagesContainer.setAttribute('data-count', state.images.length.toString());

        state.images.forEach((img, index) => {
            const containerDiv = document.createElement('div');
            containerDiv.className = 'image-item-container';
            containerDiv.id = `image-container-${index}`;

            if (index === state.referenceIndex) {
                containerDiv.classList.add('reference');
            }

            const filenameDiv = document.createElement('div');
            filenameDiv.className = 'filename';
            filenameDiv.textContent = getFilename(img.filename);
            filenameDiv.style.display = 'block';

            const imgElement = document.createElement('img');
            imgElement.className = 'sync-image';
            imgElement.draggable = false;
            imgElement.src = img.data;

            const diffCanvas = document.createElement('canvas');
            diffCanvas.className = 'comparison-diff-canvas';

            containerDiv.appendChild(filenameDiv);
            containerDiv.appendChild(imgElement);
            containerDiv.appendChild(diffCanvas);
            imagesContainer.appendChild(containerDiv);

            state.imageContainers.push({
                container: containerDiv,
                image: imgElement,
                diffCanvas: diffCanvas,
                imageIndex: index
            });
        });

        updateTransform();

        if (state.showDifferences) {
            calculateAllDifferences();
        }
    }

    function updateReferenceHighlight() {
        state.imageContainers.forEach((imgContainer, index) => {
            imgContainer.container.classList.toggle('reference', index === state.referenceIndex);
        });

        if (state.showDifferences) {
            calculateAllDifferences();
        }
    }

    function calculateAllDifferences() {
        if (state.images.length < 2) return;

        const referenceImg = state.images[state.referenceIndex];
        if (!referenceImg) return;

        state.imageContainers.forEach(imgContainer => {
            if (imgContainer.imageIndex === state.referenceIndex) {
                imgContainer.diffCanvas.style.display = 'none';
                imgContainer.image.style.display = 'block';
                return;
            }

            const comparisonImg = state.images[imgContainer.imageIndex];
            if (!comparisonImg) return;

            calculateDifference(referenceImg, comparisonImg, imgContainer.diffCanvas);
        });
    }

    function calculateDifference(refImg, compImg, diffCanvas) {
        const img1 = new Image();
        const img2 = new Image();
        let loadedCount = 0;

        function onLoad() {
            loadedCount++;
            if (loadedCount === 2) {
                processDifferences(img1, img2, diffCanvas);
            }
        }

        img1.onload = onLoad;
        img2.onload = onLoad;
        img1.src = refImg.data;
        img2.src = compImg.data;
    }

    function processDifferences(img1, img2, diffCanvas) {
        const width = Math.max(img1.width, img2.width);
        const height = Math.max(img1.height, img2.height);

        diffCanvas.width = width;
        diffCanvas.height = height;

        const ctx = diffCanvas.getContext('2d');

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

            const rDiff = Math.abs(r1 - r2);
            const gDiff = Math.abs(g1 - g2);
            const bDiff = Math.abs(b1 - b2);

            diffData.data[i] = Math.min(255, rDiff * 3);
            diffData.data[i + 1] = Math.min(255, gDiff * 3);
            diffData.data[i + 2] = Math.min(255, bDiff * 3);
            diffData.data[i + 3] = 255;
        }

        ctx.putImageData(diffData, 0, 0);
        diffCanvas.style.transform = getTransformString();
    }

    function toggleDifferences(show) {
        state.showDifferences = show;

        if (show) {
            calculateAllDifferences();
        }

        state.imageContainers.forEach(imgContainer => {
            const isReference = imgContainer.imageIndex === state.referenceIndex;
            const showDiff = show && !isReference;
            imgContainer.image.style.display = showDiff ? 'none' : 'block';
            imgContainer.diffCanvas.style.display = showDiff ? 'block' : 'none';
        });
    }

    function getTransformString() {
        return `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
    }

    function updateTransform() {
        const transform = getTransformString();
        state.imageContainers.forEach(imgContainer => {
            imgContainer.image.style.transform = transform;
            imgContainer.diffCanvas.style.transform = transform;
        });
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

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = state.scale * delta;

        if (newScale < 0.1 || newScale > 10) return;

        // Find which image container the mouse is over
        const target = e.target.closest('.image-item-container');
        if (target) {
            // Get the center of this specific container
            const rect = target.getBoundingClientRect();
            const containerCenterX = rect.left + rect.width / 2;
            const containerCenterY = rect.top + rect.height / 2;

            // Get mouse position relative to this container's center
            const mouseOffsetX = e.clientX - containerCenterX;
            const mouseOffsetY = e.clientY - containerCenterY;

            // Calculate how much the point moves due to scale change
            const scaleChange = newScale / state.scale;

            // Adjust pan to keep the point under the mouse stationary
            state.pointX = state.pointX + mouseOffsetX * (1 - scaleChange);
            state.pointY = state.pointY + mouseOffsetY * (1 - scaleChange);
        }

        state.scale = newScale;
        updateTransform();
        updateZoomDisplay();
    });

    // Pan
    container.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
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

    // Event listeners for controls
    differencesCheckbox.addEventListener('change', (e) => {
        toggleDifferences(e.target.checked);
    });

    referenceSelector.addEventListener('change', (e) => {
        state.referenceIndex = parseInt(e.target.value);
        updateReferenceHighlight();
    });

    // Keyboard shortcuts for switching reference image (Ctrl+Alt+1-9)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            const index = parseInt(e.key) - 1;
            if (index >= 0 && index < state.images.length) {
                state.referenceIndex = index;
                referenceSelector.value = index;
                updateReferenceHighlight();
            }
        }
    });

    function restoreOriginalImages() {
        state.imageContainers.forEach(imgContainer => {
            if (imgContainer.originalSrc) {
                imgContainer.image.src = imgContainer.originalSrc;
                delete imgContainer.originalSrc;
            }
        });
    }

    overlayBtn.addEventListener('mousedown', () => {
        const referenceImage = state.images[state.referenceIndex];
        if (!referenceImage) return;

        state.imageContainers.forEach(imgContainer => {
            if (imgContainer.imageIndex !== state.referenceIndex) {
                imgContainer.originalSrc = imgContainer.image.src;
                imgContainer.image.src = referenceImage.data;
            }
        });
    });

    overlayBtn.addEventListener('mouseup', restoreOriginalImages);
    overlayBtn.addEventListener('mouseleave', restoreOriginalImages);

    window.addEventListener('message', event => {
        const message = event.data;

        if (message.command === 'imagesCount') {
            state.images = [];
            state.expectedImageCount = message.count;
            state.loadedImageCount = 0;
            state.referenceIndex = 0;
            return;
        }

        if (message.command === 'imageLoaded') {
            state.images[message.index] = {
                data: message.data,
                filename: message.filename
            };
            state.loadedImageCount++;

            if (state.loadedImageCount === state.expectedImageCount) {
                updateReferenceSelector();
                createImageContainers();
                resetView();
            }
        }
    });

    vscode.postMessage({ command: 'webviewReady' });

})();
