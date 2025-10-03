import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    readData
} from "../../firebaseMethods.js";

// DOM Elements
const serialNumberInput = document.getElementById('serialNumber');
const validateBtn = document.getElementById('validateBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const resultsContainer = document.getElementById('resultsContainer');
const resultSerial = document.getElementById('resultSerial');
const resultModel = document.getElementById('resultModel');
const resultShop = document.getElementById('resultShop');
const resultStatus = document.getElementById('resultStatus');
const resultDate = document.getElementById('resultDate');
const resultValidatedDate = document.getElementById('resultValidatedDate');
const resultFrontImage = document.getElementById('resultFrontImage');
const resultBackImage = document.getElementById('resultBackImage');
const resultTopImage = document.getElementById('resultTopImage');
const resultReason = document.getElementById('resultReason');
const reasonSection = document.getElementById('reasonSection');

// Global variables
let userSession = {
    userId: null,
    userData: null
};

// Hide body until authenticated and hide results container by default
document.body.style.display = 'none';
resultsContainer.style.display = 'none';

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
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

    // Set user information
    setUserProfile();
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Check for URL parameter with serial number
    checkUrlParameter();
}

// Set user profile information
function setUserProfile() {
    const userNameDisplay = getElement('userName_display2');
    const userAvatar = getElement('imageProfile');
    
    if (userSession.userData) {
        if (userSession.userData.firstName && userSession.userData.lastName) {
            userNameDisplay.textContent = `${userSession.userData.firstName} ${userSession.userData.lastName}`;
        } else if (userSession.userData.name) {
            userNameDisplay.textContent = userSession.userData.name;
        } else {
            userNameDisplay.textContent = "User";
        }
        
        // Set user avatar if available
        if (userSession.userData.profilePhoto) {
            userAvatar.src = userSession.userData.profilePhoto;
        } else {
            userAvatar.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        }
    }
    
    // Show the body now that we're authenticated
    document.body.style.display = '';
}

// Check for URL parameter with serial number
function checkUrlParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const shoeSerialNumber = urlParams.get('ShoeSerialNumber');
    
    if (shoeSerialNumber) {
        // Set the input value
        serialNumberInput.value = shoeSerialNumber;
        
        // Automatically trigger validation after a short delay
        setTimeout(() => {
            validateShoe();
        }, 500);
    }
}

// Initialize all event listeners
function initializeEventListeners() {
    // Mobile sidebar toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (mobileToggle && sidebar && overlay) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Validate button click
    validateBtn.addEventListener('click', validateShoe);

    // Enter key press in serial number input
    serialNumberInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            validateShoe();
        }
    });

    // Logout functionality
    getElement('logout_btn').addEventListener('click', handleLogout);
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

// Validate shoe function
async function validateShoe() {
    const serialNumber = serialNumberInput.value.trim();
    
    // Validate input
    if (!serialNumber) {
        showError('Please enter a serial number');
        return;
    }
    
    // Show loading spinner
    loadingSpinner.style.display = 'block';
    errorMessage.style.display = 'none';
    resultsContainer.style.display = 'none';
    
    try {
        // Query the database for shoe verifications
        const validationsPath = 'smartfit_AR_Database/shoeVerification';
        
        const result = await readData(validationsPath);
        
        if (result.success && result.data) {
            // Manually search for the serial number
            const allValidations = result.data;
            let foundValidation = null;
            
            for (const key in allValidations) {
                if (allValidations[key].serialNumber === serialNumber) {
                    foundValidation = allValidations[key];
                    break;
                }
            }
            
            if (foundValidation) {
                await displayValidationResults(foundValidation);
            } else {
                showError('No validation record found for this serial number');
            }
        } else {
            showError('No validation records found in database');
        }
    } catch (error) {
        console.error('Error validating shoe:', error);
        showError('An error occurred while validating the shoe. Please try again.');
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// Display validation results
async function displayValidationResults(validationData) {
    // Update the UI with validation data
    resultSerial.textContent = validationData.serialNumber || 'N/A';
    resultModel.textContent = validationData.shoeModel || 'N/A';
    
    // Get shop name from shop data if available
    if (validationData.shopId) {
        const shopName = await getShopName(validationData.shopId);
        resultShop.textContent = shopName || validationData.shopId;
    } else {
        resultShop.textContent = 'N/A';
    }
    
    resultDate.textContent = formatDate(validationData.submittedDate) || 'N/A';
    resultValidatedDate.textContent = formatDate(validationData.validatedDate) || 'Pending';
    
    // Set status with appropriate badge class
    const status = validationData.status || 'pending';
    resultStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    resultStatus.className = 'status-badge ';
    
    switch(status.toLowerCase()) {
        case 'approved':
        case 'verified':
        case 'legit':
            resultStatus.classList.add('status-legit');
            break;
        case 'rejected':
        case 'fake':
        case 'invalid':
            resultStatus.classList.add('status-fake');
            break;
        default:
            resultStatus.classList.add('status-pending');
    }
    
    // Set images
    if (validationData.images) {
        resultFrontImage.src = validationData.images.front || 
                              'https://cdn-icons-png.flaticon.com/512/11542/11542598.png';
        resultBackImage.src = validationData.images.back || 
                             'https://cdn-icons-png.flaticon.com/512/11542/11542598.png';
        resultTopImage.src = validationData.images.top || 
                            'https://cdn-icons-png.flaticon.com/512/11542/11542598.png';
    } else {
        // Use placeholder images if no images are available
        resultFrontImage.src = 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png';
        resultBackImage.src = 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png';
        resultTopImage.src = 'https://cdn-icons-png.flaticon.com/512/11542/11542598.png';
    }
    
    // Set validation reason/notes
    const reason = validationData.validationNotes || validationData.reason || validationData.notes;
    if (reason) {
        resultReason.textContent = reason;
        reasonSection.style.display = 'block';
    } else {
        reasonSection.style.display = 'none';
    }
    
    // Show results container
    resultsContainer.style.display = 'block';
}

// Get shop name from shop ID
async function getShopName(shopId) {
    try {
        const shopPath = `smartfit_AR_Database/shop/${shopId}`;
        const result = await readData(shopPath);
        
        if (result.success && result.data) {
            const shopData = result.data;
            return shopData.shopName || shopData.ownerName || shopId;
        }
        return shopId; // Return ID if shop data not found
    } catch (error) {
        console.error('Error fetching shop data:', error);
        return shopId;
    }
}

// Show error message
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    resultsContainer.style.display = 'none';
}

// Format date function
function formatDate(timestamp) {
    if (!timestamp) return null;
    
    // Handle both timestamp objects and date strings
    let date;
    if (typeof timestamp === 'object' && timestamp.seconds) {
        // Firebase timestamp object
        date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string') {
        // ISO string or other date string
        date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
        // Unix timestamp
        date = new Date(timestamp);
    } else {
        return null;
    }
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Expose functions to global scope if needed
window.validateShoe = validateShoe;