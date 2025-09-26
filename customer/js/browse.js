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

const productsGrid = getElement("productsGrid");
const searchInput = getElement("searchInput");
const searchButton = getElement("searchButton");
const clearSearchButton = getElement("clearSearchButton");
const sortOptions = getElement("sortOptions");

let wishlistData = {}; 
let allShoes = []; // Store all shoes for filtering
let activeTag = null; // Track the currently active tag

// Toast functionality - Integrated directly
class ToastManager {
    constructor() {
        this.container = this.createToastContainer();
        this.toasts = new Set();
        this.autoDismissTime = 5000; // 5 seconds
    }

    createToastContainer() {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'success', duration = this.autoDismissTime) {
        const toast = this.createToast(message, type);
        this.container.appendChild(toast);
        this.toasts.add(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                this.hide(toast);
            }, duration);
        }

        return toast;
    }

    createToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = this.getIcon(type);
        
        toast.innerHTML = `
            <i class="${icon}"></i>
            <div class="toast-content">${message}</div>
            <button class="toast-close" aria-label="Close toast">
                <i class="fas fa-times"></i>
            </button>
            <div class="toast-progress"></div>
        `;

        // Add click event to close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.hide(toast));

        // Add click event to toast (close on click)
        toast.addEventListener('click', (e) => {
            if (e.target === toast || e.target.classList.contains('toast-content')) {
                this.hide(toast);
            }
        });

        return toast;
    }

    getIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    hide(toast) {
        if (!this.toasts.has(toast)) return;

        toast.classList.remove('show');
        toast.classList.add('hiding');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts.delete(toast);
        }, 300);
    }

    hideAll() {
        this.toasts.forEach(toast => this.hide(toast));
    }

    // Convenience methods
    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Create global toast instance
const toast = new ToastManager();

// Add toast CSS styles dynamically
function addToastStyles() {
    if (document.getElementById('toast-styles')) return;

    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        .toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .toast {
            min-width: 300px;
            max-width: 400px;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: inherit;
            font-size: 14px;
            font-weight: 500;
            color: white;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease-in-out;
            cursor: pointer;
        }

        .toast.show {
            opacity: 1;
            transform: translateX(0);
        }

        .toast.hiding {
            opacity: 0;
            transform: translateX(100%);
        }

        .toast.success {
            background: linear-gradient(135deg, #48cfad, #38b2ac);
            border-left: 4px solid #2d9c8a;
        }

        .toast.error {
            background: linear-gradient(135deg, #ff6b6b, #fc8181);
            border-left: 4px solid #e53e3e;
        }

        .toast.warning {
            background: linear-gradient(135deg, #ffd93d, #f6c23e);
            border-left: 4px solid #d69e2e;
            color: #2d3748;
        }

        .toast.info {
            background: linear-gradient(135deg, #4299e1, #3182ce);
            border-left: 4px solid #2b6cb0;
        }

        .toast i {
            font-size: 16px;
            flex-shrink: 0;
        }

        .toast .toast-content {
            flex: 1;
            line-height: 1.4;
        }

        .toast .toast-close {
            background: none;
            border: none;
            color: inherit;
            font-size: 16px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .toast .toast-close:hover {
            opacity: 1;
        }

        .toast-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            background: rgba(255, 255, 255, 0.5);
            width: 100%;
            transform-origin: left;
            animation: toastProgress 3s linear forwards;
        }

        @keyframes toastProgress {
            from {
                transform: scaleX(1);
            }
            to {
                transform: scaleX(0);
            }
        }

        @media (max-width: 768px) {
            .toast-container {
                top: 10px;
                right: 10px;
                left: 10px;
            }
            
            .toast {
                min-width: auto;
                max-width: none;
            }
        }
    `;
    document.head.appendChild(style);
}

// Debounce function to prevent rapid clicks
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

// Show loader immediately when the page starts loading
document.addEventListener('DOMContentLoaded', function() {
    const loadingOverlay = getElement('loadingOverlay');
    const mainContent = document.querySelector('.main-content');
    
    // Show loading overlay
    loadingOverlay.style.display = 'flex';
    
    // Add toast styles
    addToastStyles();
});

// Search functionality
function setupSearch() {
    // Show/hide clear button based on input
    searchInput.addEventListener('input', () => {
        clearSearchButton.style.display = searchInput.value ? 'block' : 'none';
    });
    
    // Clear search button handler
    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchButton.style.display = 'none';
        clearActiveTag();
        loadShoes(); // Reload all shoes
    });
    
    // Function to perform search
    function performSearch(searchTerm) {
        if (!searchTerm) {
            loadShoes();
            return;
        }
        
        // Filter shoes based on search term
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
    
    // Search button click handler
    searchButton.addEventListener('click', () => {
        const searchTerm = searchInput.value.trim();
        performSearch(searchTerm);
    });
    
    // Enter key handler
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const searchTerm = searchInput.value.trim();
            performSearch(searchTerm);
        }
    });
}

function setupTagFunctionality() {
    const tags = document.querySelectorAll('.tag');
    
    tags.forEach(tag => {
        tag.addEventListener('click', () => {
            const tagText = tag.textContent.trim();
            
            // Clear previous active tag
            clearActiveTag();
            
            // Set this tag as active
            tag.classList.add('active');
            activeTag = tagText;
            
            // Update search input with tag text
            searchInput.value = tagText;
            
            // Show clear button
            clearSearchButton.style.display = 'block';
            
            // Perform search with the tag
            performTagSearch(tagText);
        });
    });
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

// Setup sorting functionality
function setupSorting() {
    sortOptions.addEventListener('change', () => {
        const sortValue = sortOptions.value;
        sortShoes(sortValue);
    });
}

function sortShoes(sortBy) {
    let sortedShoes = [...allShoes];
    
    switch(sortBy) {
        case 'newest':
            // Assuming shoes have a dateAdded property
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

function displayShoes(shoes) {
    if (shoes.length === 0) {
        productsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-shoe-prints"></i>
                <h3>No Shoes Found</h3>
                <p>Try adjusting your search or filters</p>
            </div>
        `;
        return;
    }
    
    productsGrid.innerHTML = '';
    shoes.forEach(shoe => {
        const productCardHTML = createProductCard(shoe);
        productsGrid.innerHTML += productCardHTML;
    });
}

window.viewDetails = function (shoeID, shopID) {
    console.log(`Shoe ID: ${shoeID}, Shop ID: ${shopID}`);
    window.location.href = `/customer/html/shoedetails.html?shoeID=${shoeID}&shopID=${shopID}`;
};

// Modified loadShoes function to store all shoes
async function loadShoes() {
    const user = auth.currentUser;
    if (!user) return;

    const userID = user.uid;
    
    try {
        // Get wishlist data using readData()
        const wishlistResult = await readData(`smartfit_AR_Database/wishlist/${userID}`);
        if (wishlistResult.success && wishlistResult.data) {
            wishlistData = wishlistResult.data;
        } else {
            wishlistData = {}; // Initialize as empty object if no wishlist data
        }

        // Get all shop names first using readData()
        const shopsResult = await readData('smartfit_AR_Database/shop');
        const shopNames = {};
        if (shopsResult.success && shopsResult.data) {
            Object.keys(shopsResult.data).forEach(shopID => {
                shopNames[shopID] = shopsResult.data[shopID].shopName || shopID;
            });
        }

        // Now get all shoes using readData()
        const shoesResult = await readData('smartfit_AR_Database/shoe');
        
        // Reset allShoes array
        allShoes = [];
        
        if (shoesResult.success && shoesResult.data) {
            Object.keys(shoesResult.data).forEach(shopID => {
                const shopShoes = shoesResult.data[shopID];
                
                if (shopShoes && typeof shopShoes === 'object') {
                    Object.keys(shopShoes).forEach(shoeID => {
                        const shoeData = shopShoes[shoeID];
                        
                        // Only process if shoeData exists and is an object
                        if (shoeData && typeof shoeData === 'object') {
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

                            allShoes.push({
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
                            });
                        }
                    });
                }
            });
            
            // Display all shoes
            displayShoes(allShoes);
        } else {
            console.log("No shoe data available");
            productsGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><i class="fas fa-shoe-prints"></i><h3>No shoes available</h3><p>Check back later for new arrivals</p></div>';
        }
    } catch (error) {
        console.error("Error loading shoes: ", error);
        productsGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><i class="fas fa-exclamation-triangle"></i><h3>Error loading shoes</h3><p>Please try refreshing the page</p></div>';
        toast.error("Error loading shoes. Please try refreshing the page.");
    }
}

// Updated toggleWishlist function using the integrated toast
async function toggleWishlist(shoeID, shopID, btnElement) {
    const user = auth.currentUser;
    if (!user) {
        toast.error("Please login to manage wishlist");
        return;
    }

    // Disable button during operation
    btnElement.disabled = true;
    
    const userID = user.uid;
    const wishlistPath = `smartfit_AR_Database/wishlist/${userID}/${shopID}/${shoeID}`;

    try {
        // Use your readData method to check if item exists
        const snapshot = await readData(wishlistPath);
        const icon = btnElement.querySelector("i");

        if (snapshot.success && snapshot.data !== null) {
            // Shoe is already in wishlist -> remove it using deleteData
            const deleteResult = await deleteData(wishlistPath);
            
            if (deleteResult.success) {
                toast.success("Removed shoe from wishlist");
                icon.classList.remove("fas");
                icon.classList.add("far");
                icon.style.color = "";
                
                // Update the local data and allShoes array
                if (wishlistData[shopID]) {
                    delete wishlistData[shopID][shoeID];
                }
                
                // Update the shoe in allShoes array
                const shoeIndex = allShoes.findIndex(shoe => 
                    shoe.shoeID === shoeID && shoe.shopID === shopID
                );
                if (shoeIndex !== -1) {
                    allShoes[shoeIndex].isWishlisted = false;
                }
            } else {
                throw new Error(deleteResult.error);
            }
        } else {
            // Shoe is not in wishlist -> add it using updateData
            const addResult = await updateData(wishlistPath, true);
            
            if (addResult.success) {
                toast.success("Added shoe to wishlist");
                icon.classList.remove("far");
                icon.classList.add("fas");
                icon.style.color = "red";
                
                // Update the local data and allShoes array
                if (!wishlistData[shopID]) {
                    wishlistData[shopID] = {};
                }
                wishlistData[shopID][shoeID] = true;
                
                // Update the shoe in allShoes array
                const shoeIndex = allShoes.findIndex(shoe => 
                    shoe.shoeID === shoeID && shoe.shopID === shopID
                );
                if (shoeIndex !== -1) {
                    allShoes[shoeIndex].isWishlisted = true;
                }
            } else {
                throw new Error(addResult.error);
            }
        }
    } catch (error) {
        console.error("Error toggling wishlist:", error);
        toast.error("Failed to update wishlist");
    } finally {
        // Re-enable button after operation
        btnElement.disabled = false;
    }
}

// Apply debounce to the toggleWishlist function
window.toggleWishlist = debounce(toggleWishlist, 500);

// Remove the old showToast function since we're using the new toast system

// Initialize the page
async function initializePage() {
    const authStatus = await checkUserAuth();
    
    if (authStatus.authenticated) {
        console.log(`User is ${authStatus.role}`, authStatus.userData);
        
        // Load shoes and setup functionality
        await loadShoes();
        setupSearch();
        setupTagFunctionality();
        setupSorting();
        
        // Hide loader and show content
        const loadingOverlay = getElement('loadingOverlay');
        const mainContent = document.querySelector('.main-content');
        
        loadingOverlay.style.display = 'none';
        mainContent.classList.add('loaded');
        
        // Setup logout button
        getElement('logout_btn').addEventListener('click', async () => {
            await logoutUser();
            window.location.href = "/login.html";
        });
    } else {
        window.location.href = "/login.html";
    }
}

// Start the application
initializePage().catch(error => {
    console.error("Error initializing page:", error);
    const loadingOverlay = getElement('loadingOverlay');
    loadingOverlay.innerHTML = `
        <div class="loader">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ff6b6b; margin-bottom: 1rem;"></i>
            <p>Error loading page. Please refresh.</p>
        </div>
    `;
    toast.error("Error loading page. Please refresh.");
});

// Make toast available globally
window.toast = toast;