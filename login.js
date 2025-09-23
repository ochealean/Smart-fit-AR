import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { getAuth, sendPasswordResetEmail, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAuPALylh11cTArigeGJZmLwrFwoAsNPSI",
    authDomain: "opportunity-9d3bf.firebaseapp.com",
    databaseURL: "https://opportunity-9d3bf-default-rtdb.firebaseio.com",
    projectId: "opportunity-9d3bf",
    storageBucket: "opportunity-9d3bf.firebasestorage.app",
    messagingSenderId: "57906230058",
    appId: "1:57906230058:web:2d7cd9cc68354722536453",
    measurementId: "G-QC2JSR1FJW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app); // Initialize database



// Customer Login
const loginButton_customer = document.getElementById('loginButton_customer');
loginButton_customer.addEventListener('click', (event) => {
    event.preventDefault();
    const email = document.getElementById('customer-email').value;
    const password = document.getElementById('customer-password').value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            if (user.emailVerified) {
                get(ref(db, `smartfit_AR_Database/customers/${user.uid}`))
                    .then((snapshot) => {
                        if (snapshot.exists()) {
                            alert("Login successful");
                            window.location.href = "/customer/html/customer_dashboard.html";
                        } else {
                            alert("Account does not exist");
                            auth.signOut();
                        }
                    });
            } else {
                alert("Please verify your email address before logging in.");
            }
        })
        .catch((error) => {
            console.log("Error logging in: " + error.message);
            alert("Wrong email or password. Please try again.");
        });
});

// Shop Login
const loginButton_shop = document.getElementById('loginButton_shop');
loginButton_shop.addEventListener('click', (event) => {
    event.preventDefault();
    const email = document.getElementById('shop-email').value;
    const password = document.getElementById('shop-password').value;

    // First check if this is a default account needing activation
    accountExistButNeedToActivate(email, password)
        .then(activationStatus => {
            if (activationStatus.needsActivation) {
                window.location.href = "account_activation/html/employee_activation.html?email=" + 
                    encodeURIComponent(email) + "&password=" + encodeURIComponent(password);
                return;
            }
            
            // If not a default account, proceed with normal login
            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    if (user.emailVerified) {
                        alert("email verified");
                        get(ref(db, `smartfit_AR_Database/shop/${user.uid}`))
                            .then((snapshot) => {
                                console.log("user uid:", user.uid);
                                if (snapshot.exists()) {
                                    checkShopStatus(user.uid);
                                } else {
                                    get(ref(db, `smartfit_AR_Database/employees/${user.uid}`))
                                        .then((snapshot) => {
                                            if (snapshot.exists()) {
                                                checkShopStatus(user.uid);
                                            } else {
                                                alert("Account does not exist");
                                                auth.signOut();
                                            }
                                        });
                                }
                            });
                    } else {
                        alert("Please verify your email address before logging in.");
                    }
                })
                .catch((error) => {
                    console.log("Error logging in: " + error.message);
                    alert("Wrong email or password. Please try again.");
                });
        })
        .catch(error => {
            console.error("Activation check failed:", error);
            alert("An error occurred. Please try again.");
        });
});

// Function to check shop status
function checkShopStatus(uid) {
    const shopStatusRef = ref(db, `smartfit_AR_Database/shop/${uid}/status`);

    get(shopStatusRef).then((snapshot) => {
        if (snapshot.exists()) {
            const status = snapshot.val();
            console.log("Shop status:", status); // Debugging line
            if (status === 'pending') {
                console.log("Shop status:", status); // Debugging line
                window.location.href = "shopowner/html/shop_pending.html"; // Redirect to pending page
            } else if (status === 'rejected') {
                console.log("Shop status:", status); // Debugging line
                window.location.href = "shopowner/html/shop_rejected.html?shopID=" + uid; // Redirect to rejected page
            } else {
                // If approved, redirect to the shop dashboard
                window.location.href = "shopowner/html/shop_dashboard.html";
            }
        } else {
            const shopStatusRefEmployee = ref(db, `smartfit_AR_Database/employees/${uid}/shopId`);

            get(shopStatusRefEmployee).then((snapshot) => {
                if (snapshot.exists()) {
                    const status = snapshot.val();
                    console.log("Shop status:", status); // Debugging line
                    if (status === 'pending') {
                        console.log("Shop status:", status); // Debugging line
                        window.location.href = "shopowner/html/shop_pending.html"; // Redirect to pending page
                    } else if (status === 'rejected') {
                        console.log("Shop status:", status); // Debugging line
                        window.location.href = "shopowner/html/shop_rejected.html"; // Redirect to rejected page
                    } else {
                        // If approved, redirect to the shop dashboard
                        window.location.href = "shopowner/html/shop_dashboard.html";
                    }
                } else {
                    console.error("Shop status not found.");
                    alert("Shop status not found. Please contact support.");
                    auth.signOut();
                    window.location.href = "user_login.html";
                }
            }).catch((error) => {
                console.error("Error fetching shop status:", error);
                alert("An error occurred while checking shop status. Please try again.");
                auth.signOut();
                window.location.href = "user_login.html";
            });
            // console.error("Shop status not found.");
            // alert("Shop status not found. Please contact support.");
            // auth.signOut();
            // window.location.href = "user_login.html";
        }
    }).catch((error) => {
        console.error("Error fetching shop status:", error);
        alert("An error occurred while checking shop status. Please try again.");
        auth.signOut();
        window.location.href = "user_login.html";
    });
}

document.getElementById('forgotPass_shop').addEventListener('click', async (event) => {
    event.preventDefault();
    const email = document.getElementById('shop-email').value.trim();

    if (!email) {
        alert("Please enter your email address.");
        return;
    }

    try {
        // First check if email exists in the database
        const shopsRef = ref(db, 'smartfit_AR_Database/shop');
        const snapshot = await get(shopsRef);

        let emailExists = false;
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const shop = childSnapshot.val();
                console.log(shop.email);
                console.log(email);
                if (shop.email === email) {
                    emailExists = true;
                }
            });
        }

        if (!emailExists) {
            alert("Your account is not registered as a shop owner");
            return;
        }

        // If email exists, send password reset
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent. Please check your inbox.");

    } catch (error) {
        console.error("Password reset error:", error);
        let errorMessage = "Error processing your request.";

        // Handle specific Firebase errors
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No user found with this email address.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Please enter a valid email address.";
        } else {
            errorMessage = error.message;
        }

        alert(errorMessage);
    }
});

document.getElementById('forgotPass_customer').addEventListener('click', async (event) => {
    event.preventDefault();
    const email = document.getElementById('customer-email').value.trim(); // Fixed: added parentheses to trim()

    if (!email) {
        alert("Please enter your email address.");
        return;
    }

    try {
        // First check if email exists in the database
        const customersRef = ref(db, 'smartfit_AR_Database/customer');
        const snapshot = await get(customersRef);

        let emailExists = false;
        let customerFound = null;

        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const customer = childSnapshot.val();
                if (customer.email && customer.email.toLowerCase() === email.toLowerCase()) {
                    emailExists = true;
                    customerFound = customer;
                }
            });
        }

        if (!emailExists) {
            alert("Your account is not registered as a customer");
            return;
        }

        // If email exists, send password reset
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent. Please check your inbox.");

    } catch (error) {
        console.error("Password reset error:", error);
        let errorMessage = "Error processing your request.";

        // Handle specific Firebase errors
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = "No user found with this email address.";
                break;
            case 'auth/invalid-email':
                errorMessage = "Please enter a valid email address.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Too many requests. Please try again later.";
                break;
            default:
                errorMessage = error.message || "An unknown error occurred.";
        }

        alert(errorMessage);
    }
});

function accountExistButNeedToActivate(email, password) {
    return new Promise(async (resolve, reject) => {
        try {
            // Check in employees collection for default accounts
            const employeesRef = ref(db, 'smartfit_AR_Database/employees');
            const snapshot = await get(employeesRef);

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const employee = childSnapshot.val();
                    // Check if it's a default account with matching email AND tempPassword
                    if (employee.email && 
                        employee.email.toLowerCase() === email.toLowerCase() &&
                        employee.isDefaultAccount === true &&
                        employee.tempPassword === password) {
                        resolve({
                            needsActivation: true,
                            employeeId: childSnapshot.key,
                            employeeData: employee
                        });
                        return; // Exit early if match found
                    }
                });
            }

            // If no matching default account found
            resolve({ needsActivation: false });
        } catch (error) {
            console.error("Error checking account status:", error);
            reject(error);
        }
    });
}