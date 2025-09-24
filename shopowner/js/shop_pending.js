import { checkUserAuth } from "../../firebaseMethods.js";

const user = await checkUserAuth();
if (user.userData.status == 'rejected') {
    window.location.href = "/shopowner/html/shop_rejected.html";
}else if (user.userData.status == 'active') {
    window.location.href = "/shopowner/html/shop_dashboard.html";
}