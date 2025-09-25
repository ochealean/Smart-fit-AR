import { checkUserAuth, logoutUser, readDataRealtime } from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check user authentication
        const user = await checkUserAuth();
        console.log('User auth result:', user);

        // Redirect based on status
        if (user.authenticated && user.userData) {
            if (user.userData.status === 'pending') {
                window.location.href = "/shopowner/html/shop_pending.html";
                return;
            } else if (user.userData.status === 'active') {
                window.location.href = "/shopowner/html/shop_dashboard.html";
                return;
            }
        } else {
            // User not authenticated, redirect to login
            window.location.href = "/login.html";
            return;
        }

        // If we get here, user is authenticated and status is 'rejected'
        const reasonsList = getElement('rejectionReasonsList');
        const reapplyBtn = getElement('reapplyBtn');
        const logoutBtn = getElement('logout_btn');

        // Function to display rejection reasons
        function displayRejectionReasons(rejectionReason) {
            if (rejectionReason) {
                if (Array.isArray(rejectionReason)) {
                    reasonsList.innerHTML = rejectionReason.map(reason => 
                        `<li>${reason}</li>`
                    ).join('');
                } else if (typeof rejectionReason === 'string') {
                    const reasons = rejectionReason.split('\n').filter(r => r.trim() !== '');
                    if (reasons.length > 0) {
                        reasonsList.innerHTML = reasons.map(reason => 
                            `<li>${reason.trim()}</li>`
                        ).join('');
                    } else {
                        reasonsList.innerHTML = '<li>Your shop application did not meet our requirements</li>';
                    }
                } else {
                    reasonsList.innerHTML = '<li>Your shop application did not meet our requirements</li>';
                }
            } else {
                reasonsList.innerHTML = '<li>Your shop application did not meet our requirements</li>';
            }
        }

        // Display initial rejection reasons
        displayRejectionReasons(user.userData.rejectionReason);

        // Set up real-time listener for shop data updates
        const shopPath = `smartfit_AR_Database/shop/${user.userId}`;
        const unsubscribe = readDataRealtime(shopPath, (result) => {
            if (result.success && result.data) {
                displayRejectionReasons(result.data.rejectionReason);
                
                // Check if status changed
                if (result.data.status === 'pending') {
                    window.location.href = "/shopowner/html/shop_pending.html";
                } else if (result.data.status === 'active') {
                    window.location.href = "/shopowner/html/shop_dashboard.html";
                }
            }
        });

        // Reapply button event listener
        reapplyBtn.addEventListener('click', () => {
            // Clean up the real-time listener before redirecting
            unsubscribe();
            window.location.href = `/shopowner/html/shop_reapply.html?shopID=${user.userId}`;
        });

        // Logout button event listener
        logoutBtn.addEventListener('click', async () => {
            // Clean up the real-time listener before logging out
            unsubscribe();
            const result = await logoutUser();
            if (result.success) {
                window.location.href = "/login.html";
            } else {
                console.error('Logout failed:', result.error);
            }
        });

    } catch (error) {
        console.error('Error initializing page:', error);
        window.location.href = "/login.html";
    }
});