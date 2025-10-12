import { 
    checkUserAuth, 
    readData, 
    displayProducts, 
    readImageFromFirebase,
    readDataRealtime 
} from '../../firebaseMethods.js';

class ShopDetailsPage {
    constructor() {
        this.shopId = this.getShopIdFromURL();
        this.currentUser = null;
        this.shopData = null;
        this.products = [];
        this.feedbacks = [];
        this.customers = {}; // Store customer data
        this.currentPage = 1;
        this.productsPerPage = 12;
        this.currentFilters = {
            category: 'all',
            sort: 'newest'
        };
        
        console.log('🏪 ShopDetailsPage initialized');
        console.log('📋 Shop ID from URL:', this.shopId);
        
        this.init();
    }

    getShopIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const shopId = urlParams.get('shopId');
        console.log('🔗 URL Parameters:', Object.fromEntries(urlParams.entries()));
        return shopId;
    }

    async init() {
        console.log('🚀 Initializing shop details page...');
        await this.checkAuthentication();
        await this.loadShopData();
        this.setupEventListeners();
        this.initializeMap();
    }

    async checkAuthentication() {
        console.log('🔐 Checking authentication...');
        try {
            const authResult = await checkUserAuth();
            console.log('✅ Authentication result:', authResult);
            
            if (!authResult.authenticated) {
                console.log('❌ User not authenticated, redirecting to login');
                window.location.href = '/login.html#customer';
                return;
            }
            this.currentUser = authResult;
            this.updateUserMenu();
        } catch (error) {
            console.error('❌ Auth check failed:', error);
        }
    }

    updateUserMenu() {
        const userMenu = document.getElementById('userMenu');
        if (this.currentUser && this.currentUser.userData) {
            userMenu.innerHTML = `
                <span>Welcome, ${this.currentUser.userData.firstName || 'Customer'}</span>
                <button id="logoutBtn" class="logout-btn">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            `;
            document.getElementById('logoutBtn').addEventListener('click', this.logout.bind(this));
        }
    }

    async logout() {
        console.log('👋 Logging out...');
        window.location.href = '/login.html#customer';
    }

    async loadShopData() {
        console.log('📦 Loading shop data...');
        this.showLoading();
        
        try {
            const shopPath = `smartfit_AR_Database/shop/${this.shopId}`;
            console.log('📡 Fetching shop data from path:', shopPath);
            
            // Load shop basic information
            const shopResult = await readData(shopPath);
            console.log('📊 Shop data result:', shopResult);
            
            if (!shopResult.success) {
                console.error('❌ Shop not found or error:', shopResult.error);
                throw new Error('Shop not found');
            }
            
            this.shopData = shopResult.data;
            console.log('✅ Shop data loaded successfully:', this.shopData);
            
            // Log specific shop properties based on your actual data structure
            console.log('🏷️ Shop Name:', this.shopData.shopName);
            console.log('📍 Shop Address:', this.shopData.shopAddress);
            console.log('🏙️ Shop City:', this.shopData.shopCity);
            console.log('📧 Shop Email:', this.shopData.email);
            console.log('📞 Shop Phone:', this.shopData.ownerPhone);
            console.log('👤 Owner Name:', this.shopData.ownerName);
            console.log('📄 Uploads:', this.shopData.uploads);
            console.log('✅ Shop Status:', this.shopData.status);
            console.log('📍 Coordinates:', this.shopData.latitude, this.shopData.longitude);
            
            this.renderShopHeader();
            this.renderAboutSection();
            this.renderDocumentsSection();
            this.renderLocationSection();
            
            // Load products, customers, and feedbacks
            await Promise.all([
                this.loadProducts(),
                this.loadCustomers(),
                this.loadFeedbacks()
            ]);
            
        } catch (error) {
            console.error('❌ Error loading shop data:', error);
            this.showError('Failed to load shop details. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async loadCustomers() {
        console.log('👥 Loading customers data...');
        try {
            const customersPath = `smartfit_AR_Database/customers`;
            console.log('📡 Fetching customers from path:', customersPath);
            
            const customersResult = await readData(customersPath);
            console.log('👤 Customers result:', customersResult);
            
            if (customersResult.success && customersResult.data) {
                this.customers = customersResult.data;
                console.log(`✅ Loaded ${Object.keys(this.customers).length} customers`);
            } else {
                console.log('📭 No customers data found');
                this.customers = {};
            }
        } catch (error) {
            console.error('❌ Error loading customers:', error);
            this.customers = {};
        }
    }

    renderShopHeader() {
        console.log('🎨 Rendering shop header...');
        const shop = this.shopData;
        
        // Remove banner image since it doesn't exist in your data
        const shopBanner = document.getElementById('shopBanner');
        if (shopBanner) {
            shopBanner.style.display = 'none';
        }
        
        // Update shop logo - use the shopLogo from uploads
        if (shop.uploads && shop.uploads.shopLogo) {
            console.log('🖼️ Setting shop logo:', shop.uploads.shopLogo.url);
            document.getElementById('shopLogo').src = shop.uploads.shopLogo.url;
        } else {
            // Use default logo if no shop logo
            document.getElementById('shopLogo').src = '/images/default-shop-logo.png';
        }
        
        // Update shop details
        document.getElementById('shopName').textContent = shop.shopName || 'Unnamed Shop';
        document.getElementById('shopLocation').textContent = shop.shopCity || 'Location not specified';
        
        // Update verification status - check if shop is approved
        const verifiedBadge = document.getElementById('verifiedBadge');
        if (shop.status === 'approved') {
            console.log('✅ Shop is verified (approved)');
            verifiedBadge.style.display = 'flex';
        } else {
            console.log('❌ Shop is not verified');
            verifiedBadge.style.display = 'none';
        }
        
        // Update rating - you can add this field to your database later
        // For now, we'll use a default rating
        document.getElementById('shopRating').innerHTML = 
            `<i class="fas fa-star"></i> 4.5`;
        
        console.log('✅ Shop header rendered');
    }

    renderAboutSection() {
        console.log('📝 Rendering about section...');
        const shop = this.shopData;
        
        // Update description
        const descriptionEl = document.getElementById('shopDescription');
        descriptionEl.innerHTML = shop.shopDescription || 
            '<p>No description provided by the shop owner.</p>';
        
        // Update stats - these fields might not exist in your data yet
        // For now, we'll use placeholder values
        document.getElementById('totalProducts').textContent = '0'; // Will be updated when products load
        document.getElementById('yearsOperating').textContent = shop.yearsInBusiness || '1';
        
        console.log('📊 Shop stats - Years in business:', shop.yearsInBusiness);
        
        // Update contact info using your actual data structure
        if (shop.ownerPhone) document.getElementById('shopPhone').textContent = shop.ownerPhone;
        if (shop.email) document.getElementById('shopEmail').textContent = shop.email;
        console.log('✅ About section rendered');
    }

    renderDocumentsSection() {
        console.log('📄 Rendering documents section...');
        const shop = this.shopData;
        const documentsGrid = document.getElementById('documentsGrid');
        
        // Use the uploads section for documents since businessDocuments doesn't exist
        if (!shop.uploads || Object.keys(shop.uploads).length === 0) {
            console.log('📭 No business documents available');
            documentsGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-file-alt"></i>
                    <p>No business documents available</p>
                </div>
            `;
            return;
        }
        
        console.log('📑 Uploads found:', Object.keys(shop.uploads));
        
        let documentsHTML = '';
        
        // Map your uploads to document types
        const documentTypes = {
            'businessLicense': 'Business License',
            'permitDocument': 'Business Permit',
            'ownerIdFront': "Owner's ID (Front)",
            'ownerIdBack': "Owner's ID (Back)",
        };
        
        Object.entries(shop.uploads).forEach(([docType, doc]) => {
            if (documentTypes[docType] && doc.url) {
                console.log(`📋 Document ${docType}:`, doc);
                
                // Check if it's an image file
                const isImage = doc.type && doc.type.startsWith('image/');
                const fileName = doc.name || 'Document';
                const uploadDate = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Unknown date';
                
                documentsHTML += `
                    <div class="document-card">
                        <h4>${documentTypes[docType]}</h4>
                        ${isImage ? `
                            <div class="document-image-container">
                                <img src="${doc.url}" alt="${fileName}" class="document-image" 
                                    onclick="shopDetails.openDocumentInNewTab('${doc.url}')">
                                <div class="image-overlay">
                                    <i class="fas fa-expand"></i>
                                    <span>Click to view</span>
                                </div>
                            </div>
                        ` : `
                            <div class="document-file-info">
                                <i class="fas fa-file-pdf"></i>
                                <p>File: ${fileName}</p>
                            </div>
                            <button class="view-document" onclick="shopDetails.openDocumentInNewTab('${doc.url}')">
                                <i class="fas fa-external-link-alt"></i> View Document
                            </button>
                        `}
                        <p class="upload-date">Uploaded: ${uploadDate}</p>
                    </div>
                `;
            }
        });
        
        documentsGrid.innerHTML = documentsHTML || `
            <div class="no-results">
                <i class="fas fa-file-alt"></i>
                <p>No business documents available</p>
            </div>
        `;
        
        console.log('✅ Documents section rendered');
    }

    openDocumentInNewTab(url) {
        console.log('📄 Opening document in new tab:', url);
        window.open(url, '_blank');
    }

    renderLocationSection() {
        console.log('📍 Rendering location section...');
        const shop = this.shopData;
        
        // Update address using your actual data structure - show full address
        document.getElementById('shopAddress').textContent = shop.shopAddress || 'Address not provided';
        document.getElementById('shopCity').textContent = shop.shopCity || '-';
        document.getElementById('shopProvince').textContent = shop.shopState || '-';
        document.getElementById('shopZip').textContent = shop.shopZip || '-';
        
        console.log('🗺️ Shop location:', shop.shopAddress, shop.shopCity, shop.shopState, shop.shopZip);
        console.log('📍 Coordinates:', shop.latitude, shop.longitude);
        
        // Add coordinates display if available
        if (shop.latitude && shop.longitude) {
            const locationDetails = document.querySelector('.location-details');
            locationDetails.innerHTML += `
                <div class="coordinates-display">
                    <h4>GPS Coordinates</h4>
                    <div class="coordinates-grid">
                        <div class="coordinate-item">
                            <span class="coordinate-label">Latitude:</span>
                            <span class="coordinate-value">${parseFloat(shop.latitude).toFixed(6)}</span>
                        </div>
                        <div class="coordinate-item">
                            <span class="coordinate-label">Longitude:</span>
                            <span class="coordinate-value">${parseFloat(shop.longitude).toFixed(6)}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Don't update map here - wait for map to be initialized
        // The map will be updated in initializeMap() after it's ready
        console.log('✅ Location section rendered');
    }

    async geocodeAddress(street, city, state) {
        if (!street || !city) {
            console.log('❌ Insufficient address information for geocoding');
            // Use default location
            this.updateMap(14.5995, 120.9842);
            return;
        }

        const fullAddress = `${street}, ${city}, ${state}, Philippines`;
        console.log('🗺️ Geocoding address:', fullAddress);

        try {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: fullAddress }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;
                    console.log('📍 Geocoding successful:', location.lat(), location.lng());
                    this.updateMap(location.lat(), location.lng());
                } else {
                    console.log('❌ Geocoding failed:', status);
                    // Fallback to default location
                    this.updateMap(14.5995, 120.9842);
                }
            });
        } catch (error) {
            console.error('❌ Geocoding error:', error);
            this.updateMap(14.5995, 120.9842);
        }
    }

    initializeMap() {
        console.log('🗺️ Initializing Google Map...');
        try {
            // Check if Google Maps is available
            if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
                console.error('❌ Google Maps API not loaded');
                this.showMapError();
                return;
            }

            const mapElement = document.getElementById('shopMap');
            if (!mapElement) {
                console.error('❌ Map element not found');
                return;
            }

            this.map = new google.maps.Map(mapElement, {
                zoom: 15,
                center: { lat: 14.5995, lng: 120.9842 }, // Default to Philippines
                styles: [
                    {
                        featureType: 'poi',
                        elementType: 'labels',
                        stylers: [{ visibility: 'on' }]
                    }
                ]
            });
            
            console.log('✅ Google Map initialized successfully');
            
            // Now that map is initialized, update it with shop location if we have data
            if (this.shopData) {
                this.updateMapWithShopLocation();
            }
        } catch (error) {
            console.error('❌ Error initializing Google Map:', error);
            this.showMapError();
        }
    }

    showMapError() {
        const mapElement = document.getElementById('shopMap');
        if (mapElement) {
            mapElement.innerHTML = `
                <div class="map-error">
                    <i class="fas fa-map-marker-alt"></i>
                    <p>Unable to load map</p>
                    <button onclick="shopDetails.retryMapInitialization()" class="retry-btn">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    retryMapInitialization() {
        console.log('🔄 Retrying map initialization...');
        this.initializeMap();
    }

    updateMapWithShopLocation() {
        console.log('📍 Updating map with shop location...');
        const shop = this.shopData;
        
        if (!this.map) {
            console.error('❌ Map not initialized yet');
            return;
        }

        // Use coordinates if available, otherwise geocode the address
        if (shop.latitude && shop.longitude) {
            console.log('📍 Using provided coordinates:', shop.latitude, shop.longitude);
            this.updateMap(parseFloat(shop.latitude), parseFloat(shop.longitude));
        } else {
            // Try to geocode the address to get coordinates
            this.geocodeAddress(shop.shopAddress, shop.shopCity, shop.shopState);
        }
    }

    updateMap(lat, lng) {
        console.log('📍 Updating map with coordinates:', lat, lng);
        
        // Check if map is initialized
        if (!this.map) {
            console.error('❌ Map not initialized in updateMap()');
            return;
        }
        
        const position = { lat, lng };
        
        this.map.setCenter(position);
        
        // Clear existing markers
        if (this.marker) {
            this.marker.setMap(null);
        }
        
        // Add new marker
        this.marker = new google.maps.Marker({
            position: position,
            map: this.map,
            title: this.shopData.shopName || 'Shop Location',
            animation: google.maps.Animation.DROP
        });
        
        console.log('📍 Map marker added at:', position);
        
        // Add info window with full address details
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="padding: 1rem; max-width: 250px;">
                    <h3 style="margin: 0 0 0.5rem 0; color: #333;">${this.shopData.shopName}</h3>
                    <p style="margin: 0 0 0.25rem 0; color: #666;"><strong>Street Address:</strong> ${this.shopData.shopAddress}</p>
                    <p style="margin: 0 0 0.25rem 0; color: #666;"><strong>City:</strong> ${this.shopData.shopCity}</p>
                    <p style="margin: 0 0 0.25rem 0; color: #666;"><strong>Province:</strong> ${this.shopData.shopState}</p>
                    <p style="margin: 0 0 0.25rem 0; color: #666;"><strong>ZIP:</strong> ${this.shopData.shopZip}</p>
                    ${this.shopData.latitude && this.shopData.longitude ? `
                        <p style="margin: 0; color: #666;"><strong>Coordinates:</strong> ${parseFloat(this.shopData.latitude).toFixed(6)}, ${parseFloat(this.shopData.longitude).toFixed(6)}</p>
                    ` : ''}
                </div>
            `
        });
        
        this.marker.addListener('click', () => {
            infoWindow.open(this.map, this.marker);
        });
        
        // Auto-open info window
        setTimeout(() => {
            infoWindow.open(this.map, this.marker);
        }, 1000);
    }

    getDirections() {
        const shop = this.shopData;
        
        // Use coordinates if available, otherwise use address
        if (shop.latitude && shop.longitude) {
            console.log('📍 Using coordinates for directions:', shop.latitude, shop.longitude);
            const url = `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`;
            console.log('🗺️ Opening directions URL with coordinates:', url);
            window.open(url, '_blank');
        } else if (shop.shopAddress && shop.shopCity) {
            const fullAddress = `${shop.shopAddress}, ${shop.shopCity}, ${shop.shopState}, Philippines`;
            const encodedAddress = encodeURIComponent(fullAddress);
            const url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
            console.log('🗺️ Opening directions URL with address:', url);
            window.open(url, '_blank');
        } else {
            console.log('❌ No location data available for directions');
            alert('Shop location not available for directions.');
        }
    }

    async loadProducts() {
        console.log('👟 Loading shop products...');
        try {
            const productsPath = `smartfit_AR_Database/shoe/${this.shopId}`;
            console.log('📡 Fetching products from path:', productsPath);
            
            // Use readData instead of displayProducts to get the nested structure
            const productsResult = await readData(productsPath);
            console.log('📦 Products result:', productsResult);
            
            if (productsResult.success && productsResult.data) {
                // Convert the nested object structure to array
                this.products = this.convertProductsToArray(productsResult.data);
                console.log(`✅ Loaded ${this.products.length} products:`, this.products);
                
                // Update the total products count in about section
                document.getElementById('totalProducts').textContent = this.products.length;
                
                this.renderProducts();
            } else {
                console.error('❌ Error loading products:', productsResult.error);
                throw new Error(productsResult.error || 'No products found');
            }
        } catch (error) {
            console.error('❌ Error loading products:', error);
            this.showProductsError();
        }
    }

    convertProductsToArray(productsData) {
        const productsArray = [];
        
        if (!productsData) return productsArray;
        
        // Iterate through each product ID in the shop
        Object.entries(productsData).forEach(([productId, productData]) => {
            if (productData && typeof productData === 'object') {
                // Add the product ID to the product data
                const productWithId = {
                    ...productData,
                    id: productId // Add the product ID
                };
                productsArray.push(productWithId);
            }
        });
        
        console.log(`🔄 Converted ${productsArray.length} products from object to array`);
        return productsArray;
    }

    async loadFeedbacks() {
        console.log('💬 Loading feedbacks from Firebase...');
        try {
            const feedbacksPath = `smartfit_AR_Database/feedbacks`;
            console.log('📡 Fetching feedbacks from path:', feedbacksPath);
            
            const feedbacksResult = await readData(feedbacksPath);
            console.log('📝 Feedbacks result:', feedbacksResult);
            
            if (feedbacksResult.success && feedbacksResult.data) {
                // Get all feedbacks for this shop's products
                this.feedbacks = this.compileShopFeedbacks(feedbacksResult.data);
                console.log(`✅ Compiled ${this.feedbacks.length} feedbacks for this shop:`, this.feedbacks);
                
                // Update shop rating with real data
                this.updateShopRating();
                
                this.renderReviews(this.feedbacks);
            } else {
                console.log('📭 No feedbacks found, using sample data');
                this.renderSampleReviews();
            }
        } catch (error) {
            console.error('❌ Error loading feedbacks:', error);
            this.renderSampleReviews();
        }
    }

    compileShopFeedbacks(feedbacksData) {
        console.log('🔄 Compiling feedbacks for shop products...');
        const shopFeedbacks = [];
        
        if (!feedbacksData) {
            console.log('❌ No feedbacks data received');
            return shopFeedbacks;
        }
        
        // Get all product IDs from this shop
        const shopProductIds = this.products.map(product => product.id);
        console.log('📋 Shop product IDs:', shopProductIds);
        
        if (shopProductIds.length === 0) {
            console.log('❌ No products found for this shop, cannot match feedbacks');
            return shopFeedbacks;
        }
        
        // Iterate through all customer feedbacks
        Object.entries(feedbacksData).forEach(([customerId, customerFeedbacks]) => {
            console.log(`🔍 Checking feedbacks from customer ${customerId}:`, customerFeedbacks);
            
            if (customerFeedbacks && typeof customerFeedbacks === 'object') {
                Object.entries(customerFeedbacks).forEach(([orderId, orderFeedback]) => {
                    console.log(`📦 Checking order ${orderId}:`, orderFeedback);
                    
                    if (orderFeedback && typeof orderFeedback === 'object' && orderFeedback.shoeID) {
                        console.log(`🔍 Order ${orderId} has shoeID: ${orderFeedback.shoeID}`);
                        
                        // Check if this feedback is for one of this shop's products
                        if (shopProductIds.includes(orderFeedback.shoeID)) {
                            console.log(`✅ Found matching feedback for shop product: ${orderFeedback.shoeID}`);
                            
                            const feedbackWithIds = {
                                ...orderFeedback,
                                customerId: customerId,
                                orderId: orderId,
                                id: `${customerId}_${orderId}` // Unique ID for the feedback
                            };
                            shopFeedbacks.push(feedbackWithIds);
                        } else {
                            console.log(`❌ Feedback shoeID ${orderFeedback.shoeID} doesn't match any shop products`);
                        }
                    } else {
                        console.log(`❌ Order ${orderId} has invalid feedback structure`);
                    }
                });
            }
        });
        
        console.log(`📊 Total feedbacks compiled: ${shopFeedbacks.length}`);
        return shopFeedbacks;
    }

    renderProducts() {
        console.log('🎨 Rendering products grid...');
        const productsGrid = document.getElementById('productsGrid');
        
        if (this.products.length === 0) {
            console.log('📭 No products to display');
            productsGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-shoe-prints"></i>
                    <p>No products available from this shop</p>
                </div>
            `;
            return;
        }
        
        console.log(`🖼️ Rendering ${this.products.length} products`);
        
        // Apply filters and sorting
        let filteredProducts = this.applyFilters(this.products);
        filteredProducts = this.applySorting(filteredProducts);
        
        // Paginate
        const startIndex = (this.currentPage - 1) * this.productsPerPage;
        const endIndex = startIndex + this.productsPerPage;
        const productsToShow = filteredProducts.slice(0, endIndex);
        
        console.log(`📄 Showing ${productsToShow.length} products (page ${this.currentPage})`);
        
        let productsHTML = '';
        productsToShow.forEach(product => {
            productsHTML += this.createProductCard(product);
        });
        
        productsGrid.innerHTML = productsHTML;
        
        // Show/hide load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (endIndex >= filteredProducts.length) {
            console.log('⏹️ All products loaded, hiding load more button');
            loadMoreBtn.style.display = 'none';
        } else {
            console.log('🔄 More products available, showing load more button');
            loadMoreBtn.style.display = 'block';
        }
        
        // Add event listeners to product cards
        this.attachProductEventListeners();
        console.log('✅ Products grid rendered');
    }

    createProductCard(product) {
        console.log('🎨 Creating product card for:', product.shoeName);
        
        // Use the actual image structure from your product data
        const mainImage = product.defaultImage || '/images/unloadshoepic.png';
        const price = this.getProductPrice(product);
        const stockStatus = this.getStockStatus(product);
        
        // Truncate description if too long for card view
        const description = product.generalDescription || 'No description available.';
        const truncatedDescription = description.length > 120 ? 
            description.substring(0, 120) + '...' : description;
        
        return `
            <div class="product-card" data-product-id="${product.id}">
                <img src="${mainImage}" alt="${product.shoeName}" class="product-image" 
                    onerror="this.src='/images/unloadshoepic.png'">
                <button class="view-product-btn" onclick="event.stopPropagation(); shopDetails.viewShoeDetails('${product.id}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <div class="product-info">
                    <h3 class="product-name">${product.shoeName || 'Unnamed Product'}</h3>
                    <p class="product-description">${truncatedDescription}</p>
                    <div class="product-price">${price}</div>
                    <div class="product-meta">
                        <span class="category">${product.shoeType || product.shoeBrand || 'Uncategorized'}</span>
                        <span class="stock-status ${stockStatus.class}">
                            <i class="fas ${stockStatus.icon}"></i> ${stockStatus.text}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    getProductPrice(product) {
        console.log('💰 Getting product price for:', product.shoeName);
        console.log('📦 Product variants:', product.variants);
        
        // Check if product has variants with prices
        if (product.variants) {
            let lowestPrice = Infinity;
            let highestPrice = 0;
            let hasValidPrice = false;
            
            Object.entries(product.variants).forEach(([variantKey, variant]) => {
                console.log(`🔍 Checking variant ${variantKey} price:`, variant.price);
                
                // Check variant price
                if (variant.price) {
                    const price = parseFloat(variant.price);
                    if (!isNaN(price)) {
                        if (price < lowestPrice) lowestPrice = price;
                        if (price > highestPrice) highestPrice = price;
                        hasValidPrice = true;
                    }
                }
                
                // Also check sizes for individual prices
                if (variant.sizes) {
                    Object.values(variant.sizes).forEach(sizeData => {
                        if (sizeData && sizeData.price) {
                            const sizePrice = parseFloat(sizeData.price);
                            if (!isNaN(sizePrice)) {
                                if (sizePrice < lowestPrice) lowestPrice = sizePrice;
                                if (sizePrice > highestPrice) highestPrice = sizePrice;
                                hasValidPrice = true;
                            }
                        }
                    });
                }
            });
            
            if (hasValidPrice) {
                if (lowestPrice === highestPrice) {
                    return `₱${lowestPrice.toLocaleString()}`;
                } else {
                    return `₱${lowestPrice.toLocaleString()} - ₱${highestPrice.toLocaleString()}`;
                }
            }
        }
        
        // Fallback to product price or default
        if (product.price) {
            const price = parseFloat(product.price);
            if (!isNaN(price)) {
                return `₱${price.toLocaleString()}`;
            }
        }
        
        return 'Price not set';
    }

    getStockStatus(product) {
        console.log('📊 Checking stock status for:', product.shoeName);
        console.log('📦 Product variants data:', product.variants);
        
        if (!product.variants || Object.keys(product.variants).length === 0) {
            console.log('❌ No variants found for stock check');
            return { class: 'out-of-stock', icon: 'fa-times-circle', text: 'Out of Stock' };
        }
        
        let totalStock = 0;
        let hasStock = false;
        
        // Check all variants and sizes for stock
        Object.values(product.variants).forEach(variant => {
            console.log('🔍 Checking variant:', variant);
            if (variant.sizes) {
                Object.entries(variant.sizes).forEach(([sizeKey, sizeData]) => {
                    console.log(`👟 Checking size ${sizeKey}:`, sizeData);
                    
                    if (typeof sizeData === 'object' && sizeData !== null) {
                        // Handle nested size structure (like size_10: {10: {stock: 448}})
                        Object.values(sizeData).forEach(nestedSize => {
                            if (nestedSize && typeof nestedSize === 'object') {
                                if (nestedSize.stock !== undefined) {
                                    const stock = parseInt(nestedSize.stock) || 0;
                                    totalStock += stock;
                                    if (stock > 0) hasStock = true;
                                    console.log(`📦 Found stock: ${stock} for size`);
                                }
                            }
                        });
                    }
                });
            }
        });
        
        console.log(`📦 Total stock found: ${totalStock}, Has stock: ${hasStock}`);
        
        if (hasStock) {
            return { class: 'in-stock', icon: 'fa-check-circle', text: 'In Stock' };
        } else {
            return { class: 'out-of-stock', icon: 'fa-times-circle', text: 'Out of Stock' };
        }
    }

    applyFilters(products) {
        let filtered = [...products];
        
        // Category filter
        if (this.currentFilters.category !== 'all') {
            filtered = filtered.filter(product => {
                const productCategory = (product.shoeType || product.shoeBrand || '').toLowerCase();
                return productCategory === this.currentFilters.category;
            });
        }
        
        return filtered;
    }

    applySorting(products) {
        const sorted = [...products];
        
        switch (this.currentFilters.sort) {
            case 'price-low':
                return sorted.sort((a, b) => {
                    const priceA = this.getLowestPrice(a) || 0;
                    const priceB = this.getLowestPrice(b) || 0;
                    return priceA - priceB;
                });
            case 'price-high':
                return sorted.sort((a, b) => {
                    const priceA = this.getHighestPrice(a) || 0;
                    const priceB = this.getHighestPrice(b) || 0;
                    return priceB - priceA;
                });
            case 'name':
                return sorted.sort((a, b) => (a.shoeName || '').localeCompare(b.shoeName || ''));
            case 'newest':
            default:
                return sorted.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
        }
    }

    getLowestPrice(product) {
        if (!product.variants) return parseFloat(product.price) || 0;
        
        let lowestPrice = Infinity;
        Object.values(product.variants).forEach(variant => {
            if (variant.price) {
                const price = parseFloat(variant.price);
                if (price < lowestPrice) lowestPrice = price;
            }
        });
        
        return lowestPrice !== Infinity ? lowestPrice : parseFloat(product.price) || 0;
    }

    getHighestPrice(product) {
        if (!product.variants) return parseFloat(product.price) || 0;
        
        let highestPrice = 0;
        Object.values(product.variants).forEach(variant => {
            if (variant.price) {
                const price = parseFloat(variant.price);
                if (price > highestPrice) highestPrice = price;
            }
        });
        
        return highestPrice;
    }

    attachProductEventListeners() {
        console.log('🎯 Attaching product event listeners...');
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if view button was clicked
                if (!e.target.closest('.view-product-btn')) {
                    const productId = card.dataset.productId;
                    console.log('🖱️ Product card clicked:', productId);
                    this.viewShoeDetails(productId);
                }
            });
        });
    }

    // NEW METHOD: Redirect to shoe details page
    viewShoeDetails(productId) {
        console.log('👟 Redirecting to shoe details for:', productId);
        
        // Construct the URL with both shoeID and shopID parameters
        const shoeDetailsUrl = `/customer/html/shoedetails.html?shoeID=${productId}&shopID=${this.shopId}`;
        console.log('🔗 Redirecting to:', shoeDetailsUrl);
        
        // Redirect to the shoe details page
        window.location.href = shoeDetailsUrl;
    }

    async showProductModal(productId) {
        console.log('🪟 Opening product modal for:', productId);
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            console.log('❌ Product not found:', productId);
            return;
        }
        
        console.log('📦 Product details for modal:', product);
        
        const modalBody = document.getElementById('modalBody');
        const mainImage = product.defaultImage || '/images/unloadshoepic.png';
        
        // Get additional images if available
        const additionalImages = product.images ? Object.values(product.images) : [];
        const allImages = [mainImage, ...additionalImages].filter(img => img !== mainImage);
        
        modalBody.innerHTML = `
            <div class="modal-product">
                <div class="product-gallery">
                    <img src="${mainImage}" alt="${product.shoeName}" class="main-image"
                        onerror="this.src='/images/unloadshoepic.png'">
                    ${allImages.length > 0 ? `
                        <div class="image-thumbnails">
                            ${allImages.map((img, index) => `
                                <img src="${img}" alt="Thumbnail ${index + 1}" class="thumbnail ${index === 0 ? 'active' : ''}"
                                    onerror="this.src='/images/unloadshoepic.png'"
                                    onclick="shopDetails.changeMainImage('${img}')">
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="product-details">
                    <h2>${product.shoeName}</h2>
                    ${product.shoeType ? `<span class="product-category">${product.shoeType}</span>` : ''}
                    ${product.shoeBrand ? `<p class="product-brand"><strong>Brand:</strong> ${product.shoeBrand}</p>` : ''}
                    ${product.shoeGender ? `<p class="product-gender"><strong>Gender:</strong> ${product.shoeGender}</p>` : ''}
                    ${product.shoeCode ? `<p class="product-code"><strong>Product Code:</strong> ${product.shoeCode}</p>` : ''}
                    
                    <div class="product-price">${this.getProductPrice(product)}</div>
                    
                    ${product.generalDescription ? `
                        <div class="product-description">
                            <strong>Description:</strong><br>${product.generalDescription}
                        </div>
                    ` : ''}
                    
                    ${this.renderProductVariants(product)}
                    
                    <div class="product-actions">
                        <button class="view-details-btn" onclick="shopDetails.viewShoeDetails('${product.id}')">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('productModal').style.display = 'block';
        console.log('✅ Product modal opened');
    }

    // Method to change main image when thumbnail is clicked
    changeMainImage(imageUrl) {
        const mainImage = document.querySelector('.main-image');
        const thumbnails = document.querySelectorAll('.thumbnail');
        
        if (mainImage) {
            mainImage.src = imageUrl;
        }
        
        // Update active thumbnail
        thumbnails.forEach(thumb => {
            thumb.classList.remove('active');
            if (thumb.src === imageUrl) {
                thumb.classList.add('active');
            }
        });
    }

    renderProductVariants(product) {
        console.log('🔄 Rendering product variants for:', product.shoeName);
        console.log('📦 Product variants data:', product.variants);
        
        // Check if variants exist and have the correct structure
        if (!product.variants || Object.keys(product.variants).length === 0) {
            console.log('❌ No variants found or empty variants object');
            return '<p class="no-variants">No variants available</p>';
        }
        
        let variantsHTML = '<div class="product-variants"><h4>Available Variants</h4>';
        
        // Loop through each variant (variant0, variant1, etc.)
        Object.entries(product.variants).forEach(([variantKey, variant]) => {
            console.log(`🔍 Processing variant ${variantKey}:`, variant);
            
            // Extract variant details - handle different possible field names
            const color = variant.color || variant.colorName || 'Default Color';
            const material = variant.material || variant.materialType || 'Default Material';
            const price = variant.price ? `₱${parseFloat(variant.price).toLocaleString()}` : 'Price not set';
            const variantImage = variant.imageUrl || variant.colorImage || product.defaultImage;
            
            variantsHTML += `
                <div class="variant-section">
                    <div class="variant-header">
                        <div class="variant-image">
                            <img src="${variantImage}" alt="${color}" 
                                onerror="this.src='${product.defaultImage || '/images/unloadshoepic.png'}'">
                        </div>
                        <div class="variant-details">
                            <h5>${color} - ${material}</h5>
                            <div class="variant-price">${price}</div>
                        </div>
                    </div>
                    <div class="size-grid">
                        ${this.renderSizeOptions(variant.sizes, variantKey)}
                    </div>
                </div>
            `;
        });
        
        variantsHTML += '</div>';
        console.log('✅ Variants HTML generated');
        return variantsHTML;
    }

    renderSizeOptions(sizes, variantKey) {
        console.log(`📏 Rendering size options for variant ${variantKey}:`, sizes);
        
        if (!sizes || Object.keys(sizes).length === 0) {
            return '<p class="no-sizes">No sizes available for this variant</p>';
        }
        
        let sizesHTML = '';
        
        Object.entries(sizes).forEach(([sizeKey, sizeData]) => {
            console.log(`👟 Processing size ${sizeKey}:`, sizeData);
            
            // Extract size number from key (size_10 -> 10)
            const sizeNumber = sizeKey.replace('size_', '');
            
            // Handle the nested size data structure
            let stock = 0;
            let sizePrice = null;
            
            if (typeof sizeData === 'object' && sizeData !== null) {
                // Handle nested structure: size_10: {10: {stock: 448, ...}}
                Object.values(sizeData).forEach(nestedSize => {
                    if (nestedSize && typeof nestedSize === 'object') {
                        if (nestedSize.stock !== undefined) {
                            stock = parseInt(nestedSize.stock) || 0;
                        }
                        if (nestedSize.price !== undefined) {
                            sizePrice = parseFloat(nestedSize.price);
                        }
                    }
                });
            }
            
            const isAvailable = stock > 0;
            const priceDisplay = sizePrice ? ` - ₱${sizePrice.toLocaleString()}` : '';
            
            sizesHTML += `
                <label class="size-option ${!isAvailable ? 'out-of-stock' : ''}">
                    <input type="radio" name="size_${variantKey}" value="${sizeNumber}" ${!isAvailable ? 'disabled' : ''}>
                    <span class="size-label">Size ${sizeNumber}</span>
                    <span class="size-details">
                        ${!isAvailable ? 
                            '<span class="stock-label out-of-stock">Out of stock</span>' : 
                            `<span class="stock-label in-stock">${stock} available${priceDisplay}</span>`
                        }
                    </span>
                </label>
            `;
        });
        
        console.log(`✅ Generated ${Object.keys(sizes).length} size options`);
        return sizesHTML;
    }

    renderSampleReviews() {
        console.log('🎨 Rendering sample reviews...');
        const sampleReviews = [
            {
                reviewer: 'Satisfied Customer',
                rating: 5,
                comment: 'Great quality products and excellent service from this shop!',
                date: '2024-01-15',
                timestamp: new Date('2024-01-15').getTime()
            },
            {
                reviewer: 'Happy Shopper',
                rating: 4,
                comment: 'Good variety of shoes and fast delivery. Would recommend!',
                date: '2024-01-10',
                timestamp: new Date('2024-01-10').getTime()
            }
        ];
        
        // Update total reviews for sample data
        document.getElementById('totalReviews').textContent = `${sampleReviews.length} Reviews`;
        
        // For sample reviews, use the average of sample ratings
        const sampleAverageRating = sampleReviews.reduce((sum, review) => sum + review.rating, 0) / sampleReviews.length;
        this.updateShopRatingWithValue(sampleAverageRating);
        this.renderReviews(sampleReviews);
    }

    // Helper method for sample reviews
    updateShopRatingWithValue(rating) {
        console.log('⭐ Updating shop rating with value:', rating);
        
        // Update the shop rating in the header
        const shopRatingElement = document.getElementById('shopRating');
        if (shopRatingElement) {
            shopRatingElement.innerHTML = `<i class="fas fa-star"></i> ${rating.toFixed(1)}`;
        }
        
        // Update the reviews summary
        document.getElementById('averageRating').textContent = rating.toFixed(1);
        this.updateReviewSummaryStars(rating);
    }

    renderReviews(feedbacks) {
        console.log('🎨 Rendering reviews from feedbacks...');
        const reviewsList = document.getElementById('reviewsList');
        
        // Update total reviews count
        document.getElementById('totalReviews').textContent = `${feedbacks.length} Review${feedbacks.length !== 1 ? 's' : ''}`;

        if (feedbacks.length === 0) {
            reviewsList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-comment"></i>
                    <p>No reviews yet</p>
                    <p class="no-reviews-subtitle">Be the first to review this shop!</p>
                </div>
            `;
            
            document.getElementById('averageRating').textContent = '0.0';
            document.getElementById('totalReviews').textContent = '0 Reviews';
            
            // Update stars for 0 rating
            this.updateReviewSummaryStars(0);
            return;
        }
        
        // Sort feedbacks by timestamp (newest first)
        const sortedFeedbacks = feedbacks.sort((a, b) => {
            const timestampA = a.timestamp || a.lastUpdated || 0;
            const timestampB = b.timestamp || b.lastUpdated || 0;
            return timestampB - timestampA;
        });
        
        let reviewsHTML = '';
        sortedFeedbacks.forEach(feedback => {
            // Get product details for this feedback
            const product = this.products.find(p => p.id === feedback.shoeID);
            const productName = product ? product.shoeName : 'Unknown Product';
            
            // Get real customer name from customers data
            const customerName = this.getCustomerDisplayName(feedback.customerId);
            const rating = feedback.rating || 5;
            const comment = feedback.comment || 'No comment provided.';
            const reviewDate = feedback.timestamp ? 
                new Date(feedback.timestamp).toLocaleDateString() :
                feedback.lastUpdated ? 
                new Date(feedback.lastUpdated).toLocaleDateString() :
                'Recent';
            
            reviewsHTML += `
                <div class="review-card">
                    <div class="review-header">
                        <div class="reviewer-info">
                            <h4>${customerName}</h4>
                            <div class="review-date">${reviewDate}</div>
                            ${product ? `<div class="reviewed-product">Reviewed: ${productName}</div>` : ''}
                        </div>
                        <div class="review-rating">
                            ${this.renderStars(rating)}
                            <span class="rating-number">${rating}.0</span>
                        </div>
                    </div>
                    <div class="review-text">
                        ${comment}
                    </div>
                    ${feedback.orderId ? `
                        <div class="review-meta">
                            <span class="order-id">Order: ${feedback.orderId}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        reviewsList.innerHTML = reviewsHTML;
        
        // Update shop rating and stars
        this.updateShopRating();
        
        console.log(`✅ Reviews rendered from ${feedbacks.length} feedbacks`);
    }

    updateShopRating() {
        console.log('⭐ Updating shop rating...');
        
        if (this.feedbacks.length === 0) {
            console.log('📭 No feedbacks available for rating calculation');
            // Update total reviews to 0
            document.getElementById('totalReviews').textContent = '0 Reviews';
            return;
        }
        
        // Calculate average rating from feedbacks
        const averageRating = this.feedbacks.reduce((sum, feedback) => {
            return sum + (feedback.rating || 5);
        }, 0) / this.feedbacks.length;
        
        console.log(`📊 Calculated average rating: ${averageRating.toFixed(1)} from ${this.feedbacks.length} reviews`);
        
        // Update the shop rating in the header
        const shopRatingElement = document.getElementById('shopRating');
        if (shopRatingElement) {
            shopRatingElement.innerHTML = `<i class="fas fa-star"></i> ${averageRating.toFixed(1)}`;
            console.log('✅ Shop rating updated in header');
        }
        
        // Update the reviews summary rating number
        document.getElementById('averageRating').textContent = averageRating.toFixed(1);
        
        // Update the total reviews count - ADD THIS
        document.getElementById('totalReviews').textContent = `${this.feedbacks.length} Review${this.feedbacks.length !== 1 ? 's' : ''}`;
        
        // Update the stars in reviews summary
        this.updateReviewSummaryStars(averageRating);
    }

    updateReviewSummaryStars(averageRating) {
        console.log('⭐ Updating review summary stars with rating:', averageRating);
        const starsContainer = document.querySelector('.reviews-summary .stars');
        if (starsContainer) {
            starsContainer.innerHTML = this.renderStars(averageRating);
            console.log('✅ Review summary stars updated');
        }
    }

    // Enhanced renderStars method to handle decimal ratings properly
    renderStars(rating) {
        let stars = '';
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        // Add full stars
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star"></i>';
        }
        
        // Add half star if needed
        if (hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        }
        
        // Add empty stars
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star"></i>';
        }
        
        return stars;
    }

    getCustomerDisplayName(customerId) {
        // Get customer data from loaded customers
        if (this.customers && this.customers[customerId]) {
            const customer = this.customers[customerId];
            const firstName = customer.firstName || '';
            const lastName = customer.lastName || '';
            
            if (firstName || lastName) {
                return `${firstName} ${lastName}`.trim();
            }
        }
        
        // Fallback to generic name if customer data not found
        return `Customer ${customerId.substring(0, 8)}...`;
    }

    setupEventListeners() {
        console.log('🎯 Setting up event listeners...');
        
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('📑 Tab clicked:', e.target.dataset.tab);
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Filter controls
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            console.log('🔧 Category filter changed:', e.target.value);
            this.currentFilters.category = e.target.value;
            this.currentPage = 1;
            this.renderProducts();
        });
        
        document.getElementById('sortFilter').addEventListener('change', (e) => {
            console.log('🔧 Sort filter changed:', e.target.value);
            this.currentFilters.sort = e.target.value;
            this.renderProducts();
        });
        
        // Load more products
        document.getElementById('loadMoreBtn').addEventListener('click', () => {
            console.log('🔄 Load more button clicked');
            this.currentPage++;
            this.renderProducts();
        });
        
        // Get directions button
        document.getElementById('getDirections').addEventListener('click', () => {
            console.log('🗺️ Get directions button clicked');
            this.getDirections();
        });
        
        // Modal close
        document.querySelector('.close-modal').addEventListener('click', () => {
            console.log('❌ Modal close button clicked');
            document.getElementById('productModal').style.display = 'none';
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('productModal');
            if (e.target === modal) {
                console.log('🎯 Modal closed by clicking outside');
                modal.style.display = 'none';
            }
        });
        
        console.log('✅ Event listeners set up');
    }

    switchTab(tabName) {
        console.log('🔄 Switching to tab:', tabName);
        
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Show active tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Load tab-specific data if needed
        if (tabName === 'location') {
            // Ensure map is properly sized
            setTimeout(() => {
                console.log('🗺️ Resizing map for location tab');
                if (this.map) {
                    google.maps.event.trigger(this.map, 'resize');
                    // Re-center the map if we have coordinates
                    if (this.marker) {
                        this.map.setCenter(this.marker.getPosition());
                    }
                }
            }, 100);
        }
    }

    showLoading() {
        console.log('⏳ Showing loading overlay');
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        console.log('✅ Hiding loading overlay');
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showError(message) {
        console.error('❌ Showing error:', message);
        alert(message);
    }

    showProductsError() {
        console.error('❌ Showing products error');
        const productsGrid = document.getElementById('productsGrid');
        productsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load products. Please try again later.</p>
            </div>
        `;
    }
}

// Initialize the shop details page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏪 DOM loaded, initializing ShopDetailsPage...');
    window.shopDetails = new ShopDetailsPage();
});

// Export for potential use in other modules
export default ShopDetailsPage;