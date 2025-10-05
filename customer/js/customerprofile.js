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

// DOM Elements
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
    state: document.getElementById('state'),
    zipCode: document.getElementById('zipCode'),
    country: document.getElementById('country'),
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
            console.log('Customer Data:', customerData);
            originalEmail = customerData.email || '';

            // Update UI with customer data
            updateHeader(customerData);
            updateProfileSection(customerData);
            updateFormFields(customerData);

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
    if (customerData.state) elements.state.value = customerData.state;
    if (customerData.zip) elements.zipCode.value = customerData.zip;
    if (customerData.country) elements.country.value = customerData.country;
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
                updates.state = elements.state.value;
                updates.zip = elements.zipCode.value;
                updates.country = elements.country.value;

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