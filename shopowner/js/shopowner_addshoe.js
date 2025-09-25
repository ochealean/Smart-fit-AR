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

// // shopowner_addshoe.js - With file type validation

// import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
// import { getDatabase, ref as dbRef, set } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
// import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";
// import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
// import { onValue } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

// // Firebase configuration
// const firebaseConfig = {
//     apiKey: "AIzaSyAuPALylh11cTArigeGJZmLwrFwoAsNPSI",
//     authDomain: "opportunity-9d3bf.firebaseapp.com",
//     databaseURL: "https://opportunity-9d3bf-default-rtdb.firebaseio.com",
//     projectId: "opportunity-9d3bf",
//     storageBucket: "opportunity-9d3bf.firebasestorage.app",
//     messagingSenderId: "57906230058",
//     appId: "1:57906230058:web:2d7cd9cc68354722536453",
//     measurementId: "G-QC2JSR1FJW"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getDatabase(app);
// const storage = getStorage(app);

// // Global variables
// let shopLoggedin; // shop ID of the logged-in user
// let roleLoggedin; // role of the logged-in user
// let sname; //shop name
// let variantCount = 0;

// // Allowed file types
// const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];

// // DOM Content Loaded event
// document.addEventListener('DOMContentLoaded', () => {
//     // Generate and set random 6-digit code for shoe
//     const random6DigitCode = generate6DigitCode();
//     document.getElementById('shoeCode').value = "" + random6DigitCode;

//     // Role-based access control
//     const userRole = localStorage.getItem('userRole');
//     if (userRole === "employee") {
//         document.querySelectorAll(".manager, .shopowner").forEach(el => el.style.display = "none");
//     } else if (userRole === "manager") {
//         document.querySelectorAll(".shopowner").forEach(el => el.style.display = "none");
//     }

//     // Logout functionality
//     document.getElementById('logout_btn').addEventListener('click', function() {
//         if (confirm('Are you sure you want to logout?')) {
//             auth.signOut().then(() => {
//                 window.location.href = '/user_login.html';
//             }).catch((error) => {
//                 console.error('Error signing out:', error);
//             });
//         }
//     });

//     // Add first color variant by default
//     addColorVariant();

//     // Add file type validation to all file inputs
//     setupFileInputValidation();
// });

// function setupFileInputValidation() {
//     // Main shoe image validation
//     document.getElementById('shoeImage').addEventListener('change', function (e) {
//         validateFileInput(this);
//     });

//     // Variant image validation will be added when variants are created
// }

// function validateFileInput(input) {
//     const file = input.files[0];
//     if (!file) return;

//     const fileType = file.type.toLowerCase();
//     const fileName = file.name.toLowerCase();
//     const fileExt = fileName.split('.').pop();

//     // Check if file type is allowed
//     if (!ALLOWED_FILE_TYPES.includes(fileType) && fileExt !== 'heic') {
//         alert('Only JPG, JPEG, PNG, and HEIC files are allowed.');
//         input.value = ''; // Clear the file input
//         return false;
//     }

//     return true;
// }

// // Firebase authentication state change handler
// onAuthStateChanged(auth, (user) => {
//     if (user) {
//         // Fetch shop name from database
//         const shopRef = dbRef(db, `AR_shoe_users/employees/${user.uid}`);
//         onValue(shopRef, (snapshot) => {
//             const shopData = snapshot.val();
//             console.log("shopData: ", shopData);

//             if (shopData) {
//                 // This is an employee
//                 roleLoggedin = shopData.role;
//                 shopLoggedin = shopData.shopId;
//                 sname = shopData.shopName;
//                 console.log(shopData);
//                 console.log(sname);
                
//                 // Update profile header for employees
//                 updateProfileHeader(shopData);

//                 // Set role-based UI elements
//                 if (shopData.role.toLowerCase() === "manager") {
//                     document.getElementById("addemployeebtn").style.display = "none";
//                 } else if (shopData.role.toLowerCase() === "salesperson") {
//                     document.getElementById("addemployeebtn").style.display = "none";
//                     document.getElementById("analyticsbtn").style.display = "none";
//                 }

//                 // If shopName isn't set in employee data, fetch it from shop data
//                 if (!sname && shopLoggedin) {
//                     const shopInfoRef = dbRef(db, `AR_shoe_users/shop/${shopLoggedin}`);
//                     onValue(shopInfoRef, (shopSnapshot) => {
//                         const shopInfo = shopSnapshot.val();
//                         if (shopInfo) {
//                             sname = shopInfo.shopName;
//                             console.log("Fetched shop name from shop data:", sname);
//                         }
//                     });
//                 }
//             } else {
//                 // This is a shop owner
//                 shopLoggedin = user.uid;
//                 roleLoggedin = "Shop Owner";

//                 // Fetch shop name from shop data
//                 const shopInfoRef = dbRef(db, `AR_shoe_users/shop/${shopLoggedin}`);
//                 onValue(shopInfoRef, (shopSnapshot) => {
//                     const shopInfo = shopSnapshot.val();
//                     if (shopInfo) {
//                         sname = shopInfo.shopName;
//                         console.log("Shop owner shop name:", sname);
                        
//                         // Update profile header for shop owners
//                         updateProfileHeader(shopInfo);
//                     } else {
//                         sname = 'Shop Owner'; // Default if shop data not found
//                     }
//                 });
//             }
//         }, (error) => {
//             console.error("Error fetching shop data:", error);
//             shopLoggedin = user.uid; // Fallback to user UID
//             sname = 'Unknown Shop';
//         });
//     } else {
//         window.location.href = "/user_login.html";
//     }
// });

// // Function to update profile header
// function updateProfileHeader(userData) {
//     const profilePicture = document.getElementById('profilePicture');
//     const userFullname = document.getElementById('userFullname');
    
//     // Set profile name
//     if (userData.name) {
//         userFullname.textContent = userData.name;
//     } else if (userData.shopName) {
//         userFullname.textContent = userData.shopName;
//     } else if (userData.ownerName) {
//         userFullname.textContent = userData.ownerName;
//     }
    
//     // Set profile picture
//     if (userData.profilePhoto && userData.profilePhoto.url) {
//         profilePicture.src = userData.profilePhoto.url;
//     } else if (userData.uploads && userData.uploads.shopLogo && userData.uploads.shopLogo.url) {
//         profilePicture.src = userData.uploads.shopLogo.url;
//     } else {
//         // Set default avatar if no image available
//         profilePicture.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23ddd'%3E%3Crect width='100' height='100'/%3E%3Ctext x='50%' y='50%' font-size='20' text-anchor='middle' dominant-baseline='middle' fill='%23666'%3EProfile%3C/text%3E%3C/svg%3E";
//     }
// }

// // Helper functions
// function generate6DigitCode() {
//     return Math.floor(100000 + Math.random() * 900000).toString();
// }

// function generate18CharID() {
//     const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
//     let result = '';
//     for (let i = 0; i < 18; i++) {
//         result += chars.charAt(Math.floor(Math.random() * chars.length));
//     }
//     return result;
// }

// // Form submission handler for Firebase
// document.getElementById('addShoeForm').addEventListener('submit', async (event) => {
//     event.preventDefault();

//     if (!shopLoggedin) {
//         alert("Please wait for authentication to complete");
//         return;
//     }

//     // Validate main image file type
//     const shoeImageFile = document.getElementById('shoeImage').files[0];
//     if (shoeImageFile && !validateFileInput(document.getElementById('shoeImage'))) {
//         return;
//     }

//     // Validate all variant image file types
//     const variantGroups = document.querySelectorAll('.variant-group');
//     for (const group of variantGroups) {
//         const variantId = group.dataset.variantId;
//         const variantImageInput = document.getElementById(`variantImage_${variantId}`);
//         if (variantImageInput.files[0] && !validateFileInput(variantImageInput)) {
//             return;
//         }
//     }

//     // Show loading modal
//     document.getElementById('loadingModal').style.display = 'block';

//     try {
//         // Get main shoe data
//         const shoeCode = document.getElementById('shoeCode').value;
//         const shoeName = document.getElementById('shoeName').value;
//         const shoeType = document.getElementById('shoeType').value;
//         const shoeBrand = document.getElementById('shoeBrand').value;
//         const shoeGender = document.getElementById('shoeGender').value;  // Added
//         const shoeDescription = document.getElementById('shoeDescription').value;
//         const random18CharID = generate18CharID();

//         // Get all variant data
//         const variants = {}; // Object to hold all variants

//         variantGroups.forEach((group, index) => {
//             const variantId = group.dataset.variantId;
//             const variantName = document.getElementById(`variantName_${variantId}`).value;
//             const color = document.getElementById(`color_${variantId}`).value;
//             const price = document.getElementById(`variantPrice_${variantId}`).value;
//             const variantImageFile = document.getElementById(`variantImage_${variantId}`).files[0];

//             const sizeContainer = document.getElementById(`sizeStockContainer_${variantId}`);
//             const sizeItems = sizeContainer.querySelectorAll('.size-stock-item');
//             const sizes = {};

//             sizeItems.forEach((item, sizeIndex) => {
//                 const sizeValue = item.querySelector('.size-input').value;
//                 const stock = item.querySelector('.stock-input').value;

//                 sizes[`size_${sizeIndex}`] = {
//                     [sizeValue]: {
//                         stock: parseInt(stock)
//                     }
//                 };
//             });

//             variants[`variant_${index}`] = {
//                 variantName,
//                 color,
//                 price: parseFloat(price),
//                 sizes,
//                 variantImageFile
//             };
//         });

//         // Upload main shoe image if exists
//         let shoeImageUrl = '';
//         if (shoeImageFile) {
//             shoeImageUrl = await uploadFile(shoeImageFile, `shoes/${shopLoggedin}/${random18CharID}_${shoeCode}/main_image`);
//         }

//         // Upload each variant image and format data
//         const variantEntries = Object.entries(variants);
//         const variantPromises = variantEntries.map(async ([key, variant]) => {
//             let variantImageUrl = '';
//             if (variant.variantImageFile) {
//                 variantImageUrl = await uploadFile(
//                     variant.variantImageFile,
//                     `shoes/${shopLoggedin}/${random18CharID}_${shoeCode}/${key}`
//                 );
//             }

//             return {
//                 [key]: {
//                     variantName: variant.variantName,
//                     color: variant.color,
//                     price: variant.price,
//                     imageUrl: variantImageUrl,
//                     sizes: variant.sizes
//                 }
//             };
//         });

//         const processedVariants = Object.assign({}, ...await Promise.all(variantPromises));

//         // Save all data to Firebase Database
//         await set(dbRef(db, `AR_shoe_users/shoe/${shopLoggedin}/${random18CharID}_${shoeCode}`), {
//             shoeName: shoeName,
//             shoeCode: shoeCode,
//             shoeType: shoeType,
//             shoeBrand: shoeBrand,
//             shoeGender: shoeGender,  // Added
//             generalDescription: shoeDescription,
//             defaultImage: shoeImageUrl,
//             variants: processedVariants,
//             shopLoggedin: shopLoggedin,
//             shopName: sname,
//             roleWhoAdded: roleLoggedin,
//             dateAdded: new Date().toISOString()
//         });

//         // Reset form
//         document.getElementById('addShoeForm').reset();
//         document.getElementById('colorVariants').innerHTML = '';
//         addColorVariant();
//         alert("Shoe added successfully!");
//     } catch (error) {
//         console.error("Error adding shoe: ", error);
//         alert("Error adding shoe: " + error.message);
//     } finally {
//         // Hide loading modal
//         document.getElementById('loadingModal').style.display = 'none';
//         window.location.href = "/shopowner/html/shop_inventory.html"; // Redirect to dashboard
//     }
// });

// // File upload function
// async function uploadFile(file, path) {
//     try {
//         const fileRef = storageRef(storage, path);
//         const uploadTask = uploadBytesResumable(fileRef, file);

//         // Wait for the upload to complete
//         await uploadTask;

//         // Get the download URL
//         const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
//         return downloadURL;
//     } catch (error) {
//         console.error("Upload failed:", error);
//         throw error; // Re-throw the error to handle it in the calling function
//     }
// }

// // Variant management functions
// function addColorVariant() {
//     variantCount++;
//     const container = document.getElementById('colorVariants');

//     const variant = document.createElement('div');
//     variant.className = 'variant-group';
//     variant.dataset.variantId = variantCount;
//     variant.innerHTML = `
//         <div class="form-group">
//             <label for="variantName_${variantCount}">Variant Name</label>
//             <input type="text" id="variantName_${variantCount}" required placeholder="e.g., Red Blazing, Stealth Black">
//         </div>
        
//         <div class="form-group">
//             <label for="color_${variantCount}">Color</label>
//             <input type="text" id="color_${variantCount}" required placeholder="e.g., Red, Black">
//         </div>
        
//         <div class="form-group">
//             <label for="variantPrice_${variantCount}">Price (₱)</label>
//             <input type="number" id="variantPrice_${variantCount}" step="0.01" required>
//         </div>
        
//         <div class="form-group">
//             <label for="variantImage_${variantCount}">Variant Image</label>
//             <input type="file" id="variantImage_${variantCount}" accept="image/jpeg, image/jpg, image/png, image/heic">
//         </div>
        
//         <div class="form-group">
//             <label>Sizes & Stock</label>
//             <div class="size-stock-container" id="sizeStockContainer_${variantCount}">
//                 <!-- Size inputs will be added here -->
//             </div>
//             <button type="button" class="btn-secondary btn-add-size" onclick="addSizeInput(${variantCount})">
//                 <i class="fas fa-plus"></i> Add Size
//             </button>
//         </div>
        
//         <button type="button" class="btn-remove" onclick="removeVariant(this)">
//             <i class="fas fa-trash"></i> Remove Variant
//         </button>
//     `;

//     container.appendChild(variant);

//     // Add validation for the new file input
//     document.getElementById(`variantImage_${variantCount}`).addEventListener('change', function (e) {
//         validateFileInput(this);
//     });

//     addSizeInput(variantCount);
// }

// function addSizeInput(variantId) {
//     const container = document.getElementById(`sizeStockContainer_${variantId}`);

//     const sizeItem = document.createElement('div');
//     sizeItem.className = 'size-stock-item';
//     sizeItem.innerHTML = `
//         <span>Size:</span>
//         <input type="number" class="size-input" step="0.5" min="1" placeholder="Size" required>
//         <span>Stock:</span>
//         <input type="number" class="stock-input" min="0" placeholder="Qty" required>
//         <button type="button" class="btn-remove-small" onclick="removeSizeInput(this)">
//             <i class="fas fa-times"></i>
//         </button>
//     `;

//     container.appendChild(sizeItem);
// }

// function removeSizeInput(button) {
//     button.parentElement.remove();
// }

// function removeVariant(button) {
//     if (document.querySelectorAll('.variant-group').length > 1) {
//         button.closest('.variant-group').remove();
//     } else {
//         alert('You must have at least one color variant');
//     }
// }

// // At the end of your module (after defining the functions):
// window.addSizeInput = addSizeInput;
// window.removeSizeInput = removeSizeInput;
// window.removeVariant = removeVariant;
// window.addColorVariant = addColorVariant;