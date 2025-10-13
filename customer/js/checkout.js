import { 
    checkUserAuth, 
    logoutUser,
    readData,
    updateData,
    createData,
    deleteData
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Global variables
let userData = null;
let userId = null;
let shippingConfig = null;
let currentShippingFee = 0;

// Initialize the page
async function initializeCheckout() {
    const authStatus = await checkUserAuth();
    
    if (authStatus.authenticated && authStatus.role === 'shopowner') {
        console.log(`User is ${authStatus.role}`, authStatus.userData);
        window.location.href = "../../shopowner/html/shop_dashboard.html";
        return;
    } else if (authStatus.authenticated && authStatus.role === 'customer') {
        console.log(`User is ${authStatus.role}`, authStatus.userData);
        userData = authStatus.userData;
        userId = authStatus.userId;
    } else {
        window.location.href = "/login.html";
        return;
    }

    // Load shipping configuration
    await loadShippingConfig();

    // Debug coordinates
    await debugCoordinates();
    
    // Load user profile
    loadUserProfile();
    
    // Load order summary
    await loadOrderSummary();
    
    // Calculate and display shipping fee
    await calculateAndDisplayShippingFee();
    
    // Set up event listeners
    setupEventListeners();

    document.body.style.display = '';
}

// Load shipping configuration and shop location from Firebase
async function loadShippingConfig() {
    try {
        // First, get the shipping configuration
        const configResult = await readData('smartfit_AR_Database/shipping_config/default');
        
        if (configResult.success && configResult.data) {
            shippingConfig = configResult.data;
            console.log('Shipping config loaded:', shippingConfig);
        } else {
            // Fallback configuration if not found in database
            shippingConfig = {
                baseFee: 50,
                perKmRate: 2,
                weightConfig: {
                    shoeWeight: 0.5,
                    perKgRate: 10,
                    maxStandardWeight: 5
                },
                serviceFee: 20,
                maxDistance: 100,
                multiShopConfig: {
                    additionalShopFee: 30,
                    maxAdditionalShops: 10
                }
            };
            console.warn('Using fallback shipping configuration');
        }

        // Now get the shop location from the shop owner's data
        await loadShopLocation();
        
    } catch (error) {
        console.error('Error loading shipping config:', error);
        // Use fallback configuration
        shippingConfig = {
            baseFee: 50,
            perKmRate: 2,
            weightConfig: {
                shoeWeight: 0.5,
                perKgRate: 10,
                maxStandardWeight: 5
            },
            serviceFee: 20,
            maxDistance: 100
        };
        await loadShopLocation(); // Still try to load shop location
    }
}

// Load shop location from shop owner data
async function loadShopLocation() {
    try {
        // Get all shops and use the first one found as the main shop location
        const shopsResult = await readData('smartfit_AR_Database/shop');
        
        if (shopsResult.success && shopsResult.data) {
            const shops = Object.values(shopsResult.data);
            console.log('Found shops:', shops);
            
            // Find the first shop with valid coordinates
            const shopWithCoords = shops.find(shop => {
                const lat = parseFloat(shop.latitude);
                const lng = parseFloat(shop.longitude);
                return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
            });
            
            if (shopWithCoords) {
                const lat = parseFloat(shopWithCoords.latitude);
                const lng = parseFloat(shopWithCoords.longitude);
                
                shippingConfig.shopLocation = {
                    latitude: lat,
                    longitude: lng,
                    shopName: shopWithCoords.shopName || 'Main Shop',
                    shopId: shopWithCoords.shopId || Object.keys(shopsResult.data)[0]
                };
                console.log('Shop location loaded:', shippingConfig.shopLocation);
            } else {
                // Fallback to default Bataan coordinates
                shippingConfig.shopLocation = {
                    latitude: 14.677350,
                    longitude: 120.530303,
                    shopName: 'Default Bataan Location',
                    shopId: 'default'
                };
                console.warn('No shop with valid coordinates found, using default location');
            }
        } else {
            // Fallback to default Bataan coordinates
            shippingConfig.shopLocation = {
                latitude: 14.677350,
                longitude: 120.530303,
                shopName: 'Default Bataan Location',
                shopId: 'default'
            };
            console.warn('No shops found in database, using default location');
        }
    } catch (error) {
        console.error('Error loading shop location:', error);
        // Fallback to default Bataan coordinates
        shippingConfig.shopLocation = {
            latitude: 14.677350,
            longitude: 120.530303,
            shopName: 'Default Bataan Location',
            shopId: 'default'
        };
    }
}

async function debugCoordinates() {
    try {
        // Check customer coordinates
        const customerResult = await readData(`smartfit_AR_Database/customers/${userId}`);
        if (customerResult.success && customerResult.data) {
            const customerData = customerResult.data;
            console.log('Customer coordinates debug:', {
                rawLatitude: customerData.latitude,
                rawLongitude: customerData.longitude,
                parsedLat: parseFloat(customerData.latitude),
                parsedLng: parseFloat(customerData.longitude),
                isLatNaN: isNaN(parseFloat(customerData.latitude)),
                isLngNaN: isNaN(parseFloat(customerData.longitude))
            });
        }
        
        // Check shop coordinates
        const shopsResult = await readData('smartfit_AR_Database/shop');
        if (shopsResult.success && shopsResult.data) {
            const shops = Object.values(shopsResult.data);
            shops.forEach((shop, index) => {
                console.log(`Shop ${index} coordinates:`, {
                    shopName: shop.shopName,
                    rawLatitude: shop.latitude,
                    rawLongitude: shop.longitude,
                    parsedLat: parseFloat(shop.latitude),
                    parsedLng: parseFloat(shop.longitude),
                    isLatNaN: isNaN(parseFloat(shop.latitude)),
                    isLngNaN: isNaN(parseFloat(shop.longitude))
                });
            });
        }
    } catch (error) {
        console.error('Debug coordinates error:', error);
    }
}

// Calculate distance using Google Maps Distance Matrix API
async function calculateDistance(customerCoords, shopCoords) {
    return new Promise((resolve, reject) => {
        if (!window.google || !window.google.maps) {
            reject(new Error('Google Maps API not loaded'));
            return;
        }

        // Validate coordinates before making API call
        if (isNaN(customerCoords.lat) || isNaN(customerCoords.lng) || 
            isNaN(shopCoords.latitude) || isNaN(shopCoords.longitude)) {
            reject(new Error('Invalid coordinates provided'));
            return;
        }

        const service = new google.maps.DistanceMatrixService();
        
        const origin = new google.maps.LatLng(shopCoords.latitude, shopCoords.longitude);
        const destination = new google.maps.LatLng(customerCoords.lat, customerCoords.lng);
        
        console.log('Distance Matrix API call:', {
            origin: { lat: shopCoords.latitude, lng: shopCoords.longitude },
            destination: { lat: customerCoords.lat, lng: customerCoords.lng }
        });
        
        service.getDistanceMatrix({
            origins: [origin],
            destinations: [destination],
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC
        }, (response, status) => {
            console.log('Distance Matrix API response:', { status, response });
            
            if (status === 'OK') {
                const element = response.rows[0].elements[0];
                if (element.status === 'OK') {
                    const distanceInKm = element.distance.value / 1000; // Convert meters to kilometers
                    resolve(distanceInKm);
                } else {
                    reject(new Error('Distance calculation failed: ' + element.status));
                }
            } else {
                reject(new Error('Distance Matrix API error: ' + status));
            }
        });
    });
}

// Calculate order weight
function calculateOrderWeight(orderItems) {
    const shoeWeight = shippingConfig.weightConfig.shoeWeight;
    return orderItems.reduce((total, item) => {
        return total + (item.quantity * shoeWeight);
    }, 0);
}

// Calculate shipping fee
function calculateShippingFee(distance, weight) {
    // Validate maximum distance
    if (distance > shippingConfig.maxDistance) {
        return {
            success: false,
            error: `Delivery beyond ${shippingConfig.maxDistance}km is not available. Your distance: ${distance.toFixed(1)}km. Please contact us for special arrangements.`,
            total: 0,
            breakdown: null
        };
    }
    
    // Distance cost
    const distanceFee = distance * shippingConfig.perKmRate;
    
    // Weight surcharge (only for weight above base shoe weight)
    const baseWeight = shippingConfig.weightConfig.shoeWeight;
    const weightFee = weight > baseWeight ? 
        (weight - baseWeight) * shippingConfig.weightConfig.perKgRate : 0;
    
    const total = shippingConfig.baseFee + distanceFee + weightFee + shippingConfig.serviceFee;
    
    return {
        success: true,
        total: Math.round(total),
        distance: distance,
        weight: weight,
        breakdown: {
            baseFee: shippingConfig.baseFee,
            distanceFee: Math.round(distanceFee),
            weightFee: Math.round(weightFee),
            serviceFee: shippingConfig.serviceFee
        }
    };
}

// Calculate and display shipping fee
async function calculateAndDisplayShippingFee() {
    const shippingContainer = getElement('shippingCalculation');
    const shippingBreakdown = getElement('shippingBreakdown');
    const shippingError = getElement('shippingError');
    const shippingLoading = document.querySelector('.shipping-loading');
    
    if (!shippingContainer) return;
    
    try {
        // Show loading state, hide other states
        if (shippingLoading) shippingLoading.style.display = 'flex';
        if (shippingBreakdown) shippingBreakdown.style.display = 'none';
        if (shippingError) shippingError.style.display = 'none';
        
        // Get order items to calculate weight
        const orderItems = await getCurrentOrderItems();
        if (orderItems.length === 0) {
            if (shippingLoading) shippingLoading.style.display = 'none';
            if (shippingBreakdown) {
                shippingBreakdown.innerHTML = '<p>No items in order</p>';
                shippingBreakdown.style.display = 'block';
            }
            currentShippingFee = 0;
            return;
        }

        // Use the multi-shop shipping calculation
        const shippingResult = await calculateMultiShopShipping(orderItems);
        
        if (shippingResult.success) {
            currentShippingFee = shippingResult.totalShipping;
            // Hide loading and show breakdown
            if (shippingLoading) shippingLoading.style.display = 'none';
            displayMultiShopShippingBreakdown(shippingResult);
        } else {
            throw new Error(shippingResult.error || 'Shipping calculation failed');
        }
        
    } catch (error) {
        console.error('Shipping calculation error:', error);
        // Hide loading and show error
        if (shippingLoading) shippingLoading.style.display = 'none';
        if (shippingError) {
            shippingError.innerHTML = `
                <p><strong>Shipping Calculation Failed</strong></p>
                <p>${error.message}</p>
                <p>Using standard shipping fee calculation</p>
            `;
            shippingError.style.display = 'block';
        }
        // Fallback: calculate simple shipping
        const orderItems = await getCurrentOrderItems();
        currentShippingFee = 100 * orderItems.reduce((sum, item) => sum + item.quantity, 0);
    }
    
    // Update order summary with new shipping fee
    await updateOrderSummaryWithShipping();
}

// Batch Distance Calculation Function
async function calculateBatchDistances(customerCoords, shopLocations) {
    return new Promise((resolve, reject) => {
        if (!window.google || !window.google.maps) {
            reject(new Error('Google Maps API not loaded'));
            return;
        }

        const service = new google.maps.DistanceMatrixService();
        
        const origins = shopLocations.map(shop => 
            new google.maps.LatLng(shop.latitude, shop.longitude)
        );
        const destination = new google.maps.LatLng(customerCoords.lat, customerCoords.lng);
        
        console.log('Batch Distance Matrix API call:', {
            origins: shopLocations,
            destination: customerCoords
        });
        
        service.getDistanceMatrix({
            origins: origins,
            destinations: [destination],
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC
        }, (response, status) => {
            console.log('Batch Distance Matrix API response:', { status, response });
            
            if (status === 'OK') {
                const distances = {};
                response.rows.forEach((row, index) => {
                    const element = row.elements[0];
                    if (element.status === 'OK') {
                        const distanceInKm = element.distance.value / 1000;
                        distances[shopLocations[index].shopId] = {
                            distance: distanceInKm,
                            duration: element.duration.text,
                            shopName: shopLocations[index].shopName
                        };
                    } else {
                        distances[shopLocations[index].shopId] = {
                            error: `Distance calculation failed: ${element.status}`,
                            shopName: shopLocations[index].shopName
                        };
                    }
                });
                resolve(distances);
            } else {
                reject(new Error('Batch Distance Matrix API error: ' + status));
            }
        });
    });
}

// Display shipping breakdown
function displayShippingBreakdown(shippingResult, distance, weight, customerCoords) {
    const shippingBreakdown = getElement('shippingBreakdown');
    const shippingLoading = document.querySelector('.shipping-loading');
    
    if (!shippingBreakdown) return;
    
    const { breakdown, total } = shippingResult;
    
    shippingBreakdown.innerHTML = `
        <div class="coverage-info">
            <i class="fas fa-truck"></i>
            We deliver within ${shippingConfig.maxDistance}km of ${shippingConfig.shopLocation.shopName}
        </div>
        <div class="location-info">
            <div class="location-row">
                <strong><i class="fas fa-store"></i> Shop Location:</strong>
                <span>${shippingConfig.shopLocation.shopName} (${shippingConfig.shopLocation.latitude.toFixed(6)}, ${shippingConfig.shopLocation.longitude.toFixed(6)})</span>
            </div>
            <div class="location-row">
                <strong><i class="fas fa-home"></i> Your Location:</strong>
                <span>${customerCoords.address}, ${customerCoords.city} (${customerCoords.lat.toFixed(6)}, ${customerCoords.lng.toFixed(6)})</span>
            </div>
        </div>
        <div class="distance-info">
            <i class="fas fa-route"></i>
            Delivery distance: ${distance.toFixed(1)} km | Order weight: ${weight.toFixed(1)} kg
        </div>
        <div class="shipping-breakdown">
            <h4>Shipping Fee Breakdown</h4>
            <div class="breakdown-item">
                <span>Base fee:</span>
                <span>₱${breakdown.baseFee.toFixed(2)}</span>
            </div>
            <div class="breakdown-item">
                <span>Distance (${distance.toFixed(1)} km × ₱${shippingConfig.perKmRate}/km):</span>
                <span>₱${breakdown.distanceFee.toFixed(2)}</span>
            </div>
            <div class="breakdown-item">
                <span>Weight surcharge (${weight.toFixed(1)} kg):</span>
                <span>₱${breakdown.weightFee.toFixed(2)}</span>
            </div>
            <div class="breakdown-item">
                <span>Service fee:</span>
                <span>₱${breakdown.serviceFee.toFixed(2)}</span>
            </div>
            <div class="breakdown-total">
                <span>Total Shipping:</span>
                <span>₱${total.toFixed(2)}</span>
            </div>
        </div>
    `;
    
    // Ensure loading is hidden and breakdown is shown
    if (shippingLoading) shippingLoading.style.display = 'none';
    shippingBreakdown.style.display = 'block';
}

// Get current order items for weight calculation
async function getCurrentOrderItems() {
    const urlParams = new URLSearchParams(window.location.search);
    const method = urlParams.get('method');
    
    if (method === "buyNow") {
        return await prepareBuyNowOrder(urlParams);
    } else if (method === "cartOrder") {
        return await prepareCartOrder();
    } else {
        // Regular cart flow - return full cart items
        const cartResult = await readData(`smartfit_AR_Database/carts/${userId}`);
        if (!cartResult.success || !cartResult.data) return [];
        
        const cartData = cartResult.data;
        const cartArray = Array.isArray(cartData) ? cartData : Object.values(cartData);
        
        // Return full cart items with shop information
        const fullItems = [];
        for (const cartItem of cartArray) {
            if (cartItem) {
                fullItems.push({
                    shopId: cartItem.shopId,
                    shopName: cartItem.shopName || '',
                    shoeId: cartItem.shoeId,
                    variantKey: cartItem.variantKey,
                    sizeKey: cartItem.sizeKey,
                    size: cartItem.size,
                    quantity: parseInt(cartItem.quantity) || 1,
                    price: parseFloat(cartItem.price) || 0,
                    name: cartItem.shoeName || 'Unknown Shoe',
                    variantName: cartItem.variantName || '',
                    color: cartItem.color || '',
                    imageUrl: cartItem.image || 'https://via.placeholder.com/150'
                });
            }
        }
        return fullItems;
    }
}

// Prepare cart items for shipping calculation
async function prepareCartItems(cartIds) {
    const cartResult = await readData(`smartfit_AR_Database/carts/${userId}`);
    if (!cartResult.success || !cartResult.data) return [];
    
    const cartData = cartResult.data;
    const items = [];
    
    for (const cartId of cartIds) {
        const cartItem = cartData[cartId];
        if (cartItem) {
            items.push({
                shopId: cartItem.shopId,
                shopName: cartItem.shopName || '',
                quantity: parseInt(cartItem.quantity) || 1,
                price: parseFloat(cartItem.price) || 0,
                name: cartItem.shoeName || 'Unknown Shoe'
            });
        }
    }
    
    return items;
}

// Update order summary with dynamic shipping fee
async function updateOrderSummaryWithShipping() {
    const items = await getCurrentOrderItems();
    const orderSummary = getElement('orderSummary');
    if (!orderSummary) return;
    
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.12;
    const total = subtotal + tax + currentShippingFee;

    orderSummary.innerHTML = `
        <div class="order-summary-item">
            <span>Subtotal</span>
            <span>₱${subtotal.toFixed(2)}</span>
        </div>
        <div class="order-summary-item">
            <span>Tax (12% VAT)</span>
            <span>₱${tax.toFixed(2)}</span>
        </div>
        <div class="order-summary-item">
            <span>Shipping</span>
            <span>₱${currentShippingFee.toFixed(2)}</span>
        </div>
        <div class="order-summary-item order-total">
            <span>Total</span>
            <span>₱${total.toFixed(2)}</span>
        </div>
    `;
}

async function calculateMultiShopShipping(orderItems) {
    try {
        // Group items by shop
        const itemsByShop = {};
        orderItems.forEach(item => {
            if (!itemsByShop[item.shopId]) {
                itemsByShop[item.shopId] = {
                    shopId: item.shopId,
                    shopName: item.shopName,
                    items: [],
                    totalWeight: 0
                };
            }
            itemsByShop[item.shopId].items.push(item);
            itemsByShop[item.shopId].totalWeight += (item.quantity * shippingConfig.weightConfig.shoeWeight);
        });

        const shopIds = Object.keys(itemsByShop);
        
        // Check if number of shops exceeds maximum
        if (shopIds.length > shippingConfig.multiShopConfig.maxAdditionalShops + 1) {
            return {
                success: false,
                error: `Maximum ${shippingConfig.multiShopConfig.maxAdditionalShops} shops allowed per order. Please reduce the number of shops.`,
                shopCount: shopIds.length,
                maxShops: shippingConfig.multiShopConfig.maxAdditionalShops
            };
        }

        if (shopIds.length === 0) {
            return { success: false, error: "No items in order" };
        }

        // Get customer coordinates
        const customerResult = await readData(`smartfit_AR_Database/customers/${userId}`);
        if (!customerResult.success || !customerResult.data) {
            throw new Error('Customer data not found');
        }

        const customerData = customerResult.data;
        const customerLat = parseFloat(customerData.latitude);
        const customerLng = parseFloat(customerData.longitude);
        
        if (isNaN(customerLat) || isNaN(customerLng)) {
            throw new Error('Invalid customer coordinates');
        }

        const customerCoords = {
            lat: customerLat,
            lng: customerLng,
            address: customerData.address || 'Unknown address',
            city: customerData.city || 'Unknown city'
        };

        // Get shop locations for all shops in the order
        const shopLocations = [];
        for (const shopId of shopIds) {
            const shopResult = await readData(`smartfit_AR_Database/shop/${shopId}`);
            if (shopResult.success && shopResult.data) {
                const shopData = shopResult.data;
                const lat = parseFloat(shopData.latitude);
                const lng = parseFloat(shopData.longitude);
                
                if (!isNaN(lat) && !isNaN(lng)) {
                    shopLocations.push({
                        shopId: shopId,
                        shopName: shopData.shopName || 'Unknown Shop',
                        latitude: lat,
                        longitude: lng
                    });
                }
            }
        }

        // Calculate distances for all shops
        const distances = await calculateBatchDistances(customerCoords, shopLocations);

        // Calculate shipping for each shop
        const shopShipping = {};
        let totalShipping = 0;
        let hasOutOfRange = false;
        const outOfRangeShops = [];

        for (const shopLocation of shopLocations) {
            const shopData = itemsByShop[shopLocation.shopId];
            const distanceInfo = distances[shopLocation.shopId];
            
            if (distanceInfo.error) {
                shopShipping[shopLocation.shopId] = {
                    success: false,
                    error: distanceInfo.error,
                    shopName: shopLocation.shopName
                };
                continue;
            }

            const distance = distanceInfo.distance;
            const weight = shopData.totalWeight;
            
            // Check if shop is within delivery range
            if (distance > shippingConfig.maxDistance) {
                hasOutOfRange = true;
                outOfRangeShops.push({
                    shopName: shopLocation.shopName,
                    distance: distance,
                    maxDistance: shippingConfig.maxDistance
                });
                shopShipping[shopLocation.shopId] = {
                    success: false,
                    error: `Delivery beyond ${shippingConfig.maxDistance}km not available`,
                    distance: distance,
                    shopName: shopLocation.shopName
                };
                continue;
            }

            // Calculate base shipping for this shop
            const baseShipping = calculateShippingFee(distance, weight);
            
            if (baseShipping.success) {
                shopShipping[shopLocation.shopId] = {
                    success: true,
                    baseFee: baseShipping.total,
                    distance: distance,
                    weight: weight,
                    breakdown: baseShipping.breakdown,
                    shopName: shopLocation.shopName,
                    items: shopData.items
                };
                totalShipping += baseShipping.total;
            } else {
                shopShipping[shopLocation.shopId] = {
                    success: false,
                    error: baseShipping.error,
                    shopName: shopLocation.shopName
                };
            }
        }

        // Apply multi-shop fees (no discounts)
        if (shopIds.length > 1 && !hasOutOfRange) {
            const additionalShops = shopIds.length - 1;
            const additionalFees = additionalShops * shippingConfig.multiShopConfig.additionalShopFee;
            totalShipping += additionalFees;
        }

        return {
            success: !hasOutOfRange,
            totalShipping: Math.round(totalShipping),
            shopBreakdown: shopShipping,
            outOfRangeShops: outOfRangeShops,
            customerLocation: customerCoords,
            shopCount: shopIds.length,
            additionalFees: shopIds.length > 1 ? (shopIds.length - 1) * shippingConfig.multiShopConfig.additionalShopFee : 0
        };

    } catch (error) {
        console.error('Multi-shop shipping calculation error:', error);
        return {
            success: false,
            error: error.message,
            totalShipping: 100 * orderItems.reduce((sum, item) => sum + item.quantity, 0) // Fallback
        };
    }
}

function displayMultiShopShippingBreakdown(shippingResult) {
    const shippingBreakdown = getElement('shippingBreakdown');
    const shippingLoading = document.querySelector('.shipping-loading');
    
    if (!shippingBreakdown) return;

    if (!shippingResult.success) {
        // Handle maximum shops exceeded error
        if (shippingResult.maxShops) {
            shippingBreakdown.innerHTML = `
                <div class="shipping-error">
                    <p><strong>Too Many Shops</strong></p>
                    <p>Your order contains items from ${shippingResult.shopCount} shops, but we only support orders from up to ${shippingResult.maxShops} shops at once.</p>
                    <p>Please split your order or remove items from some shops.</p>
                </div>
            `;
        } else {
            shippingBreakdown.innerHTML = `
                <div class="shipping-error">
                    <p><strong>Shipping Calculation Issues</strong></p>
                    <p>${shippingResult.error || 'Some shops cannot be delivered to your location'}</p>
                    ${shippingResult.outOfRangeShops && shippingResult.outOfRangeShops.length > 0 ? `
                        <div class="out-of-range-shops">
                            <p><strong>Shops beyond delivery range:</strong></p>
                            <ul>
                                ${shippingResult.outOfRangeShops.map(shop => `
                                    <li>${shop.shopName} (${shop.distance.toFixed(1)}km - max ${shop.maxDistance}km)</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        shippingBreakdown.style.display = 'block';
        if (shippingLoading) shippingLoading.style.display = 'none';
        return;
    }

    let html = `
        <div class="coverage-info">
            <i class="fas fa-truck"></i>
            Order from ${shippingResult.shopCount} shop${shippingResult.shopCount > 1 ? 's' : ''} • 
            We deliver within ${shippingConfig.maxDistance}km radius
        </div>
        <div class="location-info">
            <div class="location-row">
                <strong><i class="fas fa-home"></i> Your Location:</strong>
                <span>${shippingResult.customerLocation.address}, ${shippingResult.customerLocation.city}</span>
            </div>
        </div>
    `;

    // Add breakdown for each shop
    Object.values(shippingResult.shopBreakdown).forEach(shopShipping => {
        if (shopShipping.success) {
            html += `
                <div class="shop-shipping-breakdown">
                    <h4>${shopShipping.shopName}</h4>
                    <div class="breakdown-item">
                        <span>Distance:</span>
                        <span>${shopShipping.distance.toFixed(1)} km</span>
                    </div>
                    <div class="breakdown-item">
                        <span>Weight:</span>
                        <span>${shopShipping.weight.toFixed(1)} kg</span>
                    </div>
                    <div class="breakdown-item">
                        <span>Base shipping:</span>
                        <span>₱${shopShipping.baseFee.toFixed(2)}</span>
                    </div>
                    <div class="breakdown-item small-text">
                        <span>Items (${shopShipping.items.length}):</span>
                        <span>${shopShipping.items.map(item => `${item.quantity}× ${item.name}`).join(', ')}</span>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="shop-shipping-error">
                    <h4>${shopShipping.shopName}</h4>
                    <p class="error-text">${shopShipping.error}</p>
                </div>
            `;
        }
    });

    // Add multi-shop fees if applicable (simplified without discount)
    if (shippingResult.shopCount > 1) {
        const additionalShops = shippingResult.shopCount - 1;
        const additionalFees = additionalShops * shippingConfig.multiShopConfig.additionalShopFee;
        
        html += `
            <div class="multi-shop-fees">
                <h4>Multi-Shop Fees</h4>
                <div class="breakdown-item">
                    <span>Additional shops fee (${additionalShops} shop${additionalShops > 1 ? 's' : ''} × ₱${shippingConfig.multiShopConfig.additionalShopFee}):</span>
                    <span>₱${additionalFees.toFixed(2)}</span>
                </div>
            </div>
        `;
    }

    html += `
        <div class="breakdown-total">
            <span>Total Shipping Fee:</span>
            <span>₱${shippingResult.totalShipping.toFixed(2)}</span>
        </div>
    `;

    shippingBreakdown.innerHTML = html;
    shippingBreakdown.style.display = 'block';
    if (shippingLoading) shippingLoading.style.display = 'none';
}

// Load user profile
function loadUserProfile() {
    // Autofill checkout form fields with user data
    getElement('firstName').value = userData.firstName || '';
    getElement('lastName').value = userData.lastName || '';
    getElement('email').value = userData.email || '';
    getElement('phone').value = userData.phone || '';
    getElement('address').value = userData.address || '';
    getElement('city').value = userData.city || '';
    getElement('state').value = userData.state || '';
    getElement('zip').value = userData.zip || '';
    getElement('country').value = 'Philippines';
}

// Set up event listeners
function setupEventListeners() {
    // Logout functionality
    const logoutBtn = getElement('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            if (confirm('Are you sure you want to logout?')) {
                const result = await logoutUser();
                if (result.success) {
                    window.location.href = '/login.html';
                } else {
                    console.error('Error signing out:', result.error);
                }
            }
        });
    }

    // Place order button
    const placeOrderBtn = getElement('placeOrderBtn');
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', function() {
            if (validateForm()) {
                placeOrder();
            }
        });
    }

    // Payment method selection
    const paymentMethods = document.querySelectorAll('.payment-method');
    if (paymentMethods.length > 0) {
        paymentMethods.forEach(div => {
            div.addEventListener("click", function() {
                const radio = this.querySelector("input[type='radio']");
                if (radio) {
                    radio.checked = true;
                }
            });
        });
    }

    // Modal functionality
    setupModalEvents();

    // Mobile menu setup
    setupMobileMenu();
}

function setupModalEvents() {
    const modal = getElement('orderConfirmationModal');
    const closeBtn = document.querySelector('.close-modal');
    const continueBtn = getElement('continueShoppingBtn');

    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            if (modal) modal.style.display = 'none';
        });
    }

    if (continueBtn) {
        continueBtn.addEventListener('click', function() {
            if (modal) modal.style.display = 'none';
            window.location.href = '/customer/html/customer_dashboard.html';
        });
    }

    // Close modal when clicking outside
    if (modal) {
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

function setupMobileMenu() {
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
}

// Function to load order summary
async function loadOrderSummary() {
    const urlParams = new URLSearchParams(window.location.search);
    const method = urlParams.get('method');

    if (method === "buyNow") {
        // Handle buy now flow
        const orderItem = {
            shopId: urlParams.get('shopId'),
            shoeId: urlParams.get('shoeId'),
            variantKey: urlParams.get('variantKey'),
            sizeKey: urlParams.get('sizeKey'),
            size: urlParams.get('size'),
            quantity: parseInt(urlParams.get('quantity')) || 1,
            price: parseFloat(urlParams.get('price')) || 0,
            name: urlParams.get('shoeName'),
            variantName: urlParams.get('variantName'),
            color: urlParams.get('color'),
            imageUrl: urlParams.get('image')
        };
        await displaySingleItemOrder(orderItem);
    } else if (method === "cartOrder") {
        // Handle cart order flow
        const cartIds = getCartOrderIds();
        if (cartIds.length > 0) {
            await displayMultipleItemOrder(cartIds);
        } else {
            getElement('orderItems').innerHTML = '<p>No items selected for checkout</p>';
        }
    } else {
        // Handle regular cart flow
        try {
            const cartResult = await readData(`smartfit_AR_Database/carts/${userId}`);
            
            if (!cartResult.success || !cartResult.data) {
                getElement('orderItems').innerHTML = '<p>Your cart is empty</p>';
                getElement('orderSummary').innerHTML = '';
                return;
            }

            const cartData = cartResult.data;
            const cartArray = Array.isArray(cartData) ? cartData : Object.values(cartData);
            await displayMultipleItemOrder(cartArray.map((_, index) => index.toString()));
        } catch (error) {
            console.error("Error loading order summary:", error);
            alert("Failed to load your cart. Please try again.");
        }
    }
}

// Form validation function
function validateForm() {
    const requiredFields = [
        'firstName', 'lastName', 'address', 'city', 'zip', 'state', 'country', 'phone', 'email'
    ];

    let isValid = true;

    requiredFields.forEach(fieldId => {
        const field = getElement(fieldId);
        if (field && !field.value.trim()) {
            field.style.borderColor = 'red';
            isValid = false;
        } else if (field) {
            field.style.borderColor = '#ddd';
        }
    });

    if (!isValid) {
        alert('Please fill in all required fields');
        return false;
    }

    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    if (!paymentMethod) {
        alert('Please select a payment method');
        return false;
    }

    return true;
}

// Helper function to generate unique Order ID
function generateOrderId() {
    const timestamp = Date.now().toString();
    const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `ORD-${timestamp}-${randomStr}`;
}

// Function to place order
async function placeOrder() {
    const shippingInfo = {
        firstName: getElement('firstName').value,
        lastName: getElement('lastName').value,
        email: getElement('email').value,
        phone: getElement('phone').value,
        address: getElement('address').value,
        city: getElement('city').value,
        zip: getElement('zip').value,
        state: getElement('state').value,
        country: getElement('country').value
    };

    const urlParams = new URLSearchParams(window.location.search);
    const method = urlParams.get('method');
    let orderItems = [];

    try {
        if (method === "buyNow") {
            orderItems = await prepareBuyNowOrder(urlParams);
        } else if (method === "cartOrder") {
            orderItems = await prepareCartOrder();
        }

        if (orderItems.length === 0) {
            alert('No items to order');
            return;
        }

        // Create orders and process each item
        for (const item of orderItems) {
            await processOrderItem(item, shippingInfo, method);
        }

        // Show confirmation for the last order
        const items = await getCurrentOrderItems();
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.12;
        const total = subtotal + tax + currentShippingFee;

        showOrderConfirmationModal({
            orderId: generateOrderId(),
            shippingInfo: shippingInfo,
            totalAmount: total
        });

    } catch (error) {
        console.error("Error placing order:", error);
        alert("Error placing your order. Please try again.");
    }
}

// Prepare buy now order items
async function prepareBuyNowOrder(urlParams) {
    try {
        const shoeResult = await readData(`smartfit_AR_Database/shoe/${urlParams.get('shopId')}/${urlParams.get('shoeId')}`);
        
        let brand = 'Unknown';
        let type = 'Unknown';
        let gender = 'Unisex';
        
        if (shoeResult.success && shoeResult.data) {
            const shoeData = shoeResult.data;
            brand = shoeData.shoeBrand || 'Unknown';
            type = shoeData.shoeType || 'Unknown';
            gender = shoeData.shoeGender || 'Unisex';
        }
        
        return [{
            shopId: urlParams.get('shopId'),
            shoeId: urlParams.get('shoeId'),
            variantKey: urlParams.get('variantKey'),
            shopName: urlParams.get('shopName'),
            sizeKey: urlParams.get('sizeKey'),
            size: urlParams.get('size'),
            quantity: parseInt(urlParams.get('quantity')) || 1,
            price: parseFloat(urlParams.get('price')) || 0,
            name: urlParams.get('shoeName'),
            variantName: urlParams.get('variantName'),
            color: urlParams.get('color'),
            imageUrl: urlParams.get('image') || 'https://via.placeholder.com/150',
            brand: brand,
            type: type,
            gender: gender
        }];
    } catch (error) {
        console.error("Error preparing buy now order:", error);
        throw error;
    }
}

// Prepare cart order items
async function prepareCartOrder() {
    const cartIds = getCartOrderIds();
    if (cartIds.length === 0) {
        throw new Error('No cart items selected for checkout');
    }
    
    const cartResult = await readData(`smartfit_AR_Database/carts/${userId}`);
    if (!cartResult.success || !cartResult.data) {
        throw new Error('Your cart is empty');
    }
    
    const cartData = cartResult.data;
    const orderItems = [];
    
    for (const cartId of cartIds) {
        const cartItem = cartData[cartId];
        if (!cartItem) continue;
        
        try {
            const shoeResult = await readData(`smartfit_AR_Database/shoe/${cartItem.shopId}/${cartItem.shoeId}`);
            
            let brand = 'Unknown';
            let type = 'Unknown';
            let gender = 'Unisex';
            
            if (shoeResult.success && shoeResult.data) {
                const shoeData = shoeResult.data;
                brand = shoeData.shoeBrand || 'Unknown';
                type = shoeData.shoeType || 'Unknown';
                gender = shoeData.shoeGender || 'Unisex';
            }
            
            orderItems.push({
                shopId: cartItem.shopId,
                shoeId: cartItem.shoeId,
                variantKey: cartItem.variantKey,
                shopName: cartItem.shopName || '',
                sizeKey: cartItem.sizeKey,
                size: cartItem.size,
                quantity: parseInt(cartItem.quantity) || 1,
                price: parseFloat(cartItem.price) || 0,
                name: cartItem.shoeName,
                variantName: cartItem.variantName,
                color: cartItem.color,
                imageUrl: cartItem.image || 'https://via.placeholder.com/150',
                brand: brand,
                type: type,
                gender: gender,
                cartId: cartId
            });
        } catch (error) {
            console.error("Error processing cart item:", cartItem, error);
        }
    }
    
    return orderItems;
}

// Process individual order item
async function processOrderItem(item, shippingInfo, method) {
    const orderId = generateOrderId();
    
    // Calculate totals with dynamic shipping fee
    const subtotal = item.price * item.quantity;
    const tax = subtotal * 0.12;
    const total = subtotal + tax + (currentShippingFee / (await getCurrentOrderItems()).length); // Distribute shipping fee
    
    // Create order object with shipping info
    const order = {
        orderId: orderId,
        userId: userId,
        shippingInfo: shippingInfo,
        date: new Date().toISOString(),
        status: 'pending',
        totalAmount: total,
        shippingFee: currentShippingFee / (await getCurrentOrderItems()).length,
        item: {
            shopId: item.shopId,
            shoeId: item.shoeId,
            variantKey: item.variantKey,
            shopName: item.shopName,
            sizeKey: item.sizeKey,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            variantName: item.variantName,
            color: item.color,
            brand: item.brand,
            type: item.type,
            gender: item.gender,
            imageUrl: item.imageUrl
        }
    };

    // Save order to database
    const createResult = await createData(
        `smartfit_AR_Database/transactions/${userId}/${orderId}`, 
        null, 
        order
    );

    if (!createResult.success) {
        throw new Error(`Failed to create order: ${createResult.error}`);
    }

    // Reduce stock
    await reduceStock(item);

    // Remove from cart if cart order
    if (method === "cartOrder" && item.cartId) {
        await deleteCartItem(item.cartId);
    }
}

// Function to delete cart item
async function deleteCartItem(cartId) {
    try {
        const deleteResult = await deleteData(`smartfit_AR_Database/carts/${userId}/${cartId}`);
        
        if (deleteResult.success) {
            console.log(`Cart item ${cartId} deleted successfully`);
            return true;
        } else {
            console.error("Failed to delete cart item:", deleteResult.error);
            return false;
        }
    } catch (error) {
        console.error("Error deleting cart item:", error);
        return false;
    }
}

// Reduce stock after purchase
async function reduceStock(item) {
    try {
        // First, let's check the actual structure of the shoe data
        const shoeResult = await readData(`smartfit_AR_Database/shoe/${item.shopId}/${item.shoeId}`);
        
        if (!shoeResult.success || !shoeResult.data) {
            console.error("Shoe not found:", item.shoeId);
            return;
        }

        const shoeData = shoeResult.data;
        console.log("Shoe data structure:", shoeData);

        // Get the variant
        const variant = shoeData.variants[item.variantKey];
        if (!variant) {
            console.error("Variant not found:", item.variantKey);
            return;
        }

        console.log("Variant structure:", variant);

        // Find the correct size entry
        let sizeData = null;
        let sizeKeyToUpdate = null;

        // Check if sizes exist and find the correct one
        if (variant.sizes) {
            for (const [key, sizeObj] of Object.entries(variant.sizes)) {
                const sizeValue = Object.keys(sizeObj)[0];
                if (sizeValue === item.size) {
                    sizeData = sizeObj[sizeValue];
                    sizeKeyToUpdate = key;
                    break;
                }
            }
        }

        if (!sizeData) {
            console.error("Size not found:", item.size, "in sizes:", variant.sizes);
            return;
        }

        const currentStock = sizeData.stock || 0;
        const newStock = currentStock - item.quantity;

        console.log("Current stock:", currentStock);
        console.log("Quantity to reduce:", item.quantity);
        console.log("New stock:", newStock);

        // Update the stock using the correct path
        const stockPath = `smartfit_AR_Database/shoe/${item.shopId}/${item.shoeId}/variants/${item.variantKey}/sizes/${sizeKeyToUpdate}/${item.size}`;
        
        console.log("Stock path:", stockPath);
        
        const updateResult = await updateData(stockPath, {
            stock: newStock,
            LastUpdatedBy: userId,
            LastUpdatedAt: new Date().toISOString()
        });

        if (updateResult.success) {
            console.log(`Stock updated successfully for ${item.shoeId} size ${item.size}: ${currentStock} -> ${newStock}`);
        } else {
            console.error("Failed to update stock:", updateResult.error);
        }

    } catch (error) {
        console.error("Error reducing stock:", error);
        // Don't throw error here to prevent order failure due to stock update issues
        console.warn("Stock reduction failed, but order was placed successfully");
    }
}

// Display single item order
async function displaySingleItemOrder(item) {
    const orderItemsContainer = getElement('orderItems');
    if (!orderItemsContainer) return;
    
    orderItemsContainer.innerHTML = '';

    try {
        const shoeResult = await readData(`smartfit_AR_Database/shoe/${item.shopId}/${item.shoeId}`);
        if (shoeResult.success && shoeResult.data) {
            const shoeData = shoeResult.data;
            item.brand = shoeData.shoeBrand || 'Unknown';
            item.type = shoeData.shoeType || 'Unknown';
            item.gender = shoeData.shoeGender || 'Unisex';
        }
    } catch (error) {
        console.error("Error fetching shoe details:", error);
        item.brand = 'Unknown';
        item.type = 'Unknown';
        item.gender = 'Unisex';
    }

    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item';
    itemElement.innerHTML = `
        <img src="${item.imageUrl}" alt="${item.name}" class="cart-item-image">
        <div class="cart-item-details">
            <h4>${item.name}</h4>
            <p>${item.variantName} (${item.color})</p>
            <p>Size: ${item.size}</p>
            <p>Quantity: ${item.quantity}</p>
            ${item.brand ? `<p>Brand: ${item.brand}</p>` : ''}
            ${item.type ? `<p>Type: ${item.type}</p>` : ''}
            ${item.gender ? `<p>Gender: ${item.gender}</p>` : ''}
        </div>
    `;
    orderItemsContainer.appendChild(itemElement);

    updateOrderSummary([item]);
}

// Display multiple item order
async function displayMultipleItemOrder(cartIDs) {
    const cartResult = await readData(`smartfit_AR_Database/carts/${userId}`);
    
    if (!cartResult.success || !cartResult.data) {
        const orderItems = getElement('orderItems');
        if (orderItems) orderItems.innerHTML = '<p>Your cart is empty</p>';
        return;
    }

    const fullCart = cartResult.data;
    const itemsToDisplay = cartIDs
        .map(id => {
            const item = Array.isArray(fullCart) ? fullCart[parseInt(id)] : fullCart[id];
            return item ? { ...item, id } : null;
        })
        .filter(Boolean);

    const cartWithDetails = await Promise.all(itemsToDisplay.map(async item => {
        try {
            const shoeResult = await readData(`smartfit_AR_Database/shoe/${item.shopId}/${item.shoeId}`);
            if (!shoeResult.success || !shoeResult.data) return null;

            const shoeData = shoeResult.data;
            const variantKey = item.variantKey || Object.keys(shoeData.variants)[item.variantIndex || 0];
            const variant = shoeData.variants[variantKey];

            if (!variant) return null;

            // Find the correct size
            const sizeEntry = Object.entries(variant.sizes).find(
                ([key, sizeObj]) => {
                    const sizeValue = Object.keys(sizeObj)[0];
                    return sizeValue === item.size || key === item.sizeKey;
                }
            );

            if (!sizeEntry) return null;

            const [sizeKey, sizeObj] = sizeEntry;
            const sizeValue = Object.keys(sizeObj)[0];
            const stock = sizeObj[sizeValue].stock;

            return {
                ...item,
                name: shoeData.shoeName,
                price: parseFloat(variant.price),
                imageUrl: variant.imageUrl || shoeData.defaultImage || 'https://via.placeholder.com/150',
                variantName: variant.variantName,
                color: variant.color,
                size: sizeValue,
                brand: shoeData.shoeBrand || 'Unknown',
                type: shoeData.shoeType || 'Unknown',
                gender: shoeData.shoeGender || 'Unisex',
                availableStock: stock
            };
        } catch (error) {
            console.error("Error processing item:", item, error);
            return null;
        }
    }));

    const validItems = cartWithDetails.filter(Boolean);
    const container = getElement('orderItems');
    if (!container) return;
    
    container.innerHTML = '';

    if (validItems.length === 0) {
        container.innerHTML = '<p>No valid items found in your cart</p>';
        return;
    }

    validItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <img src="${item.imageUrl}" alt="${item.name}" class="cart-item-image" 
                onerror="this.src='https://via.placeholder.com/150'">
            <div class="cart-item-details">
                <h4>${item.name}</h4>
                <p>${item.variantName} (${item.color})</p>
                <p>Size: ${item.size}</p>
                <p>Quantity: ${item.quantity}</p>
                ${item.brand ? `<p>Brand: ${item.brand}</p>` : ''}
                ${item.type ? `<p>Type: ${item.type}</p>` : ''}
                ${item.gender ? `<p>Gender: ${item.gender}</p>` : ''}
                <p class="cart-item-price">₱${(item.price * item.quantity).toFixed(2)}</p>
                ${item.availableStock < item.quantity ?
                `<p class="stock-warning">Only ${item.availableStock} left in stock!</p>` : ''}
            </div>
        `;
        container.appendChild(div);
    });

    updateOrderSummary(validItems);
}

// Update order summary display
function updateOrderSummary(items) {
    const orderSummary = getElement('orderSummary');
    if (!orderSummary) return;
    
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.12;
    const total = subtotal + tax + currentShippingFee;

    orderSummary.innerHTML = `
        <div class="order-summary-item">
            <span>Subtotal</span>
            <span>₱${subtotal.toFixed(2)}</span>
        </div>
        <div class="order-summary-item">
            <span>Tax (12% VAT)</span>
            <span>₱${tax.toFixed(2)}</span>
        </div>
        <div class="order-summary-item">
            <span>Shipping</span>
            <span>₱${currentShippingFee.toFixed(2)}</span>
        </div>
        <div class="order-summary-item order-total">
            <span>Total</span>
            <span>₱${total.toFixed(2)}</span>
        </div>
    `;
}

// Get cart order IDs from URL
function getCartOrderIds() {
    const params = new URLSearchParams(window.location.search);
    const ids = [];

    params.forEach((value, key) => {
        if (key.startsWith('cartOrder_')) {
            ids.push(value);
        }
    });

    return ids;
}

// Show order confirmation modal
async function showOrderConfirmationModal(order) {
    const modal = getElement('orderConfirmationModal');
    const orderIdDisplay = getElement('orderIdDisplay');
    const modalOrderSummary = getElement('modalOrderSummary');

    if (!modal || !orderIdDisplay || !modalOrderSummary) return;

    orderIdDisplay.textContent = order.orderId;

    const items = await getCurrentOrderItems();
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.12;

    modalOrderSummary.innerHTML = `
        <div class="order-summary-item">
            <span>Subtotal</span>
            <span>₱${subtotal.toFixed(2)}</span>
        </div>
        <div class="order-summary-item">
            <span>Tax (12% VAT)</span>
            <span>₱${tax.toFixed(2)}</span>
        </div>
        <div class="order-summary-item">
            <span>Shipping</span>
            <span>₱${currentShippingFee.toFixed(2)}</span>
        </div>
        <div class="order-summary-item order-total">
            <span>Total</span>
            <span>₱${order.totalAmount.toFixed(2)}</span>
        </div>
    `;

    modal.style.display = 'block';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
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

    // Payment method selection via div
    document.querySelectorAll(".payment-method").forEach(div => {
        div.addEventListener("click", function () {
            const radio = this.querySelector("input[type='radio']");
            if (radio) {
                radio.checked = true;
            }
        });
    });

    // Initialize checkout page
    initializeCheckout().catch(error => {
        console.error('Error initializing checkout page:', error);
        alert('Error loading checkout page. Please try refreshing.');
    });
});