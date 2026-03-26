const fetch = require('node-fetch');

async function testBackend() {
  try {
    console.log('Testing if backend is running...');
    
    // Test a simple endpoint first
    const response = await fetch('http://localhost:5000/api/users/me', {
      headers: {
        'x-user-role': 'admin',
        'x-user-email': 'hadmin@edusmart.com'
      }
    });
    
    console.log('Status:', response.status);
    
    if (response.ok) {
      console.log('✅ Backend is running!');
    } else {
      console.log('❌ Backend responded with error:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Backend not reachable:', error.message);
  }
}

testBackend();

