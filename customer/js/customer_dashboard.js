import {
    createImageToFirebase,
    updateProfileMethod,
    readData,
    updateData,
    checkUserAuth,
    viewProfile,
    app,
    auth,
    db,
    storage,
    logoutUser
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Define fixedDescription function here
function fixedDescription(description) {
    if (!description) return 'No description available';
    return description.length > 100 ? description.substring(0, 100) + '...' : description;
}

// Global variables for modal functionality
let selectedVariantKey = null;
let selectedSizeKey = null;
let currentShoeData = null;

// this is the HTML container where shoes will be displayed
const shoeContainer = getElement('shoesContainer');
const productDetailsModal = getElement('productDetailsModal');

const authStatus = await checkUserAuth();
if (authStatus.authenticated) {
    console.log(`User is ${authStatus.role}`, authStatus.userData);
    getElement('userName_display1').textContent = authStatus.userData.firstName;
    getElement('userName_display2').textContent = authStatus.userData.firstName + " " + authStatus.userData.lastName;
    getElement('imageProfile').src = authStatus.userData.profilePhoto || "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    document.body.style.display = '';
    const prod = await readData(`smartfit_AR_Database/shoe`);
    await loadAllShoes(prod);
} else {
    window.location.href = "/login.html";
}

getElement('logout_btn').addEventListener('click', async () => {
    await logoutUser();
    window.location.href = "/login.html";
});

async function loadAllShoes(product) {
    // this is the HTML container where shoes will be displayed
    let html = '';

    // Loop through all shops
    const allShops = product.data;
    // console.log(allShops);
    // console.log(Object.entries(allShops));

    // Check if there are any shops/products
    if (!allShops || Object.keys(allShops).length === 0) {
        shoeContainer.innerHTML = '<p class="no-shoes">No shoes available at the moment.</p>';
        return;
    }

    // Object.entries(allShops) returns an array of [key, value] pairs from JSON
    Object.entries(allShops).forEach(([shopID, products]) => {
        console.log("Shop ID:", shopID);

        // Check if products exist for this shop
        if (!products || Object.keys(products).length === 0) {
            return; // Skip this shop if no products
        }

        Object.entries(products).forEach(([productID, shoe]) => {
            // Get first variant for display
            const firstVariantKey = Object.keys(shoe.variants || {})[0];
            const firstVariant = firstVariantKey ? shoe.variants[firstVariantKey] : {};
            
            // Get lowest price
            let lowestPrice = Infinity;
            if (shoe.variants) {
                Object.values(shoe.variants).forEach(variant => {
                    if (variant.price && variant.price < lowestPrice) {
                        lowestPrice = variant.price;
                    }
                });
            }
            // If no price found, set to 0
            if (lowestPrice === Infinity) lowestPrice = 0;

            html += `
            <div class="shoe-card">
                <div class="shoe-image">
                    <img src="${shoe.defaultImage || firstVariant.imageUrl || 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png'}" alt="${shoe.shoeName || 'Shoe'}">
                </div>
                <div class="shoe-details">
                    <h3>${shoe.shoeName || 'Unnamed Shoe'}</h3>
                    <p class="shoe-code">Code: ${shoe.shoeCode || 'N/A'}</p>
                    <h4>Shop Name: ${shoe.shopName || 'Unknown Shop'}</h4>
                    <div class="product-meta">
                        <span class="product-brand">${shoe.shoeBrand || 'No Brand'}</span>
                        <span class="product-type">${shoe.shoeType || 'No Type'}</span>
                        ${shoe.shoeGender ? `<span class="product-gender">${shoe.shoeGender}</span>` : ''}
                    </div>
                    <p class="shoe-description">${fixedDescription(shoe.generalDescription)}</p>
                    <p class="shoe-price">From ₱${lowestPrice.toFixed(2)}</p>
                    <div class="shoe-variants">
                        <p>Available in ${Object.keys(shoe.variants || {}).length} color${Object.keys(shoe.variants || {}).length !== 1 ? 's' : ''}</p>
                    </div>
                    <button class="btn-view" onclick="viewShoeDetails('${shoe.shopId || shopID}', '${productID}')">
                        View Details
                    </button>
                </div>
            </div>`;
        });
    });

    shoeContainer.innerHTML = html || '<p class="no-shoes">No shoes available at the moment.</p>';
}

// Product Details Modal Functions
window.viewShoeDetails = async function(shopId, shoeId) {
    console.log('View shoe details:', shopId, shoeId);
    
    try {
        const shoeDetails = await readData(`smartfit_AR_Database/shoe/${shopId}/${shoeId}`);
        console.log(shoeDetails.data);
        
        if (!shoeDetails.success || !shoeDetails.data) {
            alert('Shoe not found');
            return;
        }

        currentShoeData = shoeDetails.data;
        currentShoeData.shopId = shopId;
        currentShoeData.shoeId = shoeId;

        // Select first variant by default
        selectedVariantKey = Object.keys(currentShoeData.variants || {})[0];
        selectedSizeKey = null;

        updateProductModalContent();
        document.getElementById('productDetailsModal').classList.add('show');
        document.body.classList.add('modal-open');

    } catch (error) {
        console.error("Error fetching shoe details:", error);
        alert('Error loading shoe details');
    }
};

function updateProductModalContent() {
    if (!currentShoeData || !selectedVariantKey) return;

    const shoe = currentShoeData;
    const variant = shoe.variants[selectedVariantKey];

    if (!variant) return;

    // Generate variants HTML
    let variantsHtml = '';
    if (shoe.variants) {
        variantsHtml = Object.entries(shoe.variants).map(([key, variant]) => {
            const sizesHtml = variant.sizes ? Object.entries(variant.sizes).map(([sizeKey, sizeObj]) => {
                const sizeValue = Object.keys(sizeObj)[0];
                const stock = sizeObj[sizeValue]?.stock || 0;
                return `
                    <div class="size-option 
                        ${stock <= 0 ? 'out-of-stock' : ''}
                        ${key === selectedVariantKey && selectedSizeKey === sizeKey ? 'selected' : ''}"
                        onclick="event.stopPropagation(); selectSize('${key}', '${sizeKey}')">
                        ${sizeValue}
                        ${stock > 0 ? `(${stock})` : '(out)'}
                    </div>
                `;
            }).join('') : '<div>No sizes available</div>';

            return `
                <div class="variant-option ${key === selectedVariantKey ? 'selected' : ''}" 
                     onclick="selectVariant('${key}')">
                    <div class="variant-header">
                        <span class="variant-name">${variant.variantName || 'Unnamed Variant'}</span>
                        <span class="variant-price">₱${variant.price || '0.00'}</span>
                    </div>
                    <div>
                        ${variant.imageUrl ? `<img src="${variant.imageUrl}" class="variant-image">` : ''}
                        <span>Color: ${variant.color || 'N/A'}</span>
                    </div>
                    <div class="variant-sizes">
                        ${sizesHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Get available stock for selected size
    let availableStock = 0;
    if (selectedSizeKey && variant.sizes && variant.sizes[selectedSizeKey]) {
        const sizeObj = variant.sizes[selectedSizeKey];
        const sizeValue = Object.keys(sizeObj)[0];
        availableStock = sizeObj[sizeValue]?.stock || 0;
    }

    // Set modal content
    document.getElementById('productModalTitle').textContent = shoe.shoeName || 'Product Details';
    document.getElementById('productModalBody').innerHTML = `
        <div class="product-details-container">
            <div class="product-main-image">
                <img src="${variant.imageUrl || shoe.defaultImage || 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png'}" alt="${shoe.shoeName || 'Shoe'}">
            </div>
            <div class="product-info">
                <h3 id="productModalName">${shoe.shoeName || 'Unnamed Shoe'}</h3>
                <div class="product-price" id="productModalPrice">₱${variant.price || '0.00'}</div>
                <div class="product-code">Product Code: ${shoe.shoeCode || 'N/A'}</div>
                <h4>Shop Name: ${shoe.shopName || 'Unknown Shop'}</h4>
                
                <div class="product-meta">
                    <span class="product-brand">${shoe.shoeBrand || 'No Brand'}</span>
                    <span class="product-type">${shoe.shoeType || 'No Type'}</span>
                    ${shoe.shoeGender ? `<span class="product-gender">${shoe.shoeGender}</span>` : ''}
                </div>
                
                <!-- Quantity selector -->
                <div class="quantity-selector" ${!selectedSizeKey ? 'style="display:none;"' : ''}>
                    <label for="quantity">Quantity:</label>
                    <div class="quantity-controls">
                        <button type="button" class="quantity-btn minus" onclick="adjustQuantity(-1)">-</button>
                        <input type="number" id="quantity" name="quantity" min="1" max="${availableStock}" value="1" onchange="validateQuantity()">
                        <button type="button" class="quantity-btn plus" onclick="adjustQuantity(1)">+</button>
                    </div>
                    <div class="available-stock">Available: ${availableStock}</div>
                </div>
                
                <div class="product-description" id="productModalDescription">
                    <h4>Description</h4>
                    <p>${shoe.generalDescription || 'No description available'}</p>
                </div>
            </div>
        </div>
        <div class="product-variants">
            <h3>Available Variants</h3>
            ${variantsHtml || '<p>No variants available</p>'}
        </div>
    `;

    updateButtonStates();
}

function updateButtonStates() {
    const addToCartBtn = document.getElementById('addToCartBtn');
    const buyNowBtn = document.getElementById('buyNowBtn');

    if (selectedSizeKey === null) {
        addToCartBtn.disabled = true;
        buyNowBtn.disabled = true;
        addToCartBtn.classList.add('btn-disabled');
        buyNowBtn.classList.add('btn-disabled');
    } else {
        addToCartBtn.disabled = false;
        buyNowBtn.disabled = false;
        addToCartBtn.classList.remove('btn-disabled');
        buyNowBtn.classList.remove('btn-disabled');
    }
}

window.selectVariant = function (variantKey) {
    selectedVariantKey = variantKey;
    selectedSizeKey = null;
    updateProductModalContent();
};

window.selectSize = function (variantKey, sizeKey) {
    selectedVariantKey = variantKey;

    // Check stock
    if (currentShoeData.variants[variantKey] && currentShoeData.variants[variantKey].sizes) {
        const sizeObj = currentShoeData.variants[variantKey].sizes[sizeKey];
        if (sizeObj) {
            const sizeValue = Object.keys(sizeObj)[0];
            const stock = sizeObj[sizeValue]?.stock || 0;

            if (stock > 0) {
                selectedSizeKey = sizeKey;
                updateProductModalContent();

                // Show quantity selector and set max value
                const quantitySelector = document.querySelector('.quantity-selector');
                if (quantitySelector) {
                    quantitySelector.style.display = 'block';
                    const quantityInput = document.getElementById('quantity');
                    if (quantityInput) {
                        quantityInput.max = stock;
                        quantityInput.value = Math.min(parseInt(quantityInput.value) || 1, stock);
                    }
                }
            }
        }
    }
};

window.closeProductModal = function () {
    document.getElementById('productDetailsModal').classList.remove('show');
    document.body.classList.remove('modal-open');
};

// Quantity control functions
window.adjustQuantity = function (change) {
    const quantityInput = document.getElementById('quantity');
    if (!quantityInput) return;
    
    let newValue = parseInt(quantityInput.value) + change;
    const max = parseInt(quantityInput.max);

    if (newValue < 1) newValue = 1;
    if (newValue > max) newValue = max;

    quantityInput.value = newValue;
};

window.validateQuantity = function () {
    const quantityInput = document.getElementById('quantity');
    if (!quantityInput) return;
    
    let value = parseInt(quantityInput.value);
    const max = parseInt(quantityInput.max);

    if (isNaN(value) || value < 1) {
        value = 1;
    } else if (value > max) {
        value = max;
    }

    quantityInput.value = value;
};

// Add to Cart functionality
window.addToCart = async function (cartItem) {
    const user = auth.currentUser;
    if (!user) {
        alert('Please login to add items to cart');
        return false;
    }

    try {
        // Generate a unique cart item ID
        const cartItemId = generate18CharID();

        // Create the cart item structure
        const cartItemData = {
            shopId: cartItem.shopId,
            shoeId: cartItem.shoeId,
            variantKey: cartItem.variantKey,
            sizeKey: cartItem.sizeKey,
            shoeName: cartItem.shoeName,
            variantName: cartItem.variantName,
            color: cartItem.color,
            size: cartItem.size,
            price: cartItem.price,
            image: cartItem.image,
            quantity: cartItem.quantity || 1,
            addedAt: new Date().toISOString()
        };

        // Save to Firebase
        const cartRef = ref(db, `smartfit_AR_Database/carts/${user.uid}/${cartItemId}`);
        await updateData(cartRef, cartItemData);

        console.log("Item added to cart successfully");
        return true;

    } catch (error) {
        console.error("Error adding to cart:", error);
        alert("Failed to add item to cart");
        return false;
    }
};

// Event listeners for modal buttons
document.getElementById('addToCartBtn').addEventListener('click', async function () {
    if (!currentShoeData || !selectedVariantKey) {
        alert('Please select a variant first');
        return;
    }

    if (!selectedSizeKey) {
        alert('Please select a size first');
        return;
    }

    const variant = currentShoeData.variants[selectedVariantKey];
    if (!variant || !variant.sizes || !variant.sizes[selectedSizeKey]) {
        alert('Invalid selection');
        return;
    }

    const sizeObj = variant.sizes[selectedSizeKey];
    const sizeValue = Object.keys(sizeObj)[0];
    const stock = sizeObj[sizeValue]?.stock || 0;
    const quantity = parseInt(document.getElementById('quantity').value) || 1;

    if (stock > 0 && quantity > 0 && quantity <= stock) {
        const cartItem = {
            shopId: currentShoeData.shopId,
            shoeId: currentShoeData.shoeId,
            variantKey: selectedVariantKey,
            sizeKey: selectedSizeKey,
            shoeName: currentShoeData.shoeName,
            variantName: variant.variantName,
            color: variant.color,
            size: sizeValue,
            price: variant.price,
            image: variant.imageUrl || currentShoeData.defaultImage,
            quantity: quantity
        };

        const success = await addToCart(cartItem);
        if (success) {
            alert('Item added to cart successfully!');
            closeProductModal();
        }
    } else {
        alert('Selected quantity exceeds available stock');
    }
});

document.getElementById('buyNowBtn').addEventListener('click', function () {
    if (!currentShoeData || !selectedVariantKey) {
        alert('Please select a variant first');
        return;
    }

    if (!selectedSizeKey) {
        alert('Please select a size first');
        return;
    }

    const variant = currentShoeData.variants[selectedVariantKey];
    if (!variant || !variant.sizes || !variant.sizes[selectedSizeKey]) {
        alert('Invalid selection');
        return;
    }

    const sizeObj = variant.sizes[selectedSizeKey];
    const sizeValue = Object.keys(sizeObj)[0];
    const quantity = parseInt(document.getElementById('quantity').value) || 1;

    // Create URL parameters
    const params = new URLSearchParams();
    params.append('method', 'buyNow');
    params.append('shopId', currentShoeData.shopId);
    params.append('shoeId', currentShoeData.shoeId);
    params.append('variantKey', selectedVariantKey);
    params.append('sizeKey', selectedSizeKey);
    params.append('shopName', currentShoeData.shopName);
    params.append('size', sizeValue);
    params.append('quantity', quantity);
    params.append('price', variant.price);
    params.append('shoeName', currentShoeData.shoeName);
    params.append('variantName', variant.variantName);
    params.append('color', variant.color);
    params.append('image', variant.imageUrl || currentShoeData.defaultImage);

    // Redirect to checkout with parameters
    window.location.href = `/customer/html/checkout.html?${params.toString()}`;
});

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('productDetailsModal');
    if (event.target == modal) {
        closeProductModal();
    }
}

// Close modal with Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeProductModal();
    }
});

// Utility function to generate IDs
function generate18CharID() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 18; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}