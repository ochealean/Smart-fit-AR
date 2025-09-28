import {
    checkUserAuth,
    logoutUser,
    readData,
    updateData,
    deleteData
} from "../../firebaseMethods.js";

// DOM Elements
const shippingForm = document.getElementById('shippingForm');
const confirmOrderBtn = document.getElementById('confirmOrderBtn');
const backToCustomizeBtn = document.getElementById('backToCustomizeBtn');
const orderConfirmationModal = document.getElementById('orderConfirmationModal');
const viewOrderBtn = document.getElementById('viewOrderBtn');
const backButton = document.querySelector('.back-button');

// Order data from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('orderId');
const orderDataString = urlParams.get('orderData');
let orderData = null;
let orderConfirmed = false;
let currentSlide = 0;
let touchStartX = 0;
let touchEndX = 0;
let userSession = {
    userId: null,
    userData: null
};

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Page loaded, initializing...');
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
    
    // Load order data from URL parameters
    if (orderId && orderDataString) {
        console.log('Order data found in URL parameters');
        await loadOrderDataFromURL();
    } else {
        console.log('No order data found in URL, redirecting...');
        window.location.href = '/customer/html/customizeshoe.html';
    }
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Add beforeunload event to handle browser/tab closing
    window.addEventListener('beforeunload', handleBeforeUnload);
}

// Handle beforeunload event
function handleBeforeUnload(e) {
    if (!orderConfirmed && orderId) {
        // Standard way to show confirmation dialog
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
}

// Load order data from URL parameters
async function loadOrderDataFromURL() {
    try {
        if (!orderDataString) {
            throw new Error('No order data in URL parameters');
        }
        
        // Decode and parse the order data from URL
        orderData = JSON.parse(decodeURIComponent(orderDataString));
        console.log('Order data loaded from URL:', orderData);
        
        // Display order details
        displayOrderDetails(orderData);
        
    } catch (error) {
        console.error('Error loading order data from URL:', error);
        window.location.href = '/customer/html/customizeshoe.html';
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
    
    // Prefill shipping form with user data
    prefillShippingForm();
}

// Prefill shipping form with user data
function prefillShippingForm() {
    console.log('Prefilling form with user data');
    
    if (!userSession.userData) return;
    
    // Default values
    const defaults = {
        'firstName': '',
        'lastName': '',
        'address': '',
        'city': '',
        'zip': '',
        'state': 'Bataan',
        'country': 'Philippines',
        'phone': '',
        'email': ''
    };
    
    // Merge user data with defaults
    const formData = { ...defaults, ...userSession.userData };
    
    // Fill text input fields
    const textFields = ['firstName', 'lastName', 'address', 'city', 'zip', 'state', 'phone', 'email'];
    
    textFields.forEach(field => {
        const element = getElement(field);
        if (element) {
            element.value = formData[field] || '';
        }
    });
    
    // Handle country select
    const countrySelect = getElement('country');
    if (countrySelect) {
        // Try to find the option with the user's country
        const options = countrySelect.options;
        let found = false;
        for (let i = 0; i < options.length; i++) {
            if (options[i].value === formData.country) {
                countrySelect.selectedIndex = i;
                found = true;
                break;
            }
        }
        
        // If country not found in options, select Philippines as default
        if (!found) {
            for (let i = 0; i < options.length; i++) {
                if (options[i].value === 'Philippines') {
                    countrySelect.selectedIndex = i;
                    break;
                }
            }
        }
    }
    
    console.log('Form pre-filled successfully');
}

function initializeCarousel() {
    // Prevent multiple initializations
    if (window.carouselInitialized) return;
    
    const carousel = getElement('shoeCarousel');
    const prevBtn = getElement('carouselPrev');
    const nextBtn = getElement('carouselNext');
    const indicators = document.querySelectorAll('.indicator');
    
    // Remove any existing event listeners first
    const newPrevBtn = prevBtn.cloneNode(true);
    const newNextBtn = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    
    // Button event listeners
    newPrevBtn.addEventListener('click', () => navigateCarousel(-1));
    newNextBtn.addEventListener('click', () => navigateCarousel(1));
    
    // Indicator event listeners
    indicators.forEach((indicator, index) => {
        // Clone to remove existing listeners
        const newIndicator = indicator.cloneNode(true);
        indicator.parentNode.replaceChild(newIndicator, indicator);
        
        newIndicator.addEventListener('click', () => goToSlide(index));
    });
    
    // Touch events for mobile swipe
    carousel.addEventListener('touchstart', handleTouchStart, false);
    carousel.addEventListener('touchmove', handleTouchMove, false);
    carousel.addEventListener('touchend', handleTouchEnd, false);
    
    window.carouselInitialized = true;
    console.log('Carousel initialized');
}

// Carousel navigation functions
function navigateCarousel(direction) {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    // Hide current slide
    slides[currentSlide].classList.remove('active');
    indicators[currentSlide].classList.remove('active');
    
    // Calculate new slide index
    currentSlide = (currentSlide + direction + slides.length) % slides.length;
    
    // Show new slide
    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    // Hide current slide
    slides[currentSlide].classList.remove('active');
    indicators[currentSlide].classList.remove('active');
    
    // Set new slide index
    currentSlide = index;
    
    // Show new slide
    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
}

// Touch event handlers for swipe
function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
}

function handleTouchMove(e) {
    touchEndX = e.touches[0].clientX;
}

function handleTouchEnd() {
    if (touchEndX < touchStartX - 50) {
        // Swipe left - next slide
        navigateCarousel(1);
    } else if (touchEndX > touchStartX + 50) {
        // Swipe right - previous slide
        navigateCarousel(-1);
    }
}

// Display order details on the page
function displayOrderDetails(order) {
    console.log('Displaying order details:', order);
    
    // Calculate VAT (12% of base price + customization)
    const vatRate = 0.12;
    const subtotal = order.basePrice + (order.customizationPrice || 0);
    const vatAmount = subtotal * vatRate;
    const shippingPrice = 200; // Assuming shipping is free or handled elsewhere
    const totalPrice = subtotal + vatAmount + shippingPrice;
    
    // Set model name
    const modelNameElement = getElement('checkoutModelName');
    const sizeElement = getElement('checkoutSize');
    const productionTimeElement = getElement('checkoutProductionTime');
    
    if (modelNameElement) modelNameElement.textContent = getModelDisplayName(order.model);
    if (sizeElement) sizeElement.textContent = order.size || 'N/A';
    if (productionTimeElement) productionTimeElement.textContent = order.productionTime || '7-10 days';
    
    // Update price display
    const basePriceElement = getElement('checkoutBasePrice');
    const customizationPriceElement = getElement('checkoutCustomizationPrice');
    const vatAmountElement = getElement('checkoutVatAmount');
    const shippingFeeElement = getElement('checkoutShippingfee');
    const totalPriceElement = getElement('checkoutTotalPrice');
    
    if (basePriceElement) basePriceElement.textContent = `₱${order.basePrice.toFixed(2)}`;
    if (customizationPriceElement) customizationPriceElement.textContent = `₱${(order.customizationPrice || 0).toFixed(2)}`;
    if (vatAmountElement) vatAmountElement.textContent = `₱${vatAmount.toFixed(2)}`;
    if (shippingFeeElement) shippingFeeElement.textContent = `₱${shippingPrice.toFixed(2)}`;
    if (totalPriceElement) totalPriceElement.textContent = `₱${totalPrice.toFixed(2)}`;
    
    // Set modal order details
    const modalOrderNumber = getElement('modalOrderNumber');
    const modalOrderTotal = getElement('modalOrderTotal');
    const modalDeliveryDate = getElement('modalDeliveryDate');
    
    if (modalOrderNumber) modalOrderNumber.textContent = orderId;
    if (modalOrderTotal) modalOrderTotal.textContent = `₱${totalPrice.toFixed(2)}`;
    if (modalDeliveryDate) modalDeliveryDate.textContent = order.productionTime || '7-10 days';
    
    // Load shoe images based on model and body color
    const bodyColor = order.selections?.bodyColor || 'white';
    const model = order.model;
    
    // Set image sources
    const mainImage = getElement('checkoutMainImage');
    const frontImage = getElement('checkoutFrontImage');
    const sideImage = getElement('checkoutSideImage');
    const backImage = getElement('checkoutBackImage');
    
    if (mainImage) mainImage.src = `/images/angles/${model}/${bodyColor}/main.png`;
    if (frontImage) frontImage.src = `/images/angles/${model}/${bodyColor}/front.png`;
    if (sideImage) sideImage.src = `/images/angles/${model}/${bodyColor}/side.png`;
    if (backImage) backImage.src = `/images/angles/${model}/${bodyColor}/back.png`;
    
    // Add error handling for images
    const images = [mainImage, frontImage, sideImage, backImage].filter(img => img !== null);
    images.forEach(img => {
        img.onerror = function() {
            this.src = 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png';
        };
        
        // Wait for images to load before initializing carousel
        img.onload = function() {
            // Check if all images are loaded
            const allLoaded = images.every(img => img.complete && img.naturalHeight !== 0);
            if (allLoaded && !window.carouselInitialized) {
                initializeCarousel();
                window.carouselInitialized = true;
            }
        };
    });
    
    // Force check if images are already loaded (cached)
    setTimeout(() => {
        const allLoaded = images.every(img => img.complete && img.naturalHeight !== 0);
        if (allLoaded && !window.carouselInitialized) {
            initializeCarousel();
            window.carouselInitialized = true;
        }
    }, 500);
    
    // Display customization details
    const customizationDetails = getElement('customizationDetails');
    if (customizationDetails) {
        customizationDetails.innerHTML = '';
        displayCustomizationDetails(order, customizationDetails);
    }
}

// Display customization details based on order data
function displayCustomizationDetails(order, container) {
    const selections = order.selections || {};
     
    if (order.model === 'classic') {
        // Classic shoe customization
        if (selections.bodyColor) {
            addColorDetail(container, 'Body Color', selections.bodyColor);
        }
        
        if (selections.laces) {
            addCustomizationDetail(container, 'Laces', selections.laces.id, selections.laces.price || 0);
            if (selections.laces.color) {
                addColorDetail(container, 'Laces Color', selections.laces.color);
            }
        }
        
        if (selections.insole) {
            addCustomizationDetail(container, 'Insole', selections.insole.id, selections.insole.price || 0);
        }
        
    } else if (order.model === 'runner') {
        // Runner shoe customization
        if (selections.bodyColor) {
            addColorDetail(container, 'Body Color', selections.bodyColor);
        }
        
        if (selections.laces) {
            addCustomizationDetail(container, 'Laces', selections.laces.id, selections.laces.price || 0);
            if (selections.laces.color) {
                addColorDetail(container, 'Laces Color', selections.laces.color);
            }
        }
        
        if (selections.insole) {
            addCustomizationDetail(container, 'Insole', selections.insole.id, selections.insole.price || 0);
        }
        
    } else if (order.model === 'basketball') {
        // Basketball shoe customization
        if (selections.bodyColor) {
            addColorDetail(container, 'Body Color', selections.bodyColor);
        }
        
        if (selections.laces) {
            addCustomizationDetail(container, 'Laces', selections.laces.id, selections.laces.price || 0);
            if (selections.laces.color) {
                addColorDetail(container, 'Laces Color', selections.laces.color);
            }
        }
        
        if (selections.insole) {
            addCustomizationDetail(container, 'Insole', selections.insole.id, selections.insole.price || 0);
        }
    }
}

// Helper function to add customization detail row
function addCustomizationDetail(container, label, value, price) {
    const detailRow = document.createElement('div');
    detailRow.className = 'detail-row';
    
    detailRow.innerHTML = `
        <span class="detail-label">${label}:</span>
        <span class="detail-value">${value} ${price > 0 ? `(+₱${price.toFixed(2)})` : ''}</span>
    `;
    
    container.appendChild(detailRow);
}

// Helper function to add color detail row
function addColorDetail(container, label, color) {
    const detailRow = document.createElement('div');
    detailRow.className = 'detail-row';
    
    detailRow.innerHTML = `
        <span class="detail-label">${label}:</span>
        <span class="detail-value">
            <span class="color-indicator" style="background-color: ${color};"></span>
            ${color}
        </span>
    `;
    
    container.appendChild(detailRow);
}

// Helper function to get display name for model
function getModelDisplayName(model) {
    const modelNames = {
        'classic': 'Classic Sneaker',
        'runner': 'Running Shoe',
        'basketball': 'Basketball Shoe',
        'slipon': 'Slip-On Shoe'
    };
    return modelNames[model] || model;
}

// Initialize event listeners
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
    
    // Back to customize button
    if (backToCustomizeBtn) {
        backToCustomizeBtn.addEventListener('click', () => {
            if (!orderConfirmed) {
                const confirmCancel = confirm('Are you sure you want to cancel this order? Your custom design will be lost.');
                if (confirmCancel) {
                    window.location.href = '/customer/html/customizeshoe.html';
                }
            } else {
                window.location.href = '/customer/html/customizeshoe.html';
            }
        });
    }
    
    // Back button (arrow)
    if (backButton) {
        backButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (!orderConfirmed) {
                const confirmCancel = confirm('Are you sure you want to cancel this order? Your custom design will be lost.');
                if (confirmCancel) {
                    window.location.href = '/customer/html/customizeshoe.html';
                }
            } else {
                window.location.href = '/customer/html/customizeshoe.html';
            }
        });
    }
    
    // View order button in modal
    if (viewOrderBtn) {
        viewOrderBtn.addEventListener('click', () => {
            window.location.href = `/customer/html/customization_pendingOrders.html`;
        });
    }
    
    // Form submission
    if (shippingForm) {
        shippingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                confirmOrderBtn.disabled = true;
                confirmOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                
                // Update order with shipping and payment info
                await saveOrderToDatabase();
                
                // Mark order as confirmed
                orderConfirmed = true;
                
                // Show confirmation modal
                if (orderConfirmationModal) {
                    orderConfirmationModal.style.display = 'flex';
                }
                
            } catch (error) {
                console.error('Error confirming order:', error);
                alert('There was an error confirming your order. Please try again.');
                confirmOrderBtn.disabled = false;
                confirmOrderBtn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Order';
            }
        });
    }
    
    // Handle browser back button
    window.addEventListener('popstate', () => {
        if (!orderConfirmed) {
            const confirmCancel = confirm('Are you sure you want to cancel this order? Your custom design will be lost.');
            if (confirmCancel) {
                window.location.href = '/customer/html/customizeshoe.html';
            }
        }
    });

    // Logout functionality
    const logoutBtn = getElement('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
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

// Save order to database with shipping information
async function saveOrderToDatabase() {
    // Get form values
    const shippingInfo = {
        firstName: getElement('firstName')?.value || '',
        lastName: getElement('lastName')?.value || '',
        address: getElement('address')?.value || '',
        city: getElement('city')?.value || '',
        zip: getElement('zip')?.value || '',
        country: getElement('country')?.value || 'Philippines',
        phone: getElement('phone')?.value || '',
        email: getElement('email')?.value || ''
    };
    
    // Get payment method
    const paymentMethodElement = document.querySelector('input[name="paymentMethod"]:checked');
    const paymentMethod = paymentMethodElement ? paymentMethodElement.value : 'credit_card';
    
    // Calculate final totals
    const vatRate = 0.12;
    const subtotal = orderData.basePrice + (orderData.customizationPrice || 0);
    const vatAmount = subtotal * vatRate;
    const shippingPrice = 200;
    const totalPrice = subtotal + vatAmount + shippingPrice;
    
    // Create complete order object
    const completeOrderData = {
        ...orderData,
        userId: userSession.userId,
        orderId: orderId,
        shippingInfo: shippingInfo,
        paymentMethod: paymentMethod,
        status: 'processing',
        statusUpdates: {
            processing: {
                status: 'processing',
                timestamp: Date.now(),
                message: 'Order is being processed'
            }
        },
        confirmedAt: Date.now(),
        vatAmount: vatAmount,
        shippingPrice: shippingPrice,
        finalTotal: totalPrice
    };
    
    // Save to boughtshoe
    const boughtshoePath = `smartfit_AR_Database/boughtshoe/${userSession.userId}/${orderId}`;
    const boughtResult = await updateData(boughtshoePath, completeOrderData);
    
    // Also save to transactions
    const transactionPath = `smartfit_AR_Database/customizedtransactions/${userSession.userId}/${orderId}`;
    const transactionData = {
        ...completeOrderData,
        date: new Date().toISOString(),
        item: {
            name: `Custom ${orderData.model} shoe`,
            price: totalPrice,
            quantity: 1,
            size: orderData.size,
            isCustom: true,
            image: getPreviewImageUrl(orderData.model)
        },
        status: "pending",
        totalAmount: totalPrice
    };
    
    const transactionResult = await updateData(transactionPath, transactionData);
    
    if (boughtResult.success && transactionResult.success) {
        console.log('Order saved successfully to database');
    } else {
        throw new Error('Failed to save order to database');
    }
}

// Get preview image URL
function getPreviewImageUrl(model) {
    const modelImages = {
        'classic': 'https://via.placeholder.com/200x120?text=Classic+Sneaker',
        'runner': 'https://via.placeholder.com/200x120?text=Performance+Runner',
        'basketball': 'https://via.placeholder.com/200x120?text=High-Top+Basketball'
    };
    return modelImages[model] || 'https://via.placeholder.com/200x120?text=Shoe+Image';
}