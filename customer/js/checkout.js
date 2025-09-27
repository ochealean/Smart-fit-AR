import { 
    checkUserAuth, 
    logoutUser,
    readData,
    updateData,
    createData,
    deleteData
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Global variables
let userData = null;
let userId = null;

// Initialize the page
async function initializeCheckout() {
    const authStatus = await checkUserAuth();
    
    if (authStatus.authenticated && authStatus.role === 'shopowner') {
        console.log(`User is ${authStatus.role}`, authStatus.userData);
        window.location.href = "../../shopowner/html/shop_dashboard.html";
        return;
    } else if (authStatus.authenticated && authStatus.role === 'customer') {
        console.log(`User is ${authStatus.role}`, authStatus.userData);
        userData = authStatus.userData;
        userId = authStatus.userId;
    } else {
        window.location.href = "/login.html";
        return;
    }

    // Load user profile
    loadUserProfile();
    
    // Load order summary
    await loadOrderSummary();
    
    // Set up event listeners
    setupEventListeners();

    document.body.style.display = '';
}

// Load user profile
function loadUserProfile() {
    const userNameDisplay1 = getElement('userName_display1');
    const userNameDisplay2 = getElement('userName_display2');
    const imageProfile = getElement('imageProfile');
    
    if (userNameDisplay1) {
        userNameDisplay1.textContent = userData.firstName || 'Customer';
    }
    
    if (userNameDisplay2) {
        userNameDisplay2.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Customer';
    }
    
    if (imageProfile) {
        imageProfile.src = userData.profilePhoto || "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }

    // Autofill checkout form fields with user data
    getElement('firstName').value = userData.firstName || '';
    getElement('lastName').value = userData.lastName || '';
    getElement('email').value = userData.email || '';
    getElement('phone').value = userData.phone || '';
    getElement('address').value = userData.address || '';
    getElement('city').value = userData.city || '';
    getElement('state').value = userData.state || '';
    getElement('zip').value = userData.zip || '';
    getElement('country').value = 'Philippines';
}

// Set up event listeners
function setupEventListeners() {
    // Logout functionality
    const logoutBtn = getElement('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            if (confirm('Are you sure you want to logout?')) {
                const result = await logoutUser();
                if (result.success) {
                    window.location.href = '/login.html';
                } else {
                    console.error('Error signing out:', result.error);
                }
            }
        });
    }

    // Place order button
    const placeOrderBtn = getElement('placeOrderBtn');
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', function() {
            if (validateForm()) {
                placeOrder();
            }
        });
    }

    // Payment method selection
    const paymentMethods = document.querySelectorAll('.payment-method');
    if (paymentMethods.length > 0) {
        paymentMethods.forEach(div => {
            div.addEventListener("click", function() {
                const radio = this.querySelector("input[type='radio']");
                if (radio) {
                    radio.checked = true;
                }
            });
        });
    }

    // Modal functionality
    setupModalEvents();

    // Mobile menu setup
    setupMobileMenu();
}

function setupModalEvents() {
    const modal = getElement('orderConfirmationModal');
    const closeBtn = document.querySelector('.close-modal');
    const continueBtn = getElement('continueShoppingBtn');

    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            if (modal) modal.style.display = 'none';
        });
    }

    if (continueBtn) {
        continueBtn.addEventListener('click', function() {
            if (modal) modal.style.display = 'none';
            window.location.href = '/customer/html/customer_dashboard.html';
        });
    }

    // Close modal when clicking outside
    if (modal) {
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

function setupMobileMenu() {
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
}

// Function to load order summary
async function loadOrderSummary() {
    const urlParams = new URLSearchParams(window.location.search);
    const method = urlParams.get('method');

    if (method === "buyNow") {
        // Handle buy now flow
        const orderItem = {
            shopId: urlParams.get('shopId'),
            shoeId: urlParams.get('shoeId'),
            variantKey: urlParams.get('variantKey'),
            sizeKey: urlParams.get('sizeKey'),
            size: urlParams.get('size'),
            quantity: parseInt(urlParams.get('quantity')) || 1,
            price: parseFloat(urlParams.get('price')) || 0,
            name: urlParams.get('shoeName'),
            variantName: urlParams.get('variantName'),
            color: urlParams.get('color'),
            imageUrl: urlParams.get('image')
        };
        await displaySingleItemOrder(orderItem);
    } else if (method === "cartOrder") {
        // Handle cart order flow
        const cartIds = getCartOrderIds();
        if (cartIds.length > 0) {
            await displayMultipleItemOrder(cartIds);
        } else {
            getElement('orderItems').innerHTML = '<p>No items selected for checkout</p>';
        }
    } else {
        // Handle regular cart flow
        try {
            const cartResult = await readData(`smartfit_AR_Database/carts/${userId}`);
            
            if (!cartResult.success || !cartResult.data) {
                getElement('orderItems').innerHTML = '<p>Your cart is empty</p>';
                getElement('orderSummary').innerHTML = '';
                return;
            }

            const cartData = cartResult.data;
            const cartArray = Array.isArray(cartData) ? cartData : Object.values(cartData);
            await displayMultipleItemOrder(cartArray.map((_, index) => index.toString()));
        } catch (error) {
            console.error("Error loading order summary:", error);
            alert("Failed to load your cart. Please try again.");
        }
    }
}

// Form validation function
function validateForm() {
    const requiredFields = [
        'firstName', 'lastName', 'address', 'city', 'zip', 'state', 'country', 'phone', 'email'
    ];

    let isValid = true;

    requiredFields.forEach(fieldId => {
        const field = getElement(fieldId);
        if (field && !field.value.trim()) {
            field.style.borderColor = 'red';
            isValid = false;
        } else if (field) {
            field.style.borderColor = '#ddd';
        }
    });

    if (!isValid) {
        alert('Please fill in all required fields');
        return false;
    }

    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    if (!paymentMethod) {
        alert('Please select a payment method');
        return false;
    }

    return true;
}

// Helper function to generate unique Order ID
function generateOrderId() {
    const timestamp = Date.now().toString();
    const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `ORD-${timestamp}-${randomStr}`;
}

// Function to place order
async function placeOrder() {
    const shippingInfo = {
        firstName: getElement('firstName').value,
        lastName: getElement('lastName').value,
        email: getElement('email').value,
        phone: getElement('phone').value,
        address: getElement('address').value,
        city: getElement('city').value,
        zip: getElement('zip').value,
        state: getElement('state').value,
        country: getElement('country').value
    };

    const urlParams = new URLSearchParams(window.location.search);
    const method = urlParams.get('method');
    let orderItems = [];

    try {
        if (method === "buyNow") {
            orderItems = await prepareBuyNowOrder(urlParams);
        } else if (method === "cartOrder") {
            orderItems = await prepareCartOrder();
        }

        if (orderItems.length === 0) {
            alert('No items to order');
            return;
        }

        // Create orders and process each item
        for (const item of orderItems) {
            await processOrderItem(item, shippingInfo, method);
        }

        // Show confirmation for the last order
        const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity * 1.12) + 5, 0);
        showOrderConfirmationModal({
            orderId: generateOrderId(),
            shippingInfo: shippingInfo,
            totalAmount: totalAmount
        });

    } catch (error) {
        console.error("Error placing order:", error);
        alert("Error placing your order. Please try again.");
    }
}

// Prepare buy now order items
async function prepareBuyNowOrder(urlParams) {
    try {
        const shoeResult = await readData(`smartfit_AR_Database/shoe/${urlParams.get('shopId')}/${urlParams.get('shoeId')}`);
        
        let brand = 'Unknown';
        let type = 'Unknown';
        let gender = 'Unisex';
        
        if (shoeResult.success && shoeResult.data) {
            const shoeData = shoeResult.data;
            brand = shoeData.shoeBrand || 'Unknown';
            type = shoeData.shoeType || 'Unknown';
            gender = shoeData.shoeGender || 'Unisex';
        }
        
        return [{
            shopId: urlParams.get('shopId'),
            shoeId: urlParams.get('shoeId'),
            variantKey: urlParams.get('variantKey'),
            shopName: urlParams.get('shopName'),
            sizeKey: urlParams.get('sizeKey'),
            size: urlParams.get('size'),
            quantity: parseInt(urlParams.get('quantity')) || 1,
            price: parseFloat(urlParams.get('price')) || 0,
            name: urlParams.get('shoeName'),
            variantName: urlParams.get('variantName'),
            color: urlParams.get('color'),
            imageUrl: urlParams.get('image') || 'https://via.placeholder.com/150',
            brand: brand,
            type: type,
            gender: gender
        }];
    } catch (error) {
        console.error("Error preparing buy now order:", error);
        throw error;
    }
}

// Prepare cart order items
async function prepareCartOrder() {
    const cartIds = getCartOrderIds();
    if (cartIds.length === 0) {
        throw new Error('No cart items selected for checkout');
    }
    
    const cartResult = await readData(`smartfit_AR_Database/carts/${userId}`);
    if (!cartResult.success || !cartResult.data) {
        throw new Error('Your cart is empty');
    }
    
    const cartData = cartResult.data;
    const orderItems = [];
    
    for (const cartId of cartIds) {
        const cartItem = cartData[cartId];
        if (!cartItem) continue;
        
        try {
            const shoeResult = await readData(`smartfit_AR_Database/shoe/${cartItem.shopId}/${cartItem.shoeId}`);
            
            let brand = 'Unknown';
            let type = 'Unknown';
            let gender = 'Unisex';
            
            if (shoeResult.success && shoeResult.data) {
                const shoeData = shoeResult.data;
                brand = shoeData.shoeBrand || 'Unknown';
                type = shoeData.shoeType || 'Unknown';
                gender = shoeData.shoeGender || 'Unisex';
            }
            
            orderItems.push({
                shopId: cartItem.shopId,
                shoeId: cartItem.shoeId,
                variantKey: cartItem.variantKey,
                shopName: cartItem.shopName || '',
                sizeKey: cartItem.sizeKey,
                size: cartItem.size,
                quantity: parseInt(cartItem.quantity) || 1,
                price: parseFloat(cartItem.price) || 0,
                name: cartItem.shoeName,
                variantName: cartItem.variantName,
                color: cartItem.color,
                imageUrl: cartItem.image || 'https://via.placeholder.com/150',
                brand: brand,
                type: type,
                gender: gender,
                cartId: cartId
            });
        } catch (error) {
            console.error("Error processing cart item:", cartItem, error);
        }
    }
    
    return orderItems;
}

// Process individual order item
async function processOrderItem(item, shippingInfo, method) {
    const orderId = generateOrderId();
    
    // Calculate totals
    const subtotal = item.price * item.quantity;
    const tax = subtotal * 0.12;
    const shipping = 5.00;
    const total = subtotal + tax + shipping;

    // Create order object
    const order = {
        orderId: orderId,
        userId: userId,
        shippingInfo: shippingInfo,
        date: new Date().toISOString(),
        status: 'pending',
        totalAmount: total,
        item: {
            shopId: item.shopId,
            shoeId: item.shoeId,
            variantKey: item.variantKey,
            shopName: item.shopName,
            sizeKey: item.sizeKey,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            variantName: item.variantName,
            color: item.color,
            brand: item.brand,
            type: item.type,
            gender: item.gender,
            imageUrl: item.imageUrl
        }
    };

    // Save order to database
    const createResult = await createData(
        `smartfit_AR_Database/transactions/${userId}/${orderId}`, 
        null, 
        order
    );

    if (!createResult.success) {
        throw new Error(`Failed to create order: ${createResult.error}`);
    }

    // Reduce stock
    await reduceStock(item);

    // Remove from cart if cart order
    if (method === "cartOrder" && item.cartId) {
        await deleteCartItem(item.cartId);
    }
}

// Function to delete cart item
async function deleteCartItem(cartId) {
    try {
        const deleteResult = await deleteData(`smartfit_AR_Database/carts/${userId}/${cartId}`);
        
        if (deleteResult.success) {
            console.log(`Cart item ${cartId} deleted successfully`);
            return true;
        } else {
            console.error("Failed to delete cart item:", deleteResult.error);
            return false;
        }
    } catch (error) {
        console.error("Error deleting cart item:", error);
        return false;
    }
}

// Reduce stock after purchase
async function reduceStock(item) {
    try {
        // First, let's check the actual structure of the shoe data
        const shoeResult = await readData(`smartfit_AR_Database/shoe/${item.shopId}/${item.shoeId}`);
        
        if (!shoeResult.success || !shoeResult.data) {
            console.error("Shoe not found:", item.shoeId);
            return;
        }

        const shoeData = shoeResult.data;
        console.log("Shoe data structure:", shoeData);

        // Get the variant
        const variant = shoeData.variants[item.variantKey];
        if (!variant) {
            console.error("Variant not found:", item.variantKey);
            return;
        }

        console.log("Variant structure:", variant);

        // Find the correct size entry
        let sizeData = null;
        let sizeKeyToUpdate = null;

        // Check if sizes exist and find the correct one
        if (variant.sizes) {
            for (const [key, sizeObj] of Object.entries(variant.sizes)) {
                const sizeValue = Object.keys(sizeObj)[0];
                if (sizeValue === item.size) {
                    sizeData = sizeObj[sizeValue];
                    sizeKeyToUpdate = key;
                    break;
                }
            }
        }

        if (!sizeData) {
            console.error("Size not found:", item.size, "in sizes:", variant.sizes);
            return;
        }

        const currentStock = sizeData.stock || 0;
        const newStock = currentStock - item.quantity;

        console.log("Current stock:", currentStock);
        console.log("Quantity to reduce:", item.quantity);
        console.log("New stock:", newStock);

        // Update the stock using the correct path
        const stockPath = `smartfit_AR_Database/shoe/${item.shopId}/${item.shoeId}/variants/${item.variantKey}/sizes/${sizeKeyToUpdate}/${item.size}`;
        
        console.log("Stock path:", stockPath);
        
        const updateResult = await updateData(stockPath, {
            stock: newStock,
            LastUpdatedBy: userId,
            LastUpdatedAt: new Date().toISOString()
        });

        if (updateResult.success) {
            console.log(`Stock updated successfully for ${item.shoeId} size ${item.size}: ${currentStock} -> ${newStock}`);
        } else {
            console.error("Failed to update stock:", updateResult.error);
        }

    } catch (error) {
        console.error("Error reducing stock:", error);
        // Don't throw error here to prevent order failure due to stock update issues
        console.warn("Stock reduction failed, but order was placed successfully");
    }
}

// Display single item order
async function displaySingleItemOrder(item) {
    const orderItemsContainer = getElement('orderItems');
    if (!orderItemsContainer) return;
    
    orderItemsContainer.innerHTML = '';

    try {
        const shoeResult = await readData(`smartfit_AR_Database/shoe/${item.shopId}/${item.shoeId}`);
        if (shoeResult.success && shoeResult.data) {
            const shoeData = shoeResult.data;
            item.brand = shoeData.shoeBrand || 'Unknown';
            item.type = shoeData.shoeType || 'Unknown';
            item.gender = shoeData.shoeGender || 'Unisex';
        }
    } catch (error) {
        console.error("Error fetching shoe details:", error);
        item.brand = 'Unknown';
        item.type = 'Unknown';
        item.gender = 'Unisex';
    }

    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item';
    itemElement.innerHTML = `
        <img src="${item.imageUrl}" alt="${item.name}" class="cart-item-image">
        <div class="cart-item-details">
            <h4>${item.name}</h4>
            <p>${item.variantName} (${item.color})</p>
            <p>Size: ${item.size}</p>
            <p>Quantity: ${item.quantity}</p>
            ${item.brand ? `<p>Brand: ${item.brand}</p>` : ''}
            ${item.type ? `<p>Type: ${item.type}</p>` : ''}
            ${item.gender ? `<p>Gender: ${item.gender}</p>` : ''}
        </div>
    `;
    orderItemsContainer.appendChild(itemElement);

    updateOrderSummary([item]);
}

// Display multiple item order
async function displayMultipleItemOrder(cartIDs) {
    const cartResult = await readData(`smartfit_AR_Database/carts/${userId}`);
    
    if (!cartResult.success || !cartResult.data) {
        const orderItems = getElement('orderItems');
        if (orderItems) orderItems.innerHTML = '<p>Your cart is empty</p>';
        return;
    }

    const fullCart = cartResult.data;
    const itemsToDisplay = cartIDs
        .map(id => {
            const item = Array.isArray(fullCart) ? fullCart[parseInt(id)] : fullCart[id];
            return item ? { ...item, id } : null;
        })
        .filter(Boolean);

    const cartWithDetails = await Promise.all(itemsToDisplay.map(async item => {
        try {
            const shoeResult = await readData(`smartfit_AR_Database/shoe/${item.shopId}/${item.shoeId}`);
            if (!shoeResult.success || !shoeResult.data) return null;

            const shoeData = shoeResult.data;
            const variantKey = item.variantKey || Object.keys(shoeData.variants)[item.variantIndex || 0];
            const variant = shoeData.variants[variantKey];

            if (!variant) return null;

            // Find the correct size
            const sizeEntry = Object.entries(variant.sizes).find(
                ([key, sizeObj]) => {
                    const sizeValue = Object.keys(sizeObj)[0];
                    return sizeValue === item.size || key === item.sizeKey;
                }
            );

            if (!sizeEntry) return null;

            const [sizeKey, sizeObj] = sizeEntry;
            const sizeValue = Object.keys(sizeObj)[0];
            const stock = sizeObj[sizeValue].stock;

            return {
                ...item,
                name: shoeData.shoeName,
                price: parseFloat(variant.price),
                imageUrl: variant.imageUrl || shoeData.defaultImage || 'https://via.placeholder.com/150',
                variantName: variant.variantName,
                color: variant.color,
                size: sizeValue,
                brand: shoeData.shoeBrand || 'Unknown',
                type: shoeData.shoeType || 'Unknown',
                gender: shoeData.shoeGender || 'Unisex',
                availableStock: stock
            };
        } catch (error) {
            console.error("Error processing item:", item, error);
            return null;
        }
    }));

    const validItems = cartWithDetails.filter(Boolean);
    const container = getElement('orderItems');
    if (!container) return;
    
    container.innerHTML = '';

    if (validItems.length === 0) {
        container.innerHTML = '<p>No valid items found in your cart</p>';
        return;
    }

    validItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <img src="${item.imageUrl}" alt="${item.name}" class="cart-item-image" 
                 onerror="this.src='https://via.placeholder.com/150'">
            <div class="cart-item-details">
                <h4>${item.name}</h4>
                <p>${item.variantName} (${item.color})</p>
                <p>Size: ${item.size}</p>
                <p>Quantity: ${item.quantity}</p>
                ${item.brand ? `<p>Brand: ${item.brand}</p>` : ''}
                ${item.type ? `<p>Type: ${item.type}</p>` : ''}
                ${item.gender ? `<p>Gender: ${item.gender}</p>` : ''}
                <p class="cart-item-price">₱${(item.price * item.quantity).toFixed(2)}</p>
                ${item.availableStock < item.quantity ?
                `<p class="stock-warning">Only ${item.availableStock} left in stock!</p>` : ''}
            </div>
        `;
        container.appendChild(div);
    });

    updateOrderSummary(validItems);
}

// Update order summary display
function updateOrderSummary(items) {
    const orderSummary = getElement('orderSummary');
    if (!orderSummary) return;
    
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.12;
    const shipping = items.length > 0 ? 5.00 : 0;
    const total = subtotal + tax + shipping;

    orderSummary.innerHTML = `
        <div class="order-summary-item">
            <span>Subtotal</span>
            <span>₱${subtotal.toFixed(2)}</span>
        </div>
        <div class="order-summary-item">
            <span>Tax (12% VAT)</span>
            <span>₱${tax.toFixed(2)}</span>
        </div>
        <div class="order-summary-item">
            <span>Shipping</span>
            <span>₱${shipping.toFixed(2)}</span>
        </div>
        <div class="order-summary-item order-total">
            <span>Total</span>
            <span>₱${total.toFixed(2)}</span>
        </div>
    `;
}

// Get cart order IDs from URL
function getCartOrderIds() {
    const params = new URLSearchParams(window.location.search);
    const ids = [];

    params.forEach((value, key) => {
        if (key.startsWith('cartOrder_')) {
            ids.push(value);
        }
    });

    return ids;
}

// Show order confirmation modal
function showOrderConfirmationModal(order) {
    const modal = getElement('orderConfirmationModal');
    const orderIdDisplay = getElement('orderIdDisplay');
    const modalOrderSummary = getElement('modalOrderSummary');

    if (!modal || !orderIdDisplay || !modalOrderSummary) return;

    orderIdDisplay.textContent = order.orderId;

    const shipping = 5.00;
    const subtotal = (order.totalAmount - shipping) / 1.12;
    const tax = subtotal * 0.12;

    modalOrderSummary.innerHTML = `
        <div class="order-summary-item">
            <span>Subtotal</span>
            <span>₱${subtotal.toFixed(2)}</span>
        </div>
        <div class="order-summary-item">
            <span>Tax (12% VAT)</span>
            <span>₱${tax.toFixed(2)}</span>
        </div>
        <div class="order-summary-item">
            <span>Shipping</span>
            <span>₱${shipping.toFixed(2)}</span>
        </div>
        <div class="order-summary-item order-total">
            <span>Total</span>
            <span>₱${order.totalAmount.toFixed(2)}</span>
        </div>
    `;

    modal.style.display = 'block';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
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

    // Payment method selection via div
    document.querySelectorAll(".payment-method").forEach(div => {
        div.addEventListener("click", function () {
            const radio = this.querySelector("input[type='radio']");
            if (radio) {
                radio.checked = true;
            }
        });
    });

    // Initialize checkout page
    initializeCheckout().catch(error => {
        console.error('Error initializing checkout page:', error);
        alert('Error loading checkout page. Please try refreshing.');
    });
});