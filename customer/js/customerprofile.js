import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    createImageToFirebase,
    deleteImageFromFirebase,
    updateProfileMethod,
    changeUserPassword,
    signInWithEmailAndPasswordWrapper
} from "../../firebaseMethods.js";

// State variables
let avatarFile = null;
let customerData = {};
let originalEmail = '';
let userSession = {
    userId: null,
    userData: null,
    role: null
};
let map;
let marker;

// DOM Elements - Add the new map elements
const elements = {
    // Header
    userNameDisplay: document.getElementById('userName_display2'),
    userProfileImage: document.getElementById('imageProfile'),
    // Profile Header
    profileName: document.querySelector('.profile-name'),
    profileEmail: document.querySelector('.profile-email'),
    profileAvatar: document.getElementById('profilePhotoImg'),
    orderCount: document.querySelector('.stat-item:nth-child(1) .stat-value'),
    wishlistCount: document.querySelector('.stat-item:nth-child(2) .stat-value'),
    customOrdersCount: document.querySelector('.stat-item:nth-child(3) .stat-value'),
    // Form Fields
    firstName: document.getElementById('firstName'),
    lastName: document.getElementById('lastName'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    birthdate: document.getElementById('birthdate'),
    gender: document.getElementById('gender'),
    address: document.getElementById('address'),
    city: document.getElementById('city'),
    province: document.getElementById('province'),
    state: document.getElementById('state'),
    zipCode: document.getElementById('zipCode'),
    country: document.getElementById('country'),
    // Map Elements
    map: document.getElementById('map'),
    latitude: document.getElementById('latitude'),
    longitude: document.getElementById('longitude'),
    displayLatitude: document.getElementById('displayLatitude'),
    displayLongitude: document.getElementById('displayLongitude'),
    // Password Fields
    currentPassword: document.getElementById('currentPassword'),
    newPassword: document.getElementById('newPassword'),
    confirmPassword: document.getElementById('confirmPassword'),
    // Buttons
    logoutBtn: document.getElementById('logout_btn'),
    cancelBtn: document.querySelector('.btn-cancel'),
    saveBtn: document.querySelector('.btn-save'),
    avatarUpload: document.getElementById('profilePhotoUpload'),
    form: document.getElementById('profileForm')
};

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async function () {
    await initializePage();
});

async function initializePage() {
    const user = await checkUserAuth();
    
    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    userSession.userId = user.userId;
    userSession.userData = user.userData;
    userSession.role = user.role;

    loadCustomerProfile();
    setupEventListeners();
    setupPasswordToggleListeners();
    initializeMap();
    initializePasswordStrength();
    initializePasswordConfirmation();
    setupRealTimeValidation();
}

// Initialize Google Maps
function initializeMap() {
    if (!elements.map) {
        console.log('Map container not found');
        return;
    }

    // Default coordinates (Manila, Philippines)
    const defaultLat = 14.5995;
    const defaultLng = 120.9842;

    // Initialize the map
    map = new google.maps.Map(elements.map, {
        center: { lat: defaultLat, lng: defaultLng },
        zoom: 15,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
    });

    // Initialize marker
    marker = new google.maps.Marker({
        map: map,
        draggable: true,
        animation: google.maps.Animation.DROP,
        title: "Drag to set your location"
    });

    // Add click listener to map
    map.addListener('click', function(event) {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        updateMarkerPosition(lat, lng);
        updateCoordinatesDisplay(lat, lng);
        reverseGeocode(lat, lng);
    });

    // Add marker drag end listener
    marker.addListener('dragend', function(event) {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        updateCoordinatesDisplay(lat, lng);
        reverseGeocode(lat, lng);
    });

    console.log('Google Maps initialized');
}

// Update marker position
function updateMarkerPosition(lat, lng) {
    marker.setPosition({ lat: lat, lng: lng });
    map.panTo({ lat: lat, lng: lng });
}

// Update coordinates display
function updateCoordinatesDisplay(lat, lng) {
    if (elements.latitude) elements.latitude.value = lat;
    if (elements.longitude) elements.longitude.value = lng;
    if (elements.displayLatitude) elements.displayLatitude.textContent = lat.toFixed(6);
    if (elements.displayLongitude) elements.displayLongitude.textContent = lng.toFixed(6);
}

// Reverse geocode coordinates to address
function reverseGeocode(lat, lng) {
    const geocoder = new google.maps.Geocoder();
    const latlng = { lat: lat, lng: lng };

    geocoder.geocode({ location: latlng }, function(results, status) {
        if (status === 'OK' && results[0]) {
            const address = results[0].formatted_address;
            updateAddressFields(results[0]);
        } else {
            console.log('Geocoder failed due to: ' + status);
        }
    });
}

// Update address fields based on geocoding results
function updateAddressFields(geocodeResult) {
    let city = '';
    let province = '';
    let state = '';
    let zipCode = '';
    let country = '';

    // Parse address components
    geocodeResult.address_components.forEach(component => {
        const types = component.types;
        
        if (types.includes('locality')) {
            city = component.long_name;
        } else if (types.includes('administrative_area_level_2')) {
            province = component.long_name;
        }else if (types.includes('administrative_area_level_1')) {
            state = component.long_name;
        } else if (types.includes('postal_code')) {
            zipCode = component.long_name;
        } else if (types.includes('country')) {
            country = component.long_name;
        }
    });

    // Update form fields if they're empty or if we found better data
    if (city && elements.city) elements.city.value = city;
    if (province && elements.province) elements.province.value = province;
    if (state && elements.state) elements.state.value = state;
    if (zipCode && elements.zipCode) elements.zipCode.value = zipCode;
    if (country && elements.country) elements.country.value = country;
    if (elements.address) elements.address.value = geocodeResult.formatted_address;
}

// Load customer location on map
function loadCustomerLocation(customerData) {
    if (customerData.latitude && customerData.longitude) {
        const lat = parseFloat(customerData.latitude);
        const lng = parseFloat(customerData.longitude);
        
        updateMarkerPosition(lat, lng);
        updateCoordinatesDisplay(lat, lng);
        
        console.log('Loaded customer location:', { lat, lng });
    } else {
        // Try to geocode from address if coordinates not available
        if (customerData.address) {
            geocodeAddress(customerData.address);
        }
    }
}

// Geocode address to coordinates
function geocodeAddress(address) {
    const geocoder = new google.maps.Geocoder();
    
    geocoder.geocode({ address: address }, function(results, status) {
        if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            const lat = location.lat();
            const lng = location.lng();
            
            updateMarkerPosition(lat, lng);
            updateCoordinatesDisplay(lat, lng);
            
            console.log('Geocoded address to coordinates:', { lat, lng });
        } else {
            console.log('Geocode was not successful for the following reason: ' + status);
        }
    });
}

// Toggle password visibility
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const icon = field ? field.nextElementSibling : null;

    if (field && icon && icon.classList.contains('password-toggle-icon')) {
        if (field.type === 'password') {
            field.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
            icon.setAttribute('aria-label', 'Hide password');
        } else {
            field.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
            icon.setAttribute('aria-label', 'Show password');
        }
    } else {
        console.warn(`Password toggle failed: field or icon not found for ID ${fieldId}`);
    }
}

// Set up password toggle event listeners
function setupPasswordToggleListeners() {
    const toggleIcons = document.querySelectorAll('.password-toggle-icon');
    toggleIcons.forEach(icon => {
        const fieldId = icon.getAttribute('data-field-id');
        if (fieldId) {
            icon.addEventListener('click', () => togglePassword(fieldId));
            // Add keyboard support for accessibility
            icon.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    togglePassword(fieldId);
                    e.preventDefault();
                }
            });
        }
    });
}

function loadCustomerProfile() {
    const customerPath = `smartfit_AR_Database/customers/${userSession.userId}`;
    
    const unsubscribe = readDataRealtime(customerPath, (result) => {
        if (result.success && result.data) {
            customerData = result.data;
            
            // ADDED: Console log for customer data
            console.log('Customer Data Retrieved:', customerData);
            console.log('Customer ID:', userSession.userId);
            console.log('Full Customer Object:', JSON.stringify(customerData, null, 2));
            
            originalEmail = customerData.email || '';

            // Update UI with customer data
            updateHeader(customerData);
            updateProfileSection(customerData);
            updateFormFields(customerData);
            
            // Load customer location on map
            loadCustomerLocation(customerData);

            // Load statistics
            loadCustomerStatistics();
        } else {
            console.error('Customer data not found');
            window.location.href = '/login.html';
        }
    });

    // Store unsubscribe for cleanup if needed
    window.customerProfileUnsubscribe = unsubscribe;
}

function updateHeader(customerData) {
    // Customer Name
    if (customerData.firstName || customerData.lastName) {
        elements.userNameDisplay.textContent = `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim();
    }

    // Profile Image
    if (customerData.profilePhoto) {
        elements.userProfileImage.src = customerData.profilePhoto;
    } else {
        setDefaultAvatar(elements.userProfileImage);
    }
}

function updateProfileSection(customerData) {
    // Customer Name
    if (customerData.firstName || customerData.lastName) {
        elements.profileName.textContent = `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim();
    }

    // Email
    if (customerData.email) {
        elements.profileEmail.textContent = customerData.email;
    }

    // Avatar
    if (customerData.profilePhoto) {
        elements.profileAvatar.src = customerData.profilePhoto;
    } else {
        setDefaultAvatar(elements.profileAvatar);
    }
}

function updateFormFields(customerData) {
    // Personal Info
    if (customerData.firstName) elements.firstName.value = customerData.firstName;
    if (customerData.lastName) elements.lastName.value = customerData.lastName;
    if (customerData.email) elements.email.value = customerData.email;
    if (customerData.phone) elements.phone.value = customerData.phone;
    if (customerData.birthday) elements.birthdate.value = customerData.birthday;
    if (customerData.gender) elements.gender.value = customerData.gender;

    // Address Info
    if (customerData.address) elements.address.value = customerData.address;
    if (customerData.city) elements.city.value = customerData.city;
    if (customerData.state) elements.state.province = customerData.province;
    if (customerData.state) elements.state.value = customerData.state;
    if (customerData.zip) elements.zipCode.value = customerData.zip;
    if (customerData.country) elements.country.value = customerData.country;
    
    // Coordinates
    if (customerData.latitude && customerData.longitude) {
        if (elements.latitude) elements.latitude.value = customerData.latitude;
        if (elements.longitude) elements.longitude.value = customerData.longitude;
        if (elements.displayLatitude) elements.displayLatitude.textContent = parseFloat(customerData.latitude).toFixed(6);
        if (elements.displayLongitude) elements.displayLongitude.textContent = parseFloat(customerData.longitude).toFixed(6);
    }
}

function loadCustomerStatistics() {
    // Order Count
    const ordersPath = `smartfit_AR_Database/transactions/${userSession.userId}`;
    
    const ordersUnsubscribe = readDataRealtime(ordersPath, (result) => {
        let orderCount = 0;
        if (result.success && result.data) {
            orderCount = Object.keys(result.data).length;
        }
        if (elements.orderCount) {
            elements.orderCount.textContent = orderCount;
        }
    });

    // Wishlist Count
    const wishlistPath = `smartfit_AR_Database/wishlist/${userSession.userId}`;
    
    const wishlistUnsubscribe = readDataRealtime(wishlistPath, (result) => {
        let wishlistCount = 0;
        if (result.success && result.data) {
            // Count all wishlist items across all shops
            const wishlistData = result.data;
            Object.keys(wishlistData).forEach(shopId => {
                const shopItems = wishlistData[shopId];
                wishlistCount += Object.keys(shopItems).length;
            });
        }
        if (elements.wishlistCount) {
            elements.wishlistCount.textContent = wishlistCount;
        }
    });

    // Custom Orders Count
    const customOrdersPath = `smartfit_AR_Database/customizedtransactions/${userSession.userId}`;
    
    const customOrdersUnsubscribe = readDataRealtime(customOrdersPath, (result) => {
        let customOrdersCount = 0;
        if (result.success && result.data) {
            customOrdersCount = Object.keys(result.data).length;
        }
        if (elements.customOrdersCount) {
            elements.customOrdersCount.textContent = customOrdersCount;
        }
    });

    // Store unsubscribes for cleanup
    window.ordersUnsubscribe = ordersUnsubscribe;
    window.wishlistUnsubscribe = wishlistUnsubscribe;
    window.customOrdersUnsubscribe = customOrdersUnsubscribe;
}

function setupEventListeners() {
    // Logout functionality
    const logoutBtn = getElement('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
            if (confirm('Are you sure you want to logout?')) {
                const result = await logoutUser();
                if (result.success) {
                    window.location.href = '/login.html';
                } else {
                    console.error('Error signing out:', result.error);
                }
            }
        });
    }

    // Avatar upload
    if (elements.avatarUpload) {
        elements.avatarUpload.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                avatarFile = file;
                const reader = new FileReader();
                reader.onload = function (e) {
                    if (elements.profileAvatar) elements.profileAvatar.src = e.target.result;
                    if (elements.userProfileImage) elements.userProfileImage.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Form submission
    if (elements.form) {
        elements.form.addEventListener('submit', async function (e) {
            e.preventDefault();

            try {
                showLoading(true);
                
                // Clear previous errors
                clearFieldErrors();
                
                // Validate form fields
                const validationErrors = validateFormFields();
                if (validationErrors.length > 0) {
                    throw new Error(validationErrors.join('\n'));
                }

                const updates = {};
                let passwordChanged = false;

                // Check if password changed
                if (elements.newPassword.value) {
                    passwordChanged = await changePassword(
                        elements.currentPassword.value,
                        elements.newPassword.value,
                        elements.confirmPassword.value
                    );
                }

                // Update customer data
                updates.firstName = elements.firstName.value;
                updates.lastName = elements.lastName.value;
                updates.phone = elements.phone.value;
                updates.birthday = elements.birthdate.value;
                updates.gender = elements.gender.value;
                updates.address = elements.address.value;
                updates.city = elements.city.value;
                updates.province = elements.province.value;
                updates.state = elements.state.value;
                updates.zip = elements.zipCode.value;
                updates.country = elements.country.value;
                
                // Add coordinates if available
                if (elements.latitude.value && elements.longitude.value) {
                    updates.latitude = elements.latitude.value;
                    updates.longitude = elements.longitude.value;
                    updates.locationVerified = true;
                }

                // Upload avatar if changed
                if (avatarFile) {
                    const oldUrl = customerData.profilePhoto || null;
                    const avatarUrl = await uploadFile(userSession.userId, avatarFile, 'profilePhoto', oldUrl);
                    updates.profilePhoto = avatarUrl;
                }

                const customerPath = `smartfit_AR_Database/customers/${userSession.userId}`;
                const result = await updateProfileMethod(userSession.userId, updates, customerPath);
                
                if (!result.success) {
                    throw new Error(result.error);
                }

                // Update UI
                if (elements.profileName) {
                    elements.profileName.textContent = `${elements.firstName.value} ${elements.lastName.value}`;
                }
                if (elements.profileEmail) {
                    elements.profileEmail.textContent = elements.email.value;
                }
                if (elements.userNameDisplay) {
                    elements.userNameDisplay.textContent = `${elements.firstName.value} ${elements.lastName.value}`;
                }

                if (passwordChanged) {
                    if (elements.currentPassword) elements.currentPassword.value = '';
                    if (elements.newPassword) elements.newPassword.value = '';
                    if (elements.confirmPassword) elements.confirmPassword.value = '';
                }

                showAlert('Profile updated successfully!', 'success');

            } catch (error) {
                console.error('Error updating profile:', error);
                showAlert(error.message, 'error');
                
                // Scroll to first error field
                const firstErrorField = document.querySelector('[style*="border-color: var(--error)"]');
                if (firstErrorField) {
                    firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstErrorField.focus();
                }
            } finally {
                showLoading(false);
            }
        });
    }

    // Cancel button
    if (elements.cancelBtn) {
        elements.cancelBtn.addEventListener('click', function () {
            if (confirm('Are you sure you want to discard your changes?')) {
                window.location.reload();
            }
        });
    }

    // Logout functionality
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
}

function setDefaultAvatar(imgElement) {
    if (!imgElement) return;
    imgElement.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
}

function showLoading(show) {
    const loadingOverlay = getElement('loadingOverlay');

    if (show) {
        if (!loadingOverlay) {
            const overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.zIndex = '1000';

            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            spinner.style.border = '5px solid #f3f3f3';
            spinner.style.borderTop = '5px solid #3498db';
            spinner.style.borderRadius = '50%';
            spinner.style.width = '50px';
            spinner.style.height = '50px';
            spinner.style.animation = 'spin 1s linear infinite';

            overlay.appendChild(spinner);
            document.body.appendChild(overlay);
        }
    } else {
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }
}

function showAlert(message, type) {
    // Remove any existing alerts first
    const existingAlert = document.querySelector('.custom-alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = 'custom-alert';
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.padding = '15px 20px';
    alertDiv.style.borderRadius = '5px';
    alertDiv.style.color = 'white';
    alertDiv.style.zIndex = '1000';
    alertDiv.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    alertDiv.style.animation = 'slideIn 0.3s ease-out';

    if (type === 'success') {
        alertDiv.style.backgroundColor = '#4CAF50';
    } else if (type === 'error') {
        alertDiv.style.backgroundColor = '#F44336';
    } else if (type === 'info') {
        alertDiv.style.backgroundColor = '#2196F3';
    }

    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            alertDiv.remove();
        }, 300);
    }, 3000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Helper function for file uploads
async function uploadFile(userId, file, type, oldUrl = null) {
    try {
        // Delete old file if it exists
        if (oldUrl) {
            try {
                const oldImagePath = getPathFromUrl(oldUrl);
                if (oldImagePath) {
                    const deleteResult = await deleteImageFromFirebase(oldImagePath);
                    if (deleteResult.success) {
                        console.log('Old file deleted successfully');
                    } else {
                        console.log('Could not delete old file:', deleteResult.error);
                    }
                }
            } catch (error) {
                console.log('No old file to delete or error deleting:', error);
            }
        }

        // Upload new file
        const filePath = `customerProfile/${userId}/${type}_${Date.now()}_${file.name}`;
        const uploadResult = await createImageToFirebase(file, filePath);
        
        if (uploadResult.success) {
            console.log(`File uploaded successfully: ${filePath}`);
            return uploadResult.url;
        } else {
            throw new Error(uploadResult.error);
        }
    } catch (error) {
        console.error('Error in uploadFile:', error);
        throw error;
    }
}

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

// WORKING PASSWORD CHANGE FUNCTION
async function changePassword(currentPassword, newPassword, confirmPassword) {
    try {
        // Validate inputs
        if (!currentPassword) {
            throw new Error('Current password is required');
        }
        
        if (!newPassword) {
            throw new Error('New password is required');
        }
        
        if (newPassword !== confirmPassword) {
            throw new Error('New passwords do not match');
        }
        
        if (newPassword.length < 6) {
            throw new Error('New password must be at least 6 characters long');
        }

        const currentEmail = customerData.email;

        if (!currentEmail) {
            throw new Error('Unable to determine user email');
        }

        console.log('Attempting to change password for:', currentEmail);

        // First, reauthenticate the user by signing in again
        console.log('Reauthenticating user...');
        const reauthResult = await signInWithEmailAndPasswordWrapper(currentEmail, currentPassword);
        
        if (!reauthResult.success) {
            throw new Error('Current password is incorrect. Please try again.');
        }

        console.log('Reauthentication successful, changing password...');

        // Now change the password using the Firebase method
        const changeResult = await changeUserPassword(newPassword);
        
        if (!changeResult.success) {
            throw new Error(changeResult.error || 'Failed to change password');
        }

        console.log('Password changed successfully');
        showAlert('Password changed successfully!', 'success');
        return true;

    } catch (error) {
        console.error('Error changing password:', error);
        
        // Provide more specific error messages
        if (error.message.includes('auth/wrong-password')) {
            throw new Error('Current password is incorrect. Please try again.');
        } else if (error.message.includes('auth/requires-recent-login')) {
            throw new Error('For security reasons, please log out and log back in before changing your password.');
        } else if (error.message.includes('auth/weak-password')) {
            throw new Error('New password is too weak. Please choose a stronger password.');
        } else {
            throw new Error(error.message || 'Failed to change password. Please try again.');
        }
    }
}

// Initialize password strength indicator
function initializePasswordStrength() {
    const passwordInput = document.getElementById('newPassword');
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
        if (reqLength) {
            reqLength.classList.toggle('valid', hasLength);
        }
        if (hasLength) strength++;
        
        // Check uppercase
        const hasUppercase = /[A-Z]/.test(password);
        if (reqUppercase) {
            reqUppercase.classList.toggle('valid', hasUppercase);
        }
        if (hasUppercase) strength++;
        
        // Check number
        const hasNumber = /\d/.test(password);
        if (reqNumber) {
            reqNumber.classList.toggle('valid', hasNumber);
        }
        if (hasNumber) strength++;
        
        // Check special character
        const hasSpecial = /[^a-zA-Z0-9]/.test(password);
        if (reqSpecial) {
            reqSpecial.classList.toggle('valid', hasSpecial);
        }
        if (hasSpecial) strength++;
        
        // Update strength bars
        strengthBars.forEach((bar, index) => {
            bar.classList.toggle('active', index < strength);
        });
        
        // Update text and color
        if (strengthText) {
            let strengthLevel = 'Weak';
            let strengthClass = 'strength-weak';
            
            if (strength <= 1) {
                strengthLevel = 'Weak';
                strengthClass = 'strength-weak';
            } else if (strength === 2) {
                strengthLevel = 'Fair';
                strengthClass = 'strength-fair';
            } else if (strength === 3) {
                strengthLevel = 'Good';
                strengthClass = 'strength-good';
            } else {
                strengthLevel = 'Strong';
                strengthClass = 'strength-strong';
            }
            
            strengthText.textContent = `Password strength: ${strengthLevel}`;
            strengthText.className = `strength-text ${strengthClass}`;
        }
    });
}

// Initialize password confirmation validation
function initializePasswordConfirmation() {
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    if (!newPasswordInput || !confirmPasswordInput) return;
    
    // Create confirmation message element
    const confirmationElement = document.createElement('div');
    confirmationElement.className = 'password-match';
    confirmationElement.textContent = 'Passwords match';
    confirmPasswordInput.parentNode.appendChild(confirmationElement);
    
    function validatePasswordMatch() {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        if (confirmPassword === '') {
            confirmationElement.style.display = 'none';
            return;
        }
        
        confirmationElement.style.display = 'flex';
        
        if (newPassword === confirmPassword && newPassword !== '') {
            confirmationElement.classList.remove('invalid');
            confirmationElement.classList.add('valid');
            confirmationElement.textContent = 'Passwords match';
        } else {
            confirmationElement.classList.remove('valid');
            confirmationElement.classList.add('invalid');
            confirmationElement.textContent = 'Passwords do not match';
        }
    }
    
    newPasswordInput.addEventListener('input', validatePasswordMatch);
    confirmPasswordInput.addEventListener('input', validatePasswordMatch);
}

// Add this validation function
function validateFormFields() {
    const errors = [];
    
    // Required text fields
    const requiredFields = [
        { id: 'firstName', name: 'First Name' },
        { id: 'lastName', name: 'Last Name' },
        { id: 'phone', name: 'Phone Number' },
        { id: 'birthdate', name: 'Date of Birth' },
        { id: 'address', name: 'Address' },
        { id: 'city', name: 'City' },
        { id: 'province', name: 'Province' },
        { id: 'state', name: 'Region' },
        { id: 'zipCode', name: 'ZIP Code' },
        { id: 'country', name: 'Country' }
    ];

    // Validate required fields
    requiredFields.forEach(({ id, name }) => {
        const field = getElement(id);
        if (!field || !field.value.trim()) {
            errors.push(`${name} is required`);
            // Add visual error state
            field.style.borderColor = 'var(--error)';
            field.style.boxShadow = '0 0 0 2px rgba(255, 107, 107, 0.2)';
        } else {
            // Remove error state if valid
            field.style.borderColor = '';
            field.style.boxShadow = '';
        }
    });

    // Validate phone number format (if provided)
    const phoneField = getElement('phone');
    if (phoneField && phoneField.value.trim()) {
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phoneField.value.replace(/\D/g, ''))) {
            errors.push('Phone number must be exactly 10 digits');
            phoneField.style.borderColor = 'var(--error)';
            phoneField.style.boxShadow = '0 0 0 2px rgba(255, 107, 107, 0.2)';
        }
    }

    // Validate ZIP code format (if provided)
    const zipField = getElement('zipCode');
    if (zipField && zipField.value.trim()) {
        const zipRegex = /^\d{4}$/;
        if (!zipRegex.test(zipField.value)) {
            errors.push('ZIP code must be exactly 4 digits');
            zipField.style.borderColor = 'var(--error)';
            zipField.style.boxShadow = '0 0 0 2px rgba(255, 107, 107, 0.2)';
        }
    }

    // Validate birthdate (if provided)
    const birthdateField = getElement('birthdate');
    if (birthdateField && birthdateField.value) {
        const birthDate = new Date(birthdateField.value);
        const today = new Date();
        const minAgeDate = new Date();
        minAgeDate.setFullYear(today.getFullYear() - 13); // Minimum age 13 years
        
        if (birthDate > minAgeDate) {
            errors.push('You must be at least 13 years old');
            birthdateField.style.borderColor = 'var(--error)';
            birthdateField.style.boxShadow = '0 0 0 2px rgba(255, 107, 107, 0.2)';
        }
    }

    // Validate coordinates (if map is implemented)
    if (elements.latitude && elements.longitude) {
        const latitude = elements.latitude.value;
        const longitude = elements.longitude.value;
        if (!latitude || !longitude) {
            errors.push('Please set your location on the map by clicking on your address');
        }
    }

    return errors;
}

// Add this function to clear error states
function clearFieldErrors() {
    const fieldsToClear = [
        'firstName', 'lastName', 'phone', 'birthdate', 
        'address', 'city','province', 'state', 'zipCode', 'country'
    ];
    
    fieldsToClear.forEach(fieldId => {
        const field = getElement(fieldId);
        if (field) {
            field.style.borderColor = '';
            field.style.boxShadow = '';
        }
    });
}

// Add real-time validation for better UX
function setupRealTimeValidation() {
    const fieldsToValidate = [
        'firstName', 'lastName', 'phone', 'birthdate', 
        'address', 'city','province', 'state', 'zipCode', 'country'
    ];
    
    fieldsToValidate.forEach(fieldId => {
        const field = getElement(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                // Clear error state when user starts typing
                if (this.value.trim()) {
                    this.style.borderColor = '';
                    this.style.boxShadow = '';
                }
            });
            
            // For specific field validations
            if (fieldId === 'phone') {
                field.addEventListener('input', function() {
                    this.value = this.value.replace(/\D/g, '');
                    if (this.value.length > 10) {
                        this.value = this.value.slice(0, 10);
                    }
                });
            }
            
            if (fieldId === 'zipCode') {
                field.addEventListener('input', function() {
                    this.value = this.value.replace(/\D/g, '');
                    if (this.value.length > 4) {
                        this.value = this.value.slice(0, 4);
                    }
                });
            }
        }
    });
}

// Handle logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        const result = await logoutUser();
        if (result.success) {
            window.location.href = "/login.html";
        } else {
            alert('Logout failed: ' + result.error);
        }
    }
}

// Cleanup function if needed
function cleanup() {
    if (window.customerProfileUnsubscribe) window.customerProfileUnsubscribe();
    if (window.ordersUnsubscribe) window.ordersUnsubscribe();
    if (window.wishlistUnsubscribe) window.wishlistUnsubscribe();
    if (window.customOrdersUnsubscribe) window.customOrdersUnsubscribe();
}

// Export for potential cleanup
window.cleanupCustomerProfile = cleanup;