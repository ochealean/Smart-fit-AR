// analytics.js - Refactored to use firebaseMethods only
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
    
    // Load shop profile and analytics
    loadShopProfile();
    
    // Setup event listeners
    setupEventListeners();
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
            displayTransactions(shopTransactions, filterDate);
            prepareChartData(shopTransactions, filterDate);
        } else {
            console.error('Error loading transactions:', result.error);
        }
    } catch (error) {
        console.error('Error loading shop transactions:', error);
    }
}

function displayTransactions(transactions, filterDate) {
    const recentSalesTable = getElement('recentSales');
    if (!recentSalesTable) return;
    
    recentSalesTable.innerHTML = '';

    const now = new Date();
    let validTransactions = [];

    if (filterDate.toLowerCase() === 'day') {
        validTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const today = new Date();

            today.setDate(now.getDate() - 1);
            return (
                transactionDate >= today
            );
        });
    } else if (filterDate.toLowerCase() === 'week') {
        validTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const today = new Date();
            const monthAgo = new Date();

            today.setDate(now.getDate() - 1);
            monthAgo.setMonth(now.getMonth() - 1);

            return transactionDate > monthAgo && today > transactionDate;
        });
    } else if (filterDate.toLowerCase() === 'month') {
        validTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const monthAgo = new Date();
            monthAgo.setMonth(now.getMonth() - 1);
            return transactionDate <= monthAgo;
        });
    } else {
        // Fallback if filter is not recognized
        validTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate <= now;
        });
    }

    // Limit to 9 most recent transactions
    validTransactions.slice(0, 9).forEach(transaction => {
        const row = document.createElement('tr');

        // yung normal na new Date(transaction.date) is naka based lang sa local browser
        const date = new Date(new Date(transaction.date).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
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

function prepareChartData(transactions, filterDate) {
    const now = new Date();
    let validTransactions = [];

    // Apply the same filtering logic as in displayTransactions()
    if (filterDate.toLowerCase() === 'day') {
        validTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const today = new Date();
            today.setDate(now.getDate() - 1);
            return transactionDate >= today;
        });
    } else if (filterDate.toLowerCase() === 'week') {
        validTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const today = new Date();
            const monthAgo = new Date();
            today.setDate(now.getDate() - 1);
            monthAgo.setMonth(now.getMonth() - 1);
            return transactionDate > monthAgo && today > transactionDate;
        });
    } else if (filterDate.toLowerCase() === 'month') {
        validTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const monthAgo = new Date();
            monthAgo.setMonth(now.getMonth() - 1);
            return transactionDate <= monthAgo;
        });
    } else {
        validTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate <= now;
        });
    }

    // Limit to 9 most recent transactions (same as the table)
    validTransactions = validTransactions.slice(0, 9);

    // Now prepare the chart data based on these filtered transactions
    const chartData = {};

    validTransactions.forEach(transaction => {
        const date = new Date(new Date(transaction.date).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        let key;

        if (filterDate.toLowerCase() === 'day') {
            // For day view, show exact time
            key = date.toLocaleTimeString();
        } else if (filterDate.toLowerCase() === 'week') {
            // For week view, show day names
            key = date.toLocaleDateString('en-US', { weekday: 'short' });
        } else {
            // For month view, show month/day
            key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        chartData[key] = (chartData[key] || 0) + (transaction.totalAmount || 0);
    });

    renderChart(chartData, filterDate);
}

function setupEventListeners() {
    // Filter buttons for recent sales
    document.querySelectorAll('[data-recent-filter]').forEach(btn => {
        btn.addEventListener('click', function () {
            const parent = this.parentElement;
            parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            RecentSalesFilter = this.dataset.recentFilter;
            loadShopTransactions(RecentSalesFilter);
        });
    });

    // Print functionality
    const printInventoryBtn = getElement('printInventoryBtn');
    if (printInventoryBtn) {
        printInventoryBtn.addEventListener('click', handlePrint);
    }

    // Logout functionality
    const logoutBtn = getElement('logout_btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
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

// Chart rendering functions
function renderChart(chartData, filterDate) {
    const ctx = getElement('salesChart');
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');

    // Destroy previous chart if it exists
    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    // Prepare labels and data
    const labels = Object.keys(chartData);
    const data = Object.values(chartData);

    if (labels.length > 0 && data.length > 0) {
        salesChartInstance = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Sales (₱)',
                    data: data,
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return '₱' + context.raw.toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false
                        },
                        ticks: {
                            callback: function (value) {
                                return '₱' + value.toLocaleString();
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 10,
                        right: 15,
                        bottom: 10,
                        left: 15
                    }
                }
            }
        });
    } else {
        // Display a message when no data is available
        chartCtx.font = '16px Arial';
        chartCtx.fillStyle = '#666';
        chartCtx.textAlign = 'center';
        chartCtx.fillText('No sales data available for this period', chartCtx.canvas.width / 2, chartCtx.canvas.height / 2);
    }
}

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

// Print functionality
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
        alert('Failed to generate PDF. Please try again.');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

// Cleanup function if needed
function cleanup() {
    if (window.inventoryUnsubscribe) {
        window.inventoryUnsubscribe();
    }
    
    // Destroy charts
    if (salesChartInstance) {
        salesChartInstance.destroy();
    }
    if (inventoryChart) {
        inventoryChart.destroy();
    }
}

// Export for potential cleanup
window.cleanupAnalytics = cleanup;