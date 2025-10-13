// analytics.js - Refactored to use firebaseMethods only with date range filtering
import {
    checkUserAuth,
    logoutUser,
    readDataRealtime,
    getOrders,
    displayProducts
} from "../../firebaseMethods.js";

// Global variables
let userSession = {
    shopId: null,
    role: null,
    shopName: '',
    userId: null,
    imageProfile: null
};
let RecentSalesFilter = 'day';
let salesChartInstance = null;
let inventoryChart = null;
let allOrders = [];
let realtimeListener = null;
let currentDateRange = { startDate: null, endDate: null };
let currentRevenuePeriod = 'daily';
let statusDistributionChart = null;
let monthlyOrdersChart = null;
let monthlyRevenueChart = null;

// Pagination variables
let currentPage = 1;
let itemsPerPage = 10; // You can change this value
let filteredTransactions = [];

// DOM Elements
const totalRevenue = document.getElementById('totalRevenue');
const totalOrders = document.getElementById('totalOrders');
const totalCustomers = document.getElementById('totalCustomers');
const averageOrderValue = document.getElementById('averageOrderValue');
const completionRate = document.getElementById('completionRate');
const avgProcessingTime = document.getElementById('avgProcessingTime');
const customerSatisfaction = document.getElementById('customerSatisfaction');
const repeatCustomers = document.getElementById('repeatCustomers');
const topProductsList = document.getElementById('topProductsList');
const logoutBtn = document.getElementById('logout_btn');

// Date range elements
const analyticsStartDateInput = document.getElementById('analyticsStartDate');
const analyticsEndDateInput = document.getElementById('analyticsEndDate');
const applyAnalyticsDateRangeBtn = document.getElementById('applyAnalyticsDateRange');
const resetDateRangeBtn = document.getElementById('resetDateRange');
const quickDateButtons = document.querySelectorAll('.quick-date-btn');

// Chart control elements
const sortRevenueDailyBtn = document.getElementById('sortRevenueDailyBtn');
const sortRevenueWeeklyBtn = document.getElementById('sortRevenueWeeklyBtn');
const sortRevenueMonthlyBtn = document.getElementById('sortRevenueMonthlyBtn');

// Additional date range for recent sales filter
const recentSalesStartDateInput = document.getElementById('recentSalesStartDate');
const recentSalesEndDateInput = document.getElementById('recentSalesEndDate');
const applyRecentSalesDateRangeBtn = document.getElementById('applyRecentSalesDateRange');
const recentSalesDateRange = document.getElementById('recentSalesDateRange');

// Pagination elements
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageNumbers = document.getElementById('pageNumbers');
const paginationInfo = document.getElementById('paginationInfo');

// Export buttons
const exportCSVBtn = document.getElementById('exportCSVBtn');
const exportPDFBtn = document.getElementById('exportPDFBtn');
const exportReportBtn = document.getElementById('exportReportBtn');

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async function () {
    await initializePage();
});

async function initializePage() {
    const user = await checkUserAuth();
    
    if (!user.authenticated) {
        window.location.href = "/login.html";
        return;
    }

    userSession.userId = user.userId;
    userSession.shopId = user.shopId || user.userId;
    userSession.role = user.role;
    userSession.shopName = user.userData.shopName || user.userData.ownerName || 'Shop Manager';
    userSession.imageProfile = user.userData.uploads.shopLogo.url;

    // Set user profile information
    setUserProfile();
    
    // Set role-based UI elements
    setupRoleBasedUI();
    
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    if (analyticsStartDateInput) analyticsStartDateInput.valueAsDate = startDate;
    if (analyticsEndDateInput) analyticsEndDateInput.valueAsDate = endDate;
    currentDateRange = { startDate, endDate };
    
    // Set default for recent sales custom date range
    if (recentSalesStartDateInput) recentSalesStartDateInput.valueAsDate = startDate;
    if (recentSalesEndDateInput) recentSalesEndDateInput.valueAsDate = endDate;
    
    // Load shop profile and analytics
    loadShopProfile();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup realtime listeners
    setupRealtimeListeners();
}

// Set user profile information
function setUserProfile() {
    const profilePicture = getElement('profilePicture');
    const userFullname = getElement('userFullname');
    
    if (!profilePicture || !userFullname) return;
    
    // Set profile name
    userFullname.textContent = userSession.shopName;
    console.log(userSession);
    
    // Set profile picture
    if (userSession.imageProfile) {
        profilePicture.src = userSession.imageProfile;
    } else {
        profilePicture.src = "https://cdn-icons-png.flaticon.com/512/11542/11542598.png";
    }
}

// Setup role-based UI elements
function setupRoleBasedUI() {
    if (userSession.role === 'employee') {
        const employeeData = userSession.userData;
        if (employeeData.role?.toLowerCase() === "manager") {
            getElement("addemployeebtn").style.display = "none";
        } else if (employeeData.role?.toLowerCase() === "salesperson") {
            getElement("addemployeebtn").style.display = "none";
            getElement("analyticsbtn").style.display = "none";
        }
    }
}

function loadShopProfile() {
    // Load inventory changes
    loadInventoryChanges();
    
    // Load shop transactions
    loadShopTransactions(RecentSalesFilter);
}

// Setup real-time listeners for database changes
function setupRealtimeListeners() {
    if (realtimeListener) {
        realtimeListener();
    }
    
    const transactionsPath = `smartfit_AR_Database/transactions`;
    realtimeListener = readDataRealtime(transactionsPath, (result) => {
        console.log(result);
        if (result.success) {
            console.log("Real-time update detected in transactions"+result);
            if (result.data) {
                processRealtimeOrders(result.data);
                updateAnalyticsCards();
                updateCharts();
                updateTopProducts();
                displayTransactions(allOrders, RecentSalesFilter);
            }
        } else {
            console.error("Real-time listener error:", result.error);
        }
    });
}

// Process real-time orders data
function processRealtimeOrders(transactionsData) {
    const newOrders = [];

    if (transactionsData) {
        Object.keys(transactionsData).forEach(orderId => {
            const orderData = transactionsData[orderId];
            newOrders.push({
                ...orderData,
                orderId: orderId,
                source: 'transactions',
                isCustom: false
            });
        });
    }

    newOrders.sort((a, b) => {
        const dateA = a.date || a.orderDate || a.addedAt;
        const dateB = b.date || b.orderDate || b.addedAt;
        return new Date(dateB) - new Date(dateA);
    });

    allOrders = newOrders;
}

// Load inventory changes
function loadInventoryChanges() {
    const productsPath = `smartfit_AR_Database/shoe/${userSession.shopId}`;
    
    const unsubscribe = readDataRealtime(productsPath, (result) => {
        if (result.success && result.data) {
            const shoes = result.data;
            const inventoryChanges = [];

            // For each shoe, track inventory changes
            Object.keys(shoes).forEach(shoeId => {
                const shoe = shoes[shoeId];

                // Check variants
                if (shoe.variants) {
                    Object.keys(shoe.variants).forEach(variantKey => {
                        const variant = shoe.variants[variantKey];

                        // Check sizes
                        if (variant.sizes) {
                            Object.keys(variant.sizes).forEach(sizeKey => {
                                const size = variant.sizes[sizeKey];
                                const sizeValue = Object.keys(size)[0]; // Get the size value (e.g., "8")
                                const stock = size[sizeValue].stock;

                                // Add to inventory changes
                                inventoryChanges.push({
                                    date: shoe.dateAdded,
                                    shoe: `${shoe.shoeName} (${variant.variantName}) <span style="background-color:#bfbfbf; border-radius:5px;">size: ${sizeValue}</span>`,
                                    action: size[sizeValue].actionValue || 'Initial Stock',
                                    user: userSession.userData?.email || 'System',
                                    quantity: stock,
                                    status: stock > 10 ? 'normal' : stock > 0 ? 'warning' : 'out of stock'
                                });
                            });
                        }
                    });
                }
            });

            // Display in table
            displayInventoryChanges(inventoryChanges);
            renderInventoryStatusChart(inventoryChanges);
        }
    });

    // Store unsubscribe for cleanup if needed
    window.inventoryUnsubscribe = unsubscribe;
}

// Load shop transactions
async function loadShopTransactions(filterDate) {
    try {
        const result = await getOrders(userSession.shopId, { status: 'all' });
        
        if (result.success) {
            const shopTransactions = result.data;
            allOrders = shopTransactions.map(order => ({
                ...order,
                orderDate: order.date // Map to consistent field
            }));
            updateAnalyticsCards();
            updateCharts();
            updateTopProducts();
            displayTransactions(allOrders, filterDate);
        } else {
            console.error('Error loading transactions:', result.error);
        }
    } catch (error) {
        console.error('Error loading shop transactions:', error);
    }
}

function displayTransactions(transactions, filter) {
    const recentSalesTable = getElement('recentSales');
    if (!recentSalesTable) return;
    
    recentSalesTable.innerHTML = '';

    // Reset to first page when filter changes
    currentPage = 1;

    let validTransactions = transactions;

    // Apply date range filter if set
    if (currentDateRange.startDate && currentDateRange.endDate) {
        validTransactions = validTransactions.filter(t => {
            const transactionDate = new Date(t.orderDate || t.date);
            return transactionDate >= currentDateRange.startDate && transactionDate <= currentDateRange.endDate;
        });
    }

    // Apply additional filter for recent sales
    if (filter === 'custom') {
        const customStart = recentSalesStartDateInput ? new Date(recentSalesStartDateInput.value) : null;
        const customEnd = recentSalesEndDateInput ? new Date(recentSalesEndDateInput.value) : null;
        if (customStart && customEnd) {
            validTransactions = validTransactions.filter(t => {
                const transactionDate = new Date(t.orderDate || t.date);
                return transactionDate >= customStart && transactionDate <= customEnd;
            });
        }
    } else {
        const now = new Date();
        if (filter.toLowerCase() === 'day') {
            // ✅ FIXED: Get today's date (start of day) correctly
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow
            
            validTransactions = validTransactions.filter(t => {
                const transactionDate = new Date(t.orderDate || t.date);
                return transactionDate >= today && transactionDate < tomorrow;
            });
        } else if (filter.toLowerCase() === 'week') {
            // ✅ FIXED: Get start of week correctly
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            weekAgo.setHours(0, 0, 0, 0);
            
            validTransactions = validTransactions.filter(t => {
                const transactionDate = new Date(t.orderDate || t.date);
                return transactionDate >= weekAgo;
            });
        } else if (filter.toLowerCase() === 'month') {
            // ✅ FIXED: Get start of month correctly
            const monthAgo = new Date();
            monthAgo.setMonth(now.getMonth() - 1);
            monthAgo.setHours(0, 0, 0, 0);
            
            validTransactions = validTransactions.filter(t => {
                const transactionDate = new Date(t.orderDate || t.date);
                return transactionDate >= monthAgo;
            });
        }
    }

    // Sort by date descending
    validTransactions.sort((a, b) => new Date(b.orderDate || b.date) - new Date(a.orderDate || a.date));
    
    // Store filtered transactions for pagination
    filteredTransactions = validTransactions;
    
    // Update pagination
    updatePagination();
    
    // Display current page
    displayCurrentPage();
}

function displayCurrentPage() {
    const recentSalesTable = getElement('recentSales');
    if (!recentSalesTable) return;
    
    recentSalesTable.innerHTML = '';
    
    // Calculate start and end index for current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredTransactions.length);
    
    // Display transactions for current page
    filteredTransactions.slice(startIndex, endIndex).forEach(transaction => {
        const row = document.createElement('tr');

        const date = new Date(new Date(transaction.orderDate || transaction.date).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

        let statusClass = 'badge-primary';
        if (transaction.status === 'Delivered') statusClass = 'badge-success';
        if (transaction.status === 'rejected') statusClass = 'badge-danger';
        if (transaction.status === 'cancelled') statusClass = 'badge-warning';

        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${transaction.orderId}</td>
            <td>${transaction.shippingInfo?.firstName || 'N/A'} ${transaction.shippingInfo?.lastName || ''}</td>
            <td>${transaction.item?.name || 'N/A'} (${transaction.item?.variantName || 'N/A'})</td>
            <td>${transaction.item?.size || 'N/A'}</td>
            <td>${transaction.item?.quantity || 1}</td>
            <td>₱${transaction.totalAmount?.toLocaleString() || '0'}</td>
            <td><span class="badge ${statusClass}">${transaction.status}</span></td>
        `;
        recentSalesTable.appendChild(row);
    });
}

function updatePagination() {
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    
    // Update pagination info
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, filteredTransactions.length);
    
    if (paginationInfo) {
        paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${filteredTransactions.length} items`;
    }
    
    // Update previous/next buttons
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage === 1;
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }
    
    // Update page numbers
    if (pageNumbers) {
        pageNumbers.innerHTML = '';
        
        // Show up to 5 page numbers
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        // Adjust if we're near the end
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                displayCurrentPage();
                updatePagination();
            });
            pageNumbers.appendChild(pageBtn);
        }
    }
}

function displayInventoryChanges(changes) {
    const inventoryChangesTable = getElement('inventoryChanges');
    if (!inventoryChangesTable) return;
    
    inventoryChangesTable.innerHTML = '';

    // Sort by date (newest first)
    changes.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Add new rows (limit to 10 most recent)
    changes.slice(0, 10).forEach(item => {
        const row = document.createElement('tr');

        let statusClass = 'badge-success';
        if (item.status === 'warning') statusClass = 'badge-warning';
        if (item.status === 'danger' || item.status === 'out of stock') statusClass = 'badge-danger';

        // Format date
        const date = new Date(item.date);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${item.shoe}</td>
            <td>${item.action}</td>
            <td>${item.user}</td>
            <td>${item.quantity}</td>
            <td><span class="badge ${statusClass}">${item.status}</span></td>
        `;
        inventoryChangesTable.appendChild(row);
    });
}

// Update analytics cards
function updateAnalyticsCards() {
    // Filter orders by date range
    let filteredOrders = allOrders;
    if (currentDateRange.startDate && currentDateRange.endDate) {
        filteredOrders = allOrders.filter(order => {
            const orderDate = new Date(order.orderDate || order.date || order.addedAt);
            return orderDate >= currentDateRange.startDate && orderDate <= currentDateRange.endDate;
        });
    }

    // Calculate metrics
    const completedOrders = filteredOrders.filter(order => order.status === 'completed' || order.status === 'Delivered');
    const totalRevenueAmount = completedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const uniqueCustomers = [...new Set(filteredOrders.map(order => order.userId || order.shippingInfo?.email))].length;
    const averageOrderValueAmount = completedOrders.length > 0 ? totalRevenueAmount / completedOrders.length : 0;
    
    // Calculate changes (simulated)
    const revenueChange = totalRevenueAmount > 0 ? '+' + Math.round((totalRevenueAmount / (filteredOrders.length * 3000)) * 100) : '0';
    const ordersChange = filteredOrders.length > 0 ? '+' + Math.round((filteredOrders.length / 50) * 100) : '0';
    const customersChange = uniqueCustomers > 0 ? '+' + Math.round((uniqueCustomers / 30) * 100) : '0';
    const averageOrderChange = averageOrderValueAmount > 0 ? '+' + Math.round((averageOrderValueAmount / 2500) * 100) : '0';

    // Update DOM elements if they exist
    if (totalRevenue) totalRevenue.textContent = `₱${totalRevenueAmount.toFixed(2)}`;
    if (totalOrders) totalOrders.textContent = filteredOrders.length;
    if (totalCustomers) totalCustomers.textContent = uniqueCustomers;
    if (averageOrderValue) averageOrderValue.textContent = `₱${averageOrderValueAmount.toFixed(2)}`;

    // Update performance metrics
    const completionRateValue = filteredOrders.length > 0 ? Math.round((completedOrders.length / filteredOrders.length) * 100) : 0;
    const avgProcessingDays = calculateAverageProcessingTime(filteredOrders);
    const satisfactionRate = calculateCustomerSatisfaction();
    const repeatRate = calculateRepeatCustomerRate(filteredOrders);

    if (completionRate) completionRate.textContent = `${completionRateValue}%`;
    if (avgProcessingTime) avgProcessingTime.textContent = `${avgProcessingDays}d`;
    if (customerSatisfaction) customerSatisfaction.textContent = `${satisfactionRate}%`;
    if (repeatCustomers) repeatCustomers.textContent = `${repeatRate}%`;

    // Update change indicators
    const revenueChangeElement = document.getElementById('revenueChange');
    const ordersChangeElement = document.getElementById('ordersChange');
    const customersChangeElement = document.getElementById('customersChange');
    const averageOrderChangeElement = document.getElementById('averageOrderChange');

    if (revenueChangeElement) {
        revenueChangeElement.innerHTML = `<i class="fas fa-arrow-up"></i><span>${revenueChange}% from previous period</span>`;
    }
    if (ordersChangeElement) {
        ordersChangeElement.innerHTML = `<i class="fas fa-arrow-up"></i><span>${ordersChange}% from previous period</span>`;
    }
    if (customersChangeElement) {
        customersChangeElement.innerHTML = `<i class="fas fa-arrow-up"></i><span>${customersChange}% from previous period</span>`;
    }
    if (averageOrderChangeElement) {
        averageOrderChangeElement.innerHTML = `<i class="fas fa-arrow-up"></i><span>${averageOrderChange}% from previous period</span>`;
    }
}

// Calculate average processing time
function calculateAverageProcessingTime(orders = allOrders) {
    const completedOrders = orders.filter(order => order.status === 'completed' || order.status === 'Delivered');
    if (completedOrders.length === 0) return 0;
    
    let totalDays = 0;
    completedOrders.forEach(order => {
        const orderDate = new Date(order.orderDate || order.date || order.addedAt);
        const completionDate = order.completionDate ? new Date(order.completionDate) : new Date();
        const days = Math.ceil((completionDate - orderDate) / (1000 * 60 * 60 * 24));
        totalDays += days > 0 ? days : 1;
    });
    
    return Math.round(totalDays / completedOrders.length);
}

// Calculate customer satisfaction (placeholder)
function calculateCustomerSatisfaction() {
    return Math.min(95, Math.max(70, Math.floor(Math.random() * 25) + 70));
}

// Calculate repeat customer rate
function calculateRepeatCustomerRate(orders = allOrders) {
    const customerOrderCounts = {};
    
    orders.forEach(order => {
        const customerId = order.userId || order.shippingInfo?.email;
        if (customerId) {
            customerOrderCounts[customerId] = (customerOrderCounts[customerId] || 0) + 1;
        }
    });
    
    const repeatCustomersCount = Object.values(customerOrderCounts).filter(count => count > 1).length;
    const totalCustomers = Object.keys(customerOrderCounts).length;
    
    return totalCustomers > 0 ? Math.round((repeatCustomersCount / totalCustomers) * 100) : 0;
}

// Update charts
function updateCharts() {
    updateRevenueTrendsChart(); // This is the salesChart with date range and filter
    updateStatusDistributionChart();
    updateMonthlyOrdersChart();
    updateMonthlyRevenueChart();
    // Existing inventory chart remains
}

// Update revenue trends chart (adapted sales chart with date range and period filter)
function updateRevenueTrendsChart() {
    const ctx = getElement('salesChart'); // Assuming ID is salesChart for revenue trends
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');

    // Filter orders by date range
    let filteredOrders = allOrders;
    if (currentDateRange.startDate && currentDateRange.endDate) {
        filteredOrders = allOrders.filter(order => {
            const orderDate = new Date(order.orderDate || order.date || order.addedAt);
            return orderDate >= currentDateRange.startDate && orderDate <= currentDateRange.endDate;
        });
    }

    // Generate data based on selected period
    let labels = [];
    let revenueData = [];
    let orderData = [];
    
    const startDate = currentDateRange.startDate || new Date();
    const endDate = currentDateRange.endDate || new Date();
    
    if (currentRevenuePeriod === 'daily') {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            labels.push(dateStr);
            
            const dayRevenue = filteredOrders
                .filter(order => {
                    const orderDate = new Date(order.orderDate || order.date);
                    return orderDate.toDateString() === currentDate.toDateString();
                })
                .reduce((sum, order) => sum + (order.totalAmount || 0), 0);
            
            const dayOrders = filteredOrders
                .filter(order => {
                    const orderDate = new Date(order.orderDate || order.date);
                    return orderDate.toDateString() === currentDate.toDateString();
                }).length;
            
            revenueData.push(dayRevenue);
            orderData.push(dayOrders);
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
    } else if (currentRevenuePeriod === 'weekly') {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const weekStart = new Date(currentDate);
            const weekEnd = new Date(currentDate);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { day: 'numeric' })}`;
            labels.push(weekLabel);
            
            const weekRevenue = filteredOrders
                .filter(order => {
                    const orderDate = new Date(order.orderDate || order.date);
                    return orderDate >= weekStart && orderDate <= weekEnd;
                })
                .reduce((sum, order) => sum + (order.totalAmount || 0), 0);
            
            const weekOrders = filteredOrders
                .filter(order => {
                    const orderDate = new Date(order.orderDate || order.date);
                    return orderDate >= weekStart && orderDate <= weekEnd;
                }).length;
            
            revenueData.push(weekRevenue);
            orderData.push(weekOrders);
            
            currentDate.setDate(currentDate.getDate() + 7);
        }
    } else if (currentRevenuePeriod === 'monthly') {
        let currentDate = new Date(startDate);
        currentDate.setDate(1);
        
        while (currentDate <= endDate) {
            const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            labels.push(monthLabel);
            
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            
            const monthRevenue = filteredOrders
                .filter(order => {
                    const orderDate = new Date(order.orderDate || order.date);
                    return orderDate >= currentDate && orderDate <= monthEnd;
                })
                .reduce((sum, order) => sum + (order.totalAmount || 0), 0);
            
            const monthOrders = filteredOrders
                .filter(order => {
                    const orderDate = new Date(order.orderDate || order.date);
                    return orderDate >= currentDate && orderDate <= monthEnd;
                }).length;
            
            revenueData.push(monthRevenue);
            orderData.push(monthOrders);
            
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
    }

    // Destroy existing chart if it exists
    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    salesChartInstance = new Chart(chartCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenue (₱)',
                    data: revenueData,
                    borderColor: '#7c3Aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Orders',
                    data: orderData,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: '#475569',
                    borderWidth: 1,
                    cornerRadius: 8,
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#64748b',
                        maxRotation: labels.length > 10 ? 45 : 0
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(226, 232, 240, 0.5)'
                    },
                    ticks: {
                        color: '#64748b',
                        callback: function(value) {
                            return '₱' + value;
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        color: '#64748b',
                        precision: 0
                    }
                }
            }
        }
    });
}

// Update status distribution chart
function updateStatusDistributionChart() {
    const ctx = getElement('statusDistributionChart');
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');
    
    // Filter orders by date range
    let filteredOrders = allOrders;
    if (currentDateRange.startDate && currentDateRange.endDate) {
        filteredOrders = allOrders.filter(order => {
            const orderDate = new Date(order.orderDate || order.date || order.addedAt);
            return orderDate >= currentDateRange.startDate && orderDate <= currentDateRange.endDate;
        });
    }
    
    // Count orders by status
    const statusCounts = {
        'Pending': filteredOrders.filter(order => order.status === 'pending').length,
        'Processing': filteredOrders.filter(order => 
            order.status === 'processing' || ['Order Processed', 'Shipped', 'In Transit', 'Arrived at Facility', 'Out for Delivery'].includes(order.status)
        ).length,
        'Completed': filteredOrders.filter(order => order.status === 'completed' || order.status === 'Delivered').length,
        'Cancelled': filteredOrders.filter(order => order.status === 'cancelled' || order.status === 'rejected').length
    };

    const statusLabels = Object.keys(statusCounts);
    const statusData = Object.values(statusCounts);

    const backgroundColors = [
        'rgba(245, 158, 11, 0.8)',  // Pending
        'rgba(6, 182, 212, 0.8)',   // Processing
        'rgba(16, 185, 129, 0.8)',  // Completed
        'rgba(239, 68, 68, 0.8)'    // Cancelled
    ];

    const borderColors = [
        'rgb(245, 158, 11)',
        'rgb(6, 182, 212)',
        'rgb(16, 185, 129)',
        'rgb(239, 68, 68)'
    ];

    if (statusDistributionChart) {
        statusDistributionChart.destroy();
    }

    statusDistributionChart = new Chart(chartCtx, {
        type: 'doughnut',
        data: {
            labels: statusLabels,
            datasets: [{
                data: statusData,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        color: '#475569',
                        font: {
                            size: 12
                        },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: '#475569',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

// Update monthly orders chart
function updateMonthlyOrdersChart() {
    const ctx = getElement('monthlyOrdersChart');
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');
    
    const months = [];
    const monthlyOrders = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        months.push(monthName);
        
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const ordersThisMonth = allOrders.filter(order => {
            const orderDate = new Date(order.orderDate || order.date);
            return orderDate >= monthStart && orderDate <= monthEnd;
        }).length;
        
        monthlyOrders.push(ordersThisMonth);
    }

    if (monthlyOrdersChart) {
        monthlyOrdersChart.destroy();
    }

    monthlyOrdersChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Orders',
                data: monthlyOrders,
                backgroundColor: 'rgba(6, 182, 212, 0.8)',
                borderColor: 'rgb(6, 182, 212)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: '#475569',
                    borderWidth: 1,
                    cornerRadius: 8,
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#64748b'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(226, 232, 240, 0.5)'
                    },
                    ticks: {
                        color: '#64748b',
                        precision: 0
                    }
                }
            }
        }
    });
}

// Update monthly revenue chart
function updateMonthlyRevenueChart() {
    const ctx = getElement('monthlyRevenueChart');
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');
    
    const months = [];
    const monthlyRevenue = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        months.push(monthName);
        
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const revenueThisMonth = allOrders
            .filter(order => {
                const orderDate = new Date(order.orderDate || order.date);
                return orderDate >= monthStart && orderDate <= monthEnd && (order.status === 'completed' || order.status === 'Delivered');
            })
            .reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        
        monthlyRevenue.push(revenueThisMonth);
    }

    if (monthlyRevenueChart) {
        monthlyRevenueChart.destroy();
    }

    monthlyRevenueChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Revenue (₱)',
                data: monthlyRevenue,
                backgroundColor: 'rgba(124, 58, 237, 0.8)',
                borderColor: 'rgb(124, 58, 237)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: '#475569',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return 'Revenue: ₱' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#64748b'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(226, 232, 240, 0.5)'
                    },
                    ticks: {
                        color: '#64748b',
                        callback: function(value) {
                            return '₱' + value;
                        }
                    }
                }
            }
        }
    });
}

// Update top products list
function updateTopProducts() {
    if (!topProductsList) return;
    
    // Filter orders by date range
    let filteredOrders = allOrders;
    if (currentDateRange.startDate && currentDateRange.endDate) {
        filteredOrders = allOrders.filter(order => {
            const orderDate = new Date(order.orderDate || order.date || order.addedAt);
            return orderDate >= currentDateRange.startDate && orderDate <= currentDateRange.endDate;
        });
    }
    
    // Simulate top products from orders (adapt based on data)
    const productCounts = {};
    
    filteredOrders.forEach(order => {
        const productName = `${order.item?.name || 'Unknown'} (${order.item?.variantName || 'N/A'})`;
        productCounts[productName] = (productCounts[productName] || { orders: 0, revenue: 0 });
        productCounts[productName].orders += 1;
        productCounts[productName].revenue += order.totalAmount || 0;
    });
    
    const topProducts = Object.entries(productCounts)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);

    if (topProducts.length === 0) {
        topProductsList.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <i class="fas fa-box-open"></i> No product data available
            </div>
        `;
        return;
    }

    topProductsList.innerHTML = topProducts.map(product => `
        <div class="product-item">
            <div class="product-icon">
                <i class="fas fa-shoe-prints"></i>
            </div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-stats">
                    <span>${product.orders} orders</span>
                    <span>₱${product.revenue.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Existing inventory status chart
function renderInventoryStatusChart(inventoryChanges) {
    const ctx = getElement('inventoryStatusChart');
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');
    
    const statusCounts = {
        normal: 0,
        warning: 0,
        outOfStock: 0
    };

    inventoryChanges.forEach(item => {
        if (item.status === 'normal') statusCounts.normal++;
        else if (item.status === 'warning') statusCounts.warning++;
        else if (item.status === 'out of stock' || item.status === 'danger') statusCounts.outOfStock++;
    });

    if (inventoryChart) {
        inventoryChart.destroy();
    }

    inventoryChart = new Chart(chartCtx, {
        type: 'doughnut',
        data: {
            labels: ['Normal', 'Warning', 'Out of Stock'],
            datasets: [{
                label: 'Inventory Status',
                data: [statusCounts.normal, statusCounts.warning, statusCounts.outOfStock],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
                borderWidth: 1,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 20,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%',
            spacing: 5
        }
    });
}

// Update chart sort buttons UI
function updateChartSortButtons(activePeriod) {
    [sortRevenueDailyBtn, sortRevenueWeeklyBtn, sortRevenueMonthlyBtn].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    
    const activeBtn = getElement(`sortRevenue${activePeriod.charAt(0).toUpperCase() + activePeriod.slice(1)}Btn`);
    if (activeBtn) activeBtn.classList.add('active');
}

// Apply date range filter
function applyDateRangeFilter() {
    const startDate = new Date(analyticsStartDateInput.value);
    const endDate = new Date(analyticsEndDateInput.value);
    
    if (startDate && endDate && startDate <= endDate) {
        currentDateRange = { startDate, endDate };
        updateAnalyticsCards();
        updateCharts();
        updateTopProducts();
        displayTransactions(allOrders, RecentSalesFilter);
    } else {
        alert('Please select a valid date range. Start date must be before or equal to end date.');
    }
}

// Reset date range to default (last 30 days)
function resetDateRange() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    analyticsStartDateInput.valueAsDate = startDate;
    analyticsEndDateInput.valueAsDate = endDate;
    
    currentDateRange = { startDate, endDate };
    updateAnalyticsCards();
    updateCharts();
    updateTopProducts();
    displayTransactions(allOrders, RecentSalesFilter);
}

// Set quick date range
function setQuickDateRange(days = null, month = null) {
    const endDate = new Date();
    const startDate = new Date();
    
    if (days) {
        startDate.setDate(startDate.getDate() - days);
    } else if (month) {
        startDate.setDate(1); // First day of current month
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0); // Last day of current month
    }
    
    analyticsStartDateInput.valueAsDate = startDate;
    analyticsEndDateInput.valueAsDate = endDate;
    
    currentDateRange = { startDate, endDate };
    updateAnalyticsCards();
    updateCharts();
    updateTopProducts();
    displayTransactions(allOrders, RecentSalesFilter);
}

// Export functions (placeholders)
function exportDataAsCSV() {
    alert('CSV export functionality would be implemented here');
}

function exportDataAsPDF() {
    alert('PDF export functionality would be implemented here');
}

function generateFullReport() {
    alert('Full report generation would be implemented here');
}

// Setup event listeners
function setupEventListeners() {
    // Mobile sidebar toggle (existing)
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

    // Date range filter
    if (applyAnalyticsDateRangeBtn) {
        applyAnalyticsDateRangeBtn.addEventListener('click', applyDateRangeFilter);
    }

    // Reset date range
    if (resetDateRangeBtn) {
        resetDateRangeBtn.addEventListener('click', resetDateRange);
    }

    // Quick date buttons
    quickDateButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const days = this.dataset.days;
            const month = this.dataset.month;
            setQuickDateRange(days ? parseInt(days) : null, month ? parseInt(month) : null);
        });
    });

    // Filter buttons for recent sales (including custom)
    document.querySelectorAll('[data-recent-filter]').forEach(btn => {
        btn.addEventListener('click', function () {
            const parent = this.parentElement;
            parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            RecentSalesFilter = this.dataset.recentFilter;
            
            // Show/hide custom date range inputs
            if (RecentSalesFilter === 'custom') {
                recentSalesDateRange.style.display = 'flex';
            } else {
                recentSalesDateRange.style.display = 'none';
                displayTransactions(allOrders, RecentSalesFilter);
            }
        });
    });

    // Custom date range for recent sales
    if (applyRecentSalesDateRangeBtn) {
        applyRecentSalesDateRangeBtn.addEventListener('click', () => {
            const startDate = recentSalesStartDateInput ? new Date(recentSalesStartDateInput.value) : null;
            const endDate = recentSalesEndDateInput ? new Date(recentSalesEndDateInput.value) : null;
            
            if (startDate && endDate && startDate <= endDate) {
                displayTransactions(allOrders, 'custom');
            } else {
                alert('Please select a valid date range for recent sales.');
            }
        });
    }

    // Chart period buttons
    if (sortRevenueDailyBtn) {
        sortRevenueDailyBtn.addEventListener('click', () => {
            currentRevenuePeriod = 'daily';
            updateChartSortButtons('daily');
            updateRevenueTrendsChart();
        });
    }

    if (sortRevenueWeeklyBtn) {
        sortRevenueWeeklyBtn.addEventListener('click', () => {
            currentRevenuePeriod = 'weekly';
            updateChartSortButtons('weekly');
            updateRevenueTrendsChart();
        });
    }

    if (sortRevenueMonthlyBtn) {
        sortRevenueMonthlyBtn.addEventListener('click', () => {
            currentRevenuePeriod = 'monthly';
            updateChartSortButtons('monthly');
            updateRevenueTrendsChart();
        });
    }

    // Pagination buttons
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayCurrentPage();
                updatePagination();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                displayCurrentPage();
                updatePagination();
            }
        });
    }

    // Export buttons
    if (exportCSVBtn) exportCSVBtn.addEventListener('click', exportDataAsCSV);
    if (exportPDFBtn) exportPDFBtn.addEventListener('click', exportDataAsPDF);
    if (exportReportBtn) exportReportBtn.addEventListener('click', generateFullReport);

    // Print functionality (existing)
    const printInventoryBtn = getElement('printInventoryBtn');
    if (printInventoryBtn) {
        printInventoryBtn.addEventListener('click', handlePrint);
    }

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Handle logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        const result = await logoutUser();
        if (result.success) {
            window.location.href = "/login.html";
        } else {
            alert('Logout failed: ' + result.error);
        }
    }
}

// Handle print (existing, adapted slightly)
async function handlePrint() {
    const btn = getElement('printInventoryBtn');
    if (!btn) return;
    
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
    btn.disabled = true;
    btn.classList.add('loading');

    try {
        // Create a container for all the content
        const printContainer = document.createElement('div');
        printContainer.style.padding = '20px';
        printContainer.style.fontFamily = 'Arial, sans-serif';

        // Add header with shop name and logo
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '20px';
        header.style.borderBottom = '1px solid #ddd';
        header.style.paddingBottom = '20px';

        const shopTitle = document.createElement('h1');
        shopTitle.textContent = `${userSession.shopName || 'Shop'} Analytics Report`;
        shopTitle.style.margin = '0';
        shopTitle.style.fontSize = '24px';
        shopTitle.style.color = '#333';

        const reportDate = document.createElement('div');
        reportDate.textContent = `Report Date: ${new Date().toLocaleDateString()}`;
        reportDate.style.fontSize = '14px';
        reportDate.style.color = '#666';

        header.appendChild(shopTitle);
        header.appendChild(reportDate);
        printContainer.appendChild(header);

        // Convert charts to images first
        const charts = [
            getElement('salesChart'),
            getElement('inventoryStatusChart')
        ];

        // Replace each chart with its image representation
        for (const chart of charts) {
            if (chart) {
                const img = document.createElement('img');
                img.src = chart.toDataURL('image/png');
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.margin = '0 auto';

                // Create a container for the chart
                const chartContainer = document.createElement('div');
                chartContainer.style.marginBottom = '30px';
                chartContainer.style.pageBreakInside = 'avoid';
                chartContainer.appendChild(img);

                // Add the chart title
                const chartTitle = chart.closest('.analytics-card')?.querySelector('.card-title');
                if (chartTitle) {
                    const titleClone = chartTitle.cloneNode(true);
                    titleClone.style.marginBottom = '15px';
                    titleClone.style.textAlign = 'center';
                    titleClone.style.fontSize = '18px';
                    chartContainer.insertBefore(titleClone, img);
                }

                printContainer.appendChild(chartContainer);
            }
        }

        // Clone all analytics cards
        const analyticsCards = document.querySelectorAll('.analytics-card');

        for (const card of analyticsCards) {
            if (card.querySelector('canvas')) continue;

            const clone = card.cloneNode(true);
            clone.style.boxShadow = 'none';
            clone.style.border = '1px solid #ddd';
            clone.style.borderRadius = '5px';
            clone.style.padding = '15px';
            clone.style.marginBottom = '20px';
            clone.style.pageBreakInside = 'avoid';

            const cardTitle = clone.querySelector('.card-title');
            if (cardTitle) {
                cardTitle.style.fontSize = '18px';
                cardTitle.style.marginBottom = '15px';
            }

            const tables = clone.querySelectorAll('table');
            tables.forEach(table => {
                table.style.width = '100%';
                table.style.fontSize = '10pt';
                table.style.borderCollapse = 'collapse';

                const ths = table.querySelectorAll('th');
                ths.forEach(th => {
                    th.style.backgroundColor = '#f5f5f5';
                    th.style.padding = '8px';
                    th.style.textAlign = 'left';
                });

                const tds = table.querySelectorAll('td');
                tds.forEach(td => {
                    td.style.padding = '8px';
                    td.style.borderBottom = '1px solid #ddd';
                });
            });

            printContainer.appendChild(clone);
        }

        // PDF options - now with landscape orientation and visible footer
        const opt = {
            margin: [20, 40, 30, 40], // Increased bottom margin for footer
            filename: `${userSession.shopName || 'Shop'}_Analytics_${new Date().toISOString().slice(0, 10)}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: {
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true,
                letterRendering: true,
                // Ensure footer is rendered
                onclone: function (clonedDoc) {
                    const footer = clonedDoc.createElement('div');
                    footer.style.position = 'fixed';
                    footer.style.bottom = '0';
                    footer.style.width = '100%';
                    footer.style.textAlign = 'center';
                    footer.style.fontSize = '10px';
                    footer.style.color = '#666';
                    footer.style.padding = '5px';
                    footer.style.borderTop = '1px solid #eee';
                    footer.innerHTML = `Page <span class="pageNumber"></span> of <span class="totalPages"></span>`;
                    clonedDoc.body.appendChild(footer);
                }
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'landscape' // Changed to landscape
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
            // Header configuration
            header: {
                height: '15mm',
                contents: `<div style="text-align: center; font-size: 12px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                    ${userSession.shopName || 'Shop'} Analytics Report - ${new Date().toLocaleDateString()}
                </div>`
            },
            // Footer configuration - now properly visible
            footer: {
                height: '15mm',
                contents: {
                    first: '',
                    default: function (pageNum, numPages) {
                        return `<div style="text-align: center; font-size: 10px; color: #666; border-top: 1px solid #eee; padding-top: 5px; margin-top: 10px;">
                            Page ${pageNum} of ${numPages}
                        </div>`;
                    },
                    last: ''
                }
            }
        };

        await new Promise(resolve => setTimeout(resolve, 300));
        await html2pdf().set(opt).from(printContainer).save();
    } catch (error) {
        console.error('Error generating PDF:', error);
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

// Cleanup
function cleanup() {
    if (window.inventoryUnsubscribe) window.inventoryUnsubscribe();
    if (realtimeListener) realtimeListener();
    
    // Destroy charts
    const charts = [salesChartInstance, inventoryChart, statusDistributionChart, monthlyOrdersChart, monthlyRevenueChart];
    charts.forEach(chart => { if (chart) chart.destroy(); });
}

window.cleanupAnalytics = cleanup;