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
let generatedEmployees = [];

// DOM Elements
const logoutBtn = document.getElementById('logout_btn');
const generateEmployeesBtn = document.getElementById('generateEmployees');
const downloadBatchEmployeesBtn = document.getElementById('downloadBatchEmployees');
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
    viewProfile(userUID, `smartfit_AR_Database/shop/${userUID}`).then((result) => {
        if (result.success) {
            const shopData = result.data;
            const profilePicture = document.getElementById('profilePicture');
            const userFullname = document.getElementById('userFullname');

            if (!profilePicture || !userFullname) return;

            if (shopData.name) {
                userFullname.textContent = shopData.name;
            } else if (shopData.shopName) {
                userFullname.textContent = shopData.shopName;
            } else if (shopData.ownerName) {
                userFullname.textContent = shopData.ownerName;
            }

            if (shopData.profilePhoto && shopData.profilePhoto.url) {
                profilePicture.src = shopData.profilePhoto.url;
            } else if (shopData.uploads && shopData.uploads.shopLogo && shopData.uploads.shopLogo.url) {
                profilePicture.src = shopData.uploads.shopLogo.url;
            } else {
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
        const result = await readData(`smartfit_AR_Database/shop/${shopId}/lastEmployeeNumber`);
        lastEmployeeNumber = result.success && result.data !== null ? result.data : 0;
    } catch (error) {
        console.error("Error loading last employee number:", error);
        lastEmployeeNumber = 0;
    }
}

// Update last employee number in database
async function updateLastEmployeeNumber(shopId, newNumber) {
    try {
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
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (generateEmployeesBtn) {
        generateEmployeesBtn.addEventListener('click', generateBatchEmployees);
    }

    if (downloadBatchEmployeesBtn) {
        downloadBatchEmployeesBtn.addEventListener('click', downloadBatchEmployeesCSV);
    }
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
        generateEmployeesBtn.disabled = true;
        generateEmployeesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        const result = await generateBatchEmployeesBackend(
            shopOwnerUid,
            shopOwnerUid,
            {
                department: role,
                permissions: ['view_products', 'manage_orders', 'view_inventory'],
                role: role,
                count: count,
                domain: domain
            }
        );

        if (result.success) {
            generatedEmployees = result.employees;
            displayGeneratedEmployees(result.employees);
            batchPreview.classList.add('active');
            downloadBatchEmployeesBtn.disabled = false;
        } else {
            alert('Error generating employees: ' + result.error);
        }
    } catch (error) {
        console.error('Error generating employees:', error);
        alert('Error generating employees. Please check console for details.');
    } finally {
        generateEmployeesBtn.disabled = false;
        generateEmployeesBtn.innerHTML = '<i class="fas fa-users"></i> Generate Employees';
    }
}

// Display generated employees in the preview area
function displayGeneratedEmployees(employees) {
    batchPreview.innerHTML = '';
    employees.forEach(employee => {
        const employeeDiv = document.createElement('div');
        employeeDiv.classList.add('batch-account');
        employeeDiv.innerHTML = `
            <p><strong>Name:</strong> ${employee.name}</p>
            <p><strong>Email:</strong> ${employee.email}</p>
            <p><strong>Role:</strong> ${employee.role}</p>
        `;
        batchPreview.appendChild(employeeDiv);
    });
}