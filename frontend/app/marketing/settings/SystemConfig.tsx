import { useEffect, useState } from 'react';
import { useBranding } from '@/contexts/BrandingContext'
import { Building2, Key } from 'lucide-react';

const API_URL = '/api/marketing/settings';

export default function SystemConfig() {
  const [institution, setInstitution] = useState({
    name: '', logo: '', email: '', phone: '', address: ''
  });
  const [passwordPolicy, setPasswordPolicy] = useState({
    minLength: 8, requireSpecial: true, expiryDays: 90
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { refresh } = useBranding()

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setInstitution(data.institution);
      setPasswordPolicy(data.passwordPolicy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const validateInstitution = (data: typeof institution) => {
    const errors: Record<string, string> = {};
    if (!data.name.trim()) errors.name = 'Institution name is required';
    if (!data.email.trim()) errors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(data.email)) errors.email = 'Invalid email format';
    if (!data.phone.trim()) errors.phone = 'Phone number is required';
    else if (!/^\+?\d{7,15}$/.test(data.phone)) errors.phone = 'Invalid phone number format';
    if (!data.address.trim()) errors.address = 'Address is required';
    return errors;
  };

  const validatePasswordPolicy = (data: typeof passwordPolicy) => {
    const errors: Record<string, string> = {};
    if (data.minLength < 6) errors.minLength = 'Minimum length must be at least 6 characters';
    if (data.minLength > 50) errors.minLength = 'Minimum length cannot exceed 50 characters';
    if (data.expiryDays < 0) errors.expiryDays = 'Expiry days cannot be negative';
    if (data.expiryDays > 365) errors.expiryDays = 'Expiry days cannot exceed 1 year';
    return errors;
  };

  const handleInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const errors = validateInstitution(institution);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    try {
    setSaving(true);
      const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ institution }),
    });
      
      if (!response.ok) {
        throw new Error('Failed to save institution details');
      }
      // Refresh branding context so top bar updates immediately (colors, etc.)
      try { await refresh() } catch {}

      setSuccess('Institution details saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save institution details');
    } finally {
    setSaving(false);
    }
  };

  const handlePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const errors = validatePasswordPolicy(passwordPolicy);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    try {
    setSaving(true);
      const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passwordPolicy }),
    });
      
      if (!response.ok) {
        throw new Error('Failed to save password policy');
      }
      
      setSuccess('Password policy saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save password policy');
    } finally {
    setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading system configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Building2 className="h-7 w-7 text-primary" /> System Configuration
      </h2>
      
      {/* Success Message */}
      {success && (
        <div className="mb-4 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {success}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Institution Details Section */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Institution Details</h3>
        </div>
        
        <form className="space-y-6" onSubmit={handleInstitution}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-medium mb-2 text-gray-700 dark:text-gray-300">
                Institution Name <span className="text-rose-500">*</span>
              </label>
              <input 
                type="text" 
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  validationErrors.name ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                value={institution.name} 
                onChange={e => setInstitution(i => ({ ...i, name: e.target.value }))}
                placeholder="Enter institution name"
              />
              {validationErrors.name && (
                <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{validationErrors.name}</p>
              )}
            </div>
            
            {/* Logo upload handled in tenant branding screen for admins; keep this read-only hint */}
            <div>
              <label className="block font-medium mb-2 text-gray-700 dark:text-gray-300">Logo</label>
              <input
                type="file"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed opacity-60"
                disabled
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                Logo is managed in Tenant Branding (super admin).
              </span>
            </div>
            
            <div>
              <label className="block font-medium mb-2 text-gray-700 dark:text-gray-300">
                Contact Email <span className="text-rose-500">*</span>
              </label>
              <input 
                type="email" 
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  validationErrors.email ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                value={institution.email} 
                onChange={e => setInstitution(i => ({ ...i, email: e.target.value }))}
                placeholder="info@institution.edu"
              />
              {validationErrors.email && (
                <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{validationErrors.email}</p>
              )}
            </div>
            
            <div>
              <label className="block font-medium mb-2 text-gray-700 dark:text-gray-300">
                Contact Phone <span className="text-rose-500">*</span>
              </label>
              <input 
                type="tel" 
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  validationErrors.phone ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                value={institution.phone} 
                onChange={e => setInstitution(i => ({ ...i, phone: e.target.value }))}
                placeholder="+1234567890"
              />
              {validationErrors.phone && (
                <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{validationErrors.phone}</p>
              )}
            </div>
            
            <div className="md:col-span-2">
              <label className="block font-medium mb-2 text-gray-700 dark:text-gray-300">
                Address <span className="text-rose-500">*</span>
              </label>
              <textarea 
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none ${
                  validationErrors.address ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                rows={3}
                value={institution.address} 
                onChange={e => setInstitution(i => ({ ...i, address: e.target.value }))}
                placeholder="Enter full address"
              />
              {validationErrors.address && (
                <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{validationErrors.address}</p>
              )}
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <button 
              type="submit" 
              className="bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-200 text-white px-6 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow-md focus:ring-2 focus:ring-primary/20 focus:outline-none" 
              disabled={saving}
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </div>
              ) : (
                'Save Institution Details'
              )}
            </button>
          </div>
        </form>
      </section>

      <div className="border-t border-gray-200 dark:border-gray-700 my-8" />

      {/* Password Policy Section */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Key className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Password Policy</h3>
        </div>
        
        <form className="space-y-6" onSubmit={handlePolicy}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block font-medium mb-2 text-gray-700 dark:text-gray-300">
                Minimum Length <span className="text-rose-500">*</span>
              </label>
              <input 
                type="number" 
                min="6" 
                max="50"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  validationErrors.minLength ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                value={passwordPolicy.minLength} 
                onChange={e => setPasswordPolicy(p => ({ ...p, minLength: Number(e.target.value) }))}
              />
              {validationErrors.minLength && (
                <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{validationErrors.minLength}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Min: 6, Max: 50 characters</p>
            </div>
            
            <div>
              <label className="block font-medium mb-2 text-gray-700 dark:text-gray-300">
                Require Special Characters
              </label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
                value={passwordPolicy.requireSpecial ? 'yes' : 'no'} 
                onChange={e => setPasswordPolicy(p => ({ ...p, requireSpecial: e.target.value === 'yes' }))}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            
            <div>
              <label className="block font-medium mb-2 text-gray-700 dark:text-gray-300">
                Password Expiry (days)
              </label>
              <input 
                type="number" 
                min="0" 
                max="365"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  validationErrors.expiryDays ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                value={passwordPolicy.expiryDays} 
                onChange={e => setPasswordPolicy(p => ({ ...p, expiryDays: Number(e.target.value) }))}
              />
              {validationErrors.expiryDays && (
                <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{validationErrors.expiryDays}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">0 = No expiry</p>
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <button 
              type="submit" 
              className="bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-200 text-white px-6 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow-md focus:ring-2 focus:ring-primary/20 focus:outline-none" 
              disabled={saving}
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </div>
              ) : (
                'Save Password Policy'
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
} 