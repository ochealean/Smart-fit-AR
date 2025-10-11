import { 
    checkUserAuth, 
    logoutUser, 
    createImageToFirebase, 
    readDataRealtime
} from '../../firebaseMethods.js';

// Global variables
let shopLoggedin = null;
let currentUser = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeAppFunctionality();
    setupAuthStateListener();
});

function initializeAppFunctionality() {
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

    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show active tab content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            
            // Load validation history if that tab is selected
            if (tabId === 'validation-history') {
                loadValidationHistory();
            }
        });
    });
    
    // Image upload functionality
    const imageUploads = [
        { container: 'frontViewUpload', input: 'frontView', preview: 'frontViewPreview' },
        { container: 'backViewUpload', input: 'backView', preview: 'backViewPreview' },
        { container: 'topViewUpload', input: 'topView', preview: 'topViewPreview' }
    ];
    
    imageUploads.forEach(item => {
        const container = document.getElementById(item.container);
        const input = document.getElementById(item.input);
        const preview = document.getElementById(item.preview);
        const removeBtn = container.querySelector('.remove-image');
        
        container.addEventListener('click', () => {
            input.click();
        });
        
        input.addEventListener('change', () => {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                    removeBtn.style.display = 'flex';
                    container.querySelector('i').style.display = 'none';
                    container.querySelector('p').style.display = 'none';
                }
                
                reader.readAsDataURL(input.files[0]);
            }
        });
        
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            input.value = '';
            preview.style.display = 'none';
            removeBtn.style.display = 'none';
            container.querySelector('i').style.display = 'block';
            container.querySelector('p').style.display = 'block';
        });
    });
    
    // Form submission
    const validationForm = document.getElementById('shoeValidationForm');
    if (validationForm) {
        validationForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitShoeForValidation();
        });
    }
    
    // Modal functionality
    const modal = document.getElementById('validationModal');
    const closeModal = document.querySelector('.modal-close');
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // Logout functionality
    const logoutBtn = document.getElementById('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to logout?')) {
                logoutUser().then((result) => {
                    if (result.success) {
                        window.location.href = '/login.html';
                    } else {
                        console.error('Logout error:', result.error);
                    }
                });
            }
        });
    }
}

function setupAuthStateListener() {
    // Use checkUserAuth from firebaseMethods
    checkUserAuth().then((authResult) => {
        if (authResult.authenticated) {
            currentUser = { uid: authResult.userId };
            shopLoggedin = authResult.shopId;
            
            // Update profile header
            updateProfileHeader(authResult.userData);
            
            // Role-based UI adjustments
            if (authResult.role === 'employee' && authResult.userData.role) {
                const userRole = authResult.userData.role.toLowerCase();
                if (userRole === "manager") {
                    document.getElementById("addemployeebtn").style.display = "none";
                } else if (userRole === "salesperson") {
                    document.getElementById("addemployeebtn").style.display = "none";
                    document.getElementById("analyticsbtn").style.display = "none";
                }
            }
        } else {
            window.location.href = "/login.html";
        }
    }).catch((error) => {
        console.error('Auth check error:', error);
        window.location.href = "/login.html";
    });
}

// Function to update profile header
function updateProfileHeader(userData) {
    const profilePicture = document.getElementById('profilePicture');
    const userFullname = document.getElementById('userFullname');
    
    if (!profilePicture || !userFullname) return;
    
    // Set profile name
    if (userData.name) {
        userFullname.textContent = userData.name;
    } else if (userData.shopName) {
        userFullname.textContent = userData.shopName;
    } else if (userData.ownerName) {
        userFullname.textContent = userData.ownerName;
    }
    
    // Set profile picture
    if (userData.profilePhoto && userData.profilePhoto.url) {
        profilePicture.src = userData.profilePhoto.url;
    } else if (userData.uploads && userData.uploads.shopLogo && userData.uploads.shopLogo.url) {
        profilePicture.src = userData.uploads.shopLogo.url;
    } else {
        // Set default avatar if no image available
        profilePicture.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23ddd'%3E%3Crect width='100' height='100'/%3E%3Ctext x='50%' y='50%' font-size='20' text-anchor='middle' dominant-baseline='middle' fill='%23666'%3EProfile%3C/text%3E%3C/svg%3E";
    }
}

async function submitShoeForValidation() {
    // Basic validation
    const serialNumber = document.getElementById('serialNumber').value;
    const shoeModel = document.getElementById('shoeModel').value;
    const description = document.getElementById('description').value;
    const frontView = document.getElementById('frontView').files[0];
    const backView = document.getElementById('backView').files[0];
    const topView = document.getElementById('topView').files[0];
    
    if (!serialNumber || !shoeModel || !description) {
        alert('Please fill in all required fields.');
        return;
    }
    
    if (!frontView || !backView || !topView) {
        alert('Please upload all three required images.');
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('#shoeValidationForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;
    
    try {
        // Upload images to Firebase Storage using firebaseMethods
        const frontViewResult = await createImageToFirebase(frontView, `shoeValidation/${currentUser.uid}/${serialNumber}_front`);
        const backViewResult = await createImageToFirebase(backView, `shoeValidation/${currentUser.uid}/${serialNumber}_back`);
        const topViewResult = await createImageToFirebase(topView, `shoeValidation/${currentUser.uid}/${serialNumber}_top`);
        
        if (!frontViewResult.success || !backViewResult.success || !topViewResult.success) {
            throw new Error('Failed to upload images');
        }
        
        // Prepare validation data
        const validationData = {
            serialNumber,
            shoeModel,
            description,
            images: {
                front: frontViewResult.url,
                back: backViewResult.url,
                top: topViewResult.url
            },
            status: "pending",
            submittedBy: currentUser.uid,
            shopId: shopLoggedin,
            submittedDate: new Date().toISOString(),
            validatedDate: null,
            validatorId: null,
            validationNotes: ""
        };
        
        // Save to Firebase Realtime Database using firebaseMethods
        const validationPath = 'smartfit_AR_Database/shoeVerification';
        const createResult = await createData(validationPath, shopLoggedin, validationData);
        
        if (!createResult.success) {
            throw new Error(createResult.error);
        }
        
        // Show success message
        alert('Shoe submitted successfully for validation! You will be notified once it has been reviewed.');
        
        // Reset form
        document.getElementById('shoeValidationForm').reset();
        
        // Reset image previews
        const imageUploads = [
            { container: 'frontViewUpload', preview: 'frontViewPreview' },
            { container: 'backViewUpload', preview: 'backViewPreview' },
            { container: 'topViewUpload', preview: 'topViewPreview' }
        ];
        
        imageUploads.forEach(item => {
            const preview = document.getElementById(item.preview);
            const removeBtn = document.getElementById(item.container).querySelector('.remove-image');
            const container = document.getElementById(item.container);
            
            preview.style.display = 'none';
            removeBtn.style.display = 'none';
            container.querySelector('i').style.display = 'block';
            container.querySelector('p').style.display = 'block';
        });
        
    } catch (error) {
        console.error("Error submitting validation:", error);
        alert('Error submitting shoe for validation: ' + error.message);
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function loadValidationHistory() {
    const validationPath = 'smartfit_AR_Database/shoeVerification';
    
    // Use readDataRealtime from firebaseMethods
    const unsubscribe = readDataRealtime(validationPath, (result) => {
        if (!result.success) {
            console.error('Error loading validation history:', result.error);
            const tableBody = document.querySelector('.validation-table tbody');
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Error loading data</td></tr>';
            return;
        }
        
        const validationData = result.data;
        const tableBody = document.querySelector('.validation-table tbody');
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        if (validationData) {
            // Convert object to array and filter by current user's shop
            const validationsArray = Object.entries(validationData)
                .filter(([key, value]) => value.shopId === shopLoggedin)
                .map(([key, value]) => ({ id: key, ...value }));
            
            if (validationsArray.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No validation history found</td></tr>';
                return;
            }
            
            // Sort by submission date (newest first)
            validationsArray.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
            
            // Add rows to table
            validationsArray.forEach(validation => {
                const row = document.createElement('tr');
                
                // Format date for display
                const submittedDate = new Date(validation.submittedDate);
                const formattedDate = submittedDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                // Determine status class and text based on your existing CSS
                let statusClass = 'status-pending';
                let statusText = 'Pending';
                
                if (validation.status === 'verified') {
                    statusClass = 'status-legit';
                    statusText = 'Verified';
                } else if (validation.status === 'invalid') {
                    statusClass = 'status-fake';
                    statusText = 'Invalid';
                }
                
                row.innerHTML = `
                    <td>${validation.serialNumber}</td>
                    <td>${validation.shoeModel}</td>
                    <td>${formattedDate}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td><button class="action-btn view-details" data-id="${validation.id}">View Details</button></td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Add event listeners to view buttons
            document.querySelectorAll('.view-details').forEach(button => {
                button.addEventListener('click', (e) => {
                    const validationId = e.target.getAttribute('data-id');
                    showValidationDetails(validationId);
                });
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No validation history found</td></tr>';
        }
    });
}

function showValidationDetails(validationId) {
    const validationPath = `smartfit_AR_Database/shoeVerification/${validationId}`;
    
    // Use readDataRealtime from firebaseMethods
    const unsubscribe = readDataRealtime(validationPath, (result) => {
        if (!result.success) {
            console.error('Error loading validation details:', result.error);
            return;
        }
        
        const data = result.data;
        
        if (data) {
            // Populate modal with data
            document.getElementById('modal-serial').textContent = data.serialNumber;
            document.getElementById('modal-model').textContent = data.shoeModel;
            document.getElementById('modal-description').textContent = data.description;
            
            // Determine status class and text based on your existing CSS
            let statusClass = 'status-pending';
            let statusText = 'Pending';
            
            if (data.status === 'verified') {
                statusClass = 'status-legit';
                statusText = 'Verified';
            } else if (data.status === 'invalid') {
                statusClass = 'status-fake';
                statusText = 'Invalid';
            }
            
            document.getElementById('modal-status').innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;
            
            // Set validation notes or default message
            const reasonText = data.validationNotes || 
                (data.status === 'pending' 
                    ? 'This submission is currently under review by our authentication team. Typically takes 24-48 hours to complete.'
                    : 'No validation notes provided.');
                    
            document.getElementById('modal-reason-text').textContent = reasonText;
            
            // Set images
            document.getElementById('modal-front').src = data.images.front;
            document.getElementById('modal-back').src = data.images.back;
            document.getElementById('modal-top').src = data.images.top;
            
            // Show the modal
            document.getElementById('validationModal').classList.add('active');
        }
    });
}

// Note: The createData function is used but not imported above since it's not exported in firebaseMethods
// You'll need to add it to the import statement if it exists in firebaseMethods
// For now, I'll create a simple version for this specific use case
async function createData(dataPath, shopId, productData) {
    try {
        // Simple implementation using Firebase SDK directly since it's not in firebaseMethods
        // In a real scenario, this should be added to firebaseMethods.js
        const { getDatabase, ref, set, push } = await import("https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js");
        const db = getDatabase();
        
        const dataRef = ref(db, dataPath);
        const newDataRef = push(dataRef);
        
        await set(newDataRef, productData);
        
        return { success: true, dataId: newDataRef.key, message: "Data created successfully" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}