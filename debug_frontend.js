// Simulate exactly what the frontend useMarketingData hook does
const API_BASE_URL = 'http://localhost:5000';

async function debugFrontendDataFetch() {
  console.log('=== DEBUGGING FRONTEND DATA FETCH ===');
  console.log('API_BASE_URL:', API_BASE_URL);
  
  try {
    // Test 1: Basic fetch to inquiries
    console.log('\n1. Testing inquiries fetch...');
    const inquiriesRes = await fetch(`${API_BASE_URL}/api/inquiries`);
    console.log('Response status:', inquiriesRes.status);
    console.log('Response headers:', Object.fromEntries(inquiriesRes.headers.entries()));
    
    if (inquiriesRes.ok) {
      const inquiries = await inquiriesRes.json();
      console.log('✅ Inquiries data:', inquiries.length, 'items');
      console.log('Sample inquiry:', inquiries[0]);
    } else {
      console.log('❌ Inquiries failed:', inquiriesRes.status, inquiriesRes.statusText);
    }
    
    // Test 2: Test followups
    console.log('\n2. Testing followups fetch...');
    const followupsRes = await fetch(`${API_BASE_URL}/api/followups`);
    console.log('Response status:', followupsRes.status);
    
    if (followupsRes.ok) {
      const followups = await followupsRes.json();
      console.log('✅ Followups data:', followups.length, 'items');
      console.log('Sample followup:', followups[0]);
    } else {
      console.log('❌ Followups failed:', followupsRes.status, followupsRes.statusText);
    }
    
    // Test 3: Test analytics overview
    console.log('\n3. Testing analytics overview...');
    const analyticsRes = await fetch(`${API_BASE_URL}/api/inquiries/analytics/overview`);
    console.log('Response status:', analyticsRes.status);
    
    if (analyticsRes.ok) {
      const analytics = await analyticsRes.json();
      console.log('✅ Analytics data received');
      console.log('Funnel:', analytics.funnel);
    } else {
      console.log('❌ Analytics failed:', analyticsRes.status, analyticsRes.statusText);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.error('Error details:', error);
  }
}

debugFrontendDataFetch(); 