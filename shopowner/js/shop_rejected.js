import { checkUserAuth, logoutUser } from "../../firebaseMethods.js";

const user = await checkUserAuth();
if (user.userData.status == 'pending') {
    window.location.href = "/shopowner/html/shop_pending.html";
} else if (user.userData.status == 'active') {
    window.location.href = "/shopowner/html/shop_dashboard.html";
}

getElement('logout_btn').addEventListener('click', async () => {
    await logoutUser();
    window.location.href = "/login.html";
});

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}
console.log(user);

// all inside the dom will only load after the dom is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log(user);
    const userId = localStorage.getItem('userId');
    const shopId = localStorage.getItem('shopId');
    const reapplyBtn = document.getElementById('reapplyBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const reasonsList = document.getElementById('rejectionReasonsList');

    const params = new URLSearchParams(window.location.search);
    const shop_ID = params.get("shopID"); // di mo na need local storage

    // if (!userId || !shopId) {
    //     window.location.href = '/user_login.html';
    //     // walang ganyan
    //     // window.location.href = '/shopowner/html/shopowner_login.html';
    //     return;
    // }

    // Load rejection reasons

    // try mong balik sa shopId na local storage mo yung shop_ID na nilagay ko para makita mo difference
    const shopRef = ref(db, `AR_shoe_users/shop/${shop_ID}`);
    onValue(shopRef, (snapshot) => {
        if (snapshot.exists()) {
            const shop = snapshot.val();
            const rejectionReason = shop.rejectionReason || "Your shop application did not meet our requirements";

            // Split reasons by newlines or bullet points
            const reasons = rejectionReason.split('\n').filter(r => r.trim() !== '');

            if (reasons.length === 0) {
                reasons.push("Your shop application did not meet our requirements");
            }

            reasonsList.innerHTML = reasons.map(reason =>
                `<li>${reason.trim()}</li>`
            ).join('');
        }
    });

    // Reapply button
    reapplyBtn.addEventListener('click', () => {
        // Redirect to registration page with shop ID for editing
        // window.location.href = `/shopowner/html/shop_reapply.html?shopId=${shopId}&reapply=true`;
        window.location.href = `/shopowner/html/shop_reapply.html?shopID=${shop_ID}`;
    });

});