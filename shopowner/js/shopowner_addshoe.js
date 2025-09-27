import { 
    checkUserAuth, 
    logoutUser, 
    createData,
    createImageToFirebase,
    generate6DigitCode,
    generate18CharID,
    validateFileType
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Global variables
let shopLoggedin;
let roleLoggedin;
let sname;
let variantCount = 0;

// Initialize authentication
async function initializeAddShoe() {
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
    getElement('userFullname').textContent = user.userData.ownerName || user.userData.name || 'Shop Owner';
    
    // Set shop ID and role based on user type
    shopLoggedin = user.shopId || user.userId;
    roleLoggedin = user.role === 'employee' ? (user.userData.role || 'employee') : 'shopowner';
    sname = user.userData.shopName || user.userData.ownerName || 'Shop';

    // Set profile picture
    const profilePicture = getElement('profilePicture');
    if (user.userData.profilePhoto && user.userData.profilePhoto.url) {
        profilePicture.src = user.userData.profilePhoto.url;
    } else if (user.userData.uploads && user.userData.uploads.shopLogo && user.userData.uploads.shopLogo.url) {
        profilePicture.src = user.userData.uploads.shopLogo.url;
    } else {
        profilePicture.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }

    // Role-based access control
    // Hide/show menu items based on role
    if (user.role.toLowerCase() === "customer") {
        window.location.href = "../../customer/html/customer_dashboard.html";
    }
    if (user.role === 'employee') {
        if (user.userData.role.toLowerCase() === "manager") {
            getElement("addemployeebtn").style.display = "none";
        } else if (user.userData.role.toLowerCase() === "salesperson") {
            getElement("addemployeebtn").style.display = "none";
            getElement("analyticsbtn").style.display = "none";
            getElement("issuereport").style.display = "none";
        }
    }

    // Generate and set random 6-digit code for shoe
    const random6DigitCode = generate6DigitCode();
    getElement('shoeCode').value = random6DigitCode;

    // Add first color variant by default
    addColorVariant();

    // Setup file input validation
    setupFileInputValidation();
}

function setupFileInputValidation() {
    // Main shoe image validation
    getElement('shoeImage').addEventListener('change', function (e) {
        validateFileInput(this);
    });

    // Variant image validation will be added when variants are created
}

function validateFileInput(input) {
    const file = input.files[0];
    if (!file) return true;

    if (!validateFileType(file)) {
        alert('Only JPG, JPEG, PNG, and HEIC files are allowed.');
        input.value = ''; // Clear the file input
        return false;
    }

    return true;
}

// Variant management functions
function addColorVariant() {
    variantCount++;
    const container = getElement('colorVariants');

    const variant = document.createElement('div');
    variant.className = 'variant-group';
    variant.dataset.variantId = variantCount;
    variant.innerHTML = `
        <div class="form-group">
            <label for="variantName_${variantCount}">Variant Name</label>
            <input type="text" id="variantName_${variantCount}" required placeholder="e.g., Red Blazing, Stealth Black">
        </div>
        
        <div class="form-group">
            <label for="color_${variantCount}">Color</label>
            <input type="text" id="color_${variantCount}" required placeholder="e.g., Red, Black">
        </div>
        
        <div class="form-group">
            <label for="variantPrice_${variantCount}">Price (₱)</label>
            <input type="number" id="variantPrice_${variantCount}" step="0.01" required>
        </div>
        
        <div class="form-group">
            <label for="variantImage_${variantCount}">Variant Image</label>
            <input type="file" id="variantImage_${variantCount}" accept="image/jpeg, image/jpg, image/png, image/heic">
        </div>
        
        <div class="form-group">
            <label>Sizes & Stock</label>
            <div class="size-stock-container" id="sizeStockContainer_${variantCount}">
                <!-- Size inputs will be added here -->
            </div>
            <button type="button" class="btn-secondary btn-add-size" onclick="addSizeInput(${variantCount})">
                <i class="fas fa-plus"></i> Add Size
            </button>
        </div>
        
        <button type="button" class="btn-remove" onclick="removeVariant(this)">
            <i class="fas fa-trash"></i> Remove Variant
        </button>
    `;

    container.appendChild(variant);

    // Add validation for the new file input
    document.getElementById(`variantImage_${variantCount}`).addEventListener('change', function (e) {
        validateFileInput(this);
    });

    addSizeInput(variantCount);
}

function addSizeInput(variantId) {
    const container = document.getElementById(`sizeStockContainer_${variantId}`);

    const sizeItem = document.createElement('div');
    sizeItem.className = 'size-stock-item';
    sizeItem.innerHTML = `
        <span>Size:</span>
        <input type="number" class="size-input" step="0.5" min="1" placeholder="Size" required>
        <span>Stock:</span>
        <input type="number" class="stock-input" min="0" placeholder="Qty" required>
        <button type="button" class="btn-remove-small" onclick="removeSizeInput(this)">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(sizeItem);
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

// Form submission handler
async function handleAddShoe(event) {
    event.preventDefault();

    if (!shopLoggedin) {
        alert("Please wait for authentication to complete");
        return;
    }

    // Validate main image file type
    const shoeImageFile = getElement('shoeImage').files[0];
    if (shoeImageFile && !validateFileInput(getElement('shoeImage'))) {
        return;
    }

    // Validate all variant image file types
    const variantGroups = document.querySelectorAll('.variant-group');
    for (const group of variantGroups) {
        const variantId = group.dataset.variantId;
        const variantImageInput = document.getElementById(`variantImage_${variantId}`);
        if (variantImageInput.files[0] && !validateFileInput(variantImageInput)) {
            return;
        }
    }

    // Show loading modal
    getElement('loadingModal').style.display = 'block';

    try {
        // Get main shoe data
        const shoeCode = getElement('shoeCode').value;
        const shoeName = getElement('shoeName').value;
        const shoeType = getElement('shoeType').value;
        const shoeBrand = getElement('shoeBrand').value;
        const shoeGender = getElement('shoeGender').value;
        const shoeDescription = getElement('shoeDescription').value;
        const random18CharID = generate18CharID();
        const shoeId = `${random18CharID}_${shoeCode}`;

        // Get all variant data
        const variants = {};
        const variantImageUploads = [];

        variantGroups.forEach((group, index) => {
            const variantId = group.dataset.variantId;
            const variantName = document.getElementById(`variantName_${variantId}`).value;
            const color = document.getElementById(`color_${variantId}`).value;
            const price = document.getElementById(`variantPrice_${variantId}`).value;
            const variantImageFile = document.getElementById(`variantImage_${variantId}`).files[0];

            const sizeContainer = document.getElementById(`sizeStockContainer_${variantId}`);
            const sizeItems = sizeContainer.querySelectorAll('.size-stock-item');
            const sizes = {};

            sizeItems.forEach((item, sizeIndex) => {
                const sizeValue = item.querySelector('.size-input').value;
                const stock = item.querySelector('.stock-input').value;

                sizes[`size_${sizeIndex}`] = {
                    [sizeValue]: {
                        stock: parseInt(stock) || 0
                    }
                };
            });

            variants[`variant_${index}`] = {
                variantName,
                color,
                price: parseFloat(price),
                sizes,
                variantImageFile
            };

            // Store image upload promise if file exists
            if (variantImageFile) {
                const imagePath = `shoes/${shopLoggedin}/${shoeId}/variant_${index}`;
                variantImageUploads.push({
                    variantKey: `variant_${index}`,
                    uploadPromise: createImageToFirebase(variantImageFile, imagePath)
                });
            }
        });

        // Upload main shoe image if exists
        let shoeImageUrl = '';
        if (shoeImageFile) {
            const mainImagePath = `shoes/${shopLoggedin}/${shoeId}/main_image`;
            const uploadResult = await createImageToFirebase(shoeImageFile, mainImagePath);
            if (uploadResult.success) {
                shoeImageUrl = uploadResult.url;
            } else {
                throw new Error(`Main image upload failed: ${uploadResult.error}`);
            }
        }

        // Upload variant images
        const variantUploadResults = await Promise.all(
            variantImageUploads.map(async (item) => {
                const result = await item.uploadPromise;
                return {
                    variantKey: item.variantKey,
                    url: result.success ? result.url : ''
                };
            })
        );

        // Process variants with uploaded image URLs
        const processedVariants = {};
        Object.entries(variants).forEach(([key, variant]) => {
            const uploadResult = variantUploadResults.find(item => item.variantKey === key);
            processedVariants[key] = {
                variantName: variant.variantName,
                color: variant.color,
                price: variant.price,
                imageUrl: uploadResult ? uploadResult.url : '',
                sizes: variant.sizes
            };
        });

        // Prepare shoe data for database
        const shoeData = {
            shoeName: shoeName,
            shoeCode: shoeCode,
            shoeType: shoeType,
            shoeBrand: shoeBrand,
            shoeGender: shoeGender,
            generalDescription: shoeDescription,
            defaultImage: shoeImageUrl,
            variants: processedVariants,
            shopLoggedin: shopLoggedin,
            shopName: sname,
            roleWhoAdded: roleLoggedin,
            dateAdded: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };

        // Save to Firebase Database
        const dataPath = `smartfit_AR_Database/shoe/${shopLoggedin}/${shoeId}`;
        const createResult = await createData(dataPath, shopLoggedin, shoeData);

        if (!createResult.success) {
            throw new Error(`Database save failed: ${createResult.error}`);
        }

        // Success - reset form and redirect
        getElement('addShoeForm').reset();
        getElement('colorVariants').innerHTML = '';
        addColorVariant();
        
        alert("Shoe added successfully!");
        window.location.href = "/shopowner/html/shop_inventory.html";

    } catch (error) {
        console.error("Error adding shoe: ", error);
        alert("Error adding shoe: " + error.message);
    } finally {
        // Hide loading modal
        getElement('loadingModal').style.display = 'none';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Mobile sidebar toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });
    
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });

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

    // Form submission
    getElement('addShoeForm').addEventListener('submit', handleAddShoe);

    // Initialize the page
    initializeAddShoe();
});

// Expose functions to global scope for onclick handlers
window.addSizeInput = addSizeInput;
window.removeSizeInput = removeSizeInput;
window.removeVariant = removeVariant;
window.addColorVariant = addColorVariant;