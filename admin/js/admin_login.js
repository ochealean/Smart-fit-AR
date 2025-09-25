import { signInWithEmailAndPasswordWrapper, checkUserAuth } from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

function redirectToDashboard(role) {
    switch (role) {
        case 'customer': window.location.href = "customer/html/customer_dashboard.html"; break;
        case 'shopowner': window.location.href = "shopowner/html/shop_dashboard.html"; break;
        case 'employee': window.location.href = "shopowner/html/shop_dashboard.html"; break;
        default: window.location.href = "admin_dashboard.html"; break;
    }
}

// Check if user is already logged in
checkUserAuth().then(user => {
    if (user.authenticated) {
        console.log("User is already logged in:", user);
        redirectToDashboard(user.role);
    }
}).catch(error => {
    console.error("Error checking user auth:", error);
});

// pag meron nang html file for landing page, uncomment this
const loginButton_customer = document.getElementById('loginButton_customer');
loginButton_customer.addEventListener('click', async (event) => {
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

    event.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    const loginResult = await signInWithEmailAndPasswordWrapper(email, password);
    
        if (loginResult.success) {
            const userLoggedIn = await checkUserAuth();
            if (userLoggedIn.authenticated) {
                redirectToDashboard(userLoggedIn.role);
            } else {
                console.error("User authentication failed after login");
                alert("Login failed. Please try again.");
            }
        } else {
            console.error("Login failed:", loginResult.error);
            alert("Wrong email or password. Please try again.");
        }
});
