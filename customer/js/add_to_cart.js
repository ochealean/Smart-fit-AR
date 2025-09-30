// Import only from firebaseMethods
import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    readData,
    updateData,
    deleteData
} from '../../firebaseMethods.js';

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Global variables
let userData = null;
let userId = null;
let cartItems = [];
let unsubscribeCartListener = null;

// Initialize the page
async function initializeCart() {
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
    
    // Load cart items
    await loadCartItems();
    
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
}

// Load cart items
async function loadCartItems() {
    const cartPath = `smartfit_AR_Database/carts/${userId}`;
    
    if (unsubscribeCartListener) {
        unsubscribeCartListener();
    }
    
    unsubscribeCartListener = readDataRealtime(cartPath, async (result) => {
        if (!result.success || !result.data) {
            createCartSummary();
            showEmptyCart();
            return;
        }

        const cartData = result.data;
        console.log("Raw cart data:", cartData);
        
        // Only re-process if cart data actually changed
        const cartDataString = JSON.stringify(cartData);
        if (window.lastCartData === cartDataString) return;
        window.lastCartData = cartDataString;

        console.log("Processing cart data:", cartData);
        
        // Convert to array and sort by addedAt (newest first)
        const cartEntries = Object.entries(cartData);

        console.log("Cart entries before sorting:", cartEntries);
        
        // Fixed sorting logic - use addedAt instead of timestamp
        const sortedEntries = cartEntries.sort(([keyA, itemA], [keyB, itemB]) => {
            console.log("Comparing items:", itemA, itemB);
            // Get addedAt from item data
            const addedAtA = getAddedAt(itemA, keyA);
            const addedAtB = getAddedAt(itemB, keyB);
            
            // Sort in descending order (newest first)
            return addedAtB - addedAtA;
        });

        console.log("Sorted entries:", sortedEntries);
        
        cartItems = await Promise.all(sortedEntries.map(async ([cartId, item]) => {
            try {
                const shoePath = `smartfit_AR_Database/shoe/${item.shopId}/${item.shoeId}`;
                const shoeResult = await readData(shoePath);

                if (!shoeResult.success || !shoeResult.data) return null;

                const shoeData = shoeResult.data;
                const variant = shoeData.variants?.[item.variantKey];
                if (!variant) return null;

                const sizeObj = variant.sizes?.[item.sizeKey];
                if (!sizeObj) return null;

                const sizeValue = Object.keys(sizeObj)[0];
                if (!sizeValue) return null;

                const stock = sizeObj[sizeValue]?.stock || 0;

                return {
                    cartId,
                    shopId: item.shopId,
                    shoeId: item.shoeId,
                    variantKey: item.variantKey,
                    sizeKey: item.sizeKey,
                    quantity: item.quantity || 1,
                    shoeName: shoeData.shoeName,
                    price: parseFloat(variant.price),
                    imageUrl: variant.imageUrl || shoeData.defaultImage,
                    variantName: variant.variantName,
                    color: variant.color,
                    size: sizeValue,
                    availableStock: stock,
                    addedAt: getAddedAt(item, cartId)
                };
            } catch (err) {
                console.error("Error loading cart item:", err);
                return null;
            }
        }));

        cartItems = cartItems.filter(item => item !== null);
        
        // Final sort by addedAt to ensure correct order
        cartItems.sort((a, b) => b.addedAt - a.addedAt);
        
        console.log("Final cart items:", cartItems);
        renderCart();
    });
}

// Helper function to extract addedAt from cart item
function getAddedAt(item, cartId) {
    console.log("Getting addedAt for item:", item, "cartId:", cartId);
    
    // Priority 1: Use item.addedAt if it exists
    if (item.addedAt) {
        console.log("Using item.addedAt:", item.addedAt);
        
        // Handle different formats of addedAt
        if (typeof item.addedAt === 'number') {
            return item.addedAt;
        } else if (typeof item.addedAt === 'string') {
            // Parse the ISO date string properly
            const date = new Date(item.addedAt);
            const timestamp = date.getTime();
            
            // Check if the date is valid (not NaN)
            if (!isNaN(timestamp)) {
                console.log("Parsed timestamp:", timestamp);
                return timestamp;
            } else {
                console.log("Invalid date string, trying alternative parsing");
            }
        } else if (item.addedAt instanceof Date) {
            return item.addedAt.getTime();
        }
        
        // If we get here, try to parse as a number directly
        const parsed = parseInt(item.addedAt);
        if (!isNaN(parsed)) {
            console.log("Parsed as number:", parsed);
            return parsed;
        }
    }
    
    // Priority 2: Try to parse cartId as timestamp (if it's a Firebase push key)
    if (cartId && cartId.length > 8) {
        // Firebase push keys contain timestamp in first 8 characters
        const timestampFromKey = parseInt(cartId.substring(0, 8), 36);
        if (!isNaN(timestampFromKey)) {
            console.log("Using timestamp from cartId:", timestampFromKey);
            return timestampFromKey;
        }
    }
    
    // Priority 3: Use current date as fallback (will appear at bottom)
    console.log("Using fallback current timestamp");
    return Date.now();
}

// Render cart items in descending order by date
function renderCart() {
    const cartContainer = getElement("cartContainer");
    const cartSummaryContainer = getElement("cartsummarycontainer");
    cartContainer.innerHTML = "";
    cartSummaryContainer.innerHTML = "";

    if (cartItems.length === 0) {
        createCartSummary();
        showEmptyCart();
        return;
    }

    // Create cart header with select all
    const cartHeader = document.createElement('div');
    cartHeader.className = 'cart-header';
    cartHeader.innerHTML = `
        <div class="select-all-container">
            <input type="checkbox" class="cart-item-checkbox" id="selectAllItems" checked>
            <label for="selectAllItems">Select all items</label>
        </div>
    `;
    cartContainer.appendChild(cartHeader);

    const cartItemsSection = document.createElement('div');
    cartItemsSection.className = 'cart-items';

    // Items are already sorted by addedAt in descending order
    cartItems.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        
        // Format date for display
        console.log("Item addedAt timestamp:", item.addedAt, "for item:", item.shoeName);
        const addedDate = new Date(item.addedAt);
        console.log("Parsed date:", addedDate);
        const formattedDate = formatDate(item.addedAt);
        
        itemElement.innerHTML = `
            <div class="cart-item-select">
                <input type="checkbox" class="cart-item-checkbox" data-cartid="${item.cartId}" checked>
            </div>

            <div class="cart-item-picture">
                <img src="${item.imageUrl}" alt="${item.shoeName}" class="cart-item-image" 
                     onerror="this.src='https://via.placeholder.com/150'">
            </div>

            <div class="cart-item-details">
                <h3 class="cart-item-name">${item.shoeName}</h3>
                <p class="cart-item-variant">${item.variantName} (${item.color}) - Size: ${item.size}</p>
                <p class="cart-item-price">₱${(item.price * item.quantity).toFixed(2)}</p>
                <p class="cart-item-date"><i class="far fa-clock"></i> Added: ${formattedDate}</p>

                <div class="quantity-controls">
                    <button class="quantity-btn" data-cartid="${item.cartId}" data-change="-1">-</button>
                    <input type="number" class="quantity-input" value="${item.quantity}" 
                           min="1" max="${item.availableStock}" data-cartid="${item.cartId}">
                    <button class="quantity-btn" data-cartid="${item.cartId}" data-change="1">+</button>
                </div>

                <div class="cta-btn">
                    <button class="delete-btn" data-cartid="${item.cartId}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="feedback-btn" data-cartid="${item.cartId}">
                        <i class="fas fa-info-circle"></i> View Details
                    </button>
                </div>
            </div>
        `;

        cartItemsSection.appendChild(itemElement);
    });

    cartContainer.appendChild(cartItemsSection);
    setupCartEventListeners();
    createCartSummary();
}

// Helper function to format date for display
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
        console.log("Invalid date timestamp:", timestamp);
        return 'Recently';
    }
    
    if (diffDays === 1) {
        return 'Today';
    } else if (diffDays === 2) {
        return 'Yesterday';
    } else if (diffDays <= 7) {
        return `${diffDays - 1} days ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
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
                    // Clean up listeners before redirecting
                    if (unsubscribeCartListener) {
                        unsubscribeCartListener();
                    }
                    window.location.href = '/login.html';
                } else {
                    console.error('Error signing out:', result.error);
                }
            }
        });
    }

    // Cart event listeners
    setupCartEventListeners();

    // Mobile menu setup
    setupMobileMenu();
}

function setupCartEventListeners() {
    // Select All functionality
    const selectAllCheckbox = getElement('selectAllItems');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const itemCheckboxes = document.querySelectorAll('.cart-item-checkbox');
            itemCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            updateTotals();
        });
    }

    // Individual checkbox change should update select all state
    document.querySelectorAll('.cart-item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSelectAllState();
            updateTotals();
        });
    });

    // Delete button handlers
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const cartId = e.target.closest('.delete-btn').dataset.cartid;
            const confirmDelete = confirm("Are you sure you want to delete this item?");
            if (!confirmDelete) return;

            try {
                const deletePath = `smartfit_AR_Database/carts/${userId}/${cartId}`;
                const deleteResult = await deleteData(deletePath);

                if (deleteResult.success) {
                    cartItems = cartItems.filter(item => item.cartId !== cartId);
                    renderCart();
                } else {
                    console.error("Error deleting item:", deleteResult.error);
                }
            } catch (error) {
                console.error("Error deleting item:", error);
            }
        });
    });

    // Quantity button handlers
    document.querySelectorAll('.quantity-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const cartId = e.target.closest('.quantity-btn').dataset.cartid;
            const change = parseInt(e.target.closest('.quantity-btn').dataset.change);
            const item = cartItems.find(i => i.cartId === cartId);
            if (!item) return;

            const newQty = item.quantity + change;
            if (newQty >= 1 && newQty <= item.availableStock) {
                try {
                    // Update only the quantity field using direct Firebase update
                    const updatePath = `smartfit_AR_Database/carts/${userId}/${cartId}`;
                    const updateResult = await updateData(updatePath, { 
                        quantity: newQty,
                        addedAt: item.addedAt // Preserve original addedAt
                    });

                    if (updateResult.success) {
                        item.quantity = newQty;
                        renderCart();
                    }
                } catch (error) {
                    console.error("Error updating quantity:", error);
                }
            }
        });
    });

    // Quantity input handlers
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const cartId = e.target.dataset.cartid;
            const value = parseInt(e.target.value);
            const item = cartItems.find(i => i.cartId === cartId);
            if (!item) return;

            if (!isNaN(value) && value >= 1 && value <= item.availableStock) {
                try {
                    // Update only the quantity field using direct Firebase update
                    const updatePath = `smartfit_AR_Database/carts/${userId}/${cartId}`;
                    const updateResult = await updateData(updatePath, { 
                        quantity: value,
                        addedAt: item.addedAt // Preserve original addedAt
                    });

                    if (updateResult.success) {
                        item.quantity = value;
                        renderCart();
                    }
                } catch (error) {
                    console.error("Error updating quantity:", error);
                }
            } else {
                e.target.value = item.quantity; // Reset to previous value
            }
        });
    });

    // View Details button handlers
    document.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cartId = e.target.closest('.feedback-btn').dataset.cartid;
            const item = cartItems.find(i => i.cartId === cartId);
            if (item) {
                window.location.href = `/customer/html/shoedetails.html?shopID=${item.shopId}&shoeID=${item.shoeId}`;
            }
        });
    });

    // Initialize select all state
    updateSelectAllState();
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

// Update select all checkbox state
function updateSelectAllState() {
    const selectAllCheckbox = getElement('selectAllItems');
    const itemCheckboxes = document.querySelectorAll('.cart-item-checkbox');
    
    if (itemCheckboxes.length === 0) {
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
        return;
    }
    
    const allChecked = Array.from(itemCheckboxes).every(checkbox => checkbox.checked);
    const someChecked = Array.from(itemCheckboxes).some(checkbox => checkbox.checked);
    
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }
}

// Create cart summary
function createCartSummary() {
    const cartSummaryContainer = getElement("cartsummarycontainer");
    cartSummaryContainer.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = 'cart-summary';
    summary.id = 'cart-summary';

    summary.innerHTML = `
        <div class="summary-row">
            <span>Subtotal</span>
            <span id="subtotal">₱0.00</span>
        </div>
        <div class="summary-row">
            <span>Tax (10%)</span>
            <span id="tax">₱0.00</span>
        </div>
        <div class="summary-row">
            <span>Shipping</span>
            <span id="shipping">₱5.00</span>
        </div>
        <div class="summary-row summary-total">
            <span>Total</span>
            <span id="total">₱0.00</span>
        </div>
        <button class="checkout-btn" id="checkoutBtn">Proceed to Checkout</button>
        <a href="/customer/html/customer_dashboard.html" class="continue-shopping">
            <i class="fas fa-arrow-left"></i> Continue Shopping
        </a>
    `;

    cartSummaryContainer.appendChild(summary);

    // Add checkout button handler
    getElement("checkoutBtn")?.addEventListener("click", () => {
        const checkedItems = Array.from(document.querySelectorAll('.cart-item-checkbox:checked'))
            .map(cb => {
                const cartId = cb.dataset.cartid;
                return cartItems.find(item => item.cartId === cartId);
            })
            .filter(Boolean);

        if (checkedItems.length === 0) {
            alert("Please select at least one item to proceed to checkout.");
            return;
        }

        // Prepare checkout URL with all selected items
        const params = new URLSearchParams();
        params.append("method", "cartOrder");

        checkedItems.forEach((item, index) => {
            params.append(`cartOrder_${index + 1}`, item.cartId);
        });

        window.location.href = `checkout.html?${params.toString()}`;
    });

    updateTotals();
}

// Update order totals
function updateTotals() {
    const checkedCartIds = Array.from(document.querySelectorAll('.cart-item-checkbox:checked'))
        .map(cb => cb.dataset.cartid);
    const selectedItems = cartItems.filter(item => checkedCartIds.includes(item.cartId));

    const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1;
    const shipping = selectedItems.length > 0 ? 5.0 : 0.0;
    const total = subtotal + tax + shipping;

    const subtotalEl = getElement('subtotal');
    const taxEl = getElement('tax');
    const shippingEl = getElement('shipping');
    const totalEl = getElement('total');

    if (subtotalEl) subtotalEl.innerText = `₱${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.innerText = `₱${tax.toFixed(2)}`;
    if (shippingEl) shippingEl.innerText = `₱${shipping.toFixed(2)}`;
    if (totalEl) totalEl.innerText = `₱${total.toFixed(2)}`;

    // Update select all state whenever totals are updated
    updateSelectAllState();
}

// Show empty cart message
function showEmptyCart() {
    const emptyCartMessage = getElement("emptyCartMessage");
    if (emptyCartMessage) {
        emptyCartMessage.style.display = 'block';
    }
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

    // Clean up listeners when page unloads
    window.addEventListener('beforeunload', () => {
        if (unsubscribeCartListener) {
            unsubscribeCartListener();
        }
    });

    // Initialize cart page
    initializeCart().catch(error => {
        console.error('Error initializing cart page:', error);
        const cartContainer = getElement("cartContainer");
        if (cartContainer) {
            cartContainer.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Cart</h3>
                    <p>Please try refreshing the page.</p>
                </div>
            `;
        }
    });
});