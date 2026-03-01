import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import type { AgentProfile } from '../utils/clerkAccess';

interface AgentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: AgentProfile) => void;
}

export default function AgentProfileModal({ isOpen, onClose, onSave }: AgentProfileModalProps) {
  const { user } = useUser();
  const existing = user?.unsafeMetadata?.agentProfile as AgentProfile | undefined;

  const [name, setName] = useState(existing?.name || '');
  const [title, setTitle] = useState(existing?.title || '');
  const [company, setCompany] = useState(existing?.company || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [email, setEmail] = useState(existing?.email || user?.primaryEmailAddress?.emailAddress || '');
  const [logoBase64, setLogoBase64] = useState(existing?.logoBase64 || '');
  const [brandColor, setBrandColor] = useState(existing?.brandColor || '#1e3a5f');
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState('');

  useEffect(() => {
    if (existing) {
      setName(existing.name || '');
      setTitle(existing.title || '');
      setCompany(existing.company || '');
      setPhone(existing.phone || '');
      setEmail(existing.email || user?.primaryEmailAddress?.emailAddress || '');
      setLogoBase64(existing.logoBase64 || '');
      setBrandColor(existing.brandColor || '#1e3a5f');
    }
  }, [existing, user]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError('');
    if (file.size > 200 * 1024) {
      setLogoError('Logo must be under 200KB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setLogoError('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Resize to max 200x80 to keep it small
        const maxW = 200, maxH = 80;
        let w = img.width, h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const resized = canvas.toDataURL('image/png', 0.9);
        setLogoBase64(resized);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);

    const profile: AgentProfile = {
      name: name.trim(),
      title: title.trim() || undefined,
      company: company.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      logoBase64: logoBase64 || undefined,
      brandColor: brandColor !== '#1e3a5f' ? brandColor : undefined,
    };

    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          agentProfile: profile,
        },
      });
      onSave(profile);
    } catch (err) {
      console.error('Failed to save agent profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-lg border text-sm transition focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 border-[#e0dbd0] bg-white text-[#2a3a2a]';
  const labelClass = 'block text-sm font-medium mb-1 text-[#4a5a4a]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-xl bg-white border border-[#e0dbd0]">
        <div className="px-6 py-5 border-b border-[#e0dbd0]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#2a3a2a]">Agent Profile</h2>
            <button onClick={onClose} className="text-[#8a9a8a] hover:text-[#2a3a2a] transition">&times;</button>
          </div>
          <p className="text-sm mt-1 text-[#8a9a8a]">This info appears on your branded reports.</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelClass}>Full Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Title / Role</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Licensed Real Estate Agent" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Company</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Remax Premier" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@remax.com" className={inputClass} />
            </div>
          </div>

          {/* Branding section */}
          <div className="pt-3 border-t border-[#e0dbd0]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8a9a8a] mb-3">Report Branding</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Logo</label>
                {logoBase64 ? (
                  <div className="flex items-center gap-2">
                    <img src={logoBase64} alt="Logo" style={{ maxHeight: '32px', maxWidth: '100px', objectFit: 'contain' }} />
                    <button
                      type="button"
                      onClick={() => setLogoBase64('')}
                      className="text-xs text-[#dc2626] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center px-3 py-2 rounded-lg border border-dashed border-[#e0dbd0] cursor-pointer hover:border-[#1e3a5f] hover:bg-[#faf8f4] transition text-sm text-[#8a9a8a]">
                    <span>Upload logo</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                )}
                {logoError && <p className="text-xs text-[#dc2626] mt-1">{logoError}</p>}
              </div>
              <div>
                <label className={labelClass}>Brand Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={e => setBrandColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-[#e0dbd0] cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={e => setBrandColor(e.target.value)}
                    maxLength={7}
                    className={inputClass + ' flex-1'}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#e0dbd0] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg transition text-[#4a5a4a] hover:bg-[#f0ebe0]">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-5 py-2 text-sm font-semibold rounded-lg text-white transition disabled:opacity-40 bg-[#1e3a5f] hover:bg-[#2a4a6f]"
          >
            {saving ? 'Saving...' : 'Save & Generate Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
