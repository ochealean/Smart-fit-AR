import {
    checkUserAuth,
    logoutUser,
    updateOrderStatus,
    readDataRealtime,
    readData
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
    if (user.role.toLowerCase() === "customer") {
        window.location.href = "../../customer/html/customer_dashboard.html";
    }
    else if (user.role === 'employee') {
        if (user.userData.role.toLowerCase() === "manager") {
            getElement("addemployeebtn").style.display = "none";
        } else if (user.userData.role.toLowerCase() === "salesperson") {
            getElement("addemployeebtn").style.display = "none";
            getElement("analyticsbtn").style.display = "none";
            getElement("issuereport").style.display = "none";
        }
    }

    // Load dashboard data
    loadDashboardData();
}

// Load all dashboard data
async function loadDashboardData() {
    loadShopStats();
    loadRecentOrders();
    loadRecentProducts();
    loadTopProducts(); // Add await here
}

// Load shop statistics
function loadShopStats() {
    const productsPath = `smartfit_AR_Database/shoe/${shopLoggedin}`;

    const unsubscribe = readDataRealtime(productsPath, (result) => {
        if (!result.success) {
            getElement('totalProducts').textContent = '0';
            return;
        }

        const products = result.data;
        let totalProducts = 0;
        let outOfStockCount = 0;

        if (products) {
            totalProducts = Object.keys(products).length;

            // Count out of stock products
            Object.values(products).forEach(product => {
                if (product.variants) {
                    const variants = Array.isArray(product.variants) ?
                        product.variants : Object.values(product.variants);

                    variants.forEach(variant => {
                        if (variant.sizes) {
                            const sizes = Array.isArray(variant.sizes) ?
                                variant.sizes : Object.values(variant.sizes);

                            const hasStock = sizes.some(size =>
                                size.stock && parseInt(size.stock) > 0
                            );

                            if (!hasStock) {
                                outOfStockCount++;
                            }
                        }
                    });
                }
            });
        }

        getElement('totalProducts').textContent = totalProducts.toString();

        const changeElement = getElement('productsChange');
        const changeText = getElement('productsChangeText');

        if (outOfStockCount > 0) {
            changeElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            changeText.textContent = `${outOfStockCount} out of stock`;
            changeElement.className = 'change warning';
        } else {
            changeElement.innerHTML = '<i class="fas fa-check-circle"></i>';
            changeText.textContent = 'All products in stock';
            changeElement.className = 'change success';
        }
    });

    // Return unsubscribe function for cleanup if needed
    return unsubscribe;
}

// Load recent orders
function loadRecentOrders() {
    const ordersTableBody = getElement('ordersTableBody');

    // Use real-time listener for orders
    const ordersRef = 'smartfit_AR_Database/transactions';
    const unsubscribe = readDataRealtime(ordersRef, async (result) => {
        if (!result.success || !result.data) {
            displayEmptyOrders();
            return;
        }

        const orders = [];
        const transactions = result.data;

        // Process transactions to extract orders for this shop
        for (const userId in transactions) {
            const userOrders = transactions[userId];
            for (const orderId in userOrders) {
                const order = userOrders[orderId];
                const items = order.order_items ?
                    Object.values(order.order_items) :
                    (order.item ? [order.item] : []);

                // Check if any item belongs to this shop
                if (items.some(item => item.shopId === shopLoggedin)) {
                    orders.push({
                        ...order,
                        orderId: orderId,
                        userId: userId
                    });
                }
            }
        }

        // Sort by date (newest first) and get recent 5
        const recentOrders = orders.sort((a, b) =>
            new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
        ).slice(0, 5);

        displayRecentOrders(recentOrders);
    });

    return unsubscribe;
}

// Display recent orders in table
function displayRecentOrders(orders) {
    const ordersTableBody = getElement('ordersTableBody');

    if (orders.length === 0) {
        displayEmptyOrders();
        return;
    }

    ordersTableBody.innerHTML = orders.map(order => {
        const customerName = order.shippingInfo ?
            `${order.shippingInfo.firstName} ${order.shippingInfo.lastName}` :
            'Unknown Customer';

        const orderDate = new Date(order.date || order.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const amount = order.totalAmount ?
            `₱${order.totalAmount.toFixed(2)}` : '₱0.00';

        const status = order.status || 'pending';
        const statusClass = status === 'completed' ? 'shipped' :
            status === 'processing' ? 'pending' :
                status === 'cancelled' ? 'cancelled' :
                    status === 'accepted' ? 'accepted' : 'pending';

        return `
            <tr>
                <td>#${order.orderId}</td>
                <td>${customerName}</td>
                <td>${orderDate}</td>
                <td>${amount}</td>
                <td><span class="status ${statusClass}">${status}</span></td>
                <td>
                    <button class="btn btn-view" onclick="viewOrderDetails('${order.orderId}', '${order.userId}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Display empty orders state
function displayEmptyOrders() {
    const ordersTableBody = getElement('ordersTableBody');
    ordersTableBody.innerHTML = `
        <tr>
            <td colspan="6">
                <div class="empty-state" style="grid-column: 1 / -1; min-height: 200px;">
                    <i class="fas fa-shopping-bag"></i>
                    <h3>No Orders Yet</h3>
                    <p>When customers place orders, they'll appear here</p>
                    <a href="/shopowner/html/shopowner_addshoe.html" class="btn">
                        <i class="fas fa-plus"></i> Add shoe to start selling
                    </a>
                </div>
            </td>
        </tr>
    `;
}

// Load recent products
function loadRecentProducts() {
    const productsPath = `smartfit_AR_Database/shoe/${shopLoggedin}`;
    const recentAddedContainer = getElement('recentAdded');

    const unsubscribe = readDataRealtime(productsPath, (result) => {
        if (!result.success || !result.data) {
            displayEmptyRecentProducts();
            return;
        }

        const products = result.data;
        const productArray = Object.keys(products).map(key => ({
            id: key,
            ...products[key]
        }));

        const recentProducts = productArray
            .sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0))
            .slice(0, 4);

        displayProductsGrid(recentProducts, recentAddedContainer, 'recent');
    });

    return unsubscribe;
}

// Load top products based on ratings
async function loadTopProducts() {
    const topProductsGrid = getElement('topProductsGrid');

    const productsPath = `smartfit_AR_Database/shoe/${shopLoggedin}`;

    const unsubscribe = readDataRealtime(productsPath, async (result) => {
        if (!result.success || !result.data) {
            displayEmptyTopProducts();
            return;
        }

        console.log(result);
        const products = result.data;
        const productArray = Object.keys(products).map(key => ({
            pathID: key,
            ...products[key]
        }));

        // Get ratings for each product
        const productsWithRatings = await Promise.all(
            productArray.map(async (product) => {
                console.log(product);
                const ratings = await getProductRatings(product.pathID);
                console.log(product);
                return {
                    ...product,
                    averageRating: ratings.averageRating,
                    reviewCount: ratings.reviewCount
                };
            })
        );

        // Sort by rating and get top 4
        const featuredProducts = productsWithRatings
            .sort((a, b) => b.averageRating - a.averageRating)
            .slice(0, 4);

        displayProductsGrid(featuredProducts, topProductsGrid, 'top');
    });

    return unsubscribe;
}

// Display products in grid
function displayProductsGrid(products, container, type) {
    if (!container) return;

    if (products.length === 0) {
        if (type === 'top') {
            displayEmptyTopProducts();
        } else {
            displayEmptyRecentProducts();
        }
        return;
    }

    const html = products.map(product => {
        const variants = product.variants ?
            (Array.isArray(product.variants) ?
                product.variants :
                Object.values(product.variants)) :
            [];

        const firstVariant = variants[0] || null;
        const price = firstVariant ? `₱${firstVariant.price}` : '₱0.00';

        const colors = [...new Set(variants.map(v => v.color))];
        const colorText = colors.length > 0 ? colors.join(', ') : 'No color';

        const imageUrl = product.defaultImage || (firstVariant ? firstVariant.imageUrl : null);

        // Use actual ratings data
        const averageRating = product.averageRating || 0;
        const reviewCount = product.reviewCount || 0;

        const badgeHtml = type === 'top' && averageRating > 0 ?
            `<div class="product-badge">
                ${averageRating} <i class="fas fa-star"></i>
            </div>` : '';

        return `
            <div class="product-card">
                <div class="product-image">
                    ${imageUrl ?
                `<img src="${imageUrl}" alt="${product.shoeName}" class="shoe-thumbnail">` :
                '<div class="no-image">No Image</div>'
            }
                    ${badgeHtml}
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.shoeName || 'No Name'}</h3>
                    <div class="product-meta">
                        <span class="product-brand">${product.shoeBrand || 'No Brand'}</span>
                        <span class="product-type">${product.shoeType || 'No Type'}</span>
                    </div>
                    <div class="product-code">Code: ${product.shoeCode || 'N/A'}</div>
                    <div class="product-price">${price}</div>
                    <div class="product-color">Colors: ${colorText}</div>
                    ${type === 'top' ? `
                        <div class="product-stats">
                            <div class="product-stat">
                                <i class="fas fa-star"></i> 
                                ${averageRating > 0 ?
                    `${averageRating} (${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})` :
                    'No reviews yet'
                }
                            </div>
                        </div>
                    ` : ''}
                    <button class="btn btn-view" onclick="viewShoeDetails('${product.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// Function to calculate product ratings from feedback
async function getProductRatings(shoeId) {
    console.log(shoeId);
    try {
        const feedbacksPath = `smartfit_AR_Database/feedbacks`;
        console.log(feedbacksPath);
        const result = await readData(feedbacksPath);

        if (!result.success || !result.data) {
            return { averageRating: 0, reviewCount: 0 };
        }

        console.log(result);

        let totalRating = 0;
        let reviewCount = 0;
        const feedbacks = result.data;

        Object.entries(feedbacks).forEach(([outerKey, innerObj]) => {
            Object.entries(innerObj).forEach(([innerKey, value]) => {
                if (value.shoeID === shoeId) {
                    reviewCount++;
                    totalRating += value.rating;
                    console.log(reviewCount);
                }
            });
        });

        const averageRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : 0;

        console.log(averageRating);
        return {
            averageRating: parseFloat(averageRating),
            reviewCount: reviewCount
        };
    } catch (error) {
        console.error("Error calculating ratings:", error);
        return { averageRating: 0, reviewCount: 0 };
    }
}

// Display empty state for top products
function displayEmptyTopProducts() {
    const topProductsGrid = getElement('topProductsGrid');
    topProductsGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-shoe-prints"></i>
            <h3>No Products Added</h3>
            <p>Start by adding your first product to showcase in your store</p>
            <a href="/shopowner/html/shopowner_addshoe.html" class="btn">
                <i class="fas fa-plus"></i> Add First Product
            </a>
        </div>
    `;
}

// Display empty state for recent products
function displayEmptyRecentProducts() {
    const recentAdded = getElement('recentAdded');
    recentAdded.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-shoe-prints"></i>
            <h3>No Recent Additions</h3>
            <p>New products you add will appear here</p>
            <a href="/shopowner/html/shopowner_addshoe.html" class="btn">
                <i class="fas fa-plus"></i> Add Another Product
            </a>
        </div>
    `;
}

// View order details
async function viewOrderDetails(orderId, userId) {
    currentOrderId = orderId;
    currentUserId = userId;

    try {
        const orderPath = `smartfit_AR_Database/transactions/${userId}/${orderId}`;
        const result = await readData(orderPath);

        if (!result.success) {
            alert('Order not found');
            return;
        }

        const order = result.data;
        displayOrderModal(order);
    } catch (error) {
        console.error("Error fetching order:", error);
        alert("Error loading order details");
    }
}

// Display order modal
function displayOrderModal(order) {
    const modalContent = getElement('orderDetailsContent');
    const orderDate = new Date(order.date || order.createdAt).toLocaleString();

    const items = order.order_items ? Object.values(order.order_items) :
        order.item ? [order.item] : [];

    const itemsHtml = items.map(item => `
        <div class="order-item">
            <img src="${item.imageUrl || 'https://via.placeholder.com/150'}" 
                 alt="${item.name}" class="order-item-image">
            <div class="order-item-details">
                <div class="order-item-title">${item.name}</div>
                <div class="order-item-variant">${item.variantName} (${item.color}) - Size: ${item.size}</div>
                <div>Quantity: ${item.quantity}</div>
                <div class="order-item-price">₱${(item.price * item.quantity).toFixed(2)}</div>
            </div>
        </div>
    `).join('');

    modalContent.innerHTML = `
        <div class="order-details-grid">
            <div>
                <div class="order-details-section">
                    <h3>Order Information</h3>
                    <p><strong>Order ID:</strong> ${order.orderId || currentOrderId}</p>
                    <p><strong>Date:</strong> ${orderDate}</p>
                    <p><strong>Status:</strong> <span class="status ${order.status}">${order.status}</span></p>
                    <p><strong>Total:</strong> ₱${order.totalAmount?.toFixed(2) || '0.00'}</p>
                </div>
                
                <div class="order-details-section">
                    <h3>Shipping Information</h3>
                    <p><strong>Name:</strong> ${order.shippingInfo?.firstName || 'N/A'} ${order.shippingInfo?.lastName || ''}</p>
                    <p><strong>Address:</strong> ${order.shippingInfo?.address || 'N/A'}, ${order.shippingInfo?.city || 'N/A'}</p>
                    <p><strong>Country:</strong> ${order.shippingInfo?.country || 'N/A'}</p>
                    <p><strong>ZIP:</strong> ${order.shippingInfo?.zip || 'N/A'}</p>
                    <p><strong>Phone:</strong> ${order.shippingInfo?.phone || 'N/A'}</p>
                    <p><strong>Email:</strong> ${order.shippingInfo?.email || 'N/A'}</p>
                </div>
            </div>
            
            <div>
                <div class="order-details-section">
                    <h3>Order Items</h3>
                    ${itemsHtml}
                </div>
            </div>
        </div>
    `;

    const acceptBtn = getElement('acceptOrderBtn');
    const rejectBtn = getElement('rejectOrderBtn');
    const trackBtn = getElement('trackOrderBtn');

    if (order.status === 'pending') {
        acceptBtn.style.display = 'inline-block';
        rejectBtn.style.display = 'inline-block';
        trackBtn.style.display = 'none';
    } else if (order.status === 'accepted') {
        trackBtn.style.display = 'inline-block';
        acceptBtn.style.display = 'none';
        rejectBtn.style.display = 'none';
    }
    else {
        acceptBtn.style.display = 'none';
        rejectBtn.style.display = 'none';
    }

    getElement('orderModal').style.display = 'block';
}

// Accept order
async function acceptOrder() {
    if (!currentOrderId || !currentUserId) {
        console.error("Missing order ID or user ID");
        return;
    }

    try {
        const result = await updateOrderStatus(currentUserId, currentOrderId, 'accepted');

        if (result.success) {
            alert('Order accepted successfully');
            getElement('orderModal').style.display = 'none';
            // The real-time listener will automatically update the orders list
        } else {
            alert('Failed to accept order: ' + result.error);
        }
    } catch (error) {
        console.error("Error accepting order:", error);
        alert("Failed to accept order");
    }
}

// Accept order
async function trackOrder() {
    // these two will data will get data everytime the view button is clicked
    console.log(currentOrderId);
    console.log(currentUserId);
    window.location.href = `trackform.html?orderID=${currentOrderId}&userID=${currentUserId}`;
}

// Reject order
async function rejectOrder() {
    if (!currentOrderId || !currentUserId) {
        console.error("Missing order ID or user ID");
        return;
    }

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
            getElement('orderModal').style.display = 'none';
            alert('Order rejected successfully');
        } else {
            alert('Failed to reject order: ' + result.error);
        }
    } catch (error) {
        console.error("Error rejecting order:", error);
        alert("Failed to reject order");
    }
}

// View shoe details
function viewShoeDetails(shoeId) {
    window.location.href = `/shopowner/html/shop_inventory.html?shoeId=${shoeId}`;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
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

    // Logout button
    getElement('logout_btn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            const result = await logoutUser();
            if (result.success) {
                window.location.href = "/login.html";
            } else {
                alert('Logout failed: ' + result.error);
            }
        }
    });

    // Modal controls
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });

    // Order action buttons
    getElement('acceptOrderBtn').addEventListener('click', acceptOrder);
    getElement('trackOrderBtn').addEventListener('click', trackOrder);
    getElement('rejectOrderBtn').addEventListener('click', () => {
        getElement('rejectModal').style.display = 'block';
    });
    getElement('confirmRejectBtn').addEventListener('click', rejectOrder);
    getElement('cancelRejectBtn').addEventListener('click', () => {
        getElement('rejectModal').style.display = 'none';
    });

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });

    // Initialize dashboard
    initializeDashboard();
});

// Expose functions to global scope for onclick handlers
window.viewOrderDetails = viewOrderDetails;
window.viewShoeDetails = viewShoeDetails;
window.acceptOrder = acceptOrder;
window.trackOrder = trackOrder;
window.rejectOrder = rejectOrder;