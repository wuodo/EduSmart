"use client";
import React from 'react';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data;
}

export default function PlatformSettingsPage() {
  const [platform, setPlatform] = React.useState<any>({ localization: {}, files: {} });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(()=>{ (async()=>{ try { setPlatform(await fetchJson('/platform')); } catch(e:any){ setError(e.message); } })(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    await fetchJson('/platform', { method: 'PUT', body: JSON.stringify(platform) });
    alert('Saved');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Platform Settings</h1>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <form onSubmit={save} className="bg-white rounded border border-gray-200 p-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="font-medium mb-2">Localization</div>
            <input value={platform.localization?.defaultLocale || ''} onChange={e=>setPlatform({ ...platform, localization: { ...(platform.localization||{}), defaultLocale: e.target.value } })} placeholder="Default locale (e.g., en)" className="w-full border border-gray-300 rounded px-3 py-2" />
            <input value={platform.localization?.timeZone || ''} onChange={e=>setPlatform({ ...platform, localization: { ...(platform.localization||{}), timeZone: e.target.value } })} placeholder="Time zone (e.g., UTC)" className="w-full border border-gray-300 rounded px-3 py-2 mt-2" />
          </div>
          <div>
            <div className="font-medium mb-2">Files</div>
            <input type="number" value={platform.files?.maxMB || 0} onChange={e=>setPlatform({ ...platform, files: { ...(platform.files||{}), maxMB: Number(e.target.value||0) } })} placeholder="Max file size MB" className="w-full border border-gray-300 rounded px-3 py-2" />
            <input value={(platform.files?.allowedMime||[]).join(',')} onChange={e=>setPlatform({ ...platform, files: { ...(platform.files||{}), allowedMime: e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean) } })} placeholder="Allowed MIME types (comma separated)" className="w-full border border-gray-300 rounded px-3 py-2 mt-2" />
            <label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" checked={!!platform.files?.antivirus} onChange={e=>setPlatform({ ...platform, files: { ...(platform.files||{}), antivirus: e.target.checked } })}/> Antivirus scanning</label>
          </div>
        </div>
        <button className="bg-btnblue text-white text-sm rounded px-4 py-2">Save</button>
      </form>
    </div>
  );
}



