import { 
    checkUserAuth, 
    logoutUser, 
    createImageToFirebase, 
    createData,
    auth 
} from '../../firebaseMethods.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const orderID = urlParams.get('orderID');
const userID = urlParams.get('userID');
var userEmail = "";

// Initialize the page when auth state changes
auth.onAuthStateChanged((user) => {
    console.log('Auth state changed:', user);
    console.log('USER UID:', user?.uid);
    console.log('Order ID:', orderID);
    console.log('User ID:', userID);
    
    if (user && user.uid === userID) {
        loadUserProfile(user);
        initializePage();
    } else {
        // window.location.href = "/user_login.html";
    }
});

function loadUserProfile(user) {
    try {
        console.log('Loading user profile:', user.email);
        document.getElementById('userName_display2').textContent = user.displayName || 'User';
        const placeholderSVG = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23e0e0e0'/%3E%3Ctext x='50%' y='50%' font-family='Arial' font-size='16' fill='%23000' text-anchor='middle' dominant-baseline='middle'%3EUser%3C/text%3E%3C/svg%3E";
        document.getElementById('imageProfile').src = user.photoURL || placeholderSVG;
        document.getElementById('orderIdDisplay').textContent = orderID ? orderID.substring(0, 8).toUpperCase() : 'N/A';
        userEmail = user.email || '';
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

async function uploadFiles(files, userID, orderID) {
    try {
        const photoURLs = [];
        
        for (const file of files) {
            const storagePath = `issue_reports/${userID}/${orderID}/${Date.now()}_${file.name}`;
            const uploadResult = await createImageToFirebase(file, storagePath);
            
            if (uploadResult.success) {
                photoURLs.push({
                    url: uploadResult.url,
                    path: uploadResult.path,
                    filename: uploadResult.filename
                });
                console.log(`Successfully uploaded: ${file.name}`);
            } else {
                console.error('Error uploading file:', uploadResult.error);
                throw new Error(`Failed to upload ${file.name}: ${uploadResult.error}`);
            }
        }
        
        console.log(`Total files uploaded: ${photoURLs.length}`);
        return photoURLs;
    } catch (error) {
        console.error('Error in uploadFiles:', error);
        throw error;
    }
}

function initializePage() {
    // Handle photo upload preview - FIXED VERSION
    const issuePhotosInput = document.getElementById('issuePhotos');
    if (issuePhotosInput) {
        issuePhotosInput.addEventListener('change', function(e) {
            const preview = document.getElementById('photoPreview');
            if (!preview) {
                console.error('Photo preview element not found');
                return;
            }
            
            preview.innerHTML = '';
            
            if (this.files && this.files.length > 0) {
                console.log(`Selected ${this.files.length} file(s)`);
                
                Array.from(this.files).forEach(file => {
                    if (!file.type.startsWith('image/')) {
                        console.warn(`Skipping non-image file: ${file.name}`);
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const img = document.createElement('img');
                        img.src = e.target.result;
                        img.classList.add('preview-thumbnail');
                        img.style.width = '100px';
                        img.style.height = '100px';
                        img.style.objectFit = 'cover';
                        img.style.borderRadius = '6px';
                        img.style.margin = '5px';
                        img.style.border = '1px solid #ddd';
                        
                        console.log(`Added preview for: ${file.name}`);
                    };
                    
                    reader.onerror = (error) => {
                        console.error('Error reading file:', file.name, error);
                    };
                    
                    reader.readAsDataURL(file);
                });
            } else {
                console.log('No files selected');
            }
        });
    } else {
        console.error('Issue photos input element not found');
    }

    // Handle form submission - IMPROVED VERSION
    const form = document.getElementById('issueReportForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!orderID || !userID) {
                alert('Missing order or user information');
                return;
            }
            
            const issueType = document.getElementById('issueType')?.value;
            const description = document.getElementById('issueDescription')?.value;
            const files = document.getElementById('issuePhotos')?.files || [];
            
            console.log('Form submission data:', {
                issueType,
                descriptionLength: description?.length,
                fileCount: files.length
            });
            
            // Validate required fields
            if (!issueType || !description) {
                alert('Please fill in all required fields');
                return;
            }
            
            // Validate files
            if (files.length === 0) {
                alert('Please upload at least one photo of the issue');
                return;
            }

            try {
                // Show loading state
                const submitBtn = form.querySelector('button[type="submit"]');
                const originalBtnText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
                
                console.log('Starting file upload...');
                
                // Upload photos
                let photoURLs = [];
                if (files.length > 0) {
                    photoURLs = await uploadFiles(Array.from(files), userID, orderID);
                }
                
                console.log('Files uploaded successfully:', photoURLs.length);
                
                // Create report in database
                const reportData = {
                    orderID: orderID,
                    customerEmail: userEmail,
                    userID: userID,
                    issueType: issueType,
                    description: description,
                    photoURLs: photoURLs, // This will contain all uploaded images
                    status: 'pending',
                    timestamp: new Date().toISOString(),
                    resolved: false,
                    lastUpdated: new Date().toISOString()
                };
                
                console.log('Creating database record...', reportData);
                
                const dataPath = `smartfit_AR_Database/issueReports/${orderID}`;
                const createResult = await createData(dataPath, userID, reportData);
                
                if (createResult.success) {
                    console.log('Issue report created successfully');
                    alert('Issue report submitted successfully! Our team will review it shortly.');
                    window.location.href = `/customer/html/orders.html`;
                } else {
                    throw new Error(createResult.error || 'Failed to create database record');
                }
                
            } catch (error) {
                console.error('Error submitting report:', error);
                alert('Failed to submit report. Please try again. Error: ' + error.message);
            } finally {
                // Reset button state
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';
                }
            }
        });
    } else {
        console.error('Issue report form not found');
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to logout?')) {
                logoutUser().then(result => {
                    if (result.success) {
                        window.location.href = '/user_login.html';
                    } else {
                        console.error('Error signing out:', result.error);
                        alert('Logout failed. Please try again.');
                    }
                });
            }
        });
    } else {
        console.error('Logout button not found');
    }
}

// Initialize sample data function
function initializeSampleData() {
    console.log('Page initialized with orderID:', orderID, 'userID:', userID);
}

// Make initializeSampleData available globally if needed
window.initializeSampleData = initializeSampleData;

// Add some debug logging
console.log('reportIssue.js loaded successfully');
console.log('Order ID from URL:', orderID);
console.log('User ID from URL:', userID);