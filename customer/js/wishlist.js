// wishlist.js - Using only firebaseMethods
import { 
    checkUserAuth, 
    logoutUser, 
    readData, 
    deleteData, 
    createData,
    generate18CharID
} from '../../firebaseMethods.js';

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Global variables
let userData = null;
let userId = null;
let allWishlistItems = [];

// Initialize the page
async function initializeWishlist() {
    const authStatus = await checkUserAuth();
    
    if (authStatus.authenticated && authStatus.role === 'shopowner') {
        console.log(`User is ${authStatus.role}`, authStatus.userData);
        window.location.href = "../../shopowner/html/shop_dashboard.html";
        return;
    } else if (authStatus.authenticated && authStatus.role === 'customer') {
        console.log(`User is ${authStatus.role}`, authStatus.userData);
        userData = authStatus.userData;
        userId = authStatus.userId;
    } else {
        window.location.href = "/login.html";
        return;
    }

    // Load user profile
    loadUserProfile();
    
    // Load wishlist items
    await loadWishlistItems();
    
    // Set up event listeners
    setupEventListeners();
}

// Load user profile
function loadUserProfile() {
    const userNameDisplay1 = getElement('userName_display1');
    const userNameDisplay2 = getElement('userName_display2');
    const imageProfile = getElement('imageProfile');
    
    if (userNameDisplay1) {
        userNameDisplay1.textContent = userData.firstName || 'Customer';
    }
    
    if (userNameDisplay2) {
        userNameDisplay2.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Customer';
    }
    
    if (imageProfile) {
        imageProfile.src = userData.profilePhoto || "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }
    
    document.body.style.display = '';
}

// Load wishlist data
async function loadWishlistItems() {
    const productsGrid = document.querySelector('.wishlist-container');
    if (!productsGrid) return;

    // Show loading state
    productsGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-spinner fa-spin"></i>
            <h3>Loading your wishlist...</h3>
            <p>Please wait while we load your saved items</p>
        </div>
    `;

    try {
        const wishlistPath = `smartfit_AR_Database/wishlist/${userId}`;
        const wishlistResult = await readData(wishlistPath);
        
        if (!wishlistResult.success || !wishlistResult.data) {
            showEmptyState();
            return;
        }

        allWishlistItems = [];
        const wishlistData = wishlistResult.data;
        const promises = [];
        
        // Process each shop in the wishlist
        for (const [shopId, shoes] of Object.entries(wishlistData)) {
            if (shoes && typeof shoes === 'object') {
                for (const [shoeId, wishlistItem] of Object.entries(shoes)) {
                    const shoePath = `smartfit_AR_Database/shoe/${shopId}/${shoeId}`;
                    
                    const promise = readData(shoePath).then(shoeResult => {
                        if (shoeResult.success && shoeResult.data) {
                            const data = shoeResult.data;
                            
                            // Ensure required fields exist
                            const cardData = {
                                ...data,
                                shopID: shopId,
                                shoeName: data.shoeName || 'Unknown Shoe',
                                shopName: data.shopName || 'Unknown Shop',
                                defaultImage: data.defaultImage || 'https://via.placeholder.com/300x200?text=No+Image'
                            };
                            
                            allWishlistItems.push({
                                data: cardData,
                                shoeId: shoeId,
                                shopId: shopId
                            });
                        } else {
                            console.log('Shoe not found, removing from wishlist');
                            const invalidPath = `smartfit_AR_Database/wishlist/${userId}/${shopId}/${shoeId}`;
                            return deleteData(invalidPath);
                        }
                    }).catch(err => {
                        console.error('Error fetching shoe:', err);
                    });
                    
                    promises.push(promise);
                }
            }
        }
        
        await Promise.all(promises);
        
        if (allWishlistItems.length > 0) {
            renderWishlistItems(allWishlistItems);
        } else {
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading wishlist:', error);
        showEmptyState();
    }
}

// Render wishlist items to the grid
function renderWishlistItems(items) {
    const productsGrid = document.querySelector('.wishlist-container');
    if (!productsGrid) return;
    
    productsGrid.innerHTML = '';
    
    if (items.length === 0) {
        showEmptyState();
        return;
    }
    
    items.forEach(item => {
        const card = createProductCard(item.data, item.shoeId, item.shopId);
        productsGrid.appendChild(card);
    });
}

// Helper to display a single product
function createProductCard(data, shoeID, shopID) {
    const card = document.createElement('div');
    card.className = 'shoe-card';

    // Get the first variant price or default to 0
    const firstVariant = data.variants ? Object.values(data.variants)[0] : null;
    const price = firstVariant?.price || 0;

    // Safely handle missing image
    const imageUrl = data.defaultImage || 'https://via.placeholder.com/300x200?text=No+Image';

    // Get brand and category from data
    const shoeCode = data.shoeCode || shoeID;

    // Create the card HTML with gender display
    card.innerHTML = `
        <div class="remove-wishlist">
            <i class="fas fa-times"></i>
        </div>
        <div class="shoe-image">
            <img src="${imageUrl}" alt="${data.shoeName || 'Shoe image'}" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
        </div>
        <div class="shoe-details">
            <h3>${data.shoeName || 'Unnamed product'}</h3>
            <div class="shoe-code">Code: ${shoeCode}</div>
            <div class="product-meta">
                <span class="product-brand">${data.shoeBrand || 'No Brand'}</span>
                <span class="product-type">${data.shoeType || 'No Type'}</span>
                ${data.shoeGender ? `<span class="product-gender">${data.shoeGender}</span>` : ''}
            </div>
            <div class="shoe-description">${data.generalDescription || 'No description available.'}</div>
            <div class="shoe-price">₱${price.toFixed(2)}</div>
            <div class="shoe-actions">
                <button class="btn-view">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <button class="btn-cart">
                    <i class="fas fa-shopping-cart"></i>
                </button>
            </div>
        </div>
    `;

    // Add event listener for remove button
    card.querySelector('.remove-wishlist').addEventListener('click', async () => {
        if (!userId) {
            alert("You must be logged in to modify your wishlist.");
            return;
        }

        if (confirm(`Remove ${data.shoeName} from your wishlist?`)) {
            try {
                const wishlistPath = `smartfit_AR_Database/wishlist/${userId}/${shopID}/${shoeID}`;
                const deleteResult = await deleteData(wishlistPath);
                
                if (deleteResult.success) {
                    // Remove from allWishlistItems array
                    allWishlistItems = allWishlistItems.filter(item => 
                        !(item.shoeId === shoeID && item.shopId === shopID)
                    );
                    
                    card.remove();
                    if (allWishlistItems.length === 0) {
                        showEmptyState();
                    }
                } else {
                    alert("Failed to remove item from wishlist");
                }
            } catch (error) {
                console.error("Error removing from wishlist:", error);
                alert("Failed to remove item from wishlist");
            }
        }
    });

    // Add event listener for view button
    card.querySelector('.btn-view').addEventListener('click', () => {
        window.location.href = `/customer/html/shoedetails.html?shopID=${shopID}&shoeID=${shoeID}`;
    });

    // Add event listener for add to cart button
    card.querySelector('.btn-cart').addEventListener('click', async () => {
        if (!userId) {
            alert("You must be logged in to add items to your cart.");
            return;
        }

        // Get first variant (or handle selection)
        const variants = data.variants ? Object.entries(data.variants) : [];
        if (variants.length === 0) {
            alert("No variants available for this shoe.");
            return;
        }

        // Use first variant as default
        const [variantKey, variantData] = variants[0];

        // Get first available size
        const sizes = variantData.sizes ? Object.entries(variantData.sizes) : [];
        if (sizes.length === 0) {
            alert("No sizes available for this variant.");
            return;
        }

        const [sizeKey, sizeObj] = sizes[0];
        const sizeValue = Object.keys(sizeObj)[0];

        // Create complete cart item
        const cartItem = {
            shopId: shopID,
            shoeId: shoeID,
            variantKey: variantKey,
            sizeKey: sizeKey,
            shoeName: data.shoeName || "",
            variantName: variantData.variantName || variantData.color || "",
            color: variantData.color || "",
            size: sizeValue,
            price: variantData.price || 0,
            image: variantData.imageUrl || data.defaultImage || "",
            quantity: 1,
            addedAt: new Date().toISOString()
        };

        try {
            // Generate unique cart ID
            const cartId = generate18CharID();
            const cartPath = `smartfit_AR_Database/carts/${userId}/${cartId}`;
            
            const createResult = await createData(cartPath, userId, cartItem);
            
            if (createResult.success) {
                alert(`${data.shoeName} added to cart`);
            } else {
                alert("Failed to add to cart");
            }
        } catch (error) {
            console.error("Error adding to cart:", error);
            alert("Failed to add to cart");
        }
    });

    return card;
}

// Show empty state
function showEmptyState() {
    const productsGrid = document.querySelector('.wishlist-container');
    if (!productsGrid) return;

    productsGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-heart empty-icon"></i>
            <h3 class="empty-title">Your wishlist is empty</h3>
            <p class="empty-description">
                You haven't added any items to your wishlist yet. Browse our collection and click the heart icon to save your favorites.
            </p>
            <a href="/customer/html/browse.html" class="browse-btn">
                <i class="fas fa-shopping-bag"></i> Browse Shoes
            </a>
        </div>
    `;
}

// Search functionality
function handleSearch() {
    const searchBar = document.querySelector('.search-bar');
    if (!searchBar) return;

    const searchTerm = searchBar.value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderWishlistItems(allWishlistItems);
        return;
    }
    
    const filteredItems = allWishlistItems.filter(item => {
        return (
            item.data.shoeName.toLowerCase().includes(searchTerm) ||
            (item.data.shoeBrand && item.data.shoeBrand.toLowerCase().includes(searchTerm)) ||
            (item.data.shoeType && item.data.shoeType.toLowerCase().includes(searchTerm)) ||
            (item.data.generalDescription && item.data.generalDescription.toLowerCase().includes(searchTerm)) ||
            (item.data.shoeCode && item.data.shoeCode.toLowerCase().includes(searchTerm))
        );
    });
    
    renderWishlistItems(filteredItems);
}

// Sort functionality
function handleSort() {
    const sortOptions = document.querySelector('.sort-options');
    if (!sortOptions) return;

    const sortBy = sortOptions.value;
    let sortedItems = [...allWishlistItems];
    
    switch(sortBy) {
        case 'Sort by: Price Low to High':
            sortedItems.sort((a, b) => {
                const priceA = getPrice(a.data);
                const priceB = getPrice(b.data);
                return priceA - priceB;
            });
            break;
            
        case 'Sort by: Price High to Low':
            sortedItems.sort((a, b) => {
                const priceA = getPrice(a.data);
                const priceB = getPrice(b.data);
                return priceB - priceA;
            });
            break;
            
        case 'Sort by: Recently Added':
        default:
            // Default order (as loaded from Firebase)
            break;
    }
    
    renderWishlistItems(sortedItems);
}

function getPrice(data) {
    const firstVariant = data.variants ? Object.values(data.variants)[0] : null;
    return firstVariant?.price || 0;
}

// Set up event listeners
function setupEventListeners() {
    // Logout functionality
    const logoutBtn = getElement('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
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

    // Search functionality
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        let searchTimeout;
        searchBar.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                handleSearch();
            }, 300);
        });
    }

    // Sort functionality
    const sortOptions = document.querySelector('.sort-options');
    if (sortOptions) {
        sortOptions.addEventListener('change', handleSort);
    }

    // Mobile menu setup
    setupMobileMenu();
}

function setupMobileMenu() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (mobileToggle && sidebar && overlay) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.remove('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
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

    // Initialize wishlist page
    initializeWishlist().catch(error => {
        console.error('Error initializing wishlist page:', error);
        const productsGrid = document.querySelector('.wishlist-container');
        if (productsGrid) {
            productsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Page</h3>
                    <p>Please try refreshing the page.</p>
                </div>
            `;
        }
    });
});