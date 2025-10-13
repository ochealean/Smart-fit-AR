import { checkUserAuth, readData } from '../../firebaseMethods.js';

const authStatus = await checkUserAuth();
if (authStatus.authenticated && authStatus.role === 'customer') {
    window.userAuthStatus = true;
} else window.userAuthStatus = false;

const params = new URLSearchParams(window.location.search);
const model = params.get('model');
console.log(`/customer/html/customizeshoe.html?model=${model}`);
let deepARBuyNowLink = `/customer/html/customizeshoe.html?model=${model}`;

let deepAR;
let isFrontCamera = false;
let isMirrored = false;
let currentStream = null;
const urlParams = new URLSearchParams(window.location.search);
const initialModel = urlParams.get('model') || 'classic';
const initialColor = urlParams.get('color') || 'white';

// Effect map will be populated from database
let effectMap = {};
let currentEffectPath = '';
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

const API_BASE_URL = 'https://apideepareffect.onrender.com';

// Function to build effect map directly from Firebase (primary method)
async function buildEffectMapFromFirebase() {
    try {
        console.log('🔄 Building effect map from Firebase...');

        const result = await readData('smartfit_AR_Database/ar_customization_models');

        if (!result.success) {
            throw new Error('Failed to fetch data from Firebase');
        }

        const modelsData = result.data;
        const effectMap = {};
        let hasEffects = false;

        Object.keys(modelsData).forEach(modelKey => {
            const model = modelsData[modelKey];
            effectMap[modelKey] = {};

            if (model.bodyColors) {
                Object.keys(model.bodyColors).forEach(colorKey => {
                    const colorData = model.bodyColors[colorKey];

                    // Use the DeepAR effect URL from the database
                    if (colorData.deepARFile) {
                        const proxiedEffect = `${API_BASE_URL}/api/deepar/${modelKey}/${colorKey}`;
                        effectMap[modelKey][colorKey] = proxiedEffect;
                        hasEffects = true;
                        console.log(`✅ Found DeepAR effect for ${modelKey} ${colorKey}`);
                    } else {
                        console.warn(`⚠️ No DeepAR effect found for ${modelKey} ${colorKey}`);
                    }
                });
            }
        });

        if (!hasEffects) {
            throw new Error('No DeepAR effects found in Firebase database');
        }

        console.log('🎯 Effect map built from Firebase:', effectMap);
        return effectMap;

    } catch (error) {
        console.error('❌ Error building effect map from Firebase:', error.message);
        return null;
    }
}

// Function to build effect map from API (fallback)
async function buildEffectMapFromAPI() {
    try {
        console.log('🔄 Building effect map from API...');

        // First, get all models
        const modelsResponse = await fetch(`${API_BASE_URL}/api/deepar/models`);

        if (!modelsResponse.ok) {
            throw new Error(`API responded with status: ${modelsResponse.status}`);
        }

        const modelsData = await modelsResponse.json();

        if (!modelsData.models || modelsData.models.length === 0) {
            throw new Error('No models found from API');
        }

        const effectMap = {};
        let hasEffects = false;

        // Build effect map for each model
        for (const model of modelsData.models) {
            const modelId = model.id;
            effectMap[modelId] = {};

            try {
                // Get available effects for this model
                const effectsResponse = await fetch(`${API_BASE_URL}/api/deepar/models/${modelId}`);

                if (effectsResponse.ok) {
                    const effectsData = await effectsResponse.json();

                    if (effectsData.availableEffects && Object.keys(effectsData.availableEffects).length > 0) {
                        for (const [color, effectInfo] of Object.entries(effectsData.availableEffects)) {
                            if (effectInfo.deeparEffect) {
                                effectMap[modelId][color] = effectInfo.deeparEffect;
                                hasEffects = true;
                            }
                        }
                        console.log(`✅ Found ${Object.keys(effectsData.availableEffects).length} effects for ${modelId}`);
                    } else {
                        console.warn(`⚠️ No effects found for model: ${modelId}`);
                    }
                } else {
                    console.warn(`⚠️ Failed to fetch effects for model: ${modelId}, status: ${effectsResponse.status}`);
                }
            } catch (modelError) {
                console.warn(`⚠️ Error fetching effects for ${modelId}:`, modelError.message);
            }
        }

        if (!hasEffects) {
            throw new Error('No effects found in any model');
        }

        console.log('🎯 Effect map built from API:', effectMap);
        return effectMap;

    } catch (error) {
        console.error('❌ Error building effect map from API:', error.message);
        return null;
    }
}

// Main function to fetch AR models with proper fallback
async function fetchARModels() {
    try {
        console.log('🔄 Fetching AR models...');

        // Try to get effects from Firebase first (more reliable)
        let effectMapResult = await buildEffectMapFromFirebase();

        if (effectMapResult) {
            effectMap = effectMapResult;
            console.log('✅ Using effects from Firebase');
            return await getModelsDataFromFirebase();
        }

        // Fallback to API
        console.warn('⚠️ Firebase failed, falling back to API');
        const apiEffectMap = await buildEffectMapFromAPI();

        if (apiEffectMap) {
            effectMap = apiEffectMap;
            console.log('✅ Using effects from API server');
            return await getModelsDataFromFirebase();
        }

        throw new Error('All data sources failed');

    } catch (error) {
        console.error('❌ Error in fetchARModels:', error.message);
        return null;
    }
}

// Get models data from Firebase
async function getModelsDataFromFirebase() {
    try {
        const result = await readData('smartfit_AR_Database/ar_customization_models');
        return result.success ? result.data : null;
    } catch (error) {
        console.error('❌ Error fetching models data:', error.message);
        return null;
    }
}

// Function to get image URL from color data
function getColorImageUrl(colorData) {
    if (colorData.images && colorData.images.main) {
        return colorData.images.main;
    } else if (colorData.image) {
        return colorData.image;
    } else {
        // Fallback to placeholder
        return '/images/shoe3.png';
    }
}

// Function to create filter buttons dynamically based on database data
function createFilterButtons(arModelsData) {
    const container = document.getElementById('filter-container');

    if (!container) {
        console.error('❌ Filter container not found');
        return;
    }

    container.innerHTML = ''; // Clear existing content

    if (!arModelsData || Object.keys(arModelsData).length === 0) {
        container.innerHTML = '<div class="no-effects">No AR effects available</div>';
        return;
    }

    const categories = Object.keys(arModelsData);
    let hasAnyEffects = false;

    categories.forEach((model, catIndex) => {
        const group = document.createElement('div');
        group.className = 'category-group';
        const title = document.createElement('div');
        title.className = 'category-title';
        title.textContent = arModelsData[model].name || (model.charAt(0).toUpperCase() + model.slice(1));
        group.appendChild(title);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'filter-buttons';

        // Get available colors for this model from database
        const availableColors = arModelsData[model].bodyColors;
        let hasModelEffects = false;

        if (availableColors) {
            for (const color in availableColors) {
                // Check if effect exists for this color in our effect map
                if (!effectMap[model] || !effectMap[model][color]) {
                    console.warn(`⚠️ No DeepAR effect found for ${model} ${color}, skipping`);
                    continue;
                }

                const button = document.createElement('div');
                button.className = 'filter-button';

                button.dataset.path = effectMap[model][color];
                button.dataset.model = model;
                button.dataset.color = color;
                button.setAttribute('role', 'button');
                button.setAttribute('tabindex', '0');
                button.setAttribute('aria-label', `${model} ${color}`);

                const img = document.createElement('img');

                // Get the image URL from the database
                const colorData = availableColors[color];
                const imageUrl = getColorImageUrl(colorData);

                img.src = imageUrl;
                img.className = 'filter-image';
                img.alt = `${model} ${color} shoe`;
                img.onerror = function () {
                    // If image fails to load, use a placeholder
                    this.src = '/images/shoe3.png';
                };

                const name = document.createElement('span');
                name.className = 'filter-name';
                name.textContent = color.charAt(0).toUpperCase() + color.slice(1);

                button.appendChild(img);
                button.appendChild(name);

                button.onclick = async () => {
                    loader.classList.add('active');
                    await switchEffect(button.dataset.path, model, color);
                    document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('selected'));
                    button.classList.add('selected');
                    loader.classList.remove('active');
                };

                button.onkeydown = (e) => {
                    if (e.key === 'Enter') button.click();
                };

                buttonsDiv.appendChild(button);
                hasModelEffects = true;
                hasAnyEffects = true;
            }
        }

        if (hasModelEffects) {
            group.appendChild(buttonsDiv);
            container.appendChild(group);

            if (catIndex < categories.length - 1) {
                const divider = document.createElement('div');
                divider.className = 'category-divider';
                container.appendChild(divider);
            }
        }
    });

    if (!hasAnyEffects) {
        container.innerHTML = '<div class="no-effects">No AR effects available. Please check if DeepAR effects are properly configured.</div>';
    }
}

// Function to get initial effect path based on URL parameters
function getInitialEffectPath() {
    const model = urlParams.get('model') || 'classic';
    const color = urlParams.get('color') || 'white';

    if (effectMap[model] && effectMap[model][color]) {
        return effectMap[model][color];
    }

    // Fallback: find first available effect
    for (const modelKey in effectMap) {
        for (const colorKey in effectMap[modelKey]) {
            console.log(`🔄 Using fallback effect: ${modelKey} ${colorKey}`);
            return effectMap[modelKey][colorKey];
        }
    }

    return null;
}

// Main initialization function
(async function () {
    loader.classList.add('active');
    try {
        // Initialize DeepAR first
        deepAR = await deepar.initialize({
            licenseKey: 'f0eafd99d224758bdc2c7271acd80bc7642fdb178ba74faf1c61c1ec7d25221057493e7b9b73c58d',
            previewElement: preview,
        });
        console.log("✅ DeepAR initialized");

        // Fetch AR models data
        let arModelsData = await fetchARModels();

        if (!arModelsData || Object.keys(arModelsData).length === 0) {
            throw new Error('No AR models data available');
        }

        console.log('📊 Available models and colors:', arModelsData);

        // Get initial effect path
        const initialEffectPath = getInitialEffectPath();

        if (!initialEffectPath) {
            throw new Error('No DeepAR effects available. Please ensure DeepAR effects are uploaded to the database.');
        }

        // Start with back camera
        await switchCamera('environment');
        await deepAR.switchEffect(initialEffectPath);
        console.log(`✅ Initial shoe effect loaded: ${initialEffectPath}`);

        // Set up DeepAR callbacks
        deepAR.callbacks.onFeetVisibilityChanged = (visible) => {
            console.log(visible ? '👟 Feet detected!' : 'No feet visible.');
        };

        // Create filter buttons based on available data
        createFilterButtons(arModelsData);

        // Select initial button
        const initialModel = urlParams.get('model') || 'classic';
        const initialColor = urlParams.get('color') || 'white';
        const initialButton = Array.from(document.querySelectorAll('.filter-button')).find(btn =>
            btn.dataset.model === initialModel && btn.dataset.color === initialColor
        );

        if (initialButton) {
            initialButton.classList.add('selected');
            console.log(`✅ Selected initial button: ${initialModel} ${initialColor}`);
        } else {
            const firstButton = document.querySelector('.filter-button');
            if (firstButton) {
                firstButton.classList.add('selected');
                console.log('✅ Selected first available button as fallback');
            }
        }

        loader.classList.remove('active');
        console.log('🎉 AR Try-On initialized successfully');

    } catch (err) {
        console.error("❌ Initialization error:", err);
        loader.classList.remove('active');
        alert('Failed to initialize AR. Please check console for details and ensure DeepAR effects are properly configured.');
    }
})();

// Camera and effect switching functions
async function switchCamera(facingMode) {
    try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode }
        });
        currentStream = stream;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        await video.play();

        deepAR.setVideoElement(video, isMirrored);
        console.log(`✅ Switched to ${facingMode} camera.`);
    } catch (err) {
        console.error("❌ Failed to switch camera:", err);
        alert('Failed to switch camera. Please ensure camera permissions are granted.');
    }
}

function handleBuyNow() {
    if (window.userAuthStatus) window.location.href = deepARBuyNowLink;
    else window.location.href = `/login.html#customer`;
}

async function toggleCamera() {
    isFrontCamera = !isFrontCamera;
    const facingMode = isFrontCamera ? 'user' : 'environment';
    await switchCamera(facingMode);
}

async function switchEffect(effectPath, model, color) {
    try {
        if (!deepAR) throw new Error('DeepAR not initialized');

        console.log(`🔄 Switching to effect: ${effectPath}`);
        await deepAR.switchEffect(effectPath);

        currentEffectPath = effectPath;
        console.log(`✅ Switched to effect: ${effectPath}`);

        // Update buy now link with current model and color
        deepARBuyNowLink = `/customer/html/customizeshoe.html?model=${model}&color=${color}`;
        console.log(`🛒 Updated buy now link: ${deepARBuyNowLink}`);
    } catch (err) {
        console.error("❌ Failed to switch effect:", err);
        alert('Failed to switch AR effect. The effect file might be missing or corrupted.');
    }
}

// Event listeners (keep your existing event listeners)
toggleButton.addEventListener('click', () => {
    filterSection.classList.toggle('minimized');
    if (filterSection.classList.contains('minimized')) {
        toggleButton.innerHTML = '<i class="fas fa-chevron-up"></i> Show Filters';
    } else {
        toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i> Hide Filters';
    }
});

expandBtn.addEventListener('click', enterExpanded);
exitBtn.addEventListener('click', exitExpanded);
exitBtnExpanded.addEventListener('click', exitExpanded);

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
buyNowButton.addEventListener('click', handleBuyNow);

function enterExpanded() {
    preview.classList.add('expanded');
    filterSection.classList.add('expanded');
    filterSection.classList.remove('minimized');
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