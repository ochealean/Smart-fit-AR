import {
    checkUserAuth,
    readData,
    updateData,
    createImageToFirebase,
    validateFileType
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Button control functions
function setButtonDisable() {
    const reapplyButton = getElement('reapplyButton');
    reapplyButton.disabled = true;
    reapplyButton.style.opacity = "0.7";
    reapplyButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
}

function setButtonAble() {
    const reapplyButton = getElement('reapplyButton');
    reapplyButton.disabled = false;
    reapplyButton.style.opacity = "1";
    reapplyButton.innerHTML = 'Submit Reapplication';
}

// Loader control functions
function showLoader() {
    getElement('loadingOverlay').classList.add('active');
}

function hideLoader() {
    getElement('loadingOverlay').classList.remove('active');
}

// Overlay functions
function showSuccessOverlay(message) {
    const successOverlay = getElement('successOverlay');
    const messageElement = successOverlay.querySelector('p');
    if (messageElement && message) {
        messageElement.textContent = message;
    }
    successOverlay.classList.add('active');
}

function showErrorOverlay(errors) {
    const errorContainer = getElement('errorMessages');
    errorContainer.innerHTML = '';

    errors.forEach(error => {
        const errorElement = document.createElement('p');
        errorElement.textContent = error;
        errorContainer.appendChild(errorElement);
    });

    getElement('errorOverlay').classList.add('active');
}

function closeOverlays() {
    getElement('successOverlay').classList.remove('active');
    getElement('errorOverlay').classList.remove('active');
}

// Helper function to show field errors
function showFieldError(field, message) {
    const formGroup = field.closest('.form-group');
    if (formGroup) {
        formGroup.classList.add('error');

        // Remove existing error message
        const existingError = formGroup.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        const errorElement = document.createElement('span');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        formGroup.appendChild(errorElement);
    }
}

// Helper function to clear all field errors
function clearFieldErrors() {
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(error => error.remove());

    const errorFields = document.querySelectorAll('.form-group.error');
    errorFields.forEach(field => field.classList.remove('error'));
}

// Function to validate file
function validateFile(file, fieldName) {
    if (!file) return null; // No file is acceptable (optional update)

    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        throw new Error(`${fieldName} file size exceeds 5MB limit`);
    }

    // Check file type using the provided validateFileType method
    if (!validateFileType(file) && file.type !== 'application/pdf') {
        throw new Error(`${fieldName} must be JPEG, PNG, PDF, or HEIC file`);
    }

    return true;
}

// Simple file upload function - only uploads new files, doesn't delete old ones
async function uploadFile(shopId, file, fileType) {
    if (!file) return null; // Return null if no new file

    try {
        // Validate file before upload
        validateFile(file, fileType);

        // Create new path with timestamp
        const storagePath = `uploads/${shopId}/${fileType}_${Date.now()}_${file.name}`;

        const uploadResult = await createImageToFirebase(file, storagePath);

        if (!uploadResult.success) {
            throw new Error(`Failed to upload ${fileType}: ${uploadResult.error}`);
        }

        // Return the file data structure
        return {
            name: file.name,
            url: uploadResult.url,
            path: uploadResult.path || storagePath,
            uploadedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error(`Error in uploadFile for ${fileType}:`, error);
        throw error;
    }
}

// Function to update shop data
async function updateShopData(shopId, updatedData) {
    const dataPath = `smartfit_AR_Database/shop/${shopId}`;
    const updateResult = await updateData(dataPath, updatedData);

    if (!updateResult.success) {
        throw new Error(`Failed to update shop data: ${updateResult.error}`);
    }

    return updateResult;
}

// Main reapplication handler
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check user authentication
        const user = await checkUserAuth();
        console.log('User auth result:', user);

        // Redirect if not authenticated or not shop owner
        if (!user.authenticated || user.role !== 'shopowner') {
            window.location.href = "/login.html";
            return;
        }

        // Get shop ID
        const params = new URLSearchParams(window.location.search);
        const shopIdFromURL = params.get("shopID");
        const shopId = shopIdFromURL || user.shopId || user.userId;

        if (!shopId) {
            throw new Error('Shop ID not found');
        }

        // Load existing shop data
        const dataPath = `smartfit_AR_Database/shop/${shopId}`;
        const shopDataResult = await readData(dataPath);

        if (!shopDataResult.success) {
            throw new Error('Failed to load shop data: ' + shopDataResult.error);
        }

        const dataValues = shopDataResult.data;
        console.log('Shop data:', dataValues);

        // Fill form with existing data
        getElement('shopName').value = dataValues.shopName || '';
        getElement('shopName').disabled = true;
        getElement('ownerName').value = dataValues.ownerName || '';
        getElement('shopCategory').value = dataValues.shopCategory || '';
        getElement('shopDescription').value = dataValues.shopDescription || '';
        getElement('yearsInBusiness').value = dataValues.yearsInBusiness || '';
        getElement('shopAddress').value = dataValues.shopAddress || '';
        getElement('shopCity').value = dataValues.shopCity || '';
        getElement('shopState').value = dataValues.shopState || '';
        getElement('shopZip').value = dataValues.shopZip || '';
        getElement('shopCountry').value = dataValues.shopCountry || 'Philippines';
        getElement('taxId').value = dataValues.taxId || '';
        getElement('ownerEmail').value = dataValues.email || '';
        getElement('ownerEmail').disabled = true;
        getElement('ownerPhone').value = dataValues.ownerPhone || '';

        // Set up reapply button event listener
        const reapplyButton = getElement('reapplyButton');

        reapplyButton.addEventListener('click', async (event) => {
            event.preventDefault();
            setButtonDisable();
            showLoader();
            clearFieldErrors();

            // Disable all form inputs during submission
            const form = getElement('shopReapplicationForm');
            const inputs = form.querySelectorAll('input, button, textarea, select');
            inputs.forEach(input => input.disabled = true);

            try {
                // Validate all required fields
                const errors = [];
                const requiredFields = [
                    'shopName', 'shopCategory', 'shopDescription', 'ownerName',
                    'ownerPhone', 'shopAddress', 'shopCity', 'shopState',
                    'shopZip', 'shopCountry', 'taxId'
                ];

                requiredFields.forEach(fieldId => {
                    const field = getElement(fieldId);
                    if (!field.value.trim()) {
                        const fieldName = fieldId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        errors.push(`${fieldName} is required`);
                        showFieldError(field, `${fieldName} is required`);
                    }
                });

                // Validate phone number format
                const phoneField = getElement('ownerPhone');
                if (phoneField.value && (phoneField.value.length !== 10 || !/^\d+$/.test(phoneField.value))) {
                    errors.push('Invalid phone number format');
                    showFieldError(phoneField, 'Please enter a valid 10-digit mobile number');
                }

                // Get files
                const permitFile = getElement("permitDocument").files[0] || null;
                const licenseFile = getElement("businessLicense").files[0] || null;
                const frontSideFile = getElement("ownerIdFront").files[0] || null;
                const backSideFile = getElement("ownerIdBack").files[0] || null;

                // Validate files that are actually uploaded
                if (permitFile) {
                    try { validateFile(permitFile, 'Business Permit'); } 
                    catch (fileError) { errors.push(fileError.message); }
                }
                if (licenseFile) {
                    try { validateFile(licenseFile, 'Business License'); } 
                    catch (fileError) { errors.push(fileError.message); }
                }
                if (frontSideFile) {
                    try { validateFile(frontSideFile, 'ID Front Side'); } 
                    catch (fileError) { errors.push(fileError.message); }
                }
                if (backSideFile) {
                    try { validateFile(backSideFile, 'ID Back Side'); } 
                    catch (fileError) { errors.push(fileError.message); }
                }

                if (errors.length > 0) {
                    hideLoader();
                    setButtonAble();
                    inputs.forEach(input => input.disabled = false);
                    showErrorOverlay(errors);
                    return;
                }

                // Start with existing data
                const updatedData = {
                    ...dataValues, // Keep all existing data including files
                    status: 'pending',
                    lastUpdated: new Date().toISOString(),
                    shopName: getElement('shopName').value,
                    shopCategory: getElement('shopCategory').value,
                    shopDescription: getElement('shopDescription').value,
                    yearsInBusiness: parseInt(getElement('yearsInBusiness').value) || 0,
                    ownerName: getElement('ownerName').value,
                    ownerPhone: getElement('ownerPhone').value,
                    shopAddress: getElement('shopAddress').value,
                    shopCity: getElement('shopCity').value,
                    shopState: getElement('shopState').value,
                    shopZip: getElement('shopZip').value,
                    shopCountry: getElement('shopCountry').value,
                    taxId: getElement('taxId').value,
                    rejectionReason: null // Clear rejection reason on reapplication
                };

                // Upload ONLY the files that user actually selected
                // If no file is selected for a field, the existing data remains unchanged
                if (permitFile) {
                    console.log('Uploading new permit document...');
                    const permitResult = await uploadFile(shopId, permitFile, 'permit');
                    updatedData.uploads.permitDocument = permitResult;
                }

                if (licenseFile) {
                    console.log('Uploading new business license...');
                    const licenseResult = await uploadFile(shopId, licenseFile, 'license');
                    updatedData.uploads.businessLicense = licenseResult;
                }

                if (frontSideFile) {
                    console.log('Uploading new front ID...');
                    const frontIdResult = await uploadFile(shopId, frontSideFile, 'frontSide');
                    updatedData.uploads.ownerIdFront = frontIdResult;
                }

                if (backSideFile) {
                    console.log('Uploading new back ID...');
                    const backIdResult = await uploadFile(shopId, backSideFile, 'backSide');
                    updatedData.uploads.ownerIdBack = backIdResult;
                }

                // Clean up any duplicate fields to maintain clean structure
                delete updatedData.frontIdDocument;
                delete updatedData.backIdDocument;
                delete updatedData.licenseDocument;

                console.log('Final updated data to save:', updatedData);

                // Update shop data in database
                await updateShopData(shopId, updatedData);

                // Show success message
                hideLoader();
                showSuccessOverlay("Reapplication submitted successfully! Your application will be reviewed within 3-5 business days.");

            } catch (error) {
                console.error("Reapplication error:", error);
                hideLoader();
                setButtonAble();
                inputs.forEach(input => input.disabled = false);
                showErrorOverlay([error.message]);
            }
        });

        // Set up overlay close buttons
        getElement('closeOverlay')?.addEventListener('click', () => {
            closeOverlays();
            window.location.href = "/shopowner/html/shop_pending.html";
        });

        getElement('closeErrorOverlay')?.addEventListener('click', closeOverlays);

    } catch (error) {
        console.error('Error initializing reapplication page:', error);
        showErrorOverlay([error.message]);
    }
});