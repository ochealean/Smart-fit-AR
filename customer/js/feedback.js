import {
    checkUserAuth,
    logoutUser,
    readData,
    updateData,
    readDataRealtime,
    addFile,
    deleteFile
} from "../../firebaseMethods.js";

let cursedWords = [];
let currentShopId = null;
let currentShopName = null;
let selectedPhotos = [];
let selectedVideo = null;
let existingMediaData = null; // Track existing media for editing

// Media configuration
const MEDIA_CONFIG = {
    maxPhotos: 3,
    maxVideoSize: 50 * 1024 * 1024, // 50MB in bytes
    allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'],
    allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mpeg']
};

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // First load the censored words
        await loadCensoredWords();
        
        // Initialize media upload functionality
        initializeMediaUpload();

        const stars = document.querySelectorAll('#starRating .star');
        const ratingValue = document.getElementById('ratingValue');
        const feedbackForm = document.getElementById('feedbackForm');
        const submitBtn = document.getElementById('submitBtn');
        const loader = document.getElementById('loader');
        const successMessage = document.getElementById('successMessage');
        const existingFeedbackSection = document.getElementById('existingFeedback');
        const existingStarRating = document.getElementById('existingStarRating');
        const existingStars = existingStarRating.querySelectorAll('.fa-star');
        const existingComment = document.getElementById('existingComment');
        const editReviewBtn = document.getElementById('editReviewBtn');
        const shopNameLink = document.getElementById('shopNameLink');
        const existingMediaSection = document.getElementById('existingMediaSection');
        const existingMediaPreview = document.getElementById('existingMediaPreview');

        const urlParams = new URLSearchParams(window.location.search);
        const orderID = urlParams.get("orderId");
        const userID = urlParams.get("userId");

        if (!orderID || !userID) {
            alert("Missing order or user information");
            window.location.href = "/";
            return;
        }

        // Check user authentication
        const user = await checkUserAuth();
        if (!user.authenticated) {
            alert("Please log in to provide feedback");
            window.location.href = "/login.html";
            return;
        }

        // Set user information
        const userNameElement = document.getElementById('userName_display2');
        const userImageElement = document.getElementById('imageProfile');
        
        userNameElement.textContent = user.userData?.firstName ? 
            `${user.userData.firstName} ${user.userData.lastName}` : "Guest User";
            
        if (user.userData?.profilePhoto?.url) {
            userImageElement.src = user.userData.profilePhoto.url;
        } else {
            userImageElement.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
        }

        // Load order data
        const orderPath = `smartfit_AR_Database/transactions/${userID}/${orderID}`;
        const orderResult = await readData(orderPath);

        if (!orderResult.success) {
            alert("Order not found.");
            return;
        }

        const orderData = orderResult.data;

        // Fill shoe details
        const items = orderData.order_items ? 
            Object.values(orderData.order_items) : 
            (orderData.item ? [orderData.item] : []);

        if (items.length === 0) {
            alert("No items found in this order.");
            return;
        }

        const firstItem = items[0];
        document.getElementById('shoeImage').src = firstItem.imageUrl || "https://via.placeholder.com/150";
        document.getElementById('shoeName').textContent = firstItem.name || "Unknown Shoe";
        document.getElementById('shoeId').textContent = `Product ID: ${firstItem.shoeId || 'N/A'}`;
        
        // Set shop information and make it clickable
        currentShopId = firstItem.shopId;
        currentShopName = firstItem.shopName || 'Unknown Shop';
        shopNameLink.textContent = currentShopName;
        
        // Add shop redirect functionality
        if (currentShopId) {
            shopNameLink.setAttribute('data-shop-id', currentShopId);
            shopNameLink.setAttribute('data-shop-name', currentShopName);
            setupShopNameClickEvents();
        }

        // Check for existing feedback
        const feedbackPath = `smartfit_AR_Database/feedbacks/${userID}/${orderID}`;
        const feedbackResult = await readData(feedbackPath);

        const existingFeedback = orderData.feedback || (feedbackResult.success ? feedbackResult.data : null);

        // Function to update rating display
        const updateRatingDisplay = (stars, rating) => {
            stars.forEach((star, index) => {
                if (index < rating) {
                    star.classList.add('active');
                    star.style.color = 'var(--star-color)';
                } else {
                    star.classList.remove('active');
                    star.style.color = '#ccc';
                }
            });
        };

        // Function to make stars interactive
        const makeStarsInteractive = (stars, ratingVar, isExisting = false) => {
            stars.forEach((star, index) => {
                star.style.cursor = 'pointer';

                star.addEventListener('click', (e) => {
                    if (isExisting) {
                        e.stopPropagation();
                        const newRating = index + 1;
                        updateRatingDisplay(stars, newRating);
                        saveUpdatedFeedback(newRating, existingComment.textContent);
                    } else {
                        ratingVar = index + 1;
                        ratingValue.value = ratingVar;
                        updateRatingDisplay(stars, ratingVar);
                    }
                });

                star.addEventListener('mouseover', () => {
                    if (!isExisting) {
                        stars.forEach((s, i) => {
                            s.style.color = i <= index ? 'var(--star-color)' : '#ccc';
                        });
                    }
                });

                star.addEventListener('mouseout', () => {
                    if (!isExisting) {
                        updateRatingDisplay(stars, ratingVar);
                    }
                });
            });
        };

        // Function to save updated feedback
        async function saveUpdatedFeedback(rating, comment) {
            try {
                const feedbackData = {
                    orderID,
                    shoeID: firstItem.shoeId,
                    rating,
                    comment: censorText(comment),
                    timestamp: Date.now()
                };

                const feedbackPath = `smartfit_AR_Database/feedbacks/${userID}/${orderID}`;
                const transactionFeedbackPath = `smartfit_AR_Database/transactions/${userID}/${orderID}/feedback`;

                // Update both feedback locations
                const feedbackResult = await updateData(feedbackPath, feedbackData);
                const transactionResult = await updateData(transactionFeedbackPath, feedbackData);

                if (feedbackResult.success && transactionResult.success) {
                    successMessage.style.display = 'block';
                    successMessage.textContent = "Rating updated successfully!";
                    setTimeout(() => {
                        successMessage.style.display = 'none';
                    }, 2000);
                } else {
                    throw new Error("Failed to update feedback");
                }

            } catch (error) {
                console.error("Error updating feedback:", error);
                alert("Failed to update rating. Please try again.");
            }
        }

        if (existingFeedback) {
            // Existing feedback handling
            let currentRating = existingFeedback.rating || 0;
            let currentComment = existingFeedback.comment || 'No comment provided';
            existingMediaData = existingFeedback.media || null;

            existingFeedbackSection.style.display = 'block';
            feedbackForm.style.display = 'none';

            updateRatingDisplay(existingStars, currentRating);
            existingComment.textContent = currentComment;

            // Display existing media if any
            if (existingMediaData && (existingMediaData.photos || existingMediaData.video)) {
                existingMediaSection.style.display = 'block';
                displayExistingMedia(existingMediaData, existingMediaPreview);
            }

            // Make existing stars interactive for real-time editing
            makeStarsInteractive(existingStars, currentRating, true);

            // Set up edit button - FIXED: No refresh needed
            editReviewBtn.onclick = () => {
                existingFeedbackSection.style.display = 'none';
                feedbackForm.style.display = 'block';

                // Pre-fill the form with existing data
                ratingValue.value = currentRating;
                document.getElementById('comment').value = currentComment;
                updateRatingDisplay(stars, currentRating);

                // Pre-fill existing media if any
                if (existingMediaData) {
                    // Convert existing media to the format expected by the upload system
                    selectedPhotos = existingMediaData.photos ? [...existingMediaData.photos] : [];
                    selectedVideo = existingMediaData.video ? {...existingMediaData.video} : null;
                    
                    // Display existing media in the upload preview
                    displayExistingMediaInEditMode();
                }

                // Make form stars interactive
                let formRating = currentRating;
                makeStarsInteractive(stars, formRating);
                
                // Update form submission to handle edit mode
                feedbackForm.onsubmit = async function(e) {
                    e.preventDefault();
                    await handleFeedbackSubmission(formRating, true);
                };
            };
        } else {
            // New feedback handling
            existingFeedbackSection.style.display = 'none';
            feedbackForm.style.display = 'block';

            // Make form stars interactive
            let formRating = 0;
            makeStarsInteractive(stars, formRating);
        }

        // Original feedback submission handler
        feedbackForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            await handleFeedbackSubmission(parseInt(ratingValue.value), false);
        });

        // Separate function for feedback submission
        async function handleFeedbackSubmission(rating, isEdit = false) {
            const comment = document.getElementById('comment').value;
            
            if (checkForCursedWords(comment)) {
                alert("Your comment contains inappropriate language. Please revise it.");
                return;
            }

            if (rating === 0) {
                alert("Please select a rating.");
                return;
            }

            submitBtn.disabled = true;
            loader.style.display = 'block';
            submitBtn.querySelector('span').textContent = 'Submitting...';

            try {
                // Upload media files first
                const mediaData = await uploadMediaFiles(userID, orderID, isEdit);

                const feedbackData = {
                    orderID,
                    shoeID: firstItem.shoeId,
                    rating,
                    comment: censorText(comment),
                    timestamp: Date.now(),
                    ...(mediaData && { media: mediaData })
                };

                const feedbackPath = `smartfit_AR_Database/feedbacks/${userID}/${orderID}`;
                const transactionFeedbackPath = `smartfit_AR_Database/transactions/${userID}/${orderID}/feedback`;

                // Create/update feedback in both locations
                const feedbackResult = await updateData(feedbackPath, feedbackData);
                const transactionResult = await updateData(transactionFeedbackPath, feedbackData);

                if (feedbackResult.success && transactionResult.success) {
                    loader.style.display = 'none';
                    successMessage.style.display = 'block';
                    successMessage.textContent = isEdit ? 
                        "Feedback updated successfully!" : 
                        "Thank you for your feedback!";

                    // Update the displayed feedback
                    updateRatingDisplay(existingStars, rating);
                    existingComment.textContent = feedbackData.comment;

                    // Update existing media data
                    existingMediaData = mediaData;

                    // Update existing media display
                    if (mediaData) {
                        existingMediaSection.style.display = 'block';
                        displayExistingMedia(mediaData, existingMediaPreview);
                    } else {
                        existingMediaSection.style.display = 'none';
                    }

                    // Switch to feedback display view
                    setTimeout(() => {
                        feedbackForm.style.display = 'none';
                        existingFeedbackSection.style.display = 'block';
                        successMessage.style.display = 'none';

                        // Make existing stars interactive for future edits
                        makeStarsInteractive(existingStars, rating, true);

                        // Reset form state
                        submitBtn.disabled = false;
                        submitBtn.querySelector('span').textContent = 'Submit Feedback';
                    }, 1500);

                } else {
                    throw new Error("Failed to submit feedback");
                }

            } catch (error) {
                console.error("Error submitting feedback:", error);
                alert("Failed to submit feedback. Please try again.");
                submitBtn.disabled = false;
                loader.style.display = 'none';
                submitBtn.querySelector('span').textContent = 'Submit Feedback';
            }
        }

    } catch (error) {
        console.error("Error initializing feedback form:", error);
        alert("An error occurred while loading the page.");
    }
});

// Display existing media in edit mode (with remove buttons)
function displayExistingMediaInEditMode() {
    const photosPreview = document.getElementById('photosPreview');
    const videoPreview = document.getElementById('videoPreview');

    // Clear existing previews
    photosPreview.innerHTML = '';
    videoPreview.innerHTML = '';

    // Display existing photos with remove buttons
    if (selectedPhotos.length > 0) {
        selectedPhotos.forEach((photo, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'media-preview-item existing-media';
            previewItem.innerHTML = `
                <img src="${photo.url}" alt="Existing photo ${index + 1}">
                <button type="button" class="remove-btn" onclick="removeExistingPhoto(${index})">
                    <i class="fas fa-times"></i>
                </button>
                <div class="existing-media-badge">Existing</div>
            `;
            photosPreview.appendChild(previewItem);
        });
    }

    // Display existing video with remove button
    if (selectedVideo) {
        const previewItem = document.createElement('div');
        previewItem.className = 'media-preview-item existing-media';
        previewItem.innerHTML = `
            <video src="${selectedVideo.url}" muted></video>
            <button type="button" class="remove-btn" onclick="removeExistingVideo()">
                <i class="fas fa-times"></i>
            </button>
            <div class="existing-media-badge">Existing</div>
        `;
        videoPreview.appendChild(previewItem);
    }

    // Add upload placeholders if there's space
    if (selectedPhotos.length < MEDIA_CONFIG.maxPhotos) {
        const placeholder = document.createElement('div');
        placeholder.className = 'upload-placeholder';
        placeholder.onclick = () => document.getElementById('photoUpload').click();
        placeholder.innerHTML = `
            <i class="fas fa-plus"></i>
            <span>Add More Photos</span>
        `;
        photosPreview.appendChild(placeholder);
    }

    if (!selectedVideo) {
        const placeholder = document.createElement('div');
        placeholder.className = 'upload-placeholder';
        placeholder.onclick = () => document.getElementById('videoUpload').click();
        placeholder.innerHTML = `
            <i class="fas fa-plus"></i>
            <span>Add Video</span>
        `;
        videoPreview.appendChild(placeholder);
    }
}

// Remove existing photo during edit
window.removeExistingPhoto = function(index) {
    if (confirm('Are you sure you want to remove this photo?')) {
        selectedPhotos.splice(index, 1);
        displayExistingMediaInEditMode();
    }
};

// Remove existing video during edit
window.removeExistingVideo = function() {
    if (confirm('Are you sure you want to remove this video?')) {
        selectedVideo = null;
        displayExistingMediaInEditMode();
    }
};

// Media Upload Functions
function initializeMediaUpload() {
    const photoUpload = document.getElementById('photoUpload');
    const videoUpload = document.getElementById('videoUpload');

    // Photo upload handler
    photoUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        
        // Validate number of photos
        if (selectedPhotos.length + files.length > MEDIA_CONFIG.maxPhotos) {
            alert(`You can only upload up to ${MEDIA_CONFIG.maxPhotos} photos.`);
            return;
        }

        // Validate file types
        const invalidFiles = files.filter(file => !MEDIA_CONFIG.allowedImageTypes.includes(file.type));
        if (invalidFiles.length > 0) {
            alert('Please select valid image files (JPG, PNG, JPEG, HEIC).');
            return;
        }

        // Add files to selected photos
        files.forEach(file => {
            if (selectedPhotos.length < MEDIA_CONFIG.maxPhotos) {
                // Convert File object to the same format as existing media
                const reader = new FileReader();
                reader.onload = (e) => {
                    const newPhoto = {
                        url: e.target.result,
                        file: file, // Keep the file object for upload
                        filename: file.name,
                        type: 'image',
                        isNew: true // Mark as new upload
                    };
                    selectedPhotos.push(newPhoto);
                    updateMediaPreviews();
                };
                reader.readAsDataURL(file);
            }
        });

        photoUpload.value = ''; // Reset input
    });

    // Video upload handler
    videoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        
        if (!file) return;

        // Validate file type
        if (!MEDIA_CONFIG.allowedVideoTypes.includes(file.type)) {
            alert('Please select a valid video file (MP4, MOV, AVI).');
            return;
        }

        // Validate file size
        if (file.size > MEDIA_CONFIG.maxVideoSize) {
            alert('Video file size must be less than 50MB.');
            return;
        }

        // Convert File object to the same format as existing media
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedVideo = {
                url: e.target.result,
                file: file, // Keep the file object for upload
                filename: file.name,
                type: 'video',
                isNew: true // Mark as new upload
            };
            updateMediaPreviews();
        };
        reader.readAsDataURL(file);

        videoUpload.value = ''; // Reset input
    });
}

function updateMediaPreviews() {
    const photosPreview = document.getElementById('photosPreview');
    const videoPreview = document.getElementById('videoPreview');

    // Update photos preview
    photosPreview.innerHTML = '';
    
    selectedPhotos.forEach((photo, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = `media-preview-item ${photo.isNew ? 'new-media' : 'existing-media'}`;
        previewItem.innerHTML = `
            <img src="${photo.url}" alt="Preview ${index + 1}">
            <button type="button" class="remove-btn" onclick="removePhoto(${index})">
                <i class="fas fa-times"></i>
            </button>
            ${photo.isNew ? '<div class="new-media-badge">New</div>' : '<div class="existing-media-badge">Existing</div>'}
        `;
        photosPreview.appendChild(previewItem);
    });

    // Add upload placeholder if not at max
    if (selectedPhotos.length < MEDIA_CONFIG.maxPhotos) {
        const placeholder = document.createElement('div');
        placeholder.className = 'upload-placeholder';
        placeholder.onclick = () => document.getElementById('photoUpload').click();
        placeholder.innerHTML = `
            <i class="fas fa-plus"></i>
            <span>${selectedPhotos.length === 0 ? 'Add Photos' : 'Add More Photos'}</span>
        `;
        photosPreview.appendChild(placeholder);
    }

    // Update video preview
    videoPreview.innerHTML = '';
    
    if (selectedVideo) {
        const previewItem = document.createElement('div');
        previewItem.className = `media-preview-item ${selectedVideo.isNew ? 'new-media' : 'existing-media'}`;
        previewItem.innerHTML = `
            <video src="${selectedVideo.url}" muted></video>
            <button type="button" class="remove-btn" onclick="removeVideo()">
                <i class="fas fa-times"></i>
            </button>
            ${selectedVideo.isNew ? '<div class="new-media-badge">New</div>' : '<div class="existing-media-badge">Existing</div>'}
        `;
        videoPreview.appendChild(previewItem);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'upload-placeholder';
        placeholder.onclick = () => document.getElementById('videoUpload').click();
        placeholder.innerHTML = `
            <i class="fas fa-plus"></i>
            <span>Add Video</span>
        `;
        videoPreview.appendChild(placeholder);
    }
}

// Global functions for media removal
window.removePhoto = function(index) {
    if (confirm('Are you sure you want to remove this photo?')) {
        selectedPhotos.splice(index, 1);
        updateMediaPreviews();
    }
};

window.removeVideo = function() {
    if (confirm('Are you sure you want to remove this video?')) {
        selectedVideo = null;
        updateMediaPreviews();
    }
};

// Upload media files to Firebase (enhanced for editing)
async function uploadMediaFiles(userID, orderID, isEdit = false) {
    const mediaData = {
        photos: [],
        video: null
    };

    try {
        // Handle photos - upload new ones, keep existing ones
        for (let i = 0; i < selectedPhotos.length; i++) {
            const photo = selectedPhotos[i];
            
            if (photo.isNew) {
                // Upload new photo
                const storagePath = `feedback_media/${userID}/${orderID}/photos/photo_${i}_${Date.now()}.${getFileExtension(photo.filename)}`;
                
                const uploadResult = await addFile(photo.file, storagePath, {
                    onProgress: (progress) => {
                        console.log(`Uploading photo ${i + 1}: ${progress}%`);
                    }
                });

                if (uploadResult.success) {
                    mediaData.photos.push({
                        url: uploadResult.url,
                        path: uploadResult.path,
                        filename: uploadResult.filename,
                        type: 'image',
                        uploadedAt: new Date().toISOString()
                    });
                } else {
                    console.error(`Failed to upload photo ${i + 1}:`, uploadResult.error);
                }
            } else {
                // Keep existing photo
                mediaData.photos.push(photo);
            }
        }

        // Handle video
        if (selectedVideo) {
            if (selectedVideo.isNew) {
                // Upload new video
                const storagePath = `feedback_media/${userID}/${orderID}/video/video_${Date.now()}.${getFileExtension(selectedVideo.filename)}`;
                
                const uploadResult = await addFile(selectedVideo.file, storagePath, {
                    onProgress: (progress) => {
                        console.log(`Uploading video: ${progress}%`);
                    }
                });

                if (uploadResult.success) {
                    mediaData.video = {
                        url: uploadResult.url,
                        path: uploadResult.path,
                        filename: uploadResult.filename,
                        type: 'video',
                        uploadedAt: new Date().toISOString()
                    };
                } else {
                    console.error('Failed to upload video:', uploadResult.error);
                }
            } else {
                // Keep existing video
                mediaData.video = selectedVideo;
            }
        }

        // If editing, delete removed media from storage
        if (isEdit && existingMediaData) {
            await cleanupRemovedMedia(existingMediaData, mediaData);
        }

        return mediaData.photos.length > 0 || mediaData.video ? mediaData : null;
    } catch (error) {
        console.error('Error uploading media files:', error);
        return null;
    }
}

// Clean up removed media files from storage
async function cleanupRemovedMedia(oldMediaData, newMediaData) {
    try {
        // Check for removed photos
        if (oldMediaData.photos) {
            for (const oldPhoto of oldMediaData.photos) {
                const stillExists = newMediaData.photos.some(newPhoto => 
                    newPhoto.url === oldPhoto.url || newPhoto.path === oldPhoto.path
                );
                
                if (!stillExists && oldPhoto.path) {
                    // Photo was removed, delete from storage
                    await deleteFile(oldPhoto.path).catch(error => {
                        console.warn('Failed to delete old photo:', error);
                    });
                }
            }
        }

        // Check for removed video
        if (oldMediaData.video && (!newMediaData.video || newMediaData.video.url !== oldMediaData.video.url)) {
            if (oldMediaData.video.path) {
                // Video was removed or replaced, delete from storage
                await deleteFile(oldMediaData.video.path).catch(error => {
                    console.warn('Failed to delete old video:', error);
                });
            }
        }
    } catch (error) {
        console.error('Error cleaning up removed media:', error);
    }
}

// Display existing media in the feedback view (read-only)
function displayExistingMedia(mediaData, container) {
    container.innerHTML = '';

    // Display photos
    if (mediaData.photos && mediaData.photos.length > 0) {
        mediaData.photos.forEach((photo, index) => {
            const mediaItem = document.createElement('div');
            mediaItem.className = 'existing-media-item';
            mediaItem.onclick = () => openMediaModal(photo.url, 'image');
            mediaItem.innerHTML = `
                <img src="${photo.url}" alt="Feedback photo ${index + 1}" loading="lazy">
                <div class="media-type-badge">Photo</div>
            `;
            container.appendChild(mediaItem);
        });
    }

    // Display video
    if (mediaData.video) {
        const mediaItem = document.createElement('div');
        mediaItem.className = 'existing-media-item';
        mediaItem.onclick = () => openMediaModal(mediaData.video.url, 'video');
        
        // Create video thumbnail with play icon
        mediaItem.innerHTML = `
            <div class="video-thumbnail">
                <video muted>
                    <source src="${mediaData.video.url}" type="video/mp4">
                </video>
                <div class="video-play-overlay">
                    <i class="fas fa-play"></i>
                </div>
            </div>
            <div class="media-type-badge">Video</div>
        `;
        container.appendChild(mediaItem);
    }
}

// Enhanced Media Modal Functions
function openMediaModal(url, type) {
    const modal = document.getElementById('mediaModal');
    const content = modal.querySelector('.media-modal-content');
    
    // Clear previous content
    content.innerHTML = '';
    
    if (type === 'image') {
        modal.classList.remove('video-mode');
        content.innerHTML = `
            <button class="media-modal-close" onclick="closeMediaModal()">
                <i class="fas fa-times"></i>
            </button>
            <img src="${url}" alt="Enlarged view" onload="hideMediaLoading()" onerror="showMediaError('image')">
            <div class="media-loading" id="mediaLoading">
                <div class="loader"></div>
                <p>Loading image...</p>
            </div>
        `;
        showMediaLoading();
    } else {
        modal.classList.add('video-mode');
        content.innerHTML = `
            <button class="media-modal-close" onclick="closeMediaModal()">
                <i class="fas fa-times"></i>
            </button>
            <div class="video-container">
                <video 
                    controls 
                    controlsList="nodownload"
                    onloadeddata="hideMediaLoading()" 
                    onerror="showMediaError('video')"
                    onloadstart="showMediaLoading()">
                    <source src="${url}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                <div class="video-loading" id="videoLoading">
                    <div class="loader"></div>
                    <p>Loading video...</p>
                </div>
                <div class="video-error" id="videoError" style="display: none;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load video</p>
                    <button class="submit-btn" onclick="retryVideoLoad('${url}')" style="margin-top: 1rem; padding: 0.5rem 1rem;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            </div>
            <div class="video-controls-info">
                <p><small>Use the video controls to play, pause, and adjust volume</small></p>
            </div>
        `;
        showMediaLoading();
    }

    modal.style.display = 'flex';
    
    // Add escape key listener
    document.addEventListener('keydown', handleEscapeKey);
    
    // Close modal when clicking outside content
    modal.addEventListener('click', handleOutsideClick);
}

// Enhanced close modal function
window.closeMediaModal = function() {
    const modal = document.getElementById('mediaModal');
    if (modal) {
        // Pause any playing video
        const video = modal.querySelector('video');
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
        
        modal.style.display = 'none';
        modal.classList.remove('video-mode');
        
        // Remove event listeners
        document.removeEventListener('keydown', handleEscapeKey);
        modal.removeEventListener('click', handleOutsideClick);
    }
};

// Handle escape key to close modal
function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        closeMediaModal();
    }
}

// Handle click outside modal content
function handleOutsideClick(e) {
    const modal = document.getElementById('mediaModal');
    if (e.target === modal) {
        closeMediaModal();
    }
}

// Loading and error handling functions
function showMediaLoading() {
    const loading = document.getElementById('videoLoading') || document.getElementById('mediaLoading');
    if (loading) loading.style.display = 'block';
}

function hideMediaLoading() {
    const videoLoading = document.getElementById('videoLoading');
    if (videoLoading) videoLoading.style.display = 'none';
    
    const mediaLoading = document.getElementById('mediaLoading');
    if (mediaLoading) mediaLoading.style.display = 'none';
}

function showMediaError(type) {
    hideMediaLoading();
    
    if (type === 'video') {
        const error = document.getElementById('videoError');
        if (error) error.style.display = 'flex';
    } else {
        alert('Failed to load image. Please try again.');
        closeMediaModal();
    }
}

function retryVideoLoad(url) {
    const error = document.getElementById('videoError');
    if (error) error.style.display = 'none';
    
    showMediaLoading();
    
    const video = document.querySelector('.media-modal-content video');
    if (video) {
        video.load();
    }
}

// Utility functions
function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

// Shop redirect functionality
function setupShopNameClickEvents() {
    const shopNameLinks = document.querySelectorAll('.shop-name-link');
    
    shopNameLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const shopId = this.getAttribute('data-shop-id');
            const shopName = this.getAttribute('data-shop-name');
            
            if (shopId) {
                redirectToShopDetails(shopId, shopName);
            }
        });
        
        // Add hover effects
        link.style.cursor = 'pointer';
        link.style.color = '#667eea';
        link.style.textDecoration = 'underline';
        link.style.transition = 'color 0.3s ease';
        
        link.addEventListener('mouseenter', function() {
            this.style.color = '#764ba2';
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.color = '#667eea';
        });
    });
}

async function redirectToShopDetails(shopId, shopName) {
    try {
        // Verify shop exists before redirecting
        const shopResult = await readData(`smartfit_AR_Database/shop/${shopId}`);
        
        if (shopResult.success && shopResult.data) {
            // Shop exists, proceed with redirect
            const encodedShopName = encodeURIComponent(shopName);
            window.location.href = `/customer/html/shopownerdetails.html?shopId=${shopId}&shopName=${encodedShopName}`;
        } else {
            // Shop doesn't exist or error
            alert('Shop information is not available at the moment.');
        }
    } catch (error) {
        console.error('Error verifying shop:', error);
        // Still redirect but show error on details page if needed
        const encodedShopName = encodeURIComponent(shopName);
        window.location.href = `/customer/html/shopownerdetails.html?shopId=${shopId}&shopName=${encodedShopName}`;
    }
}

function loadCensoredWords() {
    const curseWordsPath = 'smartfit_AR_Database/curseWords';
    
    return new Promise((resolve) => {
        const unsubscribe = readDataRealtime(curseWordsPath, (result) => {
            if (result.success && result.data) {
                // Convert the object of words into an array
                const wordsObj = result.data;
                cursedWords = Object.values(wordsObj).map(wordData => wordData.word.toLowerCase());
                console.log("Loaded censored words:", cursedWords);
            } else {
                console.log("No censored words found in database");
                cursedWords = [];
            }
            resolve();
        });

        // Store unsubscribe for cleanup if needed
        window.curseWordsUnsubscribe = unsubscribe;
    });
}

function checkForCursedWords(comment) {
    if (!comment || !cursedWords.length) return false;
    const lowerComment = comment.toLowerCase();
    return cursedWords.some(word => {
        // Create regex to match whole words only
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(lowerComment);
    });
}

function censorText(text) {
    if (!text || !cursedWords.length) return text;
    
    return text.split(/\b/).map(word => {
        // Check if the word (case insensitive) is in our cursed words list
        const isCursed = cursedWords.some(cursed => 
            word.toLowerCase() === cursed.toLowerCase()
        );
        
        // If it's a cursed word, replace all but first character with *
        if (isCursed) {
            return word.charAt(0) + '*'.repeat(word.length - 1);
        }
        return word;
    }).join('');
}

// Logout functionality
document.getElementById('logout_btn').addEventListener('click', async function() {
    if (confirm('Are you sure you want to logout?')) {
        const result = await logoutUser();
        if (result.success) {
            window.location.href = "/login.html";
        } else {
            alert('Logout failed: ' + result.error);
        }
    }
});

// Cleanup function if needed
function cleanup() {
    if (window.curseWordsUnsubscribe) {
        window.curseWordsUnsubscribe();
    }
}

// Export for potential cleanup
window.cleanupFeedback = cleanup;

// Initialize the page display
document.addEventListener('DOMContentLoaded', function() {
    // Add mobile menu functionality
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    // Create mobile menu toggle if it doesn't exist in HTML
    if (!mobileToggle && window.innerWidth <= 768) {
        const header = document.querySelector('.header');
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'mobile-menu-toggle';
        toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
        header.insertBefore(toggleBtn, header.firstChild);
        
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
});