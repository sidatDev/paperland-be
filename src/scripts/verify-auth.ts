import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function verifyAuth() {
  try {
    const email = process.env.TEST_ADMIN_EMAIL || 'admin@paperland.com.pk';
    const password = process.env.TEST_ADMIN_PASSWORD || 'admin123';
    const apiUrl = process.env.API_URL || 'http://localhost:3001';

    console.log(`Attempting login with ${email}...`);
    const response = await axios.post(`${apiUrl}/api/v1/admin/auth/login`, {
      email,
      password
    });

    console.log('Login Successful!');
    console.log('Token:', response.data.token ? 'RECEIVED' : 'MISSING');
    console.log('User Role:', response.data.user.role);

    if (response.data.user.role === 'SUPER_ADMIN') {
        console.log('TEST PASSED: Admin role verified.');
    } else {
        console.error('TEST FAILED: Incorrect role.');
        process.exit(1);
    }

  } catch (error: any) {
    console.error('Login Failed:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

verifyAuth();
