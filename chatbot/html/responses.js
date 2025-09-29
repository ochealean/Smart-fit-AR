// chatbot_manager.js - Refactored to use firebaseMethods only
import {
    checkUserAuth,
    logoutUser,
    createData,
    readData,
    updateData,
    deleteData,
    readDataRealtime,
    generate18CharID
} from "../../firebaseMethods.js";

// DOM Elements
const notification = document.getElementById('notification');
const confirmationDialog = document.getElementById('confirmationDialog');
const overlay = document.getElementById('overlay');
const responseModal = document.getElementById('responseModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.querySelector('.modal-body');
let currentEditId = null;
let deleteCallback = null;

// Initialize the chatbot manager
async function initChatbotManager() {
    const user = await checkUserAuth();

    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    // Check if user is admin
    if (user.role !== 'admin') {
        alert('Access denied. Admin privileges required.');
        window.location.href = "/dashboard.html";
        return;
    }

    console.log('Admin user authenticated for chatbot management');
    setupEventListeners();
    loadResponsesFromFirebase();
    window.openEditLastQuestion = openEditLastQuestion; // Make it globally available
}

// Set up event listeners
function setupEventListeners() {
    document.querySelector('.menu-btn')?.addEventListener('click', () => {
        document.querySelector('.nav-links').classList.toggle('active');
    });

    document.getElementById('openResponseModal')?.addEventListener('click', () => {
        currentEditId = null;
        modalTitle.textContent = 'Add New Response';
        resetModal();
        openModal();
    });

    document.querySelector('.close-modal')?.addEventListener('click', closeModal);
    document.getElementById('cancelModal')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    document.getElementById('clearResponses')?.addEventListener('click', resetTextarea);
    document.getElementById('saveModalResponse')?.addEventListener('click', saveResponseToFirebase);
    document.getElementById('confirmAction')?.addEventListener('click', handleConfirmDelete);
    document.getElementById('cancelAction')?.addEventListener('click', closeConfirmationDialog);

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to logout?')) {
                const result = await logoutUser();
                if (result.success) {
                    window.location.href = '/login.html';
                } else {
                    alert('Logout failed: ' + result.error);
                }
            }
        });
    }
}

// Load responses from Firebase using readDataRealtime
function loadResponsesFromFirebase() {
    const responsesPath = 'smartfit_AR_Database/chatbot/responses';
    
    const unsubscribe = readDataRealtime(responsesPath, (result) => {
        if (result.success) {
            const responses = result.data || {};
            renderChatbotTable(responses);
        } else {
            // this will error if theres nothing in database
            console.error('Error loading responses:', result.error);
            showNotification('No Data, please Add Response', 'error');
        }
    });

    // Return unsubscribe function for cleanup if needed
    return unsubscribe;
}

// Save response to Firebase using createData or updateData
async function saveResponseToFirebase() {
    const saveBtn = document.getElementById('saveModalResponse');
    saveBtn.disabled = true;
    
    const category = document.getElementById('modalCategory').value;
    const keyword = document.getElementById('modalKeyword').value.trim();
    const responsesText = document.getElementById('responseTextarea').value.trim();
    const responsesArray = responsesText.split('\n').filter(Boolean);

    if (!keyword || responsesArray.length === 0) {
        showNotification('Please fill in all fields and at least one response', 'error');
        saveBtn.disabled = false;
        return;
    }

    const responseData = {
        category,
        keyword,
        responses: responsesArray,
        popularity: 0,
        lastQuestionSentence: "",
        dateAdded: new Date().toISOString()
    };

    try {
        if (currentEditId) {
            // Update existing response using updateData
            const updatePath = `smartfit_AR_Database/chatbot/responses/${currentEditId}`;
            
            // First get existing data to preserve popularity and lastQuestionSentence
            const existingResult = await readData(updatePath);
            if (existingResult.success && existingResult.data) {
                responseData.popularity = existingResult.data.popularity || 0;
                responseData.lastQuestionSentence = existingResult.data.lastQuestionSentence || "";
            }
            
            const result = await updateData(updatePath, responseData);
            
            if (result.success) {
                showNotification('Response updated successfully', 'success');
                closeModal();
            } else {
                throw new Error(result.error);
            }
        } else {
            // Add new response using createData
            const responseId = generate18CharID();
            const createPath = `smartfit_AR_Database/chatbot/responses/${responseId}`;
            
            const result = await createData(createPath, 'admin', {
                ...responseData,
                id: responseId
            });
            
            if (result.success) {
                showNotification('Response added successfully', 'success');
                closeModal();
            } else {
                throw new Error(result.error);
            }
        }
    } catch (error) {
        console.error('Error saving response:', error);
        showNotification('Error saving response: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
    }
}

// Open modal for editing last question using readData
async function openEditLastQuestion(id) {
    try {
        const responsePath = `smartfit_AR_Database/chatbot/responses/${id}`;
        const result = await readData(responsePath);
        
        if (result.success && result.data) {
            const response = result.data;
            currentEditId = id;
            modalTitle.textContent = 'Edit Last Question';
            
            // Hide all regular form fields including category
            document.getElementById('modalCategory').style.display = 'none';
            document.getElementById('modalKeyword').style.display = 'none';
            document.getElementById('responseTextarea').style.display = 'none';
            document.getElementById('clearResponses').style.display = 'none';
            
            // Create and show the last question edit field
            const lastQuestionForm = document.createElement('div');
            lastQuestionForm.id = 'lastQuestionForm';
            lastQuestionForm.innerHTML = `
                <div class="response-form-group">
                    <label for="editLastQuestion">Last Question:</label>
                    <input type="text" id="editLastQuestion" class="response-input" 
                           value="${response.lastQuestionSentence || ''}">
                </div>
            `;
            
            // Insert the form before the modal actions
            modalBody.insertBefore(lastQuestionForm, document.querySelector('.modal-actions'));
            
            // Change the save button behavior
            const saveBtn = document.getElementById('saveModalResponse');
            saveBtn.textContent = 'Save Question';
            saveBtn.onclick = () => saveLastQuestion(id);

            openModal();
        } else {
            throw new Error(result.error || 'Response not found');
        }
    } catch (error) {
        console.error('Error loading response:', error);
        showNotification('Error loading response: ' + error.message, 'error');
    }
}

// Save last question to Firebase using updateData
async function saveLastQuestion(id) {
    const lastQuestionInput = document.getElementById('editLastQuestion');
    const lastQuestion = lastQuestionInput.value.trim();
    
    if (!lastQuestion) {
        showNotification('Please enter a question', 'error');
        return;
    }

    try {
        const responsePath = `smartfit_AR_Database/chatbot/responses/${id}`;
        
        // First get the existing data
        const existingResult = await readData(responsePath);
        
        if (existingResult.success && existingResult.data) {
            const existingData = existingResult.data;
            
            // Update only the lastQuestionSentence, preserving other fields
            const updateDataPayload = {
                lastQuestionSentence: lastQuestion,
                keyword: existingData.keyword,
                responses: existingData.responses,
                popularity: existingData.popularity || 0,
                category: existingData.category || 'feature'
            };
            
            const result = await updateData(responsePath, updateDataPayload);
            
            if (result.success) {
                showNotification('Last question updated successfully', 'success');
                closeModal();
            } else {
                throw new Error(result.error);
            }
        } else {
            throw new Error('Response data not found');
        }
    } catch (error) {
        console.error('Error updating last question:', error);
        showNotification('Error updating last question: ' + error.message, 'error');
    }
}

// Render chatbot table with responses
function renderChatbotTable(responses) {
    const tbody = document.getElementById('chatbotTableBody');
    if (!tbody) return;
    
    // Clear existing rows to prevent duplication
    tbody.innerHTML = '';

    if (!responses || Object.keys(responses).length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--gray-dark)">No responses added yet</td></tr>`;
        return;
    }

    // Render fresh rows
    tbody.innerHTML = Object.entries(responses).map(([id, response]) => `
        <tr>
            <td>${id}</td>
            <td>${response.category || 'feature'}</td>
            <td>${response.keyword}</td>
            <td class="responseTD">${Array.isArray(response.responses) ? response.responses.join('<br>') : response.responses}</td>
            <td>${response.popularity || 0}</td>
            <td class="last-question">
                <div class="last-question-content">
                    ${response.lastQuestionSentence || "Never used"}
                </div>
                <button class="edit-question-btn" onclick="openEditLastQuestion('${id}')">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
            <td>
                <div class="response-actions">
                    <button class="edit-btn" onclick="openEditResponse('${id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-btn" onclick="confirmDelete('${id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Open modal for editing a response using readData
async function openEditResponse(id) {
    try {
        const responsePath = `smartfit_AR_Database/chatbot/responses/${id}`;
        const result = await readData(responsePath);
        
        if (result.success && result.data) {
            const response = result.data;
            
            // Reset modal to default state
            resetModal();
            
            currentEditId = id;
            modalTitle.textContent = 'Edit Response';
            
            // Set the category if it exists, otherwise default to 'feature'
            document.getElementById('modalCategory').value = response.category || 'feature';
            document.getElementById('modalKeyword').value = response.keyword;
            document.getElementById('responseTextarea').value = Array.isArray(response.responses) ? 
                response.responses.join('\n') : response.responses;
            openModal();
        } else {
            throw new Error(result.error || 'Response not found');
        }
    } catch (error) {
        console.error('Error loading response:', error);
        showNotification('Error loading response: ' + error.message, 'error');
    }
}

// Confirm deletion of a response using deleteData
function confirmDelete(id) {
    showConfirmationDialog('Delete this response?', async () => {
        try {
            const deletePath = `smartfit_AR_Database/chatbot/responses/${id}`;
            const result = await deleteData(deletePath);
            
            if (result.success) {
                showNotification('Response deleted successfully', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error deleting response:', error);
            showNotification('Error deleting response: ' + error.message, 'error');
        }
    });
}

// Modal functions
function openModal() {
    responseModal.classList.add('active');
    overlay.classList.add('show');
}

function closeModal() {
    // Reset modal to its original state
    document.getElementById('modalCategory').style.display = 'block'; // Show category again
    document.getElementById('modalKeyword').style.display = 'block';
    document.getElementById('responseTextarea').style.display = 'block';
    document.getElementById('clearResponses').style.display = 'block';
    
    const lastQuestionForm = document.getElementById('lastQuestionForm');
    if (lastQuestionForm) {
        lastQuestionForm.remove();
    }
    
    // Reset save button behavior
    const saveBtn = document.getElementById('saveModalResponse');
    saveBtn.textContent = 'Save Response';
    saveBtn.onclick = saveResponseToFirebase;
    
    responseModal.classList.remove('active');
    overlay.classList.remove('show');
}

function resetTextarea() {
    document.getElementById('responseTextarea').value = '';
}

function resetModal() {
    document.getElementById('modalCategory').value = 'feature';
    document.getElementById('modalKeyword').value = '';
    document.getElementById('responseTextarea').value = '';
    currentEditId = null;
}

// Confirmation dialog functions
function handleConfirmDelete() {
    deleteCallback?.();
    closeConfirmationDialog();
}

function showConfirmationDialog(message, callback) {
    document.getElementById('dialogMessage').textContent = message;
    confirmationDialog.classList.add('show');
    overlay.classList.add('show');
    deleteCallback = callback;
}

function closeConfirmationDialog() {
    confirmationDialog.classList.remove('show');
    overlay.classList.remove('show');
    deleteCallback = null;
}

// Notification function
function showNotification(message, type = 'success') {
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// Make functions globally accessible
window.openEditResponse = openEditResponse;
window.confirmDelete = confirmDelete;
window.closeModal = closeModal;

// Initialize chatbot manager when DOM is ready
document.addEventListener('DOMContentLoaded', initChatbotManager);