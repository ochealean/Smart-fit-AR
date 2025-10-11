// customizeshoeedit.js - Edit existing custom shoe designs
import {
    checkUserAuth,
    logoutUser,
    createData,
    updateData,
    readData,
    generate18CharID
} from "../../firebaseMethods.js";

// Global variables
let currentModel = 'classic';
let basePrice = 2499;
let baseDays = 7;
let selectedSize = 5;
let designId = null;
let originalDesignData = null;
let userSession = {
    userId: null,
    userData: null
};

// Store customization data from database
let customizationData = {
    classic: null,
    runner: null,
    basketball: null
};

// Default selections structure
let selections = {
    classic: {
        bodyColor: null,
        laces: {
            id: null,
            price: 0,
            days: 0,
            image: '',
            color: null
        },
        insole: {
            id: null,
            price: 0,
            days: 0,
            image: ''
        }
    },
    runner: {
        bodyColor: null,
        laces: {
            id: null,
            price: 0,
            days: 0,
            image: '',
            color: null
        },
        insole: {
            id: null,
            price: 0,
            days: 0,
            image: ''
        }
    },
    basketball: {
        bodyColor: null,
        laces: {
            id: null,
            price: 0,
            days: 0,
            image: '',
            color: null
        },
        insole: {
            id: null,
            price: 0,
            days: 0,
            image: ''
        }
    }
};

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function () {
    await initializePage();
});

async function initializePage() {
    const user = await checkUserAuth();

    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    userSession.userId = user.userId;
    userSession.userData = user.userData;

    // Set user profile information
    setUserProfile();

    // Get design ID from URL
    designId = getDesignIdFromUrl();

    if (!designId) {
        alert('No design ID specified. Redirecting to customization page.');
        window.location.href = 'customizeshoe.html';
        return;
    }

    // Load customization data from database
    await loadCustomizationData();

    // Initialize event listeners FIRST
    initializeEventListeners();

    // Load the saved design data AFTER UI is ready
    await loadSavedDesign();

    // Initial preview update
    updatePreview();
    
    // Final check to ensure lace colors are properly initialized
    setTimeout(() => {
        ensureLaceColorsInitialized();
    }, 500);
}

// Get design ID from URL
function getDesignIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('designId');
}

// Load saved design data from database
async function loadSavedDesign() {
    try {
        const designPath = `smartfit_AR_Database/saved_customShoes/${userSession.userId}/${designId}`;
        const result = await readData(designPath);

        if (result.success && result.data) {
            originalDesignData = result.data;
            applySavedDesign(originalDesignData);
        } else {
            throw new Error('Design not found');
        }
    } catch (error) {
        console.error('Error loading saved design:', error);
        alert('Error loading your saved design. Redirecting to customization page.');
        window.location.href = 'customizeshoe.html';
    }
}

// Apply saved design data to the UI - FIXED VERSION
function applySavedDesign(designData) {
    console.log('Applying saved design:', designData);

    // Set basic design info
    currentModel = designData.model;
    selectedSize = designData.size;

    // Apply selections from saved design
    if (designData.selections) {
        selections[currentModel] = { ...designData.selections };
        console.log('Applied selections for model:', currentModel, selections[currentModel]);
    }

    // First, ensure the correct model is selected in UI
    const modelOption = document.querySelector(`.model-option[data-model="${currentModel}"]`);
    if (modelOption) {
        // Remove selected class from all models
        document.querySelectorAll('.model-option').forEach(opt => opt.classList.remove('selected'));
        // Add selected class to correct model
        modelOption.classList.add('selected');

        // Hide all model-specific sections
        document.querySelectorAll('.model-specific').forEach(section => {
            section.style.display = 'none';
        });

        // Show sections for selected model
        document.querySelectorAll(`.model-specific.${currentModel}`).forEach(section => {
            section.style.display = 'block';
        });

        // Update base price and days from database
        const modelData = customizationData[currentModel];
        if (modelData) {
            basePrice = modelData.basePrice || 2499;
            baseDays = modelData.baseDays || 7;
        }
    }

    // Now apply all other selections
    applyAllSelections();
}

// Apply all component selections to UI - NEW FUNCTION
function applyAllSelections() {
    console.log('Applying all selections for model:', currentModel);

    // Select size
    selectSize(selectedSize);

    // Apply component selections
    applyComponentSelections();

    // Update preview
    updatePreview();
}

// Select size in UI
function selectSize(size) {
    const sizeOptions = document.querySelectorAll('#sizeOptions .component-option');
    sizeOptions.forEach(btn => {
        if (btn.dataset.size === size.toString()) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

// Apply component selections to UI 
function applyComponentSelections() {
    const modelSelections = selections[currentModel];
    console.log('Applying component selections:', modelSelections);

    if (!modelSelections) {
        console.warn('No selections found for model:', currentModel);
        return;
    }

    // Apply body color first
    if (modelSelections.bodyColor) {
        applyBodyColorSelection(modelSelections.bodyColor);
    }

    // Apply insole selection
    if (modelSelections.insole?.id) {
        applyInsoleSelection(modelSelections.insole.id);
    }

    // Apply laces selection LAST to ensure lace colors are properly initialized
    if (modelSelections.laces?.id) {
        // Use a slightly longer delay to ensure all DOM elements are ready
        setTimeout(() => {
            applyLacesSelection(modelSelections.laces.id, modelSelections.laces.color);
        }, 200);
    }
}

// Apply body color selection
function applyBodyColorSelection(bodyColor) {
    const container = getElement(`${currentModel}BodyColorOptions`);
    if (!container) {
        console.error(`Body color container not found for model: ${currentModel}`);
        return;
    }

    const options = container.querySelectorAll('.color-option');
    options.forEach(option => {
        if (option.dataset.color === bodyColor) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
            const checkmark = option.querySelector('.color-checkmark');
            if (checkmark) {
                checkmark.remove();
            }
        }
    });
}

// Apply insole selection
function applyInsoleSelection(insoleId) {
    const container = getElement(`${currentModel}InsoleOptions`);
    if (!container) {
        console.error(`Insole container not found for model: ${currentModel}`);
        return;
    }

    const options = container.querySelectorAll('.component-option');
    options.forEach(option => {
        if (option.dataset.id === insoleId) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

// Apply laces selection - UPDATED VERSION
function applyLacesSelection(laceId, laceColor) {
    const container = getElement(`${currentModel}LacesOptions`);
    if (!container) {
        console.error(`Laces container not found for model: ${currentModel}`);
        return;
    }

    // Select lace type
    const options = container.querySelectorAll('.component-option');
    options.forEach(option => {
        if (option.dataset.id === laceId) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });

    // IMPORTANT: Setup lace color options immediately
    setupLaceColorOptions(currentModel);

    // Apply lace color selection after a brief delay to ensure DOM is ready
    setTimeout(() => {
        if (laceColor) {
            applyLaceColorSelection(laceColor);
        }
    }, 150);
}

// Apply lace color selection
function applyLaceColorSelection(laceColor) {
    const container = getElement(`${currentModel}LacesColorOptions`);
    if (!container) {
        console.error(`Lace color container not found for model: ${currentModel}`);
        return;
    }

    const options = container.querySelectorAll('.color-option');
    let found = false;

    options.forEach(option => {
        if (option.dataset.color === laceColor) {
            option.classList.add('selected');
            found = true;
        } else {
            option.classList.remove('selected');
            const checkmark = option.querySelector('.color-checkmark');
            if (checkmark) {
                checkmark.remove();
            }
        }
    });

    if (!found) {
        console.warn(`Lace color ${laceColor} not found in available options`);
        // Select the first available color if saved color is not found
        if (options.length > 0) {
            setTimeout(() => {
                options[0].click();
            }, 100);
        }
    }
}

// Load customization data from Firebase Database
async function loadCustomizationData() {
    try {
        const modelsPath = 'smartfit_AR_Database/ar_customization_models';
        const result = await readData(modelsPath);

        if (result.success && result.data) {
            customizationData = result.data;
            console.log('Loaded customization data:', customizationData);

            // Setup all customization options with real images
            setupAllCustomizationOptions();
        } else {
            console.warn('No customization data found in database');
        }
    } catch (error) {
        console.error('Error loading customization data:', error);
    }
}

// Setup all customization options with real images from database - IMPROVED
function setupAllCustomizationOptions() {
    // Setup options for each model
    ['classic', 'runner', 'basketball'].forEach(model => {
        setupInsoleOptions(model);
        setupLacesOptions(model);
        setupBodyColorOptions(model);
        // Lace colors will be setup when lace type is selected
    });
}

// Set user profile information
function setUserProfile() {
    const userNameDisplay = getElement('userName_display2');
    const userAvatar = getElement('imageProfile');

    if (userSession.userData) {
        if (userSession.userData.firstName && userSession.userData.lastName) {
            userNameDisplay.textContent = `${userSession.userData.firstName} ${userSession.userData.lastName}`;
        } else if (userSession.userData.name) {
            userNameDisplay.textContent = userSession.userData.name;
        } else {
            userNameDisplay.textContent = "User";
        }

        // Set user avatar if available
        if (userSession.userData.profilePhoto) {
            userAvatar.src = userSession.userData.profilePhoto;
        } else {
            userAvatar.src = getFallbackImage();
        }
    }
}

// Update shoe images based on model and color using database URLs - IMPROVED
function updateShoeImages() {
    const arExperienceLink = getElement('arExperienceLink');
    const bodyColor = selections[currentModel].bodyColor;

    // Update AR link
    if (arExperienceLink) {
        arExperienceLink.href = `#${currentModel}-${bodyColor}`;
    }

    // Get the current model data
    const modelData = customizationData[currentModel];

    if (!modelData || !bodyColor) {
        console.warn('No model data or body color selected');
        setFallbackImages();
        return;
    }

    // Get color data from database
    const colorData = modelData.bodyColors && modelData.bodyColors[bodyColor];

    if (!colorData) {
        console.warn(`No color data found for ${bodyColor} in ${currentModel}`);
        setFallbackImages();
        return;
    }

    // Use images object if available, otherwise use direct image property
    const images = colorData.images || { main: colorData.image };

    console.log(`Loading images for ${currentModel} - ${bodyColor}:`, images);

    // Update main image using database URL
    const soleImage = getElement('soleImage');
    if (soleImage) {
        if (images.main) {
            soleImage.src = images.main;
            soleImage.onerror = function () {
                console.error(`Failed to load main image: ${images.main}`);
                setFallbackImages();
            };
        } else {
            setFallbackImages();
        }
    }

    // Update additional view images using database URLs
    const frontViewImage = getElement('frontViewImage');
    if (frontViewImage && images.front) {
        frontViewImage.src = images.front;
        frontViewImage.onerror = function () {
            console.error(`Failed to load front image: ${images.front}`);
            this.src = getFallbackImage();
        };
    } else if (frontViewImage) {
        frontViewImage.src = getFallbackImage();
    }

    const sideViewImage = getElement('sideViewImage');
    if (sideViewImage && images.side) {
        sideViewImage.src = images.side;
        sideViewImage.onerror = function () {
            console.error(`Failed to load side image: ${images.side}`);
            this.src = getFallbackImage();
        };
    } else if (sideViewImage) {
        sideViewImage.src = getFallbackImage();
    }

    const backViewImage = getElement('backViewImage');
    if (backViewImage && images.back) {
        backViewImage.src = images.back;
        backViewImage.onerror = function () {
            console.error(`Failed to load back image: ${images.back}`);
            this.src = getFallbackImage();
        };
    } else if (backViewImage) {
        backViewImage.src = getFallbackImage();
    }
}

// Improved fallback image function
function getFallbackImage() {
    return "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
}

// Fallback function if no images are found in database
function setFallbackImages() {
    const images = [
        getElement('soleImage'),
        getElement('frontViewImage'),
        getElement('sideViewImage'),
        getElement('backViewImage')
    ].filter(img => img !== null);

    images.forEach(img => {
        if (img) {
            img.src = getFallbackImage();
        }
    });
}

// Update the shoe preview and summary
function updatePreview() {
    const modelData = customizationData[currentModel];

    if (modelData) {
        basePrice = modelData.basePrice || 2499;
        baseDays = modelData.baseDays || 7;
    }

    // Calculate totals
    let lacesPrice = selections[currentModel].laces.price || 0;
    let insolePrice = selections[currentModel].insole.price || 0;
    let maxDays = Math.max(selections[currentModel].laces.days || 0, selections[currentModel].insole.days || 0);

    const customizationPrice = lacesPrice + insolePrice;
    const subtotal = basePrice + customizationPrice;
    const vatPrice = subtotal * 0.12;
    const totalPrice = subtotal + vatPrice;
    const totalDays = baseDays + maxDays;

    // Update summary
    const basePriceElement = getElement('basePrice');
    const lacesPriceElement = getElement('lacesPrice');
    const insolePriceElement = getElement('insolePrice');
    const customizationPriceElement = getElement('customizationPrice');
    const vatPriceElement = getElement('vatPrice');
    const productionTimeElement = getElement('productionTime');
    const totalPriceElement = getElement('totalPrice');

    if (basePriceElement) basePriceElement.textContent = `₱${basePrice.toFixed(2)}`;
    if (lacesPriceElement) lacesPriceElement.textContent = `+₱${lacesPrice.toFixed(2)}`;
    if (insolePriceElement) insolePriceElement.textContent = `+₱${insolePrice.toFixed(2)}`;
    if (customizationPriceElement) customizationPriceElement.textContent = `+₱${customizationPrice.toFixed(2)}`;
    if (vatPriceElement) vatPriceElement.textContent = `+₱${vatPrice.toFixed(2)}`;
    if (productionTimeElement) productionTimeElement.textContent = `${totalDays}-${totalDays + 3} days`;
    if (totalPriceElement) totalPriceElement.textContent = `₱${totalPrice.toFixed(2)}`;

    // Update shoe images
    updateShoeImages();

    // Return values for database storage
    return {
        lacesPrice,
        insolePrice,
        customizationPrice,
        vatPrice,
        totalPrice,
        totalDays
    };
}

// Setup insole options dynamically from database
function setupInsoleOptions(model) {
    const optionsContainer = getElement(`${model}InsoleOptions`);
    if (!optionsContainer) return;

    const modelData = customizationData[model];
    if (!modelData || !modelData.insoles) {
        optionsContainer.innerHTML = '<div class="no-options">No insole options available</div>';
        return;
    }

    const insoles = Object.values(modelData.insoles);
    if (insoles.length === 0) {
        optionsContainer.innerHTML = '<div class="no-options">No insole options available</div>';
        return;
    }

    optionsContainer.innerHTML = '';

    insoles.forEach((insole, index) => {
        const option = document.createElement('div');
        option.className = `component-option`;
        option.dataset.id = insole.id;
        option.dataset.price = insole.price || 0;
        option.dataset.days = insole.days || 0;
        option.dataset.image = insole.image || '';

        // Use the image URL from database, fallback to placeholder
        const imageUrl = insole.image || getFallbackImage();

        option.innerHTML = `
            <img src="${imageUrl}" 
                 alt="${insole.id}" 
                 class="component-option-image"
                 onerror="this.src='${getFallbackImage()}'">
            <div class="component-option-name">${insole.id}</div>
            <div class="component-option-price">+₱${insole.price || 0}</div>
        `;

        option.addEventListener('click', function () {
            optionsContainer.querySelectorAll('.component-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selections[model].insole = {
                id: this.dataset.id,
                price: parseFloat(this.dataset.price),
                days: parseInt(this.dataset.days),
                image: this.dataset.image
            };
            updatePreview();
        });

        optionsContainer.appendChild(option);
    });
}

// Setup laces options dynamically from database
function setupLacesOptions(model) {
    const optionsContainer = getElement(`${model}LacesOptions`);
    if (!optionsContainer) return;

    const modelData = customizationData[model];
    if (!modelData || !modelData.laces) {
        optionsContainer.innerHTML = '<div class="no-options">No laces options available</div>';
        return;
    }

    const laces = Object.values(modelData.laces);
    if (laces.length === 0) {
        optionsContainer.innerHTML = '<div class="no-options">No laces options available</div>';
        return;
    }

    optionsContainer.innerHTML = '';

    laces.forEach((lace, index) => {
        const option = document.createElement('div');
        option.className = `component-option`;
        option.dataset.id = lace.id;
        option.dataset.price = lace.price || 0;
        option.dataset.days = lace.days || 0;
        option.dataset.image = lace.image || '';

        // Use the image URL from database, fallback to placeholder
        const imageUrl = lace.image || getFallbackImage();

        option.innerHTML = `
            <img src="${imageUrl}" 
                 alt="${lace.id}" 
                 class="component-option-image"
                 onerror="this.src='${getFallbackImage()}'">
            <div class="component-option-name">${lace.id}</div>
            <div class="component-option-price">+₱${lace.price || 0}</div>
        `;

        option.addEventListener('click', function () {
            optionsContainer.querySelectorAll('.component-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');

            // Get current lace color before updating
            const currentColor = selections[model].laces?.color;

            // Update lace selection
            selections[model].laces = {
                id: this.dataset.id,
                price: parseFloat(this.dataset.price),
                days: parseInt(this.dataset.days),
                image: this.dataset.image,
                color: currentColor // Preserve current color if it exists
            };

            // Refresh lace color options for the new lace type
            setupLaceColorOptions(model);

            updatePreview();
        });

        optionsContainer.appendChild(option);
    });
}

// Check and fix lace color initialization if needed
function ensureLaceColorsInitialized() {
    const laceColorContainer = getElement(`${currentModel}LacesColorOptions`);
    if (!laceColorContainer) return;
    
    const selectedColor = selections[currentModel].laces.color;
    const colorOptions = laceColorContainer.querySelectorAll('.color-option');
    
    // If we have a selected color but no options are selected, fix it
    if (selectedColor && colorOptions.length > 0) {
        let isAnySelected = false;
        colorOptions.forEach(option => {
            if (option.classList.contains('selected')) {
                isAnySelected = true;
            }
        });
        
        if (!isAnySelected) {
            console.log('Fixing unselected lace color:', selectedColor);
            applyLaceColorSelection(selectedColor);
        }
    }
}

// Setup lace color options specifically - UPDATED VERSION
function setupLaceColorOptions(model) {
    const optionsContainer = getElement(`${model}LacesColorOptions`);
    if (!optionsContainer) {
        console.error(`Lace color container not found for model: ${model}`);
        return;
    }

    const modelData = customizationData[model];
    const currentLaceId = selections[model].laces.id;
    const currentLaceColor = selections[model].laces.color;

    let colors = [];

    if (modelData && modelData.laces && modelData.laces[currentLaceId]) {
        colors = modelData.laces[currentLaceId].colors || [];
        console.log(`Found ${colors.length} colors for lace type ${currentLaceId} in model ${model}:`, colors);
    } else {
        console.warn(`No lace data found for ${currentLaceId} in model ${model}`);
    }

    if (colors.length === 0) {
        optionsContainer.innerHTML = '<div class="no-options">No color options available for this lace type</div>';
        selections[model].laces.color = null;
        return;
    }

    optionsContainer.innerHTML = '';

    colors.forEach((color, index) => {
        const option = document.createElement('div');
        option.className = `color-option`;
        option.dataset.color = color;
        option.style.backgroundColor = getColorValue(color);

        // Add tooltip with color name
        const colorName = color.charAt(0).toUpperCase() + color.slice(1);
        option.title = colorName;

        // Check if this color should be selected (from saved design)
        const shouldSelect = color === currentLaceColor;
        if (shouldSelect) {
            option.classList.add('selected');
        }

        option.addEventListener('click', function () {
            console.log(`Lace color selected: ${color} for model ${model}`);
            optionsContainer.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
                // Remove existing checkmarks
                const existingCheckmark = opt.querySelector('.color-checkmark');
                if (existingCheckmark) {
                    existingCheckmark.remove();
                }
            });
            this.classList.add('selected');

            // Add checkmark to selected color
            

            // Update the lace color selection
            selections[model].laces.color = this.dataset.color;
            console.log(`Updated selections for ${model}:`, selections[model]);
            updatePreview();
        });

        optionsContainer.appendChild(option);
    });

    // If no color is selected but we have colors available, select the first one
    if (!currentLaceColor && colors.length > 0) {
        setTimeout(() => {
            const firstColorOption = optionsContainer.querySelector('.color-option');
            if (firstColorOption && !firstColorOption.classList.contains('selected')) {
                firstColorOption.click();
            }
        }, 100);
    }
}

// Setup body color options - NEW SEPARATE FUNCTION
function setupBodyColorOptions(model) {
    const optionsContainer = getElement(`${model}BodyColorOptions`);
    if (!optionsContainer) {
        console.error(`Body color container not found for model: ${model}`);
        return;
    }

    const modelData = customizationData[model];
    let colors = [];

    if (modelData && modelData.bodyColors) {
        colors = Object.keys(modelData.bodyColors);
        console.log(`Found ${colors.length} body colors for model ${model}:`, colors);
    }

    if (colors.length === 0) {
        optionsContainer.innerHTML = '<div class="no-options">No color options available</div>';
        return;
    }

    optionsContainer.innerHTML = '';

    colors.forEach((color, index) => {
        const option = document.createElement('div');
        option.className = `color-option`;
        option.dataset.color = color;
        option.style.backgroundColor = getColorValue(color);

        // Add tooltip with color name
        const colorName = color.charAt(0).toUpperCase() + color.slice(1);
        option.title = colorName;

        option.addEventListener('click', function () {
            console.log(`Body color selected: ${color} for model ${model}`);
            optionsContainer.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
                // Remove existing checkmarks
                const existingCheckmark = opt.querySelector('.color-checkmark');
                if (existingCheckmark) {
                    existingCheckmark.remove();
                }
            });
            this.classList.add('selected');

            // Add checkmark to selected color
            

            selections[model].bodyColor = this.dataset.color;
            updatePreview();
        });

        optionsContainer.appendChild(option);
    });
}

// Helper function to get color value for display
function getColorValue(colorName) {
    const colorMap = {
        'white': '#e2e2e2',
        'black': '#000000',
        'blue': '#112dcc',
        'red': '#e74c3c',
        'green': '#27ae60',
        'gray': '#2c3e50',
        'yellow': '#f1c40f',
        'purple': '#9b59b6',
        'pink': '#e84393',
        'orange': '#e67e22',
        'brown': '#795548'
    };

    return colorMap[colorName] || '#cccccc';
}

// Get preview image URL - uses actual database images
function getPreviewImageUrl() {
    const modelData = customizationData[currentModel];
    const bodyColor = selections[currentModel].bodyColor;

    if (modelData && modelData.bodyColors && modelData.bodyColors[bodyColor]) {
        const colorData = modelData.bodyColors[bodyColor];
        // Return the main image URL if available
        if (colorData.images && colorData.images.main) {
            return colorData.images.main;
        }
    }

    // Fallback to placeholder based on model
    if (currentModel === 'classic') {
        return 'https://via.placeholder.com/200x120/667eea/white?text=Classic+Sneaker';
    } else if (currentModel === 'runner') {
        return 'https://via.placeholder.com/200x120/764ba2/white?text=Performance+Runner';
    } else {
        return 'https://via.placeholder.com/200x120/f093fb/white?text=High-Top+Basketball';
    }
}

// Save updated design to Realtime Database
async function saveDesignToDatabase() {
    try {
        if (!designId) {
            throw new Error('No design ID specified');
        }

        // Calculate totals using updatePreview
        const prices = updatePreview();

        // Clean up data
        const cleanSelections = {};
        Object.keys(selections[currentModel]).forEach(key => {
            if (selections[currentModel][key] !== undefined) {
                if (typeof selections[currentModel][key] === 'object') {
                    cleanSelections[key] = {};
                    Object.keys(selections[currentModel][key]).forEach(subKey => {
                        if (selections[currentModel][key][subKey] !== undefined) {
                            cleanSelections[key][subKey] = selections[currentModel][key][subKey];
                        }
                    });
                } else {
                    cleanSelections[key] = selections[currentModel][key];
                }
            }
        });

        // Create updated design object with price breakdown
        const updatedDesign = {
            ...originalDesignData, // Keep original data
            model: currentModel,
            size: selectedSize,
            basePrice: basePrice,
            lacesPrice: prices.lacesPrice,
            insolePrice: prices.insolePrice,
            customizationPrice: prices.customizationPrice,
            vatPrice: prices.vatPrice,
            totalPrice: prices.totalPrice,
            productionTime: `${prices.totalDays}-${prices.totalDays + 3} days`,
            selections: cleanSelections,
            previewImage: getPreviewImageUrl(),
            updatedAt: Date.now()
        };

        // Update in database
        const designPath = `smartfit_AR_Database/saved_customShoes/${userSession.userId}/${designId}`;
        const result = await updateData(designPath, updatedDesign);

        if (result.success) {
            console.log('Design updated with ID: ', designId);
            return designId;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error updating design: ', error);
        alert('There was an error updating your design. Please try again.');
        throw error;
    }
}

// Add to cart
async function addToCart() {
    try {
        // Calculate totals using updatePreview
        const prices = updatePreview();

        // Create cart item with price breakdown
        const cartItem = {
            model: currentModel,
            size: selectedSize,
            basePrice: basePrice,
            lacesPrice: prices.lacesPrice,
            insolePrice: prices.insolePrice,
            customizationPrice: prices.customizationPrice,
            vatPrice: prices.vatPrice,
            price: prices.totalPrice,
            quantity: 1,
            addedAt: Date.now(),
            image: getPreviewImageUrl(),
            isCustom: true,
            designId: designId, // Include the design ID for reference
            selections: selections[currentModel],
            productionTime: `${prices.totalDays}-${prices.totalDays + 3} days`
        };

        // Save to cart
        const cartPath = `smartfit_AR_Database/customized_cart/${userSession.userId}/${generate18CharID()}`;
        const result = await createData(cartPath, userSession.userId, cartItem);

        if (result.success) {
            alert(`Your updated ${currentModel} shoe design has been added to your cart!`);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error adding to cart: ', error);
        alert('There was an error adding your design to the cart. Please try again.');
    }
}

// Buy now - using URL params
async function buyNow() {
    try {
        // Calculate totals using updatePreview
        const prices = updatePreview();

        // Clean up selections for URL params
        const cleanSelections = {};
        Object.keys(selections[currentModel]).forEach(key => {
            if (selections[currentModel][key] !== undefined) {
                if (typeof selections[currentModel][key] === 'object') {
                    cleanSelections[key] = {};
                    Object.keys(selections[currentModel][key]).forEach(subKey => {
                        if (selections[currentModel][key][subKey] !== undefined) {
                            cleanSelections[key][subKey] = selections[currentModel][key][subKey];
                        }
                    });
                } else {
                    cleanSelections[key] = selections[currentModel][key];
                }
            }
        });

        // Create order data with price breakdown
        const orderData = {
            userId: userSession.userId,
            model: currentModel,
            size: selectedSize,
            basePrice: basePrice,
            lacesPrice: prices.lacesPrice,
            insolePrice: prices.insolePrice,
            customizationPrice: prices.customizationPrice,
            vatPrice: prices.vatPrice,
            totalPrice: prices.totalPrice,
            quantity: 1,
            image: getPreviewImageUrl(),
            isCustom: true,
            designId: designId, // Include the design ID for reference
            selections: cleanSelections,
            productionTime: `${prices.totalDays}-${prices.totalDays + 3} days`,
            timestamp: Date.now()
        };

        // Encode order data for URL parameters
        const orderDataString = encodeURIComponent(JSON.stringify(orderData));

        // Generate a simple order ID
        const orderId = `CUST-EDIT-${Date.now()}`;

        // Redirect to checkout with URL parameters
        window.location.href = `/customer/html/checkoutcustomize.html?orderId=${orderId}&orderData=${orderDataString}`;

    } catch (error) {
        console.error('Error during buy now: ', error);
        alert('There was an error placing your order. Please try again.');
    }
}

// Refresh customization options when model changes
function refreshCustomizationOptions(model) {
    setupInsoleOptions(model);
    setupLacesOptions(model);
    setupBodyColorOptions(model);

    // Setup lace colors if a lace type is already selected
    if (selections[model].laces?.id) {
        setupLaceColorOptions(model);
    }
}

// Initialize all event listeners
function initializeEventListeners() {
    // Mobile sidebar toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (mobileToggle && sidebar && overlay) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Image click to open in new tab
    const images = [
        getElement('soleImage'),
        getElement('frontViewImage'),
        getElement('sideViewImage'),
        getElement('backViewImage')
    ].filter(img => img !== null);

    images.forEach(img => {
        img.addEventListener('click', () => {
            window.open(img.src, '_blank');
        });
    });

    // Model selection
    const modelOptions = document.querySelectorAll('.model-option');
    modelOptions.forEach(option => {
        option.addEventListener('click', function () {
            modelOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            currentModel = this.dataset.model;

            // Update base price and days from database
            const modelData = customizationData[currentModel];
            if (modelData) {
                basePrice = modelData.basePrice || 2499;
                baseDays = modelData.baseDays || 7;
            }

            // Hide all model-specific sections
            document.querySelectorAll('.model-specific').forEach(section => {
                section.style.display = 'none';
            });

            // Show sections for selected model
            document.querySelectorAll(`.model-specific.${currentModel}`).forEach(section => {
                section.style.display = 'block';
            });

            // Refresh customization options for the selected model
            refreshCustomizationOptions(currentModel);

            // Update preview after a short delay to ensure UI is updated
            setTimeout(() => {
                updatePreview();
            }, 100);
        });
    });

    // Size selection
    const sizeOptions = document.querySelectorAll('#sizeOptions .component-option');
    sizeOptions.forEach(btn => {
        btn.addEventListener('click', function () {
            sizeOptions.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            selectedSize = this.dataset.size;
            updatePreview();
        });
    });

    // Save design button (updates existing design)
    const saveDesignBtn = document.querySelector('.btn-outline');
    if (saveDesignBtn) {
        saveDesignBtn.addEventListener('click', async function () {
            try {
                await saveDesignToDatabase();
                alert(`Your ${currentModel} design has been updated successfully!`);
            } catch (error) {
                console.error('Error saving design: ', error);
                alert('There was an error updating your design. Please try again.');
            }
        });
    }

    // Add to cart button
    const addToCartBtn = document.querySelector('.btn-add-to-cart');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', addToCart);
    }

    // Buy now button
    const buyNowBtn = document.querySelector('.btn-buy');
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', buyNow);
    }

    // Info button functionality
    const partsInfoBtn = getElement('partsInfoBtn');
    const sizeInfoBtn = getElement('sizeInfoBtn');
    const partsModal = getElement('partsInfoModal');
    const sizeModal = getElement('sizeInfoModal');
    const closePartsModal = getElement('closePartsModal');
    const closeSizeModal = getElement('closeSizeModal');

    if (partsInfoBtn && sizeInfoBtn && partsModal && sizeModal) {
        partsInfoBtn.addEventListener('click', () => {
            partsModal.style.display = 'flex';
        });

        sizeInfoBtn.addEventListener('click', () => {
            sizeModal.style.display = 'flex';
        });

        if (closePartsModal) {
            closePartsModal.addEventListener('click', () => {
                partsModal.style.display = 'none';
            });
        }

        if (closeSizeModal) {
            closeSizeModal.addEventListener('click', () => {
                sizeModal.style.display = 'none';
            });
        }

        window.addEventListener('click', (event) => {
            if (event.target === partsModal) {
                partsModal.style.display = 'none';
            }
            if (event.target === sizeModal) {
                sizeModal.style.display = 'none';
            }
        });
    }

    // Logout functionality
    getElement('logout_btn').addEventListener('click', handleLogout);
}

// Handle logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        const result = await logoutUser();
        if (result.success) {
            window.location.href = "/login.html";
        } else {
            alert('Logout failed: ' + result.error);
        }
    }
}

// Helper function to log current selections (for debugging)
function logCurrentSelections() {
    console.log('Current Model:', currentModel);
    console.log('Current Selections:', selections[currentModel]);
    console.log('Body Color:', selections[currentModel].bodyColor);
    console.log('Laces:', selections[currentModel].laces);
    console.log('Insole:', selections[currentModel].insole);
}