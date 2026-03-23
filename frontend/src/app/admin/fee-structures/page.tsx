'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/utils/api';

interface FeeStructure {
  id: string;
  program: string;
  level: string;
  semester: string;
  amount: number;
  description: string;
}

export default function FeeStructuresPage() {
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFeeStructure, setNewFeeStructure] = useState({
    program: '',
    level: '',
    semester: '',
    amount: 0,
    description: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FeeStructure | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchFeeStructures();
  }, []);

  const fetchFeeStructures = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fee-structures`);
      if (!response.ok) {
        throw new Error('Failed to fetch fee structures');
      }
      const data = await response.json();
      setFeeStructures(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewFeeStructure(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/fee-structures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newFeeStructure),
      });
      if (!response.ok) {
        throw new Error('Failed to create fee structure');
      }
      // Reset form and refresh the list
      setNewFeeStructure({ program: '', level: '', semester: '', amount: 0, description: '' });
      fetchFeeStructures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleEdit = (fee: FeeStructure) => {
    setEditingId(fee.id);
    setEditForm(fee);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/fee-structures/${editForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });
      if (!response.ok) {
        throw new Error('Failed to update fee structure');
      }
      setEditingId(null);
      setEditForm(null);
      fetchFeeStructures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fee structure?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/fee-structures/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete fee structure');
      }
      fetchFeeStructures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Fee Structures</h1>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Add New Fee Structure</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block">Program</label>
            <input
              type="text"
              name="program"
              value={newFeeStructure.program}
              onChange={handleInputChange}
              className="border p-2 w-full"
              required
            />
          </div>
          <div>
            <label className="block">Level</label>
            <input
              type="text"
              name="level"
              value={newFeeStructure.level}
              onChange={handleInputChange}
              className="border p-2 w-full"
              required
            />
          </div>
          <div>
            <label className="block">Semester</label>
            <input
              type="text"
              name="semester"
              value={newFeeStructure.semester}
              onChange={handleInputChange}
              className="border p-2 w-full"
              required
            />
          </div>
          <div>
            <label className="block">Amount</label>
            <input
              type="number"
              name="amount"
              value={newFeeStructure.amount}
              onChange={handleInputChange}
              className="border p-2 w-full"
              required
            />
          </div>
          <div>
            <label className="block">Description</label>
            <textarea
              name="description"
              value={newFeeStructure.description}
              onChange={handleInputChange}
              className="border p-2 w-full"
              required
            />
          </div>
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Add Fee Structure</button>
        </form>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">All Fee Structures</h2>
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="border p-2">Program</th>
              <th className="border p-2">Level</th>
              <th className="border p-2">Semester</th>
              <th className="border p-2">Amount</th>
              <th className="border p-2">Description</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {feeStructures.map((fee) => (
              <tr key={fee.id}>
                <td className="border p-2">{fee.program}</td>
                <td className="border p-2">{fee.level}</td>
                <td className="border p-2">{fee.semester}</td>
                <td className="border p-2">{fee.amount}</td>
                <td className="border p-2">{fee.description}</td>
                <td className="border p-2">
                  <button onClick={() => handleEdit(fee)} className="bg-yellow-500 text-white px-2 py-1 rounded mr-2">Edit</button>
                  <button onClick={() => handleDelete(fee.id)} className="bg-red-500 text-white px-2 py-1 rounded">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingId && editForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">Edit Fee Structure</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block">Program</label>
                <input
                  type="text"
                  name="program"
                  value={editForm.program}
                  onChange={handleEditInputChange}
                  className="border p-2 w-full"
                  required
                />
              </div>
              <div>
                <label className="block">Level</label>
                <input
                  type="text"
                  name="level"
                  value={editForm.level}
                  onChange={handleEditInputChange}
                  className="border p-2 w-full"
                  required
                />
              </div>
              <div>
                <label className="block">Semester</label>
                <input
                  type="text"
                  name="semester"
                  value={editForm.semester}
                  onChange={handleEditInputChange}
                  className="border p-2 w-full"
                  required
                />
              </div>
              <div>
                <label className="block">Amount</label>
                <input
                  type="number"
                  name="amount"
                  value={editForm.amount}
                  onChange={handleEditInputChange}
                  className="border p-2 w-full"
                  required
                />
              </div>
              <div>
                <label className="block">Description</label>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditInputChange}
                  className="border p-2 w-full"
                  required
                />
              </div>
              <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">Save</button>
              <button type="button" onClick={() => setEditingId(null)} className="bg-gray-500 text-white px-4 py-2 rounded ml-2">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 