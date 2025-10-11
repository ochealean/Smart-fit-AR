import {
    createImageToFirebase,
    updateProfileMethod,
    createUserWithEmailAndPasswordWrapper,
    sendEmailVerificationWrapper,
    createData
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Password strength indicator
function initializePasswordStrength() {
    const passwordInput = document.getElementById('password');
    const strengthBars = document.querySelectorAll('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    const reqLength = document.getElementById('req-length');
    const reqUppercase = document.getElementById('req-uppercase');
    const reqNumber = document.getElementById('req-number');
    const reqSpecial = document.getElementById('req-special');

    if (!passwordInput || !strengthBars.length) return;

    passwordInput.addEventListener('input', function() {
        const password = this.value;
        let strength = 0;
        
        // Check length >= 8
        const hasLength = password.length >= 8;
        if (reqLength) reqLength.style.color = hasLength ? '#4CAF50' : '#f44336';
        if (hasLength) strength++;
        
        // Check uppercase
        const hasUppercase = /[A-Z]/.test(password);
        if (reqUppercase) reqUppercase.style.color = hasUppercase ? '#4CAF50' : '#f44336';
        if (hasUppercase) strength++;
        
        // Check number
        const hasNumber = /\d/.test(password);
        if (reqNumber) reqNumber.style.color = hasNumber ? '#4CAF50' : '#f44336';
        if (hasNumber) strength++;
        
        // Check special character
        const hasSpecial = /[^a-zA-Z0-9]/.test(password);
        if (reqSpecial) reqSpecial.style.color = hasSpecial ? '#4CAF50' : '#f44336';
        if (hasSpecial) strength++;
        
        // Update strength bars
        strengthBars.forEach((bar, index) => {
            bar.style.backgroundColor = index < strength ? '#4CAF50' : '#e0e0e0';
        });
        
        // Update text
        if (strengthText) {
            if (strength <= 1) {
                strengthText.textContent = 'Password strength: Weak';
                strengthText.style.color = '#f44336';
            } else if (strength <= 3) {
                strengthText.textContent = 'Password strength: Good';
                strengthText.style.color = '#FFC107';
            } else {
                strengthText.textContent = 'Password strength: Strong';
                strengthText.style.color = '#4CAF50';
            }
        }
    });
}

// Toggle password visibility
function initializePasswordToggle() {
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                this.setAttribute('aria-label', 'Hide password');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                this.setAttribute('aria-label', 'Show password');
            }
        });
    });
}

// Phone number validation
function initializePhoneValidation() {
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value.length > 10) {
                this.value = this.value.slice(0, 10);
            }
        });
    }
}

// ZIP code validation
function initializeZipValidation() {
    const zipInput = document.getElementById('zip');
    if (zipInput) {
        zipInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value.length > 4) {
                this.value = this.value.slice(0, 4);
            }
        });
    }
}

// Date of birth validation
function initializeDateValidation() {
    const birthDateInput = document.getElementById('birthDate');
    if (birthDateInput) {
        const today = new Date();
        const minDate = new Date();
        minDate.setFullYear(today.getFullYear() - 120); // Max age 120 years
        const maxDate = new Date();
        maxDate.setFullYear(today.getFullYear() - 13); // Min age 13 years

        birthDateInput.max = maxDate.toISOString().split('T')[0];
        birthDateInput.min = minDate.toISOString().split('T')[0];
    }
}

// File preview setup
function setupFilePreview(inputId, previewId, defaultText) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    if (!input || !preview) return;

    input.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;

        // Check file size (2MB max for profile photos)
        const maxSize = inputId === 'profilePhoto' ? 2 : 5;
        if (file.size > maxSize * 1024 * 1024) {
            alert(`File size exceeds ${maxSize}MB limit`);
            this.value = '';
            return;
        }

        // Check file type
        const validTypes = ['image/jpeg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            alert('Only JPEG or PNG files are allowed');
            this.value = '';
            return;
        }

        // For image files
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

    // Handle click on preview container to remove file
    preview.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-preview')) {
            e.stopPropagation();
            input.value = '';
            preview.innerHTML = `
                <i class="fas ${inputId === 'profilePhoto' ? 'fa-user-circle' : 'fa-file-upload'}"></i>
                <span>${defaultText}</span>
            `;
            preview.classList.remove('has-preview');
        }
    });
}

// Button state management
function setButtonDisable() {
    const registerButton = getElement('registerButton');
    if (registerButton) {
        registerButton.style.background = "linear-gradient(135deg, #43579d, #694c8d)";
        registerButton.style.color = "#838383";
        registerButton.disabled = true;
        registerButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    }
}

function setButtonAble() {
    const registerButton = getElement('registerButton');
    if (registerButton) {
        registerButton.style.background = "linear-gradient(135deg, var(--primary), var(--secondary))";
        registerButton.style.color = "var(--light)";
        registerButton.disabled = false;
        registerButton.innerHTML = 'Create Account';
    }
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
    const overlayContent = document.querySelector('#loadingOverlay .overlay-content h2');
    const progressText = document.querySelector('#loadingOverlay .overlay-content p');
    
    const stages = {
        validating: 'Validating Form Data...',
        creatingAccount: 'Creating Account...',
        uploadingPhoto: 'Uploading Profile Photo...',
        savingData: 'Saving Customer Information...',
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
    if (errorContainer) {
        errorContainer.innerHTML = '';
        errors.forEach(error => {
            const errorElement = document.createElement('p');
            errorElement.textContent = error;
            errorContainer.appendChild(errorElement);
        });
        getElement('errorOverlay').classList.add('active');
    }
}

function closeOverlays() {
    getElement('successOverlay').classList.remove('active');
    getElement('errorOverlay').classList.remove('active');
    getElement('loadingOverlay').classList.remove('active');
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

// Helper function to get selected gender from radio buttons
function getSelectedGender() {
    const selectedGender = document.querySelector('input[name="gender"]:checked');
    return selectedGender ? selectedGender.value : "not specified";
}

// Enhanced file upload function for profile photo
async function uploadProfilePhotoWithProgress(userId, photoFile) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!photoFile) {
                resolve(null);
                return;
            }

            const photoPath = `customerProfile/${userId}/profile_${Date.now()}_${photoFile.name}`;
            
            updateLoaderProgress('uploadingPhoto', 50);
            
            const imageResult = await createImageToFirebase(photoFile, photoPath);
            
            if (!imageResult.success) {
                throw new Error('Profile photo upload failed');
            }

            updateLoaderProgress('uploadingPhoto', 100);
            
            resolve({
                profilePhoto: imageResult.url,
                profilePhotoPath: imageResult.path,
                profilePhotoUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.error('Profile photo upload error:', error);
            reject(new Error('Failed to upload profile photo: ' + error.message));
        }
    });
}

// Main registration handler
async function handleRegistration(event) {
    event.preventDefault();
    setButtonDisable();
    showLoader();
    updateLoaderProgress('validating');

    try {
        // Clear previous errors
        document.querySelectorAll('.error-message').forEach(el => el.remove());
        document.querySelectorAll('.form-group').forEach(el => el.classList.remove('error'));

        const errors = [];
        const requiredFields = [
            { id: 'firstName', name: 'First Name' },
            { id: 'lastName', name: 'Last Name' },
            { id: 'email', name: 'Email' },
            { id: 'phone', name: 'Phone Number' },
            { id: 'birthDate', name: 'Date of Birth' },
            { id: 'address', name: 'Street Address' },
            { id: 'city', name: 'City' },
            { id: 'state', name: 'State/Province' },
            { id: 'zip', name: 'ZIP/Postal Code' },
            { id: 'country', name: 'Country' },
            { id: 'username', name: 'Username' },
            { id: 'password', name: 'Password' },
            { id: 'confirmPassword', name: 'Confirm Password' }
        ];

        // Validate required fields
        requiredFields.forEach(({ id, name }) => {
            const field = getElement(id);
            if (!field || !field.value.trim()) {
                errors.push(`${name} is required`);
                if (field) showFieldError(field, `${name} is required`);
            }
        });

        // Validate coordinates
        const latitude = getElement('latitude').value;
        const longitude = getElement('longitude').value;
        if (!latitude || !longitude) {
            errors.push('Location coordinates are required');
            const mapGroup = document.getElementById('map').closest('.form-group');
            showFieldError(mapGroup.querySelector('label'), 'Please set your location on the map');
        }

        // Validate email format
        const emailField = getElement('email');
        if (emailField && !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(emailField.value)) {
            errors.push('Invalid email format');
            showFieldError(emailField, 'Please enter a valid email address');
        }

        // Validate phone number
        const phoneField = getElement('phone');
        if (phoneField && (phoneField.value.length !== 10 || !/^\d+$/.test(phoneField.value))) {
            errors.push('Invalid phone number');
            showFieldError(phoneField, 'Please enter a valid 10-digit Philippine mobile number');
        }

        // Validate ZIP code
        const zipField = getElement('zip');
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

        // Validate password strength
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

        // Validate profile photo if provided
        const profilePhotoFile = getElement("profilePhoto").files[0];
        if (profilePhotoFile) {
            if (profilePhotoFile.size > 2 * 1024 * 1024) {
                errors.push('Profile photo file size exceeds 2MB limit');
                showFieldError(getElement('profilePhoto'), 'File size exceeds 2MB limit');
            }
            const validTypes = ['image/jpeg', 'image/png'];
            if (!validTypes.includes(profilePhotoFile.type)) {
                errors.push('Profile photo invalid file type');
                showFieldError(getElement('profilePhoto'), 'Only JPEG or PNG files are allowed');
            }
        }

        // Validate terms agreement
        const agreeTerms = getElement('agreeTerms');
        if (!agreeTerms || !agreeTerms.checked) {
            errors.push('You must agree to the Terms of Service and Privacy Policy');
            if (agreeTerms) showFieldError(agreeTerms, 'You must agree to the Terms of Service and Privacy Policy');
        }

        if (errors.length > 0) {
            hideLoader();
            setButtonAble();
            showErrorOverlay(errors);
            document.querySelector('.form-group.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const usernameVal = getElement('username').value;
        const passwordVal1 = getElement('password').value;
        const emailVal = getElement('email').value;

        // Create user account
        updateLoaderProgress('creatingAccount');
        const userCredential = await createUserWithEmailAndPasswordWrapper(emailVal, passwordVal1);
        const user = userCredential.user;

        // Upload profile photo if provided
        let photoData = null;
        if (profilePhotoFile) {
            try {
                photoData = await uploadProfilePhotoWithProgress(user.uid, profilePhotoFile);
            } catch (photoError) {
                console.warn("Profile photo upload failed, but account was created:", photoError);
                // Continue without photo
            }
        }

        // Save customer data
        updateLoaderProgress('savingData');
        const customerData = {
            username: usernameVal,
            email: emailVal,
            status: "active",
            dateAccountCreated: new Date().toISOString(),
            firstName: getElement('firstName').value,
            lastName: getElement('lastName').value,
            phone: getElement('phone').value,
            gender: getSelectedGender(),
            birthday: getElement('birthDate').value,
            address: getElement('address').value,
            city: getElement('city').value,
            state: getElement('state').value,
            zip: getElement('zip').value,
            country: getElement('country').value,
            latitude: getElement('latitude').value,
            longitude: getElement('longitude').value,
            locationVerified: !!(getElement('latitude').value && getElement('longitude').value),
            ...(photoData && { profilePhoto: photoData })
        };

        const createResult = await createData(
            `smartfit_AR_Database/customers/${user.uid}`,
            user.uid,
            customerData
        );

        if (!createResult.success) {
            throw new Error('Failed to create customer record: ' + createResult.error);
        }

        // Send verification email
        updateLoaderProgress('sendingEmail');
        await sendEmailVerificationWrapper(user);

        updateLoaderProgress('complete');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        hideLoader();
        setButtonAble();
        showSuccessOverlay();
        getElement('customerRegistrationForm').reset();

        // Reset map coordinates
        getElement('displayLatitude').textContent = 'N/A';
        getElement('displayLongitude').textContent = 'N/A';

    } catch (error) {
        console.error('Registration error:', error);
        hideLoader();
        setButtonAble();
        
        // User-friendly error messages
        let errorMessage = error.message;
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "This email is already registered. Please use a different email or try logging in.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Please choose a stronger password (at least 6 characters).";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Please enter a valid email address.";
        }
        
        showErrorOverlay([errorMessage]);
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize form functionality
    initializePasswordToggle();
    initializePasswordStrength();
    initializePhoneValidation();
    initializeZipValidation();
    initializeDateValidation();
    setupFilePreview('profilePhoto', 'profilePreview', 'Profile Photo');

    // Add event listeners for overlay buttons
    const closeOverlayBtn = getElement('closeOverlay');
    const closeErrorOverlayBtn = getElement('closeErrorOverlay');
    
    if (closeOverlayBtn) {
        closeOverlayBtn.addEventListener('click', closeOverlays);
    }
    
    if (closeErrorOverlayBtn) {
        closeErrorOverlayBtn.addEventListener('click', closeOverlays);
    }

    // Add form submit handler
    const registrationForm = getElement('customerRegistrationForm');
    if (registrationForm) {
        registrationForm.addEventListener('submit', handleRegistration);
    }
});