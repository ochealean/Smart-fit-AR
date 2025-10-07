import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    readData,
    updateData
} from "../../firebaseMethods.js";

// Global variables
let allOrders = [];
let filteredOrders = [];
let currentTab = 'pending';
let currentPage = 1;
const ordersPerPage = 10;
let currentRejectOrderId = null;
let realtimeListener = null;
let currentCarouselImages = [];
let currentCarouselIndex = 0;
let carouselInterval = null;

// DOM Elements
const ordersTable = document.getElementById('ordersTable');
const orderTabs = document.querySelectorAll('.order-tab');
const searchInput = document.getElementById('orderSearch');
const searchBtn = document.getElementById('searchBtn');
const clearSearch = document.getElementById('clearSearch');
const orderModal = document.getElementById('orderModal');
const rejectionModal = document.getElementById('rejectionModal');
const rejectionForm = document.getElementById('rejectionForm');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

// Expose functions globally for HTML onclick handlers
window.viewOrderDetails = viewOrderDetails;
window.processOrder = processOrder;
window.completeOrder = completeOrder;
window.rejectOrder = rejectOrder;
window.rejectOrderPrompt = rejectOrderPrompt;
window.closeModal = closeModal;

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminOrders();
});

// Authentication and initialization
async function initializeAdminOrders() {
    const user = await checkUserAuth();

    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    // Check if user is admin
    if (user.role !== 'admin') {
        alert('Access denied. Admin privileges required.');
        window.location.href = "/dashboard.html";
        return;
    }

    console.log('Admin user authenticated:', user);
    loadAllOrders();
    setupEventListeners();
    setupRealtimeListeners();
}

// Set up real-time listeners for database changes using readDataRealtime
function setupRealtimeListeners() {
    // Remove existing listener if any
    if (realtimeListener) {
        realtimeListener();
    }
    
    // Listen for changes in customizedtransactions using readDataRealtime
    const customizedTransactionsPath = 'smartfit_AR_Database/customizedtransactions';
    realtimeListener = readDataRealtime(customizedTransactionsPath, (result) => {
        if (result.success) {
            console.log("Real-time update detected in customizedtransactions");
            // Process the real-time data
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

    // Process customizedtransactions orders
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

    // Sort by date (newest first)
    newOrders.sort((a, b) => {
        const dateA = a.orderDate || a.date || a.addedAt;
        const dateB = b.orderDate || b.date || b.addedAt;
        return new Date(dateB) - new Date(dateA);
    });

    // Update global orders array
    allOrders = newOrders;
    
    // Re-render orders
    filterAndRenderOrders();
}

// Load all orders from customizedtransactions only
async function loadAllOrders() {
    try {
        // Since getOrders is designed for shop owners, we'll read directly from customizedtransactions
        const customizedTransactionsPath = 'smartfit_AR_Database/customizedtransactions';
        const result = await readData(customizedTransactionsPath);
        
        allOrders = [];

        // Process customizedtransactions orders
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

        // Sort by date (newest first)
        allOrders.sort((a, b) => {
            const dateA = a.orderDate || a.date || a.addedAt;
            const dateB = b.orderDate || b.date || b.addedAt;
            return new Date(dateB) - new Date(dateA);
        });

        // Initial render
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
        // Filter by status
        let statusMatch = false;
        if (currentTab === 'pending') {
            statusMatch = order.status === 'pending';
        } else if (currentTab === 'processing') {
            statusMatch = order.status === 'processing';
        } else if (currentTab === 'completed') {
            statusMatch = ['completed', 'cancelled', 'rejected'].includes(order.status);
        }
        
        // Filter by search term if present
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
    
    // Calculate pagination
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
        
        const orderType = 'Custom Shoe'; // All orders from customizedtransactions are custom
        
        let statusBadge = '';
        if (order.status === 'pending') {
            statusBadge = '<span class="status-badge status-pending">Pending</span>';
        } else if (order.status === 'processing') {
            statusBadge = '<span class="status-badge status-processing">In Process</span>';
        } else if (order.status === 'completed') {
            statusBadge = '<span class="status-badge status-completed">Completed</span>';
        } else if (order.status === 'cancelled') {
            statusBadge = '<span class="status-badge status-cancelled">Cancelled</span>';
        } else if (order.status === 'rejected') {
            statusBadge = '<span class="status-badge status-cancelled">Rejected</span>';
        }
        
        // Action buttons based on status
        let actionButtons = '';
        if (order.status === 'pending') {
            actionButtons = `
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.orderId}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="action-btn btn-process" onclick="processOrder('${order.orderId}')">
                    <i class="fas fa-cog"></i> Process
                </button>
                <button class="action-btn btn-reject" onclick="rejectOrderPrompt('${order.orderId}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            `;
        } else if (order.status === 'processing') {
            actionButtons = `
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.orderId}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="action-btn btn-complete" onclick="completeOrder('${order.orderId}')">
                    <i class="fas fa-check"></i> Complete
                </button>
            `;
        } else {
            actionButtons = `
                <button class="action-btn btn-view" onclick="viewOrderDetails('${order.orderId}')">
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
    
    // Clear existing numbers
    paginationNumbers.forEach(btn => btn.remove());
    
    // Add page numbers
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
    
    // Update prev/next buttons
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    }
}

// Process order using updateData
async function processOrder(orderId) {
    if (!confirm(`Mark order #${orderId} as processing?`)) {
        return;
    }

    try {
        // Find the order in our local data first
        const order = allOrders.find(o => o.orderId === orderId);
        if (!order) throw new Error('Order not found');
        
        const updates = {
            status: 'processing',
            updatedAt: new Date().toISOString(),
            statusUpdates: {
                ...(order.statusUpdates || {}),
                processing: {
                    status: 'processing',
                    timestamp: Date.now(),
                    message: 'Order is being processed by admin'
                }
            }
        };

        // Use updateData instead of updateOrderStatus
        const orderPath = `smartfit_AR_Database/customizedtransactions/${order.userId}/${orderId}`;
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

// Complete order using updateData
async function completeOrder(orderId) {
    if (!confirm(`Mark order #${orderId} as completed?`)) {
        return;
    }

    try {
        const order = allOrders.find(o => o.orderId === orderId);
        if (!order) throw new Error('Order not found');
        
        const updates = {
            status: 'completed',
            updatedAt: new Date().toISOString(),
            statusUpdates: {
                ...(order.statusUpdates || {}),
                completed: {
                    status: 'completed',
                    timestamp: Date.now(),
                    message: 'Order was completed successfully'
                }
            }
        };

        // Use updateData instead of updateOrderStatus
        const orderPath = `smartfit_AR_Database/customizedtransactions/${order.userId}/${orderId}`;
        const result = await updateData(orderPath, updates);
        
        if (result.success) {
            alert(`Order #${orderId} has been marked as completed!`);
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Error completing order:', error);
        alert(`Failed to complete order: ${error.message}`);
    }
}

// Reject order using updateData
async function rejectOrder(orderId, reason) {
    try {
        const order = allOrders.find(o => o.orderId === orderId);
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

        // Use updateData instead of updateOrderStatus
        const orderPath = `smartfit_AR_Database/customizedtransactions/${order.userId}/${orderId}`;
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
function rejectOrderPrompt(orderId) {
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
    
    // Base path for shoe images
    const basePath = `/images/angles/${model}/${bodyColor}`;
    
    // Return array of image paths for different angles
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
    
    // Calculate customization costs
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
    
    // Calculate total customization cost
    const customizationPrice = lacesPrice + insolePrice + solePrice + upperPrice + midsolePrice + outsolePrice;
    
    // Calculate subtotal (base + customization)
    const subtotal = basePrice + customizationPrice;
    
    // Calculate VAT (12% of subtotal)
    const vat = subtotal * 0.12;
    
    // Shipping fee
    const shippingFee = 200;
    
    // Calculate total (subtotal + VAT + shipping)
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

// Carousel functionality
function setupCarousel() {
    // Clear any existing interval
    if (carouselInterval) {
        clearInterval(carouselInterval);
    }
    
    // Reset index
    currentCarouselIndex = 0;
    
    // Get carousel elements
    const carouselImage = document.getElementById('carouselImage');
    const carouselPrev = document.getElementById('carouselPrev');
    const carouselNext = document.getElementById('carouselNext');
    const carouselIndicators = document.getElementById('carouselIndicators');
    const carouselCounter = document.getElementById('carouselCounter');
    
    if (!carouselImage || currentCarouselImages.length === 0) return;
    
    // Update carousel counter
    if (carouselCounter) {
        carouselCounter.textContent = `${currentCarouselIndex + 1} / ${currentCarouselImages.length}`;
    }
    
    // Update indicators
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
    
    // Set initial image
    carouselImage.src = currentCarouselImages[currentCarouselIndex];
    carouselImage.alt = `Shoe view ${currentCarouselIndex + 1}`;
    
    // Add event listeners for navigation
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
    
    // Auto-play carousel
    carouselInterval = setInterval(() => {
        currentCarouselIndex = (currentCarouselIndex + 1) % currentCarouselImages.length;
        updateCarousel();
    }, 4000); // Change image every 4 seconds
    
    // Update carousel function
    function updateCarousel() {
        carouselImage.src = currentCarouselImages[currentCarouselIndex];
        carouselImage.alt = `Shoe view ${currentCarouselIndex + 1}`;
        
        // Update indicators
        if (carouselIndicators) {
            const indicators = carouselIndicators.querySelectorAll('.carousel-indicator');
            indicators.forEach((indicator, index) => {
                indicator.classList.toggle('active', index === currentCarouselIndex);
            });
        }
        
        // Update counter
        if (carouselCounter) {
            carouselCounter.textContent = `${currentCarouselIndex + 1} / ${currentCarouselImages.length}`;
        }
    }
}

// View order details
async function viewOrderDetails(orderId) {
    try {
        const order = allOrders.find(o => o.orderId === orderId);
        if (!order) throw new Error('Order not found');
        
        // Calculate price breakdown
        const priceBreakdown = calculatePriceBreakdown(order);
        
        // Update modal header
        const modalHeader = document.querySelector('.modal-header h2');
        if (modalHeader) {
            modalHeader.textContent = `Order Details - #${order.orderId}`;
        }
        
        // Get modal body elements
        const modalBody = document.querySelector('.modal-body');
        if (!modalBody) return;
        
        // Get shoe images for carousel
        currentCarouselImages = getShoeImages(order);
        
        // Create order details HTML
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
        
        // Create the complete modal HTML
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
                    </div>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-truck"></i> Shipping Information</h3>
                        <div class="detail-row">
                            <div class="detail-label">Address:</div>
                            <div class="detail-value">${order.shippingInfo?.address || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">City:</div>
                            <div class="detail-value">${order.shippingInfo?.city || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">ZIP Code:</div>
                            <div class="detail-value">${order.shippingInfo?.zip || 'N/A'}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Country:</div>
                            <div class="detail-value">${order.shippingInfo?.country || 'N/A'}</div>
                        </div>
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
                </div>
                
                <div>
                    <div class="detail-section">
                        <h3><i class="fas fa-shopping-bag"></i> Order Summary</h3>
                        
                        <!-- Carousel Container -->
                        <div class="shoe-preview-container">
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
                        <div class="detail-row" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--gray-light);">
                            <div class="detail-label" style="font-weight: 600;">Total:</div>
                            <div class="detail-value" style="font-weight: 600;">${formatPrice(priceBreakdown.total)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="action-btn btn-cancel" id="closeModalBtn"><i class="fas fa-times"></i> Close</button>
                ${order.status === 'pending' ? `
                <button class="action-btn btn-process" id="processOrderBtn" data-order-id="${order.orderId}"><i class="fas fa-cog"></i> Mark as Processing</button>
                <button class="action-btn btn-reject" id="modalRejectBtn" data-order-id="${order.orderId}"><i class="fas fa-times"></i> Reject</button>
                ` : ''}
                ${order.status === 'processing' ? `
                <button class="action-btn btn-complete" id="completeOrderBtn" data-order-id="${order.orderId}"><i class="fas fa-check"></i> Mark as Completed</button>
                ` : ''}
            </div>
        `;
        
        // Update modal content
        modalBody.innerHTML = modalHTML;
        
        // Setup carousel after the modal content is loaded
        setTimeout(() => {
            setupCarousel();
        }, 100);
        
        // Add event listeners to action buttons
        const processBtn = document.getElementById('processOrderBtn');
        if (processBtn) {
            processBtn.addEventListener('click', () => {
                processOrder(order.orderId);
                if (orderModal) {
                    orderModal.style.display = 'none';
                }
            });
        }
        
        const completeBtn = document.getElementById('completeOrderBtn');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => {
                completeOrder(order.orderId);
                if (orderModal) {
                    orderModal.style.display = 'none';
                }
            });
        }
        
        const modalRejectBtn = document.getElementById('modalRejectBtn');
        if (modalRejectBtn) {
            modalRejectBtn.addEventListener('click', () => {
                rejectOrderPrompt(order.orderId);
                if (orderModal) {
                    orderModal.style.display = 'none';
                }
            });
        }
        
        // Show modal
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
    
    // Clear carousel interval when modal is closed
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    orderTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            orderTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            currentPage = 1;
            filterAndRenderOrders();
        });
    });
    
    // Search functionality
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
    
    // Pagination
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
    
    // Modal close buttons
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    document.addEventListener('click', (e) => {
        if (e.target.id === 'closeModalBtn') {
            closeModal();
        }
    });
    
    // Rejection modal
    const cancelRejectionBtn = document.getElementById('cancelRejectionBtn');
    if (cancelRejectionBtn) {
        cancelRejectionBtn.addEventListener('click', () => {
            if (rejectionModal) {
                rejectionModal.style.display = 'none';
            }
            if (rejectionForm) {
                rejectionForm.reset();
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
                rejectOrder(currentRejectOrderId, reason);
            }
        });
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === orderModal) {
            closeModal();
        }
        if (e.target === rejectionModal) {
            closeModal();
        }
    });
    
    // Mobile menu toggle
    const menuBtn = document.querySelector('.menu-btn');
    if (menuBtn) {
        menuBtn.addEventListener('click', function() {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                navLinks.classList.toggle('active');
            }
        });
    }
    
    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
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
    // Clear carousel interval
    if (carouselInterval) {
        clearInterval(carouselInterval);
    }
});
