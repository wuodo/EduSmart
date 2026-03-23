'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

interface DashboardData {
  firstName: string;
  lastName: string;
  program: string;
  level: string;
  semester: string;
  attendance: {
    present: number;
    total: number;
    percentage: number;
  };
  fees: {
    total: number;
    paid: number;
    balance: number;
    nextPayment: {
      amount: number;
      dueDate: string;
    } | null;
  };
  notifications: Array<{
    id: number;
    title: string;
    message: string;
    type: string;
    createdAt: string;
    read: boolean;
  }>;
}

export default function Dashboard() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        let admissionNumber = Cookies.get('admissionNumber');
        if (!admissionNumber) {
          router.replace('/login');
          return;
        }
        // Normalize admission number
        admissionNumber = admissionNumber.trim().replace(/[\u200B-\u200D\uFEFF]/g, '').toUpperCase();
        // Convert forward slashes to underscores for URL safety
        const safeAdmissionNumber = admissionNumber.replace(/\//g, '_');
        console.log('Normalized admission number:', admissionNumber);
        console.log('Safe admission number:', safeAdmissionNumber);

        const response = await fetch(`/api/students/${safeAdmissionNumber}/dashboard`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Dashboard fetch error:', errorData);
          throw new Error(errorData.message || 'Failed to fetch dashboard data');
        }

        const data = await response.json();
        console.log('Dashboard data received:', data);
        setDashboardData(data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Welcome, {dashboardData.firstName} {dashboardData.lastName}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Program Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Program Information</h2>
            <div className="space-y-2">
              <p><span className="font-medium">Program:</span> {dashboardData.program}</p>
              <p><span className="font-medium">Level:</span> {dashboardData.level}</p>
              <p><span className="font-medium">Semester:</span> {dashboardData.semester}</p>
            </div>
          </div>

          {/* Attendance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendance</h2>
            <div className="space-y-2">
              <p><span className="font-medium">Present:</span> {dashboardData.attendance.present} / {dashboardData.attendance.total}</p>
              <p><span className="font-medium">Percentage:</span> {dashboardData.attendance.percentage.toFixed(1)}%</p>
            </div>
          </div>

          {/* Fees */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Fees</h2>
            <div className="space-y-2">
              <p><span className="font-medium">Total:</span> KES {dashboardData.fees.total.toLocaleString()}</p>
              <p><span className="font-medium">Paid:</span> KES {dashboardData.fees.paid.toLocaleString()}</p>
              <p><span className="font-medium">Balance:</span> KES {dashboardData.fees.balance.toLocaleString()}</p>
              {dashboardData.fees.nextPayment && (
                <p>
                  <span className="font-medium">Next Payment:</span> KES {dashboardData.fees.nextPayment.amount.toLocaleString()}
                  <br />
                  <span className="text-sm text-gray-500">Due: {new Date(dashboardData.fees.nextPayment.dueDate).toLocaleDateString()}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Notifications</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {dashboardData.notifications.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {dashboardData.notifications.map((notification) => (
                  <li key={notification.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">{notification.title}</h3>
                        <p className="mt-1 text-sm text-gray-500">{notification.message}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          New
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-gray-500 text-center">No notifications</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 