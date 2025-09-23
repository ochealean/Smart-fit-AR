import {
    createImageToFirebase,
    updateProfileMethod,
    readProduct,
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

const shoeContainer = getElement('shoesContainer');

const authStatus = await checkUserAuth();
if (authStatus.authenticated) {
    console.log(`User is ${authStatus.role}`, authStatus.userData);
    getElement('userName_display1').textContent = authStatus.userData.firstName;
    getElement('userName_display2').textContent = authStatus.userData.firstName + " " + authStatus.userData.lastName;
    getElement('imageProfile').src = authStatus.userData.profilePhoto || "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    document.body.style.display = '';
    const prod = await readProduct(`AR_shoe_users/shoe`);
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
    console.log(allShops);
    console.log(Object.entries(allShops));

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

// Add a placeholder function for viewShoeDetails to prevent errors
window.viewShoeDetails = function(shopId, shoeId) {
    console.log('View shoe details:', shopId, shoeId);
    alert('View details functionality would be implemented here. Shop: ' + shopId + ', Shoe: ' + shoeId);
};