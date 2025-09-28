import {
    checkUserAuth,
    logoutUser,
    readData,
    updateData,
    readDataRealtime
} from "../../firebaseMethods.js";

let cursedWords = []; // This will store our censored words from Firebase

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
        document.getElementById('shopName').textContent = `From: ${firstItem.shopName || 'Unknown Shop'}`;

        // Check for existing feedback
        const feedbackPath = `smartfit_AR_Database/feedbacks/${userID}/${orderID}`;
        const feedbackResult = await readData(feedbackPath);

        const existingFeedback = orderData.feedback || (feedbackResult.success ? feedbackResult.data : null);

        // Function to update rating display
        const updateRatingDisplay = (stars, rating) => {
            stars.forEach((star, index) => {
                star.style.color = index < rating ? 'gold' : '#ccc';
            });
        };

        // Function to make stars interactive
        const makeStarsInteractive = (stars, ratingVar, isExisting = false) => {
            stars.forEach((star, index) => {
                star.style.cursor = 'pointer';

                star.addEventListener('click', (e) => {
                    if (isExisting) e.stopPropagation();
                    ratingVar = index + 1;
                    updateRatingDisplay(stars, ratingVar);
                    if (!isExisting) ratingValue.value = ratingVar;
                    else saveUpdatedFeedback(ratingVar, existingComment.textContent);
                });

                star.addEventListener('mouseover', () => {
                    stars.forEach((s, i) => {
                        s.style.color = i <= index ? 'lightgray' : '#ccc';
                    });
                });

                star.addEventListener('mouseout', () => {
                    updateRatingDisplay(stars, ratingVar);
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
                    comment: censorText(comment), // Censor the comment before saving
                    timestamp: Date.now()
                };

                const feedbackPath = `smartfit_AR_Database/feedbacks/${userID}/${orderID}`;
                const transactionFeedbackPath = `smartfit_AR_Database/transactions/${userID}/${orderID}/feedback`;

                // Update both feedback locations
                const feedbackResult = await updateData(feedbackPath, feedbackData);
                const transactionResult = await updateData(transactionFeedbackPath, feedbackData);

                if (feedbackResult.success && transactionResult.success) {
                    successMessage.style.display = 'block';
                    successMessage.textContent = "Rating updated!";
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
            let currentRating = existingFeedback.rating;
            let currentComment = existingFeedback.comment || 'No comment provided';

            existingFeedbackSection.style.display = 'block';
            feedbackForm.style.display = 'none';

            updateRatingDisplay(existingStars, currentRating);
            existingComment.textContent = currentComment;

            // Make existing stars interactive
            makeStarsInteractive(existingStars, currentRating, true);

            // Set up edit button
            editReviewBtn.onclick = () => {
                existingFeedbackSection.style.display = 'none';
                feedbackForm.style.display = 'block';

                ratingValue.value = currentRating;
                document.getElementById('comment').value = currentComment;
                updateRatingDisplay(stars, currentRating);

                // Make form stars interactive
                makeStarsInteractive(stars, currentRating);
            };
        } else {
            // New feedback handling
            existingFeedbackSection.style.display = 'none';
            feedbackForm.style.display = 'block';

            // Make form stars interactive
            makeStarsInteractive(stars, 0);
        }

        // Feedback submission
        feedbackForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const comment = document.getElementById('comment').value;
            
            if (checkForCursedWords(comment)) {
                alert("Your comment contains inappropriate language. Please revise it.");
                return;
            }

            const rating = parseInt(ratingValue.value);

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
                    comment: censorText(comment), // Censor the comment before saving
                    timestamp: Date.now()
                };

                const feedbackPath = `smartfit_AR_Database/feedbacks/${userID}/${orderID}`;
                const transactionFeedbackPath = `smartfit_AR_Database/transactions/${userID}/${orderID}/feedback`;

                // Create feedback in both locations
                const feedbackResult = await updateData(feedbackPath, feedbackData);
                const transactionResult = await updateData(transactionFeedbackPath, feedbackData);

                if (feedbackResult.success && transactionResult.success) {
                    loader.style.display = 'none';
                    successMessage.style.display = 'block';
                    successMessage.textContent = "Thank you for your feedback!";

                    // Update the displayed feedback
                    updateRatingDisplay(existingStars, rating);
                    existingComment.textContent = feedbackData.comment; // Show censored version

                    // Switch to feedback display view
                    feedbackForm.style.display = 'none';
                    existingFeedbackSection.style.display = 'block';

                    // Make existing stars interactive
                    makeStarsInteractive(existingStars, rating, true);

                    // Reset form state
                    setTimeout(() => {
                        submitBtn.disabled = false;
                        submitBtn.querySelector('span').textContent = 'Submit Feedback';
                        successMessage.style.display = 'none';
                    }, 3000);

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
        });
    } catch (error) {
        console.error("Error initializing feedback form:", error);
        alert("An error occurred while loading the page.");
    }
});

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
                cursedWords = []; // Reset to empty array if no words exist
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