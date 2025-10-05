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

let shoeLinks = {
    classic: {
        red: 'https://smart-fit-ar.vercel.app/extras/devonprocess.html',
        blue: 'https://smart-fit-ar.vercel.app/extras/devonprocess.html',
        black: 'https://smart-fit-ar.vercel.app/extras/devonprocess.html',
        white: 'https://smart-fit-ar.vercel.app/extras/devonprocess.html',
    },
    runner: {
        red: 'https://sdk.developer.deepar.ai/effectTester/index.html?url1=https%3A%2F%2Fdeepar-temporary-resources-prod.s3.eu-west-1.amazonaws.com%2F2a4a070e-abe1-48de-ba26-75c12804098b&name1=Running-Red.deeparproj&sdkVersion=5.6.0',
        blue: 'https://sdk.developer.deepar.ai/effectTester/index.html?url1=https%3A%2F%2Fdeepar-temporary-resources-prod.s3.eu-west-1.amazonaws.com%2F379e6e4d-8eec-46fa-93c2-1b0878b0cba7&name1=Running-Blue.deeparproj&sdkVersion=5.6.0',
        black: 'https://sdk.developer.deepar.ai/effectTester/index.html?url1=https%3A%2F%2Fdeepar-temporary-resources-prod.s3.eu-west-1.amazonaws.com%2F204fbbd0-00d1-4d08-838f-429683710c6a&name1=Running-Black.deeparproj&sdkVersion=5.6.0',
        white: 'https://sdk.developer.deepar.ai/effectTester/index.html?url1=https%3A%2F%2Fdeepar-temporary-resources-prod.s3.eu-west-1.amazonaws.com%2F32c3bf87-2311-4c04-8322-40da4040080d&name1=Running-White.deeparproj&sdkVersion=5.6.0',
    },
    basketball: {
        red: 'https://sdk.developer.deepar.ai/effectTester/index.html?url1=https%3A%2F%2Fdeepar-temporary-resources-prod.s3.eu-west-1.amazonaws.com%2F8963b31a-0ac0-4495-a3bd-aaad5b0edca7&name1=Basketball-Red.deeparproj&sdkVersion=5.6.0',
        blue: 'https://sdk.developer.deepar.ai/effectTester/index.html?url1=https%3A%2F%2Fdeepar-temporary-resources-prod.s3.eu-west-1.amazonaws.com%2F8ad51b0f-f101-4c38-a03c-f41bddf3f29e&name1=Basketball-Blue.deeparproj&sdkVersion=5.6.0',
        black: 'https://sdk.developer.deepar.ai/effectTester/index.html?url1=https%3A%2F%2Fdeepar-temporary-resources-prod.s3.eu-west-1.amazonaws.com%2F1e92b432-bf36-41f9-9a6e-61067c3dcd88&name1=Basketball-Black.deeparproj&sdkVersion=5.6.0',
        white: 'https://sdk.developer.deepar.ai/effectTester/index.html?url1=https%3A%2F%2Fdeepar-temporary-resources-prod.s3.eu-west-1.amazonaws.com%2F250456b5-7d37-4a01-b00c-bbe5a8237d83&name1=Basketball-White.deeparproj&sdkVersion=5.6.0',
    }
};

// Initialize selections
let selections = {
    classic: {
        bodyColor: 'white',
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
        }
    },
    runner: {
        bodyColor: 'white',
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
        }
    },
    basketball: {
        bodyColor: 'white',
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
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Check URL parameters for model selection
    checkUrlParameters();
    
    // Initial preview update
    updatePreview();
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

// Update shoe images based on model and color
function updateShoeImages() {
    const arExperienceLink = getElement('arExperienceLink');
    console.log('Updating shoe images for model:', currentModel, 'with color:', selections[currentModel].bodyColor);
    const bodyColor = selections[currentModel].bodyColor;
    console.log('Current selections:', shoeLinks[currentModel]?.[bodyColor]);
    arExperienceLink.href = shoeLinks[currentModel]?.[bodyColor];
    
    // Update main image
    const soleImage = getElement('soleImage');
    if (soleImage) {
        soleImage.src = `/images/angles/${currentModel}/${bodyColor}/main.png`;
    }
    
    // Update additional view images
    const frontViewImage = getElement('frontViewImage');
    const sideViewImage = getElement('sideViewImage');
    const backViewImage = getElement('backViewImage');
    
    if (frontViewImage) frontViewImage.src = `/images/angles/${currentModel}/${bodyColor}/front.png`;
    if (sideViewImage) sideViewImage.src = `/images/angles/${currentModel}/${bodyColor}/side.png`;
    if (backViewImage) backViewImage.src = `/images/angles/${currentModel}/${bodyColor}/back.png`;
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

// Setup insole options
function setupInsoleOptions(model) {
    const optionsContainer = getElement(`${model}InsoleOptions`);
    if (!optionsContainer) return;
    
    const options = optionsContainer.querySelectorAll('.component-option');
    options.forEach(option => {
        option.addEventListener('click', function () {
            options.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selections[model].insole = {
                id: this.dataset.id,
                price: parseFloat(this.dataset.price),
                days: parseInt(this.dataset.days),
                image: this.dataset.image
            };
            updatePreview();
        });
    });
}

// Setup laces options
function setupLacesOptions(model) {
    const optionsContainer = getElement(`${model}LacesOptions`);
    if (!optionsContainer) return;
    
    const options = optionsContainer.querySelectorAll('.component-option');
    options.forEach(option => {
        option.addEventListener('click', function () {
            options.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selections[model].laces = {
                id: this.dataset.id,
                price: parseFloat(this.dataset.price),
                days: parseInt(this.dataset.days),
                image: this.dataset.image,
                color: selections[model].laces.color
            };
            updatePreview();
        });
    });
}

// Setup color options
function setupColorOptions(colorType, optionsContainer, model) {
    if (!optionsContainer) return;
    
    const options = optionsContainer.querySelectorAll('.color-option');
    options.forEach(option => {
        option.addEventListener('click', function () {
            options.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            
            if (colorType === 'bodyColor') {
                selections[model].bodyColor = this.dataset.color;
            } else if (colorType === 'lacesColor') {
                selections[model].laces.color = this.dataset.color;
            }
            updatePreview();
        });
    });
}

// Get preview image URL
function getPreviewImageUrl() {
    if (currentModel === 'classic') {
        return 'https://via.placeholder.com/200x120?text=Classic+Sneaker';
    } else if (currentModel === 'runner') {
        return 'https://via.placeholder.com/200x120?text=Performance+Runner';
    } else {
        return 'https://via.placeholder.com/200x120?text=High-Top+Basketball';
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
            image: getPreviewImageUrl(),
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

// Initialize all event listeners
function initializeEventListeners() {
    // Initialize all options
    setupInsoleOptions('classic');
    setupInsoleOptions('runner');
    setupInsoleOptions('basketball');
    setupLacesOptions('classic');
    setupLacesOptions('runner');
    setupLacesOptions('basketball');

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

    // Color selection
    setupColorOptions('bodyColor', getElement('classicBodyColorOptions'), 'classic');
    setupColorOptions('lacesColor', getElement('classiscLacesColorOptions'), 'classic');
    setupColorOptions('bodyColor', getElement('runnerBodyColorOptions'), 'runner');
    setupColorOptions('lacesColor', getElement('runnerLacesColorOptions'), 'runner');
    setupColorOptions('bodyColor', getElement('basketballBodyColorOptions'), 'basketball');
    setupColorOptions('lacesColor', getElement('basketballLacesColorOptions'), 'basketball');

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