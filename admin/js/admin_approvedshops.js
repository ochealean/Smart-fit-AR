import { readDataRealtime, logoutUser, updateData, checkUserAuth, sendEmail } from '../../firebaseMethods.js';

// Global variables
let currentAction = null;
let currentRow = null;
let currentShopId = null;
let emailCell = null;
let email = null;
let shopName = null;
let currentPage = 1;
const rowsPerPage = 10;
let originalShops = [];
let filteredShops = [];

// DOM elements
const dialog = document.getElementById("confirmationDialog");
const overlay = document.getElementById("overlay");
const logoutDialog = document.getElementById('logoutDialog');
const menuBtn = document.querySelector(".menu-btn");
const navLinks = document.querySelector(".nav-links");
const tableBody = document.getElementById("approvedShopsTableBody");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const paginationContainer = document.querySelector(".pagination");
const searchInput = document.getElementById('shopSearch');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearch');

/* UTILITY FUNCTIONS */

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

    // Use readDataRealtime for real-time updates
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
 * Updates modal content with shop details
 * @param {Object} shop - Complete shop data object
 */
function updateShopModalContent(shop) {
    const modalContent = document.getElementById('modalShopContent');
    const getDocUrl = (doc) => shop.uploads[doc]?.url || 'no-document.png';

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
                    <span class="info-label">Category: </span>
                    <span class="info-value">${shop.shopCategory || 'N/A'}</span>
                </div>
                <div class="info-item">
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
            </div>
        </div>

        <div class="modal-section">
            <h3>Location Details</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Address: </span>
                    <span class="info-value">${[
                        shop.shopAddress,
                        shop.shopCity,
                        shop.shopState,
                        shop.shopCountry
                    ].filter(Boolean).join(', ') || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">ZIP Code: </span>
                    <span class="info-value">${shop.shopZip || 'N/A'}</span>
                </div>
            </div>
        </div>

        <div class="modal-section">
            <h3>Business Documents</h3>
            <div class="document-grid">
                ${renderDocumentItem(getDocUrl('ownerIdFront'), 'Front ID')}
                ${renderDocumentItem(getDocUrl('ownerIdBack'), 'Back ID')}
                ${renderDocumentItem(getDocUrl('businessLicense'), 'Business License')}
                ${renderDocumentItem(getDocUrl('permitDocument'), 'Permit')}
            </div>
        </div>

        <div class="modal-section">
            <h3>Timestamps</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Approval Date: </span>
                    <span class="info-value">${formatDisplayDate(shop.dateApproved) || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Date Processed: </span>
                    <span class="info-value">${formatDisplayDate(shop.dateProcessed) || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
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
 * Shows confirmation dialog for reject action
 * @param {Event} e - Click event
 */
function showConfirmationDialog(e) {
    e.preventDefault();
    currentShopId = e.currentTarget.getAttribute('data-id');
    currentAction = 'reject';
    currentRow = e.currentTarget.closest("tr");

    const shopPath = `smartfit_AR_Database/shop/${currentShopId}`;

    const unsubscribe = readDataRealtime(shopPath, (result) => {
        if (result.success) {
            const shop = result.data;
            updateDialogContent(shop);
            showDialog();
        } else {
            showNotification("Shop data not found", "error");
        }
    });
}

/**
 * Updates confirmation dialog content for rejection
 * @param {Object} shop - Shop data object
 */
function updateDialogContent(shop) {
    const dialogMessage = document.getElementById("dialogMessage");
    const rejectionInput = document.getElementById("rejectionReason");
    const rejectionContainer = document.getElementById("rejectionReasonContainer");

    if (!dialogMessage || !rejectionInput || !rejectionContainer) {
        console.error("Confirmation dialog elements missing in DOM");
        return;
    }

    shopName = shop.shopName || 'Unknown Shop';
    dialogMessage.textContent = `Are you sure you want to reject "${shopName}"?`;
    
    emailCell = currentRow.querySelector('td:nth-child(4)');
    email = emailCell?.textContent?.trim() || '';
    
    rejectionContainer.style.display = 'block';
    rejectionInput.value = '';
}

/**
 * Loads approved shops from Firebase and populates table
 */
function loadShops() {
    const shopsPath = 'smartfit_AR_Database/shop';
    const tbody = document.getElementById('approvedShopsTableBody');

    if (!tbody) return;

    const unsubscribe = readDataRealtime(shopsPath, (result) => {
        tbody.innerHTML = '';
        originalShops = [];

        if (!result.success || !result.data) {
            tbody.innerHTML = `<tr><td colspan="7">No shops found</td></tr>`;
            return;
        }

        let hasShops = false;
        const shops = result.data;

        Object.keys(shops).forEach((shopId) => {
            const shop = shops[shopId];
            if (shop.status === 'approved') {
                hasShops = true;
                const shopWithId = { ...shop, id: shopId };
                originalShops.push(shopWithId);
                const row = createShopRow(shopId, shop);
                tbody.appendChild(row);
            }
        });

        if (!hasShops) {
            tbody.innerHTML = `<tr><td colspan="7">No approved shops found</td></tr>`;
        }

        // Initialize filteredShops with all shops
        filteredShops = [...originalShops];
        
        // Setup pagination after loading data
        setupPagination();
    });

    window[`unsubscribe_approvedShopsTableBody`] = unsubscribe;
}

/**
 * Creates a table row for approved shop data
 * @param {string} shopId - Firebase shop ID
 * @param {Object} shop - Shop data object
 * @returns {HTMLElement} Table row element
 */
function createShopRow(shopId, shop) {
    const row = document.createElement('tr');
    row.className = 'animate-fade';
    row.setAttribute('data-id', shopId);

    row.innerHTML = `
        <td title="${shopId}">${shopId.substring(0, 6)}...</td>
        <td>${shop.shopName || 'N/A'}</td>
        <td>${shop.ownerName || 'N/A'}</td>
        <td>${shop.email || 'N/A'}</td>
        <td><a href="#" data-id="${shopId}" class="view-link"><i class="fas fa-eye"></i> View</a></td>
        <td>${shop.dateApproved ? formatDisplayDate(shop.dateApproved) : 'N/A'}</td>
        <td>
            <button class="reject-btn" data-id="${shopId}"><i class="fas fa-ban"></i> Reject</button>
        </td>
    `;

    row.querySelector('.reject-btn')?.addEventListener('click', (e) => showConfirmationDialog(e));
    row.querySelector('.view-link')?.addEventListener('click', (e) => e.preventDefault());

    return row;
}

/* PAGINATION FUNCTIONS */

/**
 * Updates table display based on current page
 */
function updateTableDisplay() {
    if (!tableBody) return;
    const rows = tableBody.querySelectorAll("tr");
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    rows.forEach((row, index) => {
        row.style.display = index >= startIndex && index < endIndex ? '' : 'none';
    });
}

/**
 * Updates pagination buttons state
 */
function updatePaginationButtons() {
    if (!tableBody) return;
    const rows = tableBody.querySelectorAll("tr");
    const pageCount = Math.ceil(rows.length / rowsPerPage);

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === pageCount || pageCount === 0;
}

/**
 * Creates a page button for pagination
 * @param {number} pageNumber - Page number
 */
function createPageButton(pageNumber) {
    const pageBtn = document.createElement("button");
    pageBtn.className = "pagination-btn page-btn";
    pageBtn.textContent = pageNumber;

    if (pageNumber === currentPage) {
        pageBtn.classList.add("active");
    }

    pageBtn.addEventListener("click", () => {
        currentPage = pageNumber;
        setupPagination();
    });

    paginationContainer.insertBefore(pageBtn, nextBtn);
}

/**
 * Sets up pagination controls
 */
function setupPagination() {
    const rows = document.querySelectorAll("#approvedShopsTableBody tr");
    const pageCount = Math.ceil(rows.length / rowsPerPage);

    // Clear existing page number buttons
    const existingPageButtons = paginationContainer.querySelectorAll(".page-btn");
    existingPageButtons.forEach(btn => btn.remove());

    // Add page number buttons
    const maxPageButtonsToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtonsToShow / 2));
    let endPage = Math.min(pageCount, startPage + maxPageButtonsToShow - 1);

    startPage = Math.max(1, endPage - maxPageButtonsToShow + 1);

    // Add page number buttons
    for (let i = startPage; i <= endPage; i++) {
        createPageButton(i);
    }

    updateTableDisplay();
    updatePaginationButtons();
}

/* SEARCH FUNCTIONALITY */

/**
 * Performs search based on user input
 * @param {string} searchTerm - Search term
 */
function performSearch(searchTerm) {
    const tbody = document.getElementById('approvedShopsTableBody');
    if (!tbody) return;

    if (!searchTerm.trim()) {
        filteredShops = [...originalShops];
    } else {
        filteredShops = originalShops.filter(shop => {
            const searchLower = searchTerm.toLowerCase();
            return (
                (shop.id && shop.id.toLowerCase().includes(searchLower)) ||
                (shop.shopName && shop.shopName.toLowerCase().includes(searchLower)) ||
                (shop.ownerName && shop.ownerName.toLowerCase().includes(searchLower)) ||
                (shop.email && shop.email.toLowerCase().includes(searchLower))
            );
        });
    }

    // Clear current table
    tbody.innerHTML = '';

    // Display filtered results
    if (filteredShops.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No matching shops found</td></tr>';
    } else {
        filteredShops.forEach(shop => {
            const row = createShopRow(shop.id, shop);
            tbody.appendChild(row);
        });
    }

    // Reset to first page after search
    currentPage = 1;
    setupPagination();
}

/**
 * Sets up search event listeners
 */
function setupSearchListeners() {
    searchBtn?.addEventListener('click', () => {
        performSearch(searchInput.value.trim());
    });

    clearSearchBtn?.addEventListener('click', () => {
        searchInput.value = '';
        performSearch('');
        showNotification("Search cleared", "success");
    });

    searchInput?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            performSearch(searchInput.value.trim());
        }
    });
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
        menuBtn.innerHTML = navLinks.classList.contains("active") ? 
            '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
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
            status: 'rejected',
            dateProcessed: new Date().toISOString(),
            dateRejected: new Date().toISOString(),
            rejectionReason: reason
        };

        updateData(shopPath, updatePayload)
            .then((result) => {
                if (result.success) {
                    showNotification(`Shop rejected successfully!`, "success");
                    currentRow?.remove();
                    
                    // Send rejection email
                    if (email) {
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
                showNotification(`Failed to reject shop: ${error.message}`, "error");
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

    // Pagination event listeners
    prevBtn?.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            setupPagination();
        }
    });

    nextBtn?.addEventListener("click", () => {
        if (!tableBody) return;
        const rows = tableBody.querySelectorAll("tr");
        const pageCount = Math.ceil(rows.length / rowsPerPage);

        if (currentPage < pageCount) {
            currentPage++;
            setupPagination();
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
        loadShops();
        setupSearchListeners();

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