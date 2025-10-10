// firebaseMethods.js - Firebase Utility Library for Shoe Shop
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getDatabase, ref, onValue, update, set, get, push, remove } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

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

// Test the auto-confirm service connection
export async function testAutoConfirmService() {
    try {
        const response = await fetch('https://smartfitar-auto-orderreceive.onrender.com/health');
        const data = await response.json();
        console.log('✅ Auto-confirm service is running:', data);

        // Test quick check
        const quickResponse = await fetch('https://smartfitar-auto-orderreceive.onrender.com/quick-check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const quickData = await quickResponse.json();
        console.log('📊 Quick check results:', quickData);

        return true;
    } catch (error) {
        console.error('❌ Auto-confirm service is not reachable:', error);
        return false;
    }
}

/**
 * Check user authentication status and role
 * @returns {Promise<Object>} JSON with user data and role
 */
export async function checkUserAuth() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            // await testAutoConfirmService();
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
                        shopId: employeeData.shopId,
                        verifiedEmail: user.emailVerified
                    });
                    return;
                }

                // Check if user is shop owner
                if (user.uid === 'N5Lf9ArfJyV18VSUr9OaoNqSCgA3') {
                    const shoeMaker = ref(db, `smartfit_AR_Database/shop/N5Lf9ArfJyV18VSUr9OaoNqSCgA3`);
                    const shoeMakerSnap = await get(shoeMaker);

                    if (shoeMakerSnap.exists()) {
                        const shopData = shoeMakerSnap.val();
                        resolve({
                            authenticated: true,
                            role: 'shoemaker',
                            userData: shopData,
                            userId: user.uid,
                            shopId: user.uid,
                            verifiedEmail: user.emailVerified
                        });
                        return;
                    }
                } else {
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
                            shopId: user.uid,
                            verifiedEmail: user.emailVerified
                        });
                        return;
                    }
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
                        userId: user.uid,
                        verifiedEmail: user.emailVerified
                    });
                    return;
                }

                // ADMIN Account
                if (user.uid === "c4k5tKvqfWgctmQdiILdB59WbOp1") { // Admin UID
                    resolve({ authenticated: true, role: "admin", userData: "Admin", userId: user.uid });
                    return;
                }

                // Shoe Maker Account
                if (user.uid === "N5Lf9ArfJyV18VSUr9OaoNqSCgA3") { // Admin UID
                    resolve({ authenticated: true, role: "shoeMaker", userData: "Admin", userId: user.uid });
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
 * @param {string} dataPath - Database path
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

        return { success: true, dataId: dataId, message: "Data created successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Read product details
 * @param {string} dataPath - Database path
 * @returns {Promise<Object>} JSON with product data
 */
export async function readData(dataPath) {
    try {
        const dataRef = ref(db, dataPath);
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
 * Read data with real-time updates using onValue
 * @param {string} dataPath - Database path
 * @param {function} callback - Callback function to handle real-time updates
 * @returns {function} Unsubscribe function to stop listening
 */
export function readDataRealtime(dataPath, callback) {
    try {
        const dataRef = ref(db, dataPath);

        const unsubscribe = onValue(dataRef, (snapshot) => {
            if (!snapshot.exists()) {
                callback({ success: false, error: "Data not found" });
                return;
            }

            callback({ success: true, data: snapshot.val() });
        }, (error) => {
            callback({ success: false, error: error.message });
        });

        return unsubscribe;
    } catch (error) {
        callback({ success: false, error: error.message });
        return () => { };
    }
}

/**
 * Update product
 * @param {string} dataPath - Database path
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
 * @param {string} dataPath - Database path
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

/**
 * Create user with email and password wrapper
 */
export function createUserWithEmailAndPasswordWrapper(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Send password reset email wrapper
 */
export async function sendPasswordResetEmailWrapper(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: "Password reset email sent successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Sign in with email and password wrapper
 */
export async function signInWithEmailAndPasswordWrapper(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Send email verification wrapper
 */
export function sendEmailVerificationWrapper(user) {
    return sendEmailVerification(user);
}

/**
 * Send email using EmailJS
 */
export function sendEmail(email, reason, shopname, publickey, serviceID, templatekey) {
    if (typeof emailjs === 'undefined') {
        console.error('EmailJS not loaded');
        return Promise.resolve({
            success: false,
            error: 'EmailJS library not loaded. Please refresh the page.'
        });
    }

    try {
        emailjs.init(publickey);

        const templateParams = {
            to_email: email,
            message: reason,
            shop_name: shopname,
            reply_to: 'noreply@smartfit.com'
        };

        return emailjs.send(serviceID, templatekey, templateParams)
            .then(function (response) {
                console.log('Email sent successfully!', response.status, response.text);
                return { success: true, message: "Email sent successfully" };
            })
            .catch(function (error) {
                console.error('Failed to send email:', error);
                return { success: false, error: error.text || error.message };
            });
    } catch (error) {
        console.error('EmailJS initialization error:', error);
        return Promise.resolve({ success: false, error: error.message });
    }
}

export async function changeUserPassword(newPassword) {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        return { success: false, error: "No authenticated user found." };
    }

    try {
        await updatePassword(user, newPassword);
        return { success: true, message: "Password updated successfully." };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
// Add this to your firebaseMethods.js in the AUTHENTICATION METHODS section

/**
 * Reauthenticate user with email and password
 * @param {string} email - User email
 * @param {string} password - Current password
 * @returns {Promise<Object>} JSON with reauthentication result
 */
export async function reauthenticateUser(email, password) {
    try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            return { success: false, error: "No authenticated user found" };
        }

        if (user.email !== email) {
            return { success: false, error: "Email does not match current user" };
        }

        // Reauthenticate by signing in again
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true, message: "User reauthenticated successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// ==================== EMPLOYEE BATCH GENERATION (BACKEND) ====================

const BACKEND_URL = 'https://smartfitar-batchemployee-backend.onrender.com';

/**
 * Generate batch employee accounts using backend API
 * @param {string} shopId - Shop ID
 * @param {string} shopOwnerId - Shop owner user ID
 * @param {Object} employeeData - Additional employee data (including count)
 * @returns {Promise<Object>} JSON with generation result
 */
export async function generateBatchEmployees(shopId, shopOwnerId, employeeData = {}) {
    try {
        // Count is now part of employeeData, no need to get from DOM here
        const response = await fetch(`${BACKEND_URL}/api/generate-employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                shopId,
                shopOwnerId,
                employeeData // This now includes count, domain, role, etc.
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        return {
            success: false,
            error: `Failed to connect to server: ${error.message}`
        };
    }
}

/**
 * Get all employees for a shop
 * @param {string} shopId - Shop ID
 * @param {string} shopOwnerId - Shop owner user ID
 * @returns {Promise<Object>} JSON with employees list
 */
export async function getShopEmployees(shopId, shopOwnerId) {
    try {
        const response = await fetch(
            `${BACKEND_URL}/api/shop/${shopId}/employees?shopOwnerId=${shopOwnerId}`
        );

        const result = await response.json();
        return result;
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Update employee status
 * @param {string} employeeId - Employee user ID
 * @param {string} status - New status (active/inactive/suspended)
 * @param {string} shopOwnerId - Shop owner user ID
 * @returns {Promise<Object>} JSON with update result
 */
export async function updateEmployeeStatus(employeeId, status, shopOwnerId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/employees/${employeeId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status,
                shopOwnerId
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Reset employee password
 * @param {string} employeeId - Employee user ID
 * @param {string} shopOwnerId - Shop owner user ID
 * @returns {Promise<Object>} JSON with reset result
 */
export async function resetEmployeePassword(employeeId, shopOwnerId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/employees/${employeeId}/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                shopOwnerId
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ==================== GENERIC FILE METHODS ====================

/**
 * Add file to Firebase Storage (supports any file format)
 * @param {File} file - File to upload
 * @param {string} storagePath - Storage path including filename and extension
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} JSON with upload result
 */
export async function addFile(file, storagePath, options = {}) {
    try {
        const {
            metadata = {},
            onProgress = null,
            onError = null,
            onComplete = null
        } = options;

        // Validate file exists
        if (!file) {
            return { success: false, error: "No file provided" };
        }

        // Create storage reference
        const fileRef = storageRef(storage, storagePath);

        // Create upload task
        const uploadTask = uploadBytesResumable(fileRef, file, metadata);

        // Return promise that resolves when upload completes
        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                // Progress callback
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Upload progress: ${progress}%`);

                    // Call progress callback if provided
                    if (onProgress && typeof onProgress === 'function') {
                        onProgress(progress, snapshot);
                    }
                },
                // Error callback
                (error) => {
                    console.error('Upload error:', error);

                    // Call error callback if provided
                    if (onError && typeof onError === 'function') {
                        onError(error);
                    }

                    reject({ success: false, error: error.message });
                },
                // Complete callback
                async () => {
                    try {
                        // Get download URL
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                        const result = {
                            success: true,
                            url: downloadURL,
                            path: storagePath,
                            filename: file.name,
                            size: file.size,
                            type: file.type,
                            fullPath: uploadTask.snapshot.ref.fullPath,
                            metadata: uploadTask.snapshot.metadata
                        };

                        // Call complete callback if provided
                        if (onComplete && typeof onComplete === 'function') {
                            onComplete(result);
                        }

                        resolve(result);
                    } catch (error) {
                        console.error('Error getting download URL:', error);

                        if (onError && typeof onError === 'function') {
                            onError(error);
                        }

                        reject({ success: false, error: error.message });
                    }
                }
            );
        });

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Read file from Firebase Storage
 * @param {string} storagePath - Storage path
 * @returns {Promise<Object>} JSON with file data
 */
export async function readFile(storagePath) {
    try {
        const fileRef = storageRef(storage, storagePath);
        const downloadURL = await getDownloadURL(fileRef);

        return {
            success: true,
            url: downloadURL,
            path: storagePath
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Update file in Firebase Storage (replace existing file)
 * @param {File} newFile - New file
 * @param {string} newStoragePath - New storage path
 * @param {string} oldStoragePath - Old storage path to delete
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} JSON with update result
 */
export async function updateFile(newFile, newStoragePath, oldStoragePath, options = {}) {
    try {
        // Delete old file if path is provided and different from new path
        if (oldStoragePath && oldStoragePath !== newStoragePath) {
            const deleteResult = await deleteFile(oldStoragePath);
            if (!deleteResult.success) {
                console.warn("Could not delete old file:", deleteResult.error);
            }
        }

        // Upload new file
        return await addFile(newFile, newStoragePath, options);
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete file from Firebase Storage
 * @param {string} storagePath - Storage path
 * @returns {Promise<Object>} JSON with delete result
 */
export async function deleteFile(storagePath) {
    try {
        const fileRef = storageRef(storage, storagePath);
        await deleteObject(fileRef);

        return { success: true, message: "File deleted successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * List files in a storage directory
 * @param {string} directoryPath - Directory path
 * @param {number} maxResults - Maximum number of results
 * @returns {Promise<Object>} JSON with list of files
 */
export async function listFiles(directoryPath, maxResults = 100) {
    try {
        // Note: Firebase Storage doesn't have a built-in list files API in v9+
        // This would require using a Cloud Function or maintaining a database index
        // For now, this is a placeholder that returns success
        console.warn('listFiles requires Cloud Functions implementation');
        return {
            success: true,
            data: [],
            message: 'List files requires Cloud Functions implementation'
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get file metadata
 * @param {string} storagePath - Storage path
 * @returns {Promise<Object>} JSON with file metadata
 */
export async function getFileMetadata(storagePath) {
    try {
        const fileRef = storageRef(storage, storagePath);
        // Note: getMetadata is not directly available in v9, this would need implementation
        console.warn('getFileMetadata requires additional implementation');
        return {
            success: true,
            message: 'File metadata retrieval requires additional implementation'
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// Export Firebase instances for advanced usage
export { app, auth, db, storage };

export default {
    checkUserAuth,
    logoutUser,
    generate18CharID,
    generate6DigitCode,
    displayProducts,
    generateBatchEmployees,

    // backend functions
    getShopEmployees,
    updateEmployeeStatus,
    resetEmployeePassword,

    // Profile Management
    viewProfile,
    deleteProfile,
    updateProfileMethod,

    // Authentication
    createUserWithEmailAndPasswordWrapper,
    sendEmailVerificationWrapper,
    sendPasswordResetEmailWrapper,
    changeUserPassword,
    reauthenticateUser,
    sendEmail,

    // Image Management
    createImageToFirebase,
    readImageFromFirebase,
    updateImageInFirebase,
    deleteImageFromFirebase,
    validateFileType,

    // Data Management
    createData,
    readData,
    updateData,
    deleteData,
    readDataRealtime,

    // Orders Management
    getOrders,
    updateOrderStatus,
    updateStock,

    // Generic File Management
    addFile,
    readFile,
    updateFile,
    deleteFile,
    listFiles,
    getFileMetadata,

    app, auth, db, storage
};