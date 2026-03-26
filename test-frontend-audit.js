const fetch = require('node-fetch');

async function testFrontendAuditAPI() {
  try {
    console.log('Testing frontend audit logs API...');
    
    // Test the frontend API endpoint
    const response = await fetch('http://localhost:3000/api/marketing/settings/audit-logs?limit=10', {
      headers: {
        'Cookie': 'session=5b21b72fd9f1c78940062969fd0c6f151835c6ddbb215e93da54fbd074546e15',
        'x-tenant': 'test',
        'x-user-email': 'hadmin@edusmart.com',
        'x-user-role': 'admin'
      }
    });
    
    if (!response.ok) {
      console.error('Frontend API response not ok:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('Frontend API response:', JSON.stringify(data, null, 2));
    
    if (data.items && data.items.length > 0) {
      console.log(`\nFound ${data.items.length} audit logs in frontend response:`);
      data.items.forEach((log, index) => {
        console.log(`${index + 1}. ID: ${log.id}, Action: ${log.action}, Module: ${log.module}, User: ${log.user}, Time: ${new Date(log.timestamp).toLocaleString()}`);
      });
    } else {
      console.log('No audit logs found in frontend response');
    }
    
  } catch (error) {
    console.error('Error testing frontend API:', error);
  }
}

// Wait a bit for servers to start, then test
setTimeout(testFrontendAuditAPI, 5000);

