// issue_response.js - Refactored to use firebaseMethods only
import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    readData,
    updateData
} from "../../firebaseMethods.js";

// DOM Elements
const issueResponsesTable = document.getElementById('issueResponsesTable');
const issueDetailsModal = document.getElementById('issueDetailsModal');
const modalIssueContent = document.getElementById('modalIssueContent');
const closeModalBtn = document.querySelector('.close-modal');
const overlay = document.getElementById('overlay');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearch');
const searchInput = document.getElementById('issueSearch');
const notification = document.getElementById('notification');
const logoutBtn = document.getElementById('logout_btn');

// Pagination variables
let currentPage = 1;
const rowsPerPage = 10;
let allIssues = [];
let userSession = {
    userId: null,
    userData: null
};

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
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

    // Load user profile
    loadUserProfile();
    
    // Load issue responses
    loadIssueResponses();
    
    // Setup event listeners
    setupEventListeners();
}

// Load user profile
function loadUserProfile() {
    const userNameDisplay = getElement('userName_display');
    const userAvatar = getElement('imageProfile');
    
    if (userSession.userData) {
        if (userSession.userData.firstName && userSession.userData.lastName) {
            userNameDisplay.textContent = `${userSession.userData.firstName} ${userSession.userData.lastName}`;
        } else if (userSession.userData.ownerName) {
            userNameDisplay.textContent = userSession.userData.ownerName;
        } else if (userSession.userData.name) {
            userNameDisplay.textContent = userSession.userData.name;
        } else {
            userNameDisplay.textContent = "User";
        }
        
        // Set user avatar if available
        if (userSession.userData.profilePhoto) {
            userAvatar.src = userSession.userData.profilePhoto;
        } else if (userSession.userData.uploads?.shopLogo) {
            userAvatar.src = userSession.userData.uploads.shopLogo;
        } else {
            userAvatar.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        }
    }
}

function loadIssueResponses() {
    const issuesPath = `smartfit_AR_Database/issueReports/${userSession.userId}`;
    console.log("Loading issues from path:", issuesPath);
    
    const unsubscribe = readDataRealtime(issuesPath, (result) => {
        allIssues = [];
        console.log('Realtime issues data:', result);
        
        if (result.success && result.data) {
            const issuesData = result.data;
            console.log("Raw issues data:", issuesData);
            
            Object.keys(issuesData).forEach(issueId => {
                const issue = issuesData[issueId];
                console.log(`Processing issue ${issueId}:`, issue);
                
                // FIXED: Only show issues that are NOT resolved (resolved is false or undefined)
                // Check if the issue is unresolved
                const isResolved = issue.resolved === true;
                console.log(`Issue ${issueId} resolved status:`, issue.resolved, "Is resolved:", isResolved);
                
                // if (!isResolved) {
                //     allIssues.push({
                //         id: issueId, // FIXED: Use the actual issueId from the database
                //         ...issue
                //     });
                // }

                // no filter
                allIssues.push({
                    id: issueId, 
                    ...issue
                });
            });
            
            console.log("Filtered unresolved issues:", allIssues);
            
            // Reverse to show newest first
            allIssues.reverse();
            displayIssues(allIssues);
            setupPagination();
        } else {
            console.log("No issues data found");
            issueResponsesTable.innerHTML = '<tr><td colspan="6">No unresolved issues found</td></tr>';
        }
    });

    // Store unsubscribe for cleanup if needed
    window.issuesUnsubscribe = unsubscribe;
}

function displayIssues(issues) {
    issueResponsesTable.innerHTML = '';
    
    if (issues.length === 0) {
        issueResponsesTable.innerHTML = '<tr><td colspan="6">No unresolved issues found</td></tr>';
        return;
    }
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, issues.length);
    const paginatedIssues = issues.slice(startIndex, endIndex);
    
    paginatedIssues.forEach(issue => {
        const row = document.createElement('tr');
        
        // Get the latest response (if any)
        let latestResponse = { timestamp: 0 };
        if (issue.adminResponses || issue.shopResponse) {
            // Check both adminResponses and shopResponse for backward compatibility
            const responses = issue.adminResponses ? Object.values(issue.adminResponses) : 
                            issue.shopResponse ? Object.values(issue.shopResponse) : [];
            latestResponse = responses.reduce((latest, current) => 
                current.timestamp > latest.timestamp ? current : latest, { timestamp: 0 });
        }
        
        row.innerHTML = `
            <td>${issue.orderID ? issue.orderID.substring(0, 8) : 'N/A'}</td>
            <td>${getIssueTypeLabel(issue.issueType)}</td>
            <td class="status-${issue.status || 'pending'}">${issue.status ? 
                issue.status.charAt(0).toUpperCase() + issue.status.slice(1) : 'Pending'}</td>
            <td>${formatDisplayDate(issue.timestamp)}</td>
            <td>${latestResponse.timestamp ? formatDisplayDate(latestResponse.timestamp) : 'No responses yet'}</td>
            <td>
                <button class="action-btn view-btn" data-id="${issue.id}">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        `;
        console.log(issue);
        // Attach event listener
        row.querySelector('.view-btn').addEventListener('click', () => showIssueDetails(issue.orderID));
        issueResponsesTable.appendChild(row);
    });
}

async function showIssueDetails(issueId) {
    // FIXED: Use the correct path with userId
    const issuePath = `smartfit_AR_Database/issueReports/${userSession.userId}/${issueId}`;
    console.log("Fetching issue from:", issuePath);

    try {
        const result = await readData(issuePath);
        console.log(result);
        if (result.success) {
            const issue = result.data;
            console.log(issue);
            updateModalContent(issueId, issue);
            getElement('issueDetailsModal').classList.add('show');
        } else {
            showNotification('Issue report not found', 'error');
        }
    } catch (error) {
        showNotification(`Error fetching issue: ${error.message}`, 'error');
    }
}

function updateModalContent(issueId, issue) {
    document.getElementById('modalIssueTitle').textContent = `Issue Report #${issueId.substring(0, 8)}`;
    
    // Format photos if they exist
    let photosHTML = '<p>No photos submitted</p>';
    if (issue.photoURLs && issue.photoURLs.length > 0) {
        photosHTML = issue.photoURLs.map(photoObj => {
            const photoUrl = typeof photoObj === 'string' ? photoObj : (photoObj.url || '');
            if (photoUrl) {
                return `<div class="document-item">
                    <a href="${photoUrl}" target="_blank" class="document-preview">
                        <img src="${photoUrl}" alt="Issue photo" style="max-height: 200px; max-width: 100%;">
                    </a>
                </div>`;
            }
            return '';
        }).filter(html => html !== '').join('');
        
        if (!photosHTML) {
            photosHTML = '<p>No photos submitted</p>';
        }
    }
    
    // Format admin/shop responses if they exist
    let responsesHTML = '<p>No responses yet</p>';
    const responses = issue.adminResponses || issue.shopResponse;
    
    if (responses && typeof responses === 'object') {
        responsesHTML = Object.entries(responses)
            .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by timestamp descending
            .map(([timestamp, response]) => `
                <div class="response-item">
                    <div class="response-header">
                        <span class="response-date">${formatDisplayDate(parseInt(timestamp))}</span>
                        <span class="response-status ${'status-' + (response.status || 'pending')}">
                            Status: ${(response.status || 'pending').charAt(0).toUpperCase() + (response.status || 'pending').slice(1)}
                        </span>
                    </div>
                    <div class="response-message">${response.message || 'No message provided'}</div>
                    ${response.shopName ? `<div class="response-shop">By: ${response.shopName}</div>` : ''}
                </div>
            `).join('');
    }
    
    modalIssueContent.innerHTML = `
        <div class="modal-section">
            <h3>Issue Information</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Order ID: </span>
                    <span class="info-value">${issue.orderID || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Issue Type: </span>
                    <span class="info-value">${getIssueTypeLabel(issue.issueType)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Current Status: </span>
                    <span class="info-value status-${issue.status || 'pending'}">
                        ${issue.status ? issue.status.charAt(0).toUpperCase() + issue.status.slice(1) : 'Pending'}
                    </span>
                </div>
                <div class="info-item">
                    <span class="info-label">Resolved: </span>
                    <span class="info-value">${issue.resolved ? 'Yes' : 'No'}</span>
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
            <h3>Shop Responses</h3>
            <div class="responses-container">
                ${responsesHTML}
            </div>
        </div>
    `;
}

function setupEventListeners() {
    // Modal close button
    document.querySelector('.close-btn').addEventListener('click', () => {
        getElement('issueDetailsModal').classList.remove('show');
    });
    
    // Pagination buttons
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayIssues(allIssues);
            updatePaginationButtons();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        const pageCount = Math.ceil(allIssues.length / rowsPerPage);
        if (currentPage < pageCount) {
            currentPage++;
            displayIssues(allIssues);
            updatePaginationButtons();
        }
    });
    
    // Search functionality
    searchBtn.addEventListener('click', performSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Logout button
    logoutBtn.addEventListener('click', handleLogout);
    
    // Overlay click
    document.querySelector('.sidebar-overlay').addEventListener('click', () => {
        getElement('issueDetailsModal').classList.remove('show');
    });

    // Mobile sidebar toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');

    if (mobileToggle && sidebar && sidebarOverlay) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        });

        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
    }
}

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        const result = await logoutUser();
        if (result.success) {
            window.location.href = "/login.html";
        } else {
            showNotification('Logout failed: ' + result.error, 'error');
        }
    }
}

function performSearch() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    if (!searchTerm) {
        clearSearch();
        return;
    }
    
    const filteredIssues = allIssues.filter(issue => {
        return (issue.orderID && issue.orderID.toLowerCase().includes(searchTerm)) ||
            (issue.issueType && issue.issueType.toLowerCase().includes(searchTerm)) ||
            (issue.status && issue.status.toLowerCase().includes(searchTerm)) ||
            (issue.description && issue.description.toLowerCase().includes(searchTerm));
    });
    
    if (filteredIssues.length === 0) {
        showNotification('No matching unresolved issues found', 'info');
    }
    
    currentPage = 1;
    displayIssues(filteredIssues);
    setupPagination();
}

function clearSearch() {
    searchInput.value = '';
    currentPage = 1;
    displayIssues(allIssues);
    setupPagination();
}

function setupPagination() {
    const pageCount = Math.ceil(allIssues.length / rowsPerPage);
    const paginationContainer = document.querySelector('.pagination');
    
    // Clear existing page buttons
    const existingPageButtons = paginationContainer.querySelectorAll('.page-btn');
    existingPageButtons.forEach(btn => btn.remove());
    
    // Add page buttons
    for (let i = 1; i <= pageCount; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'pagination-btn page-btn';
        pageBtn.textContent = i;
        
        if (i === currentPage) {
            pageBtn.classList.add('active');
        }
        
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            displayIssues(allIssues);
            updatePaginationButtons();
        });
        
        paginationContainer.insertBefore(pageBtn, nextBtn);
    }
    
    updatePaginationButtons();
}

function updatePaginationButtons() {
    const pageCount = Math.ceil(allIssues.length / rowsPerPage);
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === pageCount || pageCount === 0;
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
    const month = date.toLocaleString('default', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${month} ${day}, ${year} ${timeString}`;
}

function showNotification(message, type) {
    const notification = getElement('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'flex';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Cleanup function if needed
function cleanup() {
    if (window.issuesUnsubscribe) {
        window.issuesUnsubscribe();
    }
}

// Export for potential cleanup
window.cleanupIssueResponses = cleanup;