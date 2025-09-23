// firebaseMethods.js - Firebase Utility Library for Shoe Shop
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getDatabase, ref, onValue, update, set, get, push, remove} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// Firebase configuration
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
const db = getDatabase(app);
const storage = getStorage(app);

// Constants
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];

// ==================== AUTHENTICATION METHODS ====================

/**
 * Check user authentication status and role
 * @returns {Promise<Object>} JSON with user data and role
 */
export async function checkUserAuth() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                resolve({ authenticated: false, role: null, userData: null });
                return;
            }

            try {
                // Check if user is employee
                const employeeRef = ref(db, `smartfit_AR_Database/employees/${user.uid}`);
                const employeeSnap = await get(employeeRef);
                
                if (employeeSnap.exists()) {
                    const employeeData = employeeSnap.val();
                    resolve({
                        authenticated: true,
                        role: 'employee',
                        userData: employeeData,
                        userId: user.uid,
                        shopId: employeeData.shopId
                    });
                    return;
                }

                // Check if user is shop owner
                const shopRef = ref(db, `smartfit_AR_Database/shop/${user.uid}`);
                const shopSnap = await get(shopRef);
                
                if (shopSnap.exists()) {
                    const shopData = shopSnap.val();
                    resolve({
                        authenticated: true,
                        role: 'shopowner',
                        userData: shopData,
                        userId: user.uid,
                        shopId: user.uid
                    });
                    return;
                }

                // Check if user is customer
                const customerRef = ref(db, `smartfit_AR_Database/customers/${user.uid}`);
                const customerSnap = await get(customerRef);
                
                if (customerSnap.exists()) {
                    const customerData = customerSnap.val();
                    resolve({
                        authenticated: true,
                        role: 'customer',
                        userData: customerData,
                        userId: user.uid
                    });
                    return;
                }

                resolve({ authenticated: false, role: null, userData: null });
            } catch (error) {
                reject({ error: error.message });
            }
        });
    });
}

/**
 * Logout user
 * @returns {Promise<Object>} JSON with logout status
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true, message: "Logged out successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== PROFILE METHODS ====================

/**
 * View user profile
 * @param {string} userId - User ID
 * @param {string} path - Database path (optional)
 * @returns {Promise<Object>} JSON with profile data
 */
export async function viewProfile(userId, path = null) {
    try {
        const profilePath = path || `smartfit_AR_Database/${await getUserRolePath(userId)}/${userId}`;
        const profileRef = ref(db, profilePath);
        const snapshot = await get(profileRef);
        
        if (!snapshot.exists()) {
            return { success: false, error: "Profile not found" };
        }
        
        return { success: true, data: snapshot.val() };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data to update
 * @param {string} path - Database path (optional)
 * @returns {Promise<Object>} JSON with update status
 */
export async function updateProfileMethod(userId, profileData, path = null) {
    try {
        const profilePath = path || `smartfit_AR_Database/${await getUserRolePath(userId)}/${userId}`;
        const profileRef = ref(db, profilePath);
        
        await update(profileRef, {
            ...profileData,
            lastUpdated: new Date().toISOString()
        });
        
        return { success: true, message: "Profile updated successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete user profile
 * @param {string} userId - User ID
 * @returns {Promise<Object>} JSON with delete status
 */
export async function deleteProfile(userId) {
    try {
        const profilePath = `smartfit_AR_Database/${await getUserRolePath(userId)}/${userId}`;
        const profileRef = ref(db, profilePath);
        
        await remove(profileRef);
        return { success: true, message: "Profile deleted successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== IMAGE MANAGEMENT METHODS ====================

/**
 * Upload image to Firebase Storage
 * @param {File} file - Image file
 * @param {string} storagePath - Storage path
 * @returns {Promise<Object>} JSON with upload result
 */
export async function createImageToFirebase(file, storagePath) {
    try {
        // Validate file type
        if (!ALLOWED_FILE_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
            return { success: false, error: "Invalid file type. Allowed: JPG, JPEG, PNG, HEIC" };
        }

        const fileRef = storageRef(storage, storagePath);
        const uploadTask = uploadBytesResumable(fileRef, file);
        
        await uploadTask;
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        return { 
            success: true, 
            url: downloadURL, 
            path: storagePath,
            filename: file.name
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get image URL from Firebase Storage
 * @param {string} storagePath - Storage path
 * @returns {Promise<Object>} JSON with image URL
 */
export async function readImageFromFirebase(storagePath) {
    try {
        const fileRef = storageRef(storage, storagePath);
        const downloadURL = await getDownloadURL(fileRef);
        
        return { success: true, url: downloadURL, path: storagePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Update image in Firebase Storage (delete old, upload new)
 * @param {File} newFile - New image file
 * @param {string} newStoragePath - New storage path
 * @param {string} oldStoragePath - Old storage path to delete
 * @returns {Promise<Object>} JSON with update result
 */
export async function updateImageInFirebase(newFile, newStoragePath, oldStoragePath) {
    try {
        // Delete old image
        const deleteResult = await deleteImageFromFirebase(oldStoragePath);
        if (!deleteResult.success) {
            console.warn("Could not delete old image:", deleteResult.error);
        }
        
        // Upload new image
        return await createImageToFirebase(newFile, newStoragePath);
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete image from Firebase Storage
 * @param {string} storagePath - Storage path
 * @returns {Promise<Object>} JSON with delete result
 */
export async function deleteImageFromFirebase(storagePath) {
    try {
        const fileRef = storageRef(storage, storagePath);
        await deleteObject(fileRef);
        
        return { success: true, message: "Image deleted successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== PRODUCT METHODS ====================

/**
 * Display products from specified path
 * @param {string} path - Database path
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} JSON with products data
 */
export async function displayProducts(path, filters = {}) {
    try {
        const productsRef = ref(db, path);
        const snapshot = await get(productsRef);
        
        if (!snapshot.exists()) {
            return { success: true, data: [] };
        }
        
        let products = [];
        snapshot.forEach((childSnapshot) => {
            const product = childSnapshot.val();
            product.id = childSnapshot.key;
            products.push(product);
        });
        
        // Apply filters
        if (filters.shopId) {
            products = products.filter(product => product.shopLoggedin === filters.shopId);
        }
        
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            products = products.filter(product => 
                product.shoeName?.toLowerCase().includes(term) ||
                product.shoeCode?.toLowerCase().includes(term)
            );
        }
        
        return { success: true, data: products };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Create new product
 * @param {string} shopId - Shop ID
 * @param {Object} productData - Product data
 * @returns {Promise<Object>} JSON with create result
 */
export async function createData(dataPath, shopId, productData) {
    try {
        const dataId = generate18CharID();
        const dataRef = ref(db, dataPath);
        
        await set(dataRef, {
            ...productData,
            id: dataId,
            shopLoggedin: shopId,
            dateAdded: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        });
        
        return { success: true, dataId: dataId, message: "Data created successfully" }; // Fixed typo: pdataId to dataId
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Read product details
 * @param {string} shopId - Shop ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} JSON with product data
 */
export async function readData(dataPath) {
    try {
        let dataPathRef = dataPath;
        const dataRef = ref(db, dataPathRef);
        const snapshot = await get(dataRef);
        
        if (!snapshot.exists()) {
            return { success: false, error: "Data not found" };
        }
        
        return { success: true, data: snapshot.val() };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Update product
 * @param {string} shopId - Shop ID
 * @param {string} productId - Product ID
 * @param {Object} updates - Product updates
 * @returns {Promise<Object>} JSON with update result
 */
export async function updateData(dataPath, updates) {
    try {
        const dataRef = ref(db, dataPath);
        
        await update(dataRef, {
            ...updates,
            lastUpdated: new Date().toISOString()
        });
        
        return { success: true, message: "Data updated successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete product
 * @param {string} shopId - Shop ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} JSON with delete result
 */
export async function deleteData(dataPath) {
    try {
        const dataRef = ref(db, dataPath);
        await remove(dataRef);
        return { success: true, message: "Data deleted successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== ORDER METHODS ====================

/**
 * Get orders with filters
 * @param {string} shopId - Shop ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} JSON with orders data
 */
export async function getOrders(shopId, filters = {}) {
    try {
        const ordersRef = ref(db, 'smartfit_AR_Database/transactions');
        const snapshot = await get(ordersRef);
        
        if (!snapshot.exists()) {
            return { success: true, data: [] };
        }
        
        const orders = [];
        snapshot.forEach((userSnapshot) => {
            const userOrders = userSnapshot.val();
            for (const orderId in userOrders) {
                const order = userOrders[orderId];
                const items = order.order_items ? Object.values(order.order_items) :
                    order.item ? [order.item] : [];

                if (items.some(item => item.shopId === shopId)) {
                    if (!filters.status || filters.status === 'all' || order.status === filters.status) {
                        orders.push({
                            ...order,
                            orderId: orderId,
                            userId: userSnapshot.key
                        });
                    }
                }
            }
        });
        
        // Sort by date (newest first)
        orders.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return { success: true, data: orders };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Update order status
 * @param {string} userId - User ID
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional order data
 * @returns {Promise<Object>} JSON with update result
 */
export async function updateOrderStatus(userId, orderId, status, additionalData = {}) {
    try {
        const orderRef = ref(db, `smartfit_AR_Database/transactions/${userId}/${orderId}`);
        
        await update(orderRef, {
            status: status,
            updatedAt: new Date().toISOString(),
            ...additionalData
        });
        
        return { success: true, message: `Order ${status} successfully` };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== INVENTORY/STOCK METHODS ====================

/**
 * Update stock quantity
 * @param {string} shopId - Shop ID
 * @param {string} shoeId - Shoe ID
 * @param {string} variantKey - Variant key
 * @param {string} size - Size
 * @param {number} newStock - New stock quantity
 * @param {string} updatedBy - Who updated the stock
 * @returns {Promise<Object>} JSON with update result
 */
export async function updateStock(shopId, shoeId, variantKey, size, newStock, updatedBy) {
    try {
        const stockPath = `smartfit_AR_Database/shoe/${shopId}/${shoeId}/variants/${variantKey}/sizes/size_${size}`;
        const stockRef = ref(db, stockPath);
        
        await update(stockRef, {
            [size]: {
                stock: newStock,
                LastUpdatedBy: updatedBy,
                LastUpdatedAt: new Date().toISOString()
            }
        });
        
        return { success: true, message: "Stock updated successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== UTILITY METHODS ====================

/**
 * Generate random 6-digit code
 * @returns {string} 6-digit code
 */
export function generate6DigitCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate random 18-character ID
 * @returns {string} 18-character ID
 */
export function generate18CharID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 18; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Get user role path for database
 * @param {string} userId - User ID
 * @returns {Promise<string>} Role path
 */
async function getUserRolePath(userId) {
    const authResult = await checkUserAuth();
    if (authResult.authenticated) {
        switch (authResult.role) {
            case 'employee': return 'employees';
            case 'shopowner': return 'shop';
            case 'customer': return 'customers';
            default: return 'users';
        }
    }
    return 'users';
}

/**
 * Validate file type
 * @param {File} file - File to validate
 * @returns {boolean} Validation result
 */
export function validateFileType(file) {
    return ALLOWED_FILE_TYPES.includes(file.type) || file.name.toLowerCase().endsWith('.heic');
}

export function createUserWithEmailAndPasswordWrapper(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
}

export function sendEmailVerificationWrapper(user) {
    return sendEmailVerification(user);
}

// Export Firebase instances for advanced usage
export { app, auth, db, storage };

export default {
    checkUserAuth,
    logoutUser,
    // CRUD for profiles
    viewProfile,
    updateProfileMethod,
    deleteProfile,
    // CRUD for Image management
    createImageToFirebase,
    readImageFromFirebase,
    updateImageInFirebase,
    deleteImageFromFirebase,
    // CRUD for Data
    displayProducts,
    createData,
    readData,
    updateData,
    deleteData,
    // CRUD for orders
    getOrders,
    updateOrderStatus,
    updateStock,
    generate6DigitCode,
    generate18CharID,
    validateFileType,
    app, auth, db, storage
};