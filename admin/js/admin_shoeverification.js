import { 
    checkUserAuth, 
    logoutUser, 
    readDataRealtime, 
    updateData,
    sendEmail
} from '../../firebaseMethods.js';

// Global variables
let currentUser = null;
let allValidations = [];
let shopData = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    initializeAppFunctionality();
    setupAuthStateListener();

    // Initialize date range picker
    $('#dateFilter').daterangepicker({
        maxDate: moment(), // Disable future dates
        ranges: {
            'Today': [moment(), moment()],
            'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            'Last 7 Days': [moment().subtract(6, 'days'), moment()],
            'Last 30 Days': [moment().subtract(29, 'days'), moment()],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        },
        "alwaysShowCalendars": true,
        "opens": "left",
        "autoUpdateInput": false,
        "linkedCalendars": false,
        "locale": {
            "cancelLabel": 'Clear',
            "format": "MM/DD/YYYY"
        }
    });

    // Handle date range selection
    $('#dateFilter').on('apply.daterangepicker', function (ev, picker) {
        $(this).val(picker.startDate.format('MM/DD/YYYY') + ' - ' + picker.endDate.format('MM/DD/YYYY'));
    });

    // Handle clearing the date range
    $('#dateFilter').on('cancel.daterangepicker', function (ev, picker) {
        $(this).val('');
    });
});

function initializeAppFunctionality() {
    // Mobile menu toggle
    const menuBtn = document.querySelector('.menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const overlay = document.getElementById('overlay');

    if (menuBtn && navLinks && overlay) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            overlay.style.display = navLinks.classList.contains('active') ? 'block' : 'none';
        });

        overlay.addEventListener('click', () => {
            navLinks.classList.remove('active');
            overlay.style.display = 'none';
        });
    }

    // Clear history functionality
    const clearHistoryBtn = document.getElementById('clearHistory');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.nav-tab.active');
            if (activeTab) {
                const tabName = activeTab.getAttribute('data-tab');
                if (confirm(`Are you sure you want to clear all ${tabName} history? This action cannot be undone.`)) {
                    clearHistory(tabName);
                }
            }
        });
    }

    // Filter functionality
    const applyFilters = document.getElementById('applyFilters');
    const clearFilters = document.getElementById('clearFilters');

    if (applyFilters) {
        applyFilters.addEventListener('click', () => {
            const shopFilter = document.getElementById('shopFilter').value;
            const statusFilter = document.getElementById('statusFilter').value;
            const dateFilter = document.getElementById('dateFilter').value;

            applyFiltersFunction(shopFilter, statusFilter, dateFilter);
        });
    }

    if (clearFilters) {
        clearFilters.addEventListener('click', () => {
            document.getElementById('shopFilter').value = '';
            document.getElementById('statusFilter').value = '';
            document.getElementById('dateFilter').value = '';
            // Reset daterangepicker
            $('#dateFilter').data('daterangepicker').setStartDate(moment());
            $('#dateFilter').data('daterangepicker').setEndDate(moment());

            // Reset bulk actions visibility
            const bulkActions = document.getElementById('bulkActions');
            const clearHistoryContainer = document.getElementById('clearHistoryContainer');
            if (bulkActions) bulkActions.style.display = 'none';
            if (clearHistoryContainer) clearHistoryContainer.style.display = 'none';

            // Reload all data
            loadValidationData();
        });
    }
}

// Logout functionality
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            logoutUser().then((result) => {
                if (result.success) {
                    window.location.href = '/admin/html/admin_login.html';
                } else {
                    alert('Logout error: ' + result.error);
                }
            });
        }
    });
}

function setupAuthStateListener() {
    // Use the checkUserAuth method from firebaseMethods
    checkUserAuth().then((authResult) => {
        if (authResult.authenticated && authResult.role === "admin") {
            currentUser = {
                uid: authResult.userId,
                role: authResult.role
            };
            loadShopData();
            loadValidationData();
        } else {
            window.location.href = "/admin/html/admin_login.html";
        }
    }).catch((error) => {
        console.error('Auth error:', error);
        window.location.href = "/admin/html/admin_login.html";
    });
}

function loadShopData() {
    // Use readDataRealtime from firebaseMethods
    const unsubscribe = readDataRealtime('smartfit_AR_Database/shop', (result) => {
        if (result.success) {
            shopData = result.data || {};
            populateShopFilter();
        } else {
            console.error('Error loading shop data:', result.error);
            shopData = {};
        }
    });
}

function populateShopFilter() {
    const shopFilter = document.getElementById('shopFilter');

    if (!shopFilter) return;

    // Clear existing options except the first one
    while (shopFilter.options.length > 1) {
        shopFilter.remove(1);
    }

    // Add shop options
    Object.entries(shopData).forEach(([shopId, shop]) => {
        if (shop.status === 'approved') {
            const option = document.createElement('option');
            option.value = shopId;
            option.textContent = `${shop.shopName} (ID: ${shopId.substring(0, 6)}...)`;
            shopFilter.appendChild(option);
        }
    });
}

function loadValidationData() {
    // Use readDataRealtime from firebaseMethods
    const unsubscribe = readDataRealtime('smartfit_AR_Database/shoeVerification', (result) => {
        if (result.success && result.data) {
            allValidations = Object.entries(result.data).map(([key, value]) => ({
                id: key,
                ...value
            }));

            // Initialize with ALL validations
            updateTable('all');

            // Hide bulk actions initially
            const bulkActions = document.getElementById('bulkActions');
            if (bulkActions) bulkActions.style.display = 'none';
        } else {
            allValidations = [];
            const tableBody = document.getElementById('tableBody');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No validation data found</td></tr>';
            }

            // Hide bulk actions if no data
            const bulkActions = document.getElementById('bulkActions');
            if (bulkActions) bulkActions.style.display = 'none';
        }
    });
}

function updateTable(tabName) {
    const tableBody = document.getElementById('tableBody');
    const tableTitle = document.getElementById('tableTitle');
    const bulkActions = document.getElementById('bulkActions');
    const clearHistoryContainer = document.getElementById('clearHistoryContainer');

    if (!tableBody) return;

    // Clear existing table content
    tableBody.innerHTML = '';

    // Filter validations based on tab
    let filteredValidations = allValidations;
    let showBulkActions = false;

    if (tabName === 'pending') {
        filteredValidations = allValidations.filter(v => v.status === 'pending');
        showBulkActions = filteredValidations.length > 0;
        if (clearHistoryContainer) clearHistoryContainer.style.display = 'none';
    } else if (tabName === 'verified') {
        filteredValidations = allValidations.filter(v => v.status === 'verified');
        showBulkActions = false;
        if (clearHistoryContainer) clearHistoryContainer.style.display = 'flex';
    } else if (tabName === 'invalid') {
        filteredValidations = allValidations.filter(v => v.status === 'invalid');
        showBulkActions = false;
        if (clearHistoryContainer) clearHistoryContainer.style.display = 'flex';
    } else if (tabName === 'all') {
        filteredValidations = allValidations;
        showBulkActions = false;
        if (clearHistoryContainer) clearHistoryContainer.style.display = 'none';
    }

    // Update table title
    if (tableTitle) {
        tableTitle.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    }

    // Show/hide bulk actions based on tab and content
    if (bulkActions) {
        bulkActions.style.display = showBulkActions ? 'flex' : 'none';
    }

    if (filteredValidations.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No validation data found</td></tr>';
        return;
    }

    // Sort by submission date (newest first)
    filteredValidations.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));

    // Populate table with data
    filteredValidations.forEach(validation => {
        const row = document.createElement('tr');

        // Format date for display
        const submittedDate = new Date(validation.submittedDate);
        const formattedDate = submittedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Get shop name
        const shopName = shopData[validation.shopId] ?
            `${shopData[validation.shopId].shopName} (ID: ${validation.shopId.substring(0, 6)}...)` :
            `Unknown Shop (ID: ${validation.shopId})`;

        // Determine status class and display text
        let statusClass = 'status-pending';
        let statusText = 'Pending';

        if (validation.status === 'verified') {
            statusClass = 'status-legit';
            statusText = 'Verified';
        } else if (validation.status === 'invalid') {
            statusClass = 'status-fake';
            statusText = 'Invalid';
        }

        // Add checkbox only for pending items in the pending tab
        if (validation.status === 'pending' && tabName === 'pending') {
            row.innerHTML = `
                <td><input type="checkbox" class="shoe-checkbox" data-id="${validation.id}"></td>
                <td>${shopName}</td>
                <td>${validation.serialNumber}</td>
                <td>${validation.shoeModel}</td>
                <td>${formattedDate}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-view view-details" data-id="${validation.id}">
                        <i class="fas fa-eye"></i> Review
                    </button>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td></td>
                <td>${shopName}</td>
                <td>${validation.serialNumber}</td>
                <td>${validation.shoeModel}</td>
                <td>${formattedDate}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-view view-details" data-id="${validation.id}">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </td>
            `;
        }

        tableBody.appendChild(row);
    });

    // Reattach event listeners
    attachEventListeners();
}

function applyFiltersFunction(shopFilter, statusFilter, dateFilter) {
    let filteredValidations = allValidations;
    const bulkActions = document.getElementById('bulkActions');
    const clearHistoryContainer = document.getElementById('clearHistoryContainer');

    // Apply shop filter
    if (shopFilter) {
        filteredValidations = filteredValidations.filter(v => v.shopId === shopFilter);
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
        let statusValue = statusFilter;
        if (statusFilter === 'verified') statusValue = 'verified';
        if (statusFilter === 'invalid') statusValue = 'invalid';
        if (statusFilter === 'pending') statusValue = 'pending';

        filteredValidations = filteredValidations.filter(v => v.status === statusValue);
    }

    // Apply date filter
    if (dateFilter) {
        const [startDateStr, endDateStr] = dateFilter.split(' - ');
        const startDate = moment(startDateStr, 'MM/DD/YYYY').startOf('day');
        const endDate = moment(endDateStr, 'MM/DD/YYYY').endOf('day');

        filteredValidations = filteredValidations.filter(v => {
            const submittedDate = moment(v.submittedDate);
            return submittedDate.isBetween(startDate, endDate, null, '[]');
        });
    }

    // Show/hide bulk actions based on whether we're showing pending items
    if (statusFilter === 'pending') {
        const hasPendingItems = filteredValidations.length > 0;
        if (bulkActions) bulkActions.style.display = hasPendingItems ? 'flex' : 'none';
        if (clearHistoryContainer) clearHistoryContainer.style.display = 'none';
    } else if (statusFilter === 'verified' || statusFilter === 'invalid') {
        if (bulkActions) bulkActions.style.display = 'none';
        if (clearHistoryContainer) clearHistoryContainer.style.display = 'flex';
    } else {
        // For "all" or no status filter, HIDE bulk actions completely
        if (bulkActions) bulkActions.style.display = 'none';
        if (clearHistoryContainer) clearHistoryContainer.style.display = 'none';
    }

    // Update table with filtered data
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (filteredValidations.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No matching validations found</td></tr>';
        return;
    }

    // Sort by submission date (newest first)
    filteredValidations.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));

    // Populate table with filtered data
    filteredValidations.forEach(validation => {
        const row = document.createElement('tr');

        // Format date for display
        const submittedDate = new Date(validation.submittedDate);
        const formattedDate = submittedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Get shop name
        const shopName = shopData[validation.shopId] ?
            `${shopData[validation.shopId].shopName} (ID: ${validation.shopId.substring(0, 6)}...)` :
            `Unknown Shop (ID: ${validation.shopId})`;

        // Determine status class and display text
        let statusClass = 'status-pending';
        let statusText = 'Pending';

        if (validation.status === 'verified') {
            statusClass = 'status-legit';
            statusText = 'Verified';
        } else if (validation.status === 'invalid') {
            statusClass = 'status-fake';
            statusText = 'Invalid';
        }

        // Add checkbox only for pending items
        if (validation.status === 'pending') {
            row.innerHTML = `
                <td><input type="checkbox" class="shoe-checkbox" data-id="${validation.id}"></td>
                <td>${shopName}</td>
                <td>${validation.serialNumber}</td>
                <td>${validation.shoeModel}</td>
                <td>${formattedDate}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-view view-details" data-id="${validation.id}">
                        <i class="fas fa-eye"></i> Review
                    </button>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td></td>
                <td>${shopName}</td>
                <td>${validation.serialNumber}</td>
                <td>${validation.shoeModel}</td>
                <td>${formattedDate}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-view view-details" data-id="${validation.id}">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </td>
            `;
        }

        tableBody.appendChild(row);
    });

    // Reattach event listeners
    attachEventListeners();
}

function attachEventListeners() {
    // Modal functionality
    const modal = document.getElementById('validationModal');
    const closeModal = document.querySelector('.modal-close');
    const viewButtons = document.querySelectorAll('.view-details');
    const overlay = document.getElementById('overlay');

    // Add event listeners to view buttons
    if (viewButtons.length > 0) {
        viewButtons.forEach(button => {
            // Remove any existing event listeners
            button.replaceWith(button.cloneNode(true));

            // Get the new button reference
            const newButton = document.querySelector(`.view-details[data-id="${button.getAttribute('data-id')}"]`);

            // Add click event listener
            newButton.addEventListener('click', function () {
                const id = this.getAttribute('data-id');
                const validation = allValidations.find(v => v.id === id);

                if (validation) {
                    showValidationDetails(validation);
                    if (modal) modal.classList.add('active');
                    if (overlay) overlay.style.display = 'block';
                }
            });
        });
    }

    // Close modal
    if (closeModal) {
        // Remove any existing event listeners
        closeModal.replaceWith(closeModal.cloneNode(true));
        const newCloseModal = document.querySelector('.modal-close');

        newCloseModal.addEventListener('click', () => {
            if (modal) modal.classList.remove('active');
            if (overlay) overlay.style.display = 'none';
        });
    }

    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                if (overlay) overlay.style.display = 'none';
            }
        });
    }

    // Approve shoe functionality
    const approveButton = document.querySelector('.approve-shoe');
    if (approveButton) {
        // Remove any existing event listeners
        approveButton.replaceWith(approveButton.cloneNode(true));
        const newApproveButton = document.querySelector('.approve-shoe');

        newApproveButton.addEventListener('click', function () {
            const validationId = this.getAttribute('data-id');
            if (validationId) {
                verifyValidation(validationId);
            }
        });
    }

    // Reject shoe functionality
    const rejectButton = document.querySelector('.reject-shoe');
    if (rejectButton) {
        // Remove any existing event listeners
        rejectButton.replaceWith(rejectButton.cloneNode(true));
        const newRejectButton = document.querySelector('.reject-shoe');

        newRejectButton.addEventListener('click', function () {
            const validationId = this.getAttribute('data-id');
            if (validationId) {
                const reasonInput = document.getElementById('rejectReason');
                const reason = reasonInput ? reasonInput.value : '';

                if (!reason) {
                    alert('Please provide a reason for marking as invalid.');
                    return;
                }

                invalidateValidation(validationId, reason);
            }
        });
    }

    // Select all checkboxes functionality
    const selectAllTable = document.getElementById('selectAllTable');
    const selectAll = document.getElementById('selectAll');

    if (selectAllTable) {
        // Remove any existing event listeners
        selectAllTable.replaceWith(selectAllTable.cloneNode(true));
        const newSelectAllTable = document.getElementById('selectAllTable');

        newSelectAllTable.addEventListener('change', function () {
            const checkboxes = document.querySelectorAll('.shoe-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });

            // Update the main select all checkbox
            if (selectAll) {
                selectAll.checked = this.checked;
            }
        });
    }

    if (selectAll) {
        // Remove any existing event listeners
        selectAll.replaceWith(selectAll.cloneNode(true));
        const newSelectAll = document.getElementById('selectAll');

        newSelectAll.addEventListener('change', function () {
            const checkboxes = document.querySelectorAll('.shoe-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });

            // Update the table header checkbox
            if (selectAllTable) {
                selectAllTable.checked = this.checked;
            }
        });
    }

    // Verify selected functionality
    const approveSelected = document.getElementById('approveSelected');
    if (approveSelected) {
        // Remove any existing event listeners
        approveSelected.replaceWith(approveSelected.cloneNode(true));
        const newApproveSelected = document.getElementById('approveSelected');

        newApproveSelected.addEventListener('click', function () {
            const selectedCheckboxes = document.querySelectorAll('.shoe-checkbox:checked');

            if (selectedCheckboxes.length === 0) {
                alert('Please select at least one shoe to verify.');
                return;
            }

            if (confirm(`Are you sure you want to verify ${selectedCheckboxes.length} selected shoes?`)) {
                const validationIds = Array.from(selectedCheckboxes).map(cb => {
                    return cb.getAttribute('data-id');
                }).filter(id => id !== null);

                if (validationIds.length > 0) {
                    verifyMultipleValidations(validationIds);
                }
            }
        });
    }

    // Invalidate selected functionality
    const rejectSelected = document.getElementById('rejectSelected');
    if (rejectSelected) {
        // Remove any existing event listeners
        rejectSelected.replaceWith(rejectSelected.cloneNode(true));
        const newRejectSelected = document.getElementById('rejectSelected');

        newRejectSelected.addEventListener('click', function () {
            const selectedCheckboxes = document.querySelectorAll('.shoe-checkbox:checked');

            if (selectedCheckboxes.length === 0) {
                alert('Please select at least one shoe to mark as invalid.');
                return;
            }

            const reason = prompt('Please provide a reason for marking as invalid:');
            if (!reason) {
                alert('Action cancelled. Please provide a reason to mark shoes as invalid.');
                return;
            }

            if (confirm(`Are you sure you want to mark ${selectedCheckboxes.length} selected shoes as invalid?`)) {
                const validationIds = Array.from(selectedCheckboxes).map(cb => {
                    return cb.getAttribute('data-id');
                }).filter(id => id !== null);

                if (validationIds.length > 0) {
                    invalidateMultipleValidations(validationIds, reason);
                }
            }
        });
    }
}

function showValidationDetails(validation) {
    // Format date for display
    const submittedDate = new Date(validation.submittedDate);
    const formattedDate = submittedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Get shop name
    const shopName = shopData[validation.shopId] ?
        `${shopData[validation.shopId].shopName} (ID: ${validation.shopId})` :
        `Unknown Shop (ID: ${validation.shopId})`;

    // Determine status class and display text
    let statusClass = 'status-pending';
    let statusText = 'Pending';

    if (validation.status === 'verified') {
        statusClass = 'status-legit';
        statusText = 'Verified';
    } else if (validation.status === 'invalid') {
        statusClass = 'status-fake';
        statusText = 'Invalid';
    }

    // Populate modal with data
    const modalShop = document.getElementById('modal-shop');
    const modalSerial = document.getElementById('modal-serial');
    const modalModel = document.getElementById('modal-model');
    const modalDate = document.getElementById('modal-date');
    const modalDescription = document.getElementById('modal-description');
    const modalStatus = document.getElementById('modal-status');
    const modalFront = document.getElementById('modal-front');
    const modalBack = document.getElementById('modal-back');
    const modalTop = document.getElementById('modal-top');

    if (modalShop) modalShop.textContent = shopName;
    if (modalSerial) modalSerial.textContent = validation.serialNumber;
    if (modalModel) modalModel.textContent = validation.shoeModel;
    if (modalDate) modalDate.textContent = formattedDate;
    if (modalDescription) modalDescription.textContent = validation.description || 'No description provided';

    // Update status
    if (modalStatus) {
        modalStatus.innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;
    }

    // Update images
    if (modalFront && validation.images?.front) modalFront.src = validation.images.front;
    if (modalBack && validation.images?.back) modalBack.src = validation.images.back;
    if (modalTop && validation.images?.top) modalTop.src = validation.images.top;

    // Show/hide rejection section and action buttons based on status
    const rejectionSection = document.getElementById('rejectionSection');
    const modalActions = document.getElementById('modalActions');
    const approveButton = document.querySelector('.approve-shoe');
    const rejectButton = document.querySelector('.reject-shoe');

    if (validation.status === 'pending') {
        if (rejectionSection) rejectionSection.style.display = 'block';
        if (modalActions) modalActions.style.display = 'flex';

        // Set data attributes for approve/reject buttons
        if (approveButton) approveButton.setAttribute('data-id', validation.id);
        if (rejectButton) rejectButton.setAttribute('data-id', validation.id);
    } else {
        if (rejectionSection) rejectionSection.style.display = 'none';
        if (modalActions) modalActions.style.display = 'none';
    }
}

function verifyValidation(validationId) {
    const updates = {
        status: 'verified',
        validatedDate: new Date().toISOString(),
        validatorId: currentUser.uid
    };

    // Use updateData from firebaseMethods
    updateData(`smartfit_AR_Database/shoeVerification/${validationId}`, updates)
        .then((result) => {
            if (result.success) {
                alert('Shoe has been verified successfully!');
                const modal = document.getElementById('validationModal');
                const overlay = document.getElementById('overlay');
                if (modal) modal.classList.remove('active');
                if (overlay) overlay.style.display = 'none';

                // Refresh the table
                const activeTab = document.querySelector('.nav-tab.active');
                if (activeTab) {
                    const tabName = activeTab.getAttribute('data-tab');
                    updateTable(tabName);
                }
            } else {
                throw new Error(result.error);
            }
        })
        .catch((error) => {
            console.error('Error verifying validation:', error);
            alert('Error verifying shoe: ' + error.message);
        });
}

function invalidateValidation(validationId, reason) {
    const updates = {
        status: 'invalid',
        validatedDate: new Date().toISOString(),
        validatorId: currentUser.uid,
        validationNotes: reason
    };

    // Use updateData from firebaseMethods
    updateData(`smartfit_AR_Database/shoeVerification/${validationId}`, updates)
        .then((result) => {
            if (result.success) {
                alert('Shoe has been marked as invalid successfully!');
                const modal = document.getElementById('validationModal');
                const overlay = document.getElementById('overlay');
                if (modal) modal.classList.remove('active');
                if (overlay) overlay.style.display = 'none';

                // Clear the rejection reason textarea
                const rejectReason = document.getElementById('rejectReason');
                if (rejectReason) rejectReason.value = '';

                // Refresh the table
                const activeTab = document.querySelector('.nav-tab.active');
                if (activeTab) {
                    const tabName = activeTab.getAttribute('data-tab');
                    updateTable(tabName);
                }
            } else {
                throw new Error(result.error);
            }
        })
        .catch((error) => {
            console.error('Error marking validation as invalid:', error);
            alert('Error marking shoe as invalid: ' + error.message);
        });
}

function verifyMultipleValidations(validationIds) {
    const promises = validationIds.map(id => {
        const updates = {
            status: 'verified',
            validatedDate: new Date().toISOString(),
            validatorId: currentUser.uid
        };
        return updateData(`smartfit_AR_Database/shoeVerification/${id}`, updates);
    });

    Promise.all(promises)
        .then((results) => {
            const successful = results.filter(r => r.success).length;
            alert(`${successful} shoes have been verified successfully!`);

            // Uncheck select all checkboxes
            const selectAll = document.getElementById('selectAll');
            const selectAllTable = document.getElementById('selectAllTable');
            if (selectAll) selectAll.checked = false;
            if (selectAllTable) selectAllTable.checked = false;

            // Refresh the table
            const activeTab = document.querySelector('.nav-tab.active');
            if (activeTab) {
                const tabName = activeTab.getAttribute('data-tab');
                updateTable(tabName);
            }
        })
        .catch((error) => {
            console.error('Error verifying multiple validations:', error);
            alert('Error verifying shoes: ' + error.message);
        });
}

function invalidateMultipleValidations(validationIds, reason) {
    const promises = validationIds.map(id => {
        const updates = {
            status: 'invalid',
            validatedDate: new Date().toISOString(),
            validatorId: currentUser.uid,
            validationNotes: reason
        };
        return updateData(`smartfit_AR_Database/shoeVerification/${id}`, updates);
    });

    Promise.all(promises)
        .then((results) => {
            const successful = results.filter(r => r.success).length;
            alert(`${successful} shoes have been marked as invalid.`);

            // Uncheck select all checkboxes
            const selectAll = document.getElementById('selectAll');
            const selectAllTable = document.getElementById('selectAllTable');
            if (selectAll) selectAll.checked = false;
            if (selectAllTable) selectAllTable.checked = false;

            // Refresh the table
            const activeTab = document.querySelector('.nav-tab.active');
            if (activeTab) {
                const tabName = activeTab.getAttribute('data-tab');
                updateTable(tabName);
            }
        })
        .catch((error) => {
            console.error('Error marking multiple validations as invalid:', error);
            alert('Error marking shoes as invalid: ' + error.message);
        });
}

function clearHistory(status) {
    let statusValue = status;
    if (status === 'verified') statusValue = 'verified';
    if (status === 'invalid') statusValue = 'invalid';

    // Find all validations with the specified status
    const validationsToDelete = allValidations
        .filter(v => v.status === statusValue)
        .map(v => v.id);

    if (validationsToDelete.length === 0) {
        alert(`No ${status} validations found to clear.`);
        return;
    }

    // Delete all validations with the specified status using updateData with null values
    const promises = validationsToDelete.map(id => {
        return updateData(`smartfit_AR_Database/shoeVerification/${id}`, null);
    });

    Promise.all(promises)
        .then((results) => {
            const successful = results.filter(r => r.success).length;
            alert(`Cleared ${successful} ${status} validations from history.`);

            // Refresh the table
            const activeTab = document.querySelector('.nav-tab.active');
            if (activeTab) {
                const tabName = activeTab.getAttribute('data-tab');
                updateTable(tabName);
            }
        })
        .catch((error) => {
            console.error('Error clearing history:', error);
            alert('Error clearing history: ' + error.message);
        });
}