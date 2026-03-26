async function checkFrontend() {
  try {
    console.log('Checking if frontend is running...');
    const response = await fetch('http://localhost:3000');
    console.log('Frontend status:', response.status);
    console.log('Frontend is running!');
  } catch (error) {
    console.log('Frontend is not running:', error.message);
  }
}

checkFrontend(); 