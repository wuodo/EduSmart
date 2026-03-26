const fetch = require('node-fetch');

async function testAuditAuth() {
  try {
    console.log('Testing audit logs authentication...');
    
    // Test 1: Without any headers (should fail)
    console.log('\n1. Testing without headers...');
    const response1 = await fetch('http://localhost:5000/api/audit-logs?page=1&limit=5');
    console.log('Status:', response1.status);
    if (response1.status === 403) {
      console.log('✅ Correctly rejected without authentication');
    } else {
      console.log('❌ Unexpected response without authentication');
    }
    
    // Test 2: With session cookie (should work if logged in)
    console.log('\n2. Testing with session cookie...');
    const response2 = await fetch('http://localhost:5000/api/audit-logs?page=1&limit=5', {
      headers: {
        'Cookie': 'session=5b21b72fd9f1c78940062969fd0c6f151835c6ddbb215e93da54fbd074546e15'
      }
    });
    console.log('Status:', response2.status);
    if (response2.status === 200) {
      const data = await response2.json();
      console.log('✅ Success with session cookie');
      console.log('Logs found:', data.logs?.length || 0);
    } else {
      console.log('❌ Failed with session cookie');
      const errorText = await response2.text();
      console.log('Error:', errorText);
    }
    
    // Test 3: With role header (should work)
    console.log('\n3. Testing with role header...');
    const response3 = await fetch('http://localhost:5000/api/audit-logs?page=1&limit=5', {
      headers: {
        'x-user-role': 'admin',
        'x-user-email': 'hadmin@edusmart.com'
      }
    });
    console.log('Status:', response3.status);
    if (response3.status === 200) {
      const data = await response3.json();
      console.log('✅ Success with role header');
      console.log('Logs found:', data.logs?.length || 0);
    } else {
      console.log('❌ Failed with role header');
      const errorText = await response3.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('Error testing audit auth:', error);
  }
}

// Wait a bit for server to start, then test
setTimeout(testAuditAuth, 3000);

