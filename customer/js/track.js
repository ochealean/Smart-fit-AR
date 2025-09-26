import { 
    checkUserAuth, 
    logoutUser, 
    readDataRealtime,
    readData
} from '../../firebaseMethods.js';

// DOM elements
const domElements = {
    mainContent: document.querySelector(".main-content"),
    packageTitle: document.querySelector(".package-title"),
    packageShop: document.querySelector(".package-shop"),
    shoeBrand: document.getElementById("shoeBrand"),
    shoeType: document.getElementById("shoeType"),
    shoeGender: document.getElementById("shoeGender"),
    orderNumber: document.querySelector(".meta-item:nth-child(1) .meta-value"),
    orderPrice: document.querySelector(".meta-item:nth-child(2) .meta-value"),
    orderQuantity: document.querySelector(".meta-item:nth-child(3) .meta-value"),
    orderSize: document.querySelector(".meta-item:nth-child(4) .meta-value"),
    orderColor: document.querySelector(".meta-item:nth-child(5) .meta-value"),
    statusIcon: document.querySelector(".status-icon"),
    statusTitle: document.querySelector(".status-text h4"),
    statusSubtitle: document.querySelector(".status-text p"),
    trackingNumber: document.querySelector(".tracking-number"),
    timelineContainer: document.querySelector(".timeline"),
    recipientName: document.querySelector(".info-card:nth-of-type(1) .info-item:nth-of-type(1) .info-value"),
    recipientAddress: document.querySelector(".info-card:nth-of-type(1) .info-item:nth-of-type(2) .info-value"),
    recipientContact: document.querySelector(".info-card:nth-of-type(1) .info-item:nth-of-type(3) .info-value"),
    shopName: document.querySelector(".info-card:nth-of-type(2) .info-item:nth-of-type(1) .info-value"),
    shopAddress: document.querySelector(".info-card:nth-of-type(2) .info-item:nth-of-type(2) .info-value"),
    shopContact: document.querySelector(".info-card:nth-of-type(2) .info-item:nth-of-type(3) .info-value"),
    carrierName: document.querySelector(".info-card:nth-of-type(3) .info-item:nth-of-type(1) .info-value"),
    trackingNumberInfo: document.querySelector(".info-card:nth-of-type(3) .info-item:nth-of-type(2) .info-value"),
    estDelivery: document.querySelector(".info-card:nth-of-type(3) .info-item:nth-of-type(3) .info-value")
};

// Get orderId and userId from URL
const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get("orderId");
const userId = urlParams.get("userId");

if (!orderId || !userId) {
    alert("Missing orderId or userId in URL");
    throw new Error("No orderId or userId provided");
}

// Initialize the application
async function init() {
    await loadUserProfile();
    await loadOrderData();
}

// Load user profile data
async function loadUserProfile() {
    try {
        const authResult = await checkUserAuth();
        if (authResult.authenticated && authResult.userData) {
            // Update user profile in header
            const imageProfile = document.getElementById('imageProfile');
            const userNameDisplay = document.getElementById('userName_display2');
            
            if (userNameDisplay && authResult.userData.firstName) {
                userNameDisplay.textContent = authResult.userData.firstName;
            }
            
            if (imageProfile && authResult.userData.profilePhoto) {
                imageProfile.src = authResult.userData.profilePhoto;
            }

            domElements.mainContent.style.opacity = "1";
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

// Load order data from Firebase using firebaseMethods
async function loadOrderData() {
    const orderPath = `smartfit_AR_Database/transactions/${userId}/${orderId}`;
    
    // Use real-time listener for order data
    console.log('Listening to order path:', orderPath);
    console.log(orderId);
    const unsubscribe = readDataRealtime(orderPath, (result) => {
        if (result.success) {
            const data = result.data;
            updateOrderInfo(data);
            updateShippingInfo(data);
            updateStatusUpdates(data.statusUpdates || {});
            updateDeliveryInfo(data);
        } else {
            alert("Order not found");
            console.error("Error loading order:", result.error);
        }
    });

    // Return unsubscribe function for cleanup if needed
    return unsubscribe;
}

// Get shop details using firebaseMethods
async function getShopDetailsByID(shopID) {
    try {
        const shopPath = `smartfit_AR_Database/shop/${shopID}`;
        const result = await readData(shopPath);
        return result.success ? result.data : null;
    } catch (error) {
        console.error('Error fetching shop details:', error);
        return null;
    }
}

// Update order information display
function updateOrderInfo(data) {
    console.log('Order data:', data);
    
    if (domElements.packageTitle) {
        domElements.packageTitle.textContent = data.item?.name || "N/A";
    }

    if (domElements.packageShop) {
        domElements.packageShop.textContent = `From: ${data.item?.shopName || "Unknown Seller"}`;
    }

    // Update package image
    const packageImage = document.getElementById('packageImage');
    if (packageImage && data.item?.imageUrl) {
        packageImage.src = data.item.imageUrl;
        packageImage.alt = data.item?.name || "Product Image";
        packageImage.onerror = function() {
            this.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        };
    } else if (packageImage) {
        packageImage.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }

    if (domElements.orderNumber) {
        domElements.orderNumber.textContent = `#${data.orderId}`;
    }

    if (domElements.orderPrice && data.totalAmount) {
        domElements.orderPrice.textContent = `₱${data.totalAmount.toFixed(2)}`;
    }

    if (domElements.orderQuantity && data.item?.quantity) {
        domElements.orderQuantity.textContent = data.item.quantity;
    }

    if (domElements.orderSize && data.item?.size) {
        domElements.orderSize.textContent = data.item.size;
    }

    if (domElements.orderColor && data.item?.color) {
        domElements.orderColor.textContent = data.item.color;
    }
    
    // Fetch and display shoe details
    if (data.item?.shoeId && data.item?.shopId) {
        fetchShoeDetails(data.item.shoeId, data.item.shopId);
    }
}

// Fetch shoe details using firebaseMethods
async function fetchShoeDetails(shoeId, shopId) {
    try {
        const shoePath = `smartfit_AR_Database/shoe/${shopId}/${shoeId}`;
        const result = await readData(shoePath);
        
        if (result.success && result.data) {
            const shoeData = result.data;
            
            if (domElements.shoeBrand) {
                domElements.shoeBrand.textContent = shoeData.shoeBrand || "N/A";
            }
            
            if (domElements.shoeType) {
                domElements.shoeType.textContent = shoeData.shoeType || "N/A";
            }
            
            if (domElements.shoeGender) {
                domElements.shoeGender.textContent = shoeData.shoeGender || "N/A";
            }
        }
    } catch (error) {
        console.error('Error fetching shoe details:', error);
    }
}

// Update shipping information
function updateShippingInfo(data) {
    if (!data.shipping) return;

    if (domElements.trackingNumber && domElements.trackingNumberInfo) {
        const trackingNum = data.shipping.trackingNumber || "Not available";
        domElements.trackingNumber.textContent = `Tracking #: ${trackingNum}`;
        domElements.trackingNumberInfo.textContent = trackingNum;
    }

    if (domElements.carrierName && data.shipping.carrier) {
        domElements.carrierName.textContent = data.shipping.carrier;
    }

    if (domElements.estDelivery && data.shipping.estDelivery) {
        domElements.estDelivery.textContent = formatDateForDisplay(data.shipping.estDelivery);
    }
}

// Update delivery information
async function updateDeliveryInfo(data) {
    console.log('Delivery data:', data);
    if (!data.shippingInfo) return;

    // Recipient info
    if (domElements.recipientName) {
        const firstName = data.shippingInfo.firstName || '';
        const lastName = data.shippingInfo.lastName || '';
        domElements.recipientName.textContent = `${firstName} ${lastName}`.trim() || "N/A";
    }

    if (domElements.recipientAddress) {
        const address = [
            data.shippingInfo.address || '',
            data.shippingInfo.city || '',
            data.shippingInfo.state || '',
            data.shippingInfo.zip || ''
        ].filter(Boolean).join(", ");
        domElements.recipientAddress.innerHTML = address || "N/A";
    }

    if (domElements.recipientContact) {
        const contact = [
            data.shippingInfo.phone ? formatPhoneNumber(data.shippingInfo.phone) : '',
            data.shippingInfo.email || ''
        ].filter(Boolean).join("<br>");
        domElements.recipientContact.innerHTML = contact || "N/A";
    }

    // Get seller info asynchronously
    if (data.item?.shopId) {
        const sellerInfo = await getShopDetailsByID(data.item.shopId);
        
        // Seller info
        if (domElements.shopName) {
            domElements.shopName.textContent = data.item?.shopName || "N/A";
        }

        if (domElements.shopAddress && sellerInfo) {
            const shopAddress = [
                sellerInfo.shopAddress || '',
                sellerInfo.shopCity || '',
                sellerInfo.shopState || '',
                sellerInfo.shopZip || ''
            ].filter(Boolean).join(", ");
            domElements.shopAddress.innerHTML = shopAddress || "N/A";
        }

        if (domElements.shopContact && sellerInfo) {
            const shopContact = [
                sellerInfo.ownerPhone ? formatPhoneNumber(sellerInfo.ownerPhone) : '',
                sellerInfo.email || ''
            ].filter(Boolean).join("<br>");
            domElements.shopContact.innerHTML = shopContact || "N/A";
        }
    }
}

// Helper function to format phone numbers
function formatPhoneNumber(phone) {
    if (!phone) return '';

    const digits = phone.replace(/\D/g, '');

    if (digits.length === 10) {
        return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
    }

    return phone;
}

// Update status updates and timeline
function updateStatusUpdates(updates) {
    if (!domElements.timelineContainer) return;

    // Clear existing timeline items
    domElements.timelineContainer.innerHTML = "";

    // Convert updates object to array and sort by timestamp (newest first)
    const sortedUpdates = Object.values(updates)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (sortedUpdates.length === 0) {
        // No updates available
        const noUpdates = document.createElement("div");
        noUpdates.className = "timeline-item";
        noUpdates.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-title">No tracking updates available</div>
                <p class="timeline-desc">Check back later for updates on your shipment</p>
            </div>
        `;
        domElements.timelineContainer.appendChild(noUpdates);
        return;
    }

    // Determine current status for the header
    const currentStatus = sortedUpdates[0].status;
    updateStatusHeader(currentStatus);

    // Create timeline items
    sortedUpdates.forEach((update, index) => {
        const isActive = index === 0;
        const isCompleted = index > 0;

        const item = document.createElement("div");
        item.className = `timeline-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;

        item.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-date">${formatDateTime(update.timestamp)}</div>
                <h4 class="timeline-title">${update.status}</h4>
                <p class="timeline-desc">${update.message}</p>
                ${update.location ? `<p class="timeline-desc">Location: ${update.location}</p>` : ''}
            </div>
        `;

        domElements.timelineContainer.appendChild(item);
    });
}

// Update the status header at the top
function updateStatusHeader(status) {
    if (!domElements.statusIcon || !domElements.statusTitle || !domElements.statusSubtitle) return;

    let icon, title, subtitle;

    switch (status.toLowerCase()) {
        case 'delivered':
            icon = '<i class="fas fa-check-circle"></i>';
            title = 'Delivered';
            subtitle = 'Your package has been delivered';
            break;
        case 'out for delivery':
            icon = '<i class="fas fa-truck-fast"></i>';
            title = 'Out for Delivery';
            subtitle = 'Your package is with the delivery driver';
            break;
        case 'in transit':
            icon = '<i class="fas fa-truck"></i>';
            title = 'In Transit';
            subtitle = 'Your package is on its way to you';
            break;
        case 'shipped':
            icon = '<i class="fas fa-shipping-fast"></i>';
            title = 'Shipped';
            subtitle = 'Seller has shipped your order';
            break;
        case 'processing':
            icon = '<i class="fas fa-box-open"></i>';
            title = 'Processing';
            subtitle = 'Seller is preparing your order';
            break;
        default:
            icon = '<i class="fas fa-info-circle"></i>';
            title = status || 'Order Received';
            subtitle = 'Your order has been received';
    }

    domElements.statusIcon.innerHTML = icon;
    domElements.statusTitle.textContent = title;
    domElements.statusSubtitle.textContent = subtitle;
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

// Format date for display (for estimated delivery)
function formatDateForDisplay(dateString) {
    if (!dateString) return "Not available";
    
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    init();
});

// Logout functionality using firebaseMethods
document.getElementById('logout_btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        logoutUser().then(() => {
            window.location.href = '/user_login.html';
        }).catch((error) => {
            console.error('Error signing out:', error);
        });
    }
});