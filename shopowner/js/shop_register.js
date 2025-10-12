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
const shopProvince = getElement('shopProvince');
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

// Tax ID formatting and validation
function initializeTaxIdFormatting() {
    const taxIdInput = document.getElementById('taxId');
    if (!taxIdInput) return;

    taxIdInput.addEventListener('input', function() {
        let value = this.value.replace(/[^0-9-]/g, '');
        value = value.replace(/-/g, '');
        
        if (value.length > 12) {
            value = value.slice(0, 12);
        }
        
        let formattedValue = '';
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) {
                formattedValue += '-';
            }
            formattedValue += value[i];
        }
        this.value = formattedValue;
    });

    taxIdInput.addEventListener('keypress', function(e) {
        const char = String.fromCharCode(e.keyCode || e.which);
        if (!/[0-9]/.test(char)) {
            e.preventDefault();
        }
    });

    // Also add blur event to ensure format is complete
    taxIdInput.addEventListener('blur', function() {
        let value = this.value.replace(/-/g, '');
        if (value.length > 0 && value.length < 12) {
            // Pad with zeros if needed
            value = value.padStart(12, '0');
            let formattedValue = '';
            for (let i = 0; i < value.length; i++) {
                if (i > 0 && i % 4 === 0) {
                    formattedValue += '-';
                }
                formattedValue += value[i];
            }
            this.value = formattedValue;
        }
    });
}

// Phone number validation
function initializePhoneValidation() {
    const phoneInput = document.getElementById('ownerPhone');
    if (!phoneInput) return;

    phoneInput.addEventListener('input', function() {
        // Remove any non-digit characters
        this.value = this.value.replace(/\D/g, '');
        
        // Limit to 10 digits (Philippine mobile numbers are 10 digits after +63)
        if (this.value.length > 10) {
            this.value = this.value.slice(0, 10);
        }
        
        // Format the display with spaces for better readability
        const formattedValue = this.value.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
        if (this.value.length >= 10) {
            this.value = formattedValue;
        }
    });

    phoneInput.addEventListener('blur', function() {
        // Ensure we have exactly 10 digits
        const digits = this.value.replace(/\D/g, '');
        if (digits.length !== 10) {
            showFieldError(this, 'Please enter a valid 10-digit Philippine mobile number');
        } else {
            // Format nicely on blur
            this.value = digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
        }
    });

    phoneInput.addEventListener('focus', function() {
        // Remove spaces when focused for easier editing
        this.value = this.value.replace(/\s/g, '');
    });
}

// File upload preview functionality
function initializeAllFilePreviews() {
    setupFilePreview('ownerIdFront', 'frontPreview', 'Front Side');
    setupFilePreview('ownerIdBack', 'backPreview', 'Back Side');
    setupFilePreview('businessLicense', 'licensePreview', 'Business License');
    setupFilePreview('permitDocument', 'permitPreview', 'Business Permit');
    setupFilePreview('dtiDocument', 'dtiPreview', 'DTI Document');
    setupFilePreview('birDocument', 'birPreview', 'BIR Document');
}

function setupFilePreview(inputId, previewId, defaultText) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    
    if (!input || !preview) return;
    
    input.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('File size exceeds 5MB limit');
            this.value = '';
            return;
        }
        const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            alert('Only JPEG, PNG, or PDF files are allowed');
            this.value = '';
            return;
        }
        if (file.type === 'application/pdf') {
            preview.innerHTML = `
                <i class="fas fa-file-pdf"></i>
                <span class="file-name">${file.name}</span>
                <button class="remove-preview" type="button">&times;</button>
            `;
            preview.classList.add('has-preview');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="remove-preview" type="button">&times;</button>
            `;
            preview.classList.add('has-preview');
        };
        reader.readAsDataURL(file);
    });
    
    preview.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-preview')) {
            e.stopPropagation();
            input.value = '';
            preview.innerHTML = `
                <i class="fas ${inputId.includes('Id') ? 'fa-id-card' : 'fa-file-upload'}"></i>
                <span>${defaultText}</span>
            `;
            preview.classList.remove('has-preview');
        }
    });
}

// Enhanced file upload function with progress tracking
async function uploadFilesWithProgress(userId, permitFile, licenseFile, frontSideFile, backSideFile, dtiFile, birFile) {
    return new Promise(async (resolve, reject) => {
        try {
            const permitPath = `uploads/${userId}/permit_${Date.now()}_${permitFile.name}`;
            const licensePath = `uploads/${userId}/license_${Date.now()}_${licenseFile.name}`;
            const frontSidePath = `uploads/${userId}/frontSide_${Date.now()}_${frontSideFile.name}`;
            const backSidePath = `uploads/${userId}/backSide_${Date.now()}_${backSideFile.name}`;
            const dtiPath = `uploads/${userId}/dti_${Date.now()}_${dtiFile.name}`;
            const birPath = `uploads/${userId}/bir_${Date.now()}_${birFile.name}`;

            let completedUploads = 0;
            const totalUploads = 6;
            const uploadResults = {};

            const updateProgress = () => {
                completedUploads++;
                const progress = Math.round((completedUploads / totalUploads) * 100);
                updateLoaderProgress('uploadingFiles', progress);
            };

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

            await Promise.all(uploadPromises);

            if (!uploadResults.permitDocument.success ||
                !uploadResults.businessLicense.success ||
                !uploadResults.ownerIdFront.success ||
                !uploadResults.ownerIdBack.success ||
                !uploadResults.dtiDocument.success ||
                !uploadResults.birDocument.success) {
                throw new Error('File upload failed');
            }

            resolve({
                permitDocument: { name: permitFile.name, url: uploadResults.permitDocument.url, path: uploadResults.permitDocument.path, uploadedAt: new Date().toISOString() },
                businessLicense: { name: licenseFile.name, url: uploadResults.businessLicense.url, path: uploadResults.businessLicense.path, uploadedAt: new Date().toISOString() },
                ownerIdFront: { name: frontSideFile.name, url: uploadResults.ownerIdFront.url, path: uploadResults.ownerIdFront.path, uploadedAt: new Date().toISOString() },
                ownerIdBack: { name: backSideFile.name, url: uploadResults.ownerIdBack.url, path: uploadResults.ownerIdBack.path, uploadedAt: new Date().toISOString() },
                dtiDocument: { name: dtiFile.name, url: uploadResults.dtiDocument.url, path: uploadResults.dtiDocument.path, uploadedAt: new Date().toISOString() },
                birDocument: { name: birFile.name, url: uploadResults.birDocument.url, path: uploadResults.birDocument.path, uploadedAt: new Date().toISOString() }
            });
        } catch (error) {
            console.error('File upload error:', error);
            reject(new Error('Failed to upload files: ' + error.message));
        }
    });
}

// Update address fields based on geocoding results (for the new fields)
function updateAddressFields(geocodeResult) {
    let city = '';
    let province = '';
    let region = '';
    let zipCode = '';
    let country = '';

    // Parse address components
    geocodeResult.address_components.forEach(component => {
        const types = component.types;
        
        if (types.includes('locality')) {
            city = component.long_name;
        } else if (types.includes('administrative_area_level_2')) {
            province = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
            region = component.long_name;
        } else if (types.includes('postal_code')) {
            zipCode = component.long_name;
        } else if (types.includes('country')) {
            country = component.long_name;
        }
    });

    // Update form fields
    const addressField = document.getElementById('shopAddress');
    const cityField = document.getElementById('shopCity');
    const provinceField = document.getElementById('shopProvince'); // NEW
    const regionField = document.getElementById('shopState'); // Now represents Region
    const zipField = document.getElementById('shopZip');
    const countryField = document.getElementById('shopCountry');

    // Update address (always update as this is the main field)
    if (addressField) {
        addressField.value = geocodeResult.formatted_address;
    }

    // Update city
    if (city && cityField) {
        cityField.value = city;
    }

    // Update province
    if (province && provinceField) {
        provinceField.value = province;
    }

    // Update region
    if (region && regionField) {
        regionField.value = region;
    }

    // Update ZIP code
    if (zipCode && zipField) {
        zipField.value = zipCode;
    }

    // Update country
    if (country && countryField) {
        countryField.value = country;
    }

    console.log('Auto-filled shop address fields from reverse geocoding');
}

// Initialize all form functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeTaxIdFormatting();
    initializePhoneValidation();
    initializeAllFilePreviews();
    
    // Add event listeners for overlay buttons
    const closeOverlayBtn = getElement('closeOverlay');
    const closeErrorOverlayBtn = getElement('closeErrorOverlay');
    
    if (closeOverlayBtn) {
        closeOverlayBtn.addEventListener('click', closeOverlays);
    }
    
    if (closeErrorOverlayBtn) {
        closeErrorOverlayBtn.addEventListener('click', closeOverlays);
    }
    
    console.log('Shop registration form initialized');
});

// Main registration handler with proper progress tracking
registerButton.addEventListener('click', async (event) => {
    event.preventDefault();
    setButtonDisable();
    showLoader();
    updateLoaderProgress('validating');

    try {
        document.querySelectorAll('.error-message').forEach(el => el.remove());
        document.querySelectorAll('.form-group').forEach(el => el.classList.remove('error'));

        const errors = [];
        const requiredFields = [
            { id: 'shopName', name: 'Shop Name' },
            { id: 'shopDescription', name: 'Shop Description' },
            { id: 'yearsInBusiness', name: 'Years in Business' },
            { id: 'ownerName', name: 'Owner Name' },
            { id: 'ownerEmail', name: 'Email' },
            { id: 'ownerPhone', name: 'Phone Number' },
            { id: 'ownerIdFront', name: 'ID Front' },
            { id: 'ownerIdBack', name: 'ID Back' },
            { id: 'shopAddress', name: 'Shop Address' },
            { id: 'shopCity', name: 'City' },
            { id: 'shopProvince', name: 'Province' }, // NEW
            { id: 'shopState', name: 'Region' }, // Updated label
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

        requiredFields.forEach(({ id, name }) => {
            const field = getElement(id);
            if (!field || !field.value.trim()) {
                errors.push(`${name} is required`);
                if (field) showFieldError(field, `${name} is required`);
            }
        });

        const categoryCheckboxes = document.querySelectorAll('input[name="shopCategories"]');
        const selectedCategories = Array.from(categoryCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (selectedCategories.length === 0) {
            errors.push('At least one Shop Category is required');
            const categoryGroup = categoryCheckboxes[0]?.closest('.form-group');
            if (categoryGroup) {
                showFieldError(categoryGroup.querySelector('label'), 'At least one category is required');
            }
        }

        const emailField = getElement('ownerEmail');
        if (emailField && !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(emailField.value)) {
            errors.push('Invalid email format');
            showFieldError(emailField, 'Please enter a valid email address');
        }

        const phoneField = getElement('ownerPhone');
        if (phoneField) {
            const phoneDigits = phoneField.value.replace(/\D/g, '');
            if (phoneDigits.length !== 10 || !/^9\d{9}$/.test(phoneDigits)) {
                errors.push('Invalid phone number');
                showFieldError(phoneField, 'Please enter a valid 10-digit Philippine mobile number starting with 9');
            }
        }

        const zipField = getElement('shopZip');
        if (zipField && (zipField.value.length !== 4 || !/^\d+$/.test(zipField.value))) {
            errors.push('Invalid ZIP code');
            showFieldError(zipField, 'Please enter a valid 4-digit ZIP code');
        }

        const latitudeField = getElement('latitude');
        const longitudeField = getElement('longitude');
        if (!latitudeField.value || !longitudeField.value) {
            errors.push('Shop location on map is required');
            const mapGroup = document.getElementById('map').closest('.form-group');
            showFieldError(mapGroup.querySelector('label'), 'Please set a location on the map');
        }

        const passwordVal = getElement('password')?.value;
        const confirmPasswordVal = getElement('confirmPassword')?.value;
        if (passwordVal !== confirmPasswordVal) {
            errors.push('Passwords do not match');
            showFieldError(getElement('confirmPassword'), 'Passwords do not match');
        }

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

        validateFileUpload('ownerIdFront', 'Front ID');
        validateFileUpload('ownerIdBack', 'Back ID');
        validateFileUpload('businessLicense', 'Business License');
        validateFileUpload('permitDocument', 'Business Permit');
        validateFileUpload('dtiDocument', 'DTI Registration Document');
        validateFileUpload('birDocument', 'BIR Registration Document');

        const agreeTerms = getElement('agreeTerms');
        if (!agreeTerms || !agreeTerms.checked) {
            errors.push('You must agree to the Terms of Service and Privacy Policy');
            if (agreeTerms) showFieldError(agreeTerms, 'You must agree to the Terms of Service and Privacy Policy');
        }

        if (passwordVal) {
            if (passwordVal.length < 8) {
                errors.push('Password must be at least 8 characters');
            }
            if (!/[A-Z]/.test(passwordVal)) {
                errors.push('Password must contain at least one uppercase letter');
            }
            if (!/\d/.test(passwordVal)) {
                errors.push('Password must contain at least one number');
            }
            if (!/[^a-zA-Z0-9]/.test(passwordVal)) {
                errors.push('Password must contain at least one special character');
            }
            if (errors.length > 0 && errors.some(e => e.includes('Password must'))) {
                showFieldError(getElement('password'), 'Password does not meet requirements');
            }
        }

        const taxIdField = getElement('taxId');
        const taxId = taxIdField.value.replace(/-/g, '');
        if (taxId && (taxId.length !== 12 || !/^\d{12}$/.test(taxId))) {
            errors.push('Tax ID must be exactly 12 digits');
            showFieldError(taxIdField, 'Tax ID must be exactly 12 digits (XXXX-XXXX-XXXX)');
        }

        if (errors.length > 0) {
            hideLoader();
            setButtonAble();
            showErrorOverlay(errors);
            document.querySelector('.form-group.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const usernameVal = username.value;
        const passwordVal1 = password.value;
        const ownerEmailVal = ownerEmail.value;
        const permitDocumentFile = getElement("permitDocument").files[0];
        const businessLicenseFile = getElement("businessLicense").files[0];
        const frontSideFile = getElement("ownerIdFront").files[0];
        const backSideFile = getElement("ownerIdBack").files[0];
        const dtiFile = getElement("dtiDocument").files[0];
        const birFile = getElement("birDocument").files[0];

        updateLoaderProgress('creatingAccount');
        const userCredential = await createUserWithEmailAndPasswordWrapper(ownerEmailVal, passwordVal1);
        const user = userCredential.user;

        updateLoaderProgress('uploadingFiles', 0);
        const uploadsData = await uploadFilesWithProgress(user.uid, permitDocumentFile, businessLicenseFile, frontSideFile, backSideFile, dtiFile, birFile);

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
            ownerPhone: ownerPhone.value.replace(/\s/g, ''), // Remove spaces for storage
            shopAddress: shopAddress.value,
            shopCity: shopCity.value,
            shopProvince: shopProvince.value, // NEW FIELD
            shopState: shopState.value, // Now represents Region
            shopZip: shopZip.value,
            shopCountry: shopCountry.value,
            taxId: getElement('taxId').value,
            latitude: getElement('latitude').value,
            longitude: getElement('longitude').value,
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

        updateLoaderProgress('sendingEmail');
        await sendEmailVerificationWrapper(user);

        updateLoaderProgress('complete');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        hideLoader();
        setButtonAble();
        showSuccessOverlay();
        getElement('shopRegistrationForm').reset();

        // Reset map coordinates and marker
        document.getElementById('displayLatitude').textContent = 'N/A';
        document.getElementById('displayLongitude').textContent = 'N/A';
        if (window.marker) {
            window.marker.setPosition(null);
        }

    } catch (error) {
        console.error('Registration error:', error);
        hideLoader();
        setButtonAble();
        showErrorOverlay([error.message]);
    }
});