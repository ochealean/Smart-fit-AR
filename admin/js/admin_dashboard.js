import { readDataRealtime, logoutUser, updateData, checkUserAuth, sendEmail } from '../../firebaseMethods.js';

// Global variables
let currentAction = null;
let currentRow = null;
let currentShopId = null;
let emailCell = null;
let email = null;
let shopName = null;

// DOM elements
const dialog = document.getElementById("confirmationDialog");
const overlay = document.getElementById("overlay");
const logoutDialog = document.getElementById('logoutDialog');
const menuBtn = document.querySelector(".menu-btn");
const navLinks = document.querySelector(".nav-links");
const modal = document.getElementById("ModalDialog");

/* UTILITY FUNCTIONS */

/**
 * Checks if a table is empty and displays a message if no rows are present
 */
function checkEmptyTable() {
    const tbody = document.querySelector('tbody');
    if (tbody && tbody.querySelectorAll('tr').length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No pending shops remaining</td></tr>';
    }
}

/**
 * Displays a notification message
 * @param {string} message - The text to display
 * @param {string} type - The notification type (success/error)
 */
function showNotification(message, type) {
    const notification = document.getElementById('notification');
    if (!notification) {
        console.error("Notification element not found!");
        return;
    }

    notification.textContent = message;
    notification.className = `notification ${type}`;

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.className = 'notification';
        }, 400);
    }, 3000);
}

/**
 * Updates confirmation dialog content based on action type
 * @param {Object} shop - Shop data object
 * @param {string} actionType - 'approve' or 'reject'
 * @param {HTMLElement} currentRow - The table row being acted upon
 */
function updateDialogContent(shop, actionType, currentRow) {
    const dialogMessage = document.getElementById("dialogMessage");
    const confirmBtn = document.getElementById("confirmAction");
    const rejectionInput = document.getElementById("rejectionReason");

    if (!dialogMessage || !confirmBtn || !rejectionInput) {
        console.error("Confirmation dialog elements missing in DOM");
        return;
    }

    const confirmIcon = confirmBtn.querySelector('i');
    const actionText = confirmBtn.querySelector('.action-text');
    
    const username = shop.username || 'N/A';
    shopName = shop.shopName || 'Unknown Shop';

    dialogMessage.textContent = `Are you sure you want to ${actionType} "${shopName}" (${username})?`;

    if (actionType === 'approve') {
        confirmIcon.className = 'fas fa-check';
        actionText.textContent = 'Approve';
        confirmBtn.className = 'approve-btn';
        rejectionInput.style.display = 'none';
    } else {
        emailCell = currentRow.querySelector('td:nth-child(4)');
        email = emailCell?.textContent?.trim() || '';
        console.log('Email:', email);

        confirmIcon.className = 'fas fa-ban';
        actionText.textContent = 'Reject';
        confirmBtn.className = 'reject-btn';
        rejectionInput.style.display = 'block';
        rejectionInput.value = '';
    }
}


/**
 * Shows the confirmation dialog and overlay
 */
function showDialog() {
    dialog?.classList.add("show");
    overlay?.classList.add("show");
}

/**
 * Hides all dialogs and resets state
 */
function hideDialog() {
    document.getElementById('shopDetailsModal')?.classList.remove('show');
    dialog?.classList.remove("show");
    overlay?.classList.remove("show");
    modal?.classList.remove("show");
    currentAction = null;
    currentRow = null;
    currentShopId = null;
}

/* SHOP DETAILS MODAL FUNCTIONS */

/**
 * Shows the shop details modal and loads data from Firebase
 * @param {Event} e - Click event
 */
function showShopModal(e) {
    e.preventDefault();

    const viewLink = e.target.closest('.view-link');
    if (!viewLink) return;

    currentShopId = viewLink.getAttribute('data-id');
    const shopPath = `smartfit_AR_Database/shop/${currentShopId}`;

    // Use readDataRealtime for real-time updates (no unsubscribe needed for modal)
    readDataRealtime(shopPath, (result) => {
        if (result.success) {
            const shop = result.data;
            const safeShop = {
                ...shop,
                uploads: shop.uploads || {
                    ownerIdFront: { url: '' },
                    ownerIdBack: { url: '' },
                    businessLicense: { url: '' },
                    permitDocument: { url: '' }
                },
                shopCategory: shop.shopCategory || 'N/A',
                shopAddress: shop.shopAddress || 'N/A',
                ownerPhone: shop.ownerPhone || '',
                shopCity: shop.shopCity || '',
                shopState: shop.shopState || '',
                shopCountry: shop.shopCountry || '',
                shopZip: shop.shopZip || ''
            };
            updateShopModalContent(safeShop);
            document.getElementById('shopDetailsModal').classList.add('show');
            document.getElementById('overlay').classList.add('show');
        } else {
            showNotification("Shop data not found", "error");
        }
    });
}

/**
 * Updates modal content with shop details including maps and additional documents
 * @param {Object} shop - Complete shop data object
 */
function updateShopModalContent(shop) {
    const modalContent = document.getElementById('modalShopContent');
    const getDocUrl = (doc) => shop.uploads?.[doc]?.url || 'no-document.png';
    
    // Format categories for display
    const categories = Array.isArray(shop.shopCategories) 
        ? shop.shopCategories.join(', ') 
        : shop.shopCategory || 'N/A';

    modalContent.innerHTML = `
        <div class="modal-section">
            <h3>Basic Information</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Shop ID: </span>
                    <span class="info-value">${currentShopId}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Shop Name: </span>
                    <span class="info-value">${shop.shopName || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Categories: </span>
                    <span class="info-value">${categories}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Years in Business: </span>
                    <span class="info-value">${shop.yearsInBusiness || 'N/A'}</span>
                </div>
                <div class="info-item full-width">
                    <span class="info-label">Description: </span>
                    <span class="info-value">${shop.shopDescription || 'N/A'}</span>
                </div>
            </div>
        </div>

        <div class="modal-section">
            <h3>Owner Information</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Name: </span>
                    <span class="info-value">${shop.ownerName || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email: </span>
                    <span class="info-value">${shop.email || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Phone: </span>
                    <span class="info-value">${shop.ownerPhone ? '+63 ' + shop.ownerPhone : 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Username: </span>
                    <span class="info-value">${shop.username || 'N/A'}</span>
                </div>
            </div>
        </div>

        <div class="modal-section">
            <h3>Location Details</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Address: </span>
                    <span class="info-value">${shop.shopAddress || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">City: </span>
                    <span class="info-value">${shop.shopCity || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Province: </span>
                    <span class="info-value">${shop.shopState || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">ZIP Code: </span>
                    <span class="info-value">${shop.shopZip || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Country: </span>
                    <span class="info-value">${shop.shopCountry || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Tax ID: </span>
                    <span class="info-value">${shop.taxId || 'N/A'}</span>
                </div>
            </div>
        </div>

        ${shop.latitude && shop.longitude ? `
        <div class="modal-section">
            <h3>Shop Location on Map</h3>
            <div class="map-coordinates">
                <div class="coordinates-display">
                    <span class="coord-label">Latitude: </span>
                    <span class="coord-value">${parseFloat(shop.latitude).toFixed(6)}</span>
                    <span class="coord-label">Longitude: </span>
                    <span class="coord-value">${parseFloat(shop.longitude).toFixed(6)}</span>
                </div>
                <div id="shopLocationMap" class="shop-map" data-lat="${shop.latitude}" data-lng="${shop.longitude}"></div>
            </div>
        </div>
        ` : ''}

        <div class="modal-section">
            <h3>Government ID Verification</h3>
            <div class="document-grid">
                ${renderDocumentItem(getDocUrl('ownerIdFront'), 'Front ID')}
                ${renderDocumentItem(getDocUrl('ownerIdBack'), 'Back ID')}
            </div>
        </div>

        <div class="modal-section">
            <h3>Business Documentation</h3>
            <div class="document-grid">
                ${renderDocumentItem(getDocUrl('businessLicense'), 'Mayor\'s Permit / Business License')}
                ${renderDocumentItem(getDocUrl('permitDocument'), 'Business Permit')}
                ${renderDocumentItem(getDocUrl('dtiDocument'), 'DTI Registration Document')}
                ${renderDocumentItem(getDocUrl('birDocument'), 'BIR Registration Document')}
            </div>
        </div>

        <div class="modal-section">
            <h3>Application Timeline</h3>
            <div class="timestamp-section">
                <div class="info-item">
                    <span class="info-label">Date Registered: </span>
                    <span class="info-value">${formatDisplayDate(shop.dateProcessed) || 'N/A'}</span>
                </div>
                ${shop.status === 'approved' ? `
                <div class="info-item">
                    <span class="info-label">Date Approved: </span>
                    <span class="info-value">${formatDisplayDate(shop.dateApproved) || 'N/A'}</span>
                </div>
                ` : ''}
                ${shop.status === 'rejected' ? `
                <div class="info-item">
                    <span class="info-label">Date Rejected: </span>
                    <span class="info-value">${formatDisplayDate(shop.dateRejected) || 'N/A'}</span>
                </div>
                ` : ''}
            </div>
            ${shop.status === 'rejected' ? `
            <div class="info-item full-width">
                <span class="info-label">Reason for Rejection: </span>
                <span class="info-value rejection-reason">${shop.rejectionReason || 'No reason provided'}</span>
            </div>
            ` : ''}
        </div>
    `;

    // Initialize map if coordinates exist
    if (shop.latitude && shop.longitude) {
        setTimeout(() => initializeShopMap(shop.latitude, shop.longitude), 100);
    }
}

/**
 * Initialize Google Map for shop location
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 */
function initializeShopMap(lat, lng) {
    const mapElement = document.getElementById('shopLocationMap');
    if (!mapElement) return;

    try {
        const position = { lat: parseFloat(lat), lng: parseFloat(lng) };
        
        const map = new google.maps.Map(mapElement, {
            center: position,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "on" }]
                }
            ]
        });

        new google.maps.Marker({
            position: position,
            map: map,
            title: "Shop Location",
            animation: google.maps.Animation.DROP
        });

        // Add info window with coordinates
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div class="map-info-window">
                    <strong>Shop Location</strong><br>
                    Lat: ${position.lat.toFixed(6)}<br>
                    Lng: ${position.lng.toFixed(6)}
                </div>
            `
        });

        // Open info window by default
        infoWindow.open(map, new google.maps.Marker({ position: position, map: map }));

    } catch (error) {
        console.error('Error initializing map:', error);
        mapElement.innerHTML = '<p class="map-error">Unable to load map. Coordinates: ' + lat + ', ' + lng + '</p>';
    }
}

/**
 * Formats ISO date string to readable format
 * @param {string} isoString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDisplayDate(isoString) {
    if (!isoString) return 'N/A';

    const date = new Date(isoString);
    if (isNaN(date)) return 'Invalid Date';

    const timeString = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const month = date.toLocaleString('default', { month: 'long' });
    const day = date.getDate();
    const year = date.getFullYear();

    return `${timeString} ${month} ${day}, ${year}`;
}

/**
 * Creates HTML for document preview items
 * @param {string} url - Document URL
 * @param {string} title - Document title
 * @returns {string} HTML string for document item
 */
function renderDocumentItem(url, title) {
    return `
    <div class="document-item">
        <div class="document-title">${title}</div>
        <a href="${url}" target="_blank" class="document-preview">
            <img src="${url}" alt="${title}" 
                 onerror="this.onerror=null;this.src='/images/no-document.png'">
        </a>
    </div>`;
}

/* SHOP MANAGEMENT FUNCTIONS */

/**
 * Shows confirmation dialog for approve/reject actions
 * @param {Event} e - Click event
 * @param {string} actionType - 'approve' or 'reject'
 */
function showConfirmationDialog(e, actionType) {
    e.preventDefault();
    currentShopId = e.currentTarget.getAttribute('data-id');
    currentAction = actionType;
    currentRow = e.currentTarget.closest("tr");

    const shopPath = `smartfit_AR_Database/shop/${currentShopId}`;

    const unsubscribe = readDataRealtime(shopPath, (result) => {
        if (result.success) {
            const shop = result.data;
            updateDialogContent(shop, actionType, currentRow);
            showDialog();
        } else {
            showNotification("Shop data not found", "error");
        }
    });
}

/**
 * Loads shops from Firebase and populates table
 * @param {string} status - Shop status (pending/approved/rejected)
 * @param {string} tableBodyId - ID of target table body
 */
function loadShops(status, tableBodyId) {
    const shopsPath = 'smartfit_AR_Database/shop';
    const tbody = document.getElementById(tableBodyId);

    if (!tbody) return;

    const unsubscribe = readDataRealtime(shopsPath, (result) => {
        tbody.innerHTML = '';

        if (!result.success || !result.data) {
            tbody.innerHTML = `<tr><td colspan="7">No shops found</td></tr>`;
            return;
        }

        let hasShops = false;
        const shops = result.data;

        Object.keys(shops).forEach((shopId) => {
            const shop = shops[shopId];
            if (shop.status === status) {
                hasShops = true;
                const row = createShopRow(shopId, shop, status);
                tbody.appendChild(row);
            }
        });

        if (!hasShops) {
            tbody.innerHTML = `<tr><td colspan="7">No ${status} shops found</td></tr>`;
        }
    });

    window[`unsubscribe_${tableBodyId}`] = unsubscribe;
}

/**
 * Creates a table row for shop data
 * @param {string} shopId - Firebase shop ID
 * @param {Object} shop - Shop data object
 * @param {string} status - Current shop status
 * @returns {HTMLElement} Table row element
 */
function createShopRow(shopId, shop, status) {
    const row = document.createElement('tr');
    row.className = 'animate-fade';
    row.setAttribute('data-id', shopId);

    const maxLength = 10;
    const reasonText = shop.rejectionReason || 'No reason provided';
    const shortenedText = reasonText.length > maxLength ? reasonText.substring(0, maxLength) + '...' : reasonText;

    row.innerHTML = `
        <td title="${shopId}">${shopId.substring(0, 6)}...</td>
        <td>${shop.shopName || 'N/A'}</td>
        <td>${shop.ownerName || 'N/A'}</td>
        <td>${shop.email || 'N/A'}</td>
        <td><a href="#" data-id="${shopId}" class="view-link"><i class="fas fa-eye"></i> View</a></td>
        <td>${shop.dateProcessed ? formatDisplayDate(shop.dateProcessed) : 'Pending'}</td>
        ${status === 'rejected' ? `<td title="${shortenedText}">${shortenedText || 'No reason'}</td>` : ''}
        <td>
            ${status === 'pending' ?
            `<button class="approve-btn" data-id="${shopId}"><i class="fas fa-check"></i> Approve</button>
                 <button class="reject-btn" data-id="${shopId}"><i class="fas fa-ban"></i> Reject</button>` :
            status === 'approved' ?
                `<button class="reject-btn" data-id="${shopId}"><i class="fas fa-ban"></i> Reject</button>` :
                `<button class="approve-btn" data-id="${shopId}"><i class="fas fa-check"></i> Approve</button>`}
        </td>
    `;

    row.querySelector('.approve-btn')?.addEventListener('click', (e) => showConfirmationDialog(e, 'approve'));
    row.querySelector('.reject-btn')?.addEventListener('click', (e) => showConfirmationDialog(e, 'reject'));
    row.querySelector('.view-link')?.addEventListener('click', (e) => e.preventDefault());

    return row;
}

/* EVENT HANDLERS */

/**
 * Initializes all event listeners
 */
function initializeEventListeners() {
    document.getElementById('closeShopModal')?.addEventListener('click', function () {
        document.getElementById('shopDetailsModal').classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
    });

    // Menu toggle
    menuBtn?.addEventListener("click", function () {
        navLinks?.classList.toggle("active");
    });

    // Action confirmation
    document.getElementById("confirmAction")?.addEventListener("click", function () {
        if (!currentAction || !currentShopId) return;

        const rejectionInput = document.getElementById("rejectionReason");
        let reason = null;

        if (currentAction === "reject") {
            reason = rejectionInput.value.trim();
            if (!reason) {
                showNotification("Please provide a reason for rejection.", "error");
                rejectionInput.style.border = "2px solid red";
                rejectionInput.focus();
                setTimeout(() => {
                    rejectionInput.style.border = "";
                }, 2000);
                return;
            }
        }

        const shopPath = `smartfit_AR_Database/shop/${currentShopId}`;

        const updatePayload = {
            status: currentAction === "approve" ? "approved" : "rejected",
            dateProcessed: new Date().toISOString(),
            ...(currentAction === "approve" && { dateApproved: new Date().toISOString() }),
            ...(currentAction === "reject" && { dateRejected: new Date().toISOString() }),
            ...(reason && { rejectionReason: reason })
        };

        updateData(shopPath, updatePayload)
            .then((result) => {
                if (result.success) {
                    showNotification(`Shop ${currentAction}ed successfully!`, "success");
                    currentRow?.remove();
                    checkEmptyTable();

                    // Email sending logic (only for rejections)
                    if (currentAction === "reject") {
                        if (!email) {
                            console.warn('No email available for rejection notification');
                            hideDialog();
                            return;
                        }

                        sendEmail(email, reason, shopName, 'maZuEJjFTiKrGZ4vX', 'service_3vhu66j', 'template_20tf4tf')
                            .then(result => {
                                if (result && !result.success) {
                                    console.warn('Email sending failed (non-critical):', result.error);
                                } else {
                                    console.log('Rejection email sent successfully');
                                }
                            })
                            .catch(error => {
                                console.error('Email sending error:', error);
                            });
                    }

                } else {
                    throw new Error(result.error);
                }
            })
            .catch((error) => {
                showNotification(`Failed to ${currentAction} shop: ${error.message}`, "error");
            })
            .finally(() => {
                hideDialog();
            });
    });

    document.getElementById("cancelAction")?.addEventListener("click", hideDialog);

    overlay?.addEventListener('click', function () {
        document.getElementById('confirmationDialog')?.classList.remove('show');
        document.getElementById('shopDetailsModal')?.classList.remove('show');
        document.getElementById('logoutDialog')?.classList.remove('show');
        document.getElementById('ModalDialog')?.classList.remove('show');
        this.classList.remove('show');
        document.getElementById('rejectionReason').value = '';
        currentAction = null;
        currentRow = null;
        currentShopId = null;
    });

    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.view-link')) {
            showShopModal(e);
        }
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    checkUserAuth().then((authResult) => {
        if (!authResult.authenticated || authResult.role !== 'admin') {
            window.location.href = '/admin/html/admin_login.html';
            return;
        }

        initializeEventListeners();
        loadShops('pending', 'pendingShopsTableBody');
        loadShops('approved', 'approvedShopsTableBody');
        loadShops('rejected', 'rejectedShopsTableBody');

        // Logout functionality
        const logoutLink = document.querySelector('a[href="/admin/html/admin_login.html"]');
        const logoutDialog = document.getElementById('logoutDialog');
        const cancelLogout = document.getElementById('cancelLogout');
        const confirmLogout = document.getElementById('confirmLogout');

        logoutLink?.addEventListener('click', function (e) {
            e.preventDefault();
            logoutDialog.classList.add('show');
            document.getElementById('overlay').classList.add('show');
        });

        cancelLogout?.addEventListener('click', function () {
            logoutDialog.classList.remove('show');
            document.getElementById('overlay').classList.remove('show');
        });

        confirmLogout?.addEventListener('click', async function () {
            try {
                const result = await logoutUser();
                if (result.success) {
                    logoutDialog.classList.remove('show');
                    document.getElementById('overlay').classList.remove('show');
                    showNotification('Logged out successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = '/admin/html/admin_login.html';
                    }, 1000);
                } else {
                    showNotification('Logout failed: ' + result.error, 'error');
                }
            } catch (error) {
                showNotification('Logout error: ' + error.message, 'error');
            }
        });
    }).catch((error) => {
        console.error('Authentication check failed:', error);
        window.location.href = '/admin/html/admin_login.html';
    });
});