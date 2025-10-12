// shopprofile.js - Refactored to use firebaseMethods only
import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    createImageToFirebase,
    deleteImageFromFirebase,
    updateProfileMethod,
    changeUserPassword,
    signInWithEmailAndPasswordWrapper,
    updateData,
    updateImageInFirebase,
    sendPasswordResetEmailWrapper,
    reauthenticateUser
} from "../../firebaseMethods.js";

// State variables
let avatarFile = null;
let licenseFile = null;
let permitFile = null;
let birFile = null;
let dtiFile = null;
let frontIdFile = null;
let backIdFile = null;
let shopData = {};
let originalEmail = '';
let userSession = {
    userId: null,
    userData: null,
    role: null,
    shopId: null
};

let map;
let marker;

// DOM Elements
const elements = {
    // Header
    userNameDisplay: document.getElementById('userName_display2'),
    userProfileImage: document.getElementById('imageProfile'),

    // Profile Header
    profileName: document.querySelector('.profile-name'),
    profileEmail: document.querySelector('.profile-email'),
    profileAvatar: document.getElementById('shopLogoImg'),
    orderCount: document.querySelector('.stat-item:nth-child(1) .stat-value'),
    productCount: document.querySelector('.stat-item:nth-child(2) .stat-value'),
    ratingValue: document.querySelector('.stat-item:nth-child(3) .stat-value'),

    // Form Fields
    shopName: document.getElementById('shopName'),
    shopCategory: document.getElementById('shopCategory'),
    shopDescription: document.getElementById('shopDescription'),
    ownerName: document.getElementById('ownerName'),
    ownerEmail: document.getElementById('ownerEmail'),
    ownerPhone: document.getElementById('ownerPhone'),
    website: document.getElementById('website'),
    shopAddress: document.getElementById('shopAddress'),
    shopCity: document.getElementById('shopCity'),
    shopState: document.getElementById('shopState'),
    shopZip: document.getElementById('shopZip'),
    shopCountry: document.getElementById('shopCountry'),
    taxId: document.getElementById('taxId'),

    // Map
    map: document.getElementById('map'),
    latitude: document.getElementById('latitude'),
    longitude: document.getElementById('longitude'),
    displayLatitude: document.getElementById('displayLatitude'),
    displayLongitude: document.getElementById('displayLongitude'),

    // Documents
    businessLicensePreview: document.getElementById('businessLicensePreview'),
    businessPermitPreview: document.getElementById('businessPermitPreview'),
    birDocumentPreview: document.getElementById('birDocumentPreview'),
    dtiDocumentPreview: document.getElementById('dtiDocumentPreview'),
    ownerIdFrontPreview: document.getElementById('ownerIdFrontPreview'),
    ownerIdBackPreview: document.getElementById('ownerIdBackPreview'),

    // Password Fields
    currentPassword: document.getElementById('currentPassword'),
    newPassword: document.getElementById('newPassword'),
    confirmPassword: document.getElementById('confirmPassword'),

    // Buttons
    logoutBtn: document.getElementById('logout_btn'),
    cancelBtn: document.querySelector('.btn-cancel'),
    saveBtn: document.querySelector('.btn-save'),
    viewBtns: document.querySelectorAll('.btn-view'),
    replaceBtns: document.querySelectorAll('.btn-replace'),
    avatarUpload: document.getElementById('shopLogoUpload'),
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
    console.log('🚀 Initializing Shop Profile Page...');
    
    const user = await checkUserAuth();
    console.log('🔐 Authentication Result:', {
        authenticated: user.authenticated,
        role: user.role,
        userId: user.userId,
        hasUserData: !!user.userData
    });
    
    if (!user.authenticated) {
        console.log('❌ User not authenticated, redirecting to login');
        window.location.href = "/login.html#shop";
        return;
    }

    userSession.userId = user.userId;
    userSession.userData = user.userData;
    userSession.role = user.role;
    userSession.shopId = user.shopId || user.userId;

    console.log('👤 User Session Established:', userSession);

    loadShopProfile();
    setupEventListeners();
    setupPasswordToggleListeners();
    setupTaxNumberValidation();
    
    // Also setup event listeners for employee form
    setupEmployeeEventListeners();
    
    console.log('✅ Page initialization complete');
}

// ADD GOOGLE MAPS FUNCTIONS
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
        title: "Drag to set your shop location"
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

    console.log('Google Maps initialized for shop profile');
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
    let state = '';
    let zipCode = '';
    let country = '';

    // Parse address components
    geocodeResult.address_components.forEach(component => {
        const types = component.types;
        
        if (types.includes('locality')) {
            city = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
            state = component.long_name;
        } else if (types.includes('postal_code')) {
            zipCode = component.long_name;
        } else if (types.includes('country')) {
            country = component.long_name;
        }
    });

    // Update form fields if they're empty or if we found better data
    if (city && elements.shopCity) elements.shopCity.value = city;
    if (state && elements.shopState) elements.shopState.value = state;
    if (zipCode && elements.shopZip) elements.shopZip.value = zipCode;
    if (country && elements.shopCountry) elements.shopCountry.value = country;
    if (elements.shopAddress) elements.shopAddress.value = geocodeResult.formatted_address;
}

// Load shop location on map
function loadShopLocation(shopData) {
    if (shopData.latitude && shopData.longitude) {
        const lat = parseFloat(shopData.latitude);
        const lng = parseFloat(shopData.longitude);
        
        updateMarkerPosition(lat, lng);
        updateCoordinatesDisplay(lat, lng);
        
        console.log('Loaded shop location:', { lat, lng });
    } else {
        // Try to geocode from address if coordinates not available
        if (shopData.shopAddress) {
            geocodeAddress(shopData.shopAddress);
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
            
            console.log('Geocoded shop address to coordinates:', { lat, lng });
        } else {
            console.log('Geocode was not successful for the following reason: ' + status);
        }
    });
}

function loadShopProfile() {
    console.log('=== STARTING SHOP PROFILE LOAD ===');
    console.log('User Session Data:', {
        userId: userSession.userId,
        role: userSession.role,
        shopId: userSession.shopId,
        userData: userSession.userData
    });

    // First determine if this is a shop owner or employee
    if (userSession.role === 'employee') {
        console.log('🟢 Loading EMPLOYEE profile');
        console.log('Employee Data from Session:', userSession.userData);
        
        originalEmail = userSession.userData.email || '';
        
        // Hide shop profile section and show employee section
        document.getElementById('shopProfileSection').style.display = 'none';
        const employeeSection = getElement('employeeProfileSection');
        if (employeeSection) employeeSection.style.display = 'block';
        
        // Load employee data
        loadEmployeeProfile(userSession.userData);
        
        // Set role-based UI elements
        if (userSession.userData.role?.toLowerCase() === "salesperson") {
            const addEmployeeBtn = getElement("addemployeebtn");
            const analyticsBtn = getElement("analyticsbtn");
            const issueReport = getElement("issuereport");
            
            if (addEmployeeBtn) addEmployeeBtn.style.display = "none";
            if (analyticsBtn) analyticsBtn.style.display = "none";
            if (issueReport) issueReport.style.display = "none";
        }
    } else {
        console.log('🟢 Loading SHOP OWNER profile');
        const shopPath = `smartfit_AR_Database/shop/${userSession.userId}`;
        console.log('📁 Database Path:', shopPath);
        
        const unsubscribe = readDataRealtime(shopPath, (result) => {
            console.log('📥 Database Response Received:', {
                success: result.success,
                hasData: !!result.data,
                dataKeys: result.data ? Object.keys(result.data) : 'No data'
            });

            if (result.success && result.data) {
                shopData = result.data;
                console.log('🏪 FULL SHOP DATA FROM DATABASE:', shopData);
                console.log('📋 Shop Data Breakdown:');
                console.log('  - Shop Name:', shopData.shopName);
                console.log('  - Email:', shopData.email);
                console.log('  - Owner Name:', shopData.ownerName);
                console.log('  - Phone:', shopData.ownerPhone);
                console.log('  - Address:', shopData.shopAddress);
                console.log('  - Uploads Available:', !!shopData.uploads);
                
                if (shopData.uploads) {
                    console.log('  📎 Uploads Breakdown:');
                    Object.keys(shopData.uploads).forEach(uploadKey => {
                        const upload = shopData.uploads[uploadKey];
                        console.log(`    - ${uploadKey}:`, {
                            name: upload.name,
                            url: upload.url ? 'URL Available' : 'No URL',
                            uploadedAt: upload.uploadedAt
                        });
                    });
                }
                
                originalEmail = shopData.email || '';
                
                // Show shop profile section and hide employee section
                document.getElementById('shopProfileSection').style.display = 'block';
                const employeeSection = getElement('employeeProfileSection');
                if (employeeSection) employeeSection.style.display = 'none';
                
                // Update Header
                updateHeader(shopData);
                
                // Update Profile Section
                updateProfileSection(shopData);
                
                // Update Form Fields
                updateFormFields(shopData);
                
                // Update Documents
                updateDocuments(shopData);
                
                // Initialize map and load shop location
                initializeMap();
                loadShopLocation(shopData);
                
                // Load statistics
                loadShopStatistics();
            } else {
                console.error('❌ Shop data not found or error:', result);
                window.location.href = '/login.html#shop';
            }
        });

        // Store unsubscribe for cleanup if needed
        window.shopProfileUnsubscribe = unsubscribe;
    }
    console.log('=== SHOP PROFILE LOAD COMPLETE ===');
}

function updateHeader(shopData) {
    console.log('👤 Updating header with shop data...');
    
    // Shop Name
    if (shopData.shopName) {
        elements.userNameDisplay.textContent = shopData.shopName;
        console.log('🏪 Header Shop Name set to:', shopData.shopName);
    }

    // Profile Image
    if (shopData.uploads?.shopLogo?.url) {
        elements.userProfileImage.src = shopData.uploads.shopLogo.url;
        console.log('🖼️ Header Profile Image set to shop logo');
    } else {
        setDefaultAvatar(elements.userProfileImage);
        console.log('🖼️ Header Profile Image set to default (no shop logo found)');
    }
}

function updateProfileSection(shopData) {
    console.log('📊 Updating profile section with shop data...');
    
    // Shop Name
    if (shopData.shopName) {
        elements.profileName.textContent = shopData.shopName;
        console.log('🏪 Profile Name set to:', shopData.shopName);
    }

    // Email
    if (shopData.email) {
        elements.profileEmail.textContent = shopData.email;
        console.log('📧 Profile Email set to:', shopData.email);
    }

    // Avatar
    if (shopData.uploads?.shopLogo?.url) {
        elements.profileAvatar.src = shopData.uploads.shopLogo.url;
        console.log('🖼️ Profile Avatar set to shop logo URL');
    } else {
        setDefaultAvatar(elements.profileAvatar);
        console.log('🖼️ Profile Avatar set to default (no shop logo found)');
    }
}

function updateFormFields(shopData) {
    console.log('📝 Updating form fields with shop data...');
    
    // Shop Info
    if (shopData.shopName) {
        elements.shopName.value = shopData.shopName;
        console.log('🏪 Shop Name set to:', shopData.shopName);
    }
    if (shopData.shopCategory) {
        elements.shopCategory.value = shopData.shopCategory;
        console.log('📂 Shop Category set to:', shopData.shopCategory);
    }
    if (shopData.shopDescription) {
        elements.shopDescription.value = shopData.shopDescription;
        console.log('📋 Shop Description set (length):', shopData.shopDescription.length);
    }

    // Contact Info
    if (shopData.ownerName) {
        elements.ownerName.value = shopData.ownerName;
        console.log('👤 Owner Name set to:', shopData.ownerName);
    }
    if (shopData.email) {
        elements.ownerEmail.value = shopData.email;
        console.log('📧 Email set to:', shopData.email);
    }
    if (shopData.ownerPhone) {
        elements.ownerPhone.value = shopData.ownerPhone;
        console.log('📞 Phone set to:', shopData.ownerPhone);
    }

    // Location Info
    if (shopData.shopAddress) {
        elements.shopAddress.value = shopData.shopAddress;
        console.log('📍 Address set to:', shopData.shopAddress);
    }
    if (shopData.shopCity) {
        elements.shopCity.value = shopData.shopCity;
        console.log('🏙️ City set to:', shopData.shopCity);
    }
    if (shopData.shopState) {
        elements.shopState.value = shopData.shopState;
        console.log('🗺️ State set to:', shopData.shopState);
    }
    if (shopData.shopZip) {
        elements.shopZip.value = shopData.shopZip;
        console.log('📮 ZIP set to:', shopData.shopZip);
    }
    if (shopData.shopCountry) {
        elements.shopCountry.value = shopData.shopCountry;
        console.log('🌍 Country set to:', shopData.shopCountry);
    }

    // Business Info - UPDATE TAX ID FORMATTING
    if (shopData.taxId) {
        // Format the tax ID before setting the value
        const formattedTaxId = formatTaxNumber(shopData.taxId);
        elements.taxId.value = formattedTaxId;
        console.log('💳 Tax ID set to:', formattedTaxId);
    } else {
        elements.taxId.value = '';
    }
    
    console.log('✅ Form fields update complete');
}

function updateDocuments(shopData) {
    console.log('📄 Starting document update process...');
    console.log('Shop Data for Documents:', shopData);
    console.log('Uploads Data Structure:', shopData.uploads);

    // Business License (Mayor's Permit)
    if (elements.businessLicensePreview) {
        if (shopData.uploads?.businessLicense) {
            const license = shopData.uploads.businessLicense;
            console.log('📋 Business License Found:', license);
            updateDocumentPreview(elements.businessLicensePreview, license, 'Business License');
        } else {
            console.log('⚠️ No Business License found in uploads');
            elements.businessLicensePreview.style.display = 'none';
        }
    }

    // Business Permit Document
    if (elements.businessPermitPreview) {
        if (shopData.uploads?.permitDocument) {
            const permit = shopData.uploads.permitDocument;
            console.log('📋 Business Permit Found:', permit);
            updateDocumentPreview(elements.businessPermitPreview, permit, 'Business Permit');
        } else {
            console.log('⚠️ No Business Permit found in uploads');
            elements.businessPermitPreview.style.display = 'none';
        }
    }

    // BIR Document
    if (elements.birDocumentPreview) {
        if (shopData.uploads?.birDocument) {
            const birDoc = shopData.uploads.birDocument;
            console.log('📋 BIR Document Found:', birDoc);
            updateDocumentPreview(elements.birDocumentPreview, birDoc, 'BIR Certificate');
        } else {
            console.log('⚠️ No BIR Document found in uploads');
            elements.birDocumentPreview.style.display = 'none';
        }
    }

    // DTI Document
    if (elements.dtiDocumentPreview) {
        if (shopData.uploads?.dtiDocument) {
            const dtiDoc = shopData.uploads.dtiDocument;
            console.log('📋 DTI Document Found:', dtiDoc);
            updateDocumentPreview(elements.dtiDocumentPreview, dtiDoc, 'DTI Registration');
        } else {
            console.log('⚠️ No DTI Document found in uploads');
            elements.dtiDocumentPreview.style.display = 'none';
        }
    }

    // Owner ID Front
    if (elements.ownerIdFrontPreview) {
        if (shopData.uploads?.ownerIdFront) {
            const idFront = shopData.uploads.ownerIdFront;
            console.log('🆔 Owner ID Front Found:', idFront);
            updateDocumentPreview(elements.ownerIdFrontPreview, idFront, 'Owner ID Front');
        } else {
            console.log('⚠️ No Owner ID Front found in uploads');
            elements.ownerIdFrontPreview.style.display = 'none';
        }
    }

    // Owner ID Back
    if (elements.ownerIdBackPreview) {
        if (shopData.uploads?.ownerIdBack) {
            const idBack = shopData.uploads.ownerIdBack;
            console.log('🆔 Owner ID Back Found:', idBack);
            updateDocumentPreview(elements.ownerIdBackPreview, idBack, 'Owner ID Back');
        } else {
            console.log('⚠️ No Owner ID Back found in uploads');
            elements.ownerIdBackPreview.style.display = 'none';
        }
    }
    
    console.log('✅ Document update process complete');
}

function updateDocumentPreview(container, documentData, defaultName) {
    const icon = container.querySelector('.document-icon');
    const name = container.querySelector('.document-name');
    const date = container.querySelector('.document-upload-date');

    icon.className = getFileIconClass(documentData.name);
    name.textContent = documentData.name || defaultName;
    date.textContent = `Uploaded: ${formatDate(documentData.uploadedAt)}`;
    container.style.display = 'flex';
}

function loadShopStatistics() {
    // Order Count
    const ordersPath = 'smartfit_AR_Database/transactions';
    
    const ordersUnsubscribe = readDataRealtime(ordersPath, (result) => {
        if (result.success && result.data) {
            let orderCount = 0;
            let totalRating = 0;
            let ratingCount = 0;

            const transactions = result.data;
            Object.values(transactions).forEach(userOrders => {
                Object.values(userOrders).forEach(order => {
                    if (order.item?.shopId === userSession.shopId || order.shopId === userSession.shopId) {
                        orderCount++;

                        // Check for feedback
                        if (order.feedback) {
                            totalRating += order.feedback.rating;
                            ratingCount++;
                        }
                    }
                });
            });

            if (elements.orderCount) {
                elements.orderCount.textContent = orderCount;
            }

            // Calculate average rating
            const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 'N/A';
            if (elements.ratingValue) {
                elements.ratingValue.textContent = avgRating;
            }
        }
    });

    // Product Count
    const productsPath = `smartfit_AR_Database/shoe/${userSession.shopId}`;
    
    const productsUnsubscribe = readDataRealtime(productsPath, (result) => {
        if (result.success && result.data) {
            const productCount = Object.keys(result.data).length;
            if (elements.productCount) {
                elements.productCount.textContent = productCount;
            }
        } else {
            if (elements.productCount) {
                elements.productCount.textContent = '0';
            }
        }
    });

    // Store unsubscribes for cleanup
    window.ordersUnsubscribe = ordersUnsubscribe;
    window.productsUnsubscribe = productsUnsubscribe;
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

    // Document view buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-view') || e.target.closest('.btn-view')) {
            const btn = e.target.classList.contains('btn-view') ? e.target : e.target.closest('.btn-view');
            const docType = btn.getAttribute('data-doc-type');
            
            console.log('Looking for document type:', docType);
            console.log('Available uploads:', shopData.uploads);

            let url = '';
            
            if (docType === 'businessLicense' && shopData.uploads?.businessLicense?.url) {
                url = shopData.uploads.businessLicense.url;
                console.log('Found Business License URL:', url);
            } else if (docType === 'permitDocument' && shopData.uploads?.permitDocument?.url) {
                url = shopData.uploads.permitDocument.url;
                console.log('Found Business Permit URL:', url);
            } else if (docType === 'birDocument' && shopData.uploads?.birDocument?.url) {
                url = shopData.uploads.birDocument.url;
                console.log('Found BIR Document URL:', url);
            } else if (docType === 'dtiDocument' && shopData.uploads?.dtiDocument?.url) {
                url = shopData.uploads.dtiDocument.url;
                console.log('Found DTI Document URL:', url);
            } else if (docType === 'ownerIdFront' && shopData.uploads?.ownerIdFront?.url) {
                url = shopData.uploads.ownerIdFront.url;
                console.log('Found Owner ID Front URL:', url);
            } else if (docType === 'ownerIdBack' && shopData.uploads?.ownerIdBack?.url) {
                url = shopData.uploads.ownerIdBack.url;
                console.log('Found Owner ID Back URL:', url);
            }

            if (url) {
                console.log('Opening URL:', url);
                window.open(url, '_blank');
            } else {
                console.error('Document URL not found for type:', docType);
                showAlert('Document URL not found. Please check if the document is properly uploaded.', 'error');
            }
        }
    });

    // Document replace buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-replace') || e.target.closest('.btn-replace')) {
            const btn = e.target.classList.contains('btn-replace') ? e.target : e.target.closest('.btn-replace');
            const docType = btn.getAttribute('data-doc-type');

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,.pdf';

            input.onchange = e => {
                const file = e.target.files[0];
                if (file) {
                    if (docType === 'businessLicense') {
                        licenseFile = file;
                    } else if (docType === 'permitDocument') {
                        permitFile = file;
                    } else if (docType === 'birDocument') {
                        birFile = file;
                    } else if (docType === 'dtiDocument') {
                        dtiFile = file;
                    } else if (docType === 'ownerIdFront') {
                        frontIdFile = file;
                    } else if (docType === 'ownerIdBack') {
                        backIdFile = file;
                    }

                    // Update preview
                    const container = btn.closest('.document-preview');
                    const icon = container.querySelector('.document-icon');
                    const name = container.querySelector('.document-name');
                    const date = container.querySelector('.document-upload-date');

                    icon.className = getFileIconClass(file.name);
                    name.textContent = file.name;
                    date.textContent = 'Uploaded: Just now';

                    showAlert('Document will be updated when you save your changes', 'info');
                }
            };

            input.click();
        }
    });

    // Form submission
    if (elements.form) {
        elements.form.addEventListener('submit', async function (e) {
            e.preventDefault();

            try {
                // Validate required fields first
                const missingFields = validateRequiredFields();
                if (missingFields.length > 0) {
                    const errorMessage = showFieldValidationError(missingFields);
                    throw new Error(`Please fill in all required fields: ${errorMessage}`);
                }

                showLoading(true);
                const updates = {};
                let emailChanged = false;
                let passwordChanged = false;

                // Check if email changed
                if (elements.ownerEmail.value !== originalEmail) {
                    if (!elements.currentPassword.value) {
                        throw new Error('Please enter your current password to change email');
                    }
                    throw new Error('Email changes require additional verification. Please contact support.');
                }

                // Check if password changed
                if (elements.newPassword.value) {
                    passwordChanged = await changePassword(
                        elements.currentPassword.value,
                        elements.newPassword.value,
                        elements.confirmPassword.value
                    );
                }

                // Update shop data
                updates.shopName = elements.shopName.value.trim();
                updates.shopCategory = elements.shopCategory.value;
                updates.shopDescription = elements.shopDescription.value.trim();
                updates.ownerName = elements.ownerName.value.trim();
                updates.ownerPhone = elements.ownerPhone.value.trim();
                updates.shopAddress = elements.shopAddress.value.trim();
                updates.shopCity = elements.shopCity.value;
                updates.shopState = elements.shopState.value;
                updates.shopZip = elements.shopZip.value.trim();
                updates.shopCountry = elements.shopCountry.value;
                
                // Format and validate tax ID
                if (elements.taxId.value.trim()) {
                    const cleanTaxId = elements.taxId.value.replace(/\D/g, '');
                    if (cleanTaxId.length !== 12) {
                        throw new Error('Tax Identification Number must be exactly 12 digits');
                    }
                    updates.taxId = cleanTaxId;
                    console.log('💳 Tax ID stored as:', updates.taxId);
                } else {
                    updates.taxId = '';
                }
                
                // ADD COORDINATES TO UPDATES
                if (elements.latitude.value && elements.longitude.value) {
                    updates.latitude = elements.latitude.value;
                    updates.longitude = elements.longitude.value;
                    updates.locationVerified = true;
                }

                // Upload files
                const uploadPromises = [];
                const newUploads = {};

                if (avatarFile) {
                    const oldUrl = shopData.uploads?.shopLogo?.url || null;
                    uploadPromises.push(uploadFile(userSession.userId, avatarFile, 'shopLogo', oldUrl).then(url => {
                        newUploads.shopLogo = {
                            name: avatarFile.name,
                            url: url,
                            uploadedAt: new Date().toISOString()
                        };
                    }));
                }

                if (licenseFile) {
                    const oldUrl = shopData.uploads?.businessLicense?.url || null;
                    uploadPromises.push(uploadFile(userSession.userId, licenseFile, 'businessLicense', oldUrl).then(url => {
                        newUploads.businessLicense = {
                            name: licenseFile.name,
                            url: url,
                            uploadedAt: new Date().toISOString()
                        };
                    }));
                }

                if (permitFile) {
                    const oldUrl = shopData.uploads?.permitDocument?.url || null;
                    uploadPromises.push(uploadFile(userSession.userId, permitFile, 'permitDocument', oldUrl).then(url => {
                        newUploads.permitDocument = {
                            name: permitFile.name,
                            url: url,
                            uploadedAt: new Date().toISOString()
                        };
                    }));
                }

                if (birFile) {
                    const oldUrl = shopData.uploads?.birDocument?.url || null;
                    uploadPromises.push(uploadFile(userSession.userId, birFile, 'birDocument', oldUrl).then(url => {
                        newUploads.birDocument = {
                            name: birFile.name,
                            url: url,
                            uploadedAt: new Date().toISOString()
                        };
                    }));
                }

                if (dtiFile) {
                    const oldUrl = shopData.uploads?.dtiDocument?.url || null;
                    uploadPromises.push(uploadFile(userSession.userId, dtiFile, 'dtiDocument', oldUrl).then(url => {
                        newUploads.dtiDocument = {
                            name: dtiFile.name,
                            url: url,
                            uploadedAt: new Date().toISOString()
                        };
                    }));
                }

                if (frontIdFile) {
                    const oldUrl = shopData.uploads?.ownerIdFront?.url || null;
                    uploadPromises.push(uploadFile(userSession.userId, frontIdFile, 'ownerIdFront', oldUrl).then(url => {
                        newUploads.ownerIdFront = {
                            name: frontIdFile.name,
                            url: url,
                            uploadedAt: new Date().toISOString()
                        };
                    }));
                }

                if (backIdFile) {
                    const oldUrl = shopData.uploads?.ownerIdBack?.url || null;
                    uploadPromises.push(uploadFile(userSession.userId, backIdFile, 'ownerIdBack', oldUrl).then(url => {
                        newUploads.ownerIdBack = {
                            name: backIdFile.name,
                            url: url,
                            uploadedAt: new Date().toISOString()
                        };
                    }));
                }

                await Promise.all(uploadPromises);

                if (Object.keys(newUploads).length > 0) {
                    updates.uploads = {
                        ...(shopData.uploads || {}),
                        ...newUploads
                    };
                }

                const shopPath = `smartfit_AR_Database/shop/${userSession.userId}`;
                const result = await updateProfileMethod(userSession.userId, updates, shopPath);
                
                if (!result.success) {
                    throw new Error(result.error);
                }

                // Update UI
                if (elements.profileName) {
                    elements.profileName.textContent = elements.shopName.value;
                }
                if (elements.profileEmail) {
                    elements.profileEmail.textContent = elements.ownerEmail.value;
                }
                if (elements.userNameDisplay) {
                    elements.userNameDisplay.textContent = elements.shopName.value;
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

function formatTaxNumber(value) {
    // Remove all non-digit characters
    const numbers = value.replace(/\D/g, '');
    
    // Pad with zeros if less than 12 digits
    const paddedNumbers = numbers.padEnd(12, '0');
    
    // Format as XXXX-XXXX-XXXX
    if (paddedNumbers.length <= 4) {
        return paddedNumbers;
    } else if (paddedNumbers.length <= 8) {
        return `${paddedNumbers.slice(0, 4)}-${paddedNumbers.slice(4)}`;
    } else {
        return `${paddedNumbers.slice(0, 4)}-${paddedNumbers.slice(4, 8)}-${paddedNumbers.slice(8, 12)}`;
    }
}

// Add this function to validate tax number input
function setupTaxNumberValidation() {
    const taxInput = elements.taxId;
    if (!taxInput) return;

    taxInput.addEventListener('input', function(e) {
        const cursorPosition = e.target.selectionStart;
        const originalValue = e.target.value;
        
        // Format the value
        const formattedValue = formatTaxNumber(originalValue);
        
        // Update the input value
        e.target.value = formattedValue;
        
        // Adjust cursor position to account for added dashes
        let newCursorPosition = cursorPosition;
        const addedDashes = (formattedValue.match(/-/g) || []).length - (originalValue.match(/-/g) || []).length;
        
        if (addedDashes > 0 && cursorPosition >= 4) {
            newCursorPosition += 1;
        }
        if (addedDashes > 0 && cursorPosition >= 8) {
            newCursorPosition += 1;
        }
        
        e.target.setSelectionRange(newCursorPosition, newCursorPosition);
    });

    // Also format on blur to ensure proper formatting
    taxInput.addEventListener('blur', function() {
        if (this.value) {
            this.value = formatTaxNumber(this.value);
        }
    });

    // Prevent invalid characters
    taxInput.addEventListener('keypress', function(e) {
        const char = String.fromCharCode(e.keyCode || e.which);
        if (!/\d/.test(char) && char !== '-') {
            e.preventDefault();
        }
    });
}

// Add this function to validate required fields
function validateRequiredFields() {
    const requiredFields = [
        'shopName',
        'shopCategory', 
        'shopDescription',
        'ownerName',
        'ownerEmail',
        'ownerPhone',
        'shopAddress',
        'shopCity',
        'shopState',
        'shopZip',
        'shopCountry',
        'taxId'
    ];

    const missingFields = [];
    
    requiredFields.forEach(fieldId => {
        const field = getElement(fieldId);
        if (field && !field.value.trim()) {
            missingFields.push(fieldId);
            
            // Add visual indication for missing fields
            field.style.borderColor = '#ff4444';
            field.addEventListener('input', function() {
                if (this.value.trim()) {
                    this.style.borderColor = '';
                }
            });
        } else if (field) {
            field.style.borderColor = '';
        }
    });

    // Special validation for phone fields
    const phoneFields = ['ownerPhone'];
    phoneFields.forEach(fieldId => {
        const field = getElement(fieldId);
        if (field && field.value.trim() && field.value.trim().length < 10) {
            missingFields.push(fieldId);
            field.style.borderColor = '#ff4444';
        }
    });

    // Special validation for tax ID (should be 12 digits after formatting)
    const taxField = getElement('taxId');
    if (taxField && taxField.value.trim()) {
        const cleanTaxId = taxField.value.replace(/\D/g, '');
        if (cleanTaxId.length !== 12) {
            missingFields.push('taxId');
            taxField.style.borderColor = '#ff4444';
        }
    }

    return missingFields;
}

// Add this function to get field labels for error messages
function getFieldLabel(fieldId) {
    const labels = {
        'shopName': 'Shop Name',
        'shopCategory': 'Shop Category',
        'shopDescription': 'Shop Description',
        'ownerName': 'Owner Name',
        'ownerEmail': 'Email',
        'ownerPhone': 'Phone Number',
        'shopAddress': 'Shop Address',
        'shopCity': 'City',
        'shopState': 'State/Province',
        'shopZip': 'ZIP/Postal Code',
        'shopCountry': 'Country',
        'taxId': 'Tax Identification Number'
    };
    
    return labels[fieldId] || fieldId;
}

// Add this function to show field validation errors
function showFieldValidationError(missingFields) {
    const errorMessages = missingFields.map(fieldId => {
        const label = getFieldLabel(fieldId);
        const field = getElement(fieldId);
        
        if (fieldId === 'ownerPhone' && field && field.value.trim()) {
            return `${label} must be 10 digits`;
        } else if (fieldId === 'taxId' && field && field.value.trim()) {
            return `${label} must be 12 digits`;
        } else {
            return `${label} is required`;
        }
    });
    
    return errorMessages.join(', ');
}

document.getElementById("shopZip").addEventListener("input", function() {
    if (this.value.length > 4) {
        this.value = this.value.slice(0, 4);
    }
});

function setDefaultAvatar(imgElement) {
    if (!imgElement) return;
    imgElement.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
}

function getFileIconClass(filename) {
    if (!filename) return 'fas fa-file document-icon';
    if (filename.match(/\.(jpg|jpeg|png|gif|heic)$/i)) {
        return 'fas fa-file-image document-icon';
    } else if (filename.match(/\.(pdf)$/i)) {
        return 'fas fa-file-pdf document-icon';
    } else {
        return 'fas fa-file document-icon';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
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
        const filePath = `uploads/${userId}/${type}_${Date.now()}_${file.name}`;
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

        // Get current user email based on role
        let currentEmail = '';
        if (userSession.role === 'employee') {
            currentEmail = userSession.userData.email;
        } else {
            currentEmail = shopData.email;
        }

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
            window.location.href = "/login.html#shop";
        } else {
            alert('Logout failed: ' + result.error);
        }
    }
}

// Employee Profile Functions
function setupEmployeeEventListeners() {
    const employeeForm = getElement('employeeProfileForm');
    if (!employeeForm) return;
    
    employeeForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // Validate required fields first
            const missingFields = validateEmployeeRequiredFields();
            if (missingFields.length > 0) {
                const errorMessage = showEmployeeFieldValidationError(missingFields);
                throw new Error(`Please fill in all required fields: ${errorMessage}`);
            }

            showLoading(true);
            const updates = {};
            let passwordChanged = false;
            
            // Get form values
            const fullName = getElement('employeeFullName').value.trim();
            const phone = getElement('employeePhone').value.trim();
            const emergencyName = getElement('emergencyContactName').value.trim();
            const emergencyRelation = getElement('emergencyContactRelation').value.trim();
            const emergencyPhone = getElement('emergencyContactPhone').value.trim();
            const currentPassword = getElement('employeeCurrentPassword').value;
            const newPassword = getElement('employeeNewPassword').value;
            const confirmPassword = getElement('employeeConfirmPassword').value;
            
            // Basic validation
            if (newPassword && newPassword !== confirmPassword) {
                throw new Error('New passwords do not match');
            }
            
            // Check if password is being changed
            if (newPassword) {
                passwordChanged = await changePassword(
                    currentPassword,
                    newPassword,
                    confirmPassword
                );
            }
            
            // Prepare updates
            updates.name = fullName;
            updates.phone = phone;
            updates.emergencyContact = {
                name: emergencyName,
                relationship: emergencyRelation,
                phone: emergencyPhone
            };
            
            // Handle avatar upload if changed
            const avatarInput = getElement('employeePhotoUpload');
            if (avatarInput && avatarInput.files.length > 0) {
                const avatarFile = avatarInput.files[0];
                const avatarUrl = await uploadFile(userSession.userId, avatarFile, 'employeeAvatar');
                updates.profilePhoto = {
                    url: avatarUrl,
                    name: avatarFile.name,
                    uploadedAt: new Date().toISOString()
                };
                
                // Update UI
                const reader = new FileReader();
                reader.onload = function(e) {
                    const employeePhotoImg = getElement('employeePhotoImg');
                    if (employeePhotoImg) employeePhotoImg.src = e.target.result;
                    if (elements.userProfileImage) elements.userProfileImage.src = e.target.result;
                };
                reader.readAsDataURL(avatarFile);
            }
            
            // Update database
            const employeePath = `smartfit_AR_Database/employees/${userSession.userId}`;
            const result = await updateProfileMethod(userSession.userId, updates, employeePath);
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            // Update UI
            const employeeProfileName = document.querySelector('#employeeProfileSection .profile-name');
            if (employeeProfileName) employeeProfileName.textContent = fullName;
            if (elements.userNameDisplay) elements.userNameDisplay.textContent = fullName;
            
            if (passwordChanged) {
                if (getElement('employeeCurrentPassword')) getElement('employeeCurrentPassword').value = '';
                if (getElement('employeeNewPassword')) getElement('employeeNewPassword').value = '';
                if (getElement('employeeConfirmPassword')) getElement('employeeConfirmPassword').value = '';
            }
            
            showAlert('Profile updated successfully!', 'success');
            
        } catch (error) {
            console.error('Error updating employee profile:', error);
            showAlert(error.message, 'error');
        } finally {
            showLoading(false);
        }
    });
    
    // Cancel button for employee form
    const employeeCancelBtn = document.querySelector('#employeeProfileForm .btn-cancel');
    if (employeeCancelBtn) {
        employeeCancelBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to discard your changes?')) {
                window.location.reload();
            }
        });
    }
    
    // Avatar upload for employee
    const employeeAvatarUpload = getElement('employeePhotoUpload');
    if (employeeAvatarUpload) {
        employeeAvatarUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const employeePhotoImg = getElement('employeePhotoImg');
                    if (employeePhotoImg) employeePhotoImg.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// function to load employee profile
function loadEmployeeProfile(employeeData) {
    // Update Header
    if (elements.userNameDisplay) {
        elements.userNameDisplay.textContent = employeeData.name || 'Employee';
    }
    
    // Update profile image if exists
    if (employeeData.profilePhoto?.url) {
        const employeePhotoImg = getElement('employeePhotoImg');
        if (employeePhotoImg) employeePhotoImg.src = employeeData.profilePhoto.url;
        if (elements.userProfileImage) elements.userProfileImage.src = employeeData.profilePhoto.url;
    } else {
        const employeePhotoImg = getElement('employeePhotoImg');
        if (employeePhotoImg) setDefaultAvatar(employeePhotoImg);
        if (elements.userProfileImage) setDefaultAvatar(elements.userProfileImage);
    }
    
    // Update Employee Profile Section
    const employeeSection = getElement('employeeProfileSection');
    if (employeeSection) {
        const profileName = employeeSection.querySelector('.profile-name');
        const profileEmail = employeeSection.querySelector('.profile-email');
        
        if (profileName) profileName.textContent = employeeData.name || 'Employee';
        if (profileEmail) profileEmail.textContent = employeeData.email || '';
    }
    
    // Update Employee Form Fields
    if (getElement('employeeFullName')) getElement('employeeFullName').value = employeeData.name || '';
    if (getElement('employeeRole')) getElement('employeeRole').value = employeeData.role || '';
    if (getElement('employeeEmail')) getElement('employeeEmail').value = employeeData.email || '';
    if (getElement('employeePhone')) getElement('employeePhone').value = employeeData.phone || '';
    
    // Update Emergency Contact Fields
    if (employeeData.emergencyContact) {
        console.log('Emergency Contact Data:', employeeData.emergencyContact);
        if (getElement('emergencyContactName')) getElement('emergencyContactName').value = employeeData.emergencyContact.name || '';
        if (getElement('emergencyContactRelation')) getElement('emergencyContactRelation').value = employeeData.emergencyContact.relationship || '';
        if (getElement('emergencyContactPhone')) getElement('emergencyContactPhone').value = employeeData.emergencyContact.phone || '';
    } else {
        // Clear fields if no emergency contact data exists
        if (getElement('emergencyContactName')) getElement('emergencyContactName').value = '';
        if (getElement('emergencyContactRelation')) getElement('emergencyContactRelation').value = '';
        if (getElement('emergencyContactPhone')) getElement('emergencyContactPhone').value = '';
    }
    
    // Load employee statistics
    loadEmployeeStatistics();
}

// function for employee statistics
function loadEmployeeStatistics() {
    // You can implement employee-specific statistics here
    const ordersPath = 'smartfit_AR_Database/transactions';
    
    const ordersUnsubscribe = readDataRealtime(ordersPath, (result) => {
        if (result.success && result.data) {
            let ordersProcessed = 0;
            
            const transactions = result.data;
            Object.values(transactions).forEach(userOrders => {
                Object.values(userOrders).forEach(order => {
                    if (order.shopId === userSession.shopId) {
                        // Check if this employee processed the order (you'll need to track this in your data)
                        ordersProcessed++;
                    }
                });
            });
            
            const employeeOrderCount = document.querySelector('#employeeProfileSection .stat-item:nth-child(1) .stat-value');
            if (employeeOrderCount) employeeOrderCount.textContent = ordersProcessed;
        }
    });

    // Store unsubscribe for cleanup
    window.employeeOrdersUnsubscribe = ordersUnsubscribe;
}

// Add employee form validation
function validateEmployeeRequiredFields() {
    const requiredFields = [
        'employeeFullName',
        'employeePhone',
        'emergencyContactName',
        'emergencyContactRelation',
        'emergencyContactPhone'
    ];

    const missingFields = [];
    
    requiredFields.forEach(fieldId => {
        const field = getElement(fieldId);
        if (field && !field.value.trim()) {
            missingFields.push(fieldId);
            
            // Add visual indication for missing fields
            field.style.borderColor = '#ff4444';
            field.addEventListener('input', function() {
                if (this.value.trim()) {
                    this.style.borderColor = '';
                }
            });
        } else if (field) {
            field.style.borderColor = '';
        }
    });

    // Special validation for phone fields
    const phoneFields = ['employeePhone', 'emergencyContactPhone'];
    phoneFields.forEach(fieldId => {
        const field = getElement(fieldId);
        if (field && field.value.trim() && field.value.trim().length < 10) {
            missingFields.push(fieldId);
            field.style.borderColor = '#ff4444';
        }
    });

    return missingFields;
}

function getEmployeeFieldLabel(fieldId) {
    const labels = {
        'employeeFullName': 'Full Name',
        'employeePhone': 'Phone Number',
        'emergencyContactName': 'Emergency Contact Name',
        'emergencyContactRelation': 'Emergency Contact Relationship',
        'emergencyContactPhone': 'Emergency Contact Phone'
    };
    
    return labels[fieldId] || fieldId;
}

function showEmployeeFieldValidationError(missingFields) {
    const errorMessages = missingFields.map(fieldId => {
        const label = getEmployeeFieldLabel(fieldId);
        const field = getElement(fieldId);
        
        if ((fieldId === 'employeePhone' || fieldId === 'emergencyContactPhone') && field && field.value.trim()) {
            return `${label} must be 10 digits`;
        } else {
            return `${label} is required`;
        }
    });
    
    return errorMessages.join(', ');
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
        }
    });
}

// Cleanup function if needed
function cleanup() {
    if (window.shopProfileUnsubscribe) window.shopProfileUnsubscribe();
    if (window.ordersUnsubscribe) window.ordersUnsubscribe();
    if (window.productsUnsubscribe) window.productsUnsubscribe();
    if (window.employeeOrdersUnsubscribe) window.employeeOrdersUnsubscribe();
}

// Export for potential cleanup
window.cleanupShopProfile = cleanup;