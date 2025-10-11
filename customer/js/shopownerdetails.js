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
            
            this.renderShopHeader();
            this.renderAboutSection();
            this.renderDocumentsSection();
            this.renderLocationSection();
            
            // Load products
            await this.loadProducts();
            
            // Load reviews
            await this.loadReviews();
            
        } catch (error) {
            console.error('❌ Error loading shop data:', error);
            this.showError('Failed to load shop details. Please try again.');
        } finally {
            this.hideLoading();
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
        document.getElementById('customerCount').textContent = '0'; // You can add this field later
        
        console.log('📊 Shop stats - Years in business:', shop.yearsInBusiness);
        
        // Update contact info using your actual data structure
        if (shop.ownerPhone) document.getElementById('shopPhone').textContent = shop.ownerPhone;
        if (shop.email) document.getElementById('shopEmail').textContent = shop.email;
        // Business hours and website might not exist yet - you can add these fields
        document.getElementById('businessHours').textContent = '9:00 AM - 6:00 PM'; // Default
        document.getElementById('shopWebsite').textContent = 'Not provided'; // Default
        
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
            'ownerIdBack': "Owner's ID (Back)"
        };
        
        Object.entries(shop.uploads).forEach(([docType, doc]) => {
            if (documentTypes[docType]) {
                console.log(`📋 Document ${docType}:`, doc);
                documentsHTML += `
                    <div class="document-card">
                        <h4>${documentTypes[docType]}</h4>
                        <p>File: ${doc.name || 'Document'}</p>
                        <p>Uploaded: ${new Date(doc.uploadedAt).toLocaleDateString()}</p>
                        <button class="view-document" onclick="shopDetails.viewDocument('${docType}')">
                            View Document
                        </button>
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

    renderLocationSection() {
        console.log('📍 Rendering location section...');
        const shop = this.shopData;
        
        // Update address using your actual data structure
        document.getElementById('shopAddress').textContent = shop.shopAddress || 'Address not provided';
        document.getElementById('shopCity').textContent = shop.shopCity || '-';
        document.getElementById('shopProvince').textContent = shop.shopState || '-';
        document.getElementById('shopZip').textContent = shop.shopZip || '-';
        
        console.log('🗺️ Shop location:', shop.shopAddress, shop.shopCity, shop.shopState, shop.shopZip);
        
        // For now, we'll use a default location since coordinates don't exist
        // You can add latitude/longitude fields to your database later
        const defaultLat = 14.5995; // Philippines default
        const defaultLng = 120.9842;
        this.updateMap(defaultLat, defaultLng);
        
        console.log('✅ Location section rendered');
    }

    initializeMap() {
        console.log('🗺️ Initializing Google Map...');
        try {
            this.map = new google.maps.Map(document.getElementById('shopMap'), {
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
        } catch (error) {
            console.error('❌ Error initializing Google Map:', error);
        }
    }

    updateMap(lat, lng) {
        console.log('📍 Updating map with coordinates:', lat, lng);
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
            title: this.shopData.shopName || 'Shop Location'
        });
        
        console.log('📍 Map marker added at:', position);
        
        // Add info window
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="padding: 1rem;">
                    <h3 style="margin: 0 0 0.5rem 0;">${this.shopData.shopName}</h3>
                    <p style="margin: 0;">${this.shopData.shopAddress}</p>
                </div>
            `
        });
        
        this.marker.addListener('click', () => {
            infoWindow.open(this.map, this.marker);
        });
    }

    async loadProducts() {
        console.log('👟 Loading shop products...');
        try {
            const productsPath = `smartfit_AR_Database/shoe/${this.shopId}`;
            console.log('📡 Fetching products from path:', productsPath);
            
            const productsResult = await displayProducts(productsPath);
            console.log('📦 Products result:', productsResult);
            
            if (productsResult.success) {
                this.products = productsResult.data || [];
                console.log(`✅ Loaded ${this.products.length} products:`, this.products);
                
                // Update the total products count in about section
                document.getElementById('totalProducts').textContent = this.products.length;
                
                this.renderProducts();
            } else {
                console.error('❌ Error loading products:', productsResult.error);
                throw new Error(productsResult.error);
            }
        } catch (error) {
            console.error('❌ Error loading products:', error);
            this.showProductsError();
        }
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
        const price = product.price ? `₱${parseFloat(product.price).toLocaleString()}` : 'Price not set';
        const stockStatus = this.getStockStatus(product);
        
        return `
            <div class="product-card" data-product-id="${product.id}">
                <img src="${mainImage}" alt="${product.shoeName}" class="product-image" 
                    onerror="this.src='/images/unloadshoepic.png'">
                <div class="product-info">
                    <h3 class="product-name">${product.shoeName || 'Unnamed Product'}</h3>
                    <p class="product-description">${product.generalDescription || 'No description available.'}</p>
                    <div class="product-price">${price}</div>
                    <div class="product-meta">
                        <span class="category">${product.shoeType || 'Uncategorized'}</span>
                        <span class="stock-status ${stockStatus.class}">
                            <i class="fas ${stockStatus.icon}"></i> ${stockStatus.text}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    getStockStatus(product) {
        if (!product.variants) {
            return { class: 'out-of-stock', icon: 'fa-times-circle', text: 'Out of Stock' };
        }
        
        // Check if any variant has stock
        const hasStock = Object.values(product.variants).some(variant => {
            return variant.sizes && Object.values(variant.sizes).some(size => size.stock > 0);
        });
        
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
            filtered = filtered.filter(product => 
                product.shoeType?.toLowerCase() === this.currentFilters.category
            );
        }
        
        return filtered;
    }

    applySorting(products) {
        const sorted = [...products];
        
        switch (this.currentFilters.sort) {
            case 'price-low':
                return sorted.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
            case 'price-high':
                return sorted.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
            case 'name':
                return sorted.sort((a, b) => (a.shoeName || '').localeCompare(b.shoeName || ''));
            case 'newest':
            default:
                return sorted.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
        }
    }

    attachProductEventListeners() {
        console.log('🎯 Attaching product event listeners...');
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const productId = card.dataset.productId;
                console.log('🖱️ Product card clicked:', productId);
                this.showProductModal(productId);
            });
        });
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
        
        modalBody.innerHTML = `
            <div class="modal-product">
                <div class="product-gallery">
                    <img src="${mainImage}" alt="${product.shoeName}" class="main-image"
                         onerror="this.src='/images/unloadshoepic.png'">
                </div>
                <div class="product-details">
                    <h2>${product.shoeName}</h2>
                    <p class="product-category">${product.shoeType || 'Uncategorized'}</p>
                    <p class="product-description">${product.generalDescription || 'No description available.'}</p>
                    <div class="product-price">₱${parseFloat(product.price || 0).toLocaleString()}</div>
                    <div class="product-code">Product Code: ${product.shoeCode || 'N/A'}</div>
                    
                    ${this.renderProductVariants(product)}
                    
                    <div class="product-actions">
                        <button class="add-to-cart-btn" onclick="shopDetails.addToCartModal('${product.id}')">
                            <i class="fas fa-shopping-cart"></i> Add to Cart
                        </button>
                        <button class="wishlist-btn" onclick="shopDetails.addToWishlist('${product.id}')">
                            <i class="fas fa-heart"></i> Add to Wishlist
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('productModal').style.display = 'block';
        console.log('✅ Product modal opened');
    }

    renderProductVariants(product) {
        if (!product.variants || Object.keys(product.variants).length === 0) {
            return '<p class="no-variants">No variants available</p>';
        }
        
        let variantsHTML = '<div class="product-variants"><h4>Available Variants</h4>';
        
        Object.entries(product.variants).forEach(([variantKey, variant]) => {
            variantsHTML += `
                <div class="variant-section">
                    <h5>${variant.color || 'Color'} - ${variant.material || 'Material'}</h5>
                    <div class="size-grid">
                        ${this.renderSizeOptions(variant.sizes)}
                    </div>
                </div>
            `;
        });
        
        variantsHTML += '</div>';
        return variantsHTML;
    }

    renderSizeOptions(sizes) {
        if (!sizes) return '<p>No sizes available</p>';
        
        let sizesHTML = '';
        Object.entries(sizes).forEach(([sizeKey, sizeData]) => {
            const size = sizeKey.replace('size_', '');
            const isAvailable = sizeData.stock > 0;
            
            sizesHTML += `
                <label class="size-option ${!isAvailable ? 'out-of-stock' : ''}">
                    <input type="radio" name="size" value="${size}" ${!isAvailable ? 'disabled' : ''}>
                    <span class="size-label">${size}</span>
                    ${!isAvailable ? '<span class="stock-label">Out of stock</span>' : ''}
                </label>
            `;
        });
        
        return sizesHTML;
    }

    // Placeholder methods for cart and wishlist functionality
    addToCartModal(productId) {
        console.log('🛒 Add to cart clicked for product:', productId);
        alert('Add to cart functionality will be implemented soon!');
    }

    addToWishlist(productId) {
        console.log('❤️ Add to wishlist clicked for product:', productId);
        alert('Add to wishlist functionality will be implemented soon!');
    }

    async loadReviews() {
        console.log('💬 Loading reviews...');
        // For now, we'll use mock data since reviews might not exist in your database
        const reviews = [
            {
                reviewer: 'Satisfied Customer',
                rating: 5,
                comment: 'Great quality products and excellent service from this shop!',
                date: '2024-01-15'
            },
            {
                reviewer: 'Happy Shopper',
                rating: 4,
                comment: 'Good variety of shoes and fast delivery. Would recommend!',
                date: '2024-01-10'
            }
        ];
        
        console.log('📝 Reviews loaded:', reviews);
        this.renderReviews(reviews);
    }

    renderReviews(reviews) {
        console.log('🎨 Rendering reviews...');
        const reviewsList = document.getElementById('reviewsList');
        
        if (reviews.length === 0) {
            reviewsList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-comment"></i>
                    <p>No reviews yet</p>
                </div>
            `;
            return;
        }
        
        let reviewsHTML = '';
        reviews.forEach(review => {
            reviewsHTML += `
                <div class="review-card">
                    <div class="review-header">
                        <div class="reviewer-info">
                            <h4>${review.reviewer}</h4>
                            <div class="review-date">${new Date(review.date).toLocaleDateString()}</div>
                        </div>
                        <div class="review-rating">
                            ${this.renderStars(review.rating)}
                        </div>
                    </div>
                    <div class="review-text">
                        ${review.comment}
                    </div>
                </div>
            `;
        });
        
        reviewsList.innerHTML = reviewsHTML;
        
        // Update summary
        const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
        document.getElementById('averageRating').textContent = averageRating.toFixed(1);
        document.getElementById('totalReviews').textContent = `${reviews.length} Reviews`;
        
        console.log('✅ Reviews rendered');
    }

    renderStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i - 0.5 <= rating) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
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
                }
            }, 100);
        }
    }

    getDirections() {
        // For now, use a default location since coordinates don't exist
        const defaultLat = 14.5995;
        const defaultLng = 120.9842;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${defaultLat},${defaultLng}`;
        console.log('🗺️ Opening directions URL:', url);
        window.open(url, '_blank');
    }

    viewDocument(docType) {
        console.log('📄 View document clicked:', docType);
        const doc = this.shopData.uploads && this.shopData.uploads[docType];
        if (doc && doc.url) {
            console.log('📄 Opening document URL:', doc.url);
            window.open(doc.url, '_blank');
        } else {
            console.log('❌ Document URL not available');
            alert('Document not available for viewing.');
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