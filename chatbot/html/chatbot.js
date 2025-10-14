// chatbot.js - Enhanced with Dynamic Quick Questions
import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    readData,
    updateData
} from "../../firebaseMethods.js";

// Enhanced Backend Server with Database Access
const BackendServer = 'https://smart-fit-ar-backend.onrender.com/api/chat-with-data';

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

// Quick questions data (fallback)
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

function createDefaultResponse(question) {
    return `<div class="troubleshooting-section">
        <strong>I couldn't find specific information about "${question}" in our database.</strong>
        
        <br><br><strong>Here's what I can help you with:</strong>
        • Product information and availability
        • Order status and tracking  
        • Returns and exchanges
        • Shipping options and costs
        • Shoe customization options
        • AR try-on features
        • Payment methods
        • Sizing help
        
        <br><strong>Try asking about:</strong>
        • "What running shoes do you have available?"
        • "Show me basketball shoes"
        • "What's your return policy?"
        • "How does AR try-on work?"
        • "What payment methods do you accept?"
        
        <br><em>For questions not in our knowledge base, please contact our support team at support@smartfit.com</em>
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
    await loadResponsesFromFirebase(); // This now populates quick questions
    setupEventListeners();

    // Show welcome message after a short delay
    setTimeout(() => {
        addMessageToChat('assistant', `Welcome to SmartFit's Help Center! 👟
            
            I can help you with real-time information from our database.
            
            <strong>Quick Questions Available:</strong>
            • Browse our pre-defined FAQ topics below
            • Ask about specific products, features, or policies
            • Get instant answers from our knowledge base
            
            What would you like to know about our products today?`);
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
                if (userData.profilePhoto && userData.profilePhoto) {
                    userAvatar.src = userData.profilePhoto;
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
                console.log("Raw responses from Firebase:", responses);

                responseKeys = responses;
                faqResponses = processFAQResponses(responses);
                
                console.log("Processed FAQ responses:", Object.keys(faqResponses));
                
                // Populate quick questions with actual FAQ data
                populateQuickQuestions();
                resolve();

            } else {
                console.error("Error loading responses:", result.error);
                // Show default questions if loading fails
                showDefaultQuickQuestions();
                resolve();
            }
        });

        return unsubscribe;
    });
}

// Process FAQ responses to extract keywords and responses
function processFAQResponses(responses) {
    const processedResponses = {};
    
    Object.entries(responses).forEach(([responseId, responseData]) => {
        if (responseData && responseData.keyword && responseData.responses) {
            const keyword = responseData.keyword.toLowerCase().trim();
            
            // Store the processed response
            processedResponses[keyword] = {
                response: formatFAQResponse(responseData.responses),
                firebaseKey: responseId,
                popularity: responseData.popularity || 0,
                lastQuestionSentence: responseData.lastQuestionSentence || responseData.keyword,
                category: responseData.category || 'general',
                originalData: responseData // Keep original for debugging
            };
            
            console.log(`Processed FAQ: "${keyword}" -> ${responseData.responses.length} responses`);
        }
    });

    return processedResponses;
}

// Format FAQ responses array into HTML
function formatFAQResponse(responsesArray) {
    if (Array.isArray(responsesArray)) {
        return responsesArray.map(response => {
            // Convert markdown-style formatting to HTML
            return response
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
        }).join('<br><br>');
    } else if (typeof responsesArray === 'string') {
        return responsesArray
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }
    
    return 'No response available.';
}

// Populate quick questions with actual FAQ data
function populateQuickQuestions() {
    if (!quickQuestionsContainer) return;
    
    // Clear existing content
    quickQuestionsContainer.innerHTML = '';
    
    // Define category patterns
    const categoryPatterns = {
        "Features": [
            'ar', 'augmented reality', 'try-on', 'virtual', 'customize', 
            'customization', 'feature', 'how to', 'work', 'technology'
        ],
        "Orders": [
            'shipping', 'delivery', 'return', 'exchange', 'refund', 
            'payment', 'order', 'track', 'cancel', 'policy'
        ],
        "Products": [
            'shoe', 'product', 'available', 'price', 'size', 'color',
            'brand', 'type', 'running', 'basketball', 'sneaker'
        ],
        "Help": [
            'issue', 'problem', 'help', 'support', 'contact', 'how',
            'what', 'when', 'where', 'why', 'trouble'
        ]
    };
    
    // Group FAQs by detected category
    const categorizedFAQs = {
        "Features": [],
        "Orders": [],
        "Products": [],
        "Help": []
    };
    
    // Categorize each FAQ
    Object.entries(faqResponses).forEach(([keyword, faqData]) => {
        const question = faqData.lastQuestionSentence || keyword;
        const response = faqData.response;
        
        let assignedCategory = "Help"; // Default category
        
        // Find the best matching category
        for (const [category, patterns] of Object.entries(categoryPatterns)) {
            if (patterns.some(pattern => 
                keyword.toLowerCase().includes(pattern) || 
                question.toLowerCase().includes(pattern)
            )) {
                assignedCategory = category;
                break;
            }
        }
        
        categorizedFAQs[assignedCategory].push({
            question,
            keyword,
            response,
            popularity: faqData.popularity || 0
        });
    });
    
    // Sort FAQs by popularity within each category
    Object.values(categorizedFAQs).forEach(faqs => {
        faqs.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    });
    
    // Create category sections
    let hasContent = false;
    
    for (const [category, faqs] of Object.entries(categorizedFAQs)) {
        if (faqs.length === 0) continue;
        
        hasContent = true;
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        
        const header = document.createElement('h4');
        header.textContent = `${category} (${faqs.length})`;
        categoryDiv.appendChild(header);
        
        // Add FAQs as buttons (limit to 6 per category)
        faqs.slice(0, 6).forEach(faq => {
            const button = document.createElement('button');
            button.textContent = faq.question;
            button.title = `Popularity: ${faq.popularity} | Click to ask about ${faq.question}`;
            button.addEventListener('click', () => {
                askQuestion(faq.question);
            });
            
            // Add popularity indicator for highly popular questions
            if (faq.popularity > 10) {
                button.innerHTML = `${faq.question} <span style="color: var(--success); font-size: 0.8em;">★</span>`;
            }
            
            categoryDiv.appendChild(button);
        });
        
        quickQuestionsContainer.appendChild(categoryDiv);
    }
    
    // If no FAQs found, show default questions
    if (!hasContent) {
        showDefaultQuickQuestions();
    }
}

// Show default quick questions if no FAQs available
function showDefaultQuickQuestions() {
    const enhancedDefaultQuestions = {
        "Features": [
            "How does AR shoe try-on work?",
            "Can I customize shoe colors?",
            "What customization options are available?",
            "How to use virtual try-on?"
        ],
        "Orders": [
            "What are shipping options?",
            "How do returns work?",
            "What payment methods do you accept?",
            "How long does delivery take?"
        ],
        "Products": [
            "What types of shoes do you have?",
            "Do you have running shoes?",
            "What's the price range?",
            "Do you have size guides?"
        ],
        "Help": [
            "I have an issue with my order",
            "My product has a problem",
            "How to contact support?",
            "Where is my order?"
        ]
    };
    
    for (const [category, questions] of Object.entries(enhancedDefaultQuestions)) {
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

// Enhanced askQuestion function with layered database access
async function askQuestion(question) {
    addMessageToChat('user', question);
    
    // Show searching indicator
    const searchingIndicator = document.createElement('div');
    searchingIndicator.id = "typing-indicator";
    searchingIndicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px;">
            <span>Searching our database...</span>
            <div class="typing-dots">
                <span>.</span><span>.</span><span>.</span>
            </div>
        </div>
    `;
    if (chatMessages) {
        chatMessages.appendChild(searchingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    try {
        // LAYER 1: Check chatbot responses first (using keywords)
        const faqResponse = getFAQResponse(question);
        if (faqResponse.found) {
            console.log("Found FAQ response for:", question, "Keyword:", faqResponse.matchedKeyword);
            if (chatMessages && searchingIndicator.parentNode) {
                chatMessages.removeChild(searchingIndicator);
            }
            addMessageToChat('assistant', faqResponse.response);
            return;
        }

        // LAYER 2: Search actual database tables
        const databaseResponse = await searchAllDatabaseTables(question);
        if (databaseResponse.found) {
            console.log("Found database response for:", question, "Source:", databaseResponse.source);
            if (chatMessages && searchingIndicator.parentNode) {
                chatMessages.removeChild(searchingIndicator);
            }
            addMessageToChat('assistant', databaseResponse.response);
            return;
        }

        // LAYER 3: Use AI with database context as fallback
        const databaseContext = await getDatabaseContext(question);
        
        if (chatMessages && searchingIndicator.parentNode) {
            chatMessages.removeChild(searchingIndicator);
        }

        // Show AI processing indicator
        const aiIndicator = document.createElement('div');
        aiIndicator.id = "typing-indicator";
        aiIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span>Processing with AI...</span>
                <div class="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                </div>
            </div>
        `;
        if (chatMessages) {
            chatMessages.appendChild(aiIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        try {
            const response = await fetch(BackendServer, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    messages: messages,
                    question: question,
                    context: databaseContext,
                    userQuery: question
                })
            });

            const data = await response.json();

            if (chatMessages && aiIndicator.parentNode) {
                chatMessages.removeChild(aiIndicator);
            }

            addMessageToChat("assistant", data.response);
            messages.push({ role: "assistant", content: data.response });

        } catch (aiError) {
            console.error("AI Error:", aiError);
            if (chatMessages && aiIndicator.parentNode) {
                chatMessages.removeChild(aiIndicator);
            }
            // Final fallback
            addMessageToChat("assistant", createDefaultResponse(question));
        }

    } catch (error) {
        console.error("Error in askQuestion:", error);
        if (chatMessages && searchingIndicator.parentNode) {
            chatMessages.removeChild(searchingIndicator);
        }
        addMessageToChat("assistant", createDefaultResponse(question));
    }
}

// LAYER 1: Check FAQ responses first using keywords
function getFAQResponse(question) {
    const lowerQuestion = question.toLowerCase().trim();
    console.log("Searching FAQ for:", lowerQuestion);
    console.log("Available keywords:", Object.keys(faqResponses));

    // Strategy 1: Exact keyword match
    if (faqResponses[lowerQuestion]) {
        console.log("Exact match found:", lowerQuestion);
        updateResponseUsage(faqResponses[lowerQuestion].firebaseKey, question);
        return {
            found: true,
            response: faqResponses[lowerQuestion].response,
            source: 'faq',
            matchedKeyword: lowerQuestion
        };
    }

    // Strategy 2: Question contains keyword
    const containingKeyword = Object.keys(faqResponses).find(keyword => 
        lowerQuestion.includes(keyword) && keyword.length > 2
    );

    if (containingKeyword) {
        console.log("Containing keyword match found:", containingKeyword);
        updateResponseUsage(faqResponses[containingKeyword].firebaseKey, question);
        return {
            found: true,
            response: faqResponses[containingKeyword].response,
            source: 'faq',
            matchedKeyword: containingKeyword
        };
    }

    // Strategy 3: Keyword contains question words (for short questions)
    const questionWords = lowerQuestion.split(' ').filter(word => word.length > 3);
    const keywordContainingQuestion = Object.keys(faqResponses).find(keyword =>
        questionWords.some(word => keyword.includes(word))
    );

    if (keywordContainingQuestion) {
        console.log("Keyword containing question match found:", keywordContainingQuestion);
        updateResponseUsage(faqResponses[keywordContainingQuestion].firebaseKey, question);
        return {
            found: true,
            response: faqResponses[keywordContainingQuestion].response,
            source: 'faq',
            matchedKeyword: keywordContainingQuestion
        };
    }

    console.log("No FAQ match found for:", lowerQuestion);
    return { found: false, response: null };
}

// LAYER 2: Search all database tables
async function searchAllDatabaseTables(question) {
    const lowerQuestion = question.toLowerCase();
    
    // Search products
    const products = await searchProducts(question);
    if (products.length > 0) {
        return {
            found: true,
            response: formatProductResponse(products, question),
            source: 'products'
        };
    }

    // Search policies
    const policies = await searchPolicies(question);
    if (policies.found) {
        return {
            found: true,
            response: policies.response,
            source: 'policies'
        };
    }

    // Search features
    const features = await searchFeatures(question);
    if (features.found) {
        return {
            found: true,
            response: features.response,
            source: 'features'
        };
    }

    return { found: false, response: null };
}

// Search products in Firebase
async function searchProducts(question) {
    try {
        const result = await readData('smartfit_AR_Database/shoe');
        
        if (!result.success || !result.data) {
            console.log("No products found in database");
            return [];
        }

        const allProducts = [];
        const searchTerms = question.toLowerCase().split(' ').filter(term => term.length > 2);
        console.log("Searching products with terms:", searchTerms);

        // Flatten products from all shops
        Object.entries(result.data).forEach(([shopId, shopData]) => {
            if (shopData && typeof shopData === 'object') {
                Object.entries(shopData).forEach(([shoeId, shoeData]) => {
                    if (shoeData && typeof shoeData === 'object') {
                        const product = {
                            shopId,
                            shoeId,
                            ...shoeData,
                            relevance: calculateRelevance(shoeData, searchTerms)
                        };
                        allProducts.push(product);
                    }
                });
            }
        });

        const relevantProducts = allProducts.filter(p => p.relevance > 0)
                         .sort((a, b) => b.relevance - a.relevance)
                         .slice(0, 5);

        console.log(`Found ${relevantProducts.length} relevant products`);
        return relevantProducts;

    } catch (error) {
        console.error('Error searching products:', error);
        return [];
    }
}

// Search policies
async function searchPolicies(question) {
    const lowerQuestion = question.toLowerCase();
    const policyKeywords = {
        'shipping': ['shipping', 'delivery', 'ship', 'deliver', 'shipping options'],
        'return': ['return', 'exchange', 'refund', 'returns', 'exchange policy'],
        'payment': ['payment', 'pay', 'credit card', 'debit card', 'payment methods'],
        'warranty': ['warranty', 'guarantee', 'warranty policy']
    };

    try {
        const result = await readData('smartfit_AR_Database/policies');
        
        if (result.success && result.data) {
            const policies = result.data;
            
            // Check for matching policy keywords
            for (const [policyType, keywords] of Object.entries(policyKeywords)) {
                if (keywords.some(keyword => lowerQuestion.includes(keyword))) {
                    if (policies[policyType]) {
                        console.log("Found policy:", policyType);
                        return {
                            found: true,
                            response: formatPolicyResponse(policyType, policies[policyType])
                        };
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error searching policies:', error);
    }

    return { found: false };
}

// Search features
async function searchFeatures(question) {
    const lowerQuestion = question.toLowerCase();
    const featureKeywords = {
        'ar': ['ar', 'augmented reality', 'try-on', 'virtual try', 'virtual try-on'],
        'customization': ['custom', 'customize', 'personalize', 'customization'],
        'sizing': ['size', 'sizing', 'fit', 'size guide']
    };

    try {
        const result = await readData('smartfit_AR_Database/features');
        
        if (result.success && result.data) {
            const features = result.data;
            
            // Check for matching feature keywords
            for (const [featureType, keywords] of Object.entries(featureKeywords)) {
                if (keywords.some(keyword => lowerQuestion.includes(keyword))) {
                    if (features[featureType]) {
                        console.log("Found feature:", featureType);
                        return {
                            found: true,
                            response: formatFeatureResponse(featureType, features[featureType])
                        };
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error searching features:', error);
    }

    return { found: false };
}

// LAYER 3: Get database context for AI fallback
async function getDatabaseContext(question) {
    const context = {
        products: [],
        faqs: [],
        policies: {},
        features: {},
        searched: true
    };

    try {
        // Get products
        context.products = await searchProducts(question);
        
        // Get policies
        const policiesResult = await readData('smartfit_AR_Database/policies');
        if (policiesResult.success) {
            context.policies = policiesResult.data || {};
        }
        
        // Get features
        const featuresResult = await readData('smartfit_AR_Database/features');
        if (featuresResult.success) {
            context.features = featuresResult.data || {};
        }

        // Get FAQ responses for context
        context.faqs = Object.entries(faqResponses).map(([keyword, data]) => ({
            keyword,
            response: data.response
        }));

    } catch (error) {
        console.error('Error gathering database context:', error);
    }

    return context;
}

// Calculate relevance score for products
function calculateRelevance(product, searchTerms) {
    let score = 0;
    const fieldsToSearch = ['shoeName', 'shoeBrand', 'shoeType', 'shoeGender', 'generalDescription'];
    
    searchTerms.forEach(term => {
        fieldsToSearch.forEach(field => {
            if (product[field] && product[field].toLowerCase().includes(term)) {
                score += field === 'shoeName' ? 3 : 1;
            }
        });
        
        // Check variants
        if (product.variants) {
            Object.values(product.variants).forEach(variant => {
                if (variant.color && variant.color.toLowerCase().includes(term)) {
                    score += 2;
                }
            });
        }
    });
    
    return score;
}

// Response formatting functions
function formatProductResponse(products, question) {
    let response = `<div class="feature-highlight">
        <strong>Found ${products.length} product(s) matching "${question}":</strong><br><br>`;
    
    products.forEach(product => {
        response += `
        <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 8px;">
            <strong>${product.shoeName || 'Unnamed Product'}</strong><br>
            <em>${product.shoeBrand || 'No brand'} • ${product.shoeType || 'No type'}</em><br>
            Price: ${getPriceRange(product.variants)}<br>`;
        
        if (product.generalDescription) {
            response += `Description: ${product.generalDescription.substring(0, 120)}...<br>`;
        }
        
        response += `<a href="/customer/html/shoe_details.html?shoeID=${product.shoeId}&shopID=${product.shopId}" 
           class="link-button">View Product Details</a>
        </div>`;
    });
    
    response += `</div>`;
    return response;
}

function formatPolicyResponse(policyType, policyData) {
    return `<div class="troubleshooting-section">
        <strong>${policyType.charAt(0).toUpperCase() + policyType.slice(1)} Policy:</strong><br><br>
        ${typeof policyData === 'string' ? policyData : JSON.stringify(policyData, null, 2)}
        </div>`;
}

function formatFeatureResponse(featureType, featureData) {
    return `<div class="feature-highlight">
        <strong>${featureType.toUpperCase()} Features:</strong><br><br>
        ${typeof featureData === 'string' ? featureData : JSON.stringify(featureData, null, 2)}
        </div>`;
}

// Helper function to get price range
function getPriceRange(variants) {
    if (!variants) return 'Not available';
    
    const prices = Object.values(variants).map(v => v.price).filter(p => p);
    if (prices.length === 0) return 'Not available';
    
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `₱${min}` : `₱${min} - ₱${max}`;
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
                lastQuestionSentence: question,
                lastUsed: new Date().toISOString()
            };
            
            await updateData(responsePath, updatePayload);
            console.log("Updated response usage for:", responseKey);
        }
    } catch (error) {
        console.error("Error updating response usage:", error);
    }
}

// Send message
async function sendMessage() {
    const userMessage = inputField?.value.trim();
    if (!userMessage) return;

    await askQuestion(userMessage);
    if (inputField) inputField.value = '';
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
    // This is now handled dynamically by populateQuickQuestions
}

// Format message text with bold support and prevent XSS
function formatMessageText(text) {
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/####\s?(.*)/g, '<h4>$1</h4>')
        .replace(/\n/g, '<br>');

    formatted = formatted.replace(/<\/?(?!br|strong|h4|a\b)[^>]+>/g, '');
    return formatted;
}

function addMessageToChat(role, content) {
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('message-content');
    contentWrapper.innerHTML = formatMessageText(content);

    messageDiv.appendChild(contentWrapper);
    chatMessages.appendChild(messageDiv);

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
    const userNameDisplay = document.getElementById('userName_display2');
    if (userNameDisplay && !userNameDisplay.textContent.trim()) {
        userNameDisplay.textContent = 'Alex Johnson';
    }

    initChatbot();
});