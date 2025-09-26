import { 
    checkUserAuth, 
    logoutUser,
    updateOrderStatus,
    readDataRealtime,
    readData,
    getOrders
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
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
    getElement('userFullname').textContent = user.userData.ownerName || user.userData.name || 'Shop Owner';
    
    // Set shop ID based on user role
    shopLoggedin = user.shopId || user.userId;
    
    // Set profile picture
    const profilePicture = getElement('profilePicture');
    if (user.userData.profilePhoto && user.userData.profilePhoto.url) {
        profilePicture.src = user.userData.profilePhoto.url;
    } else if (user.userData.uploads && user.userData.uploads.shopLogo && user.userData.uploads.shopLogo.url) {
        profilePicture.src = user.userData.uploads.shopLogo.url;
    } else {
        profilePicture.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }

    // Hide/show menu items based on role
    if (user.role === 'employee') {
        if (user.userData.role.toLowerCase() === "manager") {
            getElement("addemployeebtn").style.display = "none";
        } else if (user.userData.role.toLowerCase() === "salesperson") {
            getElement("addemployeebtn").style.display = "none";
            getElement("analyticsbtn").style.display = "none";
            getElement("issuereport").style.display = "none";
        }
    }

    // Load orders
    loadOrders();
}

// Load orders with filtering
async function loadOrders() {
    try {
        const statusFilter = getElement('statusFilter').value;
        const filters = statusFilter !== 'all' ? { status: statusFilter } : {};
        
        const ordersResult = await getOrders(shopLoggedin, filters);
        
        if (!ordersResult.success) {
            console.error("Error loading orders:", ordersResult.error);
            return;
        }

        console.log("Orders loaded:", ordersResult.data);
        displayOrders(ordersResult.data);
    } catch (error) {
        console.error("Error loading orders:", error);
    }
}

// Display orders in the table
function displayOrders(orders) {
    const tbody = getElement('ordersTableBody');
    const emptyState = getElement('emptyState');
    
    if (orders.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'table-row';
        return;
    }
    
    emptyState.style.display = 'none';
    tbody.innerHTML = orders.map(order => createOrderRow(order)).join('');
}

// Create order row HTML
function createOrderRow(order) {
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
    const statusClass = status === 'completed' ? 'shipped' :
        status === 'processing' ? 'pending' :
            status === 'cancelled' ? 'cancelled' : 'pending';

    // Action buttons based on status
    let actionButtons = '';
    if (status === 'pending') {
        actionButtons = `
            <button class="btn btn-accept" onclick="showAcceptModal('${order.orderId}', '${order.userId}')">
                <i class="fas fa-check"></i> Accept
            </button>
            <button class="btn btn-reject" onclick="showRejectModal('${order.orderId}', '${order.userId}')">
                <i class="fas fa-times"></i> Reject
            </button>
        `;
    } else if (status === 'rejected' || status === 'cancelled') {
        actionButtons = `<span class="no-actions">No actions available</span>`;
    } else if (status === 'completed' || status === 'delivered') {
        actionButtons = `
            <button class="btn btn-track" onclick="trackOrder('${order.orderId}', '${order.userId}')">
                <i class="fas fa-eye"></i> View Details
            </button>
        `;
    } else {
        actionButtons = `
            <button class="btn btn-track" onclick="trackOrder('${order.orderId}', '${order.userId}')">
                <i class="fas fa-plus"></i> Add Track Status
            </button>
        `;
    }

    return `
        <tr>
            <td>#${order.orderId}</td>
            <td>${customerName}</td>
            <td>${orderDate}</td>
            <td>${amount}</td>
            <td><span class="status ${statusClass}">${status}</span></td>
            <td class="actions">${actionButtons}</td>
        </tr>
    `;
}

// Show accept modal
window.showAcceptModal = function(orderId, userId) {
    const modal = getElement('acceptModal');
    if (!modal) return;

    currentOrderId = orderId;
    currentUserId = userId;

    // Clear previous input
    getElement('serialNumber').value = '';
    modal.style.display = 'block';
};

// Accept order function with serial number
window.acceptOrder = async function() {
    const serialNumber = getElement('serialNumber').value.trim();

    if (!serialNumber) {
        alert('Please enter a serial number');
        return;
    }

    try {
        const result = await updateOrderStatus(currentUserId, currentOrderId, 'accepted', {
            serialNumber: serialNumber
        });

        if (result.success) {
            getElement('acceptModal').style.display = 'none';
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
    const reason = getElement('rejectionReason').value.trim();
    if (!reason) {
        alert('Please provide a reason for rejection');
        return;
    }

    try {
        const result = await updateOrderStatus(currentUserId, currentOrderId, 'rejected', {
            rejectionReason: reason
        });

        if (result.success) {
            getElement('rejectionReason').value = '';
            getElement('rejectModal').style.display = 'none';
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
document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    initializeDashboard();

    // Mobile sidebar toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });

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
            rejectModal.style.display = 'none';
        });
    }

    if (closeRejectModalBtn) {
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

    if (cancelAcceptBtn) {
        cancelAcceptBtn.addEventListener('click', () => {
            acceptModal.style.display = 'none';
        });
    }

    if (closeAcceptModalBtn) {
        closeAcceptModalBtn.addEventListener('click', () => {
            acceptModal.style.display = 'none';
        });
    }

    // Close modals when clicking outside of them
    window.addEventListener('click', (event) => {
        if (event.target === rejectModal) {
            rejectModal.style.display = 'none';
        }
        if (event.target === acceptModal) {
            acceptModal.style.display = 'none';
        }
    });

    // Logout functionality
    getElement('logout_btn').addEventListener('click', async function() {
        if (confirm('Are you sure you want to logout?')) {
            const result = await logoutUser();
            if (result.success) {
                window.location.href = '/login.html';
            } else {
                console.error('Error signing out:', result.error);
            }
        }
    });
});