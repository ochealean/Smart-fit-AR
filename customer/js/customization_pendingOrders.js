// customization_pendingOrders.js - Refactored to use firebaseMethods only
import {
    checkUserAuth,
    logoutUser,
    readData,
    readDataRealtime,
    updateData,
    createData,
    generate18CharID
} from "../../firebaseMethods.js";

// Global variables
let userSession = {
    userId: null,
    userData: null
};
let allOrders = [];
let currentCarouselIndex = 0;
let carouselImages = [];
let carouselListenersAdded = false;
let currentReportOrder = null;

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function () {
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
    
    // Initialize the page
    initPage();
    
    // Fetch all orders
    await loadOrders();
    
    // Set up real-time listeners
    setupRealtimeListeners();
    
    // Render pending orders by default
    const pendingOrders = filterOrdersByStatus('pending');
    renderOrders(pendingOrders, 'pending');
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
        
        if (userSession.userData.profilePhoto) {
            userAvatar.src = userSession.userData.profilePhoto;
        } else {
            userAvatar.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        }
    }
}

async function loadOrders() {
    try {
        // Show loading state
        getElement("ordersContainer").innerHTML = `
            <div class="empty-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading your orders...</p>
            </div>
        `;

        allOrders = await fetchAllOrders();
    } catch (error) {
        console.error("Error loading orders:", error);
        getElement("ordersContainer").innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading orders. Please try again.</p>
            </div>
        `;
    }
}

async function fetchAllOrders() {
    try {
        // Only fetch from customizedtransactions
        const customPath = `smartfit_AR_Database/customizedtransactions/${userSession.userId}`;
        const customResult = await readData(customPath);

        const orders = [];

        // Process customizedtransactions orders
        if (customResult.success && customResult.data) {
            const customOrders = customResult.data;
            Object.entries(customOrders).forEach(([orderId, order]) => {
                orders.push({
                    orderId,
                    ...order,
                    source: 'customizedtransactions',
                    formattedDate: new Date(order.orderDate || order.addedAt || order.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                });
            });
        }

        console.log("Fetched orders:", orders);
        return orders;
    } catch (error) {
        console.error("Error fetching orders:", error);
        return [];
    }
}

function filterOrdersByStatus(status) {
    if (status === 'all') return allOrders;
    
    return allOrders.filter(order => {
        if (status === 'pending') {
            return order.status === 'pending';
        } else if (status === 'processing') {
            return order.status === 'processing' || ['Order Processed', 'Shipped', 'In Transit', 'Arrived at Facility', 'Out for Delivery'].includes(order.status);
        } else if (status === 'history') {
            return ['completed', 'cancelled', 'rejected', 'delivered'].includes(order.status);
        }
        return false;
    });
}

function renderOrders(orders, status) {
    const container = getElement("ordersContainer");
    if (!container) return;

    container.innerHTML = "";

    if (!orders.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-${status === 'pending' ? 'clock' : status === 'processing' ? 'cog' : 'history'}"></i>
                <h3>No ${status.charAt(0).toUpperCase() + status.slice(1)} Orders</h3>
                <p>You don't have any ${status} custom orders at this time.</p>
            </div>
        `;
        return;
    }

    orders.forEach(order => {
        const card = document.createElement("div");
        card.classList.add("order-card");
        card.setAttribute("data-status", order.status || "pending");

        // Determine product name based on whether it's a custom order
        let productName = `Custom ${order.model || "Design"} Shoe`;
        
        // Get image URL from database structure
        const productImage = getOrderImageUrl(order);
        
        // Determine status badge
        let statusBadge = '';
        if (order.status === 'pending') {
            statusBadge = '<span class="status-badge status-pending">Pending</span>';
        } else if (order.status === 'processing' || ['Order Processed', 'Shipped', 'In Transit', 'Arrived at Facility', 'Out for Delivery'].includes(order.status)) {
            statusBadge = `<span class="status-badge status-processing">${order.status}</span>`;
        } else if (order.status === 'completed' || order.status === 'delivered') {
            statusBadge = '<span class="status-badge status-completed">Delivered</span>';
        } else if (order.status === 'cancelled') {
            statusBadge = '<span class="status-badge status-cancelled">Cancelled</span>';
        } else if (order.status === 'rejected') {
            statusBadge = '<span class="status-badge status-cancelled">Rejected</span>';
        } else {
            statusBadge = `<span class="status-badge status-pending">${order.status || 'Pending'}</span>`;
        }

        // Additional info based on status
        let additionalInfo = '';
        if (order.status === 'processing' || ['Order Processed', 'Shipped', 'In Transit', 'Arrived at Facility', 'Out for Delivery'].includes(order.status)) {
            additionalInfo = `
                <div class="detail-row">
                    <span class="detail-label">Production Time:</span>
                    <span class="detail-value">${order.productionTime || 'Not specified'}</span>
                </div>
            `;
        } else if (['completed', 'delivered', 'cancelled', 'rejected'].includes(order.status)) {
            // Find the status update timestamp if available
            let statusDate = '';
            if (order.statusUpdates && order.statusUpdates[order.status]) {
                statusDate = new Date(order.statusUpdates[order.status].timestamp).toLocaleDateString();
            }
            
            additionalInfo = `
                <div class="detail-row">
                    <span class="detail-label">${order.status.charAt(0).toUpperCase() + order.status.slice(1)} On:</span>
                    <span class="detail-value">${statusDate || 'Not specified'}</span>
                </div>
            `;
            
            // Add rejection message if the order is rejected and we're in the history tab
            if (order.status === 'rejected' && status === 'history' && order.statusUpdates && order.statusUpdates.rejected) {
                additionalInfo += `
                    <div class="detail-row">
                        <span class="detail-label">Reason:</span>
                        <span class="detail-value" style="color: #e74c3c;">${order.statusUpdates.rejected.message || 'No reason provided'}</span>
                    </div>
                `;
            }
        }

        // Add buttons based on status
        let actionButtons = `
            <button class="btn btn-view view-order-btn" data-order='${JSON.stringify(order).replace(/'/g, "\\'")}'>
                <i class="fas fa-eye"></i> View Details
            </button>
        `;

        // Add Cancel button for 'pending' status
        if (order.status === 'pending') {
            actionButtons += `
                <button class="btn btn-cancel cancel-order-btn" data-order-id="${order.orderId}" data-source="${order.source}">
                    <i class="fas fa-times"></i> Cancel
                </button>
            `;
        }

        // Add Complete button for 'Out for Delivery' status
        if (order.status === 'Out for Delivery') {
            actionButtons += `
                <button class="btn btn-complete complete-order-btn" data-order-id="${order.orderId}" data-source="${order.source}">
                    <i class="fas fa-check"></i> Complete
                </button>
            `;
        }

        // Add Report Issue button only for 'Out for Delivery' status
        if (order.status === 'Out for Delivery') {
            actionButtons += `
                <button class="btn btn-report report-issue-btn" data-order-id="${order.orderId}" data-source="${order.source}">
                    <i class="fas fa-exclamation-triangle"></i> Report Issue
                </button>
            `;
        }

        card.innerHTML = `
            <div class="order-header">
                <span class="order-id">${order.orderId}</span>
                <span class="order-date">${order.formattedDate || "Date not available"}</span>
            </div>
            <div class="order-details">
                <div class="detail-row">
                    <span class="detail-label">Product:</span>
                    <span class="detail-value">${productName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">${statusBadge}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Size:</span>
                    <span class="detail-value">${order.size || "N/A"}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Quantity:</span>
                    <span class="detail-value">${order.quantity || 1}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Price:</span>
                    <span class="detail-value">₱${order.price?.toLocaleString() || order.totalAmount?.toLocaleString() || "N/A"}</span>
                </div>
                ${additionalInfo}
                <img src="${productImage}" alt="Product Image" class="order-image" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/11542/11542598.png';">
            </div>
            <div class="order-actions">
                ${actionButtons}
            </div>
        `;

        container.appendChild(card);
    });

    // Add event listeners to view buttons
    document.querySelectorAll('.view-order-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const orderData = JSON.parse(e.target.closest('.view-order-btn').getAttribute('data-order'));
            showOrderDetails(orderData);
        });
    });

    // Add event listeners to cancel buttons
    document.querySelectorAll('.cancel-order-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const orderId = e.target.closest('.cancel-order-btn').getAttribute('data-order-id');
            const source = e.target.closest('.cancel-order-btn').getAttribute('data-source');
            cancelOrder(orderId, source);
        });
    });

    // Add event listeners to complete buttons
    document.querySelectorAll('.complete-order-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const orderId = e.target.closest('.complete-order-btn').getAttribute('data-order-id');
            const source = e.target.closest('.complete-order-btn').getAttribute('data-source');
            completeOrder(orderId, source);
        });
    });

    // Add event listeners to report issue buttons
    document.querySelectorAll('.report-issue-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const orderId = e.target.closest('.report-issue-btn').getAttribute('data-order-id');
            const source = e.target.closest('.report-issue-btn').getAttribute('data-source');
            showReportIssueModal(orderId, source);
        });
    });
}

// Function to get the correct image URL from database structure
function getOrderImageUrl(order) {
    // Default fallback image
    const defaultImage = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    
    // If order has a direct image property, use it
    if (order.image) {
        return order.image;
    }
    
    // If order has item with image, use it
    if (order.item && order.item.image) {
        return order.item.image;
    }
    
    // Try to get image from AR customization models in database structure
    if (order.model && order.selections && order.selections.bodyColor) {
        const model = order.model;
        const color = order.selections.bodyColor;
        
        // Based on the database structure, try different image paths
        // For classic model with multiple images
        if (model === 'classic') {
            // Check if classic model has images object in database
            if (order.selections.bodyColor === 'blue' || order.selections.bodyColor === 'black') {
                return `/images/angles/classic/${color}/main.png`;
            }
        }
        
        // For other models, use the default path structure
        return `/images/angles/default/${color}/main.png`;
    }
    
    // If no specific image found, use placeholder based on model
    if (order.model) {
        switch (order.model) {
            case 'basketball':
                return '/images/basketballshoe3d.png';
            case 'classic':
                return '/images/classicshoe3d.png';
            case 'runner':
                return '/images/runningshoe3d.png';
            default:
                return defaultImage;
        }
    }
    
    return defaultImage;
}

function showOrderDetails(order) {
    const modal = getElement("orderModal");
    if (!modal) return;
    
    // Determine product name
    let productName = `Custom ${order.model || "Design"} Shoe`;
    
    // Determine status badge
    let statusBadge = '';
    if (order.status === 'pending') {
        statusBadge = '<span class="status-badge status-pending">Pending</span>';
    } else if (order.status === 'processing' || ['Order Processed', 'Shipped', 'In Transit', 'Arrived at Facility', 'Out for Delivery'].includes(order.status)) {
        statusBadge = `<span class="status-badge status-processing">${order.status}</span>`;
    } else if (order.status === 'completed' || order.status === 'delivered') {
        statusBadge = '<span class="status-badge status-completed">Delivered</span>';
    } else if (order.status === 'cancelled') {
        statusBadge = '<span class="status-badge status-cancelled">Cancelled</span>';
    } else if (order.status === 'rejected') {
        statusBadge = '<span class="status-badge status-cancelled">Rejected</span>';
    } else {
        statusBadge = `<span class="status-badge status-pending">${order.status || 'Pending'}</span>`;
    }
    
    // Safely populate modal elements - check if they exist first
    const setTextContent = (elementId, content) => {
        const element = getElement(elementId);
        if (element) {
            element.textContent = content;
        }
    };
    
    const setInnerHTML = (elementId, content) => {
        const element = getElement(elementId);
        if (element) {
            element.innerHTML = content;
        }
    };
    
    // Populate modal with order details
    setTextContent("modalOrderId", order.orderId);
    setTextContent("modalOrderDate", order.formattedDate || "Date not available");
    setInnerHTML("modalOrderStatus", statusBadge);
    setTextContent("modalPaymentMethod", order.paymentMethod || "Not specified");
    
    // Show rejection reason if rejected
    const rejectionRow = getElement('rejectionReasonRow');
    if (rejectionRow) {
        if (order.status === 'rejected' && order.statusUpdates?.rejected?.message) {
            setTextContent("modalRejectionReason", order.statusUpdates.rejected.message);
            rejectionRow.style.display = 'flex';
        } else {
            rejectionRow.style.display = 'none';
        }
    }

    // Extract color from selections if available
    let shoeColor = "default";
    if (order.selections) {
        if (order.selections.bodyColor) {
            shoeColor = order.selections.bodyColor;
        } else if (order.selections.midsoleColor) {
            shoeColor = order.selections.midsoleColor;
        } else if (order.selections.heelColor) {
            shoeColor = order.selections.heelColor;
        }
    }
    
    // Set up carousel with images from database structure
    setupCarousel(order);
    
    setTextContent("modalShoeModel", productName);
    setTextContent("modalShoeSize", order.size || "N/A");
    setTextContent("modalShoeColor", shoeColor);
    
    // Customization details
    let soleType = "Standard";
    let upperMaterial = "Not specified";
    let lacesType = "Standard";
    let additionalFeatures = "None";
    
    if (order.selections) {
        if (order.selections.sole) {
            soleType = order.selections.sole.id || "Standard";
        }
        if (order.selections.upper) {
            upperMaterial = order.selections.upper.id || "Not specified";
        }
        if (order.selections.laces) {
            lacesType = order.selections.laces.id || "Standard";
        }
        if (order.selections.insole) {
            additionalFeatures = order.selections.insole.id || "None";
        }
        if (order.selections.midsole) {
            additionalFeatures = order.selections.midsole.id || "None";
        }
    }
    
    setTextContent("modalSoleType", `${soleType} ${order.selections?.sole?.price ? '(+₱' + order.selections.sole.price + ')' : ''}`);
    setTextContent("modalLacesType", `${lacesType} ${order.selections?.laces?.price ? '(+₱' + order.selections.laces.price + ')' : ''}`);
    setTextContent("modalAdditionalFeatures", `${additionalFeatures} ${order.selections?.insole?.price ? '(+₱' + order.selections.insole.price + ')' : ''}`);
    
    // Show customer info if available
    if (order.shippingInfo) {
        setTextContent("modalCustomerName", `${order.shippingInfo.firstName} ${order.shippingInfo.lastName}`);
        setTextContent("modalCustomerAddress", `${order.shippingInfo.address || ''}, ${order.shippingInfo.city || ''}, ${order.shippingInfo.country || ''}`.trim());
        setTextContent("modalCustomerContact", order.shippingInfo.phone || "Not specified");
    } else if (userSession.userData) {
        setTextContent("modalCustomerName", `${userSession.userData.firstName || ''} ${userSession.userData.lastName || ''}`.trim() || "Not specified");
        setTextContent("modalCustomerAddress", userSession.userData.address || "Not specified");
        setTextContent("modalCustomerContact", userSession.userData.phone || "Not specified");
    }
    
    // Shipping details
    const shipping = order.shipping || {};
    setTextContent("modalCarrier", shipping.carrier || "N/A");
    setTextContent("modalTrackingNumber", shipping.trackingNumber || "N/A");
    setTextContent("modalShipDate", shipping.shipDate || "N/A");
    setTextContent("modalEstDelivery", shipping.estDelivery || "Not specified");
    setTextContent("modalShippingNotes", shipping.notes || "N/A");
    
    // Calculate prices with VAT and shipping
    const basePrice = order.basePrice || 2999;
    const lacesPrice = order.selections?.laces?.price || 150;
    const insolePrice = order.selections?.insole?.price || 150;
    const customizationPrice = lacesPrice + insolePrice;
    const subtotal = basePrice + customizationPrice;
    const vat = subtotal * 0.12; // 12% VAT
    const shippingPrice = 200; // Fixed shipping cost
    const totalPrice = subtotal + vat + shippingPrice;
    
    // Update order summary in the modal
    setTextContent("modalBasePrice", `₱${basePrice.toLocaleString()}`);
    setTextContent("modalCustomizationPrice", `+₱${customizationPrice.toLocaleString()}`);
    setTextContent("modalVat", `+₱${vat.toLocaleString()}`);
    setTextContent("modalShipping", `₱${shippingPrice.toLocaleString()}`);
    setTextContent("modalTotalPrice", `₱${totalPrice.toLocaleString()}`);
    
    // Populate timeline
    const timelineContainer = getElement('modalTimeline');
    if (timelineContainer) {
        timelineContainer.innerHTML = generateTimelineHTML(order.statusUpdates || {});
    }
    
    // Show the modal
    modal.style.display = "flex";
}

function generateTimelineHTML(updates) {
    if (!updates || Object.keys(updates).length === 0) {
        return `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-title">No status updates available</div>
                    <p class="timeline-desc">Check back later for updates on this order</p>
                </div>
            </div>
        `;
    }

    const sortedUpdates = Object.values(updates)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return sortedUpdates.map((update, index) => {
        const isActive = index === 0;
        const isCompleted = index > 0;
        const date = new Date(update.timestamp).toLocaleString();
        return `
            <div class="timeline-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-date">${date}</div>
                    <h4 class="timeline-title">${update.status}</h4>
                    <p class="timeline-desc">${update.message}</p>
                    ${update.location ? `<p class="timeline-desc">Location: ${update.location}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function setupCarousel(order) {
    // Define the four views
    const views = ['main', 'front', 'side', 'back'];
    
    // Generate image paths based on database structure
    carouselImages = getCarouselImages(order, views);
    
    // Set up carousel slides
    const slides = document.querySelectorAll('.carousel-slide');
    slides.forEach((slide, index) => {
        const img = slide.querySelector('img');
        if (carouselImages[index]) {
            img.src = carouselImages[index];
        } else {
            // Use the main order image as fallback for all slides
            img.src = getOrderImageUrl(order);
        }
        img.onerror = function() {
            this.src = 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png';
        };
    });
    
    // Reset carousel to first slide
    currentCarouselIndex = 0;
    updateCarousel();
    
    // Add event listeners for carousel navigation only once
    if (!carouselListenersAdded) {
        const prevBtn = document.querySelector('.carousel-prev');
        const nextBtn = document.querySelector('.carousel-next');
        const dots = document.querySelectorAll('.carousel-dot');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentCarouselIndex = (currentCarouselIndex - 1 + carouselImages.length) % carouselImages.length;
                updateCarousel();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentCarouselIndex = (currentCarouselIndex + 1) % carouselImages.length;
                updateCarousel();
            });
        }
        
        // Add event listeners for dot navigation
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                currentCarouselIndex = index;
                updateCarousel();
            });
        });
        
        carouselListenersAdded = true;
    }
}

// Function to get carousel images from database structure
function getCarouselImages(order, views) {
    const images = [];
    const model = order.model;
    const color = order.selections?.bodyColor || 'default';
    
    // Based on the database structure, generate image URLs
    if (model === 'classic') {
        // Classic model has multiple images in database
        if (color === 'blue' || color === 'black') {
            // Use the actual image URLs from database structure
            views.forEach(view => {
                images.push(`/images/angles/classic/${color}/${view}.png`);
            });
        } else {
            // For other colors, use default structure
            views.forEach(view => {
                images.push(`/images/angles/default/${color}/${view}.png`);
            });
        }
    } else {
        // For basketball and runner models, use default structure
        views.forEach(view => {
            images.push(`/images/angles/default/${color}/${view}.png`);
        });
    }
    
    return images;
}

function updateCarousel() {
    // Hide all slides
    document.querySelectorAll('.carousel-slide').forEach(slide => {
        slide.classList.remove('active');
    });
    
    // Show current slide
    const slides = document.querySelectorAll('.carousel-slide');
    if (slides[currentCarouselIndex]) {
        slides[currentCarouselIndex].classList.add('active');
    }
    
    // Update active dot
    document.querySelectorAll('.carousel-dot').forEach((dot, index) => {
        if (index === currentCarouselIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

async function cancelOrder(orderId, source) {
    try {
        if (!confirm(`Are you sure you want to cancel order ${orderId}? This action cannot be undone.`)) {
            return;
        }

        // Show loading state
        const cancelButton = document.querySelector(`.cancel-order-btn[data-order-id="${orderId}"]`);
        if (cancelButton) {
            const originalHTML = cancelButton.innerHTML;
            cancelButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Canceling...';
            cancelButton.disabled = true;

            try {
                // Get the order details first
                const orderPath = `smartfit_AR_Database/${source}/${userSession.userId}/${orderId}`;
                const orderResult = await readData(orderPath);
                
                if (!orderResult.success) {
                    throw new Error('Order not found');
                }

                const orderData = orderResult.data;

                // Update the order status to 'cancelled'
                const updates = {
                    status: 'cancelled',
                    cancelledAt: Date.now(),
                    statusUpdates: {
                        ...(orderData.statusUpdates || {}),
                        cancelled: {
                            status: 'cancelled',
                            timestamp: Date.now(),
                            message: 'Order was cancelled by customer'
                        }
                    }
                };

                const updateResult = await updateData(orderPath, updates);
                
                if (updateResult.success) {
                    // Refresh the orders list
                    allOrders = await fetchAllOrders();
                    
                    // Get current active tab
                    const activeTab = document.querySelector('.order-tab.active').getAttribute('data-tab');
                    const filteredOrders = filterOrdersByStatus(activeTab);
                    renderOrders(filteredOrders, activeTab);

                    alert(`Order ${orderId} has been successfully cancelled.`);
                } else {
                    throw new Error(updateResult.error);
                }

            } catch (error) {
                console.error('Error cancelling order:', error);
                alert(`Failed to cancel order: ${error.message}`);

                // Restore button state if error occurs
                cancelButton.innerHTML = originalHTML;
                cancelButton.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error in cancelOrder:', error);
        alert(`Failed to cancel order: ${error.message}`);
    }
}

async function completeOrder(orderId, source) {
    if (!confirm(`Are you sure you want to mark order ${orderId} as delivered?`)) {
        return;
    }

    try {
        const completeButton = document.querySelector(`.complete-order-btn[data-order-id="${orderId}"]`);
        if (completeButton) {
            const originalHTML = completeButton.innerHTML;
            completeButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Completing...';
            completeButton.disabled = true;

            const orderPath = `smartfit_AR_Database/${source}/${userSession.userId}/${orderId}`;
            const orderResult = await readData(orderPath);
            
            if (!orderResult.success) {
                throw new Error('Order not found');
            }

            const orderData = orderResult.data;

            const updates = {
                status: 'delivered',
                deliveredAt: Date.now(),
                statusUpdates: {
                    ...(orderData.statusUpdates || {}),
                    delivered: {
                        status: 'delivered',
                        timestamp: Date.now(),
                        message: 'Order delivered and confirmed by customer'
                    }
                }
            };

            const updateResult = await updateData(orderPath, updates);
            
            if (updateResult.success) {
                allOrders = await fetchAllOrders();
                const activeTab = document.querySelector('.order-tab.active').getAttribute('data-tab');
                const filteredOrders = filterOrdersByStatus(activeTab);
                renderOrders(filteredOrders, activeTab);
                alert(`Order ${orderId} has been marked as delivered.`);
            } else {
                throw new Error(updateResult.error);
            }

            completeButton.innerHTML = originalHTML;
            completeButton.disabled = false;
        }
    } catch (error) {
        console.error('Error completing order:', error);
        alert(`Failed to complete order: ${error.message}`);
    }
}

function showReportIssueModal(orderId, source) {
    currentReportOrder = { orderId, source };
    const modal = getElement('reportIssueModal');
    if (modal) {
        getElement('reportOrderId').textContent = orderId;
        modal.style.display = 'flex';
    }
}

async function submitReportIssue(description) {
    if (!currentReportOrder) return;

    try {
        const issueId = generate18CharID();
        const issuePath = `smartfit_AR_Database/issueReports/${userSession.userId}/${issueId}`;
        const issueData = {
            orderId: currentReportOrder.orderId,
            source: currentReportOrder.source,
            description,
            createdAt: Date.now(),
            status: 'pending'
        };

        const result = await createData(issuePath, null, issueData);
        
        if (result.success) {
            alert('Issue reported successfully!');
            const modal = getElement('reportIssueModal');
            if (modal) modal.style.display = 'none';
            getElement('issueDescription').value = '';
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error reporting issue:', error);
        alert(`Failed to report issue: ${error.message}`);
    }
}

// Set up real-time listeners for database changes
function setupRealtimeListeners() {
    // Listen for changes in customizedtransactions
    const customPath = `smartfit_AR_Database/customizedtransactions/${userSession.userId}`;
    
    const unsubscribe = readDataRealtime(customPath, async (result) => {
        console.log("Real-time update detected in customizedtransactions");
        allOrders = await fetchAllOrders();
        
        // Get current active tab
        const activeTab = document.querySelector('.order-tab.active')?.getAttribute('data-tab') || 'pending';
        const filteredOrders = filterOrdersByStatus(activeTab);
        renderOrders(filteredOrders, activeTab);
    });

    // Store unsubscribe for cleanup if needed
    window.customOrdersUnsubscribe = unsubscribe;
}

// Initialize the page
function initPage() {
    // Set up tab switching
    const orderTabs = document.querySelectorAll('.order-tab');
    orderTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            orderTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Get the tab to show
            const tabToShow = this.getAttribute('data-tab');
            
            // Filter and render orders for this tab
            const filteredOrders = filterOrdersByStatus(tabToShow);
            renderOrders(filteredOrders, tabToShow);
        });
    });

    // Set up order modal close functionality
    const closeModalBtn = getElement('closeModalBtn');
    const closeModalXBtn = document.querySelector('.close-modal');
    const orderModal = getElement('orderModal');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            if (orderModal) orderModal.style.display = 'none';
        });
    }
    
    if (closeModalXBtn) {
        closeModalXBtn.addEventListener('click', function() {
            if (orderModal) orderModal.style.display = 'none';
        });
    }
    
    if (orderModal) {
        window.addEventListener('click', function(e) {
            if (e.target === orderModal) {
                orderModal.style.display = 'none';
            }
        });
    }

    // Set up report issue modal
    const reportModal = getElement('reportIssueModal');
    const closeReportModal = getElement('closeReportModal');
    const cancelReportBtn = getElement('cancelReportBtn');
    const reportForm = getElement('reportIssueForm');

    if (closeReportModal) {
        closeReportModal.addEventListener('click', () => {
            if (reportModal) reportModal.style.display = 'none';
            getElement('issueDescription').value = '';
        });
    }

    if (cancelReportBtn) {
        cancelReportBtn.addEventListener('click', () => {
            if (reportModal) reportModal.style.display = 'none';
            getElement('issueDescription').value = '';
        });
    }

    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const description = getElement('issueDescription').value.trim();
            if (description) {
                await submitReportIssue(description);
            } else {
                alert('Please provide a description of the issue.');
            }
        });
    }

    if (reportModal) {
        window.addEventListener('click', (e) => {
            if (e.target === reportModal) {
                reportModal.style.display = 'none';
                getElement('issueDescription').value = '';
            }
        });
    }

    // Set up mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    
    if (mobileMenuToggle && sidebar && sidebarOverlay) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        });

        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            this.classList.remove('active');
        });
    }

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

// Cleanup function if needed
function cleanup() {
    if (window.customOrdersUnsubscribe) {
        window.customOrdersUnsubscribe();
    }
}

// Export for potential cleanup
window.cleanupCustomOrders = cleanup;