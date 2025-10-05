// Import the firebaseMethods
import { 
    checkUserAuth, 
    logoutUser, 
    readData, 
    readDataRealtime, 
    updateData,
    generate18CharID,
    deleteData
} from '../../firebaseMethods.js';

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Global variables
let userData = null;
let userId = null;
let productData = {};
let selectedVariantKey = null;
let selectedSize = null;
let maxAvailableQty = 1;
let cursedWords = [];

// URL Params
const urlParams = new URLSearchParams(window.location.search);
const shoeID = urlParams.get('shoeID');
const shopID = urlParams.get('shopID');

// Initialize the page
async function initializeShoeDetails() {
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
        // Guest user - allow viewing but disable interactive features
        console.log("User is guest");
        userData = { firstName: 'Guest', lastName: 'User' };
    }

    // Load user profile
    loadUserProfile();
    
    // Load censored words
    loadCensoredWords();
    
    // Load product details
    await loadProductDetails();
    
    // Set up event listeners
    setupEventListeners();

    document.body.style.display = '';
}

// Load user profile
function loadUserProfile() {
    const userNameDisplay1 = getElement('userName_display1');
    const userNameDisplay2 = getElement('userName_display2');
    const imageProfile = getElement('imageProfile');
    
    if (userNameDisplay1) {
        userNameDisplay1.textContent = userData.firstName || 'Guest';
    }
    
    if (userNameDisplay2) {
        userNameDisplay2.textContent = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Guest User';
    }
    
    if (imageProfile && userId) {
        imageProfile.src = userData.profilePhoto || "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    } else if (imageProfile) {
        imageProfile.src = "https://randomuser.me/api/portraits/men/32.jpg";
    }
}

// Load product data
async function loadProductDetails() {
    const shoePath = `smartfit_AR_Database/shoe/${shopID}/${shoeID}`;

    try {
        const result = await readData(shoePath);
        
        if (result.success) {
            productData = result.data;
            updateProductInfo();
            loadVariants();
            
            // Check wishlist status if user is logged in
            if (userId) {
                isWishlisted();
            }
            
            loadCustomerReviews();
        } else {
            console.log("Product not found:", result.error);
            showProductNotFound();
        }
    } catch (error) {
        console.error("Error loading product details:", error);
        showProductNotFound();
    }
}

function showProductNotFound() {
    const productContainer = document.querySelector('.product-details-container');
    if (productContainer) {
        productContainer.innerHTML = `
            <div class="product-not-found">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Product Not Found</h3>
                <p>The requested product could not be found.</p>
                <a href="/customer/html/customer_dashboard.html" class="btn btn-primary">Return to Dashboard</a>
            </div>
        `;
    }
}

function loadCensoredWords() {
    const curseWordsPath = 'smartfit_AR_Database/curseWords';
    
    const unsubscribe = readDataRealtime(curseWordsPath, (result) => {
        if (result.success) {
            const wordsObj = result.data;
            cursedWords = Object.values(wordsObj).map(wordData => wordData.word.toLowerCase());
            console.log("Loaded censored words:", cursedWords);
        } else {
            console.log("No censored words found in database");
            cursedWords = [];
        }
    });

    return unsubscribe;
}

// Update general info
function updateProductInfo() {
    console.log("Product Data:", productData);
    getElement('productName').textContent = productData.shoeName;
    getElement('productShop').textContent = `Shop Name: ${productData.shopName}`;
    getElement('productCode').textContent = `Product Code: ${shoeID}`;
    getElement('productDescription').textContent = productData.generalDescription || "No description available.";
    getElement('mainProductImage').src = productData.defaultImage || "";
    
    // Update brand, type, and gender information
    const brandElement = getElement("productBrand");
    const typeElement = getElement("productType");
    const genderElement = getElement("productGender");
    
    if (brandElement) {
        brandElement.textContent = `Brand: ${productData.shoeBrand || 'Not specified'}`;
    }
    
    if (typeElement) {
        typeElement.textContent = `Type: ${formatShoeType(productData.shoeType) || 'Not specified'}`;
    }
    
    if (genderElement) {
        genderElement.textContent = `Gender: ${formatShoeGender(productData.shoeGender) || 'Not specified'}`;
    }

    // Set initial variant if exists
    const variantKeys = Object.keys(productData.variants || {});
    if (variantKeys.length > 0) {
        selectedVariantKey = variantKeys[0];
        updatePriceAndSizes(selectedVariantKey);
    }
}

// Helper function to format shoe type for display
function formatShoeType(type) {
    if (!type) return '';
    
    const typeMap = {
        'sneaker': 'Running',
        'boot': 'Basketball',
        'formal': 'Casual',
        'sneakers': 'Sneakers',
        'boots': 'Boots',
        'sandals': 'Sandals',
        'slippers': 'Slippers',
        'high-heels': 'High Heels',
        'flats': 'Flats'
    };
    
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

// Helper function to format shoe gender for display
function formatShoeGender(gender) {
    if (!gender) return '';
    
    const genderMap = {
        'male': 'Male',
        'female': 'Female',
        'unisex': 'Unisex'
    };
    
    return genderMap[gender] || gender.charAt(0).toUpperCase() + gender.slice(1);
}

// Load color variants
function loadVariants() {
    const colorOptions = getElement('colorOptions');
    const sizeOptions = getElement('sizeOptions');
    
    colorOptions.innerHTML = '';
    sizeOptions.innerHTML = '';

    const variants = productData.variants;
    if (!variants) return;

    for (const variantKey in variants) {
        const variant = variants[variantKey];

        const colorDiv = document.createElement("div");
        colorDiv.className = "color-option";
        colorDiv.textContent = variant.color;
        colorDiv.onclick = (event) => {
            event.stopPropagation();
            selectedVariantKey = variantKey;
            getElement('mainProductImage').src = variant.imageUrl || productData.defaultImage || "";
            updatePriceAndSizes(variantKey);
            selectColor(variantKey);
            
            // Hide quantity controls when color changes
            getElement('quantitySelector').classList.remove("visible");
            clearSizeSelection();
        };

        colorOptions.appendChild(colorDiv);
    }
}

function selectColor(selectedKey) {
    const allColorDivs = getElement('colorOptions').querySelectorAll(".color-option");
    allColorDivs.forEach(div => div.classList.remove("selected"));

    const selectedDiv = Array.from(allColorDivs).find(div => div.textContent.trim() === productData.variants[selectedKey].color);
    if (selectedDiv) selectedDiv.classList.add("selected");
}

// Update price and sizes when variant is selected
function updatePriceAndSizes(variantKey) {
    const variant = productData.variants[variantKey];
    getElement('productPrice').textContent = `₱${variant.price}`;
    
    const sizeOptions = getElement('sizeOptions');
    sizeOptions.innerHTML = '';

    console.log("variant.sizes:", variant.sizes);

    for (const sizeKey in variant.sizes) {
        const sizeGroup = variant.sizes[sizeKey];
        for (const actualSize in sizeGroup) {
            const stockInfo = sizeGroup[actualSize];
            const stock = stockInfo.stock;

            const sizeDiv = document.createElement("div");
            sizeDiv.className = "size-option";
            sizeDiv.textContent = `${actualSize} (${stock})`;
            
            // Add disabled class if stock is 0
            if (stock <= 0) {
                sizeDiv.classList.add("disabled");
                sizeDiv.style.opacity = "0.5";
                sizeDiv.style.cursor = "not-allowed";
                sizeDiv.onclick = null;
            } else {
                sizeDiv.onclick = (event) => {
                    event.stopPropagation();

                    // Remove .selected from all size options
                    const allSizeDivs = sizeOptions.querySelectorAll(".size-option");
                    allSizeDivs.forEach(div => div.classList.remove("selected"));

                    // Add .selected to the clicked size
                    sizeDiv.classList.add("selected");

                    selectedSize = actualSize;
                    maxAvailableQty = stock;

                    // Show quantity controls
                    getElement('quantitySelector').classList.add("visible");
                    
                    // Set max quantity and current value
                    const quantityInput = getElement("quantity");
                    quantityInput.max = stock;
                    quantityInput.value = 1;

                    const stockText = getElement("availableStock");
                    if (stockText) stockText.textContent = `Available: ${stock}`;
                    
                    // Enable buttons when size is selected
                    getElement('buyNowBtn').disabled = false;
                    getElement('addToCartBtn').disabled = false;
                };
            }

            sizeOptions.appendChild(sizeDiv);
        }
    }
}

// Load customer reviews from Firebase
async function loadCustomerReviews() {
    const feedbackPath = `smartfit_AR_Database/feedbacks`;

    try {
        const result = await readData(feedbackPath);
        
        if (result.success) {
            const feedbacks = result.data;
            displayReviews(feedbacks);
        } else {
            getElement('reviewsContainer').innerHTML = "<p>No reviews yet.</p>";
        }
    } catch (error) {
        console.error("Error loading reviews:", error);
        getElement('reviewsContainer').innerHTML = "<p>Failed to load reviews. Please try again later.</p>";
    }
}

async function getCustomernameUsingID(userID) {
    const userPath = `smartfit_AR_Database/customers/${userID}`;
    
    try {
        const result = await readData(userPath);
        console.log(result);
        
        if (result.success) {
            const userData = result.data;
            return `${userData.firstName} ${userData.lastName}` || "Anonymous User";
        } else {
            return "Anonymous User";
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
        return "Anonymous User";
    }
}

// Display reviews on the page
async function displayReviews(feedbacks) {
    const reviewsList = getElement('reviewsContainer');
    if (reviewsList) reviewsList.innerHTML = '<div class="loading">Loading reviews...</div>';

    // Calculate review counts per rating
    const ratingCounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    const reviewsToDisplay = [];

    console.log("Feedbacks data:", feedbacks);
    for (const userId in feedbacks) {
        console.log("Processing feedbacks for user:", userId);
        for (const orderID in feedbacks[userId]) {
            console.log("Processing order ID:", orderID);
            const feedback = feedbacks[userId][orderID];
            console.log("Feedback data:", feedback);
            if (feedback.shoeID === shoeID) {
                reviewsToDisplay.push({
                    userId,
                    feedback
                });
                // Count ratings (1-5 stars only)
                if (feedback.rating >= 1 && feedback.rating <= 5) {
                    ratingCounts[feedback.rating]++;
                }
            }
        }
    }

    // Update the filter buttons with counts
    updateRatingFilters(ratingCounts);

    // Calculate and display average rating
    const averageRating = calculateAverageRating(feedbacks);
    console.log("Average Rating:", averageRating);
    const averageRatingElement = getElement('averageRating');
    
    if (averageRatingElement) {
        if (averageRating > 0) {
            averageRatingElement.innerHTML = `
                <span class="average-rating" style="font-size: 0.8em; color: var(--warning);">
                    ${averageRating} <i class="fas fa-star"></i> (${Object.values(ratingCounts).reduce((a, b) => a + b, 0)})
                </span>
            `;
        } else {
            averageRatingElement.innerHTML = `
                <span class="average-rating" style="font-size: 0.8em; color: var(--gray-dark);">
                    (No ratings yet)
                </span>
            `;
        }
    }

    // If no reviews, show message
    if (reviewsToDisplay.length === 0) {
        reviewsList.innerHTML = "<p>No reviews yet.</p>";
        return;
    }

    reviewsList.innerHTML = '';

    // Process each review asynchronously
    for (const review of reviewsToDisplay) {
        try {
            const username = await getCustomernameUsingID(review.userId);

            const reviewDiv = document.createElement("div");
            reviewDiv.classList.add("review-item");
            reviewDiv.dataset.rating = review.feedback.rating;

            // Create review header
            const headerDiv = document.createElement("div");
            headerDiv.classList.add("review-header");
            
            const authorSpan = document.createElement("span");
            authorSpan.classList.add("review-author");
            authorSpan.textContent = username;
            
            const dateSpan = document.createElement("span");
            dateSpan.classList.add("review-date");
            dateSpan.textContent = formatTimestamp(review.feedback.timestamp);
            
            headerDiv.appendChild(authorSpan);
            headerDiv.appendChild(dateSpan);
            
            // Create stars
            const starsDiv = document.createElement("div");
            starsDiv.classList.add("review-stars");
            
            for (let i = 1; i <= 5; i++) {
                const starIcon = document.createElement("i");
                starIcon.classList.add(i <= review.feedback.rating ? "fas" : "far");
                starIcon.classList.add("fa-star");
                starsDiv.appendChild(starIcon);
            }
            
            // Create comment
            const commentP = document.createElement("p");
            commentP.textContent = censoredText(review.feedback.comment) || "No comment provided.";
            
            // Append all elements
            reviewDiv.appendChild(headerDiv);
            reviewDiv.appendChild(starsDiv);
            reviewDiv.appendChild(commentP);
            
            reviewsList.appendChild(reviewDiv);

        } catch (error) {
            console.error("Error processing review:", error);
        }
    }
}

function updateRatingFilters(ratingCounts) {
    const filtersContainer = document.querySelector('.review-filters');
    if (!filtersContainer) return;
    
    filtersContainer.innerHTML = '';
    
    const totalReviews = Object.values(ratingCounts).reduce((a, b) => a + b, 0);
    
    for (let rating = 5; rating >= 1; rating--) {
        const filter = document.createElement('div');
        filter.className = 'stars-filter';
        filter.dataset.rating = rating;
        filter.onclick = () => filterReviews(rating);
        
        filter.innerHTML = `
            <div class="stars">
                ${'<i class="fas fa-star"></i>'.repeat(rating)}
                ${'<i class="far fa-star"></i>'.repeat(5 - rating)}
            </div>
            <div class="text">${rating} Star${rating !== 1 ? 's' : ''} (${ratingCounts[rating]})</div>
        `;
        
        filtersContainer.appendChild(filter);
    }
    
    const allFilter = document.createElement('div');
    allFilter.className = 'stars-filter active';
    allFilter.dataset.rating = '0';
    allFilter.onclick = () => filterReviews(0);
    allFilter.innerHTML = `
        <div class="text">All Reviews (${totalReviews})</div>
    `;
    filtersContainer.appendChild(allFilter);
}

// Filter reviews by star rating
window.filterReviews = function(rating) {
    const reviewItems = document.querySelectorAll('.review-item');
    const filters = document.querySelectorAll('.stars-filter');
    
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

async function isWishlisted() {
    if (!userId) {
        console.log("User not logged in");
        return;
    }

    const wishlistPath = `smartfit_AR_Database/wishlist/${userId}/${shopID}/${shoeID}`;
    
    try {
        const result = await readData(wishlistPath);
        const wishlistBtn = getElement('wishlistBtn');
        const icon = wishlistBtn.querySelector("i");
        
        if (result.success) {
            wishlistBtn.classList.add("active");
            icon.classList.remove("far");
            icon.classList.add("fas");
            icon.style.color = "red";
        } else {
            wishlistBtn.classList.remove("active");
            icon.classList.remove("fas");
            icon.classList.add("far");
            icon.style.color = "";
        }
    } catch (error) {
        console.error("Error checking wishlist status:", error);
    }
}

async function toggleWishlist() {
    if (!userId) {
        alert("Please log in to use the wishlist");
        window.location.href = "/login.html";
        return;
    }

    const wishlistBtn = getElement('wishlistBtn');
    const wishlistPath = `smartfit_AR_Database/wishlist/${userId}/${shopID}/${shoeID}`;
    const icon = wishlistBtn.querySelector("i");

    // Disable button during operation
    wishlistBtn.disabled = true;

    try {
        const snapshot = await readData(wishlistPath);

        if (snapshot.success && snapshot.data !== null) {
            // Remove from wishlist - use deleteData if available, otherwise updateData with null
            const deleteResult = await deleteData(wishlistPath); // Use deleteData if you have it
            // If deleteData is not available, use: const deleteResult = await updateData(wishlistPath, null);

            if (deleteResult && deleteResult.success) {
                console.log("Shoe removed from wishlist");
                
                // Update UI immediately
                wishlistBtn.classList.remove("active");
                icon.classList.remove("fas");
                icon.classList.add("far");
                icon.style.color = "";
                
                // Show success message if you have toast functionality
                if (window.showSuccess) {
                    showSuccess("Removed from wishlist");
                } else {
                    console.log("Removed from wishlist");
                }
            } else {
                throw new Error(deleteResult?.error || "Failed to remove from wishlist");
            }
        } else {
            // Add to wishlist
            const wishlistData = {
                lastUpdated: new Date().toISOString()
            };

            const addResult = await updateData(wishlistPath, wishlistData);
            
            if (addResult && addResult.success) {
                console.log("Shoe added to wishlist");
                
                // Update UI immediately
                wishlistBtn.classList.add("active");
                icon.classList.remove("far");
                icon.classList.add("fas");
                icon.style.color = "red";
                
                // Show success message if you have toast functionality
                if (window.showSuccess) {
                    showSuccess("Added to wishlist");
                } else {
                    console.log("Added to wishlist");
                }
            } else {
                throw new Error(addResult?.error || "Failed to add to wishlist");
            }
        }
    } catch (error) {
        console.error("Error toggling wishlist:", error);
        
        // Show error message
        if (window.showError) {
            showError("Failed to update wishlist");
        } else {
            alert("Failed to update wishlist");
        }
        
        // Re-check the actual state from database
        await isWishlisted();
    } finally {
        // Re-enable button
        wishlistBtn.disabled = false;
    }
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

    // Wishlist button
    const wishlistBtn = getElement('wishlistBtn');
    if (wishlistBtn) {
        wishlistBtn.addEventListener("click", function() {
            toggleWishlist();
        });
    }

    // Buy Now button
    const buyNowBtn = getElement('buyNowBtn');
    if (buyNowBtn) {
        buyNowBtn.addEventListener("click", handleBuyNow);
    }

    // Add to Cart button
    const addToCartBtn = getElement('addToCartBtn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener("click", handleAddToCart);
    }

    // Quantity controls
    setupQuantityControls();

    // Mobile menu setup
    setupMobileMenu();
}

function setupQuantityControls() {
    window.adjustQuantity = function (change) {
        const quantityInput = getElement("quantity");
        let currentValue = parseInt(quantityInput.value) || 1;
        currentValue += change;
        
        if (currentValue < 1) currentValue = 1;
        if (currentValue > maxAvailableQty) currentValue = maxAvailableQty;
        
        quantityInput.value = currentValue;
    };

    // Add input validation
    const quantityInput = getElement("quantity");
    if (quantityInput) {
        quantityInput.addEventListener('change', function() {
            validateQuantity();
        });
    }
}

function validateQuantity() {
    const quantityInput = getElement("quantity");
    let qty = parseInt(quantityInput.value);
    
    if (isNaN(qty)) qty = 1;
    if (qty < 1) qty = 1;
    if (qty > maxAvailableQty) qty = maxAvailableQty;
    
    quantityInput.value = qty;
}

function setupMobileMenu() {
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

// Handle Buy Now button click
async function handleBuyNow() {
    const check = canAddToCartOrBuy();
    if (!check.canProceed) {
        alert(check.message);
        return;
    }

    try {
        console.log("[Buy Now] Button clicked - Starting process");

        const variant = productData.variants[selectedVariantKey];
        const quantity = parseInt(getElement("quantity").value) || 1;

        // Find the sizeKey
        let sizeKey = null;
        for (const [key, sizeObj] of Object.entries(variant.sizes)) {
            const sizeValue = Object.keys(sizeObj)[0];
            if (sizeValue === selectedSize) {
                sizeKey = key;
                break;
            }
        }

        if (!sizeKey) {
            console.error("Size key not found for size:", selectedSize);
            alert("Invalid size selection");
            return;
        }

        // Prepare URL parameters
        const params = new URLSearchParams({
            method: "buyNow",
            shopId: shopID,
            shoeId: shoeID,
            variantKey: selectedVariantKey,
            sizeKey: sizeKey,
            size: selectedSize,
            quantity: quantity,
            price: variant.price,
            shoeName: productData.shoeName,
            variantName: variant.variantName || "Standard",
            color: variant.color || "Default",
            image: variant.imageUrl || productData.defaultImage || "https://via.placeholder.com/150",
            shopName: productData.shopName || "Unknown Shop"
        });

        console.log("Redirecting to checkout with params:", params.toString());
        window.location.href = `/customer/html/checkout.html?${params.toString()}`;

    } catch (error) {
        console.error("Error in Buy Now process:", error);
        alert("An error occurred. Please try again.");
    }
}

// Handle Add to Cart button click
async function handleAddToCart() {
    const check = canAddToCartOrBuy();
    if (!check.canProceed) {
        alert(check.message);
        return;
    }

    if (!userId) {
        alert("Please log in first.");
        window.location.href = '/login.html';
        return;
    }

    const variant = productData.variants[selectedVariantKey];

    // Find the sizeKey that corresponds to the selected size
    let sizeKey = null;
    for (const [key, sizeObj] of Object.entries(variant.sizes)) {
        if (Object.keys(sizeObj)[0] === selectedSize) {
            sizeKey = key;
            break;
        }
    }

    if (!sizeKey) {
        alert("Invalid size selection");
        return;
    }

    const cartItem = {
        shopId: shopID,
        shoeId: shoeID,
        variantKey: selectedVariantKey,
        sizeKey: sizeKey,
        shoeName: productData.shoeName,
        variantName: variant.variantName || "",
        color: variant.color || "",
        size: selectedSize,
        price: variant.price,
        image: variant.imageUrl || productData.defaultImage || "",
        quantity: parseInt(getElement("quantity").value || 1),
        addedAt: new Date().toISOString()
    };

    const cartItemId = generate18CharID();
    const cartPath = `smartfit_AR_Database/carts/${userId}/${cartItemId}`;

    try {
        const result = await updateData(cartPath, cartItem);
        
        if (result.success) {
            alert("Item added to cart successfully!");
        } else {
            console.error("Error adding to cart:", result.error);
            alert("Failed to add item to cart");
        }
    } catch (error) {
        console.error("Error adding to cart:", error);
        alert("Failed to add item to cart");
    }
}

function canAddToCartOrBuy() {
    if (!selectedSize) {
        return { canProceed: false, message: "Please select a size first." };
    }
    
    const variant = productData.variants[selectedVariantKey];
    let stock = 0;
    
    for (const sizeObj of Object.values(variant.sizes)) {
        if (sizeObj[selectedSize]) {
            stock = sizeObj[selectedSize].stock;
            break;
        }
    }
    
    if (stock <= 0) {
        return { canProceed: false, message: "This item is out of stock." };
    }
    
    return { canProceed: true };
}

function clearSizeSelection() {
    selectedSize = null;
    getElement('buyNowBtn').disabled = true;
    getElement('addToCartBtn').disabled = true;
    getElement('quantitySelector').classList.remove("visible");
}

function formatTimestamp(timestamp) {
    let date = new Date(timestamp);

    let month = String(date.getMonth() + 1).padStart(2, '0');
    let day = String(date.getDate()).padStart(2, '0');
    let year = date.getFullYear();
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');

    return `${ month }/${day}/${ year } ${ hours }:${ minutes }`;
}

function calculateAverageRating(feedbacks) {
    let totalRating = 0;
    let reviewCount = 0;

    for (const userId in feedbacks) {
        for (const orderID in feedbacks[userId]) {
            const feedback = feedbacks[userId][orderID];
            if (feedback.shoeID === shoeID) {
                totalRating += feedback.rating;
                reviewCount++;
            }
        }
    }

    if (reviewCount === 0) {
        return 0;
    }

    return (totalRating / reviewCount).toFixed(1);
}

function censoredText(text) {
    if (!text) return text;
    
    let censored = text;
    
    cursedWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        censored = censored.replace(regex, '****');
    });
    
    return censored;
}

// Initialize buttons as disabled
document.addEventListener('DOMContentLoaded', function() {
    const buyNowBtn = getElement('buyNowBtn');
    const addToCartBtn = getElement('addToCartBtn');
    
    if (buyNowBtn) buyNowBtn.disabled = true;
    if (addToCartBtn) addToCartBtn.disabled = true;

    // Mobile sidebar toggle functionality
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

    // Initialize shoe details page
    initializeShoeDetails().catch(error => {
        console.error('Error initializing shoe details page:', error);
        const productContainer = document.querySelector('.product-details-container');
        if (productContainer) {
            productContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Product</h3>
                    <p>Please try refreshing the page.</p>
                </div>
            `;
        }
    });
});