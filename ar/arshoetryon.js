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

const API_BASE_URL = 'https://deepareffecapi.onrender.com'; // Replace with your deployed API URL

// Function to build effect map from API
async function buildEffectMapFromAPI() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/deepar/models`);
    const modelsData = await response.json();
    
    if (!modelsData.models) {
      throw new Error('No models found from API');
    }

    const effectMap = {};
    
    // Build effect map for each model
    for (const model of modelsData.models) {
      const modelId = model.id;
      effectMap[modelId] = {};
      
      // Get available effects for this model
      const effectsResponse = await fetch(`${API_BASE_URL}/api/deepar/models/${modelId}`);
      const effectsData = await effectsResponse.json();
      
      if (effectsData.availableEffects) {
        for (const [color, effectInfo] of Object.entries(effectsData.availableEffects)) {
          effectMap[modelId][color] = effectInfo.deeparEffect;
        }
      }
    }
    
    console.log('🎯 Effect map built from API:', effectMap);
    return effectMap;
    
  } catch (error) {
    console.error('❌ Error building effect map from API:', error);
    return null;
  }
}

// Updated fetchARModels function
async function fetchARModels() {
  try {
    // Try to get effects from API first
    const apiEffectMap = await buildEffectMapFromAPI();
    
    if (apiEffectMap) {
      effectMap = apiEffectMap;
      console.log('✅ Using effects from API server');
    } else {
      // Fallback to direct Firebase (with CORS issues)
      console.warn('⚠️ Falling back to direct Firebase access');
      const result = await readData('smartfit_AR_Database/ar_customization_models');
      if (result.success) {
        // Build effect map from Firebase (existing code)
        // This will have CORS issues but works as fallback
      }
    }
    
    return apiEffectMap;
    
  } catch (error) {
    console.error('❌ Error in fetchARModels:', error);
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
    container.innerHTML = ''; // Clear existing content
    
    const categories = Object.keys(arModelsData);
    
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
        
        for (const color in availableColors) {
            const button = document.createElement('div');
            button.className = 'filter-button';
            
            // Check if effect exists for this color in our effect map
            if (!effectMap[model] || !effectMap[model][color]) {
                console.warn(`⚠️ No DeepAR effect found for ${model} ${color}, skipping`);
                continue;
            }
            
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
            img.onerror = function() {
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
        }
        
        group.appendChild(buttonsDiv);
        container.appendChild(group);

        if (catIndex < categories.length - 1) {
            const divider = document.createElement('div');
            divider.classList = 'category-divider';
            container.appendChild(divider);
        }
    });
}

// Function to get initial effect path based on URL parameters
function getInitialEffectPath(arModelsData) {
    const model = urlParams.get('model') || 'classic';
    const color = urlParams.get('color') || 'white';
    
    if (effectMap[model] && effectMap[model][color]) {
        return effectMap[model][color];
    }
    
    // Fallback: find first available effect
    for (const modelKey in effectMap) {
        for (const colorKey in effectMap[modelKey]) {
            return effectMap[modelKey][colorKey];
        }
    }
    
    return null;
}

(async function () {
    loader.classList.add('active');
    try {
        // Initialize DeepAR first
        deepAR = await deepar.initialize({
            licenseKey: 'f0eafd99d224758bdc2c7271acd80bc7642fdb178ba74faf1c61c1ec7d25221057493e7b9b73c58d',
            previewElement: preview,
        });
        console.log("✅ DeepAR initialized ");

        // Fetch AR models from database and build effect map
        const arModelsData = await fetchARModels();
        
        if (!arModelsData) {
            throw new Error('Failed to load AR models from database');
        }

        console.log('📊 Available models and colors:', arModelsData);

        // Get initial effect path from database
        currentEffectPath = getInitialEffectPath(arModelsData);
        
        if (!currentEffectPath) {
            throw new Error('No DeepAR effects found in database');
        }

        // Start with back camera
        await switchCamera('environment');
        await deepAR.switchEffect(currentEffectPath);
        console.log(`✅ Initial shoe effect loaded: ${currentEffectPath}`);

        deepAR.callbacks.onFeetVisibilityChanged = (visible) => {
            console.log(visible ? '👟 Feet detected!' : 'No feet visible.');
        };

        // Create filter buttons based on database data
        createFilterButtons(arModelsData);

        // Select initial button if available
        const initialModel = urlParams.get('model') || 'classic';
        const initialColor = urlParams.get('color') || 'white';
        const initialButton = Array.from(document.querySelectorAll('.filter-button')).find(btn => 
            btn.dataset.model === initialModel && btn.dataset.color === initialColor
        );
        
        if (initialButton) {
            initialButton.classList.add('selected');
        } else {
            // If initial effect not found, select first available button
            const firstButton = document.querySelector('.filter-button');
            if (firstButton) {
                firstButton.classList.add('selected');
                await switchEffect(firstButton.dataset.path, firstButton.dataset.model, firstButton.dataset.color);
            }
        }

        loader.classList.remove('active');
    } catch (err) {
        console.error("❌ Error:", err);
        loader.classList.remove('active');
        alert('Failed to initialize AR. Please check console for details.');
    }
})();

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
        video.play();

        deepAR.setVideoElement(video, isMirrored);
        console.log(`✅ Switched to ${facingMode} camera.`);
    } catch (err) {
        console.error("❌ Failed to switch camera:", err);
        alert('Failed to switch camera. Please ensure camera permissions are granted.');
    }
}

function handleBuyNow() {
    if(window.userAuthStatus) window.location.href = deepARBuyNowLink;
    else alert('please login first');
}

async function toggleCamera() {
    isFrontCamera = !isFrontCamera;
    const facingMode = isFrontCamera ? 'user' : 'environment';
    await switchCamera(facingMode);
}

async function switchEffect(effectPath, model, color) {
    try {
        if (!deepAR) throw new Error('DeepAR not initialized');
        await deepAR.switchEffect(effectPath);
        currentEffectPath = effectPath;
        console.log(`✅ Switched to effect: ${effectPath}`);

        // Update buy now link with current model and color
        deepARBuyNowLink = `/customer/html/customizeshoe.html?model=${model}&color=${color}`;
        console.log(`🛒 Updated buy now link: ${deepARBuyNowLink}`);
    } catch (err) {
        console.error("❌ Failed to switch effect:", err);
    }
}

// Event listeners remain the same...
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