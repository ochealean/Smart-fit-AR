// customerprofile.js - Refactored to use firebaseMethods only
import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    updateData,
    createImageToFirebase,
    deleteImageFromFirebase,
    updateImageInFirebase,
    updateProfileMethod,
    sendEmailVerificationWrapper,
    changeUserPassword
} from "../../firebaseMethods.js";

// State variables
let avatarFile = null;
let customerData = {};
let originalEmail = '';

// DOM Elements
const elements = {
    // Header
    userNameDisplay: document.getElementById('userName_display2'),
    userProfileImage: document.getElementById('imageProfile'),

    // Profile Header
    profileName: document.querySelector('.profile-name'),
    profileEmail: document.querySelector('.profile-email'),
    profileAvatar: document.getElementById('profilePhotoImg'),
    wishlistCount: document.querySelector('.stat-item .stat-value'),

    // Form Fields
    firstName: document.getElementById('firstName'),
    lastName: document.getElementById('lastName'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    birthdate: document.getElementById('birthdate'),
    address: document.getElementById('address'),
    city: document.getElementById('city'),
    province: document.getElementById('province'),
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

    // Set user session data
    window.userSession = {
        userId: user.userId,
        userData: user.userData
    };

    loadCustomerProfile(user.userId);
    setupEventListeners();
    setupPasswordToggles();
    setupPasswordValidation();
}

function loadCustomerProfile(userId) {
    const customerPath = `smartfit_AR_Database/customers/${userId}`;
    
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
            loadCustomerStatistics(userId);
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
    if (customerData.profilePhoto?.profilePhoto?.url) {
        elements.userProfileImage.src = customerData.profilePhoto.profilePhoto.url;
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
    if (customerData.profilePhoto?.profilePhoto?.url) {
        elements.profileAvatar.src = customerData.profilePhoto.profilePhoto.url;
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

    // Address Info
    if (customerData.address) elements.address.value = customerData.address;
    if (customerData.city) elements.city.value = customerData.city;
    if (customerData.state) elements.province.value = customerData.state;
    if (customerData.zip) elements.zipCode.value = customerData.zip;
    if (customerData.country) elements.country.value = customerData.country;
}

function loadCustomerStatistics(userId) {
    // Wishlist Count
    const wishlistPath = `smartfit_AR_Database/wishlist/${userId}`;
    
    const unsubscribe = readDataRealtime(wishlistPath, (result) => {
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

    // Store unsubscribe for cleanup if needed
    window.wishlistUnsubscribe = unsubscribe;
}

function setupPasswordToggles() {
    function setupPasswordToggle(inputId, toggleId) {
        const passwordInput = getElement(inputId);
        const toggleIcon = getElement(toggleId);

        if (!passwordInput || !toggleIcon) return;

        toggleIcon.addEventListener('click', function () {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.classList.remove('fa-eye');
                toggleIcon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
            }
        });
    }

    setupPasswordToggle('currentPassword', 'toggleCurrentPassword');
    setupPasswordToggle('newPassword', 'toggleNewPassword');
    setupPasswordToggle('confirmPassword', 'toggleConfirmPassword');
}

function setupEventListeners() {
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
                const user = await checkUserAuth();
                if (!user.authenticated) {
                    throw new Error('User not authenticated');
                }

                const updates = {};
                let passwordChanged = false;
                let profileUpdated = false;

                // Handle password change if provided
                if (elements.newPassword.value) {
                    passwordChanged = await changePassword(
                        elements.currentPassword.value,
                        elements.newPassword.value,
                        elements.confirmPassword.value
                    );
                }

                // Update profile data if any changes detected
                if (elements.firstName.value !== customerData.firstName ||
                    elements.lastName.value !== customerData.lastName ||
                    elements.phone.value !== customerData.phone ||
                    elements.birthdate.value !== customerData.birthday ||
                    elements.address.value !== customerData.address ||
                    elements.city.value !== customerData.city ||
                    elements.province.value !== customerData.state ||
                    elements.zipCode.value !== customerData.zip ||
                    elements.country.value !== customerData.country ||
                    avatarFile) {

                    updates.firstName = elements.firstName.value;
                    updates.lastName = elements.lastName.value;
                    updates.phone = elements.phone.value;
                    updates.birthday = elements.birthdate.value;
                    updates.address = elements.address.value;
                    updates.city = elements.city.value;
                    updates.state = elements.province.value;
                    updates.zip = elements.zipCode.value;
                    updates.country = elements.country.value;

                    // Upload avatar if changed
                    if (avatarFile) {
                        const oldUrl = customerData.profilePhoto?.profilePhoto?.url || null;
                        const avatarUrl = await uploadFile(user.userId, avatarFile, 'customerProfile', oldUrl);

                        updates.profilePhoto = {
                            profilePhoto: {
                                name: avatarFile.name,
                                url: avatarUrl,
                                uploadedAt: new Date().toISOString()
                            }
                        };
                    }

                    const profilePath = `smartfit_AR_Database/customers/${user.userId}`;
                    const result = await updateProfileMethod(user.userId, updates, profilePath);
                    
                    if (!result.success) {
                        throw new Error(result.error);
                    }
                    
                    profileUpdated = true;
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

                // Clear password fields if password was changed successfully
                if (passwordChanged) {
                    if (elements.currentPassword) elements.currentPassword.value = '';
                    if (elements.newPassword) elements.newPassword.value = '';
                    if (elements.confirmPassword) elements.confirmPassword.value = '';
                }

                // Show appropriate success message
                if (passwordChanged && profileUpdated) {
                    showAlert('Profile and password updated successfully!', 'success');
                } else if (passwordChanged) {
                    showAlert('Password updated successfully!', 'success');
                } else if (profileUpdated) {
                    showAlert('Profile updated successfully!', 'success');
                } else {
                    showAlert('No changes detected.', 'info');
                }

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

function setupPasswordValidation() {
    const newPassword = getElement('newPassword');
    const confirmPassword = getElement('confirmPassword');
    const currentPassword = getElement('currentPassword');
    
    if (!newPassword || !confirmPassword) return;
    
    const passwordError = document.createElement('div');
    passwordError.style.color = 'var(--error)';
    passwordError.style.fontSize = '0.8rem';
    passwordError.style.marginTop = '0.25rem';
    passwordError.style.display = 'none';
    
    confirmPassword.parentNode.appendChild(passwordError);
    
    function validatePasswords() {
        // Reset styles
        newPassword.style.borderColor = '';
        confirmPassword.style.borderColor = '';
        passwordError.style.display = 'none';
        
        if (newPassword.value && confirmPassword.value) {
            if (newPassword.value.length < 6) {
                passwordError.textContent = 'Password must be at least 6 characters';
                passwordError.style.display = 'block';
                newPassword.style.borderColor = 'var(--error)';
                confirmPassword.style.borderColor = 'var(--error)';
                return false;
            } else if (newPassword.value !== confirmPassword.value) {
                passwordError.textContent = 'Passwords do not match';
                passwordError.style.display = 'block';
                confirmPassword.style.borderColor = 'var(--error)';
                return false;
            } else {
                passwordError.style.display = 'none';
                newPassword.style.borderColor = 'var(--success)';
                confirmPassword.style.borderColor = 'var(--success)';
                return true;
            }
        }
        return null;
    }
    
    // Add current password requirement when new password is entered
    function checkCurrentPasswordRequirement() {
        if (newPassword.value && !currentPassword.value) {
            currentPassword.style.borderColor = 'var(--error)';
        } else {
            currentPassword.style.borderColor = '';
        }
    }
    
    newPassword.addEventListener('input', function() {
        validatePasswords();
        checkCurrentPasswordRequirement();
    });
    
    confirmPassword.addEventListener('input', validatePasswords);
    currentPassword.addEventListener('input', checkCurrentPasswordRequirement);
}

// Add this function to handle password changes
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
        
        // Change password with current password verification
        const result = await changeUserPassword(currentPassword, newPassword);
        
        if (result.success) {
            return true;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error changing password:', error);
        throw error;
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
    if (window.customerProfileUnsubscribe) {
        window.customerProfileUnsubscribe();
    }
    if (window.wishlistUnsubscribe) {
        window.wishlistUnsubscribe();
    }
}

// Export for potential cleanup
window.cleanupCustomerProfile = cleanup;