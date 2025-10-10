import {
    createImageToFirebase,
    updateProfileMethod,
    createUserWithEmailAndPasswordWrapper,
    sendEmailVerificationWrapper,
    app,
    auth,
    db,
    storage
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Get form elements
const firstName = getElement('firstName');
const lastName = getElement('lastName');
const email = getElement('email');
const phone = getElement('phone');
const birthDate = getElement('birthDate');
const address = getElement('address');
const city = getElement('city');
const state = getElement('state');
const zip = getElement('zip');
const country = getElement('country');
const username = getElement('username');
const password = getElement('password');
const confirmPassword = getElement('confirmPassword');
const agreeTerms = getElement('agreeTerms');
const profilePhoto = getElement('profilePhoto');
const registerButton = getElement('registerButton');

// Initialize Google Map
let map, marker, geocoder;

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 14.5995, lng: 120.9842 }, // Default center: Philippines
        zoom: 8,
        mapTypeControl: false,
        streetViewControl: false
    });
    geocoder = new google.maps.Geocoder();

    // Use AdvancedMarkerElement
    marker = new google.maps.marker.AdvancedMarkerElement({
        map: map,
        position: null, // Initially no position
        gmpDraggable: true
    });

    // Update hidden inputs when marker is dragged
    marker.addListener('dragend', function(event) {
        const position = event.latLng;
        document.getElementById('latitude').value = position.lat();
        document.getElementById('longitude').value = position.lng();
    });

    // Handle "Locate on Map" button
    document.getElementById('locateMapBtn').addEventListener('click', function() {
        // Validate address fields before geocoding
        const addressComponents = [
            address.value,
            city.value,
            state.value,
            zip.value,
            country.value
        ].filter(component => component.trim());
        
        if (addressComponents.length < 3) {
            showErrorOverlay(['Please provide at least street address, city, and province for accurate location.']);
            return;
        }

        const fullAddress = addressComponents.join(', ');
        
        // Show loading state on button
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
        this.disabled = true;

        geocoder.geocode({ 
            address: fullAddress,
            componentRestrictions: { country: 'PH' } // Restrict to Philippines
        }, (results, status) => {
            this.innerHTML = 'Locate on Map';
            this.disabled = false;

            console.log('Geocode status:', status);
            console.log('Geocode results:', results);

            if (status === google.maps.GeocoderStatus.OK && results.length > 0) {
                const location = results[0].geometry.location;
                map.setCenter(location);
                map.setZoom(15);
                marker.position = location;
                document.getElementById('latitude').value = location.lat();
                document.getElementById('longitude').value = location.lng();
                console.log('Geocoded address:', results[0].formatted_address);
            } else {
                showErrorOverlay(['Unable to locate the address. Please verify the address details or drag the marker to the correct location.']);
            }
        });
    });
}

// Loader control functions
function showLoader() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loadingOverlay';
    loadingOverlay.className = 'overlay';
    loadingOverlay.innerHTML = `
        <div class="overlay-content">
            <h2>Processing Registration...</h2>
            <p>Please wait while we process your registration</p>
        </div>
    `;
    document.body.appendChild(loadingOverlay);
    loadingOverlay.classList.add('active');
}

function hideLoader() {
    const loadingOverlay = getElement('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
        setTimeout(() => loadingOverlay.remove(), 300);
    }
}

// Update loader progress
function updateLoaderProgress(stage, percentage = null) {
    const overlayContent = document.querySelector('.overlay-content h2');
    const progressText = document.querySelector('.overlay-content p');
    
    const stages = {
        validating: 'Validating Form Data...',
        creatingAccount: 'Creating Account...',
        uploadingPhoto: 'Uploading Profile Photo...',
        savingData: 'Saving Profile Information...',
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
        const existingError = formGroup.querySelector('.error-message');
        if (existingError) existingError.remove();
        const errorElement = document.createElement('span');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        formGroup.appendChild(errorElement);
    }
}

// Helper function to get selected gender
function getSelectedGender() {
    const selectedGender = document.querySelector('input[name="gender"]:checked');
    return selectedGender ? selectedGender.value : "not specified";
}

// Button state control
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
    registerButton.innerHTML = 'Create Account';
}

// Initialize map and overlay listeners
document.addEventListener('DOMContentLoaded', function() {
    const closeOverlayBtn = getElement('closeOverlay');
    const closeErrorOverlayBtn = getElement('closeErrorOverlay');
    
    if (closeOverlayBtn) {
        closeOverlayBtn.addEventListener('click', closeOverlays);
    }
    
    if (closeErrorOverlayBtn) {
        closeErrorOverlayBtn.addEventListener('click', closeOverlays);
    }
    
    initMap();
});

// Main registration handler
registerButton.addEventListener('click', async (event) => {
    event.preventDefault();
    setButtonDisable();
    showLoader();
    updateLoaderProgress('validating');

    try {
        // Clear previous errors
        document.querySelectorAll('.error-message').forEach(el => el.remove());
        document.querySelectorAll('.form-group').forEach(el => el.classList.remove('error'));

        // Validate required fields
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

        requiredFields.forEach(({ id, name }) => {
            const field = getElement(id);
            if (!field || !field.value.trim()) {
                errors.push(`${name} is required`);
                if (field) showFieldError(field, `${name} is required`);
            }
        });

        // Validate email format
        if (email.value && !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email.value)) {
            errors.push('Invalid email format');
            showFieldError(email, 'Please enter a valid email address');
        }

        // Validate phone number
        if (phone.value && (phone.value.length !== 10 || !/^\d+$/.test(phone.value))) {
            errors.push('Invalid phone number');
            showFieldError(phone, 'Please enter a valid 10-digit Philippine mobile number');
        }

        // Validate ZIP code
        if (zip.value && (zip.value.length !== 4 || !/^\d+$/.test(zip.value))) {
            errors.push('Invalid ZIP code');
            showFieldError(zip, 'Please enter a valid 4-digit ZIP code');
        }

        // Validate map location
        const latitudeField = getElement('latitude');
        const longitudeField = getElement('longitude');
        if (!latitudeField.value || !longitudeField.value) {
            errors.push('Address location on map is required');
            const mapGroup = document.getElementById('map').closest('.form-group');
            showFieldError(mapGroup.querySelector('label'), 'Please set a location on the map');
        }

        // Validate password match
        const passwordVal = password.value;
        const confirmPasswordVal = confirmPassword.value;
        if (passwordVal !== confirmPasswordVal) {
            errors.push('Passwords do not match');
            showFieldError(confirmPassword, 'Passwords do not match');
        }

        // Validate password requirements
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
                showFieldError(password, 'Password does not meet requirements');
            }
        }

        // Validate birth date (at least 13 years old)
        const birthDateVal = birthDate.value;
        if (birthDateVal) {
            const birth = new Date(birthDateVal);
            const minAgeDate = new Date();
            minAgeDate.setFullYear(minAgeDate.getFullYear() - 13);
            if (birth > minAgeDate) {
                errors.push('You must be at least 13 years old');
                showFieldError(birthDate, 'You must be at least 13 years old');
            }
        }

        // Validate profile photo (if provided)
        if (profilePhoto.files.length > 0) {
            const file = profilePhoto.files[0];
            if (file.size > 2 * 1024 * 1024) {
                errors.push('Profile photo size exceeds 2MB limit');
                showFieldError(profilePhoto, 'File size exceeds 2MB limit');
            }
            const validTypes = ['image/jpeg', 'image/png'];
            if (!validTypes.includes(file.type)) {
                errors.push('Profile photo must be JPEG or PNG');
                showFieldError(profilePhoto, 'Only JPEG or PNG files are allowed');
            }
        }

        // Validate terms agreement
        if (!agreeTerms.checked) {
            errors.push('You must agree to the Terms of Service and Privacy Policy');
            showFieldError(agreeTerms, 'You must agree to the Terms of Service and Privacy Policy');
        }

        // If errors, stop here
        if (errors.length > 0) {
            hideLoader();
            setButtonAble();
            showErrorOverlay(errors);
            document.querySelector('.form-group.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Proceed with registration
        updateLoaderProgress('creatingAccount');

        // Create user account
        const userCredential = await createUserWithEmailAndPasswordWrapper(email.value, passwordVal);
        const user = userCredential.user;

        // Upload profile photo if provided
        let photoData = {};
        if (profilePhoto.files.length > 0) {
            updateLoaderProgress('uploadingPhoto');
            const imageResult = await createImageToFirebase(
                profilePhoto.files[0],
                `customerProfile/${user.uid}/profile_${Date.now()}_${profilePhoto.files[0].name}`
            );

            if (imageResult.success) {
                photoData = {
                    profilePhoto: imageResult.url,
                    profilePhotoPath: imageResult.path,
                    profilePhotoUpdated: new Date().toISOString()
                };
            } else {
                throw new Error('Failed to upload profile photo: ' + imageResult.error);
            }
        }

        // Save user data
        updateLoaderProgress('savingData');
        const userData = {
            username: username.value,
            email: email.value,
            status: 'active',
            dateAccountCreated: new Date().toISOString(),
            firstName: firstName.value,
            lastName: lastName.value,
            phone: phone.value,
            gender: getSelectedGender(),
            birthday: birthDate.value,
            address: address.value,
            city: city.value,
            state: state.value,
            zip: zip.value,
            country: country.value,
            latitude: latitudeField.value,
            longitude: longitudeField.value,
            ...photoData
        };

        const profileResult = await updateProfileMethod(user.uid, userData, `smartfit_AR_Database/customers/${user.uid}`);

        if (!profileResult.success) {
            throw new Error('Failed to save profile: ' + profileResult.error);
        }

        // Send verification email
        updateLoaderProgress('sendingEmail');
        await sendEmailVerificationWrapper(user);

        // Complete
        updateLoaderProgress('complete');
        await new Promise(resolve => setTimeout(resolve, 1000));

        hideLoader();
        setButtonAble();
        showSuccessOverlay();
        getElement('customerRegistrationForm').reset();

        // Reset file previews
        document.querySelectorAll('.upload-preview').forEach(preview => {
            preview.classList.remove('has-preview');
            preview.innerHTML = `<i class="fas fa-user-circle"></i><span>Profile Photo</span>`;
        });
    } catch (error) {
        console.error('Registration error:', error);
        hideLoader();
        setButtonAble();
        let errorMessage = 'Registration failed: ' + error.message;
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please use a different email or try logging in.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Please choose a stronger password (at least 6 characters).';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address.';
        }
        showErrorOverlay([errorMessage]);
    }
});