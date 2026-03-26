const fetch = require('node-fetch');

async function test() {
  try {
    console.log('Testing audit logs API...');
    
    // Test with admin role header
    const response = await fetch('http://localhost:5000/api/audit-logs?page=1&limit=5', {
      headers: {
        'x-user-role': 'admin',
        'x-user-email': 'hadmin@edusmart.com'
      }
    });
    
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success!');
      console.log('Logs found:', data.logs?.length || 0);
      console.log('Total logs:', data.pagination?.total || 0);
      
      if (data.logs && data.logs.length > 0) {
        console.log('\nFirst log:');
        console.log('- ID:', data.logs[0].id);
        console.log('- Action:', data.logs[0].action);
        console.log('- Module:', data.logs[0].module);
        console.log('- User:', data.logs[0].user);
        console.log('- Created:', data.logs[0].createdAt);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Failed:', errorText);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();

