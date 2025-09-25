import { checkUserAuth, logoutUser } from "../../firebaseMethods.js";


// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

const user = await checkUserAuth();
function isLoggedIn() {
    if (!user.authenticated) {
        window.location.href = "/login.html";
    }else if (user.userData.status == 'rejected') {
        window.location.href = "/shopowner/html/shop_rejected.html";
    }else if (user.userData.status == 'pending') {
        window.location.href = "/shopowner/html/shop_pending.html";
    } 
}
isLoggedIn();

const authStatus = await checkUserAuth();
if (authStatus.authenticated) {
    console.log(`User is ${authStatus.role}`, authStatus.userData);
    getElement('userFullname').textContent = authStatus.userData.ownerName;
    // getElement('userName_display2').textContent = authStatus.userData.firstName + " " + authStatus.userData.lastName;
    // getElement('imageProfile').src = authStatus.userData.profilePhoto || "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    // document.body.style.display = '';
    // const prod = await readData(`smartfit_AR_Database/shoe`);
    // await loadAllShoes(prod);
} else {
    window.location.href = "/login.html";
}

getElement('logout_btn').addEventListener('click', async () => {
    await logoutUser();
    window.location.href = "/login.html";
});

let shopLoggedin;
let currentOrderId = null;
let currentUserId = null;
// // Expose functions to global scope
// window.viewOrderDetails = viewOrderDetails;
// window.viewShoeDetails = viewShoeDetails;

// async function viewOrderDetails(orderId) {
//     currentOrderId = orderId;
//     try {
//         const transactionsRef = ref(db, 'AR_shoe_users/transactions');
//         const snapshot = await get(transactionsRef);

//         if (!snapshot.exists()) {
//             alert('Order not found');
//             return;
//         }

//         let foundOrder = null;
//         snapshot.forEach((userSnapshot) => {
//             const userOrders = userSnapshot.val();
//             if (userOrders[orderId]) {
//                 const order = userOrders[orderId];
//                 const items = order.order_items ? Object.values(order.order_items) :
//                     order.item ? [order.item] : [];

//                 if (items.some(item => item.shopId === shopLoggedin)) {
//                     currentUserId = userSnapshot.key; // Set the currentUserId here
//                     foundOrder = {
//                         ...order,
//                         orderId: orderId,
//                         userId: userSnapshot.key
//                     };
//                     return true;
//                 }
//             }
//         });

//         if (foundOrder) {
//             displayOrderModal(foundOrder);
//         } else {
//             alert('Order not found');
//         }
//     } catch (error) {
//         console.error("Error fetching order:", error);
//         alert("Error loading order details");
//     }
// }

// function loadRecentOrders() {
//     const ordersRef = ref(db, 'AR_shoe_users/transactions');

//     // Use onValue for real-time updates
//     onValue(ordersRef, (snapshot) => {
//         if (!snapshot.exists()) {
//             displayRecentOrders([]);
//             return;
//         }

//         const orders = [];
//         snapshot.forEach((userSnapshot) => {
//             const userOrders = userSnapshot.val();
//             for (const orderId in userOrders) {
//                 const order = userOrders[orderId];
//                 const items = order.order_items ? Object.values(order.order_items) :
//                     order.item ? [order.item] : [];

//                 if (items.some(item => item.shopId === shopLoggedin)) {
//                     orders.push({
//                         ...order,
//                         orderId: orderId,
//                         userId: userSnapshot.key
//                     });
//                 }
//             }
//         });

//         const recentOrders = orders.sort((a, b) =>
//             new Date(b.date) - new Date(a.date)
//         ).slice(0, 5);

//         displayRecentOrders(recentOrders);
//     }, (error) => {
//         console.error("Error loading recent orders:", error);
//         displayRecentOrders([]);
//     });
// }

// function displayRecentOrders(orders) {
//     const ordersTable = document.querySelector('.order-table tbody');
//     if (!ordersTable) return;

//     ordersTable.innerHTML = orders.length === 0 ?
//         ordersContainer.innerHTML = `
//             <div class="empty-state" style="grid-column: 1 / -1; min-height: 200px;">
//                 <i class="fas fa-shopping-bag"></i>
//                 <h3>No Orders Yet</h3>
//                 <p>When customers place orders, they'll appear here</p>
//                 <a href="/shopowner/html/shopowner_addshoe.html" class="btn">
//                     <i class="fas fa-plus"></i> Add shoe to start selling
//                 </a>
//             </div>
//         ` : orders.map(order => {
//             const customerName = order.shippingInfo ?
//                 `${order.shippingInfo.firstName} ${order.shippingInfo.lastName}` :
//                 'Unknown Customer';

//             const orderDate = new Date(order.date).toLocaleDateString('en-US', {
//                 year: 'numeric',
//                 month: 'short',
//                 day: 'numeric'
//             });

//             const amount = order.totalAmount ?
//                 `₱${order.totalAmount.toFixed(2)}` : '₱ 0.00';

//             const status = order.status || 'pending';
//             const statusClass = status === 'completed' ? 'shipped' :
//                 status === 'processing' ? 'pending' :
//                     status === 'cancelled' ? 'cancelled' : 'pending';

//             return `
//                 <tr>
//                     <td>#${order.orderId}</td>
//                     <td>${customerName}</td>
//                     <td>${orderDate}</td>
//                     <td>${amount}</td>
//                     <td><span class="status ${statusClass}">${status}</span></td>
//                     <td>
//                         <button class="btn btn-view" onclick="viewOrderDetails('${order.orderId}')">
//                             <i class="fas fa-eye"></i> View
//                         </button>
//                     </td>
//                 </tr>
//             `;
//         }).join('');
// }

// async function getAllOrdersByShopId(shopId) {
//     try {
//         const ordersRef = ref(db, 'AR_shoe_users/transactions');
//         const snapshot = await get(ordersRef);

//         if (!snapshot.exists()) return [];

//         const orders = [];
//         snapshot.forEach((userSnapshot) => {
//             const userOrders = userSnapshot.val();
//             for (const orderId in userOrders) {
//                 const order = userOrders[orderId];
//                 const items = order.order_items ? Object.values(order.order_items) :
//                     order.item ? [order.item] : [];

//                 if (items.some(item => item.shopId === shopId)) {
//                     orders.push({
//                         ...order,
//                         orderId: orderId,
//                         userId: userSnapshot.key
//                     });
//                 }
//             }
//         });

//         return orders;
//     } catch (error) {
//         console.error("Error fetching orders:", error);
//         throw error;
//     }
// }

// function loadShopDashboard() {
//     // These will now be real-time listeners
//     loadShopStats();
//     loadRecentProducts();
//     loadRecentOrders();
// }

// function loadShopStats() {
//     const shoesRef = ref(db, `AR_shoe_users/shoe/${shopLoggedin}`);
//     onValue(shoesRef, (snapshot) => {
//         if (snapshot.exists()) {
//             let totalProducts = 0;
//             let totalStock = 0;

//             snapshot.forEach((childSnapshot) => {
//                 totalProducts++;
//                 const shoe = childSnapshot.val();

//                 if (shoe.variants) {
//                     const variants = Array.isArray(shoe.variants) ?
//                         shoe.variants : Object.values(shoe.variants || {});

//                     variants.forEach(variant => {
//                         if (variant.sizes) {
//                             const sizes = Array.isArray(variant.sizes) ?
//                                 variant.sizes : Object.values(variant.sizes || {});

//                             sizes.forEach(size => {
//                                 totalStock += parseInt(size.stock) || 0;
//                             });
//                         }
//                     });
//                 }
//             });

//             const productsElement = document.querySelector('.stats-grid .stat-card:nth-child(3) .value');
//             const stockElement = document.querySelector('.stats-grid .stat-card:nth-child(4) .value');

//             if (productsElement) productsElement.textContent = totalProducts;
//             if (stockElement) stockElement.textContent = totalStock;
//         }
//     });
// }

// function loadRecentProducts() {
//     const shoesRef = ref(db, `AR_shoe_users/shoe/${shopLoggedin}`);
//     const recentAddedContainer = document.getElementById('recentAdded');

//     onValue(shoesRef, (snapshot) => {
//         if (snapshot.exists()) {
//             const shoes = [];
//             snapshot.forEach((childSnapshot) => {
//                 const shoe = childSnapshot.val();
//                 shoe.id = childSnapshot.key;
//                 shoes.push(shoe);
//             });

//             const recentShoes = shoes
//                 .sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0))
//                 .slice(0, 4);


//             displayRecentProducts(recentShoes, recentAddedContainer);
//         } else if (recentAddedContainer) {
//             recentAddedContainer.innerHTML = `
//                 <div class="empty-state">
//                     <i class="fas fa-shoe-prints"></i>
//                     <h3>No Recent Additions</h3>
//                     <p>New products you add will appear here</p>
//                     <a href="/shopowner/html/shopowner_addshoe.html" class="btn">
//                         <i class="fas fa-plus"></i> Add Another Product
//                     </a>
//                 </div>
//             `;
//         }
//     });
// }

// function displayRecentProducts(shoes, container) {
//     if (!container) return;

//     if (shoes.length === 0) {
//         container.innerHTML = '<p>No shoes added yet</p>';
//         return;
//     }

//     let html = '';

//     shoes.forEach(shoe => {
//         // Get variants - handle both array and object formats
//         const variants = shoe.variants
//             ? (Array.isArray(shoe.variants)
//                 ? shoe.variants
//                 : Object.values(shoe.variants || {}))
//             : [];

//         const firstVariant = variants[0] || null;
//         const price = firstVariant ? `₱${firstVariant.price}` : '₱0.00';
        
//         // Get all unique colors from variants
//         const colors = [...new Set(variants.map(v => v.color))];
//         const colorText = colors.length > 0 
//             ? colors.join(', ') 
//             : 'No color';
            
//         const imageUrl = shoe.defaultImage || (firstVariant ? firstVariant.imageUrl : null);

//         html += `
//         <div class="product-list">
//             <div class="product-card">
//                 <div class="product-image">
//                     ${imageUrl
//                     ? `<img src="${imageUrl}" alt="${shoe.shoeName}" class="shoe-thumbnail">`
//                     : '<div class="no-image">No Image</div>'
//                     }
//                 </div>
//                 <div class="product-info">
//                     <h3 class="product-title">${shoe.shoeName || 'No Name'}</h3>
//                     <div class="product-meta">
//                         <span class="product-brand">${shoe.shoeBrand || 'No Brand'}</span>
//                         <span class="product-type">${shoe.shoeType || 'No Type'}</span>
//                     </div>
//                     <div class="product-code">Code: ${shoe.shoeCode || 'N/A'}</div>
//                     <div class="product-price">${price}</div>
//                     <div class="product-color">Colors: ${colorText}</div>
//                     <button class="btn btn-view" onclick="viewShoeDetails('${shoe.id}')">
//                         <i class="fas fa-eye"></i> View
//                     </button>
//                 </div>
//             </div>
//         </div>
//         `;
//     });

//     html += '</div>';
//     container.innerHTML = html;
// }

// function viewShoeDetails(shoeId) {
//     window.location.href = `/shopowner/html/shop_inventory.html?shoeId=${shoeId}`;
// }

// function displayOrderModal(order) {
//     const modalContent = document.getElementById('orderDetailsContent');
//     const orderDate = new Date(order.date).toLocaleString();

//     const items = order.order_items ? Object.values(order.order_items) :
//         order.item ? [order.item] : [];

//     const itemsHtml = items.map(item => `
//         <div class="order-item">
//             <img src="${item.imageUrl || 'https://via.placeholder.com/150'}" 
//                  alt="${item.name}" class="order-item-image">
//             <div class="order-item-details">
//                 <div class="order-item-title">${item.name}</div>
//                 <div class="order-item-variant">${item.variantName} (${item.color}) - Size: ${item.size}</div>
//                 <div>Quantity: ${item.quantity}</div>
//                 <div class="order-item-price">₱${(item.price * item.quantity).toFixed(2)}</div>
//             </div>
//         </div>
//     `).join('');

//     modalContent.innerHTML = `
//         <div class="order-details-grid">
//             <div>
//                 <div class="order-details-section">
//                     <h3>Order Information</h3>
//                     <p><strong>Order ID:</strong> ${order.orderId}</p>
//                     <p><strong>Date:</strong> ${orderDate}</p>
//                     <p><strong>Status:</strong> <span class="status ${order.status}">${order.status}</span></p>
//                     <p><strong>Total:</strong> ₱${order.totalAmount?.toFixed(2) || '0.00'}</p>
//                 </div>
                
//                 <div class="order-details-section">
//                     <h3>Shipping Information</h3>
//                     <p><strong>Name:</strong> ${order.shippingInfo.firstName} ${order.shippingInfo.lastName}</p>
//                     <p><strong>Address:</strong> ${order.shippingInfo.address}, ${order.shippingInfo.city}</p>
//                     <p><strong>Country:</strong> ${order.shippingInfo.country}</p>
//                     <p><strong>ZIP:</strong> ${order.shippingInfo.zip}</p>
//                     <p><strong>Phone:</strong> ${order.shippingInfo.phone}</p>
//                     <p><strong>Email:</strong> ${order.shippingInfo.email}</p>
//                 </div>
//             </div>
            
//             <div>
//                 <div class="order-details-section">
//                     <h3>Order Items</h3>
//                     ${itemsHtml}
//                 </div>
//             </div>
//         </div>
//     `;

//     const acceptBtn = document.getElementById('acceptOrderBtn');
//     const rejectBtn = document.getElementById('rejectOrderBtn');

//     if (order.status === 'pending') {
//         acceptBtn.style.display = 'inline-block';
//         rejectBtn.style.display = 'inline-block';
//     } else {
//         acceptBtn.style.display = 'none';
//         rejectBtn.style.display = 'none';
//     }

//     document.getElementById('orderModal').style.display = 'block';
// }

// async function acceptOrder() {
//     if (!currentOrderId || !currentUserId) {
//         console.error("Missing order ID or user ID");
//         return;
//     }

//     try {
//         const orderRef = ref(db, `AR_shoe_users/transactions/${currentUserId}/${currentOrderId}`);
//         await update(orderRef, {
//             status: 'accepted',
//             updatedAt: new Date().toISOString()
//         });

//         alert('Order accepted successfully');
//         document.getElementById('orderModal').style.display = 'none';
//         loadRecentOrders(); // Refresh the orders list
//     } catch (error) {
//         console.error("Error accepting order:", error);
//         alert("Failed to accept order");
//     }
// }

// async function rejectOrder() {
//     if (!currentOrderId || !currentUserId) {
//         console.error("Missing order ID or user ID");
//         return;
//     }

//     const reason = document.getElementById('rejectionReason').value.trim();
//     if (!reason) {
//         alert('Please provide a reason for rejection');
//         return;
//     }

//     try {
//         const orderRef = ref(db, `AR_shoe_users/transactions/${currentUserId}/${currentOrderId}`);
//         await update(orderRef, {
//             status: 'rejected',
//             rejectionReason: reason,
//             updatedAt: new Date().toISOString()
//         });

//         document.getElementById('rejectionReason').value = '';
//         document.getElementById('rejectModal').style.display = 'none';
//         document.getElementById('orderModal').style.display = 'none';

//         alert('Order rejected successfully');
//         loadRecentOrders(); // Refresh the orders list
//     } catch (error) {
//         console.error("Error rejecting order:", error);
//         alert("Failed to reject order");
//     }
// }

// onAuthStateChanged(auth, async (user) => {
//     if (user) {
//         const userRef = ref(db, `AR_shoe_users/employees/${user.uid}`);
//         onValue(userRef, async (snapshot) => {
//             if (snapshot.exists()) {
//                 const userData = snapshot.val();
//                 console.log(userData.role);

//                 shopLoggedin = userData.shopId;
                
//                 // Update profile picture and name for employees
//                 updateProfileHeader(userData);
                
//                 const orders = await getAllOrdersByShopId(shopLoggedin);

//                 if (userData.role.toLowerCase() === "manager") {
//                     document.getElementById("addemployeebtn").style.display = "none";
//                 } else if (userData.role.toLowerCase() === "salesperson") {
//                     document.getElementById("addemployeebtn").style.display = "none";
//                     document.getElementById("analyticsbtn").style.display = "none";
//                 }

//                 await loadShopDashboard();
//                 await loadTopProducts();
//             } else {
//                 shopLoggedin = user.uid;
                
//                 // Load shop owner data for profile header
//                 const shopRef = ref(db, `AR_shoe_users/shop/${user.uid}`);
//                 onValue(shopRef, (shopSnapshot) => {
//                     if (shopSnapshot.exists()) {
//                         const shopData = shopSnapshot.val();
//                         updateProfileHeader(shopData);
//                     }
//                 });
                
//                 try {
//                     const orders = await getAllOrdersByShopId(shopLoggedin);
//                     await loadShopDashboard();
//                     await loadTopProducts();
//                 } catch (error) {
//                     console.error("Error loading dashboard:", error);
//                 }
//             }
//         }, { onlyOnce: true });
//     } else {
//         window.location.href = "/user_login.html";
//     }
// });

// function updateProfileHeader(userData) {
//     const profilePicture = document.getElementById('profilePicture');
//     const userFullname = document.getElementById('userFullname');
    
//     // Set profile name
//     if (userData.name) {
//         userFullname.textContent = userData.name;
//     } else if (userData.shopName) {
//         userFullname.textContent = userData.shopName;
//     }
    
//     // Set profile picture
//     if (userData.profilePhoto && userData.profilePhoto.url) {
//         profilePicture.src = userData.profilePhoto.url;
//     } else if (userData.uploads && userData.uploads.shopLogo && userData.uploads.shopLogo.url) {
//         profilePicture.src = userData.uploads.shopLogo.url;
//     } else {
//         // Set default avatar if no image available
//         profilePicture.src = "#";
//     }
// }

// window.acceptOrder = acceptOrder;
// window.rejectOrder = rejectOrder;

// document.addEventListener('DOMContentLoaded', () => {
//     const searchInput = document.getElementById('searchInventory');
//     if (searchInput) {
//         searchInput.addEventListener('input', (e) => {
//             const term = e.target.value.toLowerCase();
//             document.querySelectorAll('#inventoryTable tbody tr').forEach(row => {
//                 const name = row.children[1]?.textContent.toLowerCase() || '';
//                 const code = row.children[2]?.textContent.toLowerCase() || '';
//                 row.style.display = (name.includes(term) || code.includes(term)) ? '' : 'none';
//             });
//         });
//     }

//     const logoutBtn = document.getElementById('logout_btn');
//     if (logoutBtn) {
//         logoutBtn.addEventListener('click', () => {
//             if (confirm('Are you sure you want to logout?')) {
//                 auth.signOut().then(() => {
//                     window.location.href = '/user_login.html';
//                 }).catch((error) => {
//                     console.error('Error signing out:', error);
//                 });
//             }
//         });
//     }

//     document.querySelectorAll('.close-modal').forEach(btn => {
//         btn.addEventListener('click', () => {
//             document.querySelectorAll('.modal').forEach(modal => {
//                 modal.style.display = 'none';
//             });
//         });
//     });

//     document.getElementById('acceptOrderBtn')?.addEventListener('click', acceptOrder);
//     document.getElementById('rejectOrderBtn')?.addEventListener('click', () => {
//         document.getElementById('rejectModal').style.display = 'block';
//     });
//     document.getElementById('confirmRejectBtn')?.addEventListener('click', rejectOrder);
//     document.getElementById('cancelRejectBtn')?.addEventListener('click', () => {
//         document.getElementById('rejectModal').style.display = 'none';
//     });

//     window.addEventListener('click', (event) => {
//         if (event.target.classList.contains('modal')) {
//             document.querySelectorAll('.modal').forEach(modal => {
//                 modal.style.display = 'none';
//             });
//         }
//     });
// });

// async function loadTopProducts() {
//     try {
//         const feedbacksRef = ref(db, 'AR_shoe_users/feedbacks');
//         const shoesRef = ref(db, 'AR_shoe_users/shoe/' + shopLoggedin);
//         const [feedbacksSnapshot, shoesSnapshot] = await Promise.all([get(feedbacksRef), get(shoesSnapshot)]);

//         console.log("Shoes data:", shoesSnapshot.val()); // Debug log
        
//         if (!feedbacksSnapshot.exists() || !shoesSnapshot.exists()) {
//             console.log("No feedbacks or shoes found"); // Debug log
//             displayTopProducts([]);
//             return;
//         }

//         // Collect all feedbacks and calculate average ratings
//         const productRatings = {};
//         feedbacksSnapshot.forEach((userSnapshot) => {
//             const userFeedbacks = userSnapshot.val();
//             for (const feedbackId in userFeedbacks) {
//                 const feedback = userFeedbacks[feedbackId];
//                 if (feedback.shopId === shopLoggedin) { // Only consider feedback for this shop
//                     if (!productRatings[feedback.shoeID]) {
//                         productRatings[feedback.shoeID] = {
//                             totalRating: 0,
//                             count: 0
//                         };
//                     }
//                     productRatings[feedback.shoeID].totalRating += feedback.rating;
//                     productRatings[feedback.shoeID].count++;
//                 }
//             }
//         });

//         console.log("Product ratings:", productRatings); // Debug log

//         // Calculate average ratings and filter products with rating >= 3.0
//         const ratedProducts = [];
//         const shoesData = shoesSnapshot.val();
        
//         // Iterate through shoes in this shop
//         for (const shoeId in shoesData) {
//             if (productRatings[shoeId]) {
//                 const avgRating = productRatings[shoeId].totalRating / productRatings[shoeId].count;
//                 if (avgRating >= 3.0) {
//                     ratedProducts.push({
//                         ...shoesData[shoeId],
//                         id: shoeId,
//                         avgRating: avgRating,
//                         feedbackCount: productRatings[shoeId].count
//                     });
//                 }
//             }
//         }

//         console.log("Rated products:", ratedProducts); // Debug log

//         // Sort by rating (highest first) and get top 5
//         const topProducts = ratedProducts.sort((a, b) => b.avgRating - a.avgRating).slice(0, 5);

//         displayTopProducts(topProducts);
//     } catch (error) {
//         console.error("Error loading top products:", error);
//         displayTopProducts([]);
//     }
// }

// function displayTopProducts(products) {
//     const topProductsGrid = document.getElementById('topProductsGrid');
//     if (!topProductsGrid) return;

//     if (products.length === 0) {
//         topProductsGrid.innerHTML = `
//             <div class="empty-state">
//                 <i class="fas fa-shoe-prints"></i>
//                 <h3>No Products Added</h3>
//                 <p>Start by adding your first product to showcase in your store</p>
//                 <a href="/shopowner/html/shopowner_addshoe.html" class="btn">
//                     <i class="fas fa-plus"></i> Add First Product
//                 </a>
//             </div>
//         `;
//         return;
//     }

//     let html = '';
//     products.forEach(product => {
//         // Get variants - handle both array and object formats
//         const variants = product.variants
//             ? (Array.isArray(product.variants)
//                 ? product.variants
//                 : Object.values(product.variants || {}))
//             : [];

//             console.log(variants);
//             console.log(product);
//         const firstVariant = variants[0] || null;
//         const price = firstVariant ? `₱${firstVariant.price}` : '₱0.00';
        
//         // Get all unique colors from variants
//         const colors = [...new Set(variants.map(v => v.color))];
//         const colorText = colors.length > 0 
//             ? colors.join(', ') 
//             : 'No color';
            
//         const imageUrl = product.defaultImage || (firstVariant ? firstVariant.imageUrl : null);

//         html += `
//         <div class="product-card">
//             <div class="product-image">
//                 ${imageUrl
//                 ? `<img src="${imageUrl}" alt="${product.shoeName}" class="shoe-thumbnail">`
//                 : '<div class="no-image">No Image</div>'
//                 }
//                 <div class="product-badge">
//                     ${product.avgRating.toFixed(1)} <i class="fas fa-star"></i>
//                 </div>
//             </div>
//             <div class="product-info">
//                 <h3 class="product-title">${product.shoeName || 'No Name'}</h3>
//                 <div class="product-meta">
//                     <span class="product-brand">${product.shoeBrand || 'No Brand'}</span>
//                     <span class="product-type">${product.shoeType || 'No Type'}</span>
//                 </div>
//                 <div class="product-code">Code: ${product.shoeCode || 'N/A'}</div>
//                 <div class="product-price">${price}</div>
//                 <div class="product-color">Colors: ${colorText}</div>
//                 <div class="product-stats">
//                     <div class="product-stat">
//                         <i class="fas fa-star"></i> ${product.avgRating.toFixed(1)} (${product.feedbackCount} reviews)
//                     </div>
//                 </div>
//                 <button class="btn btn-view" onclick="viewShoeDetails('${product.id}')">
//                     <i class="fas fa-eye"></i> View
//                 </button>
//             </div>
//         </div>
//         `;
//     });

//     topProductsGrid.innerHTML = html;
// }