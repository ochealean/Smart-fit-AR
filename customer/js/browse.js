import {
    checkUserAuth,
    auth,
    readData,
    updateData,
    logoutUser,
    deleteData
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Global variables
let wishlistData = {};
let allShoes = [];
let activeTag = null;
let userData = null;

// Initialize the page
async function initializeBrowse() {
    const authStatus = await checkUserAuth();
    
    if (authStatus.authenticated && authStatus.role === 'shopowner') {
        console.log(`User is ${authStatus.role}`, authStatus.userData);
        window.location.href = "../../shopowner/html/shop_dashboard.html";
        return;
    } else if (authStatus.authenticated && authStatus.role === 'customer') {
        console.log(`User is ${authStatus.role}`, authStatus.userData);
        userData = authStatus.userData;
    } else {
        window.location.href = "/login.html";
        return;
    }

    // Show loading state
    showLoadingState();
    
    // Load user profile
    loadUserProfile();
    
    // Load shoes and setup functionality
    await loadShoes();
    
    // Set up event listeners
    setupEventListeners();
    
    // Hide loader and show content
    hideLoadingState();
}

// Show loading state
function showLoadingState() {
    const loadingOverlay = getElement('loadingOverlay');
    const mainContent = document.querySelector('.main-content');
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
    if (mainContent) {
        mainContent.classList.remove('loaded');
    }
}

// Hide loading state
function hideLoadingState() {
    const loadingOverlay = getElement('loadingOverlay');
    const mainContent = document.querySelector('.main-content');
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    if (mainContent) {
        mainContent.classList.add('loaded');
    }
}

// Load user profile
function loadUserProfile() {
    // Add user profile loading if needed
    // Similar to other files, but depends on your HTML structure
}

// Load all shoes
async function loadShoes() {
    const productsGrid = getElement("productsGrid");
    const user = auth.currentUser;
    
    if (!user) {
        showError("Please login to browse shoes");
        return;
    }

    try {
        // Get wishlist data
        const wishlistResult = await readData(`smartfit_AR_Database/wishlist/${user.uid}`);
        if (wishlistResult.success && wishlistResult.data) {
            wishlistData = wishlistResult.data;
        } else {
            wishlistData = {};
        }

        // Get all shop names
        const shopsResult = await readData('smartfit_AR_Database/shop');
        const shopNames = {};
        if (shopsResult.success && shopsResult.data) {
            Object.keys(shopsResult.data).forEach(shopID => {
                shopNames[shopID] = shopsResult.data[shopID].shopName || shopID;
            });
        }

        // Get all shoes
        const shoesResult = await readData('smartfit_AR_Database/shoe');
        allShoes = [];

        if (shoesResult.success && shoesResult.data) {
            processShoesData(shoesResult.data, shopNames, user.uid);
            displayShoes(allShoes);
        } else {
            showNoShoesMessage();
        }
    } catch (error) {
        console.error("Error loading shoes: ", error);
        showErrorState();
    }
}

// Process shoes data from Firebase
function processShoesData(shoesData, shopNames, userID) {
    Object.keys(shoesData).forEach(shopID => {
        const shopShoes = shoesData[shopID];

        if (shopShoes && typeof shopShoes === 'object') {
            Object.keys(shopShoes).forEach(shoeID => {
                const shoeData = shopShoes[shoeID];

                if (shoeData && typeof shoeData === 'object') {
                    const processedShoe = processShoeData(shoeData, shopID, shoeID, shopNames, userID);
                    if (processedShoe) {
                        allShoes.push(processedShoe);
                    }
                }
            });
        }
    });
}

// Process individual shoe data
function processShoeData(shoeData, shopID, shoeID, shopNames, userID) {
    const shopName = shopNames[shopID] || shopID;
    const shoeName = shoeData.shoeName || 'Unnamed Shoe';
    const shoeCode = shoeData.shoeCode || 'N/A';
    const defaultImage = shoeData.defaultImage;

    // Get first variant for price and image
    const variants = shoeData.variants || {};
    const firstVariantKey = Object.keys(variants)[0];
    const firstVariant = firstVariantKey ? variants[firstVariantKey] : {};
    const price = firstVariant.price || 0;
    const variantImage = firstVariant.imageUrl;

    const type = shoeData.shoeType || 'Unknown';
    const brand = shoeData.shoeBrand || 'Unknown';
    const gender = shoeData.shoeGender || 'Unisex';
    const dateAdded = shoeData.dateAdded || new Date().toISOString();

    // Check if shoe is in wishlist
    const isWishlisted = wishlistData &&
        wishlistData[shopID] &&
        wishlistData[shopID][shoeID];

    return {
        shoeID: shoeID,
        name: shoeName,
        code: shoeCode,
        price: price,
        imageUrl: defaultImage || variantImage || 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png',
        shopName: shopName,
        shopID: shopID,
        isWishlisted: isWishlisted,
        type: type,
        brand: brand,
        gender: gender,
        dateAdded: dateAdded
    };
}

// Display shoes in the grid
function displayShoes(shoes) {
    const productsGrid = getElement("productsGrid");
    
    if (!productsGrid) return;

    if (shoes.length === 0) {
        showNoShoesMessage();
        return;
    }

    let html = '';
    shoes.forEach(shoe => {
        html += createProductCard(shoe);
    });

    productsGrid.innerHTML = html;
}

// Create product card HTML
function createProductCard(shoeData) {
    const heartClass = shoeData.isWishlisted ? "fas" : "far";
    const heartColor = shoeData.isWishlisted ? "red" : "";

    return `
    <div class="product-card">
        <img src="${shoeData.imageUrl || 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png'}" alt="${shoeData.name}" class="product-image">
        <div class="product-info">
            <div class="product-shop">
                <h4>Shop Name: ${shoeData.shopName}</h4>
            </div>
            <h3 class="product-name">${shoeData.name}</h3>
            <p class="product-code">Code: ${shoeData.code}</p>
            <div class="product-meta">
                <span class="product-brand">${shoeData.brand || 'No Brand'}</span>
                <span class="product-type">${shoeData.type || 'No Type'}</span>
                <span class="product-gender">${shoeData.gender || 'Unisex'}</span>
            </div>
            <div class="product-price">₱${shoeData.price.toFixed(2)}</div>
            <div class="product-actions">
                <button class="add-to-cart" onclick="viewDetails('${shoeData.shoeID}', '${shoeData.shopID}')">View Details</button>
                <button class="wishlist-btn" onclick="toggleWishlist('${shoeData.shoeID}', '${shoeData.shopID}', this)">
                    <i class="${heartClass} fa-heart" style="color: ${heartColor};"></i>
                </button>
            </div>
        </div>
    </div>
    `;
}

// Show no shoes message
function showNoShoesMessage() {
    const productsGrid = getElement("productsGrid");
    if (productsGrid) {
        productsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-shoe-prints"></i>
                <h3>No Shoes Found</h3>
                <p>Try adjusting your search or filters</p>
            </div>
        `;
    }
}

// Show error state
function showErrorState() {
    const productsGrid = getElement("productsGrid");
    if (productsGrid) {
        productsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error loading shoes</h3>
                <p>Please try refreshing the page</p>
            </div>
        `;
    }
    showError("Error loading shoes. Please try refreshing the page.");
}

// Set up event listeners
function setupEventListeners() {
    // Logout functionality
    const logoutBtn = getElement('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Search functionality
    setupSearch();
    
    // Tag functionality
    setupTagFunctionality();
    
    // Sorting functionality
    setupSorting();
    
    // Mobile sidebar functionality (if applicable)
    setupMobileNavigation();
}

// Handle logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        const result = await logoutUser();
        if (result.success) {
            window.location.href = '/login.html';
        } else {
            console.error('Error signing out:', result.error);
            showError('Failed to logout. Please try again.');
        }
    }
}

// Search functionality
function setupSearch() {
    const searchInput = getElement("searchInput");
    const searchButton = getElement("searchButton");
    const clearSearchButton = getElement("clearSearchButton");

    if (!searchInput || !searchButton || !clearSearchButton) return;

    // Show/hide clear button based on input
    searchInput.addEventListener('input', () => {
        clearSearchButton.style.display = searchInput.value ? 'block' : 'none';
    });

    // Clear search button handler
    clearSearchButton.addEventListener('click', handleClearSearch);

    // Search button click handler
    searchButton.addEventListener('click', handleSearch);

    // Enter key handler
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
}

// Handle search
function handleSearch() {
    const searchInput = getElement("searchInput");
    const searchTerm = searchInput.value.trim();
    
    if (!searchTerm) {
        loadShoes();
        return;
    }

    const filteredShoes = allShoes.filter(shoe => {
        const searchLower = searchTerm.toLowerCase();
        return (
            shoe.name.toLowerCase().includes(searchLower) ||
            shoe.shopName.toLowerCase().includes(searchLower) ||
            shoe.type.toLowerCase().includes(searchLower) ||
            shoe.brand.toLowerCase().includes(searchLower) ||
            shoe.gender.toLowerCase().includes(searchLower) ||
            shoe.code.toLowerCase().includes(searchLower)
        );
    });

    displayShoes(filteredShoes);
}

// Handle clear search
function handleClearSearch() {
    const searchInput = getElement("searchInput");
    const clearSearchButton = getElement("clearSearchButton");
    
    searchInput.value = '';
    clearSearchButton.style.display = 'none';
    clearActiveTag();
    loadShoes();
}

// Tag functionality
function setupTagFunctionality() {
    const tags = document.querySelectorAll('.tag');
    
    tags.forEach(tag => {
        tag.addEventListener('click', () => {
            const tagText = tag.textContent.trim();
            handleTagClick(tag, tagText);
        });
    });
}

// Handle tag click
function handleTagClick(tag, tagText) {
    // Clear previous active tag
    clearActiveTag();

    // Set this tag as active
    tag.classList.add('active');
    activeTag = tagText;

    // Update search input with tag text
    const searchInput = getElement("searchInput");
    if (searchInput) {
        searchInput.value = tagText;
    }

    // Show clear button
    const clearSearchButton = getElement("clearSearchButton");
    if (clearSearchButton) {
        clearSearchButton.style.display = 'block';
    }

    // Perform search with the tag
    performTagSearch(tagText);
}

function clearActiveTag() {
    if (activeTag) {
        const tags = document.querySelectorAll('.tag');
        tags.forEach(tag => {
            if (tag.textContent.trim() === activeTag) {
                tag.classList.remove('active');
            }
        });
        activeTag = null;
    }
}

function performTagSearch(tagText) {
    const filteredShoes = allShoes.filter(shoe => {
        const tagLower = tagText.toLowerCase();
        return (
            shoe.type.toLowerCase() === tagLower ||
            shoe.brand.toLowerCase() === tagLower ||
            shoe.gender.toLowerCase() === tagLower ||
            shoe.name.toLowerCase().includes(tagLower) ||
            shoe.shopName.toLowerCase().includes(tagLower)
        );
    });

    displayShoes(filteredShoes);
}

// Sorting functionality
function setupSorting() {
    const sortOptions = getElement("sortOptions");
    if (sortOptions) {
        sortOptions.addEventListener('change', () => {
            const sortValue = sortOptions.value;
            sortShoes(sortValue);
        });
    }
}

function sortShoes(sortBy) {
    let sortedShoes = [...allShoes];

    switch (sortBy) {
        case 'newest':
            sortedShoes.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            break;
        case 'price-low':
            sortedShoes.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            sortedShoes.sort((a, b) => b.price - a.price);
            break;
        default:
            // Default sorting (no change)
            break;
    }

    displayShoes(sortedShoes);
}

// Mobile navigation setup
function setupMobileNavigation() {
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
}

// Toast notification functions
function showToast(message, type = 'success', duration = 5000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = getToastIcon(type);

    toast.innerHTML = `
        <i class="${icon}"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close" aria-label="Close toast">
            <i class="fas fa-times"></i>
        </button>
        <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => hideToast(toast));

    toast.addEventListener('click', (e) => {
        if (e.target === toast || e.target.classList.contains('toast-content')) {
            hideToast(toast);
        }
    });

    if (duration > 0) {
        setTimeout(() => {
            hideToast(toast);
        }, duration);
    }

    return toast;
}

function getToastIcon(type) {
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    return icons[type] || icons.info;
}

function hideToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('hiding');

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// Convenience toast functions
function showSuccess(message, duration) {
    return showToast(message, 'success', duration);
}

function showError(message, duration) {
    return showToast(message, 'error', duration);
}

function showWarning(message, duration) {
    return showToast(message, 'warning', duration);
}

function showInfo(message, duration) {
    return showToast(message, 'info', duration);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Toggle wishlist function
async function toggleWishlist(shoeID, shopID, btnElement) {
    const user = auth.currentUser;
    if (!user) {
        showError("Please login to manage wishlist");
        return;
    }

    btnElement.disabled = true;

    const userID = user.uid;
    const wishlistPath = `smartfit_AR_Database/wishlist/${userID}/${shopID}/${shoeID}`;

    try {
        const snapshot = await readData(wishlistPath);
        const icon = btnElement.querySelector("i");

        if (snapshot.success && snapshot.data !== null) {
            // Remove from wishlist
            const deleteResult = await deleteData(wishlistPath);

            if (deleteResult.success) {
                showSuccess("Removed shoe from wishlist");
                updateWishlistUI(icon, false, shoeID, shopID);
            } else {
                throw new Error(deleteResult.error);
            }
        } else {
            // Add to wishlist
            const addResult = await updateData(wishlistPath, true);

            if (addResult.success) {
                showSuccess("Added shoe to wishlist");
                updateWishlistUI(icon, true, shoeID, shopID);
            } else {
                throw new Error(addResult.error);
            }
        }
    } catch (error) {
        console.error("Error toggling wishlist:", error);
        showError("Failed to update wishlist");
    } finally {
        btnElement.disabled = false;
    }
}

// Update wishlist UI
function updateWishlistUI(icon, isWishlisted, shoeID, shopID) {
    if (isWishlisted) {
        icon.classList.remove("far");
        icon.classList.add("fas");
        icon.style.color = "red";
        
        // Update local data
        if (!wishlistData[shopID]) {
            wishlistData[shopID] = {};
        }
        wishlistData[shopID][shoeID] = true;

        // Update allShoes array
        const shoeIndex = allShoes.findIndex(shoe =>
            shoe.shoeID === shoeID && shoe.shopID === shopID
        );
        if (shoeIndex !== -1) {
            allShoes[shoeIndex].isWishlisted = true;
        }
    } else {
        icon.classList.remove("fas");
        icon.classList.add("far");
        icon.style.color = "";
        
        // Update local data
        if (wishlistData[shopID]) {
            delete wishlistData[shopID][shoeID];
        }

        // Update allShoes array
        const shoeIndex = allShoes.findIndex(shoe =>
            shoe.shoeID === shoeID && shoe.shopID === shopID
        );
        if (shoeIndex !== -1) {
            allShoes[shoeIndex].isWishlisted = false;
        }
    }
}

// View details function
window.viewDetails = function (shoeID, shopID) {
    console.log(`Shoe ID: ${shoeID}, Shop ID: ${shopID}`);
    window.location.href = `/customer/html/shoedetails.html?shoeID=${shoeID}&shopID=${shopID}`;
};

// Apply debounce to the toggleWishlist function
window.toggleWishlist = debounce(toggleWishlist, 500);

// Make toast functions available globally
window.showToast = showToast;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeBrowse().catch(error => {
        console.error("Error initializing browse page:", error);
        const loadingOverlay = getElement('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div class="loader">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ff6b6b; margin-bottom: 1rem;"></i>
                    <p>Error loading page. Please refresh.</p>
                </div>
            `;
        }
        showError("Error loading page. Please refresh.");
    });
});