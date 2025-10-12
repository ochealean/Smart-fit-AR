// customizeShoeInventory.js - Shoemaker AR Customization Inventory
import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    readData,
    updateData,
    createData,
    addFile,
    deleteFile
} from "../../firebaseMethods.js";
import { storageService } from "../../deepARMethods.js";

// Global session object
const userSession = {
    userId: null,
    role: null
};

// Fixed model definitions - these cannot be deleted or added
const FIXED_MODELS = {
    'classic': {
        id: 'classic',
        name: 'Classic Sneaker',
        basePrice: 2499,
        baseDays: 7,
        baseImage: '/images/classicshoe3d.png',
        description: 'Our timeless classic sneaker with customizable options'
    },
    'runner': {
        id: 'runner', 
        name: 'Performance Runner',
        basePrice: 2999,
        baseDays: 5,
        baseImage: '/images/runningshoe3d.png',
        description: 'High-performance running shoe with advanced cushioning technology'
    },
    'basketball': {
        id: 'basketball',
        name: 'High-Top Basketball', 
        basePrice: 2799,
        baseDays: 10,
        baseImage: '/images/basketballshoe3d.png',
        description: 'Ankle-supporting basketball shoes with customizable colors'
    }
};

// Default empty customization options (used when no data exists)
const EMPTY_CUSTOMIZATIONS = {
    bodyColors: {},
    laces: {},
    insoles: {}
};

// Store pending file uploads for colors, laces, and insoles
let pendingColorUploads = {};
let pendingLacesUploads = {};
let pendingInsoleUploads = {};
let pendingDeepARUploads = {};

// Store items marked for deletion
let itemsToDelete = {
    colors: [],
    laces: [],
    insoles: []
};

// Expose functions globally
window.editModel = editModel;
window.closeModal = closeModal;
window.saveModel = saveModel;
window.cancelEdit = cancelEdit;
window.addColorOption = addColorOption;
window.removeColorOption = removeColorOption;
window.addLacesOption = addLacesOption;
window.removeLacesOption = removeLacesOption;
window.addInsoleOption = addInsoleOption;
window.removeInsoleOption = removeInsoleOption;
window.uploadSingleImage = uploadSingleImage;
window.uploadLacesImage = uploadLacesImage;
window.uploadInsoleImage = uploadInsoleImage;
window.uploadDeepARFile = uploadDeepARFile;
window.addLacesColorOption = addLacesColorOption;
window.removeLacesColorOption = removeLacesColorOption;

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Authentication and initialization
async function initializeInventory() {
    const user = await checkUserAuth();

    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    // Only allow shoemaker role
    if (user.role !== 'shoemaker') {
        window.location.href = "/login.html";
        return;
    }

    console.log(`User is ${user.role}`, user.userData);

    // Set user information
    userSession.userId = user.userId;
    userSession.role = user.role;

    // Set user information in header
    getElement('userFullname').textContent = 'Shoemaker';

    // Set profile picture
    const profilePicture = getElement('profilePicture');
    if (user.userData.profilePhoto && user.userData.profilePhoto.url) {
        profilePicture.src = user.userData.profilePhoto.url;
    } else {
        profilePicture.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }

    // Load models
    loadModels();
}

function loadModels() {
    const modelsPath = `smartfit_AR_Database/ar_customization_models`;
    const modelsGrid = getElement('modelsGrid');

    const unsubscribe = readDataRealtime(modelsPath, (result) => {
        modelsGrid.innerHTML = '';
        
        // Process each fixed model
        Object.keys(FIXED_MODELS).forEach(modelId => {
            const fixedModel = FIXED_MODELS[modelId];
            let modelData = null;

            // Check if model exists in database
            if (result.success && result.data && result.data[modelId]) {
                modelData = result.data[modelId];
                console.log(`Loaded model ${modelId} from database:`, modelData);
            } else {
                // Use empty customizations if model doesn't exist in database
                modelData = {
                    ...fixedModel,
                    bodyColors: EMPTY_CUSTOMIZATIONS.bodyColors,
                    laces: EMPTY_CUSTOMIZATIONS.laces,
                    insoles: EMPTY_CUSTOMIZATIONS.insoles,
                    dateAdded: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                console.log(`Model ${modelId} not found in database, using empty customizations`);
            }

            // Create and display model card
            const modelCard = createModelCard(modelId, modelData);
            modelsGrid.appendChild(modelCard);
        });
    });

    return unsubscribe;
}

function createModelCard(modelId, model) {
    const card = document.createElement('div');
    card.className = 'model-card';
    
    const bodyColorsCount = model.bodyColors ? Object.keys(model.bodyColors).length : 0;
    const lacesCount = model.laces ? Object.keys(model.laces).length : 0;
    const insolesCount = model.insoles ? Object.keys(model.insoles).length : 0;

    // Determine status and styling based on whether customizations exist
    const hasCustomizations = bodyColorsCount > 0 || lacesCount > 0 || insolesCount > 0;
    const statusClass = hasCustomizations ? 'status-active' : 'status-inactive';
    const statusText = hasCustomizations ? 'Customizations Available' : 'No Customizations';

    // Create color badges (show first 5 colors)
    let colorBadgesHtml = '';
    if (model.bodyColors && Object.keys(model.bodyColors).length > 0) {
        const colors = Object.keys(model.bodyColors).slice(0, 5);
        colors.forEach(color => {
            const colorData = model.bodyColors[color];
            const hasAllImages = colorData.images && 
                                colorData.images.main && 
                                colorData.images.front && 
                                colorData.images.side && 
                                colorData.images.back &&
                                colorData.deepARFile; // Check for DeepAR file
            const uploadStatus = hasAllImages ? 'uploaded' : 'missing';
            colorBadgesHtml += `
                <div class="color-badge ${uploadStatus}" 
                     style="background-color: ${getColorValue(color)}" 
                     title="${colorData.name} - ${hasAllImages ? 'All files uploaded' : 'Missing files'}">
                    ${!hasAllImages ? '<i class="fas fa-exclamation-triangle warning-icon"></i>' : ''}
                    ${colorData.deepARFile ? '<i class="fas fa-vr-cardboard ar-icon" title="AR Effect Available"></i>' : ''}
                </div>
            `;
        });
        if (Object.keys(model.bodyColors).length > 5) {
            colorBadgesHtml += `<div class="text-badge">+${Object.keys(model.bodyColors).length - 5} more</div>`;
        }
    } else {
        colorBadgesHtml = '<div class="empty-badge">No colors</div>';
    }

    // Create laces badges
    let lacesBadgesHtml = '';
    if (model.laces && Object.keys(model.laces).length > 0) {
        const laces = Object.keys(model.laces).slice(0, 3);
        laces.forEach(lace => {
            lacesBadgesHtml += `<div class="text-badge">${model.laces[lace].id}</div>`;
        });
        if (Object.keys(model.laces).length > 3) {
            lacesBadgesHtml += `<div class="text-badge">+${Object.keys(model.laces).length - 3} more</div>`;
        }
    } else {
        lacesBadgesHtml = '<div class="empty-badge">No laces types</div>';
    }

    // Create insoles badges
    let insolesBadgesHtml = '';
    if (model.insoles && Object.keys(model.insoles).length > 0) {
        const insoles = Object.keys(model.insoles).slice(0, 3);
        insoles.forEach(insole => {
            insolesBadgesHtml += `<div class="text-badge">${model.insoles[insole].id}</div>`;
        });
        if (Object.keys(model.insoles).length > 3) {
            insolesBadgesHtml += `<div class="text-badge">+${Object.keys(model.insoles).length - 3} more</div>`;
        }
    } else {
        insolesBadgesHtml = '<div class="empty-badge">No insole types</div>';
    }

    card.innerHTML = `
        <div class="model-header">
            <img src="${model.baseImage}" alt="${model.name}" class="model-image" onerror="this.src='https://cdn-icons-png.flaticon.com/512/11542/11542598.png'">
            <div class="model-info">
                <h3 class="model-name">${model.name}</h3>
                <div class="model-price">₱${model.basePrice}</div>
                <div class="model-status ${statusClass}">
                    <i class="fas ${hasCustomizations ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                    ${statusText}
                </div>
            </div>
        </div>
        
        <div class="model-stats">
            <div class="stat-item">
                <span class="stat-value">${bodyColorsCount}</span>
                <span class="stat-label">Colors</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${lacesCount}</span>
                <span class="stat-label">Laces Types</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${insolesCount}</span>
                <span class="stat-label">Insoles Types</span>
            </div>
        </div>
        
        <div class="model-customizations">
            <div class="customization-section">
                <div class="customization-title">
                    <i class="fas fa-palette"></i> Body Colors
                </div>
                <div class="customization-items">
                    ${colorBadgesHtml}
                </div>
            </div>
            
            <div class="customization-section">
                <div class="customization-title">
                    <i class="fas fa-grip-lines"></i> Laces Types
                </div>
                <div class="customization-items">
                    ${lacesBadgesHtml}
                </div>
            </div>
            
            <div class="customization-section">
                <div class="customization-title">
                    <i class="fas fa-shoe-prints"></i> Insole Types
                </div>
                <div class="customization-items">
                    ${insolesBadgesHtml}
                </div>
            </div>
        </div>
        
        <div class="model-actions">
            <button class="btn btn-primary" onclick="editModel('${modelId}')">
                <i class="fas fa-edit"></i> ${hasCustomizations ? 'Edit Customizations' : 'Add Customizations'}
            </button>
        </div>
    `;
    
    return card;
}

function getColorValue(colorName) {
    const colorMap = {
        'white': '#e2e2e2',
        'black': '#000000',
        'blue': '#112dcc',
        'red': '#e74c3c',
        'green': '#27ae60',
        'gray': '#2c3e50',
        'yellow': '#f1c40f',
        'purple': '#9b59b6',
        'pink': '#e84393',
        'orange': '#e67e22',
        'brown': '#795548'
    };
    
    return colorMap[colorName] || '#cccccc';
}

function closeModal() {
    getElement('editModelModal').style.display = 'none';
    document.body.classList.remove('modal-open');
    // Clear pending uploads and deletion lists when modal closes
    pendingColorUploads = {};
    pendingLacesUploads = {};
    pendingInsoleUploads = {};
    pendingDeepARUploads = {};
    itemsToDelete = {
        colors: [],
        laces: [],
        insoles: []
    };
}

function editModel(modelId) {
    const modelsPath = `smartfit_AR_Database/ar_customization_models/${modelId}`;
    
    readData(modelsPath).then(result => {
        if (result.success && result.data) {
            // Model exists in database, use its data
            openEditModal(modelId, result.data);
        } else {
            // Model doesn't exist in database, create with empty customizations
            const emptyModel = {
                ...FIXED_MODELS[modelId],
                bodyColors: EMPTY_CUSTOMIZATIONS.bodyColors,
                laces: EMPTY_CUSTOMIZATIONS.laces,
                insoles: EMPTY_CUSTOMIZATIONS.insoles,
                dateAdded: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            openEditModal(modelId, emptyModel);
        }
    }).catch(error => {
        console.error('Error loading model:', error);
        // On error, still open modal with empty customizations
        const emptyModel = {
            ...FIXED_MODELS[modelId],
            bodyColors: EMPTY_CUSTOMIZATIONS.bodyColors,
            laces: EMPTY_CUSTOMIZATIONS.laces,
            insoles: EMPTY_CUSTOMIZATIONS.insoles,
            dateAdded: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };
        openEditModal(modelId, emptyModel);
    });
}

function openEditModal(modelId, model) {
    const modalContent = getElement('editModelContent');
    const modalElement = getElement('editModelModal');

    // Reset pending uploads and deletion lists
    pendingColorUploads = {};
    pendingLacesUploads = {};
    pendingInsoleUploads = {};
    pendingDeepARUploads = {};
    itemsToDelete = {
        colors: [],
        laces: [],
        insoles: []
    };

    // Store current model data for reference
    modalElement.currentModelData = model;
    modalElement.currentModelId = modelId;

    // Check if model has any customizations
    const hasCustomizations = Object.keys(model.bodyColors).length > 0 || 
                             Object.keys(model.laces).length > 0 || 
                             Object.keys(model.insoles).length > 0;

    // Generate body colors HTML
    let bodyColorsHtml = '';
    if (model.bodyColors && Object.keys(model.bodyColors).length > 0) {
        Object.entries(model.bodyColors).forEach(([colorKey, colorData]) => {
            const hasAllImages = colorData.images && 
                                colorData.images.main && 
                                colorData.images.front && 
                                colorData.images.side && 
                                colorData.images.back;
            const hasDeepARFile = colorData.deepARFile;
            const allFilesUploaded = hasAllImages && hasDeepARFile;
            
            bodyColorsHtml += `
                <div class="color-option-with-upload" data-color="${colorKey}">
                    <div class="color-option selected" style="background-color: ${getColorValue(colorKey)}" title="${colorData.name}">
                        <span class="remove-color" onclick="removeColorOption('${colorKey}')">&times;</span>
                    </div>
                    <div class="color-upload-section">
                        <div class="upload-buttons-grid">
                            <button type="button" class="btn btn-small btn-upload" onclick="uploadSingleImage('${modelId}', '${colorKey}', 'main')">
                                <i class="fas fa-upload"></i> Main
                            </button>
                            <button type="button" class="btn btn-small btn-upload" onclick="uploadSingleImage('${modelId}', '${colorKey}', 'front')">
                                <i class="fas fa-upload"></i> Front
                            </button>
                            <button type="button" class="btn btn-small btn-upload" onclick="uploadSingleImage('${modelId}', '${colorKey}', 'side')">
                                <i class="fas fa-upload"></i> Side
                            </button>
                            <button type="button" class="btn btn-small btn-upload" onclick="uploadSingleImage('${modelId}', '${colorKey}', 'back')">
                                <i class="fas fa-upload"></i> Back
                            </button>
                            <button type="button" class="btn btn-small btn-deepar" onclick="uploadDeepARFile('${modelId}', '${colorKey}')">
                                <i class="fas fa-vr-cardboard"></i> DeepAR File
                            </button>
                        </div>
                        <div class="upload-status ${allFilesUploaded ? 'uploaded' : 'missing'}">
                            <i class="fas ${allFilesUploaded ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                            ${allFilesUploaded ? 'All files uploaded' : '5 files required (4 images + DeepAR)'}
                        </div>
                        ${colorData.images || colorData.deepARFile ? `
                            <div class="image-preview-links">
                                <small>Uploaded files:</small>
                                <div class="image-links">
                                    ${colorData.images?.main ? `<span class="image-link" title="${colorData.images.main}">✓ main.png</span>` : '<span class="image-link missing">✗ main.png</span>'}
                                    ${colorData.images?.front ? `<span class="image-link" title="${colorData.images.front}">✓ front.png</span>` : '<span class="image-link missing">✗ front.png</span>'}
                                    ${colorData.images?.side ? `<span class="image-link" title="${colorData.images.side}">✓ side.png</span>` : '<span class="image-link missing">✗ side.png</span>'}
                                    ${colorData.images?.back ? `<span class="image-link" title="${colorData.images.back}">✓ back.png</span>` : '<span class="image-link missing">✗ back.png</span>'}
                                    ${colorData.deepARFile ? `<span class="image-link deepar" title="${colorData.deepARFile}">✓ effect.deepar</span>` : '<span class="image-link deepar missing">✗ effect.deepar</span>'}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
    } else {
        bodyColorsHtml = '<div class="empty-state-small">No colors added yet</div>';
    }

    // Generate laces HTML (unchanged)
    let lacesHtml = '';
    if (model.laces && Object.keys(model.laces).length > 0) {
        Object.entries(model.laces).forEach(([laceKey, laceData]) => {
            const hasImage = laceData.image && laceData.image.includes('https://');
            const colorsHtml = generateLacesColorsHtml(laceData.id, laceData.colors || []);
            
            lacesHtml += `
                <div class="customization-item-edit" data-id="${laceData.id}">
                    <div class="customization-item-header">
                        <div class="customization-item-title">${laceData.id}</div>
                        <button type="button" class="btn btn-danger btn-small" onclick="removeLacesOption('${laceData.id}')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                    <div class="customization-item-fields">
                        <div class="form-group">
                            <label>Price (₱)</label>
                            <input type="number" class="form-control" value="${laceData.price}" data-field="price" min="0">
                        </div>
                        <div class="form-group">
                            <label>Additional Days</label>
                            <input type="number" class="form-control" value="${laceData.days}" data-field="days" min="0">
                        </div>
                        <div class="form-group">
                            <label>Image</label>
                            <div class="upload-section">
                                <button type="button" class="btn btn-small btn-upload" onclick="uploadLacesImage('${modelId}', '${laceData.id}')">
                                    <i class="fas fa-upload"></i> Upload Laces Image
                                </button>
                                <div class="upload-status ${hasImage ? 'uploaded' : 'missing'}">
                                    <i class="fas ${hasImage ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                                    ${hasImage ? 'Image uploaded' : 'No image uploaded'}
                                </div>
                                ${laceData.image ? `
                                    <div class="image-preview-links">
                                        <small>Uploaded image:</small>
                                        <div class="image-links">
                                            <span class="image-link" title="${laceData.image}">✓ ${laceData.id}.png</span>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Available Colors</label>
                        <div class="laces-colors-container" id="lacesColors_${laceData.id}">
                            ${colorsHtml}
                            <button type="button" class="add-color-btn" onclick="addLacesColorOption('${laceData.id}')">
                                <i class="fas fa-plus"></i> Add Color
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        lacesHtml = '<div class="empty-state-small">No laces types added yet</div>';
    }

    // Generate insoles HTML (unchanged)
    let insolesHtml = '';
    if (model.insoles && Object.keys(model.insoles).length > 0) {
        Object.entries(model.insoles).forEach(([insoleKey, insoleData]) => {
            const hasImage = insoleData.image && insoleData.image.includes('https://');
            
            insolesHtml += `
                <div class="customization-item-edit" data-id="${insoleData.id}">
                    <div class="customization-item-header">
                        <div class="customization-item-title">${insoleData.id}</div>
                        <button type="button" class="btn btn-danger btn-small" onclick="removeInsoleOption('${insoleData.id}')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                    <div class="customization-item-fields">
                        <div class="form-group">
                            <label>Price (₱)</label>
                            <input type="number" class="form-control" value="${insoleData.price}" data-field="price" min="0">
                        </div>
                        <div class="form-group">
                            <label>Additional Days</label>
                            <input type="number" class="form-control" value="${insoleData.days}" data-field="days" min="0">
                        </div>
                        <div class="form-group">
                            <label>Image</label>
                            <div class="upload-section">
                                <button type="button" class="btn btn-small btn-upload" onclick="uploadInsoleImage('${modelId}', '${insoleData.id}')">
                                    <i class="fas fa-upload"></i> Upload Insole Image
                                </button>
                                <div class="upload-status ${hasImage ? 'uploaded' : 'missing'}">
                                    <i class="fas ${hasImage ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                                    ${hasImage ? 'Image uploaded' : 'No image uploaded'}
                                </div>
                                ${insoleData.image ? `
                                    <div class="image-preview-links">
                                        <small>Uploaded image:</small>
                                        <div class="image-links">
                                            <span class="image-link" title="${insoleData.image}">✓ ${insoleData.id}.png</span>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        insolesHtml = '<div class="empty-state-small">No insole types added yet</div>';
    }

    modalContent.innerHTML = `
        <div class="modal-header">
            <h2><i class="fas fa-edit"></i> ${hasCustomizations ? 'Edit' : 'Add'} ${model.name} Customizations</h2>
            <span class="close-modal" onclick="cancelEdit()">&times;</span>
        </div>
        <div class="modal-body">
            ${!hasCustomizations ? `
                <div class="setup-notice">
                    <i class="fas fa-info-circle"></i>
                    <h4>No Customizations Found</h4>
                    <p>This model doesn't have any customization options set up yet. Please add body colors, laces types, and insole types below.</p>
                    <p><strong>Note:</strong> Each body color requires 4 images (main, front, side, back) and 1 DeepAR effect file.</p>
                </div>
            ` : ''}
            
            <form class="edit-form" id="editModelForm" data-modelid="${modelId}">
                <div class="model-basic-info">
                    <div class="form-group">
                        <label for="modelName">Model Name</label>
                        <input type="text" id="modelName" class="form-control" value="${model.name}" disabled>
                    </div>
                    
                    <div class="form-group">
                        <label for="basePrice">Base Price (₱)</label>
                        <input type="number" id="basePrice" class="form-control" value="${model.basePrice}" min="0" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="baseDays">Base Production Days</label>
                        <input type="number" id="baseDays" class="form-control" value="${model.baseDays}" min="0" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="baseImage">Base Image URL</label>
                        <input type="text" id="baseImage" class="form-control" value="${model.baseImage || ''}" placeholder="/images/model_image.png">
                    </div>
                </div>
                
                <div class="customization-section-edit">
                    <h3 class="section-title-edit"><i class="fas fa-palette"></i> Body Colors</h3>
                    <p class="section-description">Add the available body colors for this model. For each color, you must upload 4 images (main, front, side, back) AND 1 DeepAR effect file (.deepar) that will be used in the AR customization interface.</p>
                    <div class="color-picker-with-upload" id="bodyColorsContainer">
                        ${bodyColorsHtml}
                        <div class="add-color-btn" onclick="addColorOption()">
                            <i class="fas fa-plus"></i>
                        </div>
                    </div>
                </div>
                
                <div class="customization-section-edit">
                    <h3 class="section-title-edit"><i class="fas fa-grip-lines"></i> Laces Types</h3>
                    <p class="section-description">Add different types of laces with their prices and available colors.</p>
                    <div class="customization-items-edit" id="lacesContainer">
                        ${lacesHtml}
                    </div>
                    <button type="button" class="add-item-btn" onclick="addLacesOption()">
                        <i class="fas fa-plus"></i> Add New Laces Type
                    </button>
                </div>
                
                <div class="customization-section-edit">
                    <h3 class="section-title-edit"><i class="fas fa-shoe-prints"></i> Insole Types</h3>
                    <p class="section-description">Add different types of insoles with their prices and features.</p>
                    <div class="customization-items-edit" id="insolesContainer">
                        ${insolesHtml}
                    </div>
                    <button type="button" class="add-item-btn" onclick="addInsoleOption()">
                        <i class="fas fa-plus"></i> Add New Insole Type
                    </button>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="cancelEdit()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save to Database</button>
                </div>
            </form>
        </div>
    `;

    modalElement.style.display = 'block';
    document.body.classList.add('modal-open');

    // Add form submit handler
    const form = getElement('editModelForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        saveModel(modelId);
    });
}

function generateLacesColorsHtml(lacesId, colors) {
    if (!colors || colors.length === 0) {
        return '<div class="empty-state-small">No colors added yet</div>';
    }

    let colorsHtml = '';
    colors.forEach(color => {
        colorsHtml += `
            <div class="laces-color-option" data-color="${color}">
                <div class="color-option selected" style="background-color: ${getColorValue(color)}" title="${color}">
                    <span class="remove-color" onclick="removeLacesColorOption('${lacesId}', '${color}')">&times;</span>
                </div>
            </div>
        `;
    });
    return colorsHtml;
}

function cancelEdit() {
    closeModal();
}

// Store files instead of uploading immediately
function uploadSingleImage(modelId, colorName, angle) {
    // Create file input for single image
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.click();

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show file selected status
        const uploadButton = document.querySelector(`[data-color="${colorName}"] .btn-upload:nth-child(${['main', 'front', 'side', 'back'].indexOf(angle) + 1})`);
        const originalText = uploadButton.innerHTML;
        uploadButton.innerHTML = '<i class="fas fa-check"></i> Selected';
        uploadButton.style.backgroundColor = '#48cfad';

        // Store file in pending uploads (not uploading yet)
        if (!pendingColorUploads[colorName]) {
            pendingColorUploads[colorName] = { files: {}, modelId: modelId };
        }
        pendingColorUploads[colorName].files[angle] = file;

        // Update UI to show file is selected but not uploaded
        updateImageLinkUI(colorName, angle, 'Selected - waiting for save');
        updateUploadStatus(colorName);

        console.log(`File selected for ${colorName} - ${angle}:`, file.name);
    };
}

// Upload DeepAR file
function uploadDeepARFile(modelId, colorName) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.deepar';
    fileInput.click();

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.deepar')) {
            alert('Please select a valid .deepar file');
            return;
        }

        // Show file selected status
        const deepARButton = document.querySelector(`[data-color="${colorName}"] .btn-deepar`);
        deepARButton.innerHTML = '<i class="fas fa-check"></i> Selected';
        deepARButton.style.backgroundColor = '#48cfad';

        // Store file in pending uploads
        if (!pendingDeepARUploads[colorName]) {
            pendingDeepARUploads[colorName] = { file: null, modelId: modelId };
        }
        pendingDeepARUploads[colorName].file = file;

        // Update UI to show file is selected but not uploaded
        updateDeepARLinkUI(colorName, 'Selected - waiting for save');
        updateUploadStatus(colorName);

        console.log(`DeepAR file selected for ${colorName}:`, file.name);
    };
}

// Upload laces image
function uploadLacesImage(modelId, lacesId) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.click();

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show file selected status
        const lacesElement = document.querySelector(`#lacesContainer .customization-item-edit[data-id="${lacesId}"]`);
        const uploadButton = lacesElement.querySelector('.btn-upload');
        uploadButton.innerHTML = '<i class="fas fa-check"></i> Selected';
        uploadButton.style.backgroundColor = '#48cfad';

        // Store file in pending uploads
        pendingLacesUploads[lacesId] = { file: file, modelId: modelId };

        // Update UI
        updateLacesUploadStatus(lacesId, 'Selected - waiting for save');
    };
}

// Upload insole image
function uploadInsoleImage(modelId, insoleId) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.click();

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show file selected status
        const insoleElement = document.querySelector(`#insolesContainer .customization-item-edit[data-id="${insoleId}"]`);
        const uploadButton = insoleElement.querySelector('.btn-upload');
        uploadButton.innerHTML = '<i class="fas fa-check"></i> Selected';
        uploadButton.style.backgroundColor = '#48cfad';

        // Store file in pending uploads
        pendingInsoleUploads[insoleId] = { file: file, modelId: modelId };

        // Update UI
        updateInsoleUploadStatus(insoleId, 'Selected - waiting for save');
    };
}

// Upload all pending images and get their URLs
async function uploadPendingImages() {
    const uploadResults = {
        colors: {},
        laces: {},
        insoles: {}
    };
    
    // Upload color images
    for (const [colorName, colorData] of Object.entries(pendingColorUploads)) {
        if (!colorData.files) continue;
        
        uploadResults.colors[colorName] = { images: {} };
        const modelId = colorData.modelId;
        
        for (const [angle, file] of Object.entries(colorData.files)) {
            try {
                // Show uploading status
                const uploadButton = document.querySelector(`[data-color="${colorName}"] .btn-upload:nth-child(${['main', 'front', 'side', 'back'].indexOf(angle) + 1})`);
                if (uploadButton) {
                    uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
                    uploadButton.disabled = true;
                }

                // Always rename to the standardized filename regardless of original name
                const storagePath = `images/angles/${modelId}/${colorName}/${angle}.png`;
                
                console.log(`Uploading ${angle} image for ${colorName} to: ${storagePath}`);
                
                const result = await addFile(file, storagePath);
                if (!result.success) {
                    throw new Error(`Failed to upload ${angle} image: ${result.error}`);
                }

                // Store the uploaded image URL
                uploadResults.colors[colorName].images[angle] = result.url;

                // Update UI to show uploaded
                if (uploadButton) {
                    uploadButton.innerHTML = '<i class="fas fa-check"></i> Uploaded';
                    uploadButton.style.backgroundColor = '#48cfad';
                }

                updateImageLinkUI(colorName, angle, result.url);
                console.log(`Successfully uploaded ${angle} image for ${colorName}:`, result.url);
                
            } catch (error) {
                console.error(`Error uploading ${angle} image for ${colorName}:`, error);
                
                const uploadButton = document.querySelector(`[data-color="${colorName}"] .btn-upload:nth-child(${['main', 'front', 'side', 'back'].indexOf(angle) + 1})`);
                if (uploadButton) {
                    uploadButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed';
                    uploadButton.style.backgroundColor = '#ff6b6b';
                }
                
                throw new Error(`Failed to upload ${angle} image for ${colorName}: ${error.message}`);
            }
        }
    }
    
    // Upload DeepAR files using deepARMethods
    for (const [colorName, deepARData] of Object.entries(pendingDeepARUploads)) {
        if (!deepARData.file) continue;
        
        try {
            const deepARButton = document.querySelector(`[data-color="${colorName}"] .btn-deepar`);
            if (deepARButton) {
                deepARButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
                deepARButton.disabled = true;
            }

            const modelId = deepARData.modelId;
            const storagePath = `deepar/effects/${modelId}/${colorName}/effect.deepar`;
            
            console.log(`Uploading DeepAR file for ${colorName} to: ${storagePath}`);
            
            // Use deepARMethods storageService to upload the file
            const result = await storageService.uploadFile(
                deepARData.file, 
                storagePath,
                (progress) => {
                    console.log(`DeepAR upload progress for ${colorName}: ${progress}%`);
                }
            );

            if (!result.success) {
                throw new Error(`Failed to upload DeepAR file: ${result.error}`);
            }

            // Store the uploaded DeepAR file URL
            if (!uploadResults.colors[colorName]) {
                uploadResults.colors[colorName] = {};
            }
            uploadResults.colors[colorName].deepARFile = result.downloadURL;

            // Update UI to show uploaded
            if (deepARButton) {
                deepARButton.innerHTML = '<i class="fas fa-check"></i> Uploaded';
                deepARButton.style.backgroundColor = '#48cfad';
            }

            updateDeepARLinkUI(colorName, result.downloadURL);
            console.log(`Successfully uploaded DeepAR file for ${colorName}:`, result.downloadURL);
            
        } catch (error) {
            console.error(`Error uploading DeepAR file for ${colorName}:`, error);
            
            const deepARButton = document.querySelector(`[data-color="${colorName}"] .btn-deepar`);
            if (deepARButton) {
                deepARButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed';
                deepARButton.style.backgroundColor = '#ff6b6b';
            }
            
            throw new Error(`Failed to upload DeepAR file for ${colorName}: ${error.message}`);
        }
    }
    
    // Upload laces images
    for (const [lacesId, lacesData] of Object.entries(pendingLacesUploads)) {
        try {
            const lacesElement = document.querySelector(`#lacesContainer .customization-item-edit[data-id="${lacesId}"]`);
            const uploadButton = lacesElement.querySelector('.btn-upload');
            uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            uploadButton.disabled = true;

            const storagePath = `images/laces/${lacesData.modelId}/${lacesId}.png`;
            console.log(`Uploading laces image for ${lacesId} to: ${storagePath}`);
            
            const result = await addFile(lacesData.file, storagePath);
            if (!result.success) {
                throw new Error(`Failed to upload laces image: ${result.error}`);
            }

            uploadResults.laces[lacesId] = result.url;

            uploadButton.innerHTML = '<i class="fas fa-check"></i> Uploaded';
            uploadButton.style.backgroundColor = '#48cfad';
            updateLacesUploadStatus(lacesId, result.url);

        } catch (error) {
            console.error(`Error uploading laces image for ${lacesId}:`, error);
            const lacesElement = document.querySelector(`#lacesContainer .customization-item-edit[data-id="${lacesId}"]`);
            const uploadButton = lacesElement.querySelector('.btn-upload');
            uploadButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed';
            uploadButton.style.backgroundColor = '#ff6b6b';
            throw new Error(`Failed to upload laces image for ${lacesId}: ${error.message}`);
        }
    }
    
    // Upload insole images
    for (const [insoleId, insoleData] of Object.entries(pendingInsoleUploads)) {
        try {
            const insoleElement = document.querySelector(`#insolesContainer .customization-item-edit[data-id="${insoleId}"]`);
            const uploadButton = insoleElement.querySelector('.btn-upload');
            uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            uploadButton.disabled = true;

            const storagePath = `images/insoles/${insoleData.modelId}/${insoleId}.png`;
            console.log(`Uploading insole image for ${insoleId} to: ${storagePath}`);
            
            const result = await addFile(insoleData.file, storagePath);
            if (!result.success) {
                throw new Error(`Failed to upload insole image: ${result.error}`);
            }

            uploadResults.insoles[insoleId] = result.url;

            uploadButton.innerHTML = '<i class="fas fa-check"></i> Uploaded';
            uploadButton.style.backgroundColor = '#48cfad';
            updateInsoleUploadStatus(insoleId, result.url);

        } catch (error) {
            console.error(`Error uploading insole image for ${insoleId}:`, error);
            const insoleElement = document.querySelector(`#insolesContainer .customization-item-edit[data-id="${insoleId}"]`);
            const uploadButton = insoleElement.querySelector('.btn-upload');
            uploadButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed';
            uploadButton.style.backgroundColor = '#ff6b6b';
            throw new Error(`Failed to upload insole image for ${insoleId}: ${error.message}`);
        }
    }
    
    return uploadResults;
}

// Delete files from storage for removed items
async function deleteRemovedItemsFiles(modelId) {
    const deletionPromises = [];

    // Delete color images and DeepAR files
    for (const colorKey of itemsToDelete.colors) {
        const angles = ['main', 'front', 'side', 'back'];
        for (const angle of angles) {
            const storagePath = `images/angles/${modelId}/${colorKey}/${angle}.png`;
            deletionPromises.push(deleteFile(storagePath).catch(error => {
                console.warn(`Failed to delete ${angle} image for color ${colorKey}:`, error);
            }));
        }
        
        // Delete DeepAR file
        const deepARPath = `deepar/effects/${modelId}/${colorKey}/effect.deepar`;
        deletionPromises.push(
            storageService.deleteFile(deepARPath).catch(error => {
                console.warn(`Failed to delete DeepAR file for color ${colorKey}:`, error);
            })
        );
    }

    // Delete laces images
    for (const laceId of itemsToDelete.laces) {
        const storagePath = `images/laces/${modelId}/${laceId}.png`;
        deletionPromises.push(deleteFile(storagePath).catch(error => {
            console.warn(`Failed to delete laces image for ${laceId}:`, error);
        }));
    }

    // Delete insole images
    for (const insoleId of itemsToDelete.insoles) {
        const storagePath = `images/insoles/${modelId}/${insoleId}.png`;
        deletionPromises.push(deleteFile(storagePath).catch(error => {
            console.warn(`Failed to delete insole image for ${insoleId}:`, error);
        }));
    }

    // Wait for all deletions to complete
    await Promise.allSettled(deletionPromises);
    console.log('Completed file deletions for removed items');
}

function updateImageLinkUI(colorName, angle, status) {
    const colorElement = document.querySelector(`[data-color="${colorName}"]`);
    if (!colorElement) return;

    let imageLinksContainer = colorElement.querySelector('.image-preview-links');
    if (!imageLinksContainer) {
        imageLinksContainer = createImageLinksContainer(colorElement);
    }

    const imageLink = imageLinksContainer.querySelector(`.image-link.${angle}`);
    if (imageLink) {
        if (status.includes('https://')) {
            // It's a URL - uploaded successfully
            imageLink.className = `image-link ${angle}`;
            imageLink.innerHTML = `✓ ${angle}.png`;
            imageLink.title = status;
        } else {
            // It's a status message
            imageLink.className = `image-link ${angle} pending`;
            imageLink.innerHTML = `⏳ ${angle}.png`;
            imageLink.title = status;
        }
    } else {
        // Create new link if it doesn't exist
        const imageLinks = imageLinksContainer.querySelector('.image-links');
        const newLink = document.createElement('span');
        if (status.includes('https://')) {
            newLink.className = `image-link ${angle}`;
            newLink.innerHTML = `✓ ${angle}.png`;
            newLink.title = status;
        } else {
            newLink.className = `image-link ${angle} pending`;
            newLink.innerHTML = `⏳ ${angle}.png`;
            newLink.title = status;
        }
        imageLinks.appendChild(newLink);
    }
}

function updateDeepARLinkUI(colorName, status) {
    const colorElement = document.querySelector(`[data-color="${colorName}"]`);
    if (!colorElement) return;

    let imageLinksContainer = colorElement.querySelector('.image-preview-links');
    if (!imageLinksContainer) {
        imageLinksContainer = createImageLinksContainer(colorElement);
    }

    const deepARLink = imageLinksContainer.querySelector('.image-link.deepar');
    if (deepARLink) {
        if (status.includes('https://')) {
            // It's a URL - uploaded successfully
            deepARLink.className = 'image-link deepar';
            deepARLink.innerHTML = '✓ effect.deepar';
            deepARLink.title = status;
        } else {
            // It's a status message
            deepARLink.className = 'image-link deepar pending';
            deepARLink.innerHTML = '⏳ effect.deepar';
            deepARLink.title = status;
        }
    } else {
        // Create new link if it doesn't exist
        const imageLinks = imageLinksContainer.querySelector('.image-links');
        const newLink = document.createElement('span');
        if (status.includes('https://')) {
            newLink.className = 'image-link deepar';
            newLink.innerHTML = '✓ effect.deepar';
            newLink.title = status;
        } else {
            newLink.className = 'image-link deepar pending';
            newLink.innerHTML = '⏳ effect.deepar';
            newLink.title = status;
        }
        imageLinks.appendChild(newLink);
    }
}

function updateLacesUploadStatus(lacesId, status) {
    const lacesElement = document.querySelector(`#lacesContainer .customization-item-edit[data-id="${lacesId}"]`);
    if (!lacesElement) return;

    const uploadStatus = lacesElement.querySelector('.upload-status');
    const imageLinksContainer = lacesElement.querySelector('.image-preview-links');

    if (status.includes('https://')) {
        uploadStatus.innerHTML = '<i class="fas fa-check-circle"></i> Image uploaded';
        uploadStatus.className = 'upload-status uploaded';
        
        if (!imageLinksContainer) {
            const uploadSection = lacesElement.querySelector('.upload-section');
            const newImageLinks = document.createElement('div');
            newImageLinks.className = 'image-preview-links';
            newImageLinks.innerHTML = `
                <small>Uploaded image:</small>
                <div class="image-links">
                    <span class="image-link" title="${status}">✓ ${lacesId}.png</span>
                </div>
            `;
            uploadSection.appendChild(newImageLinks);
        } else {
            const imageLink = imageLinksContainer.querySelector('.image-link');
            if (imageLink) {
                imageLink.innerHTML = `✓ ${lacesId}.png`;
                imageLink.title = status;
            }
        }
    } else {
        uploadStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No image uploaded';
        uploadStatus.className = 'upload-status missing';
    }
}

function updateInsoleUploadStatus(insoleId, status) {
    const insoleElement = document.querySelector(`#insolesContainer .customization-item-edit[data-id="${insoleId}"]`);
    if (!insoleElement) return;

    const uploadStatus = insoleElement.querySelector('.upload-status');
    const imageLinksContainer = insoleElement.querySelector('.image-preview-links');

    if (status.includes('https://')) {
        uploadStatus.innerHTML = '<i class="fas fa-check-circle"></i> Image uploaded';
        uploadStatus.className = 'upload-status uploaded';
        
        if (!imageLinksContainer) {
            const uploadSection = insoleElement.querySelector('.upload-section');
            const newImageLinks = document.createElement('div');
            newImageLinks.className = 'image-preview-links';
            newImageLinks.innerHTML = `
                <small>Uploaded image:</small>
                <div class="image-links">
                    <span class="image-link" title="${status}">✓ ${insoleId}.png</span>
                </div>
            `;
            uploadSection.appendChild(newImageLinks);
        } else {
            const imageLink = imageLinksContainer.querySelector('.image-link');
            if (imageLink) {
                imageLink.innerHTML = `✓ ${insoleId}.png`;
                imageLink.title = status;
            }
        }
    } else {
        uploadStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No image uploaded';
        uploadStatus.className = 'upload-status missing';
    }
}

function updateUploadStatus(colorName) {
    const colorElement = document.querySelector(`[data-color="${colorName}"]`);
    if (!colorElement) return;

    const uploadStatus = colorElement.querySelector('.upload-status');
    const imageLinks = colorElement.querySelectorAll('.image-link:not(.missing)');
    
    const uploadedImagesCount = colorElement.querySelectorAll('.image-link:not(.missing):not(.pending):not(.deepar)').length;
    const hasDeepARFile = colorElement.querySelector('.image-link.deepar:not(.missing):not(.pending)');
    const totalRequired = 5; // 4 images + 1 DeepAR file
    
    const uploadedCount = uploadedImagesCount + (hasDeepARFile ? 1 : 0);
    
    if (uploadedCount === totalRequired) {
        uploadStatus.innerHTML = '<i class="fas fa-check-circle"></i> All files uploaded';
        uploadStatus.className = 'upload-status uploaded';
    } else if (uploadedCount > 0) {
        uploadStatus.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${uploadedCount}/${totalRequired} files uploaded`;
        uploadStatus.className = 'upload-status missing';
    } else {
        uploadStatus.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 0/${totalRequired} files uploaded`;
        uploadStatus.className = 'upload-status missing';
    }
}

function createImageLinksContainer(colorElement) {
    const uploadSection = colorElement.querySelector('.color-upload-section');
    const imageLinksContainer = document.createElement('div');
    imageLinksContainer.className = 'image-preview-links';
    imageLinksContainer.innerHTML = `
        <small>Uploaded files:</small>
        <div class="image-links">
            <span class="image-link main missing">✗ main.png</span>
            <span class="image-link front missing">✗ front.png</span>
            <span class="image-link side missing">✗ side.png</span>
            <span class="image-link back missing">✗ back.png</span>
            <span class="image-link deepar missing">✗ effect.deepar</span>
        </div>
    `;
    uploadSection.appendChild(imageLinksContainer);
    return imageLinksContainer;
}

async function saveModel(modelId) {
    const form = getElement('editModelForm');
    const saveButton = form.querySelector('button[type="submit"]');
    const originalButtonText = saveButton.innerHTML;
    
    try {
        // Disable save button and show loading
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        // Get basic model info
        const basePrice = parseInt(getElement('basePrice').value);
        const baseDays = parseInt(getElement('baseDays').value);
        const baseImage = getElement('baseImage').value;
        
        // First, get the existing model data from database to preserve existing colors
        const existingModelResult = await readData(`smartfit_AR_Database/ar_customization_models/${modelId}`);
        const existingModelData = existingModelResult.success ? existingModelResult.data : null;
        
        // Upload all pending images first
        let uploadedImageResults = {};
        if (Object.keys(pendingColorUploads).length > 0 || 
            Object.keys(pendingDeepARUploads).length > 0 ||
            Object.keys(pendingLacesUploads).length > 0 || 
            Object.keys(pendingInsoleUploads).length > 0) {
            alert('Starting file uploads... This may take a moment.');
            uploadedImageResults = await uploadPendingImages();
        }
        
        // Delete files for removed items
        if (itemsToDelete.colors.length > 0 || itemsToDelete.laces.length > 0 || itemsToDelete.insoles.length > 0) {
            alert('Deleting files for removed items...');
            await deleteRemovedItemsFiles(modelId);
        }
        
        // Get body colors - merge existing data with uploaded images, excluding removed colors
        const bodyColors = {};
        const colorElements = document.querySelectorAll('#bodyColorsContainer .color-option-with-upload');
        
        // First, preserve all existing colors from database that are not marked for deletion
        if (existingModelData && existingModelData.bodyColors) {
            Object.keys(existingModelData.bodyColors).forEach(colorKey => {
                // Only keep colors that are not marked for deletion and still exist in the form
                if (!itemsToDelete.colors.includes(colorKey)) {
                    bodyColors[colorKey] = existingModelData.bodyColors[colorKey];
                }
            });
        }
        
        // Now update with colors from the form (both existing and new)
        colorElements.forEach(colorEl => {
            const colorKey = colorEl.dataset.color;
            
            // Skip colors marked for deletion
            if (itemsToDelete.colors.includes(colorKey)) {
                return;
            }
            
            // Check if this color already exists in database
            const existingColorData = existingModelData && existingModelData.bodyColors && existingModelData.bodyColors[colorKey] 
                ? { ...existingModelData.bodyColors[colorKey] }
                : { name: colorKey.charAt(0).toUpperCase() + colorKey.slice(1) };
            
            // Merge with uploaded images if any
            if (uploadedImageResults.colors && uploadedImageResults.colors[colorKey]) {
                bodyColors[colorKey] = {
                    ...existingColorData,
                    images: {
                        ...(existingColorData.images || {}),
                        ...uploadedImageResults.colors[colorKey].images
                    },
                    deepARFile: uploadedImageResults.colors[colorKey].deepARFile || existingColorData.deepARFile
                };
            } else {
                // If no new files uploaded, keep existing data or create new entry
                bodyColors[colorKey] = existingColorData;
            }
        });
        
        // Get laces - merge existing data with form data, excluding removed laces
        const laces = {};
        // First preserve existing laces that are not marked for deletion
        if (existingModelData && existingModelData.laces) {
            Object.keys(existingModelData.laces).forEach(laceKey => {
                if (!itemsToDelete.laces.includes(laceKey)) {
                    laces[laceKey] = existingModelData.laces[laceKey];
                }
            });
        }
        // Update with laces from form
        document.querySelectorAll('#lacesContainer .customization-item-edit').forEach(laceEl => {
            const id = laceEl.dataset.id;
            
            // Skip laces marked for deletion
            if (itemsToDelete.laces.includes(id)) {
                return;
            }
            
            const price = parseInt(laceEl.querySelector('[data-field="price"]').value) || 0;
            const days = parseInt(laceEl.querySelector('[data-field="days"]').value) || 0;
            
            // Get colors from color options
            const colorsContainer = document.getElementById(`lacesColors_${id}`);
            const colors = [];
            if (colorsContainer) {
                const colorOptions = colorsContainer.querySelectorAll('.laces-color-option');
                colorOptions.forEach(option => {
                    colors.push(option.dataset.color);
                });
            }
            
            // Use uploaded image if available, otherwise keep existing image
            let image = '';
            if (uploadedImageResults.laces && uploadedImageResults.laces[id]) {
                image = uploadedImageResults.laces[id];
            } else if (existingModelData && existingModelData.laces && existingModelData.laces[id]) {
                image = existingModelData.laces[id].image || '';
            }
            
            laces[id] = {
                id: id,
                price: price,
                days: days,
                image: image,
                colors: colors
            };
        });
        
        // Get insoles - merge existing data with form data, excluding removed insoles
        const insoles = {};
        // First preserve existing insoles that are not marked for deletion
        if (existingModelData && existingModelData.insoles) {
            Object.keys(existingModelData.insoles).forEach(insoleKey => {
                if (!itemsToDelete.insoles.includes(insoleKey)) {
                    insoles[insoleKey] = existingModelData.insoles[insoleKey];
                }
            });
        }
        // Update with insoles from form
        document.querySelectorAll('#insolesContainer .customization-item-edit').forEach(insoleEl => {
            const id = insoleEl.dataset.id;
            
            // Skip insoles marked for deletion
            if (itemsToDelete.insoles.includes(id)) {
                return;
            }
            
            const price = parseInt(insoleEl.querySelector('[data-field="price"]').value) || 0;
            const days = parseInt(insoleEl.querySelector('[data-field="days"]').value) || 0;
            
            // Use uploaded image if available, otherwise keep existing image
            let image = '';
            if (uploadedImageResults.insoles && uploadedImageResults.insoles[id]) {
                image = uploadedImageResults.insoles[id];
            } else if (existingModelData && existingModelData.insoles && existingModelData.insoles[id]) {
                image = existingModelData.insoles[id].image || '';
            }
            
            insoles[id] = {
                id: id,
                price: price,
                days: days,
                image: image
            };
        });
        
        // Prepare model data
        const modelData = {
            ...FIXED_MODELS[modelId],
            basePrice: basePrice,
            baseDays: baseDays,
            baseImage: baseImage,
            bodyColors: bodyColors,
            laces: laces,
            insoles: insoles,
            lastUpdated: new Date().toISOString()
        };
        
        // Add dateAdded if it's a new model in database
        if (!existingModelData) {
            modelData.dateAdded = new Date().toISOString();
        } else {
            modelData.dateAdded = existingModelData.dateAdded || new Date().toISOString();
        }
        
        // Save to Firebase Database
        const result = await saveModelToDatabase(modelId, modelData);
        
        if (result.success) {
            // Clear pending uploads and deletion lists after successful save
            pendingColorUploads = {};
            pendingLacesUploads = {};
            pendingInsoleUploads = {};
            pendingDeepARUploads = {};
            itemsToDelete = {
                colors: [],
                laces: [],
                insoles: []
            };
            alert('Customizations saved to database successfully!');
            closeModal();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error("Error saving model:", error);
        alert('Error saving to database: ' + error.message);
    } finally {
        // Re-enable save button
        saveButton.disabled = false;
        saveButton.innerHTML = originalButtonText;
    }
}

async function saveModelToDatabase(modelId, modelData) {
    const modelPath = `smartfit_AR_Database/ar_customization_models/${modelId}`;
    
    // Check if model exists in database
    const existingModel = await readData(modelPath);
    
    if (existingModel.success && existingModel.data) {
        // Update existing model
        return await updateData(modelPath, modelData);
    } else {
        // Create new model in database
        return await createData(modelPath, userSession.userId, modelData);
    }
}

function addColorOption() {
    const colorName = prompt("Enter color name (e.g., green, pink, yellow):");
    if (!colorName) return;
    
    const normalizedColor = colorName.toLowerCase().trim();
    if (!normalizedColor) return;
    
    const container = getElement('bodyColorsContainer');
    const modelId = getElement('editModelForm').dataset.modelid;
    
    // Remove empty state if it exists
    const emptyState = container.querySelector('.empty-state-small');
    if (emptyState) {
        emptyState.remove();
    }
    
    const colorWithUploadEl = document.createElement('div');
    colorWithUploadEl.className = 'color-option-with-upload';
    colorWithUploadEl.dataset.color = normalizedColor;
    
    colorWithUploadEl.innerHTML = `
        <div class="color-option selected" style="background-color: ${getColorValue(normalizedColor)}" title="${normalizedColor.charAt(0).toUpperCase() + normalizedColor.slice(1)}">
            <span class="remove-color" onclick="removeColorOption('${normalizedColor}')">&times;</span>
        </div>
        <div class="color-upload-section">
            <div class="upload-buttons-grid">
                <button type="button" class="btn btn-small btn-upload" onclick="uploadSingleImage('${modelId}', '${normalizedColor}', 'main')">
                    <i class="fas fa-upload"></i> Main
                </button>
                <button type="button" class="btn btn-small btn-upload" onclick="uploadSingleImage('${modelId}', '${normalizedColor}', 'front')">
                    <i class="fas fa-upload"></i> Front
                </button>
                <button type="button" class="btn btn-small btn-upload" onclick="uploadSingleImage('${modelId}', '${normalizedColor}', 'side')">
                    <i class="fas fa-upload"></i> Side
                </button>
                <button type="button" class="btn btn-small btn-upload" onclick="uploadSingleImage('${modelId}', '${normalizedColor}', 'back')">
                    <i class="fas fa-upload"></i> Back
                </button>
                <button type="button" class="btn btn-small btn-deepar" onclick="uploadDeepARFile('${modelId}', '${normalizedColor}')">
                    <i class="fas fa-vr-cardboard"></i> DeepAR File
                </button>
            </div>
            <div class="upload-status missing">
                <i class="fas fa-exclamation-triangle"></i> 0/5 files uploaded
            </div>
            <div class="image-preview-links">
                <small>Uploaded files:</small>
                <div class="image-links">
                    <span class="image-link main missing">✗ main.png</span>
                    <span class="image-link front missing">✗ front.png</span>
                    <span class="image-link side missing">✗ side.png</span>
                    <span class="image-link back missing">✗ back.png</span>
                    <span class="image-link deepar missing">✗ effect.deepar</span>
                </div>
            </div>
        </div>
    `;
    
    container.insertBefore(colorWithUploadEl, container.lastElementChild);
}

function removeColorOption(colorKey) {
    if (confirm(`Are you sure you want to remove the color "${colorKey}"? This will also delete all associated images and DeepAR files from storage.`)) {
        const colorEl = document.querySelector(`#bodyColorsContainer .color-option-with-upload[data-color="${colorKey}"]`);
        if (colorEl) {
            colorEl.remove();
        }
        
        // Add to deletion list
        if (!itemsToDelete.colors.includes(colorKey)) {
            itemsToDelete.colors.push(colorKey);
        }
        
        // Remove from pending uploads
        delete pendingColorUploads[colorKey];
        delete pendingDeepARUploads[colorKey];
        
        // Show empty state if no colors left
        const container = getElement('bodyColorsContainer');
        const colorOptions = container.querySelectorAll('.color-option-with-upload');
        if (colorOptions.length === 0) {
            container.innerHTML = '<div class="empty-state-small">No colors added yet</div>' + container.innerHTML;
        }
    }
}

function addLacesOption() {
    const container = getElement('lacesContainer');
    const newId = prompt("Enter laces type name:");
    if (!newId) return;
    
    // Remove empty state if it exists
    const emptyState = container.querySelector('.empty-state-small');
    if (emptyState) {
        emptyState.remove();
    }
    
    const lacesEl = document.createElement('div');
    lacesEl.className = 'customization-item-edit';
    lacesEl.dataset.id = newId;
    
    lacesEl.innerHTML = `
        <div class="customization-item-header">
            <div class="customization-item-title">${newId}</div>
            <button type="button" class="btn btn-danger btn-small" onclick="removeLacesOption('${newId}')">
                <i class="fas fa-trash"></i> Remove
            </button>
        </div>
        <div class="customization-item-fields">
            <div class="form-group">
                <label>Price (₱)</label>
                <input type="number" class="form-control" value="0" data-field="price" min="0">
            </div>
            <div class="form-group">
                <label>Additional Days</label>
                <input type="number" class="form-control" value="0" data-field="days" min="0">
            </div>
            <div class="form-group">
                <label>Image</label>
                <div class="upload-section">
                    <button type="button" class="btn btn-small btn-upload" onclick="uploadLacesImage('${getElement('editModelForm').dataset.modelid}', '${newId}')">
                        <i class="fas fa-upload"></i> Upload Laces Image
                    </button>
                    <div class="upload-status missing">
                        <i class="fas fa-exclamation-triangle"></i> No image uploaded
                    </div>
                </div>
            </div>
        </div>
        <div class="form-group">
            <label>Available Colors</label>
            <div class="laces-colors-container" id="lacesColors_${newId}">
                <div class="empty-state-small">No colors added yet</div>
                <button type="button" class="add-color-btn" onclick="addLacesColorOption('${newId}')">
                    <i class="fas fa-plus"></i> Add Color
                </button>
            </div>
        </div>
    `;
    
    container.appendChild(lacesEl);
}

function removeLacesOption(laceId) {
    if (confirm(`Are you sure you want to remove the laces type "${laceId}"? This will also delete the associated image from storage.`)) {
        console.log('Removing laces:', laceId);
        
        const laceEl = document.querySelector(`#lacesContainer .customization-item-edit[data-id="${laceId}"]`);
        if (laceEl) {
            laceEl.remove();
            console.log('Successfully removed laces element');
        } else {
            console.log('Could not find laces element to remove');
            // Fallback: try to find by iterating
            const allLaces = document.querySelectorAll('#lacesContainer .customization-item-edit');
            for (let i = 0; i < allLaces.length; i++) {
                if (allLaces[i].dataset.id === laceId) {
                    allLaces[i].remove();
                    console.log('Removed via fallback');
                    break;
                }
            }
        }
        
        // Add to deletion list
        if (!itemsToDelete.laces.includes(laceId)) {
            itemsToDelete.laces.push(laceId);
        }
        
        // Remove from pending uploads
        delete pendingLacesUploads[laceId];
        
        // Show empty state if no laces left
        const container = getElement('lacesContainer');
        const lacesItems = container.querySelectorAll('.customization-item-edit');
        if (lacesItems.length === 0) {
            container.innerHTML = '<div class="empty-state-small">No laces types added yet</div>';
        }
    }
}

function addLacesColorOption(lacesId) {
    const colorName = prompt("Enter color name for laces (e.g., white, black, red):");
    if (!colorName) return;
    
    const normalizedColor = colorName.toLowerCase().trim();
    if (!normalizedColor) return;
    
    const container = document.getElementById(`lacesColors_${lacesId}`);
    
    // Remove empty state if it exists
    const emptyState = container.querySelector('.empty-state-small');
    if (emptyState) {
        emptyState.remove();
    }
    
    const colorOption = document.createElement('div');
    colorOption.className = 'laces-color-option';
    colorOption.dataset.color = normalizedColor;
    
    colorOption.innerHTML = `
        <div class="color-option selected" style="background-color: ${getColorValue(normalizedColor)}" title="${normalizedColor}">
            <span class="remove-color" onclick="removeLacesColorOption('${lacesId}', '${normalizedColor}')">&times;</span>
        </div>
    `;
    
    // Insert before the add button
    const addButton = container.querySelector('.add-color-btn');
    container.insertBefore(colorOption, addButton);
}

function removeLacesColorOption(lacesId, colorKey) {
    if (confirm(`Are you sure you want to remove the color "${colorKey}" from laces "${lacesId}"?`)) {
        const colorEl = document.querySelector(`#lacesColors_${lacesId} .laces-color-option[data-color="${colorKey}"]`);
        if (colorEl) {
            colorEl.remove();
        }
        
        // Show empty state if no colors left
        const container = document.getElementById(`lacesColors_${lacesId}`);
        const colorOptions = container.querySelectorAll('.laces-color-option');
        if (colorOptions.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state-small';
            emptyState.textContent = 'No colors added yet';
            const addButton = container.querySelector('.add-color-btn');
            container.insertBefore(emptyState, addButton);
        }
    }
}

function addInsoleOption() {
    const container = getElement('insolesContainer');
    const newId = prompt("Enter insole type name:");
    if (!newId) return;
    
    // Remove empty state if it exists
    const emptyState = container.querySelector('.empty-state-small');
    if (emptyState) {
        emptyState.remove();
    }
    
    const insoleEl = document.createElement('div');
    insoleEl.className = 'customization-item-edit';
    insoleEl.dataset.id = newId;
    
    insoleEl.innerHTML = `
        <div class="customization-item-header">
            <div class="customization-item-title">${newId}</div>
            <button type="button" class="btn btn-danger btn-small" onclick="removeInsoleOption('${newId}')">
                <i class="fas fa-trash"></i> Remove
            </button>
        </div>
        <div class="customization-item-fields">
            <div class="form-group">
                <label>Price (₱)</label>
                <input type="number" class="form-control" value="0" data-field="price" min="0">
            </div>
            <div class="form-group">
                <label>Additional Days</label>
                <input type="number" class="form-control" value="0" data-field="days" min="0">
            </div>
            <div class="form-group">
                <label>Image</label>
                <div class="upload-section">
                    <button type="button" class="btn btn-small btn-upload" onclick="uploadInsoleImage('${getElement('editModelForm').dataset.modelid}', '${newId}')">
                        <i class="fas fa-upload"></i> Upload Insole Image
                    </button>
                    <div class="upload-status missing">
                        <i class="fas fa-exclamation-triangle"></i> No image uploaded
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(insoleEl);
}

function removeInsoleOption(insoleId) {
    if (confirm(`Are you sure you want to remove the insole type "${insoleId}"? This will also delete the associated image from storage.`)) {
        const insoleEl = document.querySelector(`#insolesContainer .customization-item-edit[data-id="${insoleId}"]`);
        if (insoleEl) {
            insoleEl.remove();
        }
        
        // Add to deletion list
        if (!itemsToDelete.insoles.includes(insoleId)) {
            itemsToDelete.insoles.push(insoleId);
        }
        
        // Remove from pending uploads
        delete pendingInsoleUploads[insoleId];
        
        // Show empty state if no insoles left
        const container = getElement('insolesContainer');
        const insoleItems = container.querySelectorAll('.customization-item-edit');
        if (insoleItems.length === 0) {
            container.innerHTML = '<div class="empty-state-small">No insole types added yet</div>';
        }
    }
}

// Event listeners
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

    // Logout button
    getElement('logout_btn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            const result = await logoutUser();
            if (result.success) {
                window.location.href = "/login.html";
            } else {
                alert('Logout failed: ' + result.error);
            }
        }
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal();
        }
    });

    // Initialize inventory
    initializeInventory();
});