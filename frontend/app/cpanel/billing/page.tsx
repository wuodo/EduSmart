"use client";
import React from 'react';
import Info from '../_components/Info';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', ...init });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export default function BillingPage() {
  const [cfg, setCfg] = React.useState<any>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [planId, setPlanId] = React.useState('');
  const [planName, setPlanName] = React.useState('');
  const [users, setUsers] = React.useState('');
  const [storage, setStorage] = React.useState('');
  const [apiCalls, setApiCalls] = React.useState('');

  const [invoiceTenant, setInvoiceTenant] = React.useState('');
  const [invoiceAmount, setInvoiceAmount] = React.useState('');

  const [couponCode, setCouponCode] = React.useState('');
  const [couponAmount, setCouponAmount] = React.useState('');
  const [couponPercent, setCouponPercent] = React.useState('');

  const [creditTenant, setCreditTenant] = React.useState('');
  const [creditAmount, setCreditAmount] = React.useState('');

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const { plans } = await fetchJson('/config');
      const billing = await fetchJson('/billing');
      setCfg({ plans, billing });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function addPlan(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      const newPlan = { id: planId || planName.toLowerCase().replace(/\s+/g,'-'), name: planName, limits: { users: users?Number(users):undefined, storageMB: storage?Number(storage):undefined, apiCallsPerDay: apiCalls?Number(apiCalls):undefined } };
      await fetchJson('/plans', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plans: [...(cfg?.plans||[]), newPlan] }) });
      setPlanId(''); setPlanName(''); setUsers(''); setStorage(''); setApiCalls('');
      await load();
    } catch (e:any) { setError(e.message); }
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await fetchJson('/billing/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: Number(invoiceTenant), amount: Number(invoiceAmount) }) }); setInvoiceTenant(''); setInvoiceAmount(''); await load(); } catch (e:any) { setError(e.message); }
  }

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await fetchJson('/billing/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: couponCode, amountOff: couponAmount?Number(couponAmount):undefined, percentOff: couponPercent?Number(couponPercent):undefined }) }); setCouponCode(''); setCouponAmount(''); setCouponPercent(''); await load(); } catch (e:any) { setError(e.message); }
  }

  async function grantCredit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await fetchJson('/billing/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: Number(creditTenant), amount: Number(creditAmount) }) }); setCreditTenant(''); setCreditAmount(''); await load(); } catch (e:any) { setError(e.message); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center">Billing & Plans <Info text="Define plans and limits, generate invoices, apply coupons, and grant credits." /></h1>
        <p className="text-sm text-gray-500">Manage plans, invoices, coupons, credits</p>
      </div>

      {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-3 text-sm">{error}</div>}

      <section className="bg-white rounded border border-gray-200 p-3 space-y-3">
        <h2 className="font-medium flex items-center">Plans <Info text="Create or update subscription plans and their usage limits." /></h2>
        <div className="grid md:grid-cols-5 gap-3">
          <div>
            <input value={planId} onChange={e=>setPlanId(e.target.value)} placeholder="Plan ID (e.g. pro)" className="border rounded px-3 py-2 w-full" />
            <p className="text-xs text-gray-500 mt-1">Unique identifier for API and references.</p>
          </div>
          <div>
            <input value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="Plan name" className="border rounded px-3 py-2 w-full" />
            <p className="text-xs text-gray-500 mt-1">Human readable name shown in UI.</p>
          </div>
          <div>
            <input value={users} onChange={e=>setUsers(e.target.value)} placeholder="User limit" className="border rounded px-3 py-2 w-full" />
            <p className="text-xs text-gray-500 mt-1">Maximum number of users allowed.</p>
          </div>
          <div>
            <input value={storage} onChange={e=>setStorage(e.target.value)} placeholder="Storage (MB)" className="border rounded px-3 py-2 w-full" />
            <p className="text-xs text-gray-500 mt-1">Storage capacity for the plan.</p>
          </div>
          <div>
            <input value={apiCalls} onChange={e=>setApiCalls(e.target.value)} placeholder="API calls/day" className="border rounded px-3 py-2 w-full" />
            <p className="text-xs text-gray-500 mt-1">Daily API request limit.</p>
          </div>
        </div>
        <button onClick={addPlan as any} className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Add Plan</button>
        <div className="text-sm text-white/80">{(cfg?.plans||[]).length} plans configured</div>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
      <section className="bg-white rounded border border-gray-200 p-3 space-y-3">
        <h2 className="font-medium flex items-center">Create Invoice <Info text="Issue an invoice for a tenant, typically after plan changes or usage." /></h2>
        <form onSubmit={createInvoice} className="grid md:grid-cols-3 gap-3">
          <div>
            <input value={invoiceTenant} onChange={e=>setInvoiceTenant(e.target.value)} placeholder="Tenant ID" className="border rounded px-3 py-2 w-full" required />
            <p className="text-xs text-gray-500 mt-1">Charge this tenant.</p>
          </div>
          <div>
            <input value={invoiceAmount} onChange={e=>setInvoiceAmount(e.target.value)} placeholder="Amount (USD)" className="border rounded px-3 py-2 w-full" required />
            <p className="text-xs text-gray-500 mt-1">Invoice amount in USD.</p>
          </div>
          <button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Create</button>
        </form>
      </section>

      <section className="bg-white rounded border border-gray-200 p-3 space-y-3">
        <h2 className="font-medium flex items-center">Coupons <Info text="Offer discounts via amount or percent off. Codes must be unique." /></h2>
        <form onSubmit={createCoupon} className="grid md:grid-cols-4 gap-3">
          <div>
            <input value={couponCode} onChange={e=>setCouponCode(e.target.value)} placeholder="Coupon code" className="border rounded px-3 py-2 w-full" required />
            <p className="text-xs text-gray-500 mt-1">Unique discount code.</p>
          </div>
          <div>
            <input value={couponAmount} onChange={e=>setCouponAmount(e.target.value)} placeholder="Amount off (optional)" className="border rounded px-3 py-2 w-full" />
            <p className="text-xs text-gray-500 mt-1">Fixed discount amount.</p>
          </div>
          <div>
            <input value={couponPercent} onChange={e=>setCouponPercent(e.target.value)} placeholder="Percent off (optional)" className="border rounded px-3 py-2 w-full" />
            <p className="text-xs text-gray-500 mt-1">Percentage discount.</p>
          </div>
          <button className="bg-btngreen text-white rounded px-4 py-2 hover:opacity-90">Create</button>
        </form>
      </section>
      </div>

      <section className="bg-white rounded border border-gray-200 p-3 space-y-3">
        <h2 className="font-medium flex items-center">Credits <Info text="Grant credits to tenants to offset future invoices." /></h2>
        <form onSubmit={grantCredit} className="grid md:grid-cols-3 gap-3">
          <div>
            <input value={creditTenant} onChange={e=>setCreditTenant(e.target.value)} placeholder="Tenant ID" className="border rounded px-3 py-2 w-full" required />
            <p className="text-xs text-gray-500 mt-1">Tenant to receive credit.</p>
          </div>
          <div>
            <input value={creditAmount} onChange={e=>setCreditAmount(e.target.value)} placeholder="Amount (USD)" className="border rounded px-3 py-2 w-full" required />
            <p className="text-xs text-gray-500 mt-1">Credit value in USD.</p>
          </div>
          <button className="bg-btngreen text-white rounded px-4 py-2 hover:opacity-90">Grant</button>
        </form>
      </section>
    </div>
  );
}


