import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getDatabase, ref, get, onValue, query, orderByChild, set } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAuPALylh11cTArigeGJZmLwrFwoAsNPSI",
    authDomain: "opportunity-9d3bf.firebaseapp.com",
    databaseURL: "https://opportunity-9d3bf-default-rtdb.firebaseio.com",
    projectId: "opportunity-9d3bf",
    storageBucket: "opportunity-9d3bf.appspot.com",
    messagingSenderId: "57906230058",
    appId: "1:57906230058:web:2d7cd9cc68354722536453",
    measurementId: "G-QC2JSR1FJW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

// Initialize the page when auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadUserProfile(user);
        loadOrders(user.uid);
    } else {
        window.location.href = "/user_login.html";
    }
});

function loadUserProfile(user) {
    get(ref(db, `AR_shoe_users/customer/${user.uid}`))
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                document.getElementById('userName_display2').textContent =
                    `${userData.firstName} ${userData.lastName}`;
                document.getElementById('imageProfile').src =
                    userData.profilePhoto?.profilePhoto?.url || "https://firebasestorage.googleapis.com/v0/b/opportunity-9d3bf.appspot.com/o/profile%2Fdefault_profile.png?alt=media&token=5f1a4b8c-7e6b-4f1c-8a2d-0e5f3b7c4a2e";
                document.body.style.display = '';
            } else {
                alert("Account does not exist");
                auth.signOut();
            }
        })
        .catch((error) => {
            console.error("Error loading user profile:", error);
        });
}

function loadOrders(userId) {
    const ordersRef = ref(db, `AR_shoe_users/transactions/${userId}`);
    const orderedQuery = query(ordersRef, orderByChild('date'));

    onValue(orderedQuery, (snapshot) => {
        const ordersContainer = document.querySelector('.purchase-history');
        ordersContainer.innerHTML = '';

        if (!snapshot.exists()) {
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

        // Process orders directly from snapshot
        const orders = [];
        snapshot.forEach((orderSnapshot) => {
            const orderData = orderSnapshot.val();
            orderData.id = orderSnapshot.key;
            orders.unshift(orderData); // Add to beginning to show newest first
        });

        // Load orders with serial numbers
        loadOrdersWithSerialNumbers(orders, ordersContainer);
        setupOrderFilters();
    }, (error) => {
        console.error("Error loading orders:", error);
        alert("Failed to load orders. Please try again.");
    });
}

async function loadOrdersWithSerialNumbers(orders, ordersContainer) {
    for (const order of orders) {
        const orderCard = await createOrderCard(order);
        if (orderCard) {
            ordersContainer.appendChild(orderCard);
        }
    }
}

async function createOrderCard(order) {
    if (!order) return null;

    const status = order.status.toLowerCase();

    // Only show these statuses
    const allowedStatuses = [
        'pending',
        'order processed', 
        'shipped', 
        'accepted',
        'in transit', 
        'arrived at facility', 
        'out for delivery', 
        'delivered',
        'other'
    ];
    
    // Skip if status is not in allowed list
    if (!allowedStatuses.includes(status)) return null;

    // Check if this order has a serial number
    let serialNumber = order.serialNumber;
    
    // If not found in order, check shoeVerification collection
    if (!serialNumber) {
        try {
            const serialNumberData = await getSerialNumberFromVerification(order.id);
            if (serialNumberData) {
                serialNumber = serialNumberData.serialNumber;
            }
        } catch (error) {
            console.log("No serial number found in verification collection:", error);
        }
    }

    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';
    orderCard.dataset.status = status;
    orderCard.dataset.orderId = order.id;
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

    let statusClass = '';
    let statusText = '';
    
    switch (status) {
        case 'pending':
            statusClass = 'status-pending';
            statusText = 'Pending';
            break;
        case 'accepted':
            statusClass = 'status-accepted';
            statusText = 'Accepted';
            break;
        case 'order processed':
            statusClass = 'status-processed';
            statusText = 'Order Processed';
            break;
        case 'shipped':
            statusClass = 'status-shipped';
            statusText = 'Shipped';
            break;
        case 'in transit':
            statusClass = 'status-transit';
            statusText = 'In Transit';
            break;
        case 'arrived at facility':
            statusClass = 'status-arrived';
            statusText = 'Arrived at Facility';
            break;
        case 'out for delivery':
            statusClass = 'status-out-for-delivery';
            statusText = 'Out for Delivery';
            break;
        case 'delivered':
            statusClass = 'status-delivered';
            statusText = 'Delivered';
            break;
        case 'other':
            statusClass = 'status-other';
            statusText = 'Other';
            break;
        default:
            return null;
    }

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

    let actionButtons = '';

    if (status === 'delivered') {
        actionButtons = `
            <button class="btn btn-received" onclick="markAsReceived('${order.id}')">
                <i class="fas fa-check"></i> Order Received
            </button>
            <button class="btn btn-issue" onclick="reportIssue('${order.id}')">
                <i class="fas fa-exclamation"></i> Report Issue
            </button>
            <button class="btn btn-track" onclick="trackOrder('${order.id}')">
                <i class="fas fa-truck"></i> Track Package
            </button>
        `;
        
        // Add validate button if serial number exists
        if (serialNumber) {
            actionButtons += `
                <button class="btn btn-verify" onclick="validateShoe('${serialNumber}')">
                    <i class="fas fa-check-circle"></i> Validate Shoe
                </button>
            `;
        }
    } else if (status === 'pending') {
        actionButtons = `
            <button class="btn btn-track" onclick="trackOrder('${order.id}')">
                <i class="fas fa-truck"></i> Track Package
            </button>
            <button class="btn btn-cancel" onclick="cancelOrder('${order.id}')">
                <i class="fas fa-times"></i> Cancel Order
            </button>
        `;
        
        // Add validate button if serial number exists (even for pending orders)
        if (serialNumber) {
            actionButtons += `
                <button class="btn btn-verify" onclick="validateShoe('${serialNumber}')">
                    <i class="fas fa-check-circle"></i> Validate Shoe
                </button>
            `;
        }
    } else if (status === 'shipped' || status === 'in transit' || status === 'arrived at facility' || status === 'out for delivery' || status === 'accepted') { // tanggalin lang yung status accepted pag gusto i cancel
        actionButtons = `
            <button class="btn btn-track" onclick="trackOrder('${order.id}')">
                <i class="fas fa-truck"></i> Track Package
            </button>
        `;
        
        // Add validate button if serial number exists (even for pending orders)
        if (serialNumber) {
            actionButtons += `
                <button class="btn btn-verify" onclick="validateShoe('${serialNumber}')">
                    <i class="fas fa-check-circle"></i> Validate Shoe
                </button>
            `;
        }
    } else {
        actionButtons = `
            <button class="btn btn-track" onclick="trackOrder('${order.id}')">
                <i class="fas fa-truck"></i> Track Package
            </button>
            <button class="btn btn-cancel" onclick="cancelOrder('${order.id}')">
                <i class="fas fa-times"></i> Cancel Order
            </button>
        `;
        
        // Add validate button if serial number exists
        if (serialNumber) {
            actionButtons += `
                <button class="btn btn-verify" onclick="validateShoe('${serialNumber}')">
                    <i class="fas fa-check-circle"></i> Validate Shoe
                </button>
            `;
        }
    }

    orderCard.innerHTML = `
        <div class="order-header">
            <div>
                <span class="order-id">Order #${(order.id || '').substring(0, 8).toUpperCase()}</span>
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

async function getSerialNumberFromVerification(orderId) {
    try {
        const verificationRef = ref(db, 'AR_shoe_users/shoeVerification');
        const snapshot = await get(verificationRef);
        
        if (!snapshot.exists()) return null;
        
        const allVerifications = snapshot.val();
        
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

function setupOrderFilters() {
    const filterSelect = document.getElementById('activeFilter');
    const searchInput = document.querySelector('.search-orders');

    if (filterSelect) {
        filterSelect.addEventListener('change', filterOrders);
    }
    if (searchInput) {
        searchInput.addEventListener('input', searchOrders);
    }
}

function filterOrders() {
    const filterValue = document.getElementById('activeFilter')?.value;
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

window.cancelOrder = async function (orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
        // First get the order details
        const orderRef = ref(db, `AR_shoe_users/transactions/${user.uid}/${orderId}`);
        const orderSnapshot = await get(orderRef);

        if (!orderSnapshot.exists()) {
            alert('Order not found');
            return;
        }

        const order = orderSnapshot.val();

        // Update order status to cancelled
        await set(ref(db, `AR_shoe_users/transactions/${user.uid}/${orderId}/status`), 'cancelled');

        // Restore stock quantity if the order is not already cancelled
        if (order.status !== 'cancelled' && order.item) {
            const { shopId, shoeId, variantKey, sizeKey, quantity } = order.item;

            if (shopId && shoeId && variantKey && sizeKey && quantity) {
                // Get current stock
                const stockRef = ref(db, `AR_shoe_users/shoe/${shopId}/${shoeId}/variants/${variantKey}/sizes/${sizeKey}`);
                const stockSnapshot = await get(stockRef);

                if (stockSnapshot.exists()) {
                    const sizeData = stockSnapshot.val();
                    const sizeValue = Object.keys(sizeData)[0]; // Get the size value (e.g., "7")
                    const currentStock = sizeData[sizeValue].stock;
                    const newStock = currentStock + quantity;

                    // Update stock in database
                    await set(ref(db, `AR_shoe_users/shoe/${shopId}/${shoeId}/variants/${variantKey}/sizes/${sizeKey}/${sizeValue}/stock`), newStock);
                }
            }
        }

        alert('Order has been cancelled successfully and stock has been restored.');
    } catch (error) {
        console.error('Error cancelling order:', error);
        alert('Failed to cancel order. Please try again.');
    }
};

window.contactSeller = function (shopId) {
    alert(`Redirecting to chat with shop ID: ${shopId}`);
};

window.trackOrder = function(orderId) {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = "/user_login.html";
        return;
    }
    window.location.href = `/customer/html/track.html?orderId=${orderId}&userId=${user.uid}`;
};

window.startReturn = function (orderId) {
    alert(`Starting return for order: ${orderId}`);
};

window.leaveReview = function (shopId, productId) {
    alert(`Leaving review for product: ${productId} from shop: ${shopId}`);
};

// Validate shoe function - redirects to shoe validator with serial number
window.validateShoe = function(serialNumber) {
    window.location.href = `http://april22.vercel.app/customer/html/shoevalidator.html?ShoeSerialNumber=${encodeURIComponent(serialNumber)}`;
};

// Logout functionality
document.getElementById('logout_btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        auth.signOut().then(() => {
            window.location.href = '/user_login.html';
        }).catch((error) => {
            console.error('Error signing out:', error);
        });
    }
});

// Mark order as received (completed)
window.markAsReceived = async function(orderId) {
    if (!confirm('Confirm you have received this order in good condition?')) return;
    
    const user = auth.currentUser;
    if (!user) return;

    try {
        await set(ref(db, `AR_shoe_users/transactions/${user.uid}/${orderId}/status`), 'completed');
        alert('Order marked as received successfully!');
        // Refresh the orders list
        loadOrders(user.uid);
    } catch (error) {
        console.error('Error marking order as received:', error);
        alert('Failed to update order status. Please try again.');
    }
};

// Report issue with order
window.reportIssue = function(orderId) {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = "/user_login.html";
        return;
    }
    window.location.href = `/customer/html/reportIssue.html?orderID=${orderId}&userID=${user.uid}`;
};