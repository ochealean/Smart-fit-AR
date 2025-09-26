import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

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
const db = getDatabase(app);

// Get orderId and userId from URL
const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get("orderId");
const userId = urlParams.get("userId");

if (!orderId || !userId) {
    alert("Missing orderId or userId in URL");
    throw new Error("No orderId or userId provided");
}

// DOM elements
const domElements = {
    packageTitle: document.querySelector(".package-title"),
    packageShop: document.querySelector(".package-shop"),
    shoeBrand: document.getElementById("shoeBrand"),
    shoeType: document.getElementById("shoeType"),
    shoeGender: document.getElementById("shoeGender"),
    // Fixed meta-value selectors
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

    // Fixed delivery-info selectors
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

// Initialize the application
function init() {
    loadOrderData();
    // initMap();
}

// Load order data from Firebase
function loadOrderData() {
    const orderRef = ref(db, `AR_shoe_users/transactions/${userId}/${orderId}`);

    onValue(orderRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            alert("Order not found");
            return;
        }

        updateOrderInfo(data);
        updateShippingInfo(data);
        updateStatusUpdates(data.statusUpdates || {});
        updateDeliveryInfo(data);
    }, {
        onlyOnce: false
    });
}

function getShopDetailsByID(shopID) {
    return new Promise((resolve) => {
        const ShoporderRef = ref(db, `AR_shoe_users/shop/${shopID}`);
        onValue(ShoporderRef, (snapshot) => {
            const data = snapshot.val();
            resolve(data || null);
        }, { onlyOnce: true });
    });
}

// Update order information display
function updateOrderInfo(data) {
    console.log(data);
    if (domElements.packageTitle) {
        domElements.packageTitle.textContent = data.item?.name || "N/A";
    }

    if (domElements.packageShop) {
        domElements.packageShop.textContent = `From: ${data.item?.shopName || "Unknown Seller"}`;
    }

    // Add this section to update the package image
    const packageImage = document.getElementById('packageImage');
    if (packageImage && data.item?.imageUrl) {
        packageImage.src = data.item.imageUrl;
        packageImage.alt = data.item?.name || "Product Image";
        
        // Add error handling in case the image fails to load
        packageImage.onerror = function() {
            this.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png"; // Fallback image
        };
    } else if (packageImage) {
        // Set a default image if no image URL is provided
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
    
    // Fetch and display shoe details (brand, type, gender)
    fetchShoeDetails(data.item?.shoeId, data.item?.shopId);
}

// New function to fetch shoe details
function fetchShoeDetails(shoeId, shopId) {
    if (!shoeId || !shopId) return;
    
    const shoeRef = ref(db, `AR_shoe_users/shoe/${shopId}/${shoeId}`);
    
    onValue(shoeRef, (snapshot) => {
        const shoeData = snapshot.val();
        if (shoeData) {
            // Update the shoe details in the UI
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
    }, {
        onlyOnce: true
    });
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
    console.log(data);
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
            data.shippingInfo.zipCode || ''
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
    const sellerInfo = await getShopDetailsByID(data.item?.shopId);
    console.log(data.item?.shopId);
    console.log(data.item?.shopName);

    // Seller info
    if (domElements.shopName) {
        domElements.shopName.textContent = data.item?.shopName || "N/A";
    }

    if (domElements.shopAddress && sellerInfo) {
        const shopAddress = [
            sellerInfo.shopCity || '',
            ` ${sellerInfo.shopState}` || ''
        ];
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

// Helper function to format phone numbers
function formatPhoneNumber(phone) {
    if (!phone) return '';

    const digits = phone.replace(/\D/g, '');

    if (digits.length === 10) {
        // Format: 0XXX XXX XXXX
        return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
    }

    // Return unformatted if it doesn't match expected pattern
    return phone;
}

// Update status updates and timeline
function updateStatusUpdates(updates) {
    if (!domElements.timelineContainer) return;

    // Clear existing timeline items
    domElements.timelineContainer.innerHTML = "";

    // Convert updates object to array and sort by timestamp (newest first)
    const sortedUpdates = Object.values(updates)
        .sort((a, b) => b.timestamp - a.timestamp);

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
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// Initialize the application
init();

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