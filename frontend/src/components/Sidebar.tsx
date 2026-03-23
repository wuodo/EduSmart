import Link from 'next/link';
import { useState } from 'react';

// Replace this with your actual admin check logic
const isAdmin = true; // Placeholder

{isAdmin && (
  <div className="mb-4">
    <h3 className="text-lg font-semibold mb-2">Administration</h3>
    <div className="pl-4">
      <h4 className="text-md font-semibold mb-2">Accounts</h4>
      <ul className="ml-2">
        <li>
          <Link href="/admin/fee-structures" className="block py-2 px-4 hover:bg-gray-700 rounded">Fee Structures</Link>
        </li>
        <li>
          <Link href="/admin/student-fees" className="block py-2 px-4 hover:bg-gray-700 rounded">Student Fees Management</Link>
        </li>
        <li>
          <Link href="/admin/staff-payroll" className="block py-2 px-4 hover:bg-gray-700 rounded">Staff Payroll</Link>
        </li>
        <li>
          <Link href="/admin/income-expense" className="block py-2 px-4 hover:bg-gray-700 rounded">Income & Expense Management</Link>
        </li>
        <li>
          <Link href="/admin/bank-cash" className="block py-2 px-4 hover:bg-gray-700 rounded">Bank & Cash Management</Link>
        </li>
        <li>
          <Link href="/admin/financial-reports" className="block py-2 px-4 hover:bg-gray-700 rounded">Financial Reports</Link>
        </li>
      </ul>
    </div>
  </div>
)} 