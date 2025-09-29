// censored_words_manager.js - Refactored to use firebaseMethods only
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
const wordModal = document.getElementById('wordModal');
const modalTitle = document.getElementById('modalTitle');
let currentEditId = null;
let deleteCallback = null;

// Initialize the censored words manager
async function initCensoredWordsManager() {
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

    console.log('Admin user authenticated for censored words management');
    setupEventListeners();
    loadWordsFromFirebase();
}

// Set up event listeners
function setupEventListeners() {
    document.querySelector('.menu-btn')?.addEventListener('click', () => {
        document.querySelector('.nav-links').classList.toggle('active');
    });

    document.getElementById('openWordModal')?.addEventListener('click', () => {
        currentEditId = null;
        modalTitle.textContent = 'Add New Censored Word';
        resetModal();
        openModal();
    });

    document.querySelector('.close-modal')?.addEventListener('click', closeModal);
    document.getElementById('cancelModal')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    document.getElementById('saveWord')?.addEventListener('click', saveWordToFirebase);
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

// Load words from Firebase using readDataRealtime
function loadWordsFromFirebase() {
    const wordsPath = 'smartfit_AR_Database/curseWords';
    
    const unsubscribe = readDataRealtime(wordsPath, (result) => {
        if (result.success) {
            const words = result.data || {};
            renderWordsTable(words);
        } else {
            console.error('Error loading words:', result.error);
            showNotification('No data in database', 'error');
        }
    });

    // Return unsubscribe function for cleanup if needed
    return unsubscribe;
}

// Save word to Firebase using createData or updateData
async function saveWordToFirebase() {
    const saveBtn = document.getElementById('saveWord');
    saveBtn.disabled = true;
    
    const word = document.getElementById('wordInput').value.trim();
    const severity = document.getElementById('severitySelect').value;

    if (!word) {
        showNotification('Please enter a word to censor', 'error');
        saveBtn.disabled = false;
        return;
    }

    const wordData = {
        word,
        severity,
        dateAdded: new Date().toISOString()
    };

    try {
        if (currentEditId) {
            // Update existing word using updateData
            const updatePath = `smartfit_AR_Database/curseWords/${currentEditId}`;
            const result = await updateData(updatePath, wordData);
            
            if (result.success) {
                showNotification('Word updated successfully', 'success');
                closeModal();
            } else {
                throw new Error(result.error);
            }
        } else {
            // Add new word using createData
            const wordId = generate18CharID();
            const createPath = `smartfit_AR_Database/curseWords/${wordId}`;
            
            // Use createData which handles the ID generation and data structure
            const result = await createData(createPath, 'admin', {
                ...wordData,
                id: wordId
            });
            
            if (result.success) {
                showNotification('Word added successfully', 'success');
                closeModal();
            } else {
                throw new Error(result.error);
            }
        }
    } catch (error) {
        console.error('Error saving word:', error);
        showNotification('Error saving word: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
    }
}

// Render words table
function renderWordsTable(words) {
    const tbody = document.getElementById('wordsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!words || Object.keys(words).length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--gray-dark)">No censored words added yet</td></tr>`;
        return;
    }

    tbody.innerHTML = Object.entries(words).map(([id, wordData]) => {
        // Format date
        let dateAdded = 'Unknown';
        if (wordData.dateAdded) {
            const date = new Date(wordData.dateAdded);
            if (!isNaN(date.getTime())) {
                dateAdded = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
        }

        return `
            <tr>
                <td>${id}</td>
                <td>${wordData.word}</td>
                <td>
                    <span class="severity-badge ${wordData.severity}">
                        ${wordData.severity.charAt(0).toUpperCase() + wordData.severity.slice(1)}
                    </span>
                </td>
                <td>${dateAdded}</td>
                <td>
                    <div class="word-actions">
                        <button class="edit-btn" onclick="openEditWord('${id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="delete-btn" onclick="confirmDelete('${id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Open modal for editing a word using readData
async function openEditWord(id) {
    try {
        const wordPath = `smartfit_AR_Database/curseWords/${id}`;
        const result = await readData(wordPath);
        
        if (result.success && result.data) {
            const wordData = result.data;
            currentEditId = id;
            modalTitle.textContent = 'Edit Censored Word';
            
            document.getElementById('wordInput').value = wordData.word;
            document.getElementById('severitySelect').value = wordData.severity || 'low';
            
            openModal();
        } else {
            throw new Error(result.error || 'Word not found');
        }
    } catch (error) {
        console.error('Error loading word:', error);
        showNotification('Error loading word: ' + error.message, 'error');
    }
}

// Confirm deletion of a word using deleteData
function confirmDelete(id) {
    showConfirmationDialog('Delete this censored word?', async () => {
        try {
            const deletePath = `smartfit_AR_Database/curseWords/${id}`;
            const result = await deleteData(deletePath);
            
            if (result.success) {
                showNotification('Word deleted successfully', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error deleting word:', error);
            showNotification('Error deleting word: ' + error.message, 'error');
        }
    });
}

// Modal functions
function openModal() {
    wordModal.classList.add('active');
    overlay.classList.add('show');
}

function closeModal() {
    wordModal.classList.remove('active');
    overlay.classList.remove('show');
    resetModal();
}

function resetModal() {
    document.getElementById('wordInput').value = '';
    document.getElementById('severitySelect').value = 'low';
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
window.openEditWord = openEditWord;
window.confirmDelete = confirmDelete;
window.closeModal = closeModal;

// Initialize censored words manager when DOM is ready
document.addEventListener('DOMContentLoaded', initCensoredWordsManager);