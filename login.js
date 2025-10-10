import { signInWithEmailAndPasswordWrapper, checkUserAuth, readData, sendPasswordResetEmailWrapper, logoutUser } from "../../firebaseMethods.js";

var isUserAccountVerified;

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

function redirectToDashboard(role) {
    switch (role) {
        case 'customer': window.location.href = "customer/html/customer_dashboard.html"; break;
        case 'shopowner': window.location.href = "shopowner/html/shop_dashboard.html"; break;
        case 'shoemaker': window.location.href = "shopowner/html/shop_dashboard.html"; break;
        case 'employee': window.location.href = "shopowner/html/shop_dashboard.html"; break;
        default: console.error("Unknown role:", role);
    }
}

// Check if user is already logged in
checkUserAuth().then(user => {
    isUserAccountVerified = user.verifiedEmail;
    if (user.authenticated && user.verifiedEmail) {
        console.log("User is already logged in:", user);
        redirectToDashboard(user.role);
    }
}).catch(error => {
    console.error("Error checking user auth:", error);
});

// Customer Login
const loginButton_customer = getElement('loginButton_customer');
loginButton_customer.addEventListener('click', async (event) => {
    event.preventDefault();
    document.querySelector('.loader').style.display = 'flex'; // Show loader
    const email = getElement('customer-email').value;
    const password = getElement('customer-password').value;

    const loginResult = await signInWithEmailAndPasswordWrapper(email, password);

    if (loginResult.success) {
        const userLoggedIn = await checkUserAuth();
        if (userLoggedIn.authenticated) {
            redirectToDashboard(userLoggedIn.role);
        } else {
            console.error("User authentication failed after login");
            alert("Login failed. Please try again.");
            document.querySelector('.loader').style.display = 'none'; // hide loader
        }
    } else {
        console.error("Login failed:", loginResult.error);
        alert("Wrong email or password. Please try again.");
        document.querySelector('.loader').style.display = 'none'; // hide loader
    }
});

// Shop Login
const loginButton_shop = getElement('loginButton_shop');
loginButton_shop.addEventListener('click', async (event) => {
    event.preventDefault();
    document.querySelector('.loader').style.display = 'flex'; // Show loader
    const email = getElement('shop-email').value;
    const password = getElement('shop-password').value;

    try {
        // First check if this is a default account needing activation
        const activationStatus = await accountExistButNeedToActivate(email, password);

        if (activationStatus.needsActivation) {
            window.location.href = "account_activation/html/employee_activation.html?email=" +
                encodeURIComponent(email) + "&password=" + encodeURIComponent(password);
            return;
        }

        // If not a default account, proceed with normal login
        const loginResult = await signInWithEmailAndPasswordWrapper(email, password);

        if (loginResult.success) {
            const user = loginResult.user;

            if (user.emailVerified) {
                console.log("Email verified");
                await checkShopStatus(user.uid);
            } else {
                await logoutUser();
                alert("Please verify your email address before logging in.");
                document.querySelector('.loader').style.display = 'none'; // Show loader
            }
        } else {
            console.error("Login failed:", loginResult.error);
            alert("Wrong email or password. Please try again.");
            document.querySelector('.loader').style.display = 'none'; // hide loader
        }
    } catch (error) {
        console.error("Login process failed:", error);
        alert("An error occurred. Please try again.");
        document.querySelector('.loader').style.display = 'none'; // hide loader
    }
});

// Function to check shop status
async function checkShopStatus(uid) {
    try {
        // First check if user is a shop owner
        const shopResult = await readData(`smartfit_AR_Database/shop/${uid}`);

        if (shopResult.success) {
            const shopData = shopResult.data;
            console.log("Shop status:", shopData.status);

            if (shopData.status === 'pending') {
                window.location.href = "shopowner/html/shop_pending.html";
            } else if (shopData.status === 'rejected') {
                window.location.href = "shopowner/html/shop_rejected.html?shopID=" + uid;
            } else {
                window.location.href = "shopowner/html/shop_dashboard.html";
            }
            return;
        }

        // If not a shop owner, check if user is an employee
        const employeeResult = await readData(`smartfit_AR_Database/employees/${uid}`);

        if (employeeResult.success) {
            const employeeData = employeeResult.data;
            const shopId = employeeData.shopId;

            // Check the shop status using the employee's shopId
            const shopStatusResult = await readData(`smartfit_AR_Database/shop/${shopId}/status`);

            if (shopStatusResult.success) {
                const status = shopStatusResult.data;
                console.log("Shop status:", status);

                if (status === 'pending') {
                    window.location.href = "shopowner/html/shop_pending.html";
                } else if (status === 'rejected') {
                    window.location.href = "shopowner/html/shop_rejected.html?shopID=" + shopId;
                } else {
                    window.location.href = "shopowner/html/shop_dashboard.html";
                }
            } else {
                throw new Error("Shop status not found for employee");
            }
        } else {
            await logoutUser();
            alert("Account does not exist");
            window.location.href = "login.html";
        }
    } catch (error) {
        console.error("Error checking shop status:", error);
        await logoutUser();
        alert("An error occurred while checking shop status. Please try again.");
        window.location.href = "login.html";
    }
}

// Forgot password functions
getElement('forgotPass_shop').addEventListener('click', async (event) => {
    event.preventDefault();
    const email = getElement('shop-email').value.trim();

    if (!email) {
        alert("Please enter your email address.");
        return;
    }

    try {
        // Check if email exists in shop database
        const shopsResult = await readData('smartfit_AR_Database/shop');

        if (shopsResult.success) {
            const shops = shopsResult.data;
            let emailExists = false;

            for (const shopId in shops) {
                const shop = shops[shopId];
                if (shop.email === email) {
                    emailExists = true;
                    break;
                }
            }

            if (!emailExists) {
                alert("Your account is not registered as a shop owner");
                return;
            }

            await sendPasswordResetEmailWrapper(email);

        } else {
            alert("Error checking shop database");
        }
    } catch (error) {
        console.error("Password reset error:", error);
        alert("Error processing your request: " + error.message);
    }
});

getElement('forgotPass_customer').addEventListener('click', async (event) => {
    event.preventDefault();
    const email = getElement('customer-email').value.trim();

    if (!email) {
        alert("Please enter your email address.");
        return;
    }

    try {
        // Check if email exists in customer database
        const customersResult = await readData('smartfit_AR_Database/customers');

        if (customersResult.success) {
            const customers = customersResult.data;
            let emailExists = false;

            for (const customerId in customers) {
                const customer = customers[customerId];
                if (customer.email && customer.email.toLowerCase() === email.toLowerCase()) {
                    emailExists = true;
                    break;
                }
            }

            if (!emailExists) {
                alert("Your account is not registered as a customer");
                return;
            }

            await sendPasswordResetEmailWrapper(email);

        } else {
            alert("Error checking customer database");
        }
    } catch (error) {
        console.error("Password reset error:", error);
        alert("Error processing your request: " + error.message);
    }
});

// Function to check if account needs activation
async function accountExistButNeedToActivate(email, password) {
    try {
        // Check in employees collection for default accounts
        const employeesResult = await readData('smartfit_AR_Database/employees');

        if (employeesResult.success) {
            const employees = employeesResult.data;

            for (const employeeId in employees) {
                const employee = employees[employeeId];
                // Check if it's a default account with matching email AND tempPassword
                if (employee.email &&
                    employee.email.toLowerCase() === email.toLowerCase() &&
                    employee.isDefaultAccount === true &&
                    employee.tempPassword === password) {
                    return {
                        needsActivation: true,
                        employeeId: employeeId,
                        employeeData: employee
                    };
                }
            }
        }

        // If no matching default account found
        return { needsActivation: false };
    } catch (error) {
        console.error("Error checking account status:", error);
        throw error;
    }
}