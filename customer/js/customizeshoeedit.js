// customizeshoeedit.js - Refactored to use firebaseMethods only
import {
    checkUserAuth,
    logoutUser,
    readData,
    updateData,
    createData,
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

// Initialize selections with default values
let selections = {
    classic: {
        laces: {
            id: 'Standard',
            price: 0,
            days: 0,
            image: 'https://via.placeholder.com/100x20?text=Classic+Laces+1',
            color: 'white'
        },
        insole: {
            id: 'Foam',
            price: 0,
            days: 0,
            image: 'https://via.placeholder.com/100x20?text=Classic+Insole+1'
        },
        bodyColor: 'white'
    },
    runner: {
        laces: {
            id: 'Standard',
            price: 0,
            days: 0,
            image: 'https://via.placeholder.com/100x20?text=Runner+Laces+1',
            color: 'white'
        },
        insole: {
            id: 'Foam',
            price: 0,
            days: 0,
            image: 'https://via.placeholder.com/100x20?text=Runner+Insole+1'
        },
        bodyColor: 'white'
    },
    basketball: {
        laces: {
            id: 'Standard',
            price: 0,
            days: 0,
            image: 'https://via.placeholder.com/100x20?text=Basketball+Laces+1',
            color: 'white'
        },
        insole: {
            id: 'Foam',
            price: 0,
            days: 0,
            image: 'https://via.placeholder.com/100x20?text=Basketball+Insole+1'
        },
        bodyColor: 'white'
    },
    slipon: {
        midsole: {
            id: 'sliponMidsole1',
            price: 0,
            days: 0,
            image: 'https://via.placeholder.com/100x60?text=SlipOn+Midsole+1'
        },
        outsoleColor: 'gray',
        midsoleColor: 'white'
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

    // Initialize event listeners
    initializeEventListeners();

    // Load the design data
    try {
        const designData = await loadDesignData(designId);
        applyDesignData(designData);
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Error loading design. Redirecting to customization page.');
        window.location.href = 'customizeshoe.html';
    }
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
        if (userSession.userData.profilePhoto?.url) {
            userAvatar.src = userSession.userData.profilePhoto.url;
        } else {
            userAvatar.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        }
    }
}

// Get design ID from URL
function getDesignIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('designId');
}

// Load design data from Firebase
async function loadDesignData(designId) {
    try {
        const designPath = `smartfit_AR_Database/saved_customShoes/${userSession.userId}/${designId}`;
        const result = await readData(designPath);
        
        if (result.success && result.data) {
            originalDesignData = result.data;
            return originalDesignData;
        } else {
            throw new Error('Design not found');
        }
    } catch (error) {
        console.error('Error loading design:', error);
        alert('Error loading design. Please try again.');
        throw error;
    }
}

// Apply loaded design data to the UI
function applyDesignData(designData) {
    // Set basic design info
    currentModel = designData.model;
    selectedSize = designData.size;
    basePrice = designData.basePrice || basePrice;

    // Apply the selections to our global selections object
    if (designData.selections) {
        selections[currentModel] = { ...selections[currentModel], ...designData.selections };
    }

    // First, select the model
    selectModel(currentModel);

    // Then wait for the model-specific UI to update before selecting other options
    setTimeout(() => {
        // Select the size
        selectSize(selectedSize);

        // Select other components based on the model
        updateAllComponentSelections();

        // Update the preview and images
        updatePreview();
    }, 100);
}

// Helper function to select the size
function selectSize(size) {
    // Find the active size options container (visible for the current model)
    let sizeOptionsContainer = null;

    // Check each model-specific container to see which one is visible
    const modelContainers = document.querySelectorAll('.model-specific');
    for (const container of modelContainers) {
        if (container.style.display !== 'none') {
            const options = container.querySelector('#sizeOptions');
            if (options) {
                sizeOptionsContainer = options;
                break;
            }
        }
    }

    // If we found a visible size options container, select the size
    if (sizeOptionsContainer) {
        const sizeOption = sizeOptionsContainer.querySelector(`.component-option[data-size="${size}"]`);
        if (sizeOption && !sizeOption.classList.contains('selected')) {
            // Remove selected class from all options
            sizeOptionsContainer.querySelectorAll('.component-option').forEach(opt => {
                opt.classList.remove('selected');
            });

            // Add selected class to the target option
            sizeOption.classList.add('selected');
        }
    } else {
        // Fallback: try again after a short delay
        setTimeout(() => selectSize(size), 200);
    }
}

// Helper function to select the model
function selectModel(model) {
    const modelOption = document.querySelector(`.model-option[data-model="${model}"]`);
    if (modelOption && !modelOption.classList.contains('selected')) {
        modelOption.click();

        // Also manually update UI state since we're programmatically changing it
        document.querySelectorAll('.model-option').forEach(opt => opt.classList.remove('selected'));
        modelOption.classList.add('selected');

        // Hide all model-specific sections
        document.querySelectorAll('.model-specific').forEach(section => {
            section.style.display = 'none';
        });

        // Show sections for selected model
        document.querySelectorAll(`.model-specific.${model}`).forEach(section => {
            section.style.display = 'block';
        });
    }
}

// Update all component selections in the UI
function updateAllComponentSelections() {
    const modelSelections = selections[currentModel];

    // Helper function to select an option in the UI
    const selectOption = (containerId, optionId) => {
        const container = getElement(containerId);
        if (container) {
            const option = container.querySelector(`.component-option[data-id="${optionId}"]`);
            if (option && !option.classList.contains('selected')) {
                // Remove selected class from all options
                container.querySelectorAll('.component-option').forEach(opt => {
                    opt.classList.remove('selected');
                });

                // Add selected class to the target option
                option.classList.add('selected');
            }
        }
    };

    // Helper function to select a color in the UI
    const selectColor = (containerId, colorValue) => {
        const container = getElement(containerId);
        if (container) {
            const colorOption = container.querySelector(`.color-option[data-color="${colorValue}"]`);
            if (colorOption && !colorOption.classList.contains('selected')) {
                // Remove selected class from all options
                container.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('selected');
                });

                // Add selected class to the target option
                colorOption.classList.add('selected');
            }
        }
    };

    // Update components based on model
    if (currentModel === 'classic') {
        if (modelSelections.laces?.id) {
            selectOption('classicLacesOptions', modelSelections.laces.id);
        }

        if (modelSelections.insole?.id) {
            selectOption('classicInsoleOptions', modelSelections.insole.id);
        }

        if (modelSelections.laces?.color) {
            selectColor('classiscLacesColorOptions', modelSelections.laces.color);
        }
        if (modelSelections.bodyColor) {
            selectColor('classicBodyColorOptions', modelSelections.bodyColor);
        }
    }
    else if (currentModel === 'runner') {
        if (modelSelections.laces?.id) {
            selectOption('runnerLacesOptions', modelSelections.laces.id);
        }

        if (modelSelections.insole?.id) {
            selectOption('runnerInsoleOptions', modelSelections.insole.id);
        }

        if (modelSelections.laces?.color) {
            selectColor('runnerLacesColorOptions', modelSelections.laces.color);
        }
        if (modelSelections.bodyColor) {
            selectColor('runnerBodyColorOptions', modelSelections.bodyColor);
        }
    }
    else if (currentModel === 'basketball') {
        if (modelSelections.laces?.id) {
            selectOption('basketballLacesOptions', modelSelections.laces.id);
        }

        if (modelSelections.insole?.id) {
            selectOption('basketballInsoleOptions', modelSelections.insole.id);
        }

        if (modelSelections.laces?.color) {
            selectColor('basketballLacesColorOptions', modelSelections.laces.color);
        }
        if (modelSelections.bodyColor) {
            selectColor('basketballBodyColorOptions', modelSelections.bodyColor);
        }
    }
}

// Update the shoe preview and summary
function updatePreview() {
    // Calculate totals
    let lacesPrice = 0;
    let insolePrice = 0;
    let maxDays = 0;

    if (currentModel === 'classic') {
        lacesPrice = selections.classic.laces.price;
        insolePrice = selections.classic.insole.price;
        maxDays = Math.max(selections.classic.laces.days, selections.classic.insole.days);
    }
    else if (currentModel === 'runner') {
        lacesPrice = selections.runner.laces.price;
        insolePrice = selections.runner.insole.price;
        maxDays = Math.max(selections.runner.laces.days, selections.runner.insole.days);
    }
    else if (currentModel === 'basketball') {
        lacesPrice = selections.basketball.laces.price;
        insolePrice = selections.basketball.insole.price;
        maxDays = Math.max(selections.basketball.laces.days, selections.basketball.insole.days);
    }
    else if (currentModel === 'slipon') {
        lacesPrice = 0;
        insolePrice = selections.slipon.midsole.price;
        maxDays = selections.slipon.midsole.days;
    }

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

    // Update the shoe images based on the current model and body color
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

// Function to update shoe images based on current selections
function updateShoeImages() {
    const modelSelections = selections[currentModel];
    const bodyColor = modelSelections.bodyColor || 'white';

    // Set the main shoe image
    const soleImage = getElement('soleImage');
    if (soleImage) {
        soleImage.src = `/images/angles/${currentModel}/${bodyColor}/back.png`;
        soleImage.alt = `${currentModel} shoe - back view`;
    }

    // Set the additional view images
    const frontViewImage = getElement('frontViewImage');
    const sideViewImage = getElement('sideViewImage');
    const backViewImage = getElement('backViewImage');

    if (frontViewImage) {
        frontViewImage.src = `/images/angles/${currentModel}/${bodyColor}/front.png`;
        frontViewImage.alt = `${currentModel} shoe - front view`;
    }

    if (sideViewImage) {
        sideViewImage.src = `/images/angles/${currentModel}/${bodyColor}/side.png`;
        sideViewImage.alt = `${currentModel} shoe - side view`;
    }

    if (backViewImage) {
        backViewImage.src = `/images/angles/${currentModel}/${bodyColor}/back.png`;
        backViewImage.alt = `${currentModel} shoe - back view`;
    }

    // Add error handling for images
    const images = [soleImage, frontViewImage, sideViewImage, backViewImage].filter(img => img !== null);
    images.forEach(img => {
        img.onerror = function () {
            this.src = 'https://via.placeholder.com/150x100?text=Image+Not+Found';
            this.alt = 'Image not available';
        };
    });
}

// Save design to Realtime Database (updates existing design)
async function saveDesignToDatabase() {
    try {
        if (!designId) {
            throw new Error('No design ID specified');
        }

        // Calculate totals using updatePreview
        const prices = updatePreview();
        
        // Clean up data to remove undefined values
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
            updatedAt: Date.now()
        };

        // Update in Realtime Database
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

// Add to cart function
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

        // Save to customized_cart in Realtime Database
        const cartPath = `smartfit_AR_Database/customized_cart/${userSession.userId}`;
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

// Function to handle Buy Now action - USING URL PARAMETERS
async function buyNow() {
    try {
        // Calculate totals using updatePreview
        const prices = updatePreview();

        // Clean up the selections object to remove undefined values
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
            selections: cleanSelections, // Use the cleaned selections
            productionTime: `${prices.totalDays}-${prices.totalDays + 3} days`,
            timestamp: Date.now()
        };

        // Generate a simple order ID
        const orderId = `CUST-EDIT-${Date.now()}`;
        
        // Encode order data for URL parameters
        const orderDataString = encodeURIComponent(JSON.stringify(orderData));
        
        // Redirect to checkout with URL parameters
        window.location.href = `/customer/html/checkoutcustomize.html?orderId=${orderId}&orderData=${orderDataString}`;
        
    } catch (error) {
        console.error('Error during buy now: ', error);
        alert('There was an error placing your order. Please try again.');
    }
}

// Helper function to get preview image URL
function getPreviewImageUrl() {
    const modelImages = {
        'classic': 'https://via.placeholder.com/200x120?text=Classic+Sneaker',
        'runner': 'https://via.placeholder.com/200x120?text=Performance+Runner',
        'basketball': 'https://via.placeholder.com/200x120?text=High-Top+Basketball',
        'slipon': 'https://via.placeholder.com/200x120?text=Slip-On+Comfort'
    };
    return modelImages[currentModel] || 'https://via.placeholder.com/200x120?text=Shoe+Image';
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

    // Model selection
    const modelOptions = document.querySelectorAll('.model-option');
    if (modelOptions.length > 0) {
        modelOptions.forEach(option => {
            option.addEventListener('click', function () {
                modelOptions.forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                currentModel = this.dataset.model;
                basePrice = parseFloat(this.dataset.price);

                // Hide all model-specific sections
                document.querySelectorAll('.model-specific').forEach(section => {
                    section.style.display = 'none';
                });

                // Show sections for selected model
                document.querySelectorAll(`.model-specific.${currentModel}`).forEach(section => {
                    section.style.display = 'block';
                });

                // Update the preview and images
                updatePreview();
            });
        });
    }

    // Size selection
    const sizeOptions = document.querySelectorAll('#sizeOptions .component-option');
    if (sizeOptions.length > 0) {
        sizeOptions.forEach(btn => {
            btn.addEventListener('click', function () {
                sizeOptions.forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
                selectedSize = this.dataset.size;
                updatePreview();
            });
        });
    }

    // Component selection
    function setupComponentOptions(componentType, optionsContainer, model) {
        if (!optionsContainer) return;

        const options = optionsContainer.querySelectorAll('.component-option');
        options.forEach(option => {
            option.addEventListener('click', function () {
                options.forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');

                // Update the selections object based on component type
                if (componentType === 'laces' || componentType === 'insole') {
                    selections[model][componentType] = {
                        id: this.dataset.id,
                        price: parseFloat(this.dataset.price),
                        days: parseInt(this.dataset.days),
                        image: this.dataset.image,
                        color: componentType === 'laces' ? selections[model][componentType]?.color : undefined
                    };
                }

                updatePreview();
            });
        });
    }

    // Initialize all component options
    setupComponentOptions('laces', getElement('classicLacesOptions'), 'classic');
    setupComponentOptions('insole', getElement('classicInsoleOptions'), 'classic');
    setupComponentOptions('laces', getElement('runnerLacesOptions'), 'runner');
    setupComponentOptions('insole', getElement('runnerInsoleOptions'), 'runner');
    setupComponentOptions('laces', getElement('basketballLacesOptions'), 'basketball');
    setupComponentOptions('insole', getElement('basketballInsoleOptions'), 'basketball');

    // Color selection
    function setupColorOptions(colorType, optionsContainer, model) {
        if (!optionsContainer) return;

        const options = optionsContainer.querySelectorAll('.color-option');
        options.forEach(option => {
            option.addEventListener('click', function () {
                options.forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');

                // Update color in selections
                const path = colorType.split('.');
                if (path.length > 1) {
                    selections[model][path[0]][path[1]] = this.dataset.color;
                } else {
                    selections[model][colorType] = this.dataset.color;
                }

                // Update the preview and images
                updatePreview();
            });
        });
    }

    // Initialize all color options
    setupColorOptions('laces.color', getElement('classiscLacesColorOptions'), 'classic');
    setupColorOptions('bodyColor', getElement('classicBodyColorOptions'), 'classic');
    setupColorOptions('laces.color', getElement('runnerLacesColorOptions'), 'runner');
    setupColorOptions('bodyColor', getElement('runnerBodyColorOptions'), 'runner');
    setupColorOptions('laces.color', getElement('basketballLacesColorOptions'), 'basketball');
    setupColorOptions('bodyColor', getElement('basketballBodyColorOptions'), 'basketball');

    // Save design button (now updates existing design)
    const saveButton = document.querySelector('.btn-outline');
    if (saveButton) {
        saveButton.addEventListener('click', async function () {
            try {
                await saveDesignToDatabase();
                alert(`Your ${currentModel} design has been updated!`);
            } catch (error) {
                console.error('Error saving design: ', error);
                alert('There was an error saving your design. Please try again.');
            }
        });
    }

    // Add to cart button
    const addToCartButton = document.querySelector('.btn-primary');
    if (addToCartButton) {
        addToCartButton.addEventListener('click', addToCart);
    }

    // Buy now button
    const buyNowButton = document.querySelector('.btn-buy');
    if (buyNowButton) {
        buyNowButton.addEventListener('click', buyNow);
    }

    // Info button functionality
    const partsInfoBtn = getElement('partsInfoBtn');
    const sizeInfoBtn = getElement('sizeInfoBtn');
    const partsModal = getElement('partsInfoModal');
    const sizeModal = getElement('sizeInfoModal');
    const closePartsModal = getElement('closePartsModal');
    const closeSizeModal = getElement('closeSizeModal');

    if (partsInfoBtn && partsModal && closePartsModal) {
        partsInfoBtn.addEventListener('click', () => {
            partsModal.style.display = 'flex';
        });

        closePartsModal.addEventListener('click', () => {
            partsModal.style.display = 'none';
        });
    }

    if (sizeInfoBtn && sizeModal && closeSizeModal) {
        sizeInfoBtn.addEventListener('click', () => {
            sizeModal.style.display = 'flex';
        });

        closeSizeModal.addEventListener('click', () => {
            sizeModal.style.display = 'none';
        });
    }

    if (partsModal && sizeModal) {
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
    const logoutButton = getElement('logout_btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
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