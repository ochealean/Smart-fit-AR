import {
    checkUserAuth,
    logoutUser,
    readData,
    updateData,
    readDataRealtime
} from "../../firebaseMethods.js";

let cursedWords = [];
let currentShopId = null;
let currentShopName = null;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // First load the censored words
        await loadCensoredWords();
        
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

            existingFeedbackSection.style.display = 'block';
            feedbackForm.style.display = 'none';

            updateRatingDisplay(existingStars, currentRating);
            existingComment.textContent = currentComment;

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
                const feedbackData = {
                    orderID,
                    shoeID: firstItem.shoeId,
                    rating,
                    comment: censorText(comment),
                    timestamp: Date.now()
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