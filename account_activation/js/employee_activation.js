import { 
    createUserWithEmailAndPasswordWrapper,
    sendEmailVerificationWrapper,
    updateData,
    readData,
    deleteData,
    generate18CharID
} from '../../firebaseMethods.js';

// DOM Elements
const activationForm = document.getElementById('activationForm');
const defaultEmailInput = document.getElementById('defaultEmail');
const defaultPasswordInput = document.getElementById('defaultPassword');
const newEmailInput = document.getElementById('newEmail');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const activateBtn = document.getElementById('activateBtn');

// Get email and password from URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const urlEmail = urlParams.get('email');
const urlPassword = urlParams.get('password');

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
        console.log('Step 1: Finding default employee');
        const employee = await findDefaultEmployee(defaultEmail, defaultPassword);
        
        console.log('Step 2: Employee found?', !!employee);
        if (!employee) {
            throw new Error('Default account not found or already activated');
        }

        console.log('Step 3: Creating Firebase Auth account');
        // 2. Create real Firebase Auth account using firebaseMethods
        // Note: createUserWithEmailAndPasswordWrapper returns the user credential directly, not a {success, user} object
        const userCredential = await createUserWithEmailAndPasswordWrapper(newEmail, newPassword);
        
        console.log('Step 4: Firebase Auth account created');
        const user = userCredential.user;

        console.log('Step 5: Updating employee record');
        // 3. Update the employee record in database using firebaseMethods
        await updateEmployeeRecord(employee.id, user.uid, newEmail);
        
        console.log('Step 6: Sending verification email');
        // 4. Send verification email using firebaseMethods
        await sendEmailVerificationWrapper(user);
        
        console.log('Step 7: Activation complete');
        alert(`
            Account activated successfully!
            A verification email has been sent to ${newEmail}.
            Please check your inbox.
        `);
        
        console.log('Step 8: Redirecting to login');
        window.location.href = "/login.html#shop"; 
    } catch (error) {
        console.error("Activation error:", error);
        handleActivationError(error);
    } finally {
        activateBtn.disabled = false;
        activateBtn.innerHTML = 'Activate Account';
    }
}

async function findDefaultEmployee(email, password) {
    try {
        console.log('Searching for employee with email:', email);
        // Read all employees data
        const employeesResult = await readData('smartfit_AR_Database/employees');
        
        if (!employeesResult.success) {
            console.log('No employees data found');
            return null;
        }

        const employees = employeesResult.data;
        console.log('Total employees found:', Object.keys(employees).length);
        
        let employee = null;

        // Find employee with matching email and default account status
        for (const employeeId in employees) {
            const employeeData = employees[employeeId];
            console.log('Checking employee:', employeeId, employeeData.email, employeeData.isDefaultAccount);
            
            if (employeeData.email === email && 
                employeeData.isDefaultAccount === true && 
                employeeData.tempPassword === password) {
                employee = {
                    id: employeeId,
                    data: employeeData
                };
                console.log('Found matching employee:', employee);
                break;
            }
        }
        
        if (!employee) {
            console.log('No matching employee found with criteria:');
            console.log('- Email match:', email);
            console.log('- Default account: true');
            console.log('- Temp password match: [hidden]');
        }
        
        return employee;
    } catch (error) {
        console.error('Error finding employee:', error);
        return null;
    }
}

async function updateEmployeeRecord(employeeId, uid, newEmail) {
    try {
        console.log('Updating employee record from', employeeId, 'to', uid);
        
        // First get the current employee data
        const employeeResult = await readData(`smartfit_AR_Database/employees/${employeeId}`);
        
        if (!employeeResult.success) {
            throw new Error('Failed to read employee data');
        }

        const employeeData = employeeResult.data;
        console.log('Current employee data:', employeeData);

        // Create the updated employee data with new UID
        const updatedEmployeeData = {
            ...employeeData,
            uid: uid,
            email: newEmail,
            status: 'active',
            isDefaultAccount: false,
            tempPassword: null,
            lastActivated: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };

        console.log('Updated employee data:', updatedEmployeeData);

        // Create new employee record with UID as key
        const createResult = await updateData(
            `smartfit_AR_Database/employees/${uid}`,
            updatedEmployeeData
        );

        if (!createResult.success) {
            throw new Error('Failed to create new employee record: ' + createResult.error);
        }

        console.log('New employee record created successfully');

        // Delete the old default employee record
        const deleteResult = await deleteData(`smartfit_AR_Database/employees/${employeeId}`);
        
        if (!deleteResult.success) {
            console.warn('Failed to delete old employee record, but new record was created:', deleteResult.error);
        } else {
            console.log('Old employee record deleted successfully');
        }

        return { success: true };
    } catch (error) {
        console.error('Error updating employee record:', error);
        throw error;
    }
}

function handleActivationError(error) {
    let errorMessage = "Activation failed. ";
    
    if (error.message) {
        if (error.message.includes('auth/email-already-in-use')) {
            errorMessage += "This email is already registered.";
        } else if (error.message.includes('auth/invalid-email')) {
            errorMessage += "Invalid email format.";
        } else if (error.message.includes('auth/weak-password')) {
            errorMessage += "Password should be at least 6 characters.";
        } else if (error.message.includes('Default account not found')) {
            errorMessage += "No account found with this email or account already activated.";
        } else if (error.message.includes('Failed to create new employee record')) {
            errorMessage += "Failed to save employee data. Please contact administrator.";
        } else {
            errorMessage += error.message;
        }
    } else {
        errorMessage += "Please try again later.";
    }
    
    alert(errorMessage);
}

// Initialize activation when DOM is loaded
document.addEventListener('DOMContentLoaded', initActivation);