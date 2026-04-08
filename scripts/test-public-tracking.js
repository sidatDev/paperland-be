const axios = require('axios');

async function testPublicTracking() {
    const orderNumber = 'PL-2024-51787'; // Example order number from previous logs or just a test string
    const apiUrl = 'http://localhost:3001/api/public/orders/track';

    console.log(`Testing public tracking for: ${orderNumber}`);
    try {
        const response = await axios.get(`${apiUrl}?search=${orderNumber}`);
        console.log('Status code:', response.status);
        if (response.data.success) {
            console.log('SUCCESS: API is public and returned data.');
            console.log('Order:', response.data.data.orderNumber);
        } else {
            console.log('API returned error but was reachable:', response.data.message);
        }
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log('SUCCESS: API is reachable but order not found (expected if ID is random).');
        } else if (error.response && error.response.status === 401) {
            console.error('FAILURE: API returned 401 Unauthorized. It is NOT public!');
        } else {
            console.error('ERROR:', error.message);
        }
    }
}

testPublicTracking();
