import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    readData
} from '../../firebaseMethods.js';

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Global variables
let userData = null;
let userId = null;
let allOrders = [];
let currentStatusFilter = 'all';
let currentSearchTerm = '';
let currentTimeFilter = 'all';

// Template functions
function getTemplate(id) {
    const template = document.getElementById(id);
    if (!template) {
        console.error(`Template not found: ${id}`);
        return null;
    }
    return template.innerHTML;
}

function renderTemplate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : match;
    });
}

// Initialize the page
async function initializeHistory() {
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
    
    // Load order history
    await loadOrderHistory();
    
    // Set up event listeners
    setupEventListeners();
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
    
    document.body.style.display = '';
}

// Load order history
async function loadOrderHistory(statusFilter = 'all', timeFilter = 'all') {
    const purchaseHistoryContainer = document.querySelector('.purchase-history');
    
    if (!purchaseHistoryContainer) return;

    // Show loading state using template
    const loadingTemplate = getTemplate('loading-template');
    if (loadingTemplate) {
        purchaseHistoryContainer.innerHTML = loadingTemplate;
    } else {
        purchaseHistoryContainer.innerHTML = '<div>Loading...</div>';
    }

    try {
        const ordersPath = `smartfit_AR_Database/transactions/${userId}`;

        const unsubscribe = readDataRealtime(ordersPath, (result) => {
            if (result.success) {
                allOrders = processOrdersData(result.data);
                currentStatusFilter = statusFilter;
                currentTimeFilter = timeFilter;
                applyFilters();
            } else {
                allOrders = [];
                showNoOrdersMessage();
            }
        });

        return unsubscribe;
    } catch (error) {
        console.error('Error loading order history:', error);
        showErrorState();
    }
}

// Apply all filters
function applyFilters() {
    let filteredOrders = allOrders;

    if (currentStatusFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => 
            order.status.toLowerCase() === currentStatusFilter
        );
    }

    if (currentTimeFilter !== 'all') {
        filteredOrders = filterOrdersByTime(filteredOrders, currentTimeFilter);
    }

    if (currentSearchTerm.trim() !== '') {
        filteredOrders = searchOrders(filteredOrders, currentSearchTerm);
    }

    displayFilteredOrders(filteredOrders);
}

// Filter orders by time range
function filterOrdersByTime(orders, timeFilter) {
    const now = new Date();
    let startDate;

    switch (timeFilter) {
        case 'last30':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
            break;
        case 'last90':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
            break;
        case 'all':
        default:
            return orders;
    }

    return orders.filter(order => {
        if (!order.date) return false;
        const orderDate = new Date(order.date);
        return orderDate >= startDate && orderDate <= now;
    });
}

function getTimeFilterDisplayName(timeFilter) {
    const displayNames = {
        'last30': 'Last 30 Days',
        'last90': 'Last 90 Days',
        'all': 'All Time'
    };
    return displayNames[timeFilter] || timeFilter;
}

// Search through orders
function searchOrders(orders, searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    return orders.filter(order => {
        if (order.orderId && order.orderId.toLowerCase().includes(term)) return true;

        const items = order.item ? [order.item] : (order.order_items ? Object.values(order.order_items) : []);
        const hasMatchingProduct = items.some(item => item.name && item.name.toLowerCase().includes(term));
        if (hasMatchingProduct) return true;

        if (order.item?.shopName && order.item.shopName.toLowerCase().includes(term)) return true;

        const hasMatchingVariant = items.some(item => 
            (item.color && item.color.toLowerCase().includes(term)) ||
            (item.size && item.size.toLowerCase().includes(term))
        );
        if (hasMatchingVariant) return true;

        if (order.status && order.status.toLowerCase().includes(term)) return true;

        return false;
    });
}

// Display filtered orders
function displayFilteredOrders(orders) {
    const purchaseHistoryContainer = document.querySelector('.purchase-history');
    if (!purchaseHistoryContainer) return;

    purchaseHistoryContainer.innerHTML = '';

    if (orders.length === 0) {
        if (currentSearchTerm.trim() !== '') {
            showNoSearchResultsMessage();
        } else if (currentStatusFilter !== 'all' || currentTimeFilter !== 'all') {
            showNoFilteredOrdersMessage();
        } else {
            showNoOrdersMessage();
        }
        return;
    }

    // Display each order
    orders.forEach(order => {
        displayOrderCard(order);
    });

    showFilterResultsCount(orders.length);
}

// Show filter results information
function showFilterResultsCount(count) {
    const purchaseHistoryContainer = document.querySelector('.purchase-history');
    const resultsCount = document.createElement('div');
    resultsCount.className = 'filter-results-count';
    
    let filterInfo = [];
    if (currentStatusFilter !== 'all') filterInfo.push(`Status: ${currentStatusFilter}`);
    if (currentTimeFilter !== 'all') filterInfo.push(`Time: ${getTimeFilterDisplayName(currentTimeFilter)}`);
    if (currentSearchTerm.trim() !== '') filterInfo.push(`Search: "${currentSearchTerm}"`);
    
    let message = `Found ${count} order${count !== 1 ? 's' : ''}`;
    if (filterInfo.length > 0) message += ` (${filterInfo.join(', ')})`;
    
    resultsCount.innerHTML = message;
    
    if (purchaseHistoryContainer.firstChild) {
        purchaseHistoryContainer.insertBefore(resultsCount, purchaseHistoryContainer.firstChild);
    } else {
        purchaseHistoryContainer.appendChild(resultsCount);
    }
}

// Show no search results message
function showNoSearchResultsMessage() {
    const purchaseHistoryContainer = document.querySelector('.purchase-history');
    if (!purchaseHistoryContainer) return;

    let message = `No orders found matching "<strong>${currentSearchTerm}</strong>"`;
    if (currentStatusFilter !== 'all' || currentTimeFilter !== 'all') {
        message += ' with the current filters';
    }

    const template = getTemplate('no-search-results-template');
    if (template) {
        purchaseHistoryContainer.innerHTML = template;
        // Update the message dynamically
        const messageElement = purchaseHistoryContainer.querySelector('[data-message]');
        if (messageElement) {
            messageElement.innerHTML = `${message}. Try adjusting your search or filters.`;
        }
    } else {
        purchaseHistoryContainer.innerHTML = `<div>${message}</div>`;
    }
}

// Process orders data
function processOrdersData(ordersData) {
    const orders = [];
    if (!ordersData) return orders;

    Object.keys(ordersData).forEach(orderId => {
        const order = ordersData[orderId];
        order.orderId = orderId;
        const status = order.status ? order.status.toLowerCase() : '';
        const historyStatuses = ['cancelled', 'rejected', 'completed'];

        if (historyStatuses.includes(status)) {
            orders.push(order);
        }
    });

    return orders.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Display a single order card
function displayOrderCard(order) {
    const purchaseHistoryContainer = document.querySelector('.purchase-history');
    if (!purchaseHistoryContainer) return;

    const orderCardHTML = createOrderCard(order);
    purchaseHistoryContainer.insertAdjacentHTML('beforeend', orderCardHTML);
}

// Create order card HTML using templates
function createOrderCard(order) {
    const status = order.status ? order.status.toLowerCase() : '';
    const { statusClass, statusText } = getStatusInfo(status);
    const orderDate = formatOrderDate(order.date);
    
    const itemsHTML = createOrderItemsHTML(order);
    const rejectionHTML = createRejectionHTML(order, status);
    const actionButtons = createActionButtons(order, status);

    const template = getTemplate('order-card-template');
    if (template) {
        return renderTemplate(template, {
            orderId: order.orderId,
            orderDate,
            statusClass,
            statusText,
            itemsHTML,
            rejectionHTML,
            totalAmount: (order.totalAmount || 0).toFixed(2),
            actionButtons
        });
    } else {
        // Fallback
        return `
            <div class="order-card" data-order-id="${order.orderId}">
                <div class="order-header">
                    <span class="order-id">Order #${order.orderId}</span>
                    <span class="order-date"> - ${orderDate}</span>
                    <span class="order-status ${statusClass}">${statusText}</span>
                </div>
                <div class="order-items">${itemsHTML}</div>
                ${rejectionHTML}
                <div class="order-footer">
                    <div class="order-total">Total: ₱${(order.totalAmount || 0).toFixed(2)}</div>
                    <div class="order-actions">${actionButtons}</div>
                </div>
            </div>
        `;
    }
}

// Get status information
function getStatusInfo(status) {
    const statusMap = {
        'rejected': { statusClass: 'status-rejected', statusText: 'Rejected by Shop' },
        'cancelled': { statusClass: 'status-cancelled', statusText: 'Cancelled' },
        'completed': { statusClass: 'status-completed', statusText: 'Completed' }
    };
    return statusMap[status] || { statusClass: 'status-default', statusText: status || 'Unknown Status' };
}

// Format order date
function formatOrderDate(dateString) {
    if (!dateString) return 'Date not available';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Create order items HTML
function createOrderItemsHTML(order) {
    const items = order.item ? [order.item] : (order.order_items ? Object.values(order.order_items) : []);
    if (items.length === 0) return '<div class="no-items">No items found</div>';

    let itemsHTML = '';
    const itemTemplate = getTemplate('order-item-template');
    
    items.forEach(item => {
        if (itemTemplate) {
            itemsHTML += renderTemplate(itemTemplate, {
                imageUrl: item.imageUrl || 'https://via.placeholder.com/80',
                itemName: item.name || 'Unknown Product',
                color: item.color || 'N/A',
                size: item.size || 'N/A',
                price: (item.price || 0).toFixed(2),
                quantity: item.quantity || 1
            });
        } else {
            // Fallback
            itemsHTML += `
                <div class="order-item">
                    <img src="${item.imageUrl || 'https://via.placeholder.com/80'}" alt="Product" class="item-image">
                    <div class="item-details">
                        <div class="item-name">${item.name || 'Unknown Product'}</div>
                        <div class="item-variant">Color: ${item.color || 'N/A'}, Size: ${item.size || 'N/A'}</div>
                        <div class="item-price">₱${(item.price || 0).toFixed(2)}</div>
                    </div>
                    <div class="item-quantity">Qty: ${item.quantity || 1}</div>
                </div>
            `;
        }
    });
    return itemsHTML;
}

// Create rejection HTML
function createRejectionHTML(order, status) {
    if (status === 'rejected') {
        const template = getTemplate('rejection-info-template');
        if (template) {
            return renderTemplate(template, {
                icon: 'fas fa-store-alt',
                titlePrefix: 'Rejected by',
                shop: order.item?.shopName || 'Shop',
                reason: order.rejectionReason || 'No reason provided'
            });
        } else {
            return `
                <div class="rejection-info">
                    <div class="rejection-title">
                        <i class="fas fa-store-alt"></i>
                        <span>Rejected by: <span class="rejection-shop">${order.item?.shopName || 'Shop'}</span></span>
                    </div>
                    <div class="rejection-reason">
                        <strong>Reason:</strong> ${order.rejectionReason || 'No reason provided'}
                    </div>
                </div>
            `;
        }
    } else if (status === 'cancelled') {
        const template = getTemplate('rejection-info-template');
        if (template) {
            return renderTemplate(template, {
                icon: 'fas fa-times-circle',
                titlePrefix: 'Cancelled by',
                shop: 'You',
                reason: 'Order was cancelled upon customer request.'
            });
        } else {
            return `
                <div class="rejection-info">
                    <div class="rejection-title">
                        <i class="fas fa-times-circle"></i>
                        <span>Cancelled by: <span class="rejection-shop">You</span></span>
                    </div>
                    <div class="rejection-reason">
                        <strong>Reason:</strong> Order was cancelled upon customer request.
                    </div>
                </div>
            `;
        }
    }
    return '';
}

// Create action buttons
function createActionButtons(order, status) {
    if (status === 'completed') {
        return `
            <button class="btn btn-reorder" onclick="handleReorder('${order.orderId}')">Reorder</button>
            <button class="btn btn-review" onclick="handleLeaveReview('${order.orderId}')">Leave Review</button>
        `;
    } else if (status === 'rejected' || status === 'cancelled') {
        return `
            <button class="btn btn-reorder" onclick="handleFindSimilar('${order.orderId}')">Find Similar</button>
        `;
    }
    return '';
}

// Show no orders message
function showNoOrdersMessage() {
    const purchaseHistoryContainer = document.querySelector('.purchase-history');
    if (!purchaseHistoryContainer) return;

    const template = getTemplate('no-orders-template');
    if (template) {
        purchaseHistoryContainer.innerHTML = template;
    } else {
        purchaseHistoryContainer.innerHTML = '<div>No orders found</div>';
    }
}

// Show no filtered orders message
function showNoFilteredOrdersMessage() {
    const purchaseHistoryContainer = document.querySelector('.purchase-history');
    if (!purchaseHistoryContainer) return;

    let message = 'No orders match your current filters.';
    if (currentStatusFilter !== 'all' && currentTimeFilter !== 'all') {
        message = `No orders found with status "${currentStatusFilter}" from the "${getTimeFilterDisplayName(currentTimeFilter)}".`;
    } else if (currentStatusFilter !== 'all') {
        message = `No orders found with status "${currentStatusFilter}".`;
    } else if (currentTimeFilter !== 'all') {
        message = `No orders found from the "${getTimeFilterDisplayName(currentTimeFilter)}".`;
    }

    const template = getTemplate('no-filtered-orders-template');
    if (template) {
        purchaseHistoryContainer.innerHTML = template;
        // Update the message dynamically
        const messageElement = purchaseHistoryContainer.querySelector('[data-message]');
        if (messageElement) {
            messageElement.innerHTML = `${message} Try adjusting your filters.`;
        }
    } else {
        purchaseHistoryContainer.innerHTML = `<div>${message}</div>`;
    }
}

// Show error state
function showErrorState() {
    const purchaseHistoryContainer = document.querySelector('.purchase-history');
    if (!purchaseHistoryContainer) return;

    const template = getTemplate('error-template');
    if (template) {
        purchaseHistoryContainer.innerHTML = template;
    } else {
        purchaseHistoryContainer.innerHTML = '<div>Error loading orders</div>';
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
                    window.location.href = '/login.html';
                } else {
                    console.error('Error signing out:', result.error);
                }
            }
        });
    }

    // Filter and search functionality
    const statusFilter = getElement('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', handleStatusFilterChange);
    }

    const timeFilter = getElement('timeFilter');
    if (timeFilter) {
        timeFilter.addEventListener('change', handleTimeFilterChange);
    }

    const searchInput = document.querySelector('.search-orders');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                handleSearch(e);
            }, 300);
        });
    }

    // Mobile menu setup
    setupMobileMenu();
}

function handleStatusFilterChange(e) {
    currentStatusFilter = e.target.value;
    applyFilters();
}

function handleTimeFilterChange(e) {
    currentTimeFilter = e.target.value;
    applyFilters();
}

function handleSearch(e) {
    currentSearchTerm = e.target.value;
    applyFilters();
}

window.clearSearch = function() {
    const searchInput = document.querySelector('.search-orders');
    if (searchInput) {
        searchInput.value = '';
        currentSearchTerm = '';
        applyFilters();
    }
};

window.clearAllFilters = function() {
    const statusFilter = getElement('statusFilter');
    if (statusFilter) {
        statusFilter.value = 'all';
        currentStatusFilter = 'all';
    }
    
    const timeFilter = getElement('timeFilter');
    if (timeFilter) {
        timeFilter.value = 'all';
        currentTimeFilter = 'all';
    }
    
    const searchInput = document.querySelector('.search-orders');
    if (searchInput) {
        searchInput.value = '';
        currentSearchTerm = '';
    }
    
    applyFilters();
};

window.handleReorder = function(orderId) {
    console.log('Reorder order:', orderId);
    alert('Reorder functionality coming soon!');
};

window.handleLeaveReview = function(orderId) {
    window.location.href = `/customer/html/feedback.html?orderId=${orderId}&userId=${userId}`;
};

window.handleFindSimilar = function(orderId) {
    console.log('Find similar for order:', orderId);
    alert('Find similar functionality coming soon!');
};

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

window.displayOrderDetails = async function(orderId) {
    try {
        const result = await readData(`smartfit_AR_Database/transactions/${userId}/${orderId}`);
        if (result.success) {
            const order = result.data;
            order.orderId = orderId;
            const purchaseHistoryContainer = document.querySelector('.purchase-history');
            if (purchaseHistoryContainer) {
                purchaseHistoryContainer.innerHTML = '';
                displayOrderCard(order);
            }
        } else {
            console.error("Order not found:", orderId);
        }
    } catch (error) {
        console.error('Error displaying order details:', error);
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Mobile sidebar toggle (if applicable)
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

    // Initialize history page
    initializeHistory().catch(error => {
        console.error('Error initializing history page:', error);
        const purchaseHistoryContainer = document.querySelector('.purchase-history');
        if (purchaseHistoryContainer) {
            purchaseHistoryContainer.innerHTML = `
                <div class="empty-history">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Page</h3>
                    <p>Please try refreshing the page.</p>
                </div>
            `;
        }
    });
});