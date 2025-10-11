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
    
    // Load customization data from database
    await loadCustomizationData();
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Check URL parameters for model selection
    checkUrlParameters();
    
    // Initial preview update
    updatePreview();
}

// Load customization data from Firebase Database
async function loadCustomizationData() {
    try {
        const modelsPath = 'smartfit_AR_Database/ar_customization_models';
        const result = await readData(modelsPath);
        
        if (result.success && result.data) {
            customizationData = result.data;
            console.log('Loaded customization data:', customizationData);
            
            // Initialize default selections based on available data
            initializeDefaultSelections();
            
            // Setup all customization options with real images
            setupAllCustomizationOptions();
        } else {
            console.warn('No customization data found in database');
            // Use empty data - customer won't see any customization options
        }
    } catch (error) {
        console.error('Error loading customization data:', error);
        // Continue with empty data
    }
}

// Initialize default selections based on available customization data
function initializeDefaultSelections() {
    Object.keys(customizationData).forEach(modelId => {
        const modelData = customizationData[modelId];
        if (!modelData) return;

        // Set default body color (first available color)
        const bodyColors = Object.keys(modelData.bodyColors || {});
        if (bodyColors.length > 0) {
            selections[modelId].bodyColor = bodyColors[0];
        }

        // Set default laces (first available laces)
        const laces = Object.keys(modelData.laces || {});
        if (laces.length > 0) {
            const firstLace = modelData.laces[laces[0]];
            selections[modelId].laces = {
                id: firstLace.id,
                price: firstLace.price || 0,
                days: firstLace.days || 0,
                image: firstLace.image || '',
                color: (firstLace.colors && firstLace.colors.length > 0) ? firstLace.colors[0] : null
            };
        }

        // Set default insole (first available insole)
        const insoles = Object.keys(modelData.insoles || {});
        if (insoles.length > 0) {
            const firstInsole = modelData.insoles[insoles[0]];
            selections[modelId].insole = {
                id: firstInsole.id,
                price: firstInsole.price || 0,
                days: firstInsole.days || 0,
                image: firstInsole.image || ''
            };
        }
    });
}

// Setup all customization options with real images from database
function setupAllCustomizationOptions() {
    // Setup options for each model
    ['classic', 'runner', 'basketball'].forEach(model => {
        setupInsoleOptions(model);
        setupLacesOptions(model);
        setupColorOptions('bodyColor', getElement(`${model}BodyColorOptions`), model);
        setupColorOptions('lacesColor', getElement(`${model}LacesColorOptions`), model);
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
            userAvatar.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        }
    }
}

// Update shoe images based on model and color using database URLs
function updateShoeImages() {
    const arExperienceLink = getElement('arExperienceLink');
    const bodyColor = selections[currentModel].bodyColor;
    
    // Update AR link - you might want to update this based on your AR implementation
    arExperienceLink.href = `#${currentModel}-${bodyColor}`;
    
    // Get the current model data
    const modelData = customizationData[currentModel];
    
    if (!modelData || !bodyColor) {
        console.warn('No model data or body color selected');
        return;
    }

    // Get color data from database
    const colorData = modelData.bodyColors && modelData.bodyColors[bodyColor];
    
    if (!colorData || !colorData.images) {
        console.warn(`No image data found for ${bodyColor} in ${currentModel}`);
        // Fallback to placeholder
        setFallbackImages();
        return;
    }

    const images = colorData.images;
    
    console.log(`Loading images for ${currentModel} - ${bodyColor}:`, images);

    // Update main image using database URL
    const soleImage = getElement('soleImage');
    if (soleImage && images.main) {
        soleImage.src = images.main;
        soleImage.onerror = function() {
            console.error(`Failed to load main image: ${images.main}`);
            this.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        };
    } else if (soleImage) {
        soleImage.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }
    
    // Update additional view images using database URLs
    const frontViewImage = getElement('frontViewImage');
    if (frontViewImage && images.front) {
        frontViewImage.src = images.front;
        frontViewImage.onerror = function() {
            console.error(`Failed to load front image: ${images.front}`);
            this.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        };
    } else if (frontViewImage) {
        frontViewImage.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }
    
    const sideViewImage = getElement('sideViewImage');
    if (sideViewImage && images.side) {
        sideViewImage.src = images.side;
        sideViewImage.onerror = function() {
            console.error(`Failed to load side image: ${images.side}`);
            this.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        };
    } else if (sideViewImage) {
        sideViewImage.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }
    
    const backViewImage = getElement('backViewImage');
    if (backViewImage && images.back) {
        backViewImage.src = images.back;
        backViewImage.onerror = function() {
            console.error(`Failed to load back image: ${images.back}`);
            this.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        };
    } else if (backViewImage) {
        backViewImage.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }
}

// Fallback function if no images are found in database
function setFallbackImages() {
    const images = [
        getElement('soleImage'),
        getElement('frontViewImage'),
        getElement('sideViewImage'),
        getElement('backViewImage')
    ];
    
    images.forEach(img => {
        if (img) {
            img.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        }
    });
}

// Check URL parameters for model selection
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const modelParam = urlParams.get('model')?.toLowerCase();

    const modelMap = {
        'classic': 'classic',
        'runner': 'runner',
        'basketball': 'basketball'
    };

    let modelToSelect = 'classic';
    
    if (modelParam && modelMap[modelParam]) {
        modelToSelect = modelMap[modelParam];
    }

    const modelOption = document.querySelector(`.model-option[data-model="${modelToSelect}"]`);
    if (modelOption) {
        modelOption.click();
    } else {
        document.querySelector('.model-option[data-model="classic"]').click();
    }
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
        option.className = `component-option ${index === 0 ? 'selected' : ''}`;
        option.dataset.id = insole.id;
        option.dataset.price = insole.price || 0;
        option.dataset.days = insole.days || 0;
        option.dataset.image = insole.image || '';
        
        // Use the image URL from database, fallback to placeholder
        const imageUrl = insole.image || 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png';
        
        option.innerHTML = `
            <img src="${imageUrl}" 
                 alt="${insole.id}" 
                 class="component-option-image"
                 onerror="this.src='https://cdn-icons-png.flaticon.com/512/11542/11542598.png'">
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
        option.className = `component-option ${index === 0 ? 'selected' : ''}`;
        option.dataset.id = lace.id;
        option.dataset.price = lace.price || 0;
        option.dataset.days = lace.days || 0;
        option.dataset.image = lace.image || '';
        
        // Use the image URL from database, fallback to placeholder
        const imageUrl = lace.image || 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png';
        
        option.innerHTML = `
            <img src="${imageUrl}" 
                 alt="${lace.id}" 
                 class="component-option-image"
                 onerror="this.src='https://cdn-icons-png.flaticon.com/512/11542/11542598.png'">
            <div class="component-option-name">${lace.id}</div>
            <div class="component-option-price">+₱${lace.price || 0}</div>
        `;
        
        option.addEventListener('click', function () {
            optionsContainer.querySelectorAll('.component-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selections[model].laces = {
                id: this.dataset.id,
                price: parseFloat(this.dataset.price),
                days: parseInt(this.dataset.days),
                image: this.dataset.image,
                color: selections[model].laces.color // Keep current color
            };
            updatePreview();
        });
        
        optionsContainer.appendChild(option);
    });
}

// Setup color options dynamically from database
function setupColorOptions(colorType, optionsContainer, model) {
    if (!optionsContainer) return;
    
    const modelData = customizationData[model];
    let colors = [];
    
    if (colorType === 'bodyColor') {
        if (modelData && modelData.bodyColors) {
            colors = Object.keys(modelData.bodyColors);
        }
    } else if (colorType === 'lacesColor') {
        const currentLaceId = selections[model].laces.id;
        if (modelData && modelData.laces && modelData.laces[currentLaceId]) {
            colors = modelData.laces[currentLaceId].colors || [];
        }
    }
    
    if (colors.length === 0) {
        optionsContainer.innerHTML = '<div class="no-options">No color options available</div>';
        return;
    }

    optionsContainer.innerHTML = '';
    
    colors.forEach((color, index) => {
        const option = document.createElement('div');
        option.className = `color-option ${index === 0 ? 'selected' : ''}`;
        option.dataset.color = color;
        option.style.backgroundColor = getColorValue(color);
        
        // Add tooltip with color name
        const colorName = color.charAt(0).toUpperCase() + color.slice(1);
        option.title = colorName;
        
        // Add checkmark for selected state
        if (index === 0) {
            const checkmark = document.createElement('div');
            checkmark.className = 'color-checkmark';
            checkmark.innerHTML = '✓';
            option.appendChild(checkmark);
        }
        
        option.addEventListener('click', function () {
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
            const checkmark = document.createElement('div');
            checkmark.className = 'color-checkmark';
            checkmark.innerHTML = '✓';
            this.appendChild(checkmark);
            
            if (colorType === 'bodyColor') {
                selections[model].bodyColor = this.dataset.color;
            } else if (colorType === 'lacesColor') {
                selections[model].laces.color = this.dataset.color;
            }
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

// Get preview image URL - now uses actual database images
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

// Save design to Realtime Database
async function saveDesignToDatabase() {
    try {
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

        // Create design object with price breakdown
        const designData = {
            userId: userSession.userId,
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
            previewImage: getPreviewImageUrl(), // Use the actual image URL
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Save to database
        const designPath = `smartfit_AR_Database/saved_customShoes/${userSession.userId}/${generate18CharID()}`;
        const result = await createData(designPath, userSession.userId, designData);
        
        if (result.success) {
            console.log('Design saved with ID: ', result.dataId);
            return result.dataId;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error saving design: ', error);
        alert('There was an error saving your design. Please try again.');
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
            image: getPreviewImageUrl(), // Use the actual image URL
            isCustom: true,
            selections: selections[currentModel],
            productionTime: `${prices.totalDays}-${prices.totalDays + 3} days`
        };

        // Save to cart
        const cartPath = `smartfit_AR_Database/customized_cart/${userSession.userId}/${generate18CharID()}`;
        const result = await createData(cartPath, userSession.userId, cartItem);
        
        if (result.success) {
            alert(`Your custom ${currentModel} shoe has been added to your cart!`);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error adding to cart: ', error);
        alert('There was an error adding your design to the cart. Please try again.');
    }
}

// Buy now - using URL params instead of database
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
            model: currentModel,
            size: selectedSize,
            basePrice: basePrice,
            lacesPrice: prices.lacesPrice,
            insolePrice: prices.insolePrice,
            customizationPrice: prices.customizationPrice,
            vatPrice: prices.vatPrice,
            totalPrice: prices.totalPrice,
            productionTime: `${prices.totalDays}-${prices.totalDays + 3} days`,
            previewImage: getPreviewImageUrl(), // Use the actual image URL
            selections: cleanSelections,
            timestamp: Date.now()
        };

        // Encode order data for URL parameters
        const orderDataString = encodeURIComponent(JSON.stringify(orderData));
        
        // Generate a simple order ID
        const orderId = `CUST-${Date.now()}`;
        
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
    setupColorOptions('bodyColor', getElement(`${model}BodyColorOptions`), model);
    setupColorOptions('lacesColor', getElement(`${model}LacesColorOptions`), model);
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
            // Open the image's src in a new tab
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
            
            updatePreview();
        });
    });

    // Size selection
    const sizeOptions = document.querySelectorAll('#sizeOptions .component-option');
    sizeOptions.forEach(btn => {
        btn.addEventListener('click', function () {
            sizeOptions.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            selectedSize = this.dataset.size;
        });
    });

    // Save design button
    const saveDesignBtn = document.querySelector('.btn-outline');
    if (saveDesignBtn) {
        saveDesignBtn.addEventListener('click', async function () {
            try {
                await saveDesignToDatabase();
                alert(`Your ${currentModel} design has been saved to your account!`);
            } catch (error) {
                console.error('Error saving design: ', error);
                alert('There was an error saving your design. Please try again.');
            }
        });
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