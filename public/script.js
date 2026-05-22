document.getElementById('paymentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        customerName: document.getElementById('customerName').value,
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
            displayResult(data.payment);
        } else {
            displayError(data.error || 'Failed to generate payment');
        }
    } catch (error) {
        displayError('Network error: ' + error.message);
    }
});

function displayResult(payment) {
    document.getElementById('paymentForm').classList.add('hidden');
    document.getElementById('result').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');

    document.getElementById('paymentId').textContent = payment.paymentId;
    document.getElementById('resultCustomer').textContent = payment.customerName;
    document.getElementById('resultAmount').textContent = `${payment.amount} ${payment.currency}`;
    document.getElementById('resultStatus').textContent = payment.status;
    document.getElementById('resultCreated').textContent = new Date(payment.createdAt).toLocaleString();
    document.getElementById('resultExpires').textContent = new Date(payment.expiryDate).toLocaleString();
}

function displayError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function resetForm() {
    document.getElementById('paymentForm').reset();
    document.getElementById('paymentForm').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
}