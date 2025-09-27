import { 
    checkUserAuth, 
    logoutUser, 
    readData, 
    readDataRealtime, 
    updateData,
    auth
} from '../../firebaseMethods.js';

// Initialize EmailJS
emailjs.init('gBZ5mCvVmgjo7wn0W');

// Global variables
let currentIssueId = null;
let currentUserEmail = null;
let currentPage = 1;
const rowsPerPage = 10;
let shopLoggedin; // shop ID of the logged-in user
let roleLoggedin; // role of the logged-in user
let sname; //shop name

// DOM Elements
const issueTableBody = document.getElementById("issueReportsTableBody");
const responseDialog = document.getElementById("responseDialog");
const overlay = document.getElementById("overlay");
const adminResponse = document.getElementById("adminResponse");
const responseStatus = document.getElementById("responseStatus");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const paginationContainer = document.querySelector(".pagination");
const searchInput = document.getElementById("issueSearch");
const searchBtn = document.getElementById("searchBtn");
const clearSearchBtn = document.getElementById("clearSearch");

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    setupEventListeners();
    loadIssueReports();
});

async function checkAuthState() {
    try {
        const authResult = await checkUserAuth();
        
        if (!authResult.authenticated) {
            window.location.href = "/admin/html/admin_login.html";
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            window.location.href = "/admin/html/admin_login.html";
            return;
        }

        // Check if user is employee
        const employeePath = `smartfit_AR_Database/employees/${user.uid}`;
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
                document.getElementById("addemployeebtn").style.display = "none";
            } else if (shopData.role.toLowerCase() === "salesperson") {
                document.getElementById("addemployeebtn").style.display = "none";
                document.getElementById("analyticsbtn").style.display = "none";
            }

        } else {
            // Check if user is shop owner
            const shopPath = `smartfit_AR_Database/shop/${user.uid}`;
            const shopResult = await readData(shopPath);
            
            if (shopResult.success) {
                const shopData = shopResult.data;
                roleLoggedin = "Shop Owner";
                sname = shopData.shopName || 'Shop Owner';
                shopLoggedin = user.uid;
                updateProfileHeader(shopData);
            } else {
                // User not found in employees or shop - redirect to login
                window.location.href = "/admin/html/admin_login.html";
            }
        }
    } catch (error) {
        console.error("Error checking auth state:", error);
        window.location.href = "/admin/html/admin_login.html";
    }
}

// Function to update profile header
function updateProfileHeader(userData) {
    const profilePicture = document.getElementById('profilePicture');
    const userFullname = document.getElementById('userFullname');

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

    // Set profile picture - FIXED IMAGE RETRIEVAL
    if (userData.profilePhoto && userData.profilePhoto.url) {
        profilePicture.src = userData.profilePhoto.url;
        profilePicture.onerror = function() {
            this.src = getDefaultAvatar();
        };
    } else if (userData.uploads && userData.uploads.shopLogo && userData.uploads.shopLogo.url) {
        profilePicture.src = userData.uploads.shopLogo.url;
        profilePicture.onerror = function() {
            this.src = getDefaultAvatar();
        };
    } else {
        profilePicture.src = getDefaultAvatar();
    }
}

function getDefaultAvatar() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23ddd'%3E%3Crect width='100' height='100'/%3E%3Ctext x='50%' y='50%' font-size='20' text-anchor='middle' dominant-baseline='middle' fill='%23666'%3EProfile%3C/text%3E%3C/svg%3E";
}

function setupEventListeners() {
    // Response dialog buttons
    document.getElementById("confirmResponse")?.addEventListener("click", submitResponse);
    document.getElementById("cancelResponse")?.addEventListener("click", hideResponseDialog);

    // Modal close button
    document.getElementById("closeIssueModal")?.addEventListener("click", () => {
        document.getElementById("issueDetailsModal").classList.remove("show");
        overlay.classList.remove("show");
    });

    // Pagination
    prevBtn?.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            setupPagination();
        }
    });

    nextBtn?.addEventListener("click", () => {
        const rows = issueTableBody.querySelectorAll("tr");
        const pageCount = Math.ceil(rows.length / rowsPerPage);

        if (currentPage < pageCount) {
            currentPage++;
            setupPagination();
        }
    });

    // Search functionality
    searchBtn?.addEventListener("click", performSearch);
    clearSearchBtn?.addEventListener("click", clearSearch);
    searchInput?.addEventListener("keyup", (e) => {
        if (e.key === "Enter") performSearch();
    });

    // Logout functionality
    const logoutLink = document.querySelector('a[href="/admin/html/admin_login.html"]');
    logoutLink?.addEventListener('click', function (e) {
        e.preventDefault();
        document.getElementById('logoutDialog').classList.add('show');
        overlay.classList.add('show');
    });

    document.getElementById('cancelLogout')?.addEventListener('click', function () {
        document.getElementById('logoutDialog').classList.remove('show');
        overlay.classList.remove('show');
    });

    document.getElementById('confirmLogout')?.addEventListener('click', function () {
        logoutUser().then(result => {
            if (result.success) {
                window.location.href = '/admin/html/admin_login.html';
            } else {
                showNotification(`Logout failed: ${result.error}`, "error");
            }
        });
    });

    // Overlay click
    overlay?.addEventListener('click', function () {
        document.getElementById('responseDialog').classList.remove('show');
        document.getElementById('issueDetailsModal').classList.remove('show');
        document.getElementById('logoutDialog').classList.remove('show');
        this.classList.remove('show');
    });
}

function loadIssueReports() {
    const issuesPath = 'smartfit_AR_Database/issueReports';

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

        // Convert object to array and create rows
        const issues = result.data;
        Object.keys(issues).forEach(issueId => {
            const issue = issues[issueId];
            const row = createIssueRow(issueId, issue);
            issueTableBody.appendChild(row);
        });

        setupPagination();
    });

    // Return unsubscribe function if needed for cleanup
    return unsubscribe;
}

function createIssueRow(issueId, issue) {
    const row = document.createElement('tr');
    row.className = 'animate-fade';
    row.setAttribute('data-id', issueId);

    // Format status with appropriate class
    const statusClass = `status-${issue.status || 'pending'}`;
    const statusText = issue.status ?
        issue.status.charAt(0).toUpperCase() + issue.status.slice(1) :
        'Pending';

    // Create photos preview - FIXED IMAGE RETRIEVAL
    let photosHTML = 'No photos';
    if (issue.photoURLs && issue.photoURLs.length > 0) {
        photosHTML = issue.photoURLs.map(photoObj => {
            // Handle both string URLs and object with url property
            const photoUrl = typeof photoObj === 'string' ? photoObj : photoObj.url;
            return `<img src="${photoUrl}" class="photo-thumbnail" alt="Issue photo" data-url="${photoUrl}" onerror="this.style.display='none'">`;
        }).join('');
    }

    // Truncate description for table view
    const truncatedDesc = issue.description && issue.description.length > 50 ?
        issue.description.substring(0, 50) + '...' :
        issue.description || 'No description';

    row.innerHTML = `
        <td>${issueId.substring(0, 6)}...</td>
        <td>${issue.orderID ? issue.orderID.substring(0, 8) : 'N/A'}</td>
        <td>${issue.userID ? issue.userID.substring(0, 6) + '...' : 'N/A'}</td>
        <td>${getIssueTypeLabel(issue.issueType)}</td>
        <td>
            <div class="issue-description" title="${issue.description || ''}">
                ${truncatedDesc}
            </div>
        </td>
        <td>${photosHTML}</td>
        <td class="${statusClass}">${statusText}</td>
        <td>${formatDisplayDate(issue.timestamp)}</td>
        <td>
            <button class="view-btn" data-id="${issueId}"><i class="fas fa-eye"></i> View</button>
            <button class="response-btn" data-id="${issueId}"><i class="fas fa-reply"></i> Respond</button>
        </td>
    `;

    // Add event listeners to buttons
    row.querySelector('.view-btn')?.addEventListener('click', (e) => showIssueDetails(e, issueId));
    row.querySelector('.response-btn')?.addEventListener('click', (e) => showResponseDialog(e, issueId));

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
    return types[type] || type || 'Unknown';
}

async function showIssueDetails(e, issueId) {
    e.preventDefault();
    currentIssueId = issueId;

    const issuePath = `smartfit_AR_Database/issueReports/${issueId}`;

    try {
        const result = await readData(issuePath);
        
        if (result.success) {
            const issue = result.data;
            updateIssueModalContent(issueId, issue);
            document.getElementById('issueDetailsModal').classList.add('show');
            overlay.classList.add('show');
        } else {
            showNotification("Issue report not found", "error");
        }
    } catch (error) {
        showNotification(`Error loading issue: ${error.message}`, "error");
    }
}

function updateIssueModalContent(issueId, issue) {
    const modalContent = document.getElementById('modalIssueContent');
    const modalTitle = document.getElementById('modalIssueTitle');

    modalTitle.textContent = `Issue Report #${issueId.substring(0, 8)}`;

    // Format photos if they exist - FIXED IMAGE RETRIEVAL
    let photosHTML = '<p>No photos submitted</p>';
    if (issue.photoURLs && issue.photoURLs.length > 0) {
        photosHTML = issue.photoURLs.map(photoObj => {
            const photoUrl = typeof photoObj === 'string' ? photoObj : photoObj.url;
            return `<div class="document-item">
                <a href="${photoUrl}" target="_blank" class="document-preview">
                    <img src="${photoUrl}" alt="Issue photo" style="max-height: 200px;" onerror="this.style.display='none'">
                </a>
            </div>`;
        }).join('');
    }

    // Format admin responses if they exist
    let responsesHTML = '<p>No responses yet</p>';
    if (issue.adminResponses) {
        responsesHTML = Object.entries(issue.adminResponses).map(([timestamp, response]) => `
            <div class="response-item">
                <div class="response-header">
                    <span class="response-date">${formatDisplayDate(parseInt(timestamp))}</span>
                    <span class="response-status">Status: ${response.status}</span>
                </div>
                <div class="response-message">${response.message}</div>
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
                    <span class="info-value">${issue.userID || 'N/A'}</span>
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
                    <span class="info-value">${formatDisplayDate(issue.timestamp)}</span>
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
            <h3>Admin Responses</h3>
            <div class="responses-container">
                ${responsesHTML}
            </div>
        </div>
    `;
}

async function showResponseDialog(e, issueId) {
    e.preventDefault();
    e.stopPropagation();

    currentIssueId = issueId;
    adminResponse.value = '';
    responseStatus.value = 'processing';

    try {
        const issuePath = `smartfit_AR_Database/issueReports/${issueId}`;
        const issueResult = await readData(issuePath);
        
        if (!issueResult.success) {
            showNotification("Issue report not found", "error");
            return;
        }

        const issue = issueResult.data;

        // Get user email from users/customer node
        let userEmail = null;
        const userPath = `smartfit_AR_Database/customer/${issue.userID}`;
        const userResult = await readData(userPath);
        
        if (userResult.success) {
            const userData = userResult.data;
            userEmail = userData.email || userData.userEmail;
        }

        currentUserEmail = userEmail;

        document.getElementById('dialogMessage').textContent =
            `Respond to issue report for Order #${issue.orderID ? issue.orderID.substring(0, 8) : 'Unknown'}`;
        responseDialog.classList.add('show');
        overlay.classList.add('show');

    } catch (error) {
        showNotification(`Error preparing response: ${error.message}`, "error");
    }
}

function hideResponseDialog() {
    responseDialog.classList.remove('show');
    overlay.classList.remove('show');
    currentIssueId = null;
    currentUserEmail = null;
}

async function submitResponse() {
    const responseText = adminResponse.value.trim();
    const newStatus = responseStatus.value;

    if (!responseText) {
        // Add visual feedback to the textarea
        adminResponse.style.border = "2px solid red";
        adminResponse.focus();

        // Remove the red border after 2 seconds
        setTimeout(() => {
            adminResponse.style.border = "";
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
        const responseData = {
            message: responseText,
            status: newStatus,
            timestamp: timestamp,
            adminId: auth.currentUser.uid,
            adminName: sname || 'Admin'
        };

        // Update the issue report with the new response
        const updates = {
            [`adminResponses/${timestamp}`]: responseData,
            status: newStatus,
            resolved: newStatus === 'resolved',
            lastUpdated: new Date().toISOString()
        };

        const issuePath = `smartfit_AR_Database/issueReports/${currentIssueId}`;
        const updateResult = await updateData(issuePath, updates);

        if (!updateResult.success) {
            throw new Error(updateResult.error);
        }

        // Send email notification to user if email is available
        if (currentUserEmail) {
            try {
                const templateParams = {
                    to_email: currentUserEmail,
                    from_name: sname || 'Shoe Portal Admin',
                    subject: `Update on your issue report`,
                    message: `Your issue report has been updated. Status: ${newStatus}\n\nAdmin Response:\n${responseText}`,
                    reply_to: 'no-reply@shoeportal.com'
                };

                await emailjs.send('service_8i28mes', 'template_btslatu', templateParams);
                console.log('Notification email sent');
            } catch (emailError) {
                console.error('Failed to send email:', emailError);
                // Don't fail the whole operation if email fails
            }
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
    const searchTerm = searchInput.value.trim().toLowerCase();

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
    searchInput.value = '';
    const rows = issueTableBody.querySelectorAll("tr");
    rows.forEach(row => row.style.display = '');
    currentPage = 1;
    setupPagination();
}

// Pagination functions
function setupPagination() {
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

        paginationContainer.insertBefore(pageBtn, nextBtn);
    }

    updateTableDisplay();
    updatePaginationButtons();
}

function updateTableDisplay() {
    const rows = issueTableBody.querySelectorAll("tr:not([style*='display: none'])");
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    rows.forEach((row, index) => {
        row.style.display = (index >= startIndex && index < endIndex) ? '' : 'none';
    });
}

function updatePaginationButtons() {
    const rows = issueTableBody.querySelectorAll("tr:not([style*='display: none'])");
    const pageCount = Math.ceil(rows.length / rowsPerPage);

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === pageCount || pageCount === 0;
}

function formatDisplayDate(timestamp) {
    if (!timestamp) return 'N/A';

    const date = new Date(timestamp);
    if (isNaN(date)) return 'Invalid Date';

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
    const notification = document.getElementById('notification');
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

// Make functions available globally if needed
window.showIssueDetails = showIssueDetails;
window.showResponseDialog = showResponseDialog;