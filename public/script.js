// Global state
let totalPayments = 0;
let totalAmount = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeAnimations();
    initializeFormValidation();
    animateStats();
    initializeInputEffects();
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