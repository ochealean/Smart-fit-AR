import {
    checkUserAuth,
    logoutUser,
    readData,
    readDataRealtime,
    updateData,
    auth,
    sendEmail
} from '../../firebaseMethods.js';

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Global variables
let userData = null;
let userId = null;
let shopLoggedin = null;
let roleLoggedin = null;
let sname = null;
let currentIssueId = null;
let currentUserEmail = null;
let currentPage = 1;
const rowsPerPage = 10;

// Initialize the page
async function initializeIssueReports() {
    const authStatus = await checkUserAuth();
    
    if (!authStatus.authenticated) {
        window.location.href = "/admin/html/admin_login.html";
        return;
    }

    userData = authStatus.userData;
    userId = authStatus.userId;

    // Load user profile and shop data
    await loadUserProfile();
    
    // Load issue reports
    await loadIssueReports();
    
    // Set up event listeners
    setupEventListeners();

    document.body.style.display = '';
}

// Load user profile and shop data
async function loadUserProfile() {
    try {
        // Check if user is employee
        const employeePath = `smartfit_AR_Database/employees/${userId}`;
        const employeeResult = await readData(employeePath);

        if (employeeResult.success) {
            const shopData = employeeResult.data;
            console.log("shopData: ", shopData);

            roleLoggedin = shopData.role;
            shopLoggedin = shopData.shopId;
            console.log("shopLoggedin: ", shopLoggedin);
            sname = shopData.shopName || '';
            updateProfileHeader(shopData);

            // Set role-based UI elements
            if (shopData.role.toLowerCase() === "manager") {
                getElement("addemployeebtn").style.display = "none";
            } else if (shopData.role.toLowerCase() === "salesperson") {
                getElement("addemployeebtn").style.display = "none";
                getElement("analyticsbtn").style.display = "none";
            }

        } else {
            // Check if user is shop owner
            const shopPath = `smartfit_AR_Database/shop/${userId}`;
            const shopResult = await readData(shopPath);

            if (shopResult.success) {
                const shopData = shopResult.data;
                roleLoggedin = "Shop Owner";
                sname = shopData.shopName || 'Shop Owner';
                shopLoggedin = userId;
                updateProfileHeader(shopData);
            } else {
                // User not found in employees or shop - redirect to login
                window.location.href = "/admin/html/admin_login.html";
                return;
            }
        }
    } catch (error) {
        console.error("Error loading user profile:", error);
        window.location.href = "/admin/html/admin_login.html";
    }
}

// Function to update profile header
function updateProfileHeader(userData) {
    const profilePicture = getElement('profilePicture');
    const userFullname = getElement('userFullname');

    if (!profilePicture || !userFullname) return;

    // Set profile name
    if (userData.name) {
        userFullname.textContent = userData.name;
    } else if (userData.shopName) {
        userFullname.textContent = userData.shopName;
    } else if (userData.ownerName) {
        userFullname.textContent = userData.ownerName;
    } else if (userData.firstName && userData.lastName) {
        userFullname.textContent = `${userData.firstName} ${userData.lastName}`;
    }

    // Set profile picture
    if (userData.profilePhoto && userData.profilePhoto.url) {
        profilePicture.src = userData.profilePhoto.url;
        profilePicture.onerror = function () {
            this.src = getDefaultAvatar();
        };
    } else if (userData.uploads && userData.uploads.shopLogo && userData.uploads.shopLogo.url) {
        profilePicture.src = userData.uploads.shopLogo.url;
        profilePicture.onerror = function () {
            this.src = getDefaultAvatar();
        };
    } else {
        profilePicture.src = getDefaultAvatar();
    }
}

function getDefaultAvatar() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23ddd'%3E%3Crect width='100' height='100'/%3E%3Ctext x='50%' y='50%' font-size='20' text-anchor='middle' dominant-baseline='middle' fill='%23666'%3EProfile%3C/text%3E%3C/svg%3E";
}

// Load issue reports - FIXED VERSION
async function loadIssueReports() {
    const issuesPath = 'smartfit_AR_Database/issueReports';
    const issueTableBody = getElement("issueReportsTableBody");

    // Show loading state
    issueTableBody.innerHTML = '<tr><td colspan="9">Loading issue reports...</td></tr>';

    // Use readDataRealtime for real-time updates
    const unsubscribe = readDataRealtime(issuesPath, (result) => {
        if (!result.success) {
            issueTableBody.innerHTML = '<tr><td colspan="9">Error loading issue reports</td></tr>';
            console.error('Error loading issues:', result.error);
            return;
        }

        issueTableBody.innerHTML = '';

        if (!result.data) {
            issueTableBody.innerHTML = '<tr><td colspan="9">No issue reports found</td></tr>';
            return;
        }

        // Convert object to array and flatten the structure
        const issues = result.data;
        console.log("Loaded issues structure:", issues);
        
        // Flatten the nested structure
        const allIssues = [];
        Object.keys(issues).forEach(userId => {
            const userIssues = issues[userId];
            Object.keys(userIssues).forEach(issueId => {
                const issue = userIssues[issueId];
                issue.fullId = `${userId}/${issueId}`; // Store the full path for reference
                issue.userId = userId; // Store the user ID separately
                allIssues.push({
                    id: issueId,
                    userId: userId,
                    data: issue
                });
            });
        });

        console.log("Flattened issues:", allIssues);

        if (allIssues.length === 0) {
            issueTableBody.innerHTML = '<tr><td colspan="9">No issue reports found</td></tr>';
            return;
        }

        // Sort by timestamp (newest first)
        allIssues.sort((a, b) => {
            const timeA = a.data.timestamp || a.data.dateAdded || 0;
            const timeB = b.data.timestamp || b.data.dateAdded || 0;
            return timeB - timeA;
        });

        // Create rows for each issue
        allIssues.forEach(issueObj => {
            const row = createIssueRow(issueObj.id, issueObj.data, issueObj.userId);
            issueTableBody.appendChild(row);
        });

        setupPagination();
    });

    return unsubscribe;
}

function createIssueRow(issueId, issue, userId) {
    const row = document.createElement('tr');
    row.className = 'animate-fade';
    row.setAttribute('data-id', issueId);
    row.setAttribute('data-userid', userId);

    // Format status with appropriate class
    const statusClass = `status-${issue.status || 'pending'}`;
    const statusText = issue.status ?
        issue.status.charAt(0).toUpperCase() + issue.status.slice(1) :
        'Pending';

    // Create photos preview - FIXED: Check for photoURLs array
    let photosHTML = 'No photos';
    if (issue.photoURLs && Array.isArray(issue.photoURLs) && issue.photoURLs.length > 0) {
        photosHTML = issue.photoURLs.map(photoObj => {
            // Handle both string URLs and object with url property
            const photoUrl = typeof photoObj === 'string' ? photoObj : (photoObj.url || '');
            if (photoUrl) {
                return `<img src="${photoUrl}" class="photo-thumbnail" alt="Issue photo" data-url="${photoUrl}" onerror="this.style.display='none'">`;
            }
            return '';
        }).filter(html => html !== '').join('');
        
        if (!photosHTML) {
            photosHTML = 'No photos';
        }
    }

    // Truncate description for table view - FIXED: Handle null/undefined
    const description = issue.description || 'No description provided';
    const truncatedDesc = description.length > 50 ?
        description.substring(0, 50) + '...' :
        description;

    // Format date - FIXED: Handle different date formats
    const timestamp = issue.timestamp || issue.dateAdded;
    const displayDate = formatDisplayDate(timestamp);

    row.innerHTML = `
        <td>${issueId.substring(0, 8)}...</td>
        <td>${issue.orderID || 'N/A'}</td>
        <td>${userId ? userId.substring(0, 8) + '...' : 'N/A'}</td>
        <td>${getIssueTypeLabel(issue.issueType)}</td>
        <td>
            <div class="issue-description" title="${description}">
                ${truncatedDesc}
            </div>
        </td>
        <td>${photosHTML}</td>
        <td class="${statusClass}">${statusText}</td>
        <td>${displayDate}</td>
        <td>
            <button class="view-btn" data-id="${issueId}" data-userid="${userId}"><i class="fas fa-eye"></i> View</button>
            <button class="response-btn" data-id="${issueId}" data-userid="${userId}"><i class="fas fa-reply"></i> Respond</button>
        </td>
    `;

    // Add event listeners to buttons - FIXED: Pass userId
    row.querySelector('.view-btn')?.addEventListener('click', (e) => {
        const issueId = e.currentTarget.getAttribute('data-id');
        const userId = e.currentTarget.getAttribute('data-userid');
        showIssueDetails(e, issueId, userId);
    });
    
    row.querySelector('.response-btn')?.addEventListener('click', (e) => {
        const issueId = e.currentTarget.getAttribute('data-id');
        const userId = e.currentTarget.getAttribute('data-userid');
        showResponseDialog(e, issueId, userId);
    });

    // Add click event to photo thumbnails to view larger
    row.querySelectorAll('.photo-thumbnail').forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = img.getAttribute('data-url');
            if (url) {
                window.open(url, '_blank');
            }
        });
    });

    return row;
}

function getIssueTypeLabel(type) {
    const types = {
        'damaged': 'Damaged Product',
        'wrong_item': 'Wrong Item',
        'missing_item': 'Missing Item',
        'quality': 'Quality Issue',
        'other': 'Other'
    };
    return types[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown');
}

// Set up event listeners
function setupEventListeners() {
    // Logout functionality
    const logoutBtn = getElement('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
            if (confirm('Are you sure you want to logout?')) {
                const result = await logoutUser();
                if (result.success) {
                    window.location.href = '/login.html';
                } else {
                    console.error('Error signing out:', result.error);
                }
            }
        });
    }

    getElement('cancelLogout')?.addEventListener('click', function () {
        getElement('logoutDialog').classList.remove('show');
        getElement('overlay').classList.remove('show');
    });

    getElement('confirmLogout')?.addEventListener('click', function () {
        logoutUser().then(result => {
            if (result.success) {
                window.location.href = '/admin/html/admin_login.html';
            } else {
                showNotification(`Logout failed: ${result.error}`, "error");
            }
        });
    });

    // Response dialog buttons
    getElement("confirmResponse")?.addEventListener("click", submitResponse);
    getElement("cancelResponse")?.addEventListener("click", hideResponseDialog);

    // Modal close button
    getElement("closeIssueModal")?.addEventListener("click", () => {
        getElement("issueDetailsModal").classList.remove("show");
        getElement("overlay").classList.remove("show");
    });

    // Pagination
    getElement("prevBtn")?.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            setupPagination();
        }
    });

    getElement("nextBtn")?.addEventListener("click", () => {
        const rows = getElement("issueReportsTableBody").querySelectorAll("tr");
        const pageCount = Math.ceil(rows.length / rowsPerPage);

        if (currentPage < pageCount) {
            currentPage++;
            setupPagination();
        }
    });

    // Search functionality
    getElement("searchBtn")?.addEventListener("click", performSearch);
    getElement("clearSearchBtn")?.addEventListener("click", clearSearch);
    getElement("searchInput")?.addEventListener("keyup", (e) => {
        if (e.key === "Enter") performSearch();
    });

    // Overlay click
    getElement('overlay')?.addEventListener('click', function () {
        getElement('responseDialog').classList.remove('show');
        getElement('issueDetailsModal').classList.remove('show');
        getElement('logoutDialog').classList.remove('show');
        this.classList.remove('show');
    });
}

// FIXED: Added userId parameter
async function showIssueDetails(e, issueId, userId) {
    e.preventDefault();
    currentIssueId = issueId;

    // FIXED: Use the correct path with userId
    const issuePath = `smartfit_AR_Database/issueReports/${userId}/${issueId}`;

    try {
        const result = await readData(issuePath);

        if (result.success) {
            const issue = result.data;
            updateIssueModalContent(issueId, issue, userId);
            getElement('issueDetailsModal').classList.add('show');
            getElement('overlay').classList.add('show');
        } else {
            showNotification("Issue report not found", "error");
        }
    } catch (error) {
        showNotification(`Error loading issue: ${error.message}`, "error");
    }
}

// FIXED: Added userId parameter
function updateIssueModalContent(issueId, issue, userId) {
    console.log("Issue data:", issue);
    const modalContent = getElement('modalIssueContent');
    const modalTitle = getElement('modalIssueTitle');

    modalTitle.textContent = `Issue Report #${issueId.substring(0, 8)}`;

    // Format photos if they exist - FIXED: Better handling
    let photosHTML = '<p>No photos submitted</p>';
    if (issue.photoURLs && Array.isArray(issue.photoURLs) && issue.photoURLs.length > 0) {
        const validPhotos = issue.photoURLs.filter(photoObj => {
            const photoUrl = typeof photoObj === 'string' ? photoObj : (photoObj.url || '');
            return photoUrl && photoUrl !== '';
        });

        if (validPhotos.length > 0) {
            photosHTML = validPhotos.map(photoObj => {
                const photoUrl = typeof photoObj === 'string' ? photoObj : photoObj.url;
                return `<div class="document-item">
                    <a href="${photoUrl}" target="_blank" class="document-preview">
                        <img src="${photoUrl}" alt="Issue photo" style="max-height: 200px; max-width: 100%;" onerror="this.style.display='none'">
                    </a>
                </div>`;
            }).join('');
        }
    }

    // Format admin responses if they exist - FIXED: Check for shopResponse
    let responsesHTML = '<p>No responses yet</p>';
    if (issue.shopResponse && typeof issue.shopResponse === 'object') {
        responsesHTML = Object.entries(issue.shopResponse).map(([timestamp, response]) => `
            <div class="response-item">
                <div class="response-header">
                    <span class="response-date">${formatDisplayDate(parseInt(timestamp))}</span>
                    <span class="response-status">Status: ${response.status || 'Unknown'}</span>
                </div>
                <div class="response-message">${response.message || 'No message'}</div>
                <div class="response-shop">By: ${response.shopName || 'Shop'}</div>
            </div>
        `).join('');
    }

    modalContent.innerHTML = `
        <div class="modal-section">
            <h3>Issue Information</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Order ID: </span>
                    <span class="info-value">${issue.orderID || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">User ID: </span>
                    <span class="info-value">${userId || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Customer Email: </span>
                    <span class="info-value">${issue.customerEmail || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Issue Type: </span>
                    <span class="info-value">${getIssueTypeLabel(issue.issueType)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Current Status: </span>
                    <span class="info-value ${`status-${issue.status || 'pending'}`}">
                        ${issue.status ? issue.status.charAt(0).toUpperCase() + issue.status.slice(1) : 'Pending'}
                    </span>
                </div>
                <div class="info-item">
                    <span class="info-label">Date Reported: </span>
                    <span class="info-value">${formatDisplayDate(issue.timestamp || issue.dateAdded)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Resolved: </span>
                    <span class="info-value">${issue.resolved ? 'Yes' : 'No'}</span>
                </div>
            </div>
        </div>
        
        <div class="modal-section">
            <h3>Issue Description</h3>
            <div class="issue-description-full">
                ${issue.description || 'No description provided'}
            </div>
        </div>
        
        <div class="modal-section">
            <h3>Submitted Photos</h3>
            <div class="document-grid">
                ${photosHTML}
            </div>
        </div>
        
        <div class="modal-section">
            <h3>Shop Responses</h3>
            <div class="responses-container">
                ${responsesHTML}
            </div>
        </div>
    `;
}

// FIXED: Added userId parameter
async function showResponseDialog(e, issueId, userId) {
    e.preventDefault();
    e.stopPropagation();

    currentIssueId = issueId;
    getElement('customerResponse').value = '';
    getElement('responseStatus').value = 'processing';

    try {
        // FIXED: Use correct path with userId
        const issuePath = `smartfit_AR_Database/issueReports/${userId}/${issueId}`;
        const issueResult = await readData(issuePath);
        console.log("Issue result:", issueResult);

        if (!issueResult.success) {
            showNotification("Issue report not found", "error");
            return;
        }

        const issue = issueResult.data;

        // Get user email - FIXED: Check multiple possible sources
        let userEmail = issue.customerEmail || '';
        
        // Also try to get email from customers node
        if (!userEmail) {
            const userPath = `smartfit_AR_Database/customers/${userId}`;
            const userResult = await readData(userPath);

            if (userResult.success) {
                const userData = userResult.data;
                userEmail = userData.email || '';
            }
        }

        currentUserEmail = userEmail;

        getElement('dialogMessage').textContent =
            `Respond to issue report for Order #${issue.orderID || 'Unknown'}`;
        getElement('responseDialog').classList.add('show');
        getElement('overlay').classList.add('show');

    } catch (error) {
        showNotification(`Error preparing response: ${error.message}`, "error");
    }
}

function hideResponseDialog() {
    getElement('responseDialog').classList.remove('show');
    getElement('overlay').classList.remove('show');
    currentIssueId = null;
    currentUserEmail = null;
}

async function submitResponse() {
    const responseText = getElement('customerResponse').value.trim();
    const newStatus = getElement('responseStatus').value;
    console.log(newStatus);

    if (!responseText) {
        // Add visual feedback to the textarea
        const customerResponse = getElement('customerResponse');
        customerResponse.style.border = "2px solid red";
        customerResponse.focus();

        setTimeout(() => {
            customerResponse.style.border = "";
        }, 2000);
        showNotification("Please enter a response message", "error");
        return;
    }

    if (!currentIssueId) {
        showNotification("No issue selected", "error");
        return;
    }

    try {
        const timestamp = Date.now();
        // shopUserID is the ID of the shop owner/employee responding
        // shopName is the name of the shop
        const responseData = {
            message: responseText,
            status: newStatus,
            timestamp: timestamp,
            shopUserID: auth.currentUser.uid,
            shopName: sname || 'Admin'
        };

        // FIXED: Need to get the userId from the current row context
        // This is a limitation - we need to store the userId when opening the dialog
        // For now, we'll use a workaround by finding the row with currentIssueId
        const issueRow = document.querySelector(`tr[data-id="${currentIssueId}"]`);
        const userId = issueRow ? issueRow.getAttribute('data-userid') : null;
        
        if (!userId) {
            throw new Error("Could not determine user ID for this issue");
        }

        // Update the issue report with the new response - FIXED: Use correct path
        const updates = {
            [`shopResponse/${timestamp}`]: responseData,
            status: newStatus,
            resolved: newStatus === 'resolved',
            lastUpdated: new Date().toISOString()
        };

        const issuePath = `smartfit_AR_Database/issueReports/${userId}/${currentIssueId}`;
        const updateResult = await updateData(issuePath, updates);

        if (!updateResult.success) {
            throw new Error(updateResult.error);
        }

        console.log(`Would send email to ${currentUserEmail} about status: ${newStatus}`);
        console.log('sname:', sname);
        console.log('customerResponse:', responseText);

        // Send email notification to user if email is available
        if (currentUserEmail) {
            sendEmail(currentUserEmail, responseText, sname, 'maZuEJjFTiKrGZ4vX', 'service_n28x5fo', 'template_yp9a4ph')
                .then(result => {
                    if (result && !result.success) {
                        console.warn('Email sending failed (non-critical):', result.error);
                    } else {
                        console.log('Issue Report email sent successfully');
                    }
                })
                .catch(error => {
                    console.error('Email sending error:', error);
                });
        }

        showNotification("Response submitted successfully", "success");
        hideResponseDialog();
    } catch (error) {
        console.error("Error submitting response:", error);
        showNotification(`Failed to submit response: ${error.message}`, "error");
    }
}

// Search functionality
function performSearch() {
    const searchTerm = getElement('searchInput').value.trim().toLowerCase();
    const issueTableBody = getElement("issueReportsTableBody");

    if (!searchTerm) {
        clearSearch();
        return;
    }

    const rows = issueTableBody.querySelectorAll("tr");
    let hasResults = false;

    rows.forEach(row => {
        const rowData = row.textContent.toLowerCase();
        if (rowData.includes(searchTerm)) {
            row.style.display = '';
            hasResults = true;
        } else {
            row.style.display = 'none';
        }
    });

    if (!hasResults) {
        showNotification("No matching issues found", "info");
    }

    currentPage = 1;
    setupPagination();
}

function clearSearch() {
    getElement('searchInput').value = '';
    const issueTableBody = getElement("issueReportsTableBody");
    const rows = issueTableBody.querySelectorAll("tr");
    rows.forEach(row => row.style.display = '');
    currentPage = 1;
    setupPagination();
}

// Pagination functions
function setupPagination() {
    const issueTableBody = getElement("issueReportsTableBody");
    const paginationContainer = document.querySelector(".pagination");
    const rows = issueTableBody.querySelectorAll("tr:not([style*='display: none'])");
    const pageCount = Math.ceil(rows.length / rowsPerPage);

    // Clear existing page buttons
    const existingPageButtons = paginationContainer.querySelectorAll(".page-btn");
    existingPageButtons.forEach(btn => btn.remove());

    // Add page buttons
    for (let i = 1; i <= pageCount; i++) {
        const pageBtn = document.createElement("button");
        pageBtn.className = "pagination-btn page-btn";
        pageBtn.textContent = i;

        if (i === currentPage) {
            pageBtn.classList.add("active");
        }

        pageBtn.addEventListener("click", () => {
            currentPage = i;
            updateTableDisplay();
            updatePaginationButtons();
        });

        paginationContainer.insertBefore(pageBtn, getElement("nextBtn"));
    }

    updateTableDisplay();
    updatePaginationButtons();
}

function updateTableDisplay() {
    const issueTableBody = getElement("issueReportsTableBody");
    const rows = issueTableBody.querySelectorAll("tr:not([style*='display: none'])");
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    rows.forEach((row, index) => {
        row.style.display = (index >= startIndex && index < endIndex) ? '' : 'none';
    });
}

function updatePaginationButtons() {
    const issueTableBody = getElement("issueReportsTableBody");
    const prevBtn = getElement("prevBtn");
    const nextBtn = getElement("nextBtn");
    const rows = issueTableBody.querySelectorAll("tr:not([style*='display: none'])");
    const pageCount = Math.ceil(rows.length / rowsPerPage);

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === pageCount || pageCount === 0;
}

function formatDisplayDate(timestamp) {
    if (!timestamp) return 'N/A';

    // Handle both string timestamps and numeric timestamps
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';

    // Format time (1:19 AM)
    const timeString = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    // Format date (April 19, 2025)
    const month = date.toLocaleString('default', { month: 'long' });
    const day = date.getDate();
    const year = date.getFullYear();

    return `${timeString} ${month} ${day}, ${year}`;
}

function showNotification(message, type) {
    const notification = getElement('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.className = 'notification';
    notification.classList.add(type);
    notification.style.display = 'flex';
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.style.display = 'none';
        }, 500);
    }, 3000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize issue reports page
    initializeIssueReports().catch(error => {
        console.error('Error initializing issue reports page:', error);
        const issueTableBody = getElement("issueReportsTableBody");
        if (issueTableBody) {
            issueTableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        Error loading issue reports. Please try refreshing the page.
                    </td>
                </tr>
            `;
        }
    });
});

// Make functions available globally if needed
window.showIssueDetails = showIssueDetails;
window.showResponseDialog = showResponseDialog;