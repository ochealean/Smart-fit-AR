// shop_inventory.js - Refactored to use firebaseMethods only
import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    readData,
    deleteData,
    updateData,
    generate18CharID
} from "../../firebaseMethods.js";

// Global session object
const userSession = {
    shopId: null,
    role: null,
    shopName: ''
};

// Global variables for sorting
let currentSort = {
    column: null,
    direction: 'asc' // 'asc' or 'desc'
};

// Expose functions globally
window.showShoeDetails = showShoeDetails;
window.editShoe = editShoe;
window.promptDelete = promptDelete;
window.closeModal = closeModal;
window.addNewShoe = addNewShoe;
window.showReviews = showReviews;
window.testFeedback = testFeedback;
window.filterReviewsModal = filterReviewsModal;

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Authentication and initialization
async function initializeInventory() {
    const user = await checkUserAuth();

    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    if (user.userData.status === 'rejected') {
        window.location.href = "/shopowner/html/shop_rejected.html";
        return;
    }

    if (user.userData.status === 'pending') {
        window.location.href = "/shopowner/html/shop_pending.html";
        return;
    }

    console.log(`User is ${user.role}`, user.userData);

    // Set user information based on role
    userSession.role = user.role;
    userSession.shopId = user.shopId || user.userId;
    
    // Set user information in header
    getElement('userFullname').textContent = user.userData.ownerName || user.userData.name || 'Shop Owner';

    // Set profile picture
    const profilePicture = getElement('profilePicture');
    if (user.userData.profilePhoto && user.userData.profilePhoto.url) {
        profilePicture.src = user.userData.profilePhoto.url;
    } else if (user.userData.uploads && user.userData.uploads.shopLogo && user.userData.uploads.shopLogo.url) {
        profilePicture.src = user.userData.uploads.shopLogo.url;
    } else {
        profilePicture.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }

    // Hide/show menu items based on role
    if (user.role.toLowerCase() === "customer") {
        window.location.href = "../../customer/html/customer_dashboard.html";
    }
    else if (user.role === 'employee') {
        if (user.userData.role.toLowerCase() === "manager") {
            getElement("addemployeebtn").style.display = "none";
        } else if (user.userData.role.toLowerCase() === "salesperson") {
            getElement("addemployeebtn").style.display = "none";
            getElement("analyticsbtn").style.display = "none";
            getElement("issuereport").style.display = "none";
        }
    }

    // Load inventory
    loadInventory('inventoryTableBody');
}

function addNewShoe() {
    window.location.href = "/shopowner/html/shopowner_addshoe.html";
}

function loadInventory(tableBodyId) {
    const productsPath = `smartfit_AR_Database/shoe/${userSession.shopId}`;
    const tbody = getElement(tableBodyId);
    if (!tbody) return;

    const unsubscribe = readDataRealtime(productsPath, (result) => {
        tbody.innerHTML = '';
        if (!result.success || !result.data) {
            tbody.innerHTML = `<tr><td colspan="7">No shoes found in inventory</td></tr>`;
            return;
        }

        const products = result.data;
        Object.keys(products).forEach(shoeId => {
            const shoe = products[shoeId];
            const row = createInventoryRow(shoeId, shoe);
            tbody.appendChild(row);
        });

        // Setup sorting after inventory is loaded
        setTimeout(() => setupTableSorting(), 100);
    });

    // Return unsubscribe function for cleanup if needed
    return unsubscribe;
}

function createInventoryRow(shoeId, shoe) {
    const row = document.createElement('tr');
    row.className = 'animate-fade';
    row.setAttribute('data-id', shoeId);

    let totalStock = 0;
    let firstPrice = 'N/A';

    if (shoe.variants) {
        const variantKeys = Object.keys(shoe.variants);
        if (variantKeys.length > 0) {
            const firstVariant = shoe.variants[variantKeys[0]];
            firstPrice = firstVariant.price ? `₱${firstVariant.price}` : 'N/A';
            Object.values(shoe.variants).forEach(variant => {
                if (variant.sizes) {
                    Object.values(variant.sizes).forEach(sizeObj => {
                        const sizeKey = Object.keys(sizeObj)[0];
                        totalStock += sizeObj[sizeKey].stock || 0;
                    });
                }
            });
        }
    }

    const addedDate = shoe.dateAdded ? new Date(shoe.dateAdded).toLocaleDateString() : 'N/A';

    row.innerHTML = `
        <td>${shoe.defaultImage ? `<img src="${shoe.defaultImage}" alt="${shoe.shoeName}" class="shoe-thumbnail">` : '<div class="no-image">No Image</div>'}</td>
        <td>${shoe.shoeName || 'N/A'}</td>
        <td>${shoe.shoeCode || 'N/A'}</td>
        <td>${firstPrice}</td>
        <td>${totalStock}</td>
        <td>${addedDate}</td>
        <td class="action-buttons">
            <button class="btn btn-view" onclick="showShoeDetails('${shoeId}')"><i class="fas fa-eye"></i> View</button>
            <button class="btn btn-edit" onclick="editShoe('${shoeId}')"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn btn-reviews" onclick="showReviews('${shoeId}')"><i class="fas fa-star"></i> Reviews</button>
            <button class="btn btn-danger" onclick="promptDelete('${shoeId}')"><i class="fas fa-trash"></i> Delete</button>
        </td>
    `;
    return row;
}

async function showShoeDetails(shoeId) {
    const shoePath = `smartfit_AR_Database/shoe/${userSession.shopId}/${shoeId}`;
    const modalContent = getElement('shoeDetailsContent');
    const modalElement = getElement('shoeDetailsModal');

    try {
        const result = await readData(shoePath);
        
        if (!result.success) {
            alert('Shoe not found');
            return;
        }

        const shoe = result.data;
        displayShoeDetailsModal(shoe, shoeId);
    } catch (error) {
        console.error("Error fetching shoe details:", error);
        alert('Error loading shoe details');
    }
}

function displayShoeDetailsModal(shoe, shoeId) {
    const modalContent = getElement('shoeDetailsContent');
    const modalElement = getElement('shoeDetailsModal');

    // Format date
    const addedDate = shoe.dateAdded ? new Date(shoe.dateAdded).toLocaleString() : 'N/A';

    // Generate variants HTML
    let variantsHtml = '';
    if (shoe.variants) {
        Object.entries(shoe.variants).forEach(([variantKey, variant], index) => {
            let sizesHtml = '';
            if (variant.sizes) {
                sizesHtml = Object.entries(variant.sizes).map(([sizeKey, sizeObj]) => {
                    const size = Object.keys(sizeObj)[0];
                    return `<div class="size-item">Size ${size}: ${sizeObj[size].stock} in stock</div>`;
                }).join('');
            }

            variantsHtml += `
                <div class="variant-detail">
                    <h4 class="variant-title">
                        <i class="fas fa-palette"></i> ${variant.variantName || 'Variant'} 
                        <span style="color: ${variant.color || '#666'}">(${variant.color || 'No color'})</span>
                    </h4>
                    <div class="variant-meta">
                        <span><i class="fas fa-tag"></i> Price: ₱${variant.price || '0.00'}</span>
                    </div>
                    ${variant.imageUrl ?
                    `<img src="${variant.imageUrl}" alt="${variant.variantName}" class="variant-image">` :
                    '<p>No variant image</p>'}
                    <div class="size-container">${sizesHtml}</div>
                </div>
                ${index < Object.keys(shoe.variants).length - 1 ? '<hr>' : ''}
            `;
        });
    }

    // Display all shoe information
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2>${shoe.shoeName || 'Shoe Details'}</h2>
            <span class="close-modal" onclick="closeModal()">&times;</span>
        </div>
        <div class="modal-body">
            <div class="shoe-main-info">
                <div class="shoe-image-container">
                    ${shoe.defaultImage ?
            `<img src="${shoe.defaultImage}" alt="${shoe.shoeName}" class="main-shoe-image">` :
            '<p>No main image</p>'}
                </div>
                <div class="shoe-text-info">
                    <h2>${shoe.shoeName || 'No Name'}</h2>
                    <h3>Product Code: ${shoe.shoeCode || 'N/A'}</h3>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-info-circle"></i> Basic Information</h3>
                        <p><strong>Brand:</strong> ${shoe.shoeBrand || 'Not specified'}</p>
                        <p><strong>Type:</strong> ${shoe.shoeType || 'Not specified'}</p>
                        <p><strong>Gender:</strong> ${formatGender(shoe.shoeGender) || 'Not specified'}</p>
                        <p><strong>Shop:</strong> ${shoe.shopName || userSession.shopName}</p>
                        <p><strong>Added By:</strong> ${shoe.roleWhoAdded || 'Shop Owner'}</p>
                        <p><strong>Date Added:</strong> ${addedDate}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-align-left"></i> Description</h3>
                        <p>${shoe.generalDescription || 'No description available'}</p>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3 class="variants-header"><i class="fas fa-layer-group"></i> Variants & Sizes</h3>
                <div class="variants-container">
                    ${variantsHtml || '<p>No variants available</p>'}
                </div>
            </div>
        </div>
    `;

    modalElement.style.display = 'block';
    document.body.classList.add('modal-open');
}

function formatGender(gender) {
    if (!gender) return 'Not specified';
    
    const genderMap = {
        'male': 'Male',
        'female': 'Female',
        'unisex': 'Unisex (Both)'
    };
    
    return genderMap[gender] || gender;
}

function closeModal() {
    getElement('shoeDetailsModal').style.display = 'none';
    getElement('confirmationModal').style.display = 'none';
    document.body.classList.remove('modal-open');
}

function promptDelete(shoeId) {
    if (confirm('Are you sure you want to delete this shoe?')) {
        deleteShoe(shoeId);
    }
}

async function deleteShoe(shoeId) {
    const shoePath = `smartfit_AR_Database/shoe/${userSession.shopId}/${shoeId}`;
    
    try {
        const result = await deleteData(shoePath);
        if (result.success) {
            alert("Shoe deleted successfully!");
        } else {
            alert("Error deleting shoe: " + result.error);
        }
    } catch (error) {
        console.error("Error deleting shoe:", error);
        alert("Error deleting shoe: " + error.message);
    }
}

function editShoe(shoeId) {
    window.location.href = `/shopowner/html/shopowner_editshoe.html?edit=${shoeId}`;
}

// Sorting functionality
function setupTableSorting() {
    const headers = document.querySelectorAll('#inventoryTable th');
    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
            sortTable(index);
        });
    });
}

function sortTable(columnIndex) {
    const tbody = getElement('inventoryTableBody');
    const rows = Array.from(tbody.querySelectorAll('tr:not([style*="display: none"])'));
    
    // Determine sort direction
    if (currentSort.column === columnIndex) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = columnIndex;
        currentSort.direction = 'asc';
    }
    
    // Sort rows
    rows.sort((a, b) => {
        const aValue = getCellValue(a, columnIndex);
        const bValue = getCellValue(b, columnIndex);
        
        let comparison = 0;
        
        // Handle different data types
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else {
            // Fallback: convert to string
            comparison = String(aValue).localeCompare(String(bValue));
        }
        
        return currentSort.direction === 'desc' ? -comparison : comparison;
    });
    
    // Remove existing rows
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
    
    // Add sorted rows
    rows.forEach(row => tbody.appendChild(row));
    
    // Update header indicators
    updateSortIndicators(columnIndex);
}

function getCellValue(row, columnIndex) {
    const cell = row.cells[columnIndex];
    if (!cell) return '';
    
    const text = cell.textContent.trim();
    
    // Handle specific column types
    switch (columnIndex) {
        case 3: // Price column
            const priceMatch = text.match(/₱([\d,]+(\.\d{2})?)/);
            return priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;
            
        case 4: // Stock column
            return parseInt(text) || 0;
            
        case 5: // Date column
            const date = new Date(text);
            return isNaN(date.getTime()) ? text : date.getTime();
            
        default:
            return text;
    }
}

function updateSortIndicators(columnIndex) {
    const headers = document.querySelectorAll('#inventoryTable th');
    
    // Remove all indicators
    headers.forEach(header => {
        header.querySelector('.sort-indicator')?.remove();
        header.style.fontWeight = 'normal';
    });
    
    // Add indicator to current sort column
    if (headers[columnIndex]) {
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.innerHTML = currentSort.direction === 'asc' ? 
            ' <i class="fas fa-arrow-up"></i>' : 
            ' <i class="fas fa-arrow-down"></i>';
        
        headers[columnIndex].appendChild(indicator);
        headers[columnIndex].style.fontWeight = 'bold';
    }
}

// Reviews functionality
async function showReviews(shoeId) {
    const feedbacksPath = `smartfit_AR_Database/feedbacks`;
    const modalContent = getElement('shoeDetailsContent');
    const modalElement = getElement('shoeDetailsModal');

    // Show loading state
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2>Loading Reviews...</h2>
            <span class="close-modal" onclick="closeModal()">&times;</span>
        </div>
        <div class="modal-body">
            <div class="loading">Please wait while we load the reviews...</div>
        </div>
    `;
    modalElement.style.display = 'block';
    document.body.classList.add('modal-open');

    try {
        const result = await readData(feedbacksPath);
        if (!result.success || !result.data) {
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h2>No Reviews Yet</h2>
                    <span class="close-modal" onclick="closeModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <p>This shoe hasn't received any reviews yet.</p>
                </div>
            `;
            return;
        }

        const feedbacks = result.data;
        const reviewsToDisplay = [];

        // Filter reviews for this specific shoe
        for (const userId in feedbacks) {
            for (const orderID in feedbacks[userId]) {
                const feedback = feedbacks[userId][orderID];
                if (feedback.shoeID === shoeId) {
                    reviewsToDisplay.push({
                        userId,
                        feedback
                    });
                }
            }
        }

        if (reviewsToDisplay.length === 0) {
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h2>No Reviews Yet</h2>
                    <span class="close-modal" onclick="closeModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <p>This shoe hasn't received any reviews yet.</p>
                </div>
            `;
            return;
        }

        // Calculate average rating
        const averageRating = calculateAverageRating(feedbacks, shoeId);
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        // Count ratings
        reviewsToDisplay.forEach(review => {
            const rating = review.feedback.rating;
            if (rating >= 1 && rating <= 5) {
                ratingCounts[rating]++;
            }
        });

        // Create filter buttons
        const filtersHtml = `
            <div class="review-filters">
                ${[5, 4, 3, 2, 1].map(rating => `
                    <div class="stars-filter" data-rating="${rating}" onclick="filterReviewsModal(${rating})">
                        <div class="stars">
                            ${'<i class="fas fa-star"></i>'.repeat(rating)}
                            ${'<i class="far fa-star"></i>'.repeat(5 - rating)}
                        </div>
                        <div class="text">${rating} Star${rating !== 1 ? 's' : ''} (${ratingCounts[rating]})</div>
                    </div>
                `).join('')}
                <div class="stars-filter active" data-rating="0" onclick="filterReviewsModal(0)">
                    <div class="text">All Reviews (${reviewsToDisplay.length})</div>
                </div>
            </div>
        `;

        // Process each review asynchronously
        let reviewsHtml = '';
        for (const review of reviewsToDisplay) {
            try {
                const username = await getCustomernameUsingID(review.userId);

                reviewsHtml += `
                    <div class="review-item" data-rating="${review.feedback.rating}">
                        <div class="review-header">
                            <span class="review-author">${username}</span>
                            <span class="review-date">${formatTimestamp(review.feedback.timestamp)}</span>
                        </div>
                        <div class="review-stars">
                            ${generateStarRating(review.feedback.rating)}
                        </div>
                        <p class="review-comment">${review.feedback.comment || "No comment provided."}</p>
                    </div>
                `;
            } catch (error) {
                console.error("Error processing review:", error);
            }
        }

        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>Customer Reviews</h2>
                <span class="close-modal" onclick="closeModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="average-rating-container">
                    Average Rating: 
                    <span class="average-rating-value">
                        ${averageRating > 0 ? `${averageRating} <i class="fas fa-star"></i>` : 'No ratings yet'}
                    </span>
                </div>
                ${filtersHtml}
                <div class="reviews-container">
                    ${reviewsHtml}
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Error fetching reviews:", error);
        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>Error Loading Reviews</h2>
                <span class="close-modal" onclick="closeModal()">&times;</span>
            </div>
            <div class="modal-body">
                <p>Failed to load reviews. Please try again later.</p>
            </div>
        `;
    }
}

function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let starsHtml = '';

    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="fas fa-star"></i>';
    }

    if (hasHalfStar) {
        starsHtml += '<i class="fas fa-star-half-alt"></i>';
    }

    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<i class="far fa-star"></i>';
    }

    return starsHtml;
}

function calculateAverageRating(feedbacks, shoeId) {
    let totalRating = 0;
    let reviewCount = 0;

    for (const userId in feedbacks) {
        for (const orderID in feedbacks[userId]) {
            const feedback = feedbacks[userId][orderID];
            if (feedback.shoeID === shoeId) {
                totalRating += feedback.rating;
                reviewCount++;
            }
        }
    }

    return reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : 0;
}

async function getCustomernameUsingID(userID) {
    const customerPath = `smartfit_AR_Database/customers/${userID}`;
    try {
        const result = await readData(customerPath);
        if (result.success && result.data) {
            const userData = result.data;
            return `${userData.firstName} ${userData.lastName}` || "Anonymous User";
        }
        return "Anonymous User";
    } catch (error) {
        console.error("Error fetching user data:", error);
        return "Anonymous User";
    }
}

function formatTimestamp(timestamp) {
    let date = new Date(timestamp);
    let month = String(date.getMonth() + 1).padStart(2, '0');
    let day = String(date.getDate()).padStart(2, '0');
    let year = date.getFullYear();
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}`;
}

function filterReviewsModal(rating) {
    const reviewItems = document.querySelectorAll('#shoeDetailsContent .review-item');
    const filters = document.querySelectorAll('#shoeDetailsContent .stars-filter');

    filters.forEach(filter => {
        filter.classList.remove('active');
        if (parseInt(filter.dataset.rating) === rating) {
            filter.classList.add('active');
        }
    });

    reviewItems.forEach(item => {
        item.style.display = (rating === 0 || parseInt(item.dataset.rating) === rating)
            ? 'block'
            : 'none';
    });
}

function testFeedback(shoeId) {
    const modalContent = getElement('shoeDetailsContent');
    const modalElement = getElement('shoeDetailsModal');

    const sampleFeedbacks = [
        {
            rating: 5,
            comment: "Absolutely love these shoes! They're comfortable and stylish. Perfect fit!",
            timestamp: Date.now() - 86400000 * 2
        },
        {
            rating: 4,
            comment: "Great shoes overall. The color is a bit different than expected but still nice.",
            timestamp: Date.now() - 86400000 * 5
        },
        {
            rating: 3,
            comment: "Average quality. They look good but the sole isn't as durable as I hoped.",
            timestamp: Date.now() - 86400000 * 10
        },
        {
            rating: 2,
            comment: "Disappointed with the quality. The stitching is coming apart after just a week.",
            timestamp: Date.now() - 86400000 * 15
        },
        {
            rating: 1,
            comment: "Poor quality. The shoes fell apart after 3 days of normal use. Would not recommend.",
            timestamp: Date.now() - 86400000 * 20
        }
    ];

    const averageRating = sampleFeedbacks.reduce((sum, feedback) => sum + feedback.rating, 0) / sampleFeedbacks.length;
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    sampleFeedbacks.forEach(feedback => {
        ratingCounts[feedback.rating]++;
    });

    const filtersHtml = `
        <div class="review-filters">
            ${[5, 4, 3, 2, 1].map(rating => `
                <div class="stars-filter" data-rating="${rating}" onclick="filterReviewsModal(${rating})">
                    <div class="stars">
                        ${'<i class="fas fa-star"></i>'.repeat(rating)}
                        ${'<i class="far fa-star"></i>'.repeat(5 - rating)}
                    </div>
                    <div class="text">${rating} Star${rating !== 1 ? 's' : ''} (${ratingCounts[rating]})</div>
                </div>
            `).join('')}
            <div class="stars-filter active" data-rating="0" onclick="filterReviewsModal(0)">
                <div class="text">All Reviews (${sampleFeedbacks.length})</div>
            </div>
        </div>
    `;

    const reviewsHtml = sampleFeedbacks.map(feedback => `
        <div class="review-item" data-rating="${feedback.rating}">
            <div class="review-header">
                <span class="review-author">Sample Customer</span>
                <span class="review-date">${formatTimestamp(feedback.timestamp)}</span>
            </div>
            <div class="review-stars">
                ${generateStarRating(feedback.rating)}
            </div>
            <p class="review-comment">${feedback.comment}</p>
        </div>
    `).join('');

    modalContent.innerHTML = `
        <div class="modal-header">
            <h2>Feedback Test Preview</h2>
        </div>
        <div class="modal-body">
            <div class="test-feedback-notice">
                <i class="fas fa-info-circle"></i> This is a preview of how customer feedback will appear on your shoe.
            </div>
            <div class="average-rating-container">
                Average Rating: 
                <span class="average-rating-value">
                    ${averageRating.toFixed(1)} <i class="fas fa-star"></i>
                </span>
            </div>
            ${filtersHtml}
            <div class="reviews-container">
                ${reviewsHtml}
            </div>
        </div>
    `;

    modalElement.style.display = 'block';
    document.body.classList.add('modal-open');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    // Mobile sidebar toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (mobileToggle && sidebar && overlay) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Logout button
    getElement('logout_btn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            const result = await logoutUser();
            if (result.success) {
                window.location.href = "/login.html";
            } else {
                alert('Logout failed: ' + result.error);
            }
        }
    });

    // Modal controls
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });

    // Search functionality
    getElement('searchInventory')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#inventoryTable tbody tr').forEach(row => {
            const name = row.children[1]?.textContent.toLowerCase() || '';
            const code = row.children[2]?.textContent.toLowerCase() || '';
            row.style.display = (name.includes(term) || code.includes(term)) ? '' : 'none';
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal();
        }
    });

    // Initialize inventory
    initializeInventory();
});