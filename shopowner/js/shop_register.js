import {
    createImageToFirebase,
    createUserWithEmailAndPasswordWrapper,
    sendEmailVerificationWrapper,
    createData
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Get all form elements
const shopName = getElement('shopName');
const shopDescription = getElement('shopDescription');
const yearsInBusiness = getElement('yearsInBusiness');
const ownerName = getElement('ownerName');
const ownerEmail = getElement('ownerEmail');
const ownerPhone = getElement('ownerPhone');
const shopAddress = getElement('shopAddress');
const shopCity = getElement('shopCity');
const shopState = getElement('shopState');
const shopZip = getElement('shopZip');
const shopCountry = getElement('shopCountry');
const username = getElement('username');
const password = getElement('password');
const confirmPassword = getElement('confirmPassword');

const dateProcessed = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
}).replace(/\//g, '-').replace(/,/g, '');

const registerButton = getElement('registerButton');

function setButtonDisable() {
    registerButton.style.background = "linear-gradient(135deg, #43579d, #694c8d)";
    registerButton.style.color = "#838383";
    registerButton.disabled = true;
    registerButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
}

function setButtonAble() {
    registerButton.style.background = "linear-gradient(135deg, var(--primary), var(--secondary))";
    registerButton.style.color = "var(--light)";
    registerButton.disabled = false;
    registerButton.innerHTML = 'Submit Application';
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
        creatingAccount: 'Creating Account...',
        uploadingFiles: 'Uploading Documents...',
        savingData: 'Saving Shop Information...',
        sendingEmail: 'Sending Verification Email...',
        complete: 'Registration Complete!'
    };
    
    if (overlayContent) {
        overlayContent.textContent = stages[stage] || stage;
    }
    
    if (progressText && percentage !== null) {
        progressText.textContent = `Progress: ${percentage}%`;
    } else if (progressText) {
        progressText.textContent = 'Please wait while we process your registration';
    }
}

// Overlay functions
function showSuccessOverlay() {
    getElement('successOverlay').classList.add('active');
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

// Add event listeners for overlay buttons
document.addEventListener('DOMContentLoaded', function() {
    const closeOverlayBtn = getElement('closeOverlay');
    const closeErrorOverlayBtn = getElement('closeErrorOverlay');
    
    if (closeOverlayBtn) {
        closeOverlayBtn.addEventListener('click', closeOverlays);
    }
    
    if (closeErrorOverlayBtn) {
        closeErrorOverlayBtn.addEventListener('click', closeOverlays);
    }
});

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

// Enhanced file upload function with progress tracking
async function uploadFilesWithProgress(userId, permitFile, licenseFile, frontSideFile, backSideFile, dtiFile, birFile) {
    return new Promise(async (resolve, reject) => {
        try {
            // Create storage paths
            const permitPath = `uploads/${userId}/permit_${Date.now()}_${permitFile.name}`;
            const licensePath = `uploads/${userId}/license_${Date.now()}_${licenseFile.name}`;
            const frontSidePath = `uploads/${userId}/frontSide_${Date.now()}_${frontSideFile.name}`;
            const backSidePath = `uploads/${userId}/backSide_${Date.now()}_${backSideFile.name}`;
            const dtiPath = `uploads/${userId}/dti_${Date.now()}_${dtiFile.name}`;
            const birPath = `uploads/${userId}/bir_${Date.now()}_${birFile.name}`;

            let completedUploads = 0;
            const totalUploads = 6;  // Six files: Permit, License, ID Front, ID Back, DTI, BIR
            const uploadResults = {};

            // Function to update progress
            const updateProgress = () => {
                completedUploads++;
                const progress = Math.round((completedUploads / totalUploads) * 100);
                updateLoaderProgress('uploadingFiles', progress);
            };

            // Upload files with individual progress tracking
            const uploadPromises = [
                createImageToFirebase(permitFile, permitPath).then(result => {
                    uploadResults.permitDocument = result;
                    updateProgress();
                    return result;
                }),
                createImageToFirebase(licenseFile, licensePath).then(result => {
                    uploadResults.businessLicense = result;
                    updateProgress();
                    return result;
                }),
                createImageToFirebase(frontSideFile, frontSidePath).then(result => {
                    uploadResults.ownerIdFront = result;
                    updateProgress();
                    return result;
                }),
                createImageToFirebase(backSideFile, backSidePath).then(result => {
                    uploadResults.ownerIdBack = result;
                    updateProgress();
                    return result;
                }),
                createImageToFirebase(dtiFile, dtiPath).then(result => {
                    uploadResults.dtiDocument = result;
                    updateProgress();
                    return result;
                }),
                createImageToFirebase(birFile, birPath).then(result => {
                    uploadResults.birDocument = result;
                    updateProgress();
                    return result;
                })
            ];

            // Wait for all uploads to complete
            await Promise.all(uploadPromises);

            // Check if all uploads were successful
            if (!uploadResults.permitDocument.success || 
                !uploadResults.businessLicense.success || 
                !uploadResults.ownerIdFront.success || 
                !uploadResults.ownerIdBack.success ||
                !uploadResults.dtiDocument.success ||
                !uploadResults.birDocument.success) {
                throw new Error('File upload failed');
            }

            // Return the upload data
            resolve({
                permitDocument: {
                    name: permitFile.name,
                    url: uploadResults.permitDocument.url,
                    path: uploadResults.permitDocument.path,
                    uploadedAt: new Date().toISOString()
                },
                businessLicense: {
                    name: licenseFile.name,
                    url: uploadResults.businessLicense.url,
                    path: uploadResults.businessLicense.path,
                    uploadedAt: new Date().toISOString()
                },
                ownerIdFront: {
                    name: frontSideFile.name,
                    url: uploadResults.ownerIdFront.url,
                    path: uploadResults.ownerIdFront.path,
                    uploadedAt: new Date().toISOString()
                },
                ownerIdBack: {
                    name: backSideFile.name,
                    url: uploadResults.ownerIdBack.url,
                    path: uploadResults.ownerIdBack.path,
                    uploadedAt: new Date().toISOString()
                },
                dtiDocument: {
                    name: dtiFile.name,
                    url: uploadResults.dtiDocument.url,
                    path: uploadResults.dtiDocument.path,
                    uploadedAt: new Date().toISOString()
                },
                birDocument: {
                    name: birFile.name,
                    url: uploadResults.birDocument.url,
                    path: uploadResults.birDocument.path,
                    uploadedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('File upload error:', error);
            reject(new Error('Failed to upload files: ' + error.message));
        }
    });
}

// Main registration handler with proper progress tracking
registerButton.addEventListener('click', async (event) => {
    event.preventDefault();
    setButtonDisable();
    showLoader();
    updateLoaderProgress('validating');

    try {
        // Clear previous errors
        document.querySelectorAll('.error-message').forEach(el => el.remove());
        document.querySelectorAll('.form-group').forEach(el => el.classList.remove('error'));

        // Validate all fields
        const errors = [];
        const requiredFields = [
            { id: 'shopName', name: 'Shop Name' },
            { id: 'shopDescription', name: 'Shop Description' },
            { id: 'ownerName', name: 'Owner Name' },
            { id: 'ownerEmail', name: 'Email' },
            { id: 'ownerPhone', name: 'Phone Number' },
            { id: 'ownerIdFront', name: 'ID Front' },
            { id: 'ownerIdBack', name: 'ID Back' },
            { id: 'shopAddress', name: 'Shop Address' },
            { id: 'shopCity', name: 'City' },
            { id: 'shopState', name: 'State/Province' },
            { id: 'shopZip', name: 'ZIP/Postal Code' },
            { id: 'shopCountry', name: 'Country' },
            { id: 'businessLicense', name: 'Business License' },
            { id: 'taxId', name: 'Tax ID' },
            { id: 'permitDocument', name: 'Business Permit' },
            { id: 'dtiDocument', name: 'DTI Registration Document' },
            { id: 'birDocument', name: 'BIR Registration Document' },
            { id: 'username', name: 'Username' },
            { id: 'password', name: 'Password' },
            { id: 'confirmPassword', name: 'Confirm Password' }
        ];

        // Check required fields
        requiredFields.forEach(({ id, name }) => {
            const field = getElement(id);
            if (!field || !field.value.trim()) {
                errors.push(`${name} is required`);
                if (field) showFieldError(field, `${name} is required`);
            }
        });

        // Validate categories (at least one selected)
        const categoryCheckboxes = document.querySelectorAll('input[name="shopCategories"]');
        const selectedCategories = Array.from(categoryCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (selectedCategories.length === 0) {
            errors.push('At least one Shop Category is required');
            const categoryGroup = categoryCheckboxes[0]?.closest('.form-group');
            if (categoryGroup) {
                showFieldError(categoryGroup.querySelector('label'), 'At least one category is required');
            }
        }

        // Validate email format
        const emailField = getElement('ownerEmail');
        if (emailField && !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(emailField.value)) {
            errors.push('Invalid email format');
            showFieldError(emailField, 'Please enter a valid email address');
        }

        // Validate phone number
        const phoneField = getElement('ownerPhone');
        if (phoneField && (phoneField.value.length !== 10 || !/^\d+$/.test(phoneField.value))) {
            errors.push('Invalid phone number');
            showFieldError(phoneField, 'Please enter a valid 10-digit Philippine mobile number');
        }

        // Validate ZIP code
        const zipField = getElement('shopZip');
        if (zipField && (zipField.value.length !== 4 || !/^\d+$/.test(zipField.value))) {
            errors.push('Invalid ZIP code');
            showFieldError(zipField, 'Please enter a valid 4-digit ZIP code');
        }

        // Validate password match
        const passwordVal = getElement('password')?.value;
        const confirmPasswordVal = getElement('confirmPassword')?.value;
        if (passwordVal !== confirmPasswordVal) {
            errors.push('Passwords do not match');
            showFieldError(getElement('confirmPassword'), 'Passwords do not match');
        }

        // Validate file uploads
        const validateFileUpload = (id, name) => {
            const fileInput = getElement(id);
            if (!fileInput || fileInput.files.length === 0) {
                errors.push(`${name} is required`);
                if (fileInput) showFieldError(fileInput, `${name} is required`);
                return false;
            }

            const file = fileInput.files[0];
            if (file.size > 5 * 1024 * 1024) {
                errors.push(`${name} file size exceeds 5MB limit`);
                showFieldError(fileInput, 'File size exceeds 5MB limit');
                return false;
            }

            const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
            if (!validTypes.includes(file.type)) {
                errors.push(`${name} invalid file type`);
                showFieldError(fileInput, 'Only JPEG, PNG, or PDF files are allowed');
                return false;
            }

            return true;
        };

        // Validate all file uploads
        validateFileUpload('ownerIdFront', 'Front ID');
        validateFileUpload('ownerIdBack', 'Back ID');
        validateFileUpload('businessLicense', 'Business License');
        validateFileUpload('permitDocument', 'Business Permit');
        validateFileUpload('dtiDocument', 'DTI Registration Document');
        validateFileUpload('birDocument', 'BIR Registration Document');

        // Validate terms agreement
        const agreeTerms = getElement('agreeTerms');
        if (!agreeTerms || !agreeTerms.checked) {
            errors.push('You must agree to the Terms of Service and Privacy Policy');
            if (agreeTerms) showFieldError(agreeTerms, 'You must agree to the Terms of Service and Privacy Policy');
        }

        // If any errors, stop here
        if (errors.length > 0) {
            hideLoader();
            setButtonAble();
            showErrorOverlay(errors);
            document.querySelector('.form-group.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Proceed with registration
        const usernameVal = username.value;
        const passwordVal1 = password.value;
        const ownerEmailVal = ownerEmail.value;
        const permitDocumentFile = getElement("permitDocument").files[0];
        const businessLicenseFile = getElement("businessLicense").files[0];
        const frontSideFile = getElement("ownerIdFront").files[0];
        const backSideFile = getElement("ownerIdBack").files[0];
        const dtiFile = getElement("dtiDocument").files[0];
        const birFile = getElement("birDocument").files[0];

        // Step 1: Create user account
        updateLoaderProgress('creatingAccount');
        const userCredential = await createUserWithEmailAndPasswordWrapper(ownerEmailVal, passwordVal1);
        const user = userCredential.user;

        // Step 2: Upload files with progress
        updateLoaderProgress('uploadingFiles', 0);
        const uploadsData = await uploadFilesWithProgress(user.uid, permitDocumentFile, businessLicenseFile, frontSideFile, backSideFile, dtiFile, birFile);

        // Step 3: Save shop data
        updateLoaderProgress('savingData');
        const shopData = {
            username: usernameVal,
            email: ownerEmailVal,
            status: 'pending',
            ownerName: ownerName.value,
            shopName: shopName.value,
            shopCategories: selectedCategories,
            shopDescription: shopDescription.value,
            yearsInBusiness: yearsInBusiness.value || '',
            ownerPhone: ownerPhone.value,
            shopAddress: shopAddress.value,
            shopCity: shopCity.value,
            shopState: shopState.value,
            shopZip: shopZip.value,
            shopCountry: shopCountry.value,
            taxId: getElement('taxId').value,
            dateProcessed: dateProcessed,
            dateApproved: '',
            dateRejected: '',
            uploads: uploadsData
        };

        const createResult = await createData(
            `smartfit_AR_Database/shop/${user.uid}`, 
            user.uid, 
            shopData
        );

        if (!createResult.success) {
            throw new Error('Failed to create shop record: ' + createResult.error);
        }

        // Step 4: Send verification email
        updateLoaderProgress('sendingEmail');
        await sendEmailVerificationWrapper(user);

        // Step 5: Complete
        updateLoaderProgress('complete');
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        hideLoader();
        setButtonAble();
        showSuccessOverlay();
        getElement('shopRegistrationForm').reset();

    } catch (error) {
        console.error('Registration error:', error);
        hideLoader();
        setButtonAble();
        showErrorOverlay([error.message]);
    }
});