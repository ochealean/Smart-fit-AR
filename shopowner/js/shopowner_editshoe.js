// shopowner_editshoe.js - Refactored to use firebaseMethods only
import {
    checkUserAuth,
    logoutUser,
    readData,
    updateData,
    createImageToFirebase,
    deleteImageFromFirebase,
    updateImageInFirebase
} from "../../firebaseMethods.js";

// Get shoeId from URL
const urlParams = new URLSearchParams(window.location.search);
const shoeId = urlParams.get('edit');

// DOM elements
const shoeNameInput = document.getElementById('shoeName');
const shoeCodeInput = document.getElementById('shoeCode');
const shoeTypeInput = document.getElementById('shoeType');
const shoeBrandInput = document.getElementById('shoeBrand');
const shoeGenderInput = document.getElementById('shoeGender');
const shoeDescriptionInput = document.getElementById('shoeDescription');
const currentImageDiv = document.getElementById('currentShoeImage');
const variantsContainer = document.getElementById('colorVariants');

// Global variables
let userSession = {
    shopId: null,
    role: null,
    shopName: '',
    userId: null
};
let variantCount = 0;

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Authentication and initialization
async function initializeEditShoe() {
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

    // Set user information
    userSession.role = user.role;
    userSession.shopId = user.shopId || user.userId;
    userSession.userId = user.userId;
    userSession.shopName = user.userData.shopName || user.userData.ownerName || 'Shop Owner';

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

    // Load shoe data to edit
    await loadShoeData();
}

// Load shoe data
async function loadShoeData() {
    if (!shoeId) {
        alert("No shoe ID provided.");
        return;
    }

    const shoePath = `smartfit_AR_Database/shoe/${userSession.shopId}/${shoeId}`;
    
    try {
        const result = await readData(shoePath);
        console.log("Shoe data fetch result:", result);
        if (!result.success) {
            alert("Shoe not found.");
            return;
        }

        const shoeData = result.data;
        populateForm(shoeData);

    } catch (error) {
        console.error("Error getting shoe data:", error);
        alert("Failed to load shoe data.");
    }
}

// Populate form with shoe data
function populateForm(shoeData) {
    // Populate basic fields
    shoeNameInput.value = shoeData.shoeName ?? '';
    shoeCodeInput.value = shoeData.shoeCode ?? '';
    shoeGenderInput.value = shoeData.shoeGender ?? '';
    shoeDescriptionInput.value = shoeData.generalDescription ?? '';
    
    console.log("Populating form with shoe data:", shoeData.shoeType);
    // Populate dropdowns
    if (shoeData.shoeType) {
        shoeTypeInput.value = shoeData.shoeType;
    }
    
    if (shoeData.shoeBrand) {
        shoeBrandInput.value = shoeData.shoeBrand;
    }

    // Display current main image
    if (shoeData.defaultImage) {
        currentImageDiv.innerHTML = `<img src="${shoeData.defaultImage}" style="max-width:200px">`;
    }

    // Populate variants
    if (shoeData.variants) {
        for (const variant of Object.values(shoeData.variants)) {
            addColorVariantWithData(variant);
        }
    }
}

// Replace the button click event with form submit event
document.getElementById('editShoeForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission
    
    const user = await checkUserAuth();
    if (!user.authenticated) {
        alert("Not logged in.");
        return;
    }

    const shoePath = `smartfit_AR_Database/shoe/${userSession.shopId}/${shoeId}`;

    // Get current data first
    const currentResult = await readData(shoePath);
    if (!currentResult.success) {
        alert("Shoe data not found!");
        return;
    }

    const currentShoeData = currentResult.data;

    // Main image handling
    const defaultImageFile = document.getElementById('shoeImage').files[0];
    let defaultImageUrl = currentShoeData.defaultImage;

    if (defaultImageFile) {
        try {
            console.log("Starting main image update process...");

            // 1. Delete old image if exists
            if (defaultImageUrl) {
                try {
                    console.log("Attempting to delete old main image...");
                    const oldImagePath = getPathFromUrl(defaultImageUrl);
                    if (oldImagePath) {
                        const deleteResult = await deleteImageFromFirebase(oldImagePath);
                        if (deleteResult.success) {
                            console.log("Old main image deleted successfully");
                        } else {
                            console.log("Could not delete old image:", deleteResult.error);
                        }
                    } else {
                        console.log("Could not extract path from old image URL");
                    }
                } catch (deleteError) {
                    console.log("Old main image not found or already deleted:", deleteError.message);
                }
            }

            // 2. Upload new image with consistent naming
            console.log("Uploading new main image...");
            const filePath = `shoes/${userSession.shopId}/${shoeId}/main_image`;
            const uploadResult = await createImageToFirebase(defaultImageFile, filePath);
            
            if (uploadResult.success) {
                defaultImageUrl = uploadResult.url;
                console.log("New image URL:", defaultImageUrl);

                // Update UI immediately
                if (currentImageDiv) {
                    currentImageDiv.innerHTML = `<img src="${defaultImageUrl}" style="max-width:200px">`;
                }
            } else {
                throw new Error(uploadResult.error);
            }
        } catch (error) {
            console.error("Main image update failed:", error);
            alert("Failed to update main image. Please try again.");
            return;
        }
    }

    // Process variants
    const variants = {};
    const variantGroups = document.querySelectorAll('.variant-group');

    for (let i = 0; i < variantGroups.length; i++) {
        const group = variantGroups[i];
        const variantId = `variant_${i}`;
        const variantName = group.querySelector(`#variantName_${i + 1}`)?.value || '';
        const color = group.querySelector(`#color_${i + 1}`)?.value || '';
        const price = parseFloat(group.querySelector(`#variantPrice_${i + 1}`)?.value) || 0;
        const imageFile = group.querySelector(`#variantImage_${i + 1}`)?.files?.[0];
        const prevImage = currentShoeData.variants?.[variantId]?.imageUrl;

        // Process sizes
        const sizes = {};
        group.querySelectorAll('.size-stock-item').forEach(item => {
            const size = item.querySelector('.size-input')?.value;
            const stockInput = item.querySelector('.stock-input');
            const resetTriggered = stockInput.dataset.reset === 'true';

            const addedStock = parseInt(stockInput?.value || '0');
            const currentStock = parseInt(item.querySelector('.current-stock')?.textContent || '0');

            if (size) {
                let newTotalStock = currentStock;
                if (resetTriggered) {
                    newTotalStock = addedStock || 0;
                } else if (addedStock) {
                    newTotalStock = currentStock + addedStock;
                }

                sizes[`size_${size}`] = {
                    [size]: {
                        LastUpdatedBy: userSession.role,
                        userId: userSession.userId,
                        actionValue: "Stock Updated",
                        LastUpdatedAt: new Date().toISOString(),
                        stock: newTotalStock
                    }
                };
            }
            stockInput.dataset.reset = 'false';
        });

        // Initialize variant data
        variants[variantId] = {
            variantName,
            color,
            price,
            sizes,
            imageUrl: prevImage // Default to existing
        };

        // Handle variant image update
        if (imageFile) {
            try {
                const variantImageName = `${variantId}`;
                const filePath = `shoes/${userSession.shopId}/${shoeId}/${variantImageName}`;
                
                if (prevImage) {
                    // Update existing image
                    const updateResult = await updateImageInFirebase(imageFile, filePath, getPathFromUrl(prevImage));
                    if (updateResult.success) {
                        variants[variantId].imageUrl = updateResult.url;
                    } else {
                        throw new Error(updateResult.error);
                    }
                } else {
                    // Upload new image
                    const uploadResult = await createImageToFirebase(imageFile, filePath);
                    if (uploadResult.success) {
                        variants[variantId].imageUrl = uploadResult.url;
                    } else {
                        throw new Error(uploadResult.error);
                    }
                }
            } catch (error) {
                console.error(`Error updating variant image:`, error);
                alert(`Failed to update image for variant ${variantName}`);
                return;
            }
        }
    }

    // Update database
    try {
        const updateResult = await updateData(shoePath, {
            shoeName: shoeNameInput.value.trim(),
            shoeCode: shoeCodeInput.value.trim(),
            shoeGender: shoeGenderInput.value,
            shoeType: shoeTypeInput.value,
            shoeBrand: shoeBrandInput.value,
            generalDescription: shoeDescriptionInput.value.trim(),
            defaultImage: defaultImageUrl,
            variants,
            lastUpdated: new Date().toISOString()
        });

        if (updateResult.success) {
            alert("Shoe updated successfully!");
            window.location.href = '/shopowner/html/shop_inventory.html';
        } else {
            throw new Error(updateResult.error);
        }
    } catch (err) {
        console.error("Error updating shoe:", err);
        alert("Failed to update shoe.");
    }
});

// Helper function to extract path from URL
function getPathFromUrl(url) {
    if (!url) return null;
    try {
        const base = "https://firebasestorage.googleapis.com/v0/b/opportunity-9d3bf.firebasestorage.app/o/";
        if (url.startsWith(base)) {
            return decodeURIComponent(url.split(base)[1].split("?")[0]);
        }
        return null;
    } catch (error) {
        console.error("Error parsing URL:", error);
        return null;
    }
}

function addColorVariantWithData(variantData = {}, index = variantCount) {
    variantCount++;
    const container = getElement('colorVariants');

    const variant = document.createElement('div');
    variant.className = 'variant-group';
    variant.dataset.variantId = variantCount;

    const variantImageHtml = variantData.imageUrl
        ? `<img src="${variantData.imageUrl}" alt="Variant Image" style="max-height: 100px; margin-bottom: 10px;">`
        : '';

    variant.innerHTML = `
        <div class="form-group">
            <label for="variantName_${variantCount}">Variant Name</label>
            <input type="text" id="variantName_${variantCount}" required placeholder="e.g., Red Blazing, Stealth Black" value="${variantData.variantName || ''}">
        </div>
        
        <div class="form-group">
            <label for="color_${variantCount}">Color</label>
            <input type="text" id="color_${variantCount}" required placeholder="e.g., Red, Black" value="${variantData.color || ''}">
        </div>
        
        <div class="form-group">
            <label for="variantPrice_${variantCount}">Price (₱)</label>
            <input type="number" id="variantPrice_${variantCount}" step="0.01" required value="${variantData.price || ''}">
        </div>
        
        <div class="form-group">
            <label for="variantImage_${variantCount}">Variant Image</label>
            ${variantImageHtml}
            <input type="file" id="variantImage_${variantCount}" accept="image/*">
        </div>
        
        <div class="form-group">
            <label>Sizes & Stock</label>
            <div class="size-stock-container" id="sizeStockContainer_${variantCount}"></div>
            <button type="button" class="btn-secondary btn-add-size" onclick="addSizeInput(${variantCount})">
                <i class="fas fa-plus"></i> Add Size
            </button>
        </div>
        
        <button type="button" class="btn-remove" onclick="removeVariant(this)">
            <i class="fas fa-trash"></i> Remove Variant
        </button>
    `;

    container.appendChild(variant);

    // Add sizes if provided
    if (variantData.sizes) {
        Object.values(variantData.sizes).forEach(sizeObj => {
            const size = Object.keys(sizeObj)[0];
            const stock = sizeObj[size].stock;
            addSizeInput(variantCount, size, stock);
        });
    } else {
        addSizeInput(variantCount); // Add one empty input by default
    }
}

function addSizeInput(variantId, size = '', stock = '') {
    const container = getElement(`sizeStockContainer_${variantId}`);

    const sizeItem = document.createElement('div');
    sizeItem.className = 'size-stock-item';
    sizeItem.innerHTML = `
        <span>Size:</span>
        <input type="number" class="size-input" step="0.5" min="1" placeholder="Size" value="${size}" required>
        <p>Stocks: <span class="current-stock">${stock}</span></p>
        <input type="number" class="stock-input" min="0" placeholder="Add Stock (Qty)">
        <button type="button" class="btn-reset-small" onclick="resetStock(this)">
            <i class="fas fa-undo"></i> Reset
        </button>
        <button type="button" class="btn-remove-small" onclick="removeSizeInput(this)">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(sizeItem);
}

function resetStock(button) {
    const stockSpan = button.parentElement.querySelector('.current-stock');
    const stockInput = button.parentElement.querySelector('.stock-input');

    stockSpan.textContent = '0'; // visually show reset
    stockInput.value = ''; // explicitly set to 0 for processing
    stockInput.dataset.reset = 'true'; // mark it as reset
}

function removeSizeInput(button) {
    button.parentElement.remove();
}

function removeVariant(button) {
    if (document.querySelectorAll('.variant-group').length > 1) {
        button.closest('.variant-group').remove();
    } else {
        alert('You must have at least one color variant');
    }
}

// Discard modal logic
function discardChanges() {
    const modal = getElement('discardModal');
    modal.style.display = 'flex';

    getElement('confirmDiscard').onclick = () => {
        location.reload(); // Reloads the page to discard changes
    };

    getElement('cancelDiscard').onclick = () => {
        modal.style.display = 'none';
    };
}

// Add new variant
function addColorVariant() {
    addColorVariantWithData();
}

// Expose to global scope
window.addSizeInput = addSizeInput;
window.removeSizeInput = removeSizeInput;
window.removeVariant = removeVariant;
window.addColorVariantWithData = addColorVariantWithData;
window.addColorVariant = addColorVariant;
window.resetStock = resetStock;
window.discardChanges = discardChanges;

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

    // Initialize the edit shoe page
    initializeEditShoe();
});