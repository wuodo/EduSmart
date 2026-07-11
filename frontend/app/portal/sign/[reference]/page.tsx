"use client";
import { useEffect, useState } from 'react';
import { Check, FileText, Loader } from 'lucide-react';

export default function PortalSignPage({ params }: { params: { reference: string } }) {
  const [letter, setLetter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    fetch(`/api/proxy/esign/letter/${params.reference}`).then(r => r.json()).then(d => {
      if (d.letter) setLetter(d.letter);
      else setError(d.error || 'Letter not found');
      setLoading(false);
    }).catch(() => { setError('Failed to load letter'); setLoading(false); });
  }, [params.reference]);

  const handleSign = async () => {
    if (!letter?.esignEnabled && letter?.esignEnabled !== undefined) {
      setError('E-signature is not enabled for this institution');
      return;
    }
    setSigning(true);
    const r = await fetch(`/api/proxy/esign/letter/${params.reference}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: letter.fullName }),
    });
    const d = await r.json();
    if (d.success) setSigned(true);
    else setError(d.error || 'Failed to sign');
    setSigning(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader size={24} className="animate-spin text-teal-600" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600 text-sm p-4">{error}</div>;
  if (!letter) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg border max-w-lg w-full p-8">
        {signed ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><Check size={32} className="text-green-600" /></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Signed Successfully!</h2>
            <p className="text-sm text-gray-500">Your admission letter has been signed and recorded.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <FileText size={24} className="text-teal-600" />
              <div><h2 className="text-lg font-bold text-gray-900">Admission Letter</h2><p className="text-xs text-gray-500">{letter.referenceNumber}</p></div>
            </div>
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between py-2 border-b"><span className="text-gray-500">Student</span><span className="font-medium">{letter.fullName}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-500">Program</span><span className="font-medium">{letter.programOfInterest || '-'}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-500">Date</span><span className="font-medium">{new Date(letter.createdAt).toLocaleDateString()}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-500">Status</span><span className={`font-medium ${letter.status === 'Signed' ? 'text-green-600' : 'text-amber-600'}`}>{letter.status || 'Generated'}</span></div>
            </div>
            {letter.status === 'Signed' ? (
              <p className="text-center text-green-600 text-sm font-medium">✓ This letter has been signed</p>
            ) : (
              <button onClick={handleSign} disabled={signing} className="w-full py-3 bg-teal-600 text-white rounded font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {signing ? <Loader size={16} className="animate-spin" /> : null}
                {signing ? 'Signing...' : 'Click to Sign'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
