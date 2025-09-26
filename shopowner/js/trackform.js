import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    updateData,
    createData,
    deleteData,
    generate18CharID
} from "../../firebaseMethods.js";

// Helper function to get DOM elements with null check
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id '${id}' not found`);
    }
    return element;
}

// Global variables
let shopLoggedin;
let userID;
let orderID;
let userData;

// Get orderID and userID from URL
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    orderID = urlParams.get("orderID");
    userID = urlParams.get("userID");

    if (!orderID || !userID) {
        alert("Missing orderID or userID in URL");
        throw new Error("No orderID or userID provided");
    }
}

// Initialize the page
async function initializeTracking() {
    const authResult = await checkUserAuth();

    if (!authResult.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    if (authResult.role !== 'employee' && authResult.role !== 'shopowner') {
        window.location.href = "/shopowner/html/shop_dashboard.html";
        return;
    }

    console.log("User authenticated:", authResult);
    userData = authResult.userData;
    shopLoggedin = authResult.shopId || authResult.userId;

    // Set role-based UI elements
    if (authResult.role === 'employee') {
        const addEmployeeBtn = getElement('addemployeebtn');
        const analyticsBtn = getElement('analyticsbtn');
        const issueReport = getElement('issuereport');

        if (userData.role.toLowerCase() === "manager" && addEmployeeBtn) {
            addEmployeeBtn.style.display = "none";
        } else if (userData.role.toLowerCase() === "salesperson") {
            if (addEmployeeBtn) addEmployeeBtn.style.display = "none";
            if (analyticsBtn) analyticsBtn.style.display = "none";
            if (issueReport) issueReport.style.display = "none";
        }
    }

    // Set user profile information
    loadUserProfile();

    // Initialize the application
    init();
}

// Load user profile information
function loadUserProfile() {
    const imageProfile = getElement('imageProfile');
    const userNameDisplay = getElement('userName_display2');

    if (imageProfile) {
        if (userData.profilePhoto && userData.profilePhoto.url) {
            imageProfile.src = userData.profilePhoto.url;
        } else if (userData.uploads && userData.uploads.shopLogo && userData.uploads.shopLogo.url) {
            imageProfile.src = userData.uploads.shopLogo.url;
        } else {
            imageProfile.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        }
    }

    if (userNameDisplay) {
        userNameDisplay.textContent = userData.ownerName || userData.shopName || userData.name || 'Shop Owner';
    }
}

// DOM elements cache
const domElements = {
    orderTitle: document.querySelector(".order-title"),
    customerName: document.querySelector(".meta-value:nth-child(2)"),
    orderDate: document.querySelector(".meta-item:nth-child(2) .meta-value"),
    itemCount: document.querySelector(".meta-item:nth-child(3) .meta-value"),
    orderTotal: document.querySelector(".meta-item:nth-child(4) .meta-value"),
    carrierInput: getElement("carrier"),
    trackingNumberInput: getElement("trackingNumber"),
    shipDateInput: getElement("shipDate"),
    estDeliveryInput: getElement("estDelivery"),
    shippingNotesInput: getElement("shippingNotes"),
    updateList: getElement("updateList"),
    addUpdateBtn: getElement("addUpdateBtn"),
    updateModal: getElement("updateModal"),
    closeModal: getElement("closeModal"),
    cancelUpdate: getElement("cancelUpdate"),
    trackingForm: getElement("trackingForm"),
    updateForm: getElement("updateForm")
};

// Initialize the application
function init() {
    getUrlParams();
    setupEventListeners();
    loadOrderData();
}

// Set up all event listeners
function setupEventListeners() {
    // Modal handling
    if (domElements.addUpdateBtn) {
        domElements.addUpdateBtn.addEventListener("click", () => {
            if (domElements.updateModal) {
                domElements.updateModal.style.display = "flex";
                // Set current datetime as default
                const now = new Date();
                const datetimeLocal = now.toISOString().slice(0, 16);
                const updateDateInput = getElement("updateDate");
                if (updateDateInput) {
                    updateDateInput.value = datetimeLocal;
                }
            }
        });
    }

    if (domElements.closeModal) {
        domElements.closeModal.addEventListener("click", () => {
            if (domElements.updateModal) domElements.updateModal.style.display = "none";
        });
    }

    if (domElements.cancelUpdate) {
        domElements.cancelUpdate.addEventListener("click", () => {
            if (domElements.updateModal) domElements.updateModal.style.display = "none";
        });
    }

    window.addEventListener("click", (e) => {
        if (e.target === domElements.updateModal) {
            domElements.updateModal.style.display = "none";
        }
    });

    // Save shipping info
    if (domElements.trackingForm) {
        domElements.trackingForm.addEventListener("submit", (e) => {
            e.preventDefault();
            saveShippingInfo();
        });
    }

    // Add status update
    if (domElements.updateForm) {
        domElements.updateForm.addEventListener("submit", (e) => {
            e.preventDefault();
            addStatusUpdate();
        });
    }

    // Delete update (delegated event)
    if (domElements.updateList) {
        domElements.updateList.addEventListener("click", (e) => {
            const deleteBtn = e.target.closest(".btn-danger");
            if (deleteBtn) {
                const updateID = deleteBtn.dataset.id;
                if (updateID && confirm("Are you sure you want to delete this update?")) {
                    deleteStatusUpdate(updateID);
                }
            }
        });
    }

    // Logout functionality
    const logoutBtn = getElement('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
            if (confirm('Are you sure you want to logout?')) {
                const result = await logoutUser();
                if (result.success) {
                    window.location.href = '/login.html';
                } else {
                    console.error('Error signing out:', result.error);
                }
            }
        });
    }
}

// Load order data from Firebase with real-time updates
function loadOrderData() {
    const unsubscribe = readDataRealtime(
        `smartfit_AR_Database/transactions/${userID}/${orderID}`,
        (result) => {
            if (!result.success) {
                alert("Order not found");
                return;
            }

            const data = result.data;
            updateOrderInfo(data);
            updateShippingInfo(data);
            console.log("Order data:", data.statusUpdates);
            renderStatusUpdates(data.statusUpdates || {});
        }
    );

    // Return unsubscribe function for cleanup (optional)
    return unsubscribe;
}

// Update order information display
function updateOrderInfo(data) {
    if (!data) return;

    if (domElements.orderTitle) {
        domElements.orderTitle.textContent = `Order #${orderID}`;
    }

    if (domElements.customerName && data.shippingInfo) {
        const firstName = data.shippingInfo.firstName || '';
        const lastName = data.shippingInfo.lastName || '';
        domElements.customerName.textContent = `${firstName} ${lastName}`.trim() || "N/A";
    }

    if (domElements.orderDate && data.date) {
        domElements.orderDate.textContent = new Date(data.date).toLocaleDateString();
    }

    if (domElements.itemCount) {
        const quantity = data.item?.quantity || 1;
        domElements.itemCount.textContent = quantity;
    }

    if (domElements.orderTotal && data.totalAmount) {
        domElements.orderTotal.textContent = `₱${data.totalAmount.toFixed(2)}`;
    }
}

// Update shipping information form
function updateShippingInfo(data) {
    if (!data || !data.shipping) return;

    if (domElements.carrierInput) domElements.carrierInput.value = data.shipping.carrier || "";
    if (domElements.trackingNumberInput) domElements.trackingNumberInput.value = data.shipping.trackingNumber || "";
    if (domElements.shipDateInput) domElements.shipDateInput.value = data.shipping.shipDate || "";
    if (domElements.estDeliveryInput) domElements.estDeliveryInput.value = data.shipping.estDelivery || "";
    if (domElements.shippingNotesInput) domElements.shippingNotesInput.value = data.shipping.notes || "";
}

// Render status updates to the list
function renderStatusUpdates(updates) {
    if (!domElements.updateList) return;

    // Get reference to the empty state element
    const emptyState = getElement("emptyUpdatesState");

    // Check if there are any updates
    const hasUpdates = updates && Object.keys(updates).length > 0;

    // Show/hide empty state based on whether updates exist
    if (emptyState) {
        emptyState.style.display = hasUpdates ? "none" : "block";
    }

    // Clear the update list
    domElements.updateList.innerHTML = "";

    // If no updates, return early
    if (!hasUpdates) return;

    // Convert updates object to array and sort by timestamp (newest first)
    const updateIDs = Object.keys(updates);
    const sortedEntries = Object.entries(updates)
        .sort(([, a], [, b]) => b.timestamp - a.timestamp); // Sort by timestamp descending

    sortedEntries.forEach(([key, value]) => {
        addUpdateToDOM(key, value);
        console.log("Rendering update:", key, value);
    });

}

// Add a single update to the DOM
function addUpdateToDOM(updateID, update) {
    if (!domElements.updateList) return;

    const item = document.createElement("li");
    item.className = "update-item";
    item.innerHTML = `
        <div class="update-header">
            <span class="update-date">${formatDateTime(update.timestamp)}</span>
            <span class="update-status">${update.status}</span>
        </div>
        <p class="update-message">${update.message}</p>
        ${update.location ? `<p class="update-location">${update.location}</p>` : ''}
        <div class="update-actions">
            <button class="btn btn-danger" data-id="${updateID}">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    domElements.updateList.appendChild(item);
}

// Format timestamp for display
function formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString();
}

// Save shipping information to Firebase
async function saveShippingInfo() {
    const shippingData = {
        carrier: domElements.carrierInput?.value || "",
        trackingNumber: domElements.trackingNumberInput?.value || "",
        shipDate: domElements.shipDateInput?.value || "",
        estDelivery: domElements.estDeliveryInput?.value || "",
        notes: domElements.shippingNotesInput?.value || ""
    };

    try {
        const result = await updateData(
            `smartfit_AR_Database/transactions/${userID}/${orderID}/shipping`,
            shippingData
        );

        if (result.success) {
            alert("Shipping info updated successfully!");
        } else {
            alert("Failed to save shipping info: " + result.error);
        }
    } catch (error) {
        console.error("Error saving shipping info:", error);
        alert("Failed to save shipping info");
    }
}

async function addStatusUpdate() {
    const status = getElement("updateStatus")?.value;
    const datetime = getElement("updateDate")?.value;
    const message = getElement("updateMessage")?.value;
    const location = getElement("updateLocation")?.value;

    if (!status || !datetime || !message) {
        alert("Please fill in all required fields");
        return;
    }

    const statusUpdateData = {
        status,
        timestamp: new Date(datetime).getTime(),
        message,
        location: location || "",
        addedBy: userData.name || userData.ownerName || "Shop",
        addedById: shopLoggedin,
        createdAt: new Date().toISOString()
    };

    try {
        console.log("1. Starting to add status update");

        // Generate a unique ID for the status update
        const updateId = generate18CharID();

        // Use createData to create the status update with the generated ID
        const createResult = await createData(
            `smartfit_AR_Database/transactions/${userID}/${orderID}/statusUpdates/${updateId}`,
            shopLoggedin,
            statusUpdateData  // Use the renamed variable here
        );

        console.log("2. Status update result:", createResult);

        if (createResult.success) {
            console.log("3. Updating main order status");

            // Update the main order status using the imported updateData function
            const updateResult = await updateData(
                `smartfit_AR_Database/transactions/${userID}/${orderID}`,
                { status: status }
            );

            console.log("4. Main order status update result:", updateResult);

            if (updateResult.success) {
                // Close modal and reset form
                if (domElements.updateModal) {
                    domElements.updateModal.style.display = "none";
                }
                if (domElements.updateForm) {
                    domElements.updateForm.reset();
                }
                alert("Status update added successfully!");
            } else {
                alert("Failed to update order status: " + updateResult.error);
            }
        } else {
            alert("Failed to add status update: " + createResult.error);
        }
    } catch (error) {
        console.error("Error adding status update:", error);
        alert("Failed to add status update: " + error.message);
    }
}

// Delete a status update
async function deleteStatusUpdate(updateID) {
    try {
        console.log("Deleting update with ID:", updateID);

        const result = await deleteData(
            `smartfit_AR_Database/transactions/${userID}/${orderID}/statusUpdates/${updateID}`
        );

        if (result.success) {
            console.log("Update deleted successfully");
            // Remove the update from UI immediately
            const updateItem = document.querySelector(`[data-id="${updateID}"]`)?.closest('.update-item');
            if (updateItem) {
                updateItem.remove();
            }

            // Check if there are any updates left and show empty state if needed
            const remainingUpdates = document.querySelectorAll('.update-item');
            const emptyState = getElement("emptyUpdatesState");
            if (emptyState) {
                emptyState.style.display = remainingUpdates.length === 0 ? "block" : "none";
            }
        } else {
            alert("Failed to delete update: " + result.error);
        }
    } catch (error) {
        console.error("Error deleting update:", error);
        alert("Failed to delete update: " + error.message);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Mobile sidebar toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (mobileToggle && sidebar && overlay) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Initialize tracking page
    initializeTracking();
});