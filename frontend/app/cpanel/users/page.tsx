"use client";
import React from 'react';
import Info from '../_components/Info';

async function fetchJson(path: string, init?: RequestInit) {
  const headers = {
    'Accept': 'application/json',
    ...(init?.headers || {})
  };

  const res = await fetch(`/api/cpanel${path}`, {
    ...init,
    credentials: 'include',
    headers
  });
  
  if (res.status === 204) return {};

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    try {
      const raw = await res.text();
      data = { raw };
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || data?.raw || 'Request failed';
    throw new Error(typeof msg === 'string' ? msg : 'Request failed');
  }

  return data;
}

export default function UsersPage() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [showDeactivated, setShowDeactivated] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('admissions_officer');
  const [inviteTenant, setInviteTenant] = React.useState('');
  const [tenantsForInvite, setTenantsForInvite] = React.useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [selectedUserIds, setSelectedUserIds] = React.useState<number[]>([]);
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [newUserData, setNewUserData] = React.useState<{email: string, password: string, tenant: {id: number, name: string, subdomain: string | null} | null} | null>(null);
  const [showResetModal, setShowResetModal] = React.useState(false);
  const [resetUserId, setResetUserId] = React.useState<number | null>(null);
  const [newPassword, setNewPassword] = React.useState('');
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editUser, setEditUser] = React.useState<any>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchBoth = async () => {
        const [usersRes, tenantsRes] = await Promise.all([
          fetch(`/api/cpanel/users`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/cpanel/tenants`, { credentials: 'include', cache: 'no-store' }),
        ]);
        const usersJson = await usersRes.json().catch(() => ({}));
        const tenantsJson = await tenantsRes.json().catch(() => ({}));
        return { usersRes, tenantsRes, usersJson, tenantsJson };
      };

      // Exponential back-off: retry up to 3 times on 429 (2s, 4s, 8s)
      const MAX_RETRIES = 3;
      let attempt = 0;
      let usersRes: Response, tenantsRes: Response, usersJson: any, tenantsJson: any;
      while (true) {
        ({ usersRes, tenantsRes, usersJson, tenantsJson } = await fetchBoth());
        const throttled = usersRes.status === 429 || tenantsRes.status === 429;
        if (!throttled || attempt >= MAX_RETRIES) break;
        attempt++;
        const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
        await new Promise(r => setTimeout(r, delayMs));
      }

      if (usersRes!.status === 429 || tenantsRes!.status === 429) {
        throw new Error('Server is busy. Please wait a moment and refresh the page.');
      }

      if (!usersRes!.ok) {
        throw new Error(usersJson?.error || usersJson?.message || `Failed to load users (${usersRes!.status})`);
      }
      if (!tenantsRes!.ok) {
        throw new Error(tenantsJson?.error || tenantsJson?.message || `Failed to load tenants (${tenantsRes!.status})`);
      }

      setUsers(usersJson.users || []);
      setTenantsForInvite(tenantsJson.tenants || []);
    } catch (e: any) { 
      setError(e.message || 'Failed to load users'); 
      console.error('Load users error:', e);
    } finally { 
      setLoading(false); 
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function invite(e: React.FormEvent): Promise<boolean> {
    e.preventDefault(); 
    setError(null);
    setSuccess(null);
    
    try {
      // Validate tenantId exists (avoid "Tenant not found" after a create toast races)
      const tidRaw = inviteTenant.trim();
      const tidNum = tidRaw ? Number(tidRaw) : null;
      if (tidNum && !Number.isNaN(tidNum)) {
        // We already have tenantsForInvite loaded; use it.
        const t = tenantsForInvite.find((x: any) => x?.id === tidNum);
        if (!t) {
          setError('Tenant not found');
          return false;
        }
      }

      const result = await fetchJson('/users/invite', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          email: inviteEmail, 
          role: inviteRole, 
          tenantId: inviteTenant ? Number(inviteTenant) : undefined 
        }) 
      });
      
      // Show password modal with credentials
      if (result.success && result.initialPassword) {
        setNewUserData({ email: inviteEmail, password: result.initialPassword, tenant: result.tenant || null });
        setShowPasswordModal(true);
        setSuccess(`User ${inviteEmail} created successfully!`);
      }
      
      setInviteEmail(''); 
      setInviteRole('admissions_officer'); 
      setInviteTenant('');
      await load(); // Auto-refresh table
      return true;
    } catch (e: any) { 
      setError(e.message || 'Failed to create user'); 
      console.error('Invite error:', e);
      return false;
    }
  }
  
  function copyPassword() {
    if (newUserData) {
      navigator.clipboard.writeText(newUserData.password);
      setSuccess('Password copied to clipboard!');
    }
  }
  
  async function resetPassword(userId: number) {
    setResetUserId(userId);
    setNewPassword('');
    setShowResetModal(true);
  }
  
  async function confirmResetPassword() {
    if (!resetUserId || !newPassword) return;
    setError(null);
    setSuccess(null);
    
    try {
      const result = await fetchJson(`/users/${resetUserId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      
      // Backend returns { success: true, user: {...} }
      setSuccess('Password reset successfully!');
      setShowResetModal(false);
      setResetUserId(null);
      setNewPassword('');
    } catch (e: any) {
      setError(e.message || 'Failed to reset password');
      console.error('Password reset error:', e);
    }
  }
  
  async function openEditUser(user: any) {
    setEditUser({ ...user });
    setShowEditModal(true);
  }
  
  async function confirmEditUser() {
    if (!editUser) return;
    setError(null);
    setSuccess(null);
    
    try {
      await fetchJson(`/users/${editUser.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editUser.role })
      });
      
      setSuccess('User updated successfully!');
      setShowEditModal(false);
      setEditUser(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to update user');
    }
  }

  async function approve(id: number) { 
    setError(null); setSuccess(null);
    try { 
      await fetchJson(`/users/${id}/approve`, { method: 'PUT' }); 
      setSuccess('User approved successfully!');
      await load(); 
    } catch (e: any) { setError(e.message); } 
  }
  
  async function deactivate(id: number) { 
    openDeleteFlow([id]);
  }

  async function bulkDeactivateSelected() {
    if (selectedUserIds.length === 0) return;
    openDeleteFlow([...selectedUserIds]);
  }

  const isProtectedUser = (u: any) => {
    // Super admin account cannot be deleted: role=admin and tenantId=null
    return String(u?.role) === 'admin' && (u?.tenantId === null || u?.tenantId === undefined);
  };
  const visibleUsers = showDeactivated ? users : users.filter((u: any) => u.approved);
  const deletableUsers = visibleUsers.filter((u: any) => !isProtectedUser(u));
  React.useEffect(() => {
    // If the user list refreshes, ensure we don't keep protected user IDs selected.
    setSelectedUserIds((prev) =>
      prev.filter((id) => {
        const u = users.find((x: any) => x?.id === id);
        return u ? !isProtectedUser(u) : false;
      })
    );
  }, [users]);

  const [deleteFlowOpen, setDeleteFlowOpen] = React.useState(false);
  const [deleteFlowIds, setDeleteFlowIds] = React.useState<number[]>([]);
  const [deleteFlowStep, setDeleteFlowStep] = React.useState(1);
  const [deleteAck1, setDeleteAck1] = React.useState(false);
  const [deleteAck2, setDeleteAck2] = React.useState(false);
  const [deletePassword, setDeletePassword] = React.useState('');
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  function openDeleteFlow(ids: number[]) {
    // Never allow protected user IDs to be targeted.
    const deletable = ids.filter((id) => {
      const u = users.find((x: any) => x.id === id);
      return u ? !isProtectedUser(u) : true;
    });
    if (deletable.length === 0) {
      setError('Cannot delete super admin user(s).');
      return;
    }
    setError(null);
    setSuccess(null);
    setDeleteFlowIds(deletable);
    setDeleteFlowStep(1);
    setDeleteAck1(false);
    setDeleteAck2(false);
    setDeletePassword('');
    setDeleteBusy(false);
    setDeleteFlowOpen(true);
  }

  async function confirmDeleteFlow() {
    setDeleteBusy(true);
    setError(null);
    try {
      if (!deletePassword) throw new Error('Super admin password is required.');
      const ids = deleteFlowIds;
      if (ids.length > 1) {
        await fetchJson(`/users/bulk/deactivate`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, confirmPassword: deletePassword }),
        });
        setSelectedUserIds([]);
        setSuccess(`Deactivated ${ids.length} user(s) successfully!`);
      } else {
        await fetchJson(`/users/${ids[0]}/deactivate`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmPassword: deletePassword }),
        });
        setSelectedUserIds([]);
        setSuccess('User deactivated successfully!');
      }
      await load();
      setDeleteFlowOpen(false);
    } catch (e: any) {
      setError(e.message || 'Failed to delete users');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center">Users <Info text="Manage user accounts across tenants: invite, approve/deactivate, and assign roles." /></h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Cross-tenant directory</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={bulkDeactivateSelected}
          disabled={selectedUserIds.length === 0}
          className="bg-red-600 text-white px-3 py-1.5 text-xs md:text-sm rounded-none hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          Delete selected{selectedUserIds.length > 0 ? ` (${selectedUserIds.length})` : ''}
        </button>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 text-xs md:text-sm font-medium whitespace-nowrap"
          style={{ backgroundColor: '#0D9488', color: '#fff', borderRadius: '8px' }}
        >
          + Create user
        </button>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={showDeactivated}
          onChange={(e) => setShowDeactivated(e.target.checked)}
        />
        Show deactivated users
      </label>

      {deleteFlowOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2">
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 w-full max-w-xl rounded-none">
            <div className="px-4 py-2 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {deleteFlowStep === 1 ? 'Delete user(s) - Safety check' : 'Confirm with super admin password'}
              </div>
              <button
                type="button"
                onClick={() => setDeleteFlowOpen(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-lg"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                You are about to deactivate user access in cPanel.
                This is risky and may affect dependent workflows.
              </div>

              {deleteFlowStep === 1 ? (
                <>
                  <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={deleteAck1} onChange={(e)=>setDeleteAck1(e.target.checked)} className="mt-1" />
                    I understand this will deactivate selected user accounts.
                  </label>
                  <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={deleteAck2} onChange={(e)=>setDeleteAck2(e.target.checked)} className="mt-1" />
                    I have verified backups / I am ready to proceed.
                  </label>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setDeleteFlowOpen(false)}
                      className="px-3 py-2 bg-gray-600 text-white hover:bg-gray-700 text-sm rounded-none flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!deleteAck1 || !deleteAck2}
                      onClick={() => setDeleteFlowStep(2)}
                      className="px-3 py-2 bg-btnblue text-white hover:opacity-90 text-sm rounded-none flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Enter your super admin role password to confirm this risky action.
                  </div>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e)=>setDeletePassword(e.target.value)}
                    placeholder="Super admin password"
                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 w-full text-sm rounded-none"
                  />

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setDeleteFlowStep(1)}
                      className="px-3 py-2 bg-gray-600 text-white hover:bg-gray-700 text-sm rounded-none flex-1"
                      disabled={deleteBusy}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteFlow}
                      disabled={deleteBusy}
                      className="px-3 py-2 bg-red-600 text-white hover:opacity-90 text-sm rounded-none flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleteBusy ? 'Confirming...' : `Confirm Deactivate (${deleteFlowIds.length})`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <div className="bg-rose-50 dark:bg-rose-900/25 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded p-3 text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={() => setError(null)} className="text-rose-900 dark:text-rose-200 hover:text-rose-700 dark:hover:text-rose-100">✕</button>
      </div>}
      
      {success && <div className="bg-green-50 dark:bg-green-900/25 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded p-3 text-sm flex items-center justify-between">
        <span>{success}</span>
        <button onClick={() => setSuccess(null)} className="text-green-900 dark:text-green-200 hover:text-green-700 dark:hover:text-green-100">✕</button>
      </div>}

      {/* Password Modal */}
      {showPasswordModal && newUserData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-xl max-w-md w-full border dark:border-gray-700">
            <h3 className="text-base font-semibold mb-3">User Created Successfully</h3>
            <div className="space-y-4">
              {newUserData.tenant && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Institution ID <span className="text-xs font-normal text-gray-500">(enter this in the login form)</span></label>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded px-3 py-2 font-mono text-sm text-blue-900 dark:text-blue-100 flex items-center justify-between">
                    <span>{newUserData.tenant.subdomain || newUserData.tenant.id}</span>
                    <span className="ml-3 text-xs text-blue-600 dark:text-blue-400 font-sans font-normal">({newUserData.tenant.name})</span>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Also accepted: numeric ID <strong>{newUserData.tenant.id}</strong> or full name.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <div className="bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded px-3 py-2 font-mono text-sm text-gray-900 dark:text-gray-100">{newUserData.email}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Password</label>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded px-3 py-2 font-mono text-sm flex items-center justify-between">
                  <span>{newUserData.password}</span>
                  <button onClick={copyPassword} className="ml-2 px-2 py-1 bg-yellow-200 dark:bg-yellow-800/60 hover:bg-yellow-300 dark:hover:bg-yellow-700 rounded text-xs">Copy</button>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">Save this password — it will not be shown again.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowPasswordModal(false)} className="bg-btnblue text-white px-4 py-2 rounded hover:opacity-90">Close</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-none border border-gray-300 dark:border-gray-700 shadow-xl max-w-xl w-full">
            <div className="flex items-center justify-between mb-3 pb-2 border-b dark:border-gray-700">
              <h3 className="text-base font-semibold">Create user</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-lg"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                const ok = await invite(e);
                if (ok) setShowCreateModal(false);
              }}
              className="p-0 grid md:grid-cols-2 gap-3"
            >
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">User email</label>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. name@school.com"
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 w-full text-sm"
                  required
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Email used for login and notifications.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 w-full text-sm"
                >
                  <option value="admissions_officer">Admissions Officer</option>
                  <option value="senior_staff">Senior Staff</option>
                  <option value="admin">Tenant Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Tenant</label>
                <select
                  value={inviteTenant}
                  onChange={(e) => setInviteTenant(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 w-full text-sm"
                >
                  <option value="">Global (no tenant)</option>
                  {tenantsForInvite.map((t: any) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.id} - {t.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Blank = global.</p>
              </div>

              <div className="md:col-span-2 flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-3 py-2 text-sm bg-gray-600 text-white hover:bg-gray-700 rounded-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 text-sm bg-btnblue text-white hover:opacity-90 rounded-none"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-xl max-w-md w-full border dark:border-gray-700">
            <h3 className="text-base font-semibold mb-3">Reset Password</h3>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">New Password (min 6 characters)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter new password"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmResetPassword}
                disabled={!newPassword || newPassword.length < 6}
                className="flex-1 px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                Reset Password
              </button>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetUserId(null);
                  setNewPassword('');
                }}
                className="flex-1 px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit User Modal */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-xl max-w-md w-full border dark:border-gray-700">
            <h3 className="text-base font-semibold mb-3">Edit User</h3>
            <div className="space-y-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="text"
                  value={editUser.email}
                  disabled
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="senior_staff">Senior Staff</option>
                  <option value="admissions_officer">Admissions Officer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tenant ID</label>
                <input
                  type="text"
                  value={editUser.tenantId || 'None'}
                  disabled
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmEditUser}
                className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditUser(null);
                }}
                className="flex-1 px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border-b dark:border-gray-700 flex items-center">Directory <Info text="Users across the platform. Role and approval determine access and capabilities." /></div>
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800 w-[34px]">
                <input
                  type="checkbox"
                  checked={deletableUsers.length > 0 && deletableUsers.every((u: any) => selectedUserIds.includes(u.id))}
                  disabled={deletableUsers.length === 0}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedUserIds(deletableUsers.map((u: any) => u.id));
                    else setSelectedUserIds([]);
                  }}
                />
              </th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Email</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Role</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Approved</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Tenant</th>
              <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
            ) : visibleUsers.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">No users</td></tr>
            ) : (
              visibleUsers.map((u: any) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      disabled={isProtectedUser(u)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedUserIds(prev => {
                          if (checked) return Array.from(new Set([...prev, u.id]));
                          return prev.filter((id: number) => id !== u.id);
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{u.email}</td>
                  <td className="px-3 py-2">{u.role}</td>
                  <td className="px-3 py-2">{u.approved ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{u.tenantId || '-'}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    {!u.approved && !isProtectedUser(u) && (
                      <button onClick={()=>approve(u.id)} className="px-2 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600">
                        Approve
                      </button>
                    )}
                    <button onClick={()=>openEditUser(u)} className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600">Edit</button>
                    <button onClick={()=>resetPassword(u.id)} className="px-2 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600">Reset Password</button>
                    {u.approved && !isProtectedUser(u) && (
                      <button onClick={()=>deactivate(u.id)} className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600">
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


