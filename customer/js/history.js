// history.js
import { 
    checkUserAuth, 
    logoutUser, 
    readDataRealtime,
    readData 
} from '../../firebaseMethods.js';

// Mobile sidebar toggle function
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

// Main function that runs when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Setup mobile menu first
        setupMobileMenu();
        
        // Check authentication state using firebaseMethods
        const authResult = await checkUserAuth();
        
        if (authResult.authenticated && authResult.role === 'customer') {
            // User is signed in, load their profile and orders
            await loadUserProfile(authResult.userId, authResult.userData);
            await loadOrderHistory(authResult.userId);

            // Set up event listeners
            setupEventListeners(authResult.userId);
        } else {
            // No user is signed in or not a customer, redirect to login
            window.location.href = "/user_login.html";
        }
    } catch (error) {
        console.error('Authentication error:', error);
        window.location.href = "/user_login.html";
    }
});

// Load user profile information using firebaseMethods
async function loadUserProfile(userId, userData = null) {
    try {
        let profileData = userData;
        
        // If userData not provided, fetch it
        if (!profileData) {
            const result = await readData(`smartfit_AR_Database/customers/${userId}`);
            if (result.success) {
                profileData = result.data;
            }
        }

        if (profileData) {
            // Update profile picture if available
            const profileImg = document.getElementById('imageProfile');
            if (profileImg && profileData.profilePhoto) {
                profileImg.src = profileData.profilePhoto;
            } else if (profileImg) {
                profileImg.src = "https://via.placeholder.com/150";
            }

            // Update username display
            const userNameDisplay = document.getElementById('userName_display2');
            if (userNameDisplay) {
                if (profileData.firstName && profileData.lastName) {
                    userNameDisplay.textContent = `${profileData.firstName} ${profileData.lastName}`;
                } else if (profileData.username) {
                    userNameDisplay.textContent = profileData.username;
                }
            }
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

// Load order history for the user using firebaseMethods
async function loadOrderHistory(userId, statusFilter = 'all') {
    try {
        const purchaseHistoryContainer = document.querySelector('.purchase-history');
        const ordersPath = `smartfit_AR_Database/transactions/${userId}`;

        // Use real-time listener for orders
        const unsubscribe = readDataRealtime(ordersPath, (result) => {
            if (result.success) {
                const ordersData = result.data;
                displayOrders(ordersData, userId, statusFilter);
            } else {
                // No orders found
                if (purchaseHistoryContainer) {
                    purchaseHistoryContainer.innerHTML = `
                        <div class="empty-history">
                            <i class="fas fa-box-open"></i>
                            <h3>No Orders Yet</h3>
                            <p>You haven't placed any orders yet. Start shopping to see your order history here.</p>
                            <a href="/customer/html/browse.html" class="btn-shop">Shop Now</a>
                        </div>
                    `;
                }
            }
        });

        // Store unsubscribe function for cleanup if needed
        return unsubscribe;
    } catch (error) {
        console.error('Error loading order history:', error);
    }
}

// Display orders in the container
function displayOrders(ordersData, userId, statusFilter = 'all') {
    const purchaseHistoryContainer = document.querySelector('.purchase-history');
    
    if (!purchaseHistoryContainer) return;

    // Clear existing content
    purchaseHistoryContainer.innerHTML = '';

    if (!ordersData || Object.keys(ordersData).length === 0) {
        purchaseHistoryContainer.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-box-open"></i>
                <h3>No Orders Yet</h3>
                <p>You haven't placed any orders yet. Start shopping to see your order history here.</p>
                <a href="/customer/html/browse.html" class="btn-shop">Shop Now</a>
            </div>
        `;
        return;
    }

    // Convert orders to array and sort by date (newest first)
    const orders = [];
    Object.keys(ordersData).forEach(orderId => {
        const order = ordersData[orderId];
        order.orderId = orderId;
        
        // Only include these statuses in history
        const status = order.status ? order.status.toLowerCase() : '';
        const historyStatuses = ['cancelled', 'rejected', 'completed'];
        
        if (historyStatuses.includes(status)) {
            orders.push(order);
        }
    });

    orders.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Filter orders based on status
    const filteredOrders = statusFilter === 'all'
        ? orders
        : orders.filter(order => order.status.toLowerCase() === statusFilter);

    if (filteredOrders.length === 0) {
        purchaseHistoryContainer.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-filter"></i>
                <h3>No Orders Match Your Filter</h3>
                <p>Try changing your filter criteria to see more orders.</p>
            </div>
        `;
        return;
    }

    // Display each order
    filteredOrders.forEach(order => {
        displayOrderCard(order, userId);
    });
}

// Display a single order card
function displayOrderCard(order, userId) {
    const purchaseHistoryContainer = document.querySelector('.purchase-history');
    if (!purchaseHistoryContainer) return;
    
    const status = order.status ? order.status.toLowerCase() : '';

    // Format date
    const orderDate = order.date ? new Date(order.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }) : 'Date not available';

    // Determine status class and text - only for cancelled, rejected, and completed
    let statusClass, statusText;
    switch (status) {
        case 'rejected':
            statusClass = 'status-rejected';
            statusText = 'Rejected by Shop';
            break;
        case 'cancelled':
            statusClass = 'status-cancelled';
            statusText = 'Cancelled';
            break;
        case 'completed':
            statusClass = 'status-completed';
            statusText = 'Completed';
            break;
        default:
            // This shouldn't happen since we filter before calling this function
            statusClass = 'status-default';
            statusText = order.status || 'Unknown Status';
    }

    // Get the item(s)
    const items = order.item ? [order.item] : (order.order_items ? Object.values(order.order_items) : []);
    
    // Generate HTML for each item
    const itemsHTML = items.map(item => `
        <div class="order-item">
            <img src="${item.imageUrl || 'https://via.placeholder.com/80'}" alt="Product" class="item-image">
            <div class="item-details">
                <div class="item-name">${item.name || 'Unknown Product'}</div>
                <div class="item-variant">Color: ${item.color || 'N/A'}, Size: ${item.size || 'N/A'}</div>
                <div class="item-price">₱${(item.price || 0).toFixed(2)}</div>
            </div>
            <div class="item-quantity">Qty: ${item.quantity || 1}</div>
        </div>
    `).join('');

    // Generate rejection info if order was rejected
    let rejectionHTML = '';
    if (status === 'rejected') {
        rejectionHTML = `
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
    } else if (status === 'cancelled') {
        rejectionHTML = `
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

    // Determine which buttons to show based on order status
    let actionButtons = '';
    if (status === 'completed') {
        actionButtons = `
            <button class="btn btn-reorder">Reorder</button>
            <button class="btn btn-review">Leave Review</button>
        `;
    } else if (status === 'rejected' || status === 'cancelled') {
        actionButtons = `
            <button class="btn btn-reorder">Find Similar</button>
        `;
    }

    // Create the order card HTML
    const orderCardHTML = `
        <div class="order-card" data-order-id="${order.orderId}">
            <div class="order-header">
                <div>
                    <span class="order-id">Order #${order.orderId}</span>
                    <span class="order-date"> - ${orderDate}</span>
                </div>
                <span class="order-status ${statusClass}">${statusText}</span>
            </div>
            <div class="order-body">
                <div class="order-items">
                    ${itemsHTML}
                </div>
                ${rejectionHTML}
            </div>
            <div class="order-footer">
                <div class="order-total">Total: ₱${(order.totalAmount || 0).toFixed(2)}</div>
                <div class="order-actions">
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;

    // Add the order card to the container
    purchaseHistoryContainer.insertAdjacentHTML('beforeend', orderCardHTML);
}

// Set up event listeners
function setupEventListeners(userId) {
    // Status filter change
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            loadOrderHistory(userId, e.target.value);
        });
    }

    // Time filter change
    const timeFilter = document.getElementById('timeFilter');
    if (timeFilter) {
        timeFilter.addEventListener('change', (e) => {
            console.log('Time filter changed to:', e.target.value);
            // You can implement time filtering logic here
        });
    }

    // Search functionality
    const searchInput = document.querySelector('.search-orders');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            console.log('Searching for:', e.target.value);
            // You can implement search functionality here
        });
    }

    // Logout functionality using firebaseMethods
    const logoutBtn = document.getElementById('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to logout?')) {
                logoutUser().then(() => {
                    window.location.href = '/user_login.html';
                }).catch((error) => {
                    console.error('Error signing out:', error);
                });
            }
        });
    }

    // Track order button click handler
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('btn-review')) {
            const orderCard = e.target.closest('.order-card');
            if (orderCard) {
                const orderId = orderCard.getAttribute('data-order-id');
                window.location.href = `/customer/html/feedback.html?orderId=${orderId}&userId=${userId}`;
            }
        }
        
        if (e.target.classList.contains('btn-reorder')) {
            const orderCard = e.target.closest('.order-card');
            if (orderCard) {
                const orderId = orderCard.getAttribute('data-order-id');
                // Implement reorder functionality
                console.log('Reorder order:', orderId);
                alert('Reorder functionality coming soon!');
            }
        }
    });
}

// Function to display order details when order ID is provided
window.displayOrderDetails = async function (orderId, userId) {
    try {
        const result = await readData(`smartfit_AR_Database/transactions/${userId}/${orderId}`);
        
        if (result.success) {
            const order = result.data;
            order.orderId = orderId;

            // Clear the container and display just this order
            const purchaseHistoryContainer = document.querySelector('.purchase-history');
            if (purchaseHistoryContainer) {
                purchaseHistoryContainer.innerHTML = '';
                displayOrderCard(order, userId);
            }
        } else {
            console.error("Order not found:", orderId);
        }
    } catch (error) {
        console.error('Error displaying order details:', error);
    }
};