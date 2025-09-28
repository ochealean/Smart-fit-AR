// employee_activation.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getDatabase, ref, get, update, remove } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAuPALylh11cTArigeGJZmLwrFwoAsNPSI",
    authDomain: "opportunity-9d3bf.firebaseapp.com",
    databaseURL: "https://opportunity-9d3bf-default-rtdb.firebaseio.com",
    projectId: "opportunity-9d3bf",
    storageBucket: "opportunity-9d3bf.appspot.com",
    messagingSenderId: "57906230058",
    appId: "1:57906230058:web:2d7cd9cc68354722536453",
    measurementId: "G-QC2JSR1FJW"
};

const app = initializeApp(firebaseConfig, "EmployeeActivation");
const auth = getAuth(app);
const db = getDatabase(app);

// Get email and password from URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const urlEmail = urlParams.get('email');
const urlPassword = urlParams.get('password');

// DOM Elements
const activationForm = document.getElementById('activationForm');
const defaultEmailInput = document.getElementById('defaultEmail');
const defaultPasswordInput = document.getElementById('defaultPassword');
const newEmailInput = document.getElementById('newEmail');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const activateBtn = document.getElementById('activateBtn');

defaultEmailInput.value = urlEmail || '';
defaultPasswordInput.value = urlPassword || '';

function initActivation() {
    if (activationForm) {
        activationForm.addEventListener('submit', handleActivation);
    }
    
    // Setup password validation
    if (newPasswordInput && confirmPasswordInput) {
        newPasswordInput.addEventListener('input', validatePassword);
        confirmPasswordInput.addEventListener('input', validatePassword);
    }
}

function validatePassword() {
    const password = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Check if passwords match
    if (password && confirmPassword) {
        if (password !== confirmPassword) {
            confirmPasswordInput.setCustomValidity("Passwords don't match");
        } else {
            confirmPasswordInput.setCustomValidity('');
        }
    }
}

async function handleActivation(e) {
    e.preventDefault();
    
    const defaultEmail = defaultEmailInput.value.trim();
    const defaultPassword = defaultPasswordInput.value;
    const newEmail = newEmailInput.value.trim();
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Validate inputs
    if (!defaultEmail || !defaultPassword || !newEmail || !newPassword || !confirmPassword) {
        alert('Please fill all fields');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    activateBtn.disabled = true;
    activateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activating Account...';

    try {
        // 1. Find the default account in database
        const employee = await findDefaultEmployee(defaultEmail, defaultPassword);
        
        if (!employee) {
            throw new Error('Default account not found or already activated');
        }

        // 2. Create real Firebase Auth account
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            newEmail,
            newPassword
        );
        
        // 3. Update the employee record in database
        await updateEmployeeRecord(employee.id, userCredential.user.uid, newEmail);
        
        // 4. Send verification email
        await sendEmailVerification(userCredential.user);
        
        alert(`
            Account activated successfully!
            A verification email has been sent to ${newEmail}.
            Please check your inbox.
        `);
        
        window.location.href = "/user_login.html#shop"; 
    } catch (error) {
        console.error("Activation error:", error);
        handleActivationError(error);
    } finally {
        activateBtn.disabled = false;
        activateBtn.innerHTML = 'Activate Account';
    }
}

async function findDefaultEmployee(email, password) {
    const employeesRef = ref(db, 'smartfit_AR_Database_shoe_users/employees');
    const snapshot = await get(employeesRef);
    
    let employee = null;
    
    snapshot.forEach((child) => {
        const data = child.val();
        if (data.email === email && data.isDefaultAccount && data.tempPassword === password) {
            employee = {
                id: child.key,
                data: data
            };
        }
    });
    
    return employee;
}

async function updateEmployeeRecord(employeeId, uid, newEmail) {
    // First get the current employee data
    const employeeRef = ref(db, `smartfit_AR_Database_shoe_users/employees/${employeeId}`);
    const snapshot = await get(employeeRef);
    const employeeData = snapshot.val();
    
    // Create updates object
    const updates = {};
    
    // Prepare the new employee data with UID as key
    updates[`smartfit_AR_Database_shoe_users/employees/${uid}`] = {
        ...employeeData,
        uid: uid,
        email: newEmail,
        status: 'active',
        isDefaultAccount: false,
        tempPassword: null,
        lastActivated: new Date().toISOString()
    };
    
    // Remove the old default entry
    updates[`smartfit_AR_Database_shoe_users/employees/${employeeId}`] = null;
    
    // Perform the update
    await update(ref(db), updates);
}

function handleActivationError(error) {
    let errorMessage = "Activation failed. ";
    
    if (error.code) {
        switch(error.code) {
            case 'auth/email-already-in-use':
                errorMessage += "This email is already registered.";
                break;
            case 'auth/invalid-email':
                errorMessage += "Invalid email format.";
                break;
            case 'auth/weak-password':
                errorMessage += "Password should be at least 6 characters.";
                break;
            default:
                errorMessage += "Please try again later.";
        }
    } else {
        switch(error.message) {
            case 'Default account not found or already activated':
                errorMessage += "No account found with this email or account already activated.";
                break;
            default:
                errorMessage += "Please try again later.";
        }
    }
    
    alert(errorMessage);
}

document.addEventListener('DOMContentLoaded', initActivation);