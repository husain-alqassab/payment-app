// Global state
let totalPayments = 0;
let totalAmount = 0;
let currentPaymentId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeAnimations();
    initializeFormValidation();
    animateStats();
    initializeInputEffects();
    initializeTabs();
    initializeCurrencyConverter();
    loadStatistics();
});

// Initialize animations
function initializeAnimations() {
    // Add entrance animations to elements
    const elements = document.querySelectorAll('.feature-card, .stat-item');
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'all 0.6s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 200 + (index * 100));
    });
}

// Animate statistics counters
function animateStats() {
    animateCounter('totalPayments', 0, 1247, 2000);
    animateCounter('totalAmount', 0, 89450, 2000, true);
}

function animateCounter(elementId, start, end, duration, isCurrency = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            clearInterval(timer);
        }
        
        if (isCurrency) {
            element.textContent = '$' + Math.floor(current).toLocaleString();
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
    }, 16);
}

// Initialize form validation and effects
function initializeFormValidation() {
    const form = document.getElementById('paymentForm');
    const inputs = form.querySelectorAll('input, select, textarea');
    
    // Add input effects
    inputs.forEach(input => {
        // Focus effects
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
            validateField(this);
        });
        
        // Real-time validation
        input.addEventListener('input', function() {
            validateField(this);
        });
    });
}

// Initialize input effects
function initializeInputEffects() {
    const inputs = document.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
        // Add floating label effect
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('input-focused');
        });
        
        input.addEventListener('blur', function() {
            if (this.value === '') {
                this.parentElement.classList.remove('input-focused');
            }
        });
    });
}

// Validate individual field
function validateField(field) {
    const formGroup = field.closest('.form-group');
    if (!formGroup) return;
    
    let isValid = true;
    const value = field.value.trim();
    
    // Required field validation
    if (field.hasAttribute('required') && value === '') {
        isValid = false;
    }
    
    // Email validation
    if (field.type === 'email' && value !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        isValid = emailRegex.test(value);
    }
    
    // Amount validation
    if (field.type === 'number' && field.id === 'amount') {
        const amount = parseFloat(value);
        if (isNaN(amount) || amount <= 0) {
            isValid = false;
        }
    }
    
    // Update visual feedback
    if (isValid) {
        formGroup.classList.add('valid');
        formGroup.classList.remove('invalid');
    } else {
        formGroup.classList.add('invalid');
        formGroup.classList.remove('valid');
    }
    
    return isValid;
}

// Form submission handler
document.getElementById('paymentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Validate all fields
    const inputs = this.querySelectorAll('input[required], select[required]');
    let isFormValid = true;
    
    inputs.forEach(input => {
        if (!validateField(input)) {
            isFormValid = false;
            // Shake animation for invalid fields
            const formGroup = input.closest('.form-group');
            formGroup.style.animation = 'shake 0.5s ease-in-out';
            setTimeout(() => {
                formGroup.style.animation = '';
            }, 500);
        }
    });
    
    if (!isFormValid) {
        displayError('Please fill in all required fields correctly');
        return;
    }
    
    // Show loading state
    const submitBtn = this.querySelector('.btn-submit');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    
    const formData = {
        customerName: document.getElementById('customerName').value,
        email: document.getElementById('email').value,
        amount: document.getElementById('amount').value,
        currency: document.getElementById('currency').value,
        description: document.getElementById('description').value
    };

    try {
        const response = await fetch('/api/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            // Update stats
            totalPayments++;
            totalAmount += parseFloat(data.payment.amount);
            animateCounter('totalPayments', parseInt(document.getElementById('totalPayments').textContent.replace(/,/g, '')), totalPayments, 1000);
            animateCounter('totalAmount', parseInt(document.getElementById('totalAmount').textContent.replace(/[$,]/g, '')), totalAmount, 1000, true);
            
            displayResult(data.payment);
        } else {
            displayError(data.error || 'Failed to generate payment');
        }
    } catch (error) {
        displayError('Network error: ' + error.message);
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

// Display result with animation
function displayResult(payment) {
    const form = document.getElementById('paymentForm');
    const result = document.getElementById('result');
    const error = document.getElementById('error');
    
    // Hide form with animation
    form.style.opacity = '0';
    form.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
        form.classList.add('hidden');
        form.style.opacity = '';
        form.style.transform = '';
        
        // Show result
        error.classList.add('hidden');
        result.classList.remove('hidden');
        
        // Populate data
        document.getElementById('paymentId').textContent = payment.paymentId;
        document.getElementById('resultCustomer').textContent = payment.customerName;
        document.getElementById('resultAmount').textContent = formatCurrency(payment.amount, payment.currency);
        document.getElementById('resultStatus').textContent = payment.status;
        document.getElementById('resultCreated').textContent = formatDate(payment.createdAt);
        document.getElementById('resultExpires').textContent = formatDate(payment.expiryDate);
        
        // Trigger success animation
        triggerConfetti();
    }, 300);
}

// Format currency
function formatCurrency(amount, currency) {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    });
    return formatter.format(amount);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

// Display error with animation
function displayError(message) {
    const errorDiv = document.getElementById('error');
    const errorMessage = errorDiv.querySelector('.error-message');
    
    errorMessage.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

// Reset form with animation
function resetForm() {
    const form = document.getElementById('paymentForm');
    const result = document.getElementById('result');
    const error = document.getElementById('error');
    
    // Hide result
    result.style.opacity = '0';
    result.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        result.classList.add('hidden');
        result.style.opacity = '';
        result.style.transform = '';
        
        // Reset and show form
        form.reset();
        form.classList.remove('hidden');
        
        // Remove validation states
        const formGroups = form.querySelectorAll('.form-group');
        formGroups.forEach(group => {
            group.classList.remove('valid', 'invalid', 'focused');
        });
        
        // Animate form in
        form.style.opacity = '0';
        form.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            form.style.transition = 'all 0.5s ease';
            form.style.opacity = '1';
            form.style.transform = 'translateY(0)';
        }, 50);
        
        error.classList.add('hidden');
    }, 300);
}

// Copy payment link to clipboard
function copyPaymentLink() {
    const paymentId = document.getElementById('paymentId').textContent;
    const paymentLink = `${window.location.origin}/payment/${paymentId}`;
    
    navigator.clipboard.writeText(paymentLink).then(() => {
        showCopyFeedback();
    }).catch(err => {
        console.error('Failed to copy:', err);
        displayError('Failed to copy link to clipboard');
    });
}

// Show copy feedback
function showCopyFeedback() {
    const copyBtn = document.querySelector('.btn-primary');
    const originalText = copyBtn.innerHTML;
    
    copyBtn.innerHTML = '<span class="btn-icon">✓</span> Copied!';
    copyBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    
    setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.style.background = '';
    }, 2000);
}

// Simple confetti effect
function triggerConfetti() {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
        createConfetti(colors[Math.floor(Math.random() * colors.length)]);
    }
}

function createConfetti(color) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${color};
        left: ${Math.random() * 100}vw;
        top: -10px;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        animation: confettiFall ${2 + Math.random() * 2}s linear forwards;
    `;
    
    document.body.appendChild(confetti);
    
    setTimeout(() => {
        confetti.remove();
    }, 4000);
}

// Add confetti animation to page
const style = document.createElement('style');
style.textContent = `
    @keyframes confettiFall {
        to {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Add smooth scroll behavior
document.documentElement.style.scrollBehavior = 'smooth';

// Add keyboard navigation
document.addEventListener('keydown', function(e) {
    // Escape key to close error
    if (e.key === 'Escape') {
        const errorDiv = document.getElementById('error');
        if (!errorDiv.classList.contains('hidden')) {
            errorDiv.classList.add('hidden');
        }
    }
    
    // Ctrl+Enter to submit form
    if (e.ctrlKey && e.key === 'Enter') {
        const form = document.getElementById('paymentForm');
        if (!form.classList.contains('hidden')) {
            form.dispatchEvent(new Event('submit'));
        }
    }
});

// Tab navigation
function initializeTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // Remove active class from all tabs and panes
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    // Add active class to selected tab and pane
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // Load statistics when switching to stats tab
    if (tabId === 'stats') {
        loadStatistics();
    }
}

// Currency converter
function initializeCurrencyConverter() {
    const form = document.getElementById('currencyForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const amount = document.getElementById('convertAmount').value;
        const fromCurrency = document.getElementById('fromCurrency').value;
        const toCurrency = document.getElementById('toCurrency').value;
        
        if (!amount || !fromCurrency || !toCurrency) {
            displayError('Please fill in all fields');
            return;
        }
        
        try {
            const response = await fetch('/api/currency/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    fromCurrency: fromCurrency,
                    toCurrency: toCurrency
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                displayConversionResult(data);
            } else {
                displayError(data.error || 'Conversion failed');
            }
        } catch (error) {
            displayError('Network error: ' + error.message);
        }
    });
}

function displayConversionResult(data) {
    document.getElementById('originalAmount').textContent = 
        `${data.originalCurrency} ${data.originalAmount.toFixed(2)}`;
    document.getElementById('convertedAmount').textContent = 
        `${data.targetCurrency} ${data.convertedAmount.toFixed(2)}`;
    document.getElementById('exchangeRate').textContent = 
        `1 ${data.originalCurrency} = ${data.rate.toFixed(4)} ${data.targetCurrency}`;
    
    document.getElementById('conversionResult').classList.remove('hidden');
}

// Payment management
async function searchPayments() {
    const searchTerm = document.getElementById('searchPayment').value.trim();
    
    if (!searchTerm) {
        displayError('Please enter a payment ID or email');
        return;
    }
    
    try {
        let response;
        let data;
        
        // Check if search term looks like a UUID (payment ID)
        if (searchTerm.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            response = await fetch(`/api/payments/${searchTerm}`);
            data = await response.json();
            
            if (data.success) {
                displayPaymentDetails(data.payment);
            } else {
                displayError(data.error || 'Payment not found');
            }
        } else {
            // Search by email
            response = await fetch(`/api/customers/${searchTerm}/payments`);
            data = await response.json();
            
            if (data.success) {
                displayPaymentList(data.payments);
            } else {
                displayError(data.error || 'No payments found');
            }
        }
    } catch (error) {
        displayError('Network error: ' + error.message);
    }
}

function displayPaymentList(payments) {
    const resultsDiv = document.getElementById('paymentResults');
    const detailsDiv = document.getElementById('paymentDetails');
    
    if (payments.length === 0) {
        displayError('No payments found');
        return;
    }
    
    let html = '<h3>Payment Results</h3><div class="payment-list">';
    
    payments.forEach(payment => {
        html += `
            <div class="payment-item" onclick="showPaymentDetails('${payment.paymentId}')">
                <div class="payment-summary">
                    <span class="payment-id-short">${payment.paymentId.substring(0, 8)}...</span>
                    <span class="payment-amount">${formatCurrency(payment.amount, payment.currency)}</span>
                    <span class="payment-status status-${payment.status}">${payment.status}</span>
                </div>
                <div class="payment-meta">
                    <span>${payment.customerName}</span>
                    <span>${formatDate(payment.createdAt)}</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    resultsDiv.innerHTML = html;
    resultsDiv.classList.remove('hidden');
    detailsDiv.classList.add('hidden');
}

async function showPaymentDetails(paymentId) {
    try {
        const response = await fetch(`/api/payments/${paymentId}`);
        const data = await response.json();
        
        if (data.success) {
            displayPaymentDetails(data.payment);
        } else {
            displayError(data.error || 'Payment not found');
        }
    } catch (error) {
        displayError('Network error: ' + error.message);
    }
}

function displayPaymentDetails(payment) {
    const detailsDiv = document.getElementById('paymentDetails');
    const resultsDiv = document.getElementById('paymentResults');
    
    currentPaymentId = payment.paymentId;
    
    let actionButtons = '';
    
    if (payment.status === 'pending') {
        actionButtons = `
            <button class="btn-action btn-complete" onclick="completePayment('${payment.paymentId}')">
                ✅ Complete Payment
            </button>
            <button class="btn-action btn-cancel" onclick="cancelPayment('${payment.paymentId}')">
                ❌ Cancel Payment
            </button>
        `;
    }
    
    detailsDiv.innerHTML = `
        <h3>Payment Details</h3>
        <div class="payment-details-card">
            <div class="detail-row">
                <span class="detail-label">Payment ID</span>
                <span class="detail-value">${payment.paymentId}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Customer</span>
                <span class="detail-value">${payment.customerName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Email</span>
                <span class="detail-value">${payment.email}</span>
            </div>
            <div class="detail-row highlight">
                <span class="detail-label">Amount</span>
                <span class="detail-value amount">${formatCurrency(payment.amount, payment.currency)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value status status-${payment.status}">${payment.status}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Description</span>
                <span class="detail-value">${payment.description}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Created</span>
                <span class="detail-value">${formatDate(payment.createdAt)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Expires</span>
                <span class="detail-value">${formatDate(payment.expiryDate)}</span>
            </div>
            ${payment.completedAt ? `
            <div class="detail-row">
                <span class="detail-label">Completed</span>
                <span class="detail-value">${formatDate(payment.completedAt)}</span>
            </div>
            ` : ''}
            ${payment.cancelledAt ? `
            <div class="detail-row">
                <span class="detail-label">Cancelled</span>
                <span class="detail-value">${formatDate(payment.cancelledAt)}</span>
            </div>
            ` : ''}
        </div>
        <div class="action-buttons">
            ${actionButtons}
            <button class="btn-secondary" onclick="closePaymentDetails()">
                Close
            </button>
        </div>
    `;
    
    resultsDiv.classList.add('hidden');
    detailsDiv.classList.remove('hidden');
}

function closePaymentDetails() {
    document.getElementById('paymentDetails').classList.add('hidden');
    document.getElementById('paymentResults').classList.remove('hidden');
    currentPaymentId = null;
}

async function completePayment(paymentId) {
    if (!confirm('Are you sure you want to complete this payment?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/payments/${paymentId}/complete`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayPaymentDetails(data.payment);
            showCopyFeedbackComplete();
        } else {
            displayError(data.error || 'Failed to complete payment');
            // Refresh details anyway
            showPaymentDetails(paymentId);
        }
    } catch (error) {
        displayError('Network error: ' + error.message);
    }
}

async function cancelPayment(paymentId) {
    if (!confirm('Are you sure you want to cancel this payment?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/payments/${paymentId}/cancel`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayPaymentDetails(data.payment);
            showCopyFeedbackCancel();
        } else {
            displayError(data.error || 'Failed to cancel payment');
            // Refresh details anyway
            showPaymentDetails(paymentId);
        }
    } catch (error) {
        displayError('Network error: ' + error.message);
    }
}

function showCopyFeedbackComplete() {
    showTemporaryMessage('Payment completed successfully!', '#10b981');
}

function showCopyFeedbackCancel() {
    showTemporaryMessage('Payment cancelled successfully!', '#ef4444');
}

function showTemporaryMessage(message, color) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// Statistics
async function loadStatistics() {
    try {
        const response = await fetch('/api/payments/stats');
        const data = await response.json();
        
        if (data.success) {
            displayStatistics(data.stats);
        } else {
            displayError(data.error || 'Failed to load statistics');
        }
    } catch (error) {
        displayError('Network error: ' + error.message);
    }
}

function displayStatistics(stats) {
    document.getElementById('statTotalPayments').textContent = stats.total;
    document.getElementById('statTotalAmount').textContent = formatCurrency(stats.totalAmount, 'USD');
    document.getElementById('statAverageAmount').textContent = formatCurrency(stats.averageAmount, 'USD');
    
    // Status breakdown
    let statusHtml = '';
    const statusColors = {
        pending: '#f59e0b',
        completed: '#10b981',
        failed: '#ef4444',
        cancelled: '#6b7280',
        expired: '#8b5cf6'
    };
    
    Object.entries(stats.byStatus).forEach(([status, count]) => {
        statusHtml += `
            <div class="status-item">
                <span class="status-label">${status}</span>
                <span class="status-count" style="color: ${statusColors[status] || '#6b7280'}">${count}</span>
            </div>
        `;
    });
    
    document.getElementById('statusBreakdown').innerHTML = statusHtml;
    
    // Currency breakdown
    let currencyHtml = '';
    Object.entries(stats.byCurrency).forEach(([currency, count]) => {
        currencyHtml += `
            <div class="currency-item">
                <span class="currency-label">${currency}</span>
                <span class="currency-count">${count}</span>
            </div>
        `;
    });
    
    document.getElementById('currencyBreakdown').innerHTML = currencyHtml;
    
    document.getElementById('statisticsResults').classList.remove('hidden');
}

// Add slide animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);