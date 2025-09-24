import {
    checkUserAuth,
    auth,
    readData,
    updateData,
    logoutUser
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
                                                wishlistData[shopID][shoeID] === true;

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
    }
}


// Corrected toggleWishlist function using deleteData for removal
const debouncedToggleWishlist = debounce(async (shoeID, shopID, btnElement) => {
    const user = auth.currentUser;
    if (!user) {
        showToast("Please login to manage wishlist", true);
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
                showToast("Removed shoe from wishlist");
                icon.classList.remove("fas");
                icon.classList.add("far");
                icon.style.color = "";
                
                // Update the local data
                if (wishlistData[shopID]) {
                    delete wishlistData[shopID][shoeID];
                }
            } else {
                throw new Error(deleteResult.error);
            }
        } else {
            // Shoe is not in wishlist -> add it using updateData
            const addResult = await updateData(wishlistPath, true);
            
            if (addResult.success) {
                showToast("Added shoe to wishlist");
                icon.classList.remove("far");
                icon.classList.add("fas");
                icon.style.color = "red";
                
                // Update the local data
                if (!wishlistData[shopID]) {
                    wishlistData[shopID] = {};
                }
                wishlistData[shopID][shoeID] = true;
            } else {
                throw new Error(addResult.error);
            }
        }
    } catch (error) {
        console.error("Error toggling wishlist:", error);
        showToast("Failed to update wishlist", true);
    } finally {
        // Re-enable button after operation
        btnElement.disabled = false;
    }
}, 500);

// Update the window.toggleWishlist assignment
window.toggleWishlist = debouncedToggleWishlist;

// Update the window.toggleWishlist assignment
window.toggleWishlist = debouncedToggleWishlist;

// Function to show toast messages
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.innerHTML = `<i class="fas ${isError ? 'fa-times-circle' : 'fa-check-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    
    // Show the toast
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

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
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--error); margin-bottom: 1rem;"></i>
            <p>Error loading page. Please refresh.</p>
        </div>
    `;
});