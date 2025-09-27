// wishlist.js - Using only firebaseMethods
import { 
    checkUserAuth, 
    logoutUser, 
    readData, 
    deleteData, 
    createData,
    generate18CharID
} from '../../firebaseMethods.js';

// DOM Elements
const productsGrid = document.querySelector('.wishlist-container');
const searchBar = document.querySelector('.search-bar');
const sortOptions = document.querySelector('.sort-options');
const mobileToggle = document.querySelector('.mobile-menu-toggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('.sidebar-overlay');
const logoutBtn = document.getElementById('logout_btn');
const userNameDisplay = document.getElementById('userName_display2');
const userImageProfile = document.getElementById('imageProfile');

// Store all wishlist items for search functionality
let allWishlistItems = [];

// Mobile sidebar toggle
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

// Search functionality
searchBar.addEventListener('input', handleSearch);

function handleSearch() {
    const searchTerm = searchBar.value.toLowerCase().trim();
    
    if (!searchTerm) {
        // If search is empty, show all items
        renderWishlistItems(allWishlistItems);
        return;
    }
    
    // Filter items based on search term
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
sortOptions.addEventListener('change', handleSort);

function handleSort() {
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

// Render wishlist items to the grid
function renderWishlistItems(items) {
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
        const authResult = await checkUserAuth();
        console.log(authResult);
        if (!authResult.authenticated) {
            alert("You must be logged in to modify your wishlist.");
            return;
        }

        if (confirm(`Remove ${data.shoeName} from your wishlist?`)) {
            try {
                const wishlistPath = `smartfit_AR_Database/wishlist/${authResult.userId}/${shopID}/${shoeID}`;
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
        // Navigate to product details page
        window.location.href = `/customer/html/shoedetails.html?shopID=${shopID}&shoeID=${shoeID}`;
    });

    // Add event listener for add to cart button
    card.querySelector('.btn-cart').addEventListener('click', async () => {
        const authResult = await checkUserAuth();
        if (!authResult.authenticated) {
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
            const cartPath = `smartfit_AR_Database/carts/${authResult.userId}/${cartId}`;
            
            const createResult = await createData(cartPath, authResult.userId, cartItem);
            
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

// Load user profile data
async function loadUserProfile(userId) {
    try {
        const profilePath = `smartfit_AR_Database/customer/${userId}`;
        const profileResult = await readData(profilePath);
        
        if (profileResult.success && profileResult.data) {
            const userData = profileResult.data;
            if (userNameDisplay) {
                userNameDisplay.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Customer Name';
            }
            if (userImageProfile) {
                // Handle different profile photo structures
                let profilePhotoUrl = '';
                if (userData.profilePhoto?.url) {
                    profilePhotoUrl = userData.profilePhoto.url;
                } else if (userData.profilePhoto) {
                    profilePhotoUrl = userData.profilePhoto;
                } else if (userData.profilePhotoPath) {
                    profilePhotoUrl = userData.profilePhotoPath;
                }
                
                userImageProfile.src = profilePhotoUrl || 'https://via.placeholder.com/150';
                userImageProfile.onerror = () => {
                    userImageProfile.src = 'https://via.placeholder.com/150';
                };
            }
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

// Load wishlist data
async function loadWishlist(userId) {
    try {
        const wishlistPath = `smartfit_AR_Database/wishlist/${userId}`;
        const wishlistResult = await readData(wishlistPath);
        
        if (!wishlistResult.success || !wishlistResult.data) {
            showEmptyState();
            return;
        }

        allWishlistItems = [];
        productsGrid.innerHTML = '';

        const wishlistData = wishlistResult.data;
        const promises = [];
        
        // Process each shop in the wishlist
        for (const [shopId, shoes] of Object.entries(wishlistData)) {
            if (shoes && typeof shoes === 'object') {
                for (const [shoeId, wishlistItem] of Object.entries(shoes)) {
                    // Verify the shoe exists before trying to fetch
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
                            
                            // Add to allWishlistItems array for search functionality
                            allWishlistItems.push({
                                data: cardData,
                                shoeId: shoeId,
                                shopId: shopId
                            });
                        } else {
                            console.log('Shoe not found, removing from wishlist');
                            // Remove invalid reference
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
        
        // Wait for all promises to resolve before rendering
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

// Initialize the page
async function initializePage() {
    try {
        const authResult = await checkUserAuth();
        console.log(authResult);
        
        if (authResult.authenticated && authResult.role === 'customer') {
            // Load user profile
            await loadUserProfile(authResult.userId);
            
            // Load wishlist
            await loadWishlist(authResult.userId);
        } else {
            window.location.href = "/login.html";
        }
    } catch (error) {
        console.error("Auth check error:", error);
        window.location.href = "/login.html";
    }
}

// Logout functionality
if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
        if (confirm('Are you sure you want to logout?')) {
            const logoutResult = await logoutUser();
            if (logoutResult.success) {
                window.location.href = '/login.html';
            } else {
                console.error('Error signing out:', logoutResult.error);
            }
        }
    });
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);