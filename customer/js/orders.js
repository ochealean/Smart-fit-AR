import {
    checkUserAuth,
    logoutUser,
    readData,
    updateData,
    readDataRealtime
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

let userID;
let userData;

// Initialize the page
async function initializeOrders() {
    const authResult = await checkUserAuth();
    console.log(authResult);

    if (authResult.authenticated && authResult.role === 'shopowner') {
        console.log(`User is ${authResult.role}`, authResult.userData);
        window.location.href = "../../shopowner/html/shop_dashboard.html";
    }
    else if (authResult.authenticated && authResult.role === 'customer') {
        console.log(`User is ${authResult.role}`, authResult.userData);
    } else {
        window.location.href = "/login.html";
    }

    console.log("User authenticated:", authResult);
    userID = authResult.userId;
    userData = authResult.userData;

    // Load user profile
    loadUserProfile();

    // Load orders with real-time updates
    loadOrders();

    // Set up event listeners
    setupEventListeners();
}

// Load user profile
function loadUserProfile() {
    const userNameElement = getElement('userName_display2');
    const imageProfileElement = getElement('imageProfile');

    if (userNameElement) {
        userNameElement.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Customer';
    }

    if (imageProfileElement) {
        imageProfileElement.src = userData.profilePhoto ||
            "https://firebasestorage.googleapis.com/v0/b/opportunity-9d3bf.appspot.com/o/profile%2Fdefault_profile.png?alt=media&token=5f1a4b8c-7e6b-4f1c-8a2d-0e5f3b7c4a2e";
    }

    document.body.style.display = '';
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Load orders with real-time updates
function loadOrders() {
    const ordersContainer = document.querySelector('.purchase-history');
    if (!ordersContainer) return;

    // Show loading state
    // ordersContainer.innerHTML = `
    //     <div class="no-orders">
    //         <i class="fas fa-box-open"></i>
    //         <h3>Loading Orders...</h3>
    //         <p>Please wait while we load your orders</p>
    //     </div>
    // `;

    // Debounced display function
    const debouncedDisplayOrders = debounce(async (orders, container) => {
        await displayOrders(orders, container);
    }, 300); // 300ms debounce

    // Use real-time data reading
    const unsubscribe = readDataRealtime(
        `smartfit_AR_Database/transactions/${userID}`,
        async (result) => {
            if (!result.data) {
                ordersContainer.innerHTML = `
                    <div class="no-orders">
                        <i class="fas fa-box-open"></i>
                        <h3>No Orders Found</h3>
                        <p>You haven't placed any orders yet.</p>
                        <a href="/customer/html/browse.html" class="btn btn-shop">Browse Shoes</a>
                    </div>
                `;
                return;
            }

            if (!result.success) {
                ordersContainer.innerHTML = `
                    <div class="no-orders">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error Loading Orders</h3>
                        <p>Failed to load your orders. Please try again.</p>
                    </div>
                `;
                return;
            }

            // Process orders
            const orders = [];
            for (const [orderId, orderData] of Object.entries(result.data)) {
                if (orderData) {
                    orders.unshift({
                        id: orderId,
                        orderId: orderId, // Ensure orderId is included
                        ...orderData
                    });
                }
            }

            // Display orders using debounced function
            await debouncedDisplayOrders(orders, ordersContainer);
        }
    );

    return unsubscribe;
}

// Display orders in the container
async function displayOrders(orders, ordersContainer) {
    if (!ordersContainer) return;

    // Create a map of existing order cards by orderId for quick lookup
    const existingCards = new Map();
    const orderCards = ordersContainer.querySelectorAll('.order-card');
    orderCards.forEach(card => {
        existingCards.set(card.dataset.orderId, card);
    });

    // Process each order
    for (const order of orders) {
        const existingCard = existingCards.get(order.orderId);

        if (existingCard) {
            // Update existing card
            const status = order.status?.toLowerCase() || 'pending';
            const { class: statusClass, text: statusText } = getStatusInfo(status);

            // Update status and action buttons
            existingCard.dataset.status = status;
            const statusElement = existingCard.querySelector('.order-status');
            if (statusElement) {
                statusElement.className = `order-status ${statusClass}`;
                statusElement.textContent = statusText;
            }

            const actionButtons = generateActionButtons(status, order.orderId, order.serialNumber, false, order.item?.shopId);
            const actionsElement = existingCard.querySelector('.order-actions');
            if (actionsElement) {
                actionsElement.innerHTML = actionButtons;
            }

            // Remove from existingCards to mark as processed
            existingCards.delete(order.orderId);
        } else {
            // Create new card for new order
            const orderCard = await createOrderCard(order);
            if (orderCard) {
                ordersContainer.appendChild(orderCard);
            }
        }
    }

    // Remove any cards for orders that no longer exist or are filtered out
    existingCards.forEach(card => {
        card.remove();
    });

    // If no orders, show the "No Orders Found" message
    if (orders.length === 0) {
        ordersContainer.innerHTML = `
            <div class="no-orders">
                <i class="fas fa-box-open"></i>
                <h3>No Orders Found</h3>
                <p>You haven't placed any orders yet.</p>
                <a href="/customer/html/browse.html" class="btn btn-shop">Browse Shoes</a>
            </div>
        `;
    }

    // Reapply filters after updating cards
    setupOrderFilters();
}

// Create order card element
async function createOrderCard(order) {
    if (!order) return null;
    console.log(order);
    
    const status = order.status?.toLowerCase() || 'pending';

    // FIXED: Check for unresolved issues first - if unresolved, return null to hide the order
    let hasUnresolvedIssue = false;
    try {
        // Get all issue reports for this user
        const userIssuesResult = await readData(`smartfit_AR_Database/issueReports/${userID}`);
        
        if (userIssuesResult.success && userIssuesResult.data) {
            const userIssues = userIssuesResult.data;
            
            // Check if any issue report matches this order ID and is unresolved
            for (const [issueId, issueData] of Object.entries(userIssues)) {
                if (issueData.orderID === order.orderId && !issueData.resolved) {
                    hasUnresolvedIssue = true;
                    break;
                }
            }
        }
    } catch (error) {
        console.log("Error checking issue report:", error);
    }

    // FIXED: Hide orders with unresolved issues (just like completed status)
    if (hasUnresolvedIssue) {
        console.log(`Hiding order ${order.orderId} because it has unresolved issues`);
        return null;
    }

    // Only show these statuses (excluding 'completed' and orders with unresolved issues)
    const allowedStatuses = [
        'pending',
        'order processed',
        'shipped',
        'accepted',
        'in transit',
        'arrived at facility',
        'out for delivery',
        'delivered'
    ];

    // Skip if status is not in allowed list (including 'completed')
    if (!allowedStatuses.includes(status)) {
        console.log(`Hiding order ${order.orderId} with status: ${status}`);
        return null;
    }

    // Check if this order has a serial number
    let serialNumber = order.serialNumber;

    // If not found in order, check shoeVerification collection
    if (!serialNumber) {
        try {
            const serialNumberData = await getSerialNumberFromVerification(order.orderId);
            if (serialNumberData) {
                serialNumber = serialNumberData.serialNumber;
            }
        } catch (error) {
            console.log("No serial number found in verification collection");
        }
    }

    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';
    orderCard.dataset.status = status;
    orderCard.dataset.orderId = order.orderId;
    orderCard.dataset.hasUnresolvedIssue = hasUnresolvedIssue; // This will always be false now since we filtered above
    if (serialNumber) {
        orderCard.dataset.serialNumber = serialNumber;
    }

    const orderDate = new Date(order.date || Date.now());
    const formattedDate = orderDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const { class: statusClass, text: statusText } = getStatusInfo(status);
    console.log("Order status:", statusClass, statusText);

    let orderItemHTML = '';
    if (order.item) {
        const fallbackImage = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        const itemImage = order.item.imageUrl || fallbackImage;

        // Add serial number to item details if available
        const serialNumberHTML = serialNumber ?
            `<div class="item-serial">Serial Number: <strong>${serialNumber}</strong></div>` : '';

        orderItemHTML = `
        <div class="order-item">
            <img src="${itemImage}" alt="Product" class="item-image" onerror="this.onerror=null;this.src='${fallbackImage}'">
            <div class="item-details">
                <div class="item-name">${order.item.name || 'Unknown Product'}</div>
                <div class="item-variant">Color: ${order.item.color || 'N/A'}, Size: ${order.item.size || 'N/A'}</div>
                ${serialNumberHTML}
                <div class="item-price">₱${(order.item.price || 0).toFixed(2)}</div>
            </div>
            <div class="item-quantity">Qty: ${order.item.quantity || 1}</div>
        </div>
    `;
    }

    console.log(order.item.shopId);
    // Since we've filtered out unresolved issues, hasUnresolvedIssue will always be false here
    const actionButtons = generateActionButtons(status, order.orderId, serialNumber, false, order.item.shopId);

    orderCard.innerHTML = `
        <div class="order-header">
            <div>
                <span class="order-id">Order #${(order.orderId || '').substring(0, 8).toUpperCase()}</span>
                <span class="order-date"> - ${formattedDate}</span>
            </div>
            <span class="order-status ${statusClass}">${statusText}</span>
        </div>
        <div class="order-body">
            <div class="order-items">
                ${orderItemHTML || '<p>No items found in this order</p>'}
            </div>
        </div>
        <div class="order-footer">
            <div class="order-total">Total: ₱${(order.totalAmount || 0).toFixed(2)}</div>
            <div class="order-actions">
                ${actionButtons}
            </div>
        </div>
    `;

    return orderCard;
}

// Get status information
function getStatusInfo(status) {
    console.log("Getting status info for:", status);
    const statusMap = {
        'pending': { class: 'status-pending', text: 'Pending' },
        'accepted': { class: 'status-accepted', text: 'Accepted' },
        'order processed': { class: 'status-processed', text: 'Order Processed' },
        'shipped': { class: 'status-shipped', text: 'Shipped' },
        'in transit': { class: 'status-transit', text: 'In Transit' },
        'arrived at facility': { class: 'status-arrived', text: 'Arrived at Facility' },
        'out for delivery': { class: 'status-out-for-delivery', text: 'Out for Delivery' },
        'delivered': { class: 'status-delivered', text: 'Delivered' }
    };

    return statusMap[status] || { class: 'status-pending', text: 'Pending' };
}

// Generate action buttons based on order status
function generateActionButtons(status, orderId, serialNumber, hasUnresolvedIssue, shopID) {
    let buttons = '';

    if (status === 'delivered') {
        buttons = `
            <button class="btn btn-received" onclick="markAsReceived('${orderId}')">
                <i class="fas fa-check"></i> Order Received
            </button>
            ${!hasUnresolvedIssue ? `
            <button class="btn btn-issue" onclick="reportIssue('${orderId}', '${shopID}')">
                <i class="fas fa-exclamation"></i> Report Issue
            </button>
            ` : ''}
            <button class="btn btn-track" onclick="trackOrder('${orderId}')">
                <i class="fas fa-truck"></i> Track Package
            </button>
        `;
    } else if (status === 'pending') {
        buttons = `
            <button class="btn btn-track" onclick="trackOrder('${orderId}')">
                <i class="fas fa-truck"></i> Track Package
            </button>
            <button class="btn btn-cancel" onclick="cancelOrder('${orderId}')">
                <i class="fas fa-times"></i> Cancel Order
            </button>
        `;
    } else if (['shipped', 'in transit', 'arrived at facility', 'out for delivery', 'accepted'].includes(status)) {
        buttons = `
            <button class="btn btn-track" onclick="trackOrder('${orderId}')">
                <i class="fas fa-truck"></i> Track Package
            </button>
        `;
    } else {
        buttons = `
            <button class="btn btn-track" onclick="trackOrder('${orderId}')">
                <i class="fas fa-truck"></i> Track Package
            </button>
            <button class="btn btn-cancel" onclick="cancelOrder('${orderId}')">
                <i class="fas fa-times"></i> Cancel Order
            </button>
        `;
    }

    // Add validate button if serial number exists
    if (serialNumber) {
        buttons += `
            <button class="btn btn-verify" onclick="validateShoe('${serialNumber}')">
                <i class="fas fa-check-circle"></i> Validate Shoe
            </button>
        `;
    }

    return buttons;
}

// Get serial number from verification collection
async function getSerialNumberFromVerification(orderId) {
    try {
        const verificationResult = await readData('smartfit_AR_Database/shoeVerification');

        if (!verificationResult.success || !verificationResult.data) {
            return null;
        }

        const allVerifications = verificationResult.data;

        // Search for verification record with matching orderId
        for (const key in allVerifications) {
            const verification = allVerifications[key];
            if (verification.orderId === orderId) {
                return verification;
            }
        }

        return null;
    } catch (error) {
        console.error("Error fetching serial number from verification:", error);
        return null;
    }
}

// Set up order filters and search
function setupOrderFilters() {
    const filterSelect = getElement('activeFilter');
    const searchInput = document.querySelector('.search-orders');

    if (filterSelect) {
        filterSelect.addEventListener('change', filterOrders);
    }
    if (searchInput) {
        searchInput.addEventListener('input', searchOrders);
    }
}

// Filter orders by status
function filterOrders() {
    const filterValue = getElement('activeFilter')?.value;
    if (!filterValue) return;

    const orderCards = document.querySelectorAll('.order-card');

    orderCards.forEach(card => {
        if (filterValue === 'all' || card.dataset.status === filterValue) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Search orders
function searchOrders() {
    const searchInput = document.querySelector('.search-orders');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase();
    const orderCards = document.querySelectorAll('.order-card');

    orderCards.forEach(card => {
        const orderText = card.textContent.toLowerCase();
        if (orderText.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Cancel order function
window.cancelOrder = async function (orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    try {
        // First get the order details
        const orderResult = await readData(`smartfit_AR_Database/transactions/${userID}/${orderId}`);

        if (!orderResult.success || !orderResult.data) {
            alert('Order not found');
            return;
        }

        const order = orderResult.data;

        // Update order status to cancelled
        const updateResult = await updateData(
            `smartfit_AR_Database/transactions/${userID}/${orderId}`,
            { status: 'cancelled' }
        );

        if (!updateResult.success) {
            alert('Failed to cancel order: ' + updateResult.error);
            return;
        }

        // Restore stock quantity if the order is not already cancelled
        if (order.status !== 'cancelled' && order.item) {
            await restoreStock(order.item);
        }

        alert('Order has been cancelled successfully and stock has been restored.');
    } catch (error) {
        console.error('Error cancelling order:', error);
        alert('Failed to cancel order. Please try again.');
    }
};

// Restore stock when order is cancelled
async function restoreStock(item) {
    const { shopId, shoeId, variantKey, sizeKey, quantity } = item;

    if (!shopId || !shoeId || !variantKey || !sizeKey || !quantity) {
        console.warn('Incomplete item data for stock restoration');
        return;
    }

    try {
        // Get current stock
        const stockResult = await readData(`smartfit_AR_Database/shoe/${shopId}/${shoeId}/variants/${variantKey}/sizes/${sizeKey}`);

        if (!stockResult.success || !stockResult.data) {
            console.warn('Stock data not found');
            return;
        }

        const sizeData = stockResult.data;
        const sizeValue = Object.keys(sizeData)[0];
        const currentStock = sizeData[sizeValue]?.stock || 0;
        const newStock = currentStock + quantity;

        // Update stock in database
        await updateData(
            `smartfit_AR_Database/shoe/${shopId}/${shoeId}/variants/${variantKey}/sizes/${sizeKey}/${sizeValue}`,
            { stock: newStock }
        );

        console.log(`Stock restored for ${shoeId} size ${sizeValue}: ${currentStock} -> ${newStock}`);
    } catch (error) {
        console.error('Error restoring stock:', error);
    }
}

// Track order function
window.trackOrder = function (orderId) {
    window.location.href = `/customer/html/track.html?orderId=${orderId}&userId=${userID}`;
};

// Validate shoe function
window.validateShoe = function (serialNumber) {
    window.location.href = `/customer/html/shoevalidator.html?ShoeSerialNumber=${encodeURIComponent(serialNumber)}`;
};

// Mark order as received - FIXED: Also check for unresolved issues here
window.markAsReceived = async function (orderId) {
    // Check for unresolved issues
    let hasUnresolvedIssue = false;
    try {
        const userIssuesResult = await readData(`smartfit_AR_Database/issueReports/${userID}`);
        
        if (userIssuesResult.success && userIssuesResult.data) {
            const userIssues = userIssuesResult.data;
            
            for (const [issueId, issueData] of Object.entries(userIssues)) {
                if (issueData.orderID === orderId && !issueData.resolved) {
                    hasUnresolvedIssue = true;
                    break;
                }
            }
        }
    } catch (error) {
        console.log("Error checking issue report:", error);
    }

    let message = 'Confirm you have received this order in good condition?';
    if (hasUnresolvedIssue) {
        message = 'You have an ongoing issue report for this order. Are you sure you want to mark it as received?';
    }

    if (!confirm(message)) return;

    try {
        const updateResult = await updateData(
            `smartfit_AR_Database/transactions/${userID}/${orderId}`,
            { status: 'completed' }
        );

        if (updateResult.success) {
            alert('Order marked as received successfully!');
            // Reload orders to reflect changes (this will hide the order since it's now completed)
            loadOrders();
        } else {
            alert('Failed to update order status: ' + updateResult.error);
        }
    } catch (error) {
        console.error('Error marking order as received:', error);
        alert('Failed to update order status. Please try again.');
    }
};

// Report issue with order
window.reportIssue = function (orderId, shopID) {
    window.location.href = `/customer/html/reportIssue.html?orderID=${orderId}&userID=${userID}&shopID=${shopID}`;
};

// Set up event listeners
function setupEventListeners() {
    // Logout functionality
    const logoutBtn = getElement('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
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

    // Initialize orders page
    initializeOrders();
});