import { 
    checkUserAuth, 
    logoutUser, 
    createUserWithEmailAndPasswordWrapper,
    sendEmailVerificationWrapper,
    updateData,
    readData,
    viewProfile,
    generateBatchEmployees as generateBatchEmployeesBackend
} from '../../firebaseMethods.js';

// Global variables
let shopOwnerUid = null;
let shopName = null;
let lastEmployeeNumber = 0;

// DOM Elements
const addEmployeeForm = document.getElementById('addEmployeeForm');
const employeeNameInput = document.getElementById('employeeName');
const employeeEmailInput = document.getElementById('employeeEmail');
const employeeRoleInput = document.getElementById('employeeRole');
const employeePhoneInput = document.getElementById('employeePhone');
const employeePasswordInput = document.getElementById('employeePassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const logoutBtn = document.getElementById('logout_btn');
const generateEmployeesBtn = document.getElementById('generateEmployees');
const createBatchEmployeesBtn = document.getElementById('createBatchEmployees');
const batchPreview = document.getElementById('batchPreview');
const employeeCountInput = document.getElementById('employeeCount');
const batchEmployeeRoleInput = document.getElementById('batchEmployeeRole');
const emailDomainInput = document.getElementById('emailDomain');

// Initialize the application
function init() {
    // Mobile sidebar toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });
    
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });

    setupAuthStateListener();
    setupEventListeners();
    setupPasswordValidation();
    setupPhoneNumberFormatting();
    setupBatchCreation();
    setupPasswordToggleListeners();
}

// Set up password toggle event listeners
function setupPasswordToggleListeners() {
    const toggleIcons = document.querySelectorAll('.password-toggle');
    toggleIcons.forEach(icon => {
        const fieldId = icon.getAttribute('data-field-id');
        if (fieldId) {
            icon.addEventListener('click', () => togglePassword(fieldId));
        }
    });
}

// Set up authentication state listener
function setupAuthStateListener() {
    checkUserAuth().then((authResult) => {
        if (authResult.authenticated && authResult.role === "shopowner") {
            shopOwnerUid = authResult.userId;
            updateProfileHeader(authResult.userId);
            loadShopData(authResult.userId);
            loadLastEmployeeNumber(authResult.userId);
        } else {
            window.location.href = '/user_login.html';
        }
    }).catch((error) => {
        console.error('Auth error:', error);
        window.location.href = "/user_login.html";
    });
}

// Function to update profile header
function updateProfileHeader(userUID) {
    // Use viewProfile method from firebaseMethods
    viewProfile(userUID, `smartfit_AR_Database/shop/${userUID}`).then((result) => {
        if (result.success) {
            const shopData = result.data;
            const profilePicture = document.getElementById('profilePicture');
            const userFullname = document.getElementById('userFullname');

            if (!profilePicture || !userFullname) return;

            // Set profile name
            if (shopData.name) {
                userFullname.textContent = shopData.name;
            } else if (shopData.shopName) {
                userFullname.textContent = shopData.shopName;
            } else if (shopData.ownerName) {
                userFullname.textContent = shopData.ownerName;
            }

            // Set profile picture
            if (shopData.profilePhoto && shopData.profilePhoto.url) {
                profilePicture.src = shopData.profilePhoto.url;
            } else if (shopData.uploads && shopData.uploads.shopLogo && shopData.uploads.shopLogo.url) {
                profilePicture.src = shopData.uploads.shopLogo.url;
            } else {
                // Set default avatar if no image available
                profilePicture.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23ddd'%3E%3Crect width='100' height='100'/%3E%3Ctext x='50%' y='50%' font-size='20' text-anchor='middle' dominant-baseline='middle' fill='%23666'%3EProfile%3C/text%3E%3C/svg%3E";
            }
        }
    }).catch((error) => {
        console.error('Error loading profile:', error);
    });
}

// Load shop data
async function loadShopData(uid) {
    try {
        // Use readData method from firebaseMethods
        const result = await readData(`smartfit_AR_Database/shop/${uid}`);
        if (result.success && result.data) {
            shopName = result.data.shopName;
        }
    } catch (error) {
        console.error("Error loading shop data:", error);
    }
}

// Load last employee number from database
async function loadLastEmployeeNumber(shopId) {
    try {
        // Use readData method from firebaseMethods
        const result = await readData(`smartfit_AR_Database/shop/${shopId}/lastEmployeeNumber`);
        lastEmployeeNumber = result.success && result.data !== null ? result.data : 0;
    } catch (error) {
        console.error("Error loading last employee number:", error);
    }
}

// Update last employee number in database
async function updateLastEmployeeNumber(shopId, newNumber) {
    try {
        // Use updateData method from firebaseMethods
        const result = await updateData(`smartfit_AR_Database/shop/${shopId}`, {
            lastEmployeeNumber: newNumber
        });
        
        if (result.success) {
            lastEmployeeNumber = newNumber;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error("Error updating last employee number:", error);
    }
}

// Set up event listeners
function setupEventListeners() {
    if (addEmployeeForm) {
        addEmployeeForm.addEventListener('submit', handleFormSubmit);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (generateEmployeesBtn) {
        generateEmployeesBtn.addEventListener('click', generateBatchEmployees);
    }

    if (createBatchEmployeesBtn) {
        createBatchEmployeesBtn.addEventListener('click', createBatchEmployees);
    }
}

// Set up password validation
function setupPasswordValidation() {
    if (employeePasswordInput) {
        employeePasswordInput.addEventListener('input', validatePassword);
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validatePassword);
    }
}

// Set up phone number formatting
function setupPhoneNumberFormatting() {
    if (employeePhoneInput) {
        employeePhoneInput.addEventListener('input', formatPhoneNumber);
    }
}

// Set up batch creation functionality
function setupBatchCreation() {
    const creationOptions = document.querySelectorAll('.creation-option');
    const singleCreation = document.getElementById('singleCreation');
    const batchCreation = document.getElementById('batchCreation');

    creationOptions.forEach(option => {
        option.addEventListener('click', () => {
            creationOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');

            if (option.dataset.type === 'single') {
                singleCreation.style.display = 'block';
                batchCreation.style.display = 'none';
            } else {
                singleCreation.style.display = 'none';
                batchCreation.style.display = 'block';
            }
        });
    });
}

// Logout handler function
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        logoutUser().then((result) => {
            if (result.success) {
                window.location.href = '/user_login.html';
            } else {
                alert('Logout error: ' + result.error);
            }
        });
    }
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    if (!shopOwnerUid) {
        alert("Please sign in as a shop owner first.");
        return;
    }

    // Validate password match
    if (employeePasswordInput.value !== confirmPasswordInput.value) {
        alert("Passwords don't match!");
        return;
    }

    const employeeData = {
        name: employeeNameInput.value.trim(),
        email: employeeEmailInput.value.trim(),
        role: employeeRoleInput.value,
        phone: employeePhoneInput.value.trim(),
        password: employeePasswordInput.value.trim(),
    };

    // Validate required fields
    if (!employeeData.name || !employeeData.email || !employeeData.role || !employeeData.password) {
        alert("Please fill all required fields.");
        return;
    }

    // Validate email format
    if (!isValidEmail(employeeData.email)) {
        alert("Please enter a valid email address.");
        return;
    }

    // Validate password strength
    if (employeeData.password.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
    }

    try {
        // Show loading state
        const submitButton = addEmployeeForm.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        submitButton.disabled = true;

        // Create employee account with verification email (default behavior)
        await createEmployeeAccount(employeeData, { sendVerificationEmail: true });
        alert(`Employee ${employeeData.name} created successfully!`);
        addEmployeeForm.reset();
        
    } catch (error) {
        console.error("Error creating employee:", error);
        handleEmployeeCreationError(error);
    } finally {
        // Reset button state
        const submitButton = addEmployeeForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.innerHTML = 'Add Employee';
            submitButton.disabled = false;
        }
    }
}

// Create employee account - FIXED VERSION
async function createEmployeeAccount(employeeData, options = { sendVerificationEmail: true }) {
    if (!shopOwnerUid) {
        throw new Error("Shop owner not authenticated. Please sign in first.");
    }

    try {
        console.log("Attempting to create user:", employeeData.email);
        
        // Use createUserWithEmailAndPasswordWrapper from firebaseMethods
        const userResult = await createUserWithEmailAndPasswordWrapper(
            employeeData.email,
            employeeData.password
        );

        console.log("User creation result:", userResult);

        // Check if userResult has success property or if it's the user object directly
        if (userResult && userResult.success === false) {
            throw new Error(userResult.error || 'Failed to create user account');
        }

        // Get the user object - handle different possible return structures
        const user = userResult.user || userResult;

        if (!user || !user.uid) {
            throw new Error('User creation failed - no user ID returned');
        }

        // Only send verification email if option is true (default for single creation)
        if (options.sendVerificationEmail) {
            console.log("Sending verification email");
            try {
                await sendEmailVerificationWrapper(user);
            } catch (emailError) {
                console.warn("Email verification failed:", emailError);
                // Continue with account creation even if email fails
            }
        }

        console.log("Saving employee data to database");
        
        // Use updateData method from firebaseMethods
        const saveResult = await updateData(`smartfit_AR_Database/employees/${user.uid}`, {
            name: employeeData.name,
            email: employeeData.email,
            role: employeeData.role,
            phone: employeeData.phone || '',
            shopId: shopOwnerUid,
            shopName: shopName,
            dateAdded: new Date().toISOString(),
            status: 'active'
        });

        console.log("Save result:", saveResult);

        if (!saveResult.success) {
            throw new Error(saveResult.error || 'Failed to save employee data');
        }

        console.log("Employee account created successfully");
        return { success: true };
    } catch (error) {
        console.error("Error during employee creation:", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        // Handle specific Firebase errors
        const errorMessage = error.message || 'Unknown error occurred';
        
        if (errorMessage.includes('email-already-in-use') || error.code === 'auth/email-already-in-use') {
            throw new Error('This email is already registered');
        } else if (errorMessage.includes('invalid-email') || error.code === 'auth/invalid-email') {
            throw new Error('Please enter a valid email address');
        } else if (errorMessage.includes('weak-password') || error.code === 'auth/weak-password') {
            throw new Error('Password is too weak (minimum 6 characters)');
        } else if (errorMessage.includes('network') || error.code === 'auth/network-request-failed') {
            throw new Error('Network error. Please check your internet connection');
        }

        throw new Error(errorMessage || 'Failed to create employee account');
    }
}

// Generate batch employees
async function generateBatchEmployees() {
    const count = parseInt(employeeCountInput.value);
    const role = batchEmployeeRoleInput.value;
    const domain = emailDomainInput.value.trim() || 'yourcompany.com';

    if (count < 1 || count > 100) {
        alert('Please enter a number between 1 and 100');
        return;
    }

    if (!domain.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        alert('Please enter a valid email domain (e.g., company.com)');
        return;
    }

    try {
        // Show loading state
        generateEmployeesBtn.disabled = true;
        generateEmployeesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        // Call the backend API - UPDATED (removed count parameter)
        const result = await generateBatchEmployeesBackend(
            shopOwnerUid,  // shopId
            shopOwnerUid,  // shopOwnerId (same as shopId for shop owners)
            {
                department: role,
                permissions: ['view_products', 'manage_orders', 'view_inventory'],
                role: role
            }
        );

        if (result.success) {
            // Display the generated employees
            displayGeneratedEmployees(result.employees);
            batchPreview.classList.add('active');
            createBatchEmployeesBtn.disabled = false;
        } else {
            alert('Error generating employees: ' + result.error);
        }

    } catch (error) {
        console.error('Error generating employees:', error);
        alert('Error generating employees. Please check console for details.');
    } finally {
        // Reset button state
        generateEmployeesBtn.disabled = false;
        generateEmployeesBtn.innerHTML = '<i class="fas fa-users"></i> Generate Employees';
    }
}

// Helper function to display generated employees
function displayGeneratedEmployees(employees) {
    batchPreview.innerHTML = '';

    employees.forEach(emp => {
        const accountDiv = document.createElement('div');
        accountDiv.className = 'batch-account';
        accountDiv.innerHTML = `
            <div>
                <p><strong>Employee ID:</strong> ${emp.employeeId}</p>
                <p><strong>Email:</strong> ${emp.email}</p>
                <p><strong>Temporary Password:</strong> ${emp.temporaryPassword}</p>
                <p><strong>Status:</strong> ${emp.status}</p>
            </div>
            <input type="hidden" name="batchEmail[]" value="${emp.email}">
            <input type="hidden" name="batchPassword[]" value="${emp.temporaryPassword}">
            <input type="hidden" name="batchEmployeeId[]" value="${emp.employeeId}">
        `;

        batchPreview.appendChild(accountDiv);
    });
}

// Create batch employees
async function createBatchEmployees() {
    try {
        // Show loading state
        createBatchEmployeesBtn.disabled = true;
        createBatchEmployeesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Employees...';

        const count = parseInt(employeeCountInput.value);
        const role = batchEmployeeRoleInput.value;

        // Call the backend API - UPDATED (removed count parameter)
        const result = await generateBatchEmployeesBackend(
            shopOwnerUid,  // shopId
            shopOwnerUid,  // shopOwnerId
            {
                department: role,
                permissions: ['view_products', 'manage_orders', 'view_inventory'],
                role: role
            }
        );

        if (result.success) {
            // Download CSV with credentials
            downloadEmployeeCSV(result.employees);
            
            alert(`Successfully created ${result.employees.length} employee accounts!`);
            
            // Reset the form
            await resetBatchCreationForm();
        } else {
            alert('Error creating employees: ' + result.error);
        }

    } catch (error) {
        console.error('Error creating accounts:', error);
        alert('Error creating accounts. Please check console for details.');
    } finally {
        createBatchEmployeesBtn.disabled = false;
        createBatchEmployeesBtn.innerHTML = '<i class="fas fa-save"></i> Create All Employees';
    }
}

// Enhanced reset function with download option
async function resetBatchCreationForm() {
    
    // auto download CSV
    downloadEmployeeCSV();
    
    // Clear the preview
    batchPreview.innerHTML = '';
    batchPreview.classList.remove('active');
    
    // Reset form inputs
    employeeCountInput.value = '';
    batchEmployeeRoleInput.value = '';
    emailDomainInput.value = '';
    
    // Reset buttons
    createBatchEmployeesBtn.disabled = true;
    createBatchEmployeesBtn.innerHTML = '<i class="fas fa-save"></i> Create All Employees';
    
    // Update the last employee number in memory
    const count = parseInt(employeeCountInput.value) || 0;
    if (count > 0) {
        lastEmployeeNumber += count;
    }
}

// CSV download function
function downloadEmployeeCSV(employees) {
    // Create CSV content
    let csvContent = "Employee ID,Email,Temporary Password,Status\n";
    employees.forEach(emp => {
        csvContent += `"${emp.employeeId}","${emp.email}","${emp.temporaryPassword}","${emp.status}"\n`;
    });
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `employees_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Generate random password
function generatePassword() {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";

    // Ensure at least one of each character type
    password += getRandomChar("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    password += getRandomChar("abcdefghijklmnopqrstuvwxyz");
    password += getRandomChar("0123456789");
    password += getRandomChar("!@#$%^&*");

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }

    // Shuffle the password
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

function getRandomChar(charSet) {
    return charSet[Math.floor(Math.random() * charSet.length)];
}

// Validate password
function validatePassword() {
    const password = employeePasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Check password requirements
    const reqLength = document.getElementById('reqLength');
    const reqUppercase = document.getElementById('reqUppercase');
    const reqLowercase = document.getElementById('reqLowercase');
    const reqNumber = document.getElementById('reqNumber');
    const reqSpecial = document.getElementById('reqSpecial');

    if (reqLength) reqLength.style.color = password.length >= 8 ? 'green' : 'red';
    if (reqUppercase) reqUppercase.style.color = /[A-Z]/.test(password) ? 'green' : 'red';
    if (reqLowercase) reqLowercase.style.color = /[a-z]/.test(password) ? 'green' : 'red';
    if (reqNumber) reqNumber.style.color = /[0-9]/.test(password) ? 'green' : 'red';
    if (reqSpecial) reqSpecial.style.color = /[!@#$%^&*]/.test(password) ? 'green' : 'red';

    // Check if passwords match
    if (password && confirmPassword) {
        if (password !== confirmPassword) {
            confirmPasswordInput.setCustomValidity("Passwords don't match");
        } else {
            confirmPasswordInput.setCustomValidity('');
        }
    }
}

// Format phone number
function formatPhoneNumber(e) {
    // Remove all non-digit characters
    let phoneNumber = e.target.value.replace(/\D/g, '');

    // Limit to 10 digits (Philippine mobile numbers are 10 digits without country code)
    if (phoneNumber.length > 10) {
        phoneNumber = phoneNumber.substring(0, 10);
    }

    // Update the input value with just the digits
    e.target.value = phoneNumber;
}

// Handle employee creation errors
function handleEmployeeCreationError(error) {
    const errorMessage = error.message || 'An unknown error occurred';
    
    if (errorMessage.includes('email-already-in-use')) {
        alert('This email is already registered. Please use a different email address.');
    } else if (errorMessage.includes('invalid-email')) {
        alert('Please enter a valid email address.');
    } else if (errorMessage.includes('weak-password')) {
        alert('Password is too weak. Please use a stronger password with at least 6 characters.');
    } else if (errorMessage.includes('network')) {
        alert('Network error. Please check your internet connection and try again.');
    } else {
        alert('Error creating employee: ' + errorMessage);
    }
}

// Email validation helper function
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Logout functionality
if (document.getElementById('logout_btn')) {
    document.getElementById('logout_btn').addEventListener('click', function () {
        if (confirm('Are you sure you want to logout?')) {
            logoutUser().then((result) => {
                if (result.success) {
                    window.location.href = '/user_login.html';
                } else {
                    alert('Logout error: ' + result.error);
                }
            });
        }
    });
}

// Toggle password visibility
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const icon = field ? field.nextElementSibling : null;

    if (field && icon && icon.classList.contains('password-toggle')) {
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

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);