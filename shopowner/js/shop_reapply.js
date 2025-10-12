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
    reapplyButton.style.background = "linear-gradient(135deg, #43579d, #694c8d)";
    reapplyButton.style.color = "#838383";
    reapplyButton.disabled = true;
    reapplyButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
}

function setButtonAble() {
    const reapplyButton = getElement('reapplyButton');
    reapplyButton.style.background = "linear-gradient(135deg, var(--primary), var(--secondary))";
    reapplyButton.style.color = "var(--light)";
    reapplyButton.disabled = false;
    reapplyButton.innerHTML = 'Submit Reapplication';
}

// Loader control functions
function showLoader() {
    getElement('loadingOverlay').classList.add('active');
}

function hideLoader() {
    getElement('loadingOverlay').classList.remove('active');
}

// Update loader progress
function updateLoaderProgress(stage, percentage = null) {
    const overlayContent = document.querySelector('.overlay-content h2');
    const progressText = document.querySelector('.overlay-content p');
    
    const stages = {
        validating: 'Validating Form Data...',
        uploadingFiles: 'Uploading Documents...',
        savingData: 'Saving Shop Information...',
        complete: 'Reapplication Complete!'
    };
    
    if (overlayContent) {
        overlayContent.textContent = stages[stage] || stage;
    }
    
    if (progressText && percentage !== null) {
        progressText.textContent = `Progress: ${percentage}%`;
    } else if (progressText) {
        progressText.textContent = 'Please wait while we process your reapplication';
    }
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

// Enhanced file upload function with progress tracking
async function uploadFilesWithProgress(shopId, permitFile, licenseFile, frontSideFile, backSideFile, dtiFile, birFile) {
    return new Promise(async (resolve, reject) => {
        try {
            const uploadResults = {};
            let completedUploads = 0;
            const totalUploads = [permitFile, licenseFile, frontSideFile, backSideFile, dtiFile, birFile].filter(file => file).length;

            // If no files to upload, return empty object
            if (totalUploads === 0) {
                resolve({});
                return;
            }

            const updateProgress = () => {
                completedUploads++;
                const progress = Math.round((completedUploads / totalUploads) * 100);
                updateLoaderProgress('uploadingFiles', progress);
            };

            const uploadPromises = [];

            if (permitFile) {
                const permitPath = `uploads/${shopId}/permit_${Date.now()}_${permitFile.name}`;
                uploadPromises.push(
                    createImageToFirebase(permitFile, permitPath).then(result => {
                        uploadResults.permitDocument = result;
                        updateProgress();
                        return result;
                    })
                );
            }

            if (licenseFile) {
                const licensePath = `uploads/${shopId}/license_${Date.now()}_${licenseFile.name}`;
                uploadPromises.push(
                    createImageToFirebase(licenseFile, licensePath).then(result => {
                        uploadResults.businessLicense = result;
                        updateProgress();
                        return result;
                    })
                );
            }

            if (frontSideFile) {
                const frontSidePath = `uploads/${shopId}/frontSide_${Date.now()}_${frontSideFile.name}`;
                uploadPromises.push(
                    createImageToFirebase(frontSideFile, frontSidePath).then(result => {
                        uploadResults.ownerIdFront = result;
                        updateProgress();
                        return result;
                    })
                );
            }

            if (backSideFile) {
                const backSidePath = `uploads/${shopId}/backSide_${Date.now()}_${backSideFile.name}`;
                uploadPromises.push(
                    createImageToFirebase(backSideFile, backSidePath).then(result => {
                        uploadResults.ownerIdBack = result;
                        updateProgress();
                        return result;
                    })
                );
            }

            if (dtiFile) {
                const dtiPath = `uploads/${shopId}/dti_${Date.now()}_${dtiFile.name}`;
                uploadPromises.push(
                    createImageToFirebase(dtiFile, dtiPath).then(result => {
                        uploadResults.dtiDocument = result;
                        updateProgress();
                        return result;
                    })
                );
            }

            if (birFile) {
                const birPath = `uploads/${shopId}/bir_${Date.now()}_${birFile.name}`;
                uploadPromises.push(
                    createImageToFirebase(birFile, birPath).then(result => {
                        uploadResults.birDocument = result;
                        updateProgress();
                        return result;
                    })
                );
            }

            await Promise.all(uploadPromises);

            // Check for failed uploads
            const failedUploads = Object.entries(uploadResults).filter(([key, result]) => !result.success);
            if (failedUploads.length > 0) {
                throw new Error(`File upload failed for: ${failedUploads.map(([key]) => key).join(', ')}`);
            }

            // Format the results
            const formattedResults = {};
            if (uploadResults.permitDocument) {
                formattedResults.permitDocument = { 
                    name: permitFile.name, 
                    url: uploadResults.permitDocument.url, 
                    path: uploadResults.permitDocument.path, 
                    uploadedAt: new Date().toISOString() 
                };
            }
            if (uploadResults.businessLicense) {
                formattedResults.businessLicense = { 
                    name: licenseFile.name, 
                    url: uploadResults.businessLicense.url, 
                    path: uploadResults.businessLicense.path, 
                    uploadedAt: new Date().toISOString() 
                };
            }
            if (uploadResults.ownerIdFront) {
                formattedResults.ownerIdFront = { 
                    name: frontSideFile.name, 
                    url: uploadResults.ownerIdFront.url, 
                    path: uploadResults.ownerIdFront.path, 
                    uploadedAt: new Date().toISOString() 
                };
            }
            if (uploadResults.ownerIdBack) {
                formattedResults.ownerIdBack = { 
                    name: backSideFile.name, 
                    url: uploadResults.ownerIdBack.url, 
                    path: uploadResults.ownerIdBack.path, 
                    uploadedAt: new Date().toISOString() 
                };
            }
            if (uploadResults.dtiDocument) {
                formattedResults.dtiDocument = { 
                    name: dtiFile.name, 
                    url: uploadResults.dtiDocument.url, 
                    path: uploadResults.dtiDocument.path, 
                    uploadedAt: new Date().toISOString() 
                };
            }
            if (uploadResults.birDocument) {
                formattedResults.birDocument = { 
                    name: birFile.name, 
                    url: uploadResults.birDocument.url, 
                    path: uploadResults.birDocument.path, 
                    uploadedAt: new Date().toISOString() 
                };
            }

            resolve(formattedResults);

        } catch (error) {
            console.error('File upload error:', error);
            reject(new Error('Failed to upload files: ' + error.message));
        }
    });
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
        getElement('ownerEmail').value = dataValues.email || '';
        getElement('ownerEmail').disabled = true;
        getElement('ownerPhone').value = dataValues.ownerPhone || '';
        getElement('shopDescription').value = dataValues.shopDescription || '';
        getElement('yearsInBusiness').value = dataValues.yearsInBusiness || '';
        getElement('shopAddress').value = dataValues.shopAddress || '';
        getElement('shopCity').value = dataValues.shopCity || '';
        getElement('shopProvince').value = dataValues.shopProvince || 'Bataan';
        getElement('shopState').value = dataValues.shopState || 'Central Luzon';
        getElement('shopZip').value = dataValues.shopZip || '';
        getElement('shopCountry').value = dataValues.shopCountry || 'Philippines';
        getElement('taxId').value = dataValues.taxId || '';
        getElement('latitude').value = dataValues.latitude || '';
        getElement('longitude').value = dataValues.longitude || '';
        
        // Update display coordinates
        if (dataValues.latitude && dataValues.longitude) {
            getElement('displayLatitude').textContent = parseFloat(dataValues.latitude).toFixed(6);
            getElement('displayLongitude').textContent = parseFloat(dataValues.longitude).toFixed(6);
        }

        // Set shop categories checkboxes
        if (dataValues.shopCategories && Array.isArray(dataValues.shopCategories)) {
            dataValues.shopCategories.forEach(category => {
                const checkbox = document.querySelector(`input[name="shopCategories"][value="${category}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }

        // Set up reapply button event listener
        const reapplyButton = getElement('reapplyButton');

        reapplyButton.addEventListener('click', async (event) => {
            event.preventDefault();
            setButtonDisable();
            showLoader();
            updateLoaderProgress('validating');
            clearFieldErrors();

            // Disable all form inputs during submission
            const form = getElement('shopReapplicationForm');
            const inputs = form.querySelectorAll('input, button, textarea, select');
            inputs.forEach(input => input.disabled = true);

            try {
                // Validate all required fields
                const errors = [];
                const requiredFields = [
                    { id: 'shopName', name: 'Shop Name' },
                    { id: 'shopDescription', name: 'Shop Description' },
                    { id: 'ownerName', name: 'Owner Name' },
                    { id: 'ownerEmail', name: 'Email' },
                    { id: 'ownerPhone', name: 'Phone Number' },
                    { id: 'shopAddress', name: 'Shop Address' },
                    { id: 'shopCity', name: 'City' },
                    { id: 'shopProvince', name: 'Province' },
                    { id: 'shopState', name: 'Region' },
                    { id: 'shopZip', name: 'ZIP/Postal Code' },
                    { id: 'shopCountry', name: 'Country' },
                    { id: 'taxId', name: 'Tax ID' }
                ];

                requiredFields.forEach(({ id, name }) => {
                    const field = getElement(id);
                    let value = field.value.trim();
                    if (id === 'taxId') {
                        value = value.replace(/-/g, '');
                    }
                    if (!value) {
                        errors.push(`${name} is required`);
                        if (field) showFieldError(field, `${name} is required`);
                    }
                });

                // Validate shop categories
                const categoryCheckboxes = document.querySelectorAll('input[name="shopCategories"]');
                const selectedCategories = Array.from(categoryCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
                if (selectedCategories.length === 0) {
                    errors.push('At least one Shop Category is required');
                    const categoryGroup = categoryCheckboxes[0]?.closest('.form-group');
                    if (categoryGroup) {
                        showFieldError(categoryGroup.querySelector('label'), 'At least one category is required');
                    }
                }

                // Validate phone number format
                const phoneField = getElement('ownerPhone');
                if (phoneField) {
                    const phoneDigits = phoneField.value.replace(/\D/g, '');
                    if (phoneDigits.length !== 10 || !/^9\d{9}$/.test(phoneDigits)) {
                        errors.push('Invalid phone number');
                        showFieldError(phoneField, 'Please enter a valid 10-digit Philippine mobile number starting with 9');
                    }
                }

                // Validate ZIP code
                const zipField = getElement('shopZip');
                if (zipField && (zipField.value.length !== 4 || !/^\d+$/.test(zipField.value))) {
                    errors.push('Invalid ZIP code');
                    showFieldError(zipField, 'Please enter a valid 4-digit ZIP code');
                }

                // Validate latitude and longitude
                const latitudeField = getElement('latitude');
                const longitudeField = getElement('longitude');
                if (!latitudeField.value || !longitudeField.value) {
                    errors.push('Shop location on map is required');
                    const mapGroup = document.getElementById('map').closest('.form-group');
                    showFieldError(mapGroup.querySelector('label'), 'Please set a location on the map');
                }

                // Validate tax ID
                const taxIdField = getElement('taxId');
                const taxId = taxIdField.value.replace(/-/g, '');
                if (taxId && (taxId.length !== 12 || !/^\d{12}$/.test(taxId))) {
                    errors.push('Tax ID must be exactly 12 digits');
                    showFieldError(taxIdField, 'Tax ID must be exactly 12 digits (XXXX-XXXX-XXXX)');
                }

                // Get files
                const permitFile = getElement("permitDocument").files[0] || null;
                const licenseFile = getElement("businessLicense").files[0] || null;
                const frontSideFile = getElement("ownerIdFront").files[0] || null;
                const backSideFile = getElement("ownerIdBack").files[0] || null;
                const dtiFile = getElement("dtiDocument").files[0] || null;
                const birFile = getElement("birDocument").files[0] || null;

                // Validate files that are actually uploaded
                const validateFileUpload = (file, name) => {
                    if (file) {
                        try { 
                            validateFile(file, name); 
                        } catch (fileError) { 
                            errors.push(fileError.message);
                            const fileInput = getElement(name.toLowerCase().replace(/\s+/g, '') + 'Document');
                            if (fileInput) showFieldError(fileInput, fileError.message);
                        }
                    }
                };

                validateFileUpload(permitFile, 'Business Permit');
                validateFileUpload(licenseFile, 'Business License');
                validateFileUpload(frontSideFile, 'ID Front Side');
                validateFileUpload(backSideFile, 'ID Back Side');
                validateFileUpload(dtiFile, 'DTI Registration');
                validateFileUpload(birFile, 'BIR Registration');

                // Check terms agreement
                const agreeTerms = getElement('agreeTerms');
                if (!agreeTerms || !agreeTerms.checked) {
                    errors.push('You must agree to the Terms of Service and Privacy Policy');
                    if (agreeTerms) showFieldError(agreeTerms, 'You must agree to the Terms of Service and Privacy Policy');
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
                    dateProcessed: new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    }).replace(/\//g, '-').replace(/,/g, ''),
                    shopName: getElement('shopName').value,
                    shopCategories: selectedCategories,
                    shopDescription: getElement('shopDescription').value,
                    yearsInBusiness: getElement('yearsInBusiness').value || '',
                    ownerName: getElement('ownerName').value,
                    ownerPhone: getElement('ownerPhone').value.replace(/\s/g, ''), // Remove spaces for storage
                    shopAddress: getElement('shopAddress').value,
                    shopCity: getElement('shopCity').value,
                    shopProvince: getElement('shopProvince').value,
                    shopState: getElement('shopState').value,
                    shopZip: getElement('shopZip').value,
                    shopCountry: getElement('shopCountry').value,
                    taxId: getElement('taxId').value,
                    latitude: getElement('latitude').value,
                    longitude: getElement('longitude').value,
                    rejectionReason: null, // Clear rejection reason on reapplication
                    dateRejected: '' // Clear rejection date
                };

                // Upload files that user actually selected
                updateLoaderProgress('uploadingFiles', 0);
                const uploadsData = await uploadFilesWithProgress(shopId, permitFile, licenseFile, frontSideFile, backSideFile, dtiFile, birFile);

                // Merge new uploads with existing uploads data
                if (uploadsData && Object.keys(uploadsData).length > 0) {
                    updatedData.uploads = {
                        ...dataValues.uploads,
                        ...uploadsData
                    };
                }

                // Clean up any duplicate fields to maintain clean structure
                delete updatedData.frontIdDocument;
                delete updatedData.backIdDocument;
                delete updatedData.licenseDocument;

                console.log('Final updated data to save:', updatedData);

                // Update shop data in database
                updateLoaderProgress('savingData');
                await updateShopData(shopId, updatedData);

                updateLoaderProgress('complete');
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Show success message
                hideLoader();
                setButtonAble();
                inputs.forEach(input => input.disabled = false);
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