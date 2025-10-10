import {
    readFile
} from "../../firebaseMethods.js";

let deepAR;
let isFrontCamera = false; // Track camera state
let isMirrored = false; // Track mirror state
let currentStream = null; // Track the active media stream
const urlParams = new URLSearchParams(window.location.search);
const initialModel = urlParams.get('model') || 'classic';
const initialColor = urlParams.get('color') || 'white';
const effectMap = {
    classic: { white: 'classic_white.deepar', black: 'classic_black.deepar', blue: 'classic_blue.deepar', red: 'classic_red.deepar' },
    running: { white: 'running_white.deepar', black: 'running_black.deepar', blue: 'running_blue.deepar', red: 'running_red.deepar' },
    basketball: { white: 'basketball/white.deepar', black: 'basketball_black.deepar', blue: 'basketball_blue.deepar', red: 'basketball_red.deepar' }
};
const imageMap = {
    classic: { white: '/images/angles/classic/white/main.png', black: '/images/angles/classic/black/main.png', blue: '/images/angles/classic/blue/main.png', red: '/images/angles/classic/red/main.png' },
    running: { white: '/images/angles/runner/white/main.png', black: '/images/angles/runner/black/main.png', blue: '/images/angles/runner/blue/main.png', red: '/images/angles/runner/red/main.png' },
    basketball: { white: '/images/angles/basketball/white/main.png', black: '/images/angles/basketball/black/main.png', blue: '/images/angles/basketball/blue/main.png', red: '/images/angles/basketball/red/main.png' }
};

let currentEffectPath = `deeparShoeModelFiles/basketball_black.deepar`;
const loader = document.getElementById('loader');
const filterSection = document.getElementById('filter-section');
const toggleButton = document.getElementById('toggle-filters');
const expandBtn = document.getElementById('expand-btn');
const exitBtn = document.getElementById('exit-btn');
const preview = document.getElementById('deepar-div');
const toggleFilterBtn = document.getElementById('toggle-filter-btn');
const mirrorBtnNormal = document.getElementById('mirrorBtnNormal');
const mirrorBtnExpanded = document.getElementById('mirrorBtnExpanded');
const screenshotBtnNormal = document.getElementById('screenshotBtnNormal');
const screenshotBtnExpanded = document.getElementById('screenshotBtnExpanded');
const switchCameraBtnNormal = document.getElementById('switchCameraBtnNormal');
const switchCameraBtnExpanded = document.getElementById('switchCameraBtnExpanded');
const buyNowButton = document.getElementById('buy-now-button');
const backButton = document.getElementById('back-button');
const expandedControls = document.getElementById('expanded-controls');
const exitBtnExpanded = document.getElementById('exit-btn-expanded');

(async function () {
    loader.classList.add('active');
    try {
        deepAR = await deepar.initialize({
            licenseKey: 'f0eafd99d224758bdc2c7271acd80bc7642fdb178ba74faf1c61c1ec7d25221057493e7b9b73c58d',
            previewElement: preview,
        });
        console.log("✅ DeepAR initialized ");

        // Start with back camera
        await switchCamera('environment');
        
        // Load initial effect
        const result = await readFile(currentEffectPath);
        console.log("✅ Read initial effect file from Firebase");

        console.log(result);
        console.log(result.url);
        await deepAR.switchEffect(result.url);
        console.log(`✅ Initial shoe effect loaded: ${result.url}`);

        deepAR.callbacks.onFeetVisibilityChanged = (visible) => {
            console.log(visible ? '👟 Feet detected!' : 'No feet visible.');
        };

        const container = document.getElementById('filter-container');
        const categories = Object.keys(effectMap);
        categories.forEach((model, catIndex) => {
            const group = document.createElement('div');
            group.className = 'category-group';
            const title = document.createElement('div');
            title.className = 'category-title';
            title.textContent = model.charAt(0).toUpperCase() + model.slice(1);
            group.appendChild(title);

            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'filter-buttons';
            for (const color in effectMap[model]) {
                const button = document.createElement('div');
                button.className = 'filter-button';
                button.dataset.path = `deeparShoeModelFiles/${effectMap[model][color]}`;
                button.setAttribute('role', 'button');
                button.setAttribute('tabindex', '0');
                button.setAttribute('aria-label', `${model} ${color}`);

                const img = document.createElement('img');
                img.src = imageMap[model][color];
                img.className = 'filter-image';
                img.alt = `${model} ${color} shoe`;

                const name = document.createElement('span');
                name.className = 'filter-name';
                name.textContent = color.charAt(0).toUpperCase() + color.slice(1);

                button.appendChild(img);
                button.appendChild(name);

                button.onclick = async () => {
                    loader.classList.add('active');
                    await switchEffect(button.dataset.path);
                    document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('selected'));
                    button.classList.add('selected');
                    loader.classList.remove('active');
                };

                button.onkeydown = (e) => {
                    if (e.key === 'Enter') button.click();
                };

                buttonsDiv.appendChild(button);
            }
            group.appendChild(buttonsDiv);
            container.appendChild(group);

            if (catIndex < categories.length - 1) {
                const divider = document.createElement('div');
                divider.classList = 'category-divider';
                container.appendChild(divider);
            }
        });

        const initialButton = Array.from(document.querySelectorAll('.filter-button')).find(btn => btn.dataset.path === currentEffectPath);
        if (initialButton) initialButton.classList.add('selected');

        loader.classList.remove('active');
    } catch (err) {
        console.error("❌ Error:", err);
        loader.classList.remove('active');
        alert('Failed to initialize AR. Please check console for details.');
    }
})();

async function switchCamera(facingMode) {
    try {
        // Stop the current stream if it exists
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        // Request new stream
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode }
        });
        currentStream = stream;

        // Create a new video element
        const video = document.createElement('video');
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        video.play();

        // Update DeepAR with the new video stream
        deepAR.setVideoElement(video, isMirrored);
        console.log(`✅ Switched to ${facingMode} camera.`);
    } catch (err) {
        console.error("❌ Failed to switch camera:", err);
        alert('Failed to switch camera. Please ensure camera permissions are granted.');
    }
}

async function toggleCamera() {
    isFrontCamera = !isFrontCamera;
    const facingMode = isFrontCamera ? 'user' : 'environment';
    await switchCamera(facingMode);
}

let currentModelBlobUrl = null; // Add this at the top with other variables

async function switchEffect(firebasePath) {
    try {
        if (!deepAR) throw new Error('DeepAR not initialized');
        
        console.log('🔄 Switching effect, Firebase path:', firebasePath);
        
        const result = await readFile(firebasePath);
        if (!result.success) {
            throw new Error(`Failed to read file from Firebase: ${result.error}`);
        }
        
        console.log('✅ File loaded successfully, switching effect...');
        
        // Clean up previous blob URL if exists
        if (currentModelBlobUrl && currentModelBlobUrl !== result.url) {
            URL.revokeObjectURL(currentModelBlobUrl);
        }
        
        console.log(result);
        await deepAR.switchEffect(result.url);
        currentEffectPath = firebasePath;
        currentModelBlobUrl = result.blobUrl || null; // Store blob URL for cleanup
        
        console.log(`✅ Successfully switched to effect: ${firebasePath}`);
        
    } catch (err) {
        console.error("❌ Failed to switch effect:", err);
        
        // More detailed error information
        if (err.message.includes('Failed to fetch')) {
            console.error('🌐 Network/CORS issue detected');
        }
    }
}

// Add cleanup function
function cleanupAR() {
    if (currentModelBlobUrl) {
        URL.revokeObjectURL(currentModelBlobUrl);
        currentModelBlobUrl = null;
    }
}

// Call cleanup when leaving the page
window.addEventListener('beforeunload', cleanupAR);

toggleButton.addEventListener('click', () => {
    filterSection.classList.toggle('minimized');
    if (filterSection.classList.contains('minimized')) {
        toggleButton.innerHTML = '<i class="fas fa-chevron-up"></i> Show Filters';
    } else {
        toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i> Hide Filters';
    }
});

expandBtn.addEventListener('click', () => {
    enterExpanded();
});

exitBtn.addEventListener('click', () => {
    exitExpanded();
});

exitBtnExpanded.addEventListener('click', () => {
    exitExpanded();
});

toggleFilterBtn.addEventListener('click', () => {
    filterSection.classList.toggle('hidden');
    if (filterSection.classList.contains('hidden')) {
        toggleFilterBtn.innerHTML = '<i class="fas fa-filter"></i>';
    } else {
        toggleFilterBtn.innerHTML = '<i class="fas fa-times"></i>';
    }
});

switchCameraBtnNormal.addEventListener('click', toggleCamera);
switchCameraBtnExpanded.addEventListener('click', toggleCamera);

function enterExpanded() {
    preview.classList.add('expanded');
    filterSection.classList.add('expanded');
    filterSection.classList.remove('minimized'); // Ensure filters are visible when entering expanded mode
    buyNowButton.style.display = 'none';
    backButton.style.display = 'none';
    expandBtn.style.display = 'none';
    exitBtn.style.display = 'none';
    toggleFilterBtn.style.display = 'flex';
    mirrorBtnNormal.style.display = 'none';
    screenshotBtnNormal.style.display = 'none';
    switchCameraBtnNormal.style.display = 'none';
    expandedControls.style.display = 'flex';
    mirrorBtnExpanded.style.display = 'flex';
    screenshotBtnExpanded.style.display = 'flex';
    switchCameraBtnExpanded.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Handle mirroring transition
    if (isMirrored) {
        preview.classList.remove('mirroredwithout80');
        preview.classList.add('mirrored');
    } else {
        preview.classList.remove('mirroredwithout80');
        preview.classList.remove('mirrored');
    }
}

function exitExpanded() {
    preview.classList.remove('expanded');
    filterSection.classList.remove('expanded');
    buyNowButton.style.display = 'block';
    backButton.style.display = 'block';
    expandBtn.style.display = 'flex';
    exitBtn.style.display = 'none';
    toggleFilterBtn.style.display = 'none';
    filterSection.classList.remove('hidden');
    mirrorBtnNormal.style.display = 'flex';
    screenshotBtnNormal.style.display = 'flex';
    switchCameraBtnNormal.style.display = 'flex';
    expandedControls.style.display = 'none';
    mirrorBtnExpanded.style.display = 'none';
    screenshotBtnExpanded.style.display = 'none';
    switchCameraBtnExpanded.style.display = 'none';
    document.body.style.overflow = 'auto';
    // Handle mirroring transition
    if (isMirrored) {
        preview.classList.remove('mirrored');
        preview.classList.add('mirroredwithout80');
    } else {
        preview.classList.remove('mirrored');
        preview.classList.remove('mirroredwithout80');
    }
}

mirrorBtnNormal.addEventListener('click', () => {
    isMirrored = !isMirrored;
    if (isMirrored) {
        preview.classList.add('mirroredwithout80');
        console.log('✅ Camera mirrored.');
    } else {
        preview.classList.remove('mirroredwithout80');
        console.log('✅ Camera unmirrored.');
    }
});

mirrorBtnExpanded.addEventListener('click', () => {
    isMirrored = !isMirrored;
    if (isMirrored) {
        preview.classList.add('mirrored');
        console.log('✅ Camera mirrored.');
    } else {
        preview.classList.remove('mirrored');
        console.log('✅ Camera unmirrored.');
    }
});

screenshotBtnNormal.addEventListener('click', async () => {
    try {
        const dataUrl = await deepAR.takeScreenshot();
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `screenshot_${Date.now()}.png`;
        link.click();
        console.log('✅ Screenshot captured.');
    } catch (err) {
        console.error('❌ Screenshot error:', err);
    }
});

screenshotBtnExpanded.addEventListener('click', async () => {
    try {
        const dataUrl = await deepAR.takeScreenshot();
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `screenshot_${Date.now()}.png`;
        link.click();
        console.log('✅ Screenshot captured.');
    } catch (err) {
        console.error('❌ Screenshot error:', err);
    }
});