import { 
    checkUserAuth, 
    logoutUser,
    updateOrderStatus,
    readDataRealtime,
    readData,
    getOrders
} from "../../firebaseMethods.js";

// Helper function to get DOM elements with null check
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id '${id}' not found`);
    }
    return element;
}

let shopLoggedin;
let currentOrderId = null;
let currentUserId = null;

// Authentication and initialization
async function initializeDashboard() {
    const user = await checkUserAuth();
    
    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }
    
    if (user.userData.status === 'rejected') {
        window.location.href = "/shopowner/html/shop_rejected.html";
        return;
    }
    
    if (user.userData.status === 'pending') {
        window.location.href = "/shopowner/html/shop_pending.html";
        return;
    }

    console.log(`User is ${user.role}`, user.userData);
    
    // Set user information
    const userFullname = getElement('userFullname');
    if (userFullname) {
        userFullname.textContent = user.userData.ownerName || user.userData.name || 'Shop Owner';
    }
    
    // Set shop ID based on user role
    shopLoggedin = user.shopId || user.userId;
    
    // Set profile picture
    const profilePicture = getElement('profilePicture');
    if (profilePicture) {
        if (user.userData.profilePhoto && user.userData.profilePhoto.url) {
            profilePicture.src = user.userData.profilePhoto.url;
        } else if (user.userData.uploads && user.userData.uploads.shopLogo && user.userData.uploads.shopLogo.url) {
            profilePicture.src = user.userData.uploads.shopLogo.url;
        } else {
            profilePicture.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        }
    }

    // Hide/show menu items based on role
    if (user.role.toLowerCase() === "customer") {
        window.location.href = "../../customer/html/customer_dashboard.html";
    }
    if (user.role === 'employee') {
        const addEmployeeBtn = getElement('addemployeebtn');
        const analyticsBtn = getElement('analyticsbtn');
        const issueReport = getElement('issuereport');

        if (user.userData.role.toLowerCase() === "manager" && addEmployeeBtn) {
            addEmployeeBtn.style.display = "none";
        } else if (user.userData.role.toLowerCase() === "salesperson") {
            if (addEmployeeBtn) addEmployeeBtn.style.display = "none";
            if (analyticsBtn) analyticsBtn.style.display = "none";
            if (issueReport) issueReport.style.display = "none";
        }
    }
}

// Load orders with filtering
async function loadOrders() {
    try {
        const statusFilter = getElement('statusFilter');
        const filterValue = statusFilter ? statusFilter.value : 'all';
        const filters = filterValue !== 'all' ? { status: filterValue } : {};
        
        const ordersResult = await getOrders(shopLoggedin, filters);
        
        if (!ordersResult.success) {
            console.error("Error loading orders:", ordersResult.error);
            showErrorState("Failed to load orders. Please try again.");
            return;
        }

        displayOrders(ordersResult.data || []);
    } catch (error) {
        console.error("Error loading orders:", error);
        showErrorState("Error loading orders. Please try again.");
    }
}

// Display orders in the table
function displayOrders(orders) {
    const tbody = getElement('ordersTableBody');
    const emptyState = document.getElementById('emptyState'); // safer direct call
    
    if (!tbody) return;

    tbody.innerHTML = '';

    if (orders.length === 0) {
        if (emptyState) {
            emptyState.style.display = 'table-row';
        } else {
            console.error("Empty state row not found in DOM");
        }
        return;
    }

    if (emptyState) {
        emptyState.style.display = 'none';
    }

    orders.forEach(order => {
        const row = createOrderRow(order);
        if (row) tbody.appendChild(row);
    });
}


// Show error state
function showErrorState(message) {
    const tbody = getElement('ordersTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="error-state">
                    <div class="error-state-content">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error Loading Orders</h3>
                        <p>${message}</p>
                        <button onclick="loadOrders()" class="btn btn-retry">
                            <i class="fas fa-redo"></i> Try Again
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Create order row HTML
function createOrderRow(order) {
    if (!order) return null;

    const customerName = order.shippingInfo ?
        `${order.shippingInfo.firstName} ${order.shippingInfo.lastName}` :
        'Unknown Customer';

    const orderDate = new Date(order.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    const amount = order.totalAmount ?
        `₱${order.totalAmount.toFixed(2)}` : '₱0.00';

    const status = order.status || 'pending';
    const statusClass = getStatusClass(status);

    // Action buttons based on status
    const actionButtons = generateActionButtons(status, order.orderId, order.userId);

    const row = document.createElement('tr');
    row.innerHTML = `
        <td>#${order.orderId || 'N/A'}</td>
        <td>${customerName}</td>
        <td>${orderDate}</td>
        <td>${amount}</td>
        <td><span class="status ${statusClass}">${status}</span></td>
        <td class="actions">${actionButtons}</td>
    `;

    return row;
}

// Get status class based on status
function getStatusClass(status) {
    const statusMap = {
        'completed': 'shipped',
        'processing': 'pending',
        'cancelled': 'cancelled',
        'delivered': 'shipped',
        'accepted': 'shipped'
    };
    return statusMap[status] || 'pending';
}

// Generate action buttons based on status
function generateActionButtons(status, orderId, userId) {
    if (status === 'pending') {
        return `
            <button class="btn btn-accept" onclick="showAcceptModal('${orderId}', '${userId}')">
                <i class="fas fa-check"></i> Accept
            </button>
            <button class="btn btn-reject" onclick="showRejectModal('${orderId}', '${userId}')">
                <i class="fas fa-times"></i> Reject
            </button>
        `;
    } else if (status === 'rejected' || status === 'cancelled') {
        return `<span class="no-actions">No actions available</span>`;
    } else if (status === 'completed' || status === 'delivered') {
        return `
            <button class="btn btn-track" onclick="trackOrder('${orderId}', '${userId}')">
                <i class="fas fa-eye"></i> View Details
            </button>
        `;
    } else {
        return `
            <button class="btn btn-track" onclick="trackOrder('${orderId}', '${userId}')">
                <i class="fas fa-plus"></i> Add Track Status
            </button>
        `;
    }
}

// Show accept modal
window.showAcceptModal = function(orderId, userId) {
    const modal = getElement('acceptModal');
    if (!modal) return;

    currentOrderId = orderId;
    currentUserId = userId;

    // Clear previous input
    const serialNumberInput = getElement('serialNumber');
    if (serialNumberInput) {
        serialNumberInput.value = '';
    }

    modal.style.display = 'block';
};

// Accept order function with serial number
window.acceptOrder = async function() {
    const serialNumberInput = getElement('serialNumber');
    if (!serialNumberInput) return;

    const serialNumber = serialNumberInput.value.trim();

    if (!serialNumber) {
        alert('Please enter a serial number');
        return;
    }

    try {
        const result = await updateOrderStatus(currentUserId, currentOrderId, 'accepted', {
            serialNumber: serialNumber
        });

        if (result.success) {
            const modal = getElement('acceptModal');
            if (modal) modal.style.display = 'none';
            alert('Order accepted successfully with serial number: ' + serialNumber);
            loadOrders(); // Refresh the orders list
        } else {
            alert("Failed to accept order: " + result.error);
        }
    } catch (error) {
        console.error("Error accepting order:", error);
        alert("Failed to accept order");
    }
};

// Show reject modal
window.showRejectModal = function(orderId, userId) {
    const modal = getElement('rejectModal');
    if (!modal) return;

    currentOrderId = orderId;
    currentUserId = userId;
    modal.style.display = 'block';
};

// Track order function
window.trackOrder = function(orderId, userId) {
    window.location.href = `trackform.html?orderID=${orderId}&userID=${userId}`;
};

// Reject order function
window.rejectOrder = async function() {
    const rejectionReasonInput = getElement('rejectionReason');
    if (!rejectionReasonInput) return;

    const reason = rejectionReasonInput.value.trim();
    if (!reason) {
        alert('Please provide a reason for rejection');
        return;
    }

    try {
        const result = await updateOrderStatus(currentUserId, currentOrderId, 'rejected', {
            rejectionReason: reason
        });

        if (result.success) {
            rejectionReasonInput.value = '';
            const modal = getElement('rejectModal');
            if (modal) modal.style.display = 'none';
            alert('Order rejected successfully');
            loadOrders(); // Refresh the orders list
        } else {
            alert("Failed to reject order: " + result.error);
        }
    } catch (error) {
        console.error("Error rejecting order:", error);
        alert("Failed to reject order");
    }
};

// Event listeners and initialization
document.addEventListener('DOMContentLoaded', async function() {
    await initializeDashboard();
    loadOrders(); 


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

    // Status filter change
    const statusFilter = getElement('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', loadOrders);
    }

    // Reject modal buttons
    const confirmRejectBtn = getElement('confirmRejectBtn');
    const cancelRejectBtn = getElement('cancelRejectBtn');
    const closeRejectModalBtn = document.querySelector('.close-modal');
    const rejectModal = getElement('rejectModal');

    if (confirmRejectBtn) {
        confirmRejectBtn.addEventListener('click', rejectOrder);
    }

    if (cancelRejectBtn) {
        cancelRejectBtn.addEventListener('click', () => {
            if (rejectModal) rejectModal.style.display = 'none';
        });
    }

    if (closeRejectModalBtn && rejectModal) {
        closeRejectModalBtn.addEventListener('click', () => {
            rejectModal.style.display = 'none';
        });
    }

    // Accept modal buttons
    const confirmAcceptBtn = getElement('confirmAcceptBtn');
    const cancelAcceptBtn = getElement('cancelAcceptBtn');
    const closeAcceptModalBtn = document.querySelector('.close-modal-accept');
    const acceptModal = getElement('acceptModal');

    if (confirmAcceptBtn) {
        confirmAcceptBtn.addEventListener('click', acceptOrder);
    }

    if (cancelAcceptBtn && acceptModal) {
        cancelAcceptBtn.addEventListener('click', () => {
            acceptModal.style.display = 'none';
        });
    }

    if (closeAcceptModalBtn && acceptModal) {
        closeAcceptModalBtn.addEventListener('click', () => {
            acceptModal.style.display = 'none';
        });
    }

    // Close modals when clicking outside of them
    window.addEventListener('click', (event) => {
        const rejectModal = getElement('rejectModal');
        const acceptModal = getElement('acceptModal');

        if (rejectModal && event.target === rejectModal) {
            rejectModal.style.display = 'none';
        }
        if (acceptModal && event.target === acceptModal) {
            acceptModal.style.display = 'none';
        }
    });

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
});