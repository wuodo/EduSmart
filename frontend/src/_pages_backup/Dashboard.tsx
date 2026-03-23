import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';

const Dashboard = () => {
  const router = useRouter();

  useEffect(() => {
    const isAuthenticated = Cookies.get('isAuthenticated');
    console.log('Dashboard: Checking authentication:', isAuthenticated);
    
    if (!isAuthenticated) {
      console.log('Dashboard: Not authenticated, redirecting to login');
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-600">Welcome to your dashboard!</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 