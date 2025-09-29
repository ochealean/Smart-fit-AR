// chatbot.js - Refactored to use firebaseMethods only
import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    readData,
    updateData
} from "../../firebaseMethods.js";

// Backend server URL for ChatGPT API
// old backend server
// https://github-chat-backend.onrender.com/api/chat
const BackendServer = 'https://smart-fit-ar-backend.onrender.com/api/chat';

// DOM Elements
const inputField = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const chatMessages = document.getElementById('chat-messages');
const quickQuestionsContainer = document.querySelector('.quick-questions .question-categories');

let faqResponses = {};
let responseKeys = {};

// Chat messages array
let messages = [
    {
        role: "system",
        content: "You are a helpful assistant for SmartFit Shoes. Help customers with:" +
            "\n- AR shoe try-on features" +
            "\n- Product customization options" +
            "\n- Order status and shipping" +
            "\n- Returns and exchanges" +
            "\n- Product information and sizing" +
            "\n\nAlways be polite, helpful, and provide detailed answers."
    }
];

// Quick questions data
const quickQuestions = {
    "Features": [
        "How does the AR try-on work?",
        "Can I customize my shoes?",
        "What products do you offer?"
    ],
    "Orders": [
        "What are my shipping options?",
        "How do returns work?",
        "What payment methods do you accept?"
    ],
    "Help": [
        "I have an issue with my order",
        "My product has a problem",
        "I need sizing help"
    ]
};

function createDefaultResponse() {
    return `<div class="troubleshooting-section">
        I'm sorry, I couldn't find an answer to that question. Here are some topics I can help with:
        Features: AR try-on, Customization, Products
        Orders: Shipping, Returns, Payments
        Help: Issues, Problems, Troubleshooting
        Try asking about one of these topics or click any quick question above!
        </div>`;
}

// Initialize the chatbot
async function initChatbot() {
    const user = await checkUserAuth();

    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    // Load user profile
    await loadUserProfile(user.userId);
    
    // Setup chatbot functionality
    await loadResponsesFromFirebase();
    setupEventListeners();
    updateQuickQuestions();

    // Show welcome message after a short delay
    setTimeout(() => {
        addMessageToChat('assistant', `Welcome to SmartFit's Help Center! 👟
            How can I assist you today? Try asking about:<br>
            - AR shoe try-on
            - Order status
            - Returns policy
            - Product customization`);
    }, 1000);
}

// Load user profile using firebaseMethods
async function loadUserProfile(userId) {
    try {
        const result = await readData(`smartfit_AR_Database/customers/${userId}`);
        
        if (result.success && result.data) {
            const userData = result.data;
            const userNameDisplay = document.getElementById('userName_display2');
            const userAvatar = document.getElementById('imageProfile');
            
            if (userNameDisplay) {
                userNameDisplay.textContent = `${userData.firstName} ${userData.lastName}`;
            }

            // Set user avatar if available
            if (userAvatar) {
                if (userData.profilePhoto && userData.profilePhoto.url) {
                    userAvatar.src = userData.profilePhoto.url;
                } else {
                    userAvatar.src = "https://randomuser.me/api/portraits/men/32.jpg";
                }
            }
        }
    } catch (error) {
        console.error("Error loading user profile:", error);
    }
}

// Load responses from Firebase using readDataRealtime
function loadResponsesFromFirebase() {
    return new Promise((resolve) => {
        const responsesPath = 'smartfit_AR_Database/chatbot/responses';
        
        const unsubscribe = readDataRealtime(responsesPath, (result) => {
            if (result.success) {
                const responses = result.data || {};

                responseKeys = responses;
                faqResponses = Object.entries(responses).reduce((acc, [key, response]) => {
                    if (response.keyword && response.responses) {
                        const keyword = response.keyword.toLowerCase();
                        acc[keyword] = {
                            response: Array.isArray(response.responses)
                                ? response.responses.join('<br>')
                                : response.responses,
                            firebaseKey: key,
                            popularity: response.popularity || 0,
                            lastQuestionSentence: response.lastQuestionSentence || response.keyword,
                            category: response.category || 'general'
                        };
                    }
                    return acc;
                }, {});

                faqResponses.default = {
                    response: createDefaultResponse(),
                    firebaseKey: null,
                    popularity: 0,
                    lastQuestionSentence: "Help topics",
                    category: 'general'
                };

                updateQuickQuestions();
                resolve(); // Resolve the promise when data is loaded

            } else {
                console.error("Error loading responses:", result.error);
                resolve(); // Still resolve even if there's an error
            }
        });

        // Return unsubscribe function for cleanup if needed
        return unsubscribe;
    });
}

// Get the best response from Firebase or AI
async function askQuestion(question) {
    // First check Firebase for a response
    const firebaseResponse = getBestResponse(question);

    if (firebaseResponse && firebaseResponse !== faqResponses.default.response) {
        // If found in Firebase, use that
        addMessageToChat('user', question);
        addMessageToChat('assistant', firebaseResponse);
    } else {
        // If not found, use AI
        addMessageToChat("user", question);
        messages.push({ role: "user", content: question });

        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.id = "typing-indicator";
        typingIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span>Assistant is typing</span>
                <div class="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                </div>
            </div>
        `;
        if (chatMessages) {
            chatMessages.appendChild(typingIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        try {
            const response = await fetch(BackendServer, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages })
            });

            const data = await response.json();

            // Remove typing indicator
            if (chatMessages && typingIndicator.parentNode) {
                chatMessages.removeChild(typingIndicator);
            }

            // Add assistant response
            addMessageToChat("assistant", data.response);
            messages.push({ role: "assistant", content: data.response });

        } catch (error) {
            console.error("Error:", error);
            if (chatMessages && typingIndicator.parentNode) {
                chatMessages.removeChild(typingIndicator);
            }
            addMessageToChat("assistant", firebaseResponse); // Fallback to default Firebase response
        }
    }
}

function updateQuickQuestions() {
    if (!quickQuestionsContainer) return;
    
    quickQuestionsContainer.innerHTML = '';

    for (const [category, questions] of Object.entries(quickQuestions)) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';

        const header = document.createElement('h4');
        header.textContent = category;
        categoryDiv.appendChild(header);

        questions.forEach(question => {
            const button = document.createElement('button');
            button.textContent = question;
            button.addEventListener('click', () => askQuestion(question));
            categoryDiv.appendChild(button);
        });

        quickQuestionsContainer.appendChild(categoryDiv);
    }
}

function getBestResponse(input) {
    if (!faqResponses || Object.keys(faqResponses).length === 0) {
        return createDefaultResponse();
    }

    const lowerInput = input.toLowerCase().trim();

    if (faqResponses[lowerInput]) {
        updateResponseUsage(faqResponses[lowerInput].firebaseKey, input);
        return faqResponses[lowerInput].response;
    }

    const matchingKey = Object.keys(faqResponses).find(key =>
        key !== 'default' && lowerInput.includes(key)
    );

    if (matchingKey) {
        updateResponseUsage(faqResponses[matchingKey].firebaseKey, input);
        return faqResponses[matchingKey].response;
    }

    return faqResponses.default.response;
}

// Update response usage using updateData
async function updateResponseUsage(responseKey, question) {
    if (!responseKey) return;

    try {
        const responsePath = `smartfit_AR_Database/chatbot/responses/${responseKey}`;
        const result = await readData(responsePath);
        
        if (result.success && result.data) {
            const response = result.data;
            const currentPopularity = response.popularity || 0;
            
            const updatePayload = {
                popularity: currentPopularity + 1,
                lastQuestionSentence: question
            };
            
            await updateData(responsePath, updatePayload);
            // Reload responses to get updated data
            loadResponsesFromFirebase();
        }
    } catch (error) {
        console.error("Error updating response usage:", error);
    }
}

// Send message to ChatGPT API
async function sendMessage() {
    const userMessage = inputField?.value.trim();
    if (!userMessage) return;

    // First check if we have a Firebase response
    const firebaseResponse = getBestResponse(userMessage);

    if (firebaseResponse && firebaseResponse !== faqResponses.default.response) {
        // If found in Firebase, use that
        addMessageToChat('user', userMessage);
        addMessageToChat('assistant', firebaseResponse);
        if (inputField) inputField.value = '';
    } else {
        // If not found, use AI
        addMessageToChat("user", userMessage);
        messages.push({ role: "user", content: userMessage });
        if (inputField) inputField.value = '';

        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.id = "typing-indicator";
        typingIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span>Assistant is typing</span>
                <div class="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                </div>
            </div>
        `;
        if (chatMessages) {
            chatMessages.appendChild(typingIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        try {
            const response = await fetch(BackendServer, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages })
            });

            const data = await response.json();

            // Remove typing indicator
            if (chatMessages && typingIndicator.parentNode) {
                chatMessages.removeChild(typingIndicator);
            }

            // Add assistant response
            addMessageToChat("assistant", data.response);
            messages.push({ role: "assistant", content: data.response });

        } catch (error) {
            console.error("Error:", error);
            if (chatMessages && typingIndicator.parentNode) {
                chatMessages.removeChild(typingIndicator);
            }
            addMessageToChat("assistant", firebaseResponse); // Fallback to default Firebase response
        }
    }
}

// Set up event listeners
function setupEventListeners() {
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logout_btn');
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

    // Add event listeners for quick question buttons
    document.querySelectorAll('.quick-questions button').forEach(button => {
        button.addEventListener('click', function () {
            if (inputField) {
                inputField.value = this.textContent;
            }
            if (sendButton) {
                sendButton.click();
            }
        });
    });
}

// Format message text with bold support and prevent XSS
function formatMessageText(text) {
    // Convert Markdown-style formatting to HTML
    let formatted = text
        // Convert **bold** to <strong>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Convert #### headers to <h4>
        .replace(/####\s?(.*)/g, '<h4>$1</h4>')
        // Convert newlines to <br>
        .replace(/\n/g, '<br>');

    // Basic HTML safety - only allow certain tags
    formatted = formatted.replace(/<\/?(?!br|strong|h4|a\b)[^>]+>/g, '');

    return formatted;
}

function addMessageToChat(role, content) {
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('message-content');

    // Process the content through our simplified formatter
    contentWrapper.innerHTML = formatMessageText(content);

    messageDiv.appendChild(contentWrapper);
    chatMessages.appendChild(messageDiv);

    // Animation effects
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(10px)';
    messageDiv.style.transition = 'all 0.3s ease-out';

    setTimeout(() => {
        messageDiv.style.opacity = '1';
        messageDiv.style.transform = 'translateY(0)';
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }, 10);
}

// Make functions globally accessible
window.askQuestion = askQuestion;

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize with sample data
    const userNameDisplay = document.getElementById('userName_display2');
    if (userNameDisplay && !userNameDisplay.textContent.trim()) {
        userNameDisplay.textContent = 'Alex Johnson';
    }

    // Initialize the chatbot
    initChatbot();
});