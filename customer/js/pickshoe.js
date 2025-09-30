import {
    checkUserAuth,
    logoutUser,
    readData,
    readDataRealtime,
    deleteData,
    createData
} from "../../firebaseMethods.js";

// Global variables
let selectedModel = null;
let userSession = {
    userId: null,
    userData: null
};

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function () {
    await initializePage();
});

async function initializePage() {
    const user = await checkUserAuth();
    
    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    userSession.userId = user.userId;
    userSession.userData = user.userData;

    // Set user profile information
    setUserProfile();
    
    // Setup model selection
    setupModelSelection();
    
    // Load saved designs
    loadSavedDesigns();
    
    // Setup event listeners
    setupEventListeners();
}

// Set user profile information
function setUserProfile() {
    const userNameDisplay = getElement('userName_display2');
    const userAvatar = getElement('imageProfile');
    
    if (userSession.userData) {
        if (userSession.userData.firstName && userSession.userData.lastName) {
            userNameDisplay.textContent = `${userSession.userData.firstName} ${userSession.userData.lastName}`;
        } else if (userSession.userData.name) {
            userNameDisplay.textContent = userSession.userData.name;
        } else {
            userNameDisplay.textContent = "User";
        }
        
        // Set user avatar if available
        if (userSession.userData.profilePhoto) {
            userAvatar.src = userSession.userData.profilePhoto;
        } else {
            userAvatar.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        }
    }
}

// Setup model selection functionality
function setupModelSelection() {
    const modelCards = document.querySelectorAll('.model-card');
    const customizeBtn = getElement('customizeBtn');

    modelCards.forEach(card => {
        card.addEventListener('click', function () {
            modelCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');

            selectedModel = {
                id: this.dataset.model,
                basePrice: parseFloat(this.dataset.basePrice),
                baseDays: parseInt(this.dataset.baseDays),
                baseImage: this.dataset.baseImage,
                name: this.querySelector('.model-name').textContent
            };

            customizeBtn.disabled = false;
        });
    });

    customizeBtn.addEventListener('click', function () {
        if (selectedModel) {
            sessionStorage.setItem('selectedShoeModel', JSON.stringify(selectedModel));
            window.location.href = `customizeshoe.html?model=${encodeURIComponent(selectedModel.id)}`;
        }
    });
}

// Load saved designs from Firebase
async function loadSavedDesigns() {
    const savedDesignsPath = `smartfit_AR_Database/saved_customShoes/${userSession.userId}`;
    const savedDesignsContainer = document.querySelector('.saved-designs-container');

    try {
        const result = await readData(savedDesignsPath);
        const container = getElement('savedDesignsList');
        const emptyState = getElement('emptySavedDesigns');

        // Clear existing content except the empty state
        container.innerHTML = '';

        if (!result.success || !result.data || Object.keys(result.data).length === 0) {
            // Show empty state if no designs
            container.appendChild(emptyState);
            emptyState.style.display = 'block';
            savedDesignsContainer.classList.add('hidden'); // Hide container if no designs
        } else {
            // Show the container since we have designs
            savedDesignsContainer.classList.remove('hidden');

            // Hide empty state
            emptyState.style.display = 'none';

            // Generate HTML for each saved design
            const savedDesigns = result.data;
            Object.entries(savedDesigns).forEach(([id, design]) => {
                const designElement = createSavedDesignElement(id, design);
                container.appendChild(designElement);
            });
        }
    } catch (error) {
        console.error('Error loading saved designs:', error);
        alert('Error loading saved designs. Please try again.');
    }
}

function createSavedDesignElement(id, design) {
    const element = document.createElement('div');
    element.className = 'saved-design';

    // Format the date with fallback
    const createdAt = design.createdAt ? new Date(design.createdAt) : new Date();
    const formattedDate = createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Calculate total price with fallback
    const basePrice = design.basePrice || 0;
    const customizationPrice = design.customizationPrice || 0;
    const totalPrice = basePrice + customizationPrice;

    // Safely access nested properties with fallbacks
    const selections = design.selections || {};
    
    // Get the model and body color for the image path
    const model = design.model || 'classic';
    const bodyColor = selections.bodyColor || 'white';

    // Build the main.png image path based on model and body color
    const mainImagePath = `/images/angles/${model}/${bodyColor}/main.png`;
    
    // Use the main.png image or a placeholder if it fails to load
    const previewImage = mainImagePath;

    // Helper function to create a detail row only if value exists
    const createDetailRow = (label, value, isColor = false) => {
        if (!value) return '';

        if (isColor) {
            return `
                <div class="design-detail-row">
                    <span class="design-detail-label">${label}:</span>
                    <span class="design-detail-value" style="background-color: ${value}; width: 20px; height: 20px; display: inline-block; border: 1px solid #ddd;"></span>
                    <span class="design-detail-value">${value}</span>
                </div>
            `;
        }

        return `
            <div class="design-detail-row">
                <span class="design-detail-label">${label}:</span>
                <span class="design-detail-value">${value}</span>
            </div>
        `;
    };

    // Build the common details HTML
    let detailsHTML = `
        ${createDetailRow('Model', design.model)}
        ${createDetailRow('Size', design.size)}
    `;

    // Add insole details if available
    const insole = selections.insole || {};
    const insoleId = insole.id || null;
    const insolePrice = insole.price || 0;
    
    if (insoleId) {
        detailsHTML += createDetailRow('Insole', `${insoleId}${insolePrice ? ` (+₱${insolePrice})` : ''}`);
    }

    // Add model-specific details
    if (design.model === 'classic') {
        detailsHTML += `
            ${createDetailRow('Body Color', bodyColor, true)}
        `;
        
        const laces = selections.laces || {};
        const lacesId = laces.id || null;
        const lacesColor = laces.color || null;
        
        if (lacesId) {
            detailsHTML += createDetailRow('Laces', `${lacesId}${lacesColor ? ` (${lacesColor})` : ''}`);
        }
    }
    else if (design.model === 'runner') {
        detailsHTML += `
            ${createDetailRow('Body Color', bodyColor, true)}
        `;

        const laces = selections.laces || {};
        const lacesId = laces.id || null;
        const lacesColor = laces.color || null;
        
        if (lacesId) {
            detailsHTML += createDetailRow('Laces', `${lacesId}${lacesColor ? ` (${lacesColor})` : ''}`);
        }
    }
    else if (design.model === 'basketball') {
        detailsHTML += `
            ${createDetailRow('Body Color', bodyColor, true)}
        `;

        const laces = selections.laces || {};
        const lacesId = laces.id || null;
        const lacesColor = laces.color || null;
        
        if (lacesId) {
            detailsHTML += createDetailRow('Laces', `${lacesId}${lacesColor ? ` (${lacesColor})` : ''}`);
        }
    }

    // Add production time and price (always shown)
    detailsHTML += `
        ${createDetailRow('Production Time', design.productionTime)}
        <div class="design-detail-row">
            <span class="design-detail-label">Total Price:</span>
            <span class="design-detail-value" style="font-weight: 600; color: var(--primary);">₱${totalPrice.toFixed(2)}</span>
        </div>
    `;

    element.innerHTML = `
        <div class="saved-design-header">
            <h3 class="saved-design-title">${design.model || 'Custom Design'}</h3>
            <span class="saved-design-date">Saved: ${formattedDate}</span>
        </div>
        <div class="saved-design-preview">
            <img src="${previewImage}" alt="Custom Design" class="saved-design-image" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/11542/11542598.png';">
            <div class="saved-design-details">
                ${detailsHTML}
            </div>
        </div>
        <div class="saved-design-actions">
            <button class="btn btn-outline btn-sm edit-design" data-id="${id}">
                <i class="fas fa-edit"></i> Edit Design
            </button>
            <button class="btn btn-danger btn-sm delete-design" data-id="${id}">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    return element;
}

// Event delegation for saved design actions
function setupEventListeners() {
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

    // Saved designs actions
    getElement('savedDesignsList').addEventListener('click', function (e) {
        const target = e.target.closest('button');
        if (!target) return;

        const designId = target.dataset.id;

        if (target.classList.contains('edit-design')) {
            editSavedDesign(designId);
        } else if (target.classList.contains('delete-design')) {
            deleteSavedDesign(designId);
        }
    });

    // Logout functionality
    getElement('logout_btn').addEventListener('click', handleLogout);
}

// Handle logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        const result = await logoutUser();
        if (result.success) {
            window.location.href = "/login.html";
        } else {
            alert('Logout failed: ' + result.error);
        }
    }
}

// Edit saved design
async function editSavedDesign(designId) {
    const designPath = `smartfit_AR_Database/saved_customShoes/${userSession.userId}/${designId}`;

    try {
        const result = await readData(designPath);
        
        if (result.success) {
            const design = result.data;
            sessionStorage.setItem('editingDesign', JSON.stringify({
                id: designId,
                ...design
            }));
            window.location.href = 'customizeshoeedit.html?designId=' + designId;
        } else {
            alert('Error loading design. Please try again.');
        }
    } catch (error) {
        console.error('Error loading design:', error);
        alert('Error loading design. Please try again.');
    }
}

// Delete saved design
async function deleteSavedDesign(designId) {
    if (confirm('Are you sure you want to delete this saved design?')) {
        const designPath = `smartfit_AR_Database/saved_customShoes/${userSession.userId}/${designId}`;

        try {
            const result = await deleteData(designPath);
            
            if (result.success) {
                // Remove the design element from the DOM
                const designElement = document.querySelector(`.saved-design-actions button[data-id="${designId}"]`)?.closest('.saved-design');
                if (designElement) {
                    designElement.remove();
                }

                // Check if we need to show the empty state
                const container = getElement('savedDesignsList');
                if (container.children.length === 0 ||
                    (container.children.length === 1 && container.children[0].id === 'emptySavedDesigns')) {
                    const emptyState = getElement('emptySavedDesigns');
                    container.innerHTML = '';
                    container.appendChild(emptyState);
                    emptyState.style.display = 'block';
                    
                    // Hide the container
                    const savedDesignsContainer = document.querySelector('.saved-designs-container');
                    savedDesignsContainer.classList.add('hidden');
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error deleting design:', error);
            alert('Error deleting design. Please try again.');
        }
    }
}

// Add design to cart (if needed in the future)
async function addDesignToCart(designId) {
    const designPath = `smartfit_AR_Database/saved_customShoes/${userSession.userId}/${designId}`;

    try {
        const result = await readData(designPath);
        
        if (result.success) {
            const design = result.data;
            const cartPath = `smartfit_AR_Database/customized_cart/${userSession.userId}`;

            // Create a new cart item with the design data
            const cartItem = {
                ...design,
                addedAt: Date.now(),
                isCustom: true
            };

            // Push the design to the cart
            const createResult = await createData(cartPath, userSession.userId, cartItem);
            
            if (createResult.success) {
                alert('Design added to cart successfully!');
            } else {
                throw new Error(createResult.error);
            }
        } else {
            throw new Error('Failed to load design');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Error adding to cart. Please try again.');
    }
}

// Buy now function (if needed in the future)
async function buyNow(designId) {
    await addDesignToCart(designId);
    window.location.href = '/checkout.html';
}