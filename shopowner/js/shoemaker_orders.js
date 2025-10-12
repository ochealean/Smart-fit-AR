import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    readData,
    updateData,
    createData,
    generate18CharID
} from "../../firebaseMethods.js";

// Global variables
let allOrders = [];
let filteredOrders = [];
let currentTab = 'pending';
let currentPage = 1;
const ordersPerPage = 10;
let currentRejectOrderId = null;
let currentOrderId = null;
let realtimeListener = null;
let currentCarouselImages = [];
let currentCarouselIndex = 0;
let carouselInterval = null;

// Status order options for updates
const statusOrder = [
    "Order Processed",
    "Shipped",
    "In Transit",
    "Arrived at Facility",
    "Out for Delivery"
];

// DOM Elements
const ordersTable = document.getElementById('ordersTable');
const orderTabs = document.querySelectorAll('.order-tab');
const searchInput = document.getElementById('orderSearch');
const searchBtn = document.getElementById('searchBtn');
const clearSearch = document.getElementById('clearSearch');
const orderModal = document.getElementById('orderModal');
const rejectionModal = document.getElementById('rejectionModal');
const rejectionForm = document.getElementById('rejectionForm');
const statusUpdateModal = document.getElementById('statusUpdateModal');
const statusUpdateForm = document.getElementById('statusUpdateForm');
const trackingForm = document.getElementById('trackingForm');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const closeStatusModal = document.getElementById('closeStatusModal');
const cancelStatusUpdateBtn = document.getElementById('cancelStatusUpdateBtn');

// Expose functions globally for HTML onclick handlers
window.viewOrderDetails = viewOrderDetails;
window.processOrder = processOrder;
window.addStatusUpdatePrompt = addStatusUpdatePrompt;
window.rejectOrder = rejectOrder;
window.rejectOrderPrompt = rejectOrderPrompt;
window.closeModal = closeModal;

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializeShoeMakerOrders();
});

// Authentication and initialization
async function initializeShoeMakerOrders() {
    const user = await checkUserAuth();

    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    // Check if user is shoemaker
    if (user.role !== 'shoemaker') {
        alert('Access denied. ShoeMaker privileges required.');
        window.location.href = "/dashboard.html";
        return;
    }

    console.log('ShoeMaker user authenticated:', user);
    loadAllOrders();
    setupEventListeners();
    setupRealtimeListeners();
}

// Set up real-time listeners for database changes
function setupRealtimeListeners() {
    if (realtimeListener) {
        realtimeListener();
    }
    
    const customizedTransactionsPath = 'smartfit_AR_Database/customizedtransactions';
    realtimeListener = readDataRealtime(customizedTransactionsPath, (result) => {
        if (result.success) {
            console.log("Real-time update detected in customizedtransactions");
            if (result.data) {
                processRealtimeOrders(result.data);
            }
        } else {
            console.error("Real-time listener error:", result.error);
        }
    });
}

// Process real-time orders data
function processRealtimeOrders(customizedTransactions) {
    const newOrders = [];

    if (customizedTransactions) {
        Object.keys(customizedTransactions).forEach(userId => {
            const userOrders = customizedTransactions[userId];
            Object.keys(userOrders).forEach(orderId => {
                const orderData = userOrders[orderId];
                newOrders.push({
                    ...orderData,
                    orderId: orderId,
                    userId: userId,
                    source: 'customizedtransactions',
                    isCustom: true
                });
            });
        });
    }

    newOrders.sort((a, b) => {
        const dateA = a.orderDate || a.date || a.addedAt;
        const dateB = b.orderDate || b.date || b.addedAt;
        return new Date(dateB) - new Date(dateA);
    });

    allOrders = newOrders;
    filterAndRenderOrders();
}

// Load all orders from customizedtransactions
async function loadAllOrders() {
    try {
        const customizedTransactionsPath = 'smartfit_AR_Database/customizedtransactions';
        const result = await readData(customizedTransactionsPath);
        
        allOrders = [];

        if (result.success && result.data) {
            const customizedTransactions = result.data;
            
            Object.keys(customizedTransactions).forEach(userId => {
                const userOrders = customizedTransactions[userId];
                Object.keys(userOrders).forEach(orderId => {
                    const orderData = userOrders[orderId];
                    allOrders.push({
                        ...orderData,
                        orderId: orderId,
                        userId: userId,
                        source: 'customizedtransactions',
                        isCustom: true
                    });
                });
            });
        }

        allOrders.sort((a, b) => {
            const dateA = a.orderDate || a.date || a.addedAt;
            const dateB = b.orderDate || b.date || b.addedAt;
            return new Date(dateB) - new Date(dateA);
        });

        filterAndRenderOrders();
        
    } catch (error) {
        console.error('Error loading orders:', error);
        if (ordersTable && ordersTable.querySelector('tbody')) {
            ordersTable.querySelector('tbody').innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 30px; color: var(--error);">
                        <i class="fas fa-exclamation-circle"></i> Failed to load orders. Please try again.
                    </td>
                </tr>
            `;
        }
    }
}

// Filter orders based on current tab and search term
function filterAndRenderOrders() {
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    
    filteredOrders = allOrders.filter(order => {
        let statusMatch = false;
        if (currentTab === 'pending') {
            statusMatch = order.status === 'pending';
        } else if (currentTab === 'processing') {
            statusMatch = order.status === 'processing' || statusOrder.includes(order.status);
        } else if (currentTab === 'completed') {
            statusMatch = ['completed', 'cancelled', 'rejected'].includes(order.status);
        }
        
        if (searchTerm) {
            const orderIdMatch = order.orderId.toLowerCase().includes(searchTerm);
            const customerNameMatch = (
                (order.shippingInfo?.firstName?.toLowerCase().includes(searchTerm)) ||
                (order.shippingInfo?.lastName?.toLowerCase().includes(searchTerm)) ||
                (order.userName?.toLowerCase().includes(searchTerm)));
            const emailMatch = order.shippingInfo?.email?.toLowerCase().includes(searchTerm);
            
            return statusMatch && (orderIdMatch || customerNameMatch || emailMatch);
        }
        
        return statusMatch;
    });
    
    renderOrders();
    updatePagination();
}

// Render orders to the table
function renderOrders() {
    const tbody = ordersTable?.querySelector('tbody');
    if (!tbody) return;
    
    if (filteredOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 30px;">
                    <i class="fas fa-box-open"></i> No orders found
                </td>
            </tr>
        `;
        return;
    }
    
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = Math.min(startIndex + ordersPerPage, filteredOrders.length);
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);
    
    tbody.innerHTML = paginatedOrders.map(order => {
        const orderDate = order.orderDate || order.date || order.addedAt;
        const formattedDate = new Date(orderDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const customerName = order.shippingInfo ? 
            `${order.shippingInfo.firstName || ''} ${order.shippingInfo.lastName || ''}`.trim() : 
            'Unknown Customer';
        
        const orderType = 'Custom Shoe';
        
        let statusBadge = '';
        if (order.status === 'pending') {
            statusBadge = '<span class="status-badge status-pending">Pending</span>';
        } else if (order.status === 'processing' || statusOrder.includes(order.status)) {
            statusBadge = `<span class="status-badge status-processing">${order.status}</span>`;
        } else if (order.status === 'completed') {
            statusBadge = '<span class="status-badge status-completed">Completed</span>';
        } else if (order.status === 'cancelled') {
            statusBadge = '<span class="status-badge status-cancelled">Cancelled</span>';
        } else if (order.status === 'rejected') {
            statusBadge = '<span class="status-badge status-cancelled">Rejected</span>';
        }
        
        let actionButtons = '';
        if (order.status === 'pending') {
            actionButtons = `
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.orderId}', '${order.userId}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="action-btn btn-process" onclick="processOrder('${order.orderId}', '${order.userId}')">
                    <i class="fas fa-cog"></i> Process
                </button>
                <button class="action-btn btn-reject" onclick="rejectOrderPrompt('${order.orderId}', '${order.userId}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            `;
        } else if (order.status === 'processing' || statusOrder.includes(order.status)) {
            actionButtons = `
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.orderId}', '${order.userId}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="action-btn btn-update-status" onclick="addStatusUpdatePrompt('${order.orderId}', '${order.userId}')">
                    <i class="fas fa-sync"></i> Update Status
                </button>
            `;
        } else {
            actionButtons = `
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.orderId}', '${order.userId}')">
                    <i class="fas fa-eye"></i> View
                </button>
            `;
        }
        
        return `
            <tr>
                <td>#${order.orderId}</td>
                <td>${customerName}</td>
                <td>${formattedDate}</td>
                <td>${orderType}</td>
                <td>${statusBadge}</td>
                <td>₱${order.totalAmount?.toFixed(2) || '0.00'}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');
}

// Update pagination controls
function updatePagination() {
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
    const paginationNumbers = document.querySelectorAll('.pagination-number');
    
    paginationNumbers.forEach(btn => btn.remove());
    
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-btn pagination-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderOrders();
            updatePagination();
        });
        
        if (nextBtn) {
            nextBtn.parentNode.insertBefore(pageBtn, nextBtn);
        }
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    }
}

// Process order
async function processOrder(orderId, userId) {
    if (!confirm(`Mark order #${orderId} as processing?`)) {
        return;
    }

    try {
        const order = allOrders.find(o => o.orderId === orderId && o.userId === userId);
        if (!order) throw new Error('Order not found');
        
        const updates = {
            status: 'processing',
            updatedAt: new Date().toISOString(),
            statusUpdates: {
                ...(order.statusUpdates || {}),
                processing: {
                    status: 'processing',
                    timestamp: Date.now(),
                    message: 'Order is being processed by shoemaker'
                }
            }
        };

        const orderPath = `smartfit_AR_Database/customizedtransactions/${userId}/${orderId}`;
        const result = await updateData(orderPath, updates);
        
        if (result.success) {
            alert(`Order #${orderId} is now being processed!`);
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Error processing order:', error);
        alert(`Failed to process order: ${error.message}`);
    }
}

// Save shipping information
async function saveShippingInfo(orderId, userId) {
    const shippingData = {
        carrier: document.getElementById('carrier')?.value || "",
        trackingNumber: document.getElementById('trackingNumber')?.value || "",
        shipDate: document.getElementById('shipDate')?.value || "",
        estDelivery: document.getElementById('estDelivery')?.value || "",
        notes: document.getElementById('shippingNotes')?.value || "",
        address: document.getElementById('shippingAddress')?.innerText || ""
    };

    // Validation for required fields
    if (!shippingData.carrier || !shippingData.trackingNumber || !shippingData.shipDate || !shippingData.estDelivery) {
        alert('Please fill in all required shipping fields');
        return;
    }

    try {
        const orderPath = `smartfit_AR_Database/customizedtransactions/${userId}/${orderId}/shipping`;
        const result = await updateData(orderPath, shippingData);

        if (result.success) {
            alert("Shipping information updated successfully!");
            // Update the local order data
            const order = allOrders.find(o => o.orderId === orderId && o.userId === userId);
            if (order) {
                order.shipping = shippingData;
                updateShippingInfo(order); // Refresh displayed shipping info
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error("Error saving shipping info:", error);
        alert("Failed to save shipping information: " + error.message);
    }
}

// Add status update prompt
function addStatusUpdatePrompt(orderId, userId) {
    currentOrderId = orderId;
    currentRejectOrderId = orderId; // For compatibility with existing functions
    if (statusUpdateModal) {
        const now = new Date();
        const datetimeLocal = now.toISOString().slice(0, 16);
        const updateDateInput = document.getElementById('updateDate');
        if (updateDateInput) {
            updateDateInput.value = datetimeLocal;
        }
        statusUpdateModal.style.display = 'flex';
        disableStatusOptions(orderId, userId);
    }
}

// Add status update
async function addStatusUpdate() {
    const status = document.getElementById('updateStatus')?.value;
    const datetime = document.getElementById('updateDate')?.value;
    const message = document.getElementById('updateMessage')?.value;
    const location = document.getElementById('updateLocation')?.value;

    if (!status || !datetime || !message) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        const order = allOrders.find(o => o.orderId === currentOrderId);
        if (!order) throw new Error('Order not found');

        const statusUpdateData = {
            status,
            timestamp: new Date(datetime).getTime(),
            message,
            location: location || '',
            addedBy: 'Shoemaker',
            createdAt: new Date().toISOString()
        };

        const updateId = generate18CharID();
        const orderPath = `smartfit_AR_Database/customizedtransactions/${order.userId}/${currentOrderId}/statusUpdates/${updateId}`;
        const createResult = await createData(orderPath, null, statusUpdateData);

        if (createResult.success) {
            const updateResult = await updateData(
                `smartfit_AR_Database/customizedtransactions/${order.userId}/${currentOrderId}`,
                { status }
            );

            if (updateResult.success) {
                if (statusUpdateModal) {
                    statusUpdateModal.style.display = 'none';
                }
                if (statusUpdateForm) {
                    statusUpdateForm.reset();
                }
                alert('Status update added successfully!');
            } else {
                throw new Error(updateResult.error);
            }
        } else {
            throw new Error(createResult.error);
        }
        
    } catch (error) {
        console.error('Error adding status update:', error);
        alert(`Failed to add status update: ${error.message}`);
    }
}

// Disable status options based on current status
async function disableStatusOptions(orderId, userId) {
    const order = allOrders.find(o => o.orderId === orderId && o.userId === userId);
    if (!order) return;

    const statusSelect = document.getElementById('updateStatus');
    if (!statusSelect) return;

    const currentStatus = order.status;
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextIndex = currentIndex + 1;

    Array.from(statusSelect.options).forEach((option, index) => {
        if (index === 0) return; // Skip default option
        option.disabled = index - 1 !== nextIndex;
    });
}

// Reject order
async function rejectOrder(orderId, userId, reason) {
    try {
        const order = allOrders.find(o => o.orderId === orderId && o.userId === userId);
        if (!order) throw new Error('Order not found');
        
        const updates = {
            status: 'rejected',
            rejectionReason: reason,
            updatedAt: new Date().toISOString(),
            statusUpdates: {
                ...(order.statusUpdates || {}),
                rejected: {
                    status: 'rejected',
                    timestamp: Date.now(),
                    message: `${reason}`
                }
            }
        };

        const orderPath = `smartfit_AR_Database/customizedtransactions/${userId}/${orderId}`;
        const result = await updateData(orderPath, updates);
        
        if (result.success) {
            alert(`Order #${orderId} has been rejected successfully!`);
            if (rejectionModal) {
                rejectionModal.style.display = 'none';
            }
            if (rejectionForm) {
                rejectionForm.reset();
            }
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Error rejecting order:', error);
        alert(`Failed to reject order: ${error.message}`);
    }
}

// Reject order prompt
function rejectOrderPrompt(orderId, userId) {
    currentRejectOrderId = orderId;
    if (document.getElementById('rejectOrderId')) {
        document.getElementById('rejectOrderId').textContent = `#${orderId}`;
    }
    if (rejectionModal) {
        rejectionModal.style.display = 'flex';
    }
}

// Get shoe images based on model and color
function getShoeImages(order) {
    const selections = order.selections || {};
    const model = order.model || 'classic';
    const bodyColor = selections.bodyColor || 'white';
    
    const basePath = `/images/angles/${model}/${bodyColor}`;
    
    return [
        `${basePath}/front.png`,
        `${basePath}/side.png`, 
        `${basePath}/back.png`,
        `${basePath}/main.png`
    ];
}

// Calculate price breakdown with VAT
function calculatePriceBreakdown(order) {
    const basePrice = order.basePrice || 2999;
    
    let lacesPrice = 0;
    let insolePrice = 0;
    let solePrice = 0;
    let upperPrice = 0;
    let midsolePrice = 0;
    let outsolePrice = 0;
    
    const selections = order.selections || {};
    
    if (selections.laces && selections.laces.price) {
        lacesPrice = parseFloat(selections.laces.price) || 0;
    }
    
    if (selections.insole && selections.insole.price) {
        insolePrice = parseFloat(selections.insole.price) || 0;
    }
    
    if (selections.sole && selections.sole.price) {
        solePrice = parseFloat(selections.sole.price) || 0;
    }
    
    if (selections.upper && selections.upper.price) {
        upperPrice = parseFloat(selections.upper.price) || 0;
    }
    
    if (selections.midsole && selections.midsole.price) {
        midsolePrice = parseFloat(selections.midsole.price) || 0;
    }
    
    if (selections.outsole && selections.outsole.price) {
        outsolePrice = parseFloat(selections.outsole.price) || 0;
    }
    
    const customizationPrice = lacesPrice + insolePrice + solePrice + upperPrice + midsolePrice + outsolePrice;
    
    const subtotal = basePrice + customizationPrice;
    const vat = subtotal * 0.12;
    const shippingFee = 200;
    const total = subtotal + vat + shippingFee;
    
    return {
        basePrice,
        lacesPrice,
        insolePrice,
        solePrice,
        upperPrice,
        midsolePrice,
        outsolePrice,
        customizationPrice,
        subtotal,
        vat,
        shippingFee,
        total
    };
}

// Format price with currency symbol
function formatPrice(price) {
    return `₱${parseFloat(price).toFixed(2)}`;
}

// Format timestamp for display
function formatDateTime(timestamp) {
    if (!timestamp) return "Date not available";
    
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// Generate timeline HTML
function generateTimelineHTML(updates) {
    const sortedUpdates = Object.values(updates)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (sortedUpdates.length === 0) {
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

    return sortedUpdates.map((update, index) => {
        const isActive = index === 0;
        const isCompleted = index > 0;
        return `
            <div class="timeline-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-date">${formatDateTime(update.timestamp)}</div>
                    <h4 class="timeline-title">${update.status}</h4>
                    <p class="timeline-desc">${update.message}</p>
                    ${update.location ? `<p class="timeline-desc">Location: ${update.location}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Update shipping information form
function updateShippingInfo(order) {
    const shipping = order?.shipping || {};
    const shippingInfo = order?.shippingInfo || {};

    const carrierInput = document.getElementById('carrier');
    const trackingNumberInput = document.getElementById('trackingNumber');
    const shipDateInput = document.getElementById('shipDate');
    const estDeliveryInput = document.getElementById('estDelivery');
    const shippingNotesInput = document.getElementById('shippingNotes');
    const shippingAddressDiv = document.getElementById('shippingAddress');

    if (carrierInput) carrierInput.value = shipping.carrier || "";
    if (trackingNumberInput) trackingNumberInput.value = shipping.trackingNumber || "";
    if (shipDateInput) shipDateInput.value = shipping.shipDate || "";
    if (estDeliveryInput) estDeliveryInput.value = shipping.estDelivery || "";
    if (shippingNotesInput) shippingNotesInput.value = shipping.notes || "";

    // Construct and display full shipping address
    const addressParts = [
        shippingInfo.street,
        shippingInfo.city,
        shippingInfo.state,
        shippingInfo.postalCode,
        shippingInfo.country
    ].filter(part => part).join(', ');
    
    if (shippingAddressDiv) {
        shippingAddressDiv.textContent = addressParts || 'N/A';
    }
}

// Carousel functionality
function setupCarousel() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
    }
    
    currentCarouselIndex = 0;
    
    const carouselImage = document.getElementById('carouselImage');
    const carouselPrev = document.getElementById('carouselPrev');
    const carouselNext = document.getElementById('carouselNext');
    const carouselIndicators = document.getElementById('carouselIndicators');
    const carouselCounter = document.getElementById('carouselCounter');
    
    if (!carouselImage || currentCarouselImages.length === 0) return;
    
    if (carouselCounter) {
        carouselCounter.textContent = `${currentCarouselIndex + 1} / ${currentCarouselImages.length}`;
    }
    
    if (carouselIndicators) {
        carouselIndicators.innerHTML = '';
        currentCarouselImages.forEach((_, index) => {
            const indicator = document.createElement('div');
            indicator.className = `carousel-indicator ${index === currentCarouselIndex ? 'active' : ''}`;
            indicator.addEventListener('click', () => {
                currentCarouselIndex = index;
                updateCarousel();
            });
            carouselIndicators.appendChild(indicator);
        });
    }
    
    carouselImage.src = currentCarouselImages[currentCarouselIndex];
    carouselImage.alt = `Shoe view ${currentCarouselIndex + 1}`;
    
    if (carouselPrev) {
        carouselPrev.onclick = () => {
            currentCarouselIndex = (currentCarouselIndex - 1 + currentCarouselImages.length) % currentCarouselImages.length;
            updateCarousel();
        };
    }
    
    if (carouselNext) {
        carouselNext.onclick = () => {
            currentCarouselIndex = (currentCarouselIndex + 1) % currentCarouselImages.length;
            updateCarousel();
        };
    }
    
    carouselInterval = setInterval(() => {
        currentCarouselIndex = (currentCarouselIndex + 1) % currentCarouselImages.length;
        updateCarousel();
    }, 4000);
    
    function updateCarousel() {
        carouselImage.src = currentCarouselImages[currentCarouselIndex];
        carouselImage.alt = `Shoe view ${currentCarouselIndex + 1}`;
        
        if (carouselIndicators) {
            const indicators = carouselIndicators.querySelectorAll('.carousel-indicator');
            indicators.forEach((indicator, index) => {
                indicator.classList.toggle('active', index === currentCarouselIndex);
            });
        }
        
        if (carouselCounter) {
            carouselCounter.textContent = `${currentCarouselIndex + 1} / ${currentCarouselImages.length}`;
        }
    }
}

// View order details
async function viewOrderDetails(orderId, userId) {
    try {
        const order = allOrders.find(o => o.orderId === orderId && o.userId === userId);
        if (!order) throw new Error('Order not found');
        
        const priceBreakdown = calculatePriceBreakdown(order);
        
        const modalHeader = document.querySelector('.modal-header h2');
        if (modalHeader) {
            modalHeader.textContent = `Order Details - #${order.orderId}`;
        }
        
        const modalBody = document.querySelector('.modal-body');
        if (!modalBody) return;
        
        currentCarouselImages = getShoeImages(order);
        updateShippingInfo(order);
        
        const selections = order.selections || {};
        
        let customizationDetails = '';
        if (order.model === 'classic') {
            customizationDetails = `
                <div class="detail-row">
                    <div class="detail-label">Body Color:</div>
                    <div class="detail-value">${selections.bodyColor || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Laces:</div>
                    <div class="detail-value">${selections.laces?.id || 'Standard'} ${selections.laces?.price ? `(${formatPrice(selections.laces.price)})` : ''}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Laces Color:</div>
                    <div class="detail-value">${selections.laces?.color || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Insole Type:</div>
                    <div class="detail-value">${selections.insole?.id || 'N/A'} ${selections.insole?.price ? `(${formatPrice(selections.insole.price)})` : ''}</div>
                </div>
            `;
        } else if (order.model === 'runner') {
            customizationDetails = `
                <div class="detail-row">
                    <div class="detail-label">Body Color:</div>
                    <div class="detail-value">${selections.bodyColor || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Laces:</div>
                    <div class="detail-value">${selections.laces?.id || 'Standard'} ${selections.laces?.price ? `(${formatPrice(selections.laces.price)})` : ''}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Laces Color:</div>
                    <div class="detail-value">${selections.laces?.color || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Insole Type:</div>
                    <div class="detail-value">${selections.insole?.id || 'N/A'} ${selections.insole?.price ? `(${formatPrice(selections.insole.price)})` : ''}</div>
                </div>
            `;
        } else if (order.model === 'basketball') {
            customizationDetails = `
                <div class="detail-row">
                    <div class="detail-label">Body Color:</div>
                    <div class="detail-value">${selections.bodyColor || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Laces:</div>
                    <div class="detail-value">${selections.laces?.id || 'Standard'} ${selections.laces?.price ? `(${formatPrice(selections.laces.price)})` : ''}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Laces Color:</div>
                    <div class="detail-value">${selections.laces?.color || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Insole Type:</div>
                    <div class="detail-value">${selections.insole?.id || 'N/A'} ${selections.insole?.price ? `(${formatPrice(selections.insole.price)})` : ''}</div>
                </div>
            `;
        } else if (order.model === 'slipon') {
            customizationDetails = `
                <div class="detail-row">
                    <div class="detail-label">Midsole:</div>
                    <div class="detail-value">${selections.midsole?.id || 'Standard'} ${selections.midsole?.price ? `(${formatPrice(selections.midsole.price)})` : ''}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Midsole Color:</div>
                    <div class="detail-value">${selections.midsoleColor || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Outsole Color:</div>
                    <div class="detail-value">${selections.outsoleColor || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Insole Type:</div>
                    <div class="detail-value">${selections.insole?.id || 'N/A'} ${selections.insole?.price ? `(${formatPrice(selections.insole.price)})` : ''}</div>
                </div>
            `;
        }
        
        const modalHTML = `
            <div class="order-details-grid">
                <div>
                    <div class="detail-section">
                        <h3><i class="fas fa-user"></i> Customer Information</h3>
                        <div class="detail-row">
                            <div class="detail-label">Name:</div>
                            <div class="detail-value">${order.shippingInfo?.firstName || ''} ${order.shippingInfo?.lastName || ''}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Email:</div>
                            <div class="detail-value">${order.shippingInfo?.email || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Phone:</div>
                            <div class="detail-value">${order.shippingInfo?.phone || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Address:</div>
                            <div class="detail-value" id="shippingAddress">${
                                [
                                    order.shippingInfo?.street,
                                    order.shippingInfo?.city,
                                    order.shippingInfo?.state,
                                    order.shippingInfo?.postalCode,
                                    order.shippingInfo?.country
                                ].filter(part => part).join(', ') || 'N/A'
                            }</div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-truck"></i> Shipping Information</h3>
                        <form class="tracking-form" id="trackingForm">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="carrier" class="form-label">Shipping Carrier</label>
                                    <input type="text" id="carrier" class="form-control" required value="${order.shipping?.carrier || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="trackingNumber" class="form-label">Tracking Number</label>
                                    <input type="text" id="trackingNumber" class="form-control" required value="${order.shipping?.trackingNumber || ''}">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="shipDate" class="form-label">Ship Date</label>
                                    <input type="date" id="shipDate" class="form-control" required value="${order.shipping?.shipDate || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="estDelivery" class="form-label">Estimated Delivery</label>
                                    <input type="date" id="estDelivery" class="form-control" required value="${order.shipping?.estDelivery || ''}">
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="shippingNotes" class="form-label">Shipping Notes (Optional)</label>
                                <textarea id="shippingNotes" class="form-control" rows="3">${order.shipping?.notes || ''}</textarea>
                            </div>
                            <button type="submit" class="btn btn-success">
                                <i class="fas fa-save"></i> Save Shipping Info
                            </button>
                        </form>
                    </div>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-credit-card"></i> Payment Information</h3>
                        <div class="detail-row">
                            <div class="detail-label">Method:</div>
                            <div class="detail-value">${order.paymentMethod || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Status:</div>
                            <div class="detail-value">Paid</div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-history"></i> Order Status Timeline</h3>
                        <div class="timeline" id="statusTimeline">
                            ${generateTimelineHTML(order.statusUpdates || {})}
                        </div>
                    </div>
                </div>
                
                <div>
                    <div class="detail-section">
                        <h3><i class="fas fa-shopping-bag"></i> Order Summary</h3>
                        
                        <div class="carousel">
                            <img id="carouselImage" src="${currentCarouselImages[0]}" alt="Shoe Preview" class="carousel-image">
                            <button class="carousel-btn carousel-prev" id="carouselPrev">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <button class="carousel-btn carousel-next" id="carouselNext">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                            <div class="carousel-indicators" id="carouselIndicators"></div>
                            <div class="carousel-counter" id="carouselCounter">1 / ${currentCarouselImages.length}</div>
                        </div>
                        
                        <div class="detail-row">
                            <div class="detail-label">Order Type:</div>
                            <div class="detail-value">Custom Shoe</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Model:</div>
                            <div class="detail-value">${order.model ? order.model.charAt(0).toUpperCase() + order.model.slice(1) : 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Size:</div>
                            <div class="detail-value">${order.size || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Production Time:</div>
                            <div class="detail-value">${order.productionTime || 'N/A'}</div>
                        </div>
                        
                        <h3 style="margin-top: 1.5rem;"><i class="fas fa-palette"></i> Customization</h3>
                        ${customizationDetails}
                        
                        <h3 style="margin-top: 1.5rem;"><i class="fas fa-receipt"></i> Price Breakdown</h3>
                        <div class="detail-row">
                            <div class="detail-label">Base Price:</div>
                            <div class="detail-value">${formatPrice(priceBreakdown.basePrice)}</div>
                        </div>
                        ${priceBreakdown.lacesPrice > 0 ? `
                        <div class="detail-row">
                            <div class="detail-label">Laces:</div>
                            <div class="detail-value">+${formatPrice(priceBreakdown.lacesPrice)}</div>
                        </div>
                        ` : ''}
                        ${priceBreakdown.insolePrice > 0 ? `
                        <div class="detail-row">
                            <div class="detail-label">Insole:</div>
                            <div class="detail-value">+${formatPrice(priceBreakdown.insolePrice)}</div>
                        </div>
                        ` : ''}
                        ${priceBreakdown.solePrice > 0 ? `
                        <div class="detail-row">
                            <div class="detail-label">Sole:</div>
                            <div class="detail-value">+${formatPrice(priceBreakdown.solePrice)}</div>
                        </div>
                        ` : ''}
                        ${priceBreakdown.upperPrice > 0 ? `
                        <div class="detail-row">
                            <div class="detail-label">Upper:</div>
                            <div class="detail-value">+${formatPrice(priceBreakdown.upperPrice)}</div>
                        </div>
                        ` : ''}
                        ${priceBreakdown.midsolePrice > 0 ? `
                        <div class="detail-row">
                            <div class="detail-label">Midsole:</div>
                            <div class="detail-value">+${formatPrice(priceBreakdown.midsolePrice)}</div>
                        </div>
                        ` : ''}
                        ${priceBreakdown.outsolePrice > 0 ? `
                        <div class="detail-row">
                            <div class="detail-label">Outsole:</div>
                            <div class="detail-value">+${formatPrice(priceBreakdown.outsolePrice)}</div>
                        </div>
                        ` : ''}
                        <div class="detail-row">
                            <div class="detail-label">Customization Total:</div>
                            <div class="detail-value">+${formatPrice(priceBreakdown.customizationPrice)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Subtotal:</div>
                            <div class="detail-value">${formatPrice(priceBreakdown.subtotal)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">VAT (12%):</div>
                            <div class="detail-value">+${formatPrice(priceBreakdown.vat)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Shipping:</div>
                            <div class="detail-value">+${formatPrice(priceBreakdown.shippingFee)}</div>
                        </div>
                        <div class="detail-row" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--gray-100);">
                            <div class="detail-label" style="font-weight: 600;">Total:</div>
                            <div class="detail-value" style="font-weight: 600;">${formatPrice(priceBreakdown.total)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="action-btn btn-cancel" id="closeModalBtn"><i class="fas fa-times"></i> Close</button>
                ${order.status === 'pending' ? `
                <button class="action-btn btn-process" id="processOrderBtn" data-order-id="${order.orderId}" data-user-id="${order.userId}"><i class="fas fa-cog"></i> Mark as Processing</button>
                <button class="action-btn btn-reject" id="modalRejectBtn" data-order-id="${order.orderId}" data-user-id="${order.userId}"><i class="fas fa-times"></i> Reject</button>
                ` : ''}
                ${order.status === 'processing' || statusOrder.includes(order.status) ? `
                <button class="action-btn btn-update-status" id="updateStatusBtn" data-order-id="${order.orderId}" data-user-id="${order.userId}"><i class="fas fa-sync"></i> Update Status</button>
                ` : ''}
            </div>
        `;
        
        modalBody.innerHTML = modalHTML;
        
        setTimeout(() => {
            setupCarousel();
            disableStatusOptions(order.orderId, order.userId);
            const timelineContainer = document.getElementById('statusTimeline');
            if (timelineContainer) {
                timelineContainer.innerHTML = generateTimelineHTML(order.statusUpdates || {});
            }
            // Setup tracking form submission
            const trackingForm = document.getElementById('trackingForm');
            if (trackingForm) {
                trackingForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    saveShippingInfo(order.orderId, order.userId);
                });
            }
        }, 100);
        
        const processBtn = document.getElementById('processOrderBtn');
        if (processBtn) {
            processBtn.addEventListener('click', () => {
                processOrder(order.orderId, order.userId);
                if (orderModal) {
                    orderModal.style.display = 'none';
                }
            });
        }
        
        const updateStatusBtn = document.getElementById('updateStatusBtn');
        if (updateStatusBtn) {
            updateStatusBtn.addEventListener('click', () => {
                addStatusUpdatePrompt(order.orderId, order.userId);
                if (orderModal) {
                    orderModal.style.display = 'none';
                }
            });
        }
        
        const modalRejectBtn = document.getElementById('modalRejectBtn');
        if (modalRejectBtn) {
            modalRejectBtn.addEventListener('click', () => {
                rejectOrderPrompt(order.orderId, order.userId);
                if (orderModal) {
                    orderModal.style.display = 'none';
                }
            });
        }
        
        if (orderModal) {
            orderModal.style.display = 'flex';
        }
        
    } catch (error) {
        console.error('Error viewing order details:', error);
        alert(`Failed to load order details: ${error.message}`);
    }
}

// Close modal function
function closeModal() {
    if (orderModal) {
        orderModal.style.display = 'none';
    }
    if (rejectionModal) {
        rejectionModal.style.display = 'none';
        if (rejectionForm) {
            rejectionForm.reset();
        }
    }
    if (statusUpdateModal) {
        statusUpdateModal.style.display = 'none';
        if (statusUpdateForm) {
            statusUpdateForm.reset();
        }
    }
    
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
}

// Setup event listeners
function setupEventListeners() {
    orderTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            orderTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            currentPage = 1;
            filterAndRenderOrders();
        });
    });
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentPage = 1;
            filterAndRenderOrders();
        });
    }
    
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
            }
            currentPage = 1;
            filterAndRenderOrders();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                currentPage = 1;
                filterAndRenderOrders();
            }
        });
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderOrders();
                updatePagination();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderOrders();
                updatePagination();
            }
        });
    }
    
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    document.addEventListener('click', (e) => {
        if (e.target.id === 'closeModalBtn') {
            closeModal();
        }
    });
    
    if (closeStatusModal) {
        closeStatusModal.addEventListener('click', () => {
            if (statusUpdateModal) {
                statusUpdateModal.style.display = 'none';
            }
            if (statusUpdateForm) {
                statusUpdateForm.reset();
            }
        });
    }
    
    if (cancelStatusUpdateBtn) {
        cancelStatusUpdateBtn.addEventListener('click', () => {
            if (statusUpdateModal) {
                statusUpdateModal.style.display = 'none';
            }
            if (statusUpdateForm) {
                statusUpdateForm.reset();
            }
        });
    }
    
    if (rejectionForm) {
        rejectionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const reasonInput = document.getElementById('rejectionReason');
            if (!reasonInput) return;
            
            const reason = reasonInput.value.trim();
            
            if (!reason) {
                alert('Please provide a reason for rejection');
                return;
            }
            
            if (currentRejectOrderId) {
                const order = allOrders.find(o => o.orderId === currentRejectOrderId);
                if (order) {
                    rejectOrder(currentRejectOrderId, order.userId, reason);
                }
            }
        });
    }
    
    if (statusUpdateForm) {
        statusUpdateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addStatusUpdate();
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === orderModal) {
            closeModal();
        }
        if (e.target === rejectionModal) {
            closeModal();
        }
        if (e.target === statusUpdateModal) {
            closeModal();
        }
    });
    
    const logoutBtn = document.getElementById('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to logout?')) {
                const result = await logoutUser();
                if (result.success) {
                    window.location.href = '/login.html';
                } else {
                    alert('Logout failed: ' + result.error);
                }
            }
        });
    }
}

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
    if (realtimeListener) {
        realtimeListener();
    }
    if (carouselInterval) {
        clearInterval(carouselInterval);
    }
});