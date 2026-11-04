import React, { useEffect, useMemo, useState } from 'react';
import { X, Shield, RefreshCw, Search, Megaphone, Sparkles, Trash2, Users } from 'lucide-react';

interface AdminUser {
  uid: string;
  name: string;
  merit: number;
  balance: number;
  isOnline: boolean;
  room: string;
}

interface Overview {
  online: number;
  totalUsers: number;
  wishes: number;
  lanterns: number;
  stats: { totalMerit?: number; totalVisits?: number; wishCount?: number };
}

interface Offering {
  kind: 'wish' | 'lantern';
  roomId: string;
  roomName: string;
  id: string;
  playerName: string;
  text: string;
  createdAt: number;
}

interface AdminModalProps {
  onClose: () => void;
}

// Trang quản trị chùa: cộng/trừ công đức, thông báo toàn chùa, gỡ lời cầu không phù hợp
export const AdminModal: React.FC<AdminModalProps> = ({ onClose }) => {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [busyUid, setBusyUid] = useState('');
  const [announce, setAnnounce] = useState('');
  const [tab, setTab] = useState<'merit' | 'offerings'>('merit');

  const call = async (action: string, payload?: Record<string, unknown>) => {
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, action, payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
    return data;
  };

  const flash = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setMessage('');
    } else {
      setMessage(msg);
      setError('');
    }
  };

  const loadAll = async () => {
    try {
      const [o, u, f] = await Promise.all([call('overview'), call('list_users'), call('list_offerings')]);
      setOverview(o);
      setUsers(u.users || []);
      setOfferings(f.items || []);
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không đăng nhập được');
      setAuthed(true);
      flash('');
    } catch (err: any) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (authed) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const adjust = async (u: AdminUser, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    setBusyUid(u.uid);
    try {
      const r = await call('adjust_merit', { uid: u.uid, delta, reason });
      setUsers((list) => list.map((x) => (x.uid === u.uid ? { ...x, merit: r.user.merit, balance: r.user.balance } : x)));
      setCustom((c) => ({ ...c, [u.uid]: '' }));
      flash(r.message);
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setBusyUid('');
    }
  };

  const sendAnnounce = async () => {
    if (!announce.trim()) return;
    try {
      const r = await call('announce', { text: announce.trim() });
      setAnnounce('');
      flash(r.message);
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const removeOffering = async (o: Offering) => {
    try {
      const r = await call('delete_offering', { roomId: o.roomId, id: o.id });
      setOfferings((list) => list.filter((x) => x.id !== o.id));
      flash(r.message);
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users).slice(0, 150);
  }, [users, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm select-text">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-stone-900 rounded-2xl shadow-2xl border border-amber-600/40 text-stone-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <h2 className="font-serif font-bold text-amber-200 flex items-center gap-2">
            <Shield size={18} className="text-amber-400" /> Quản Trị Chùa
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 cursor-pointer" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        {!authed ? (
          <form onSubmit={login} className="p-6 flex flex-col gap-3">
            <label className="text-sm text-stone-300">Mật khẩu quản trị</label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-700 focus:border-amber-500 focus:outline-none"
              placeholder="Nhập mật khẩu..."
            />
            {error && <div className="text-xs text-rose-400">{error}</div>}
            <button
              type="submit"
              disabled={busy || !password}
              className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </button>
            <p className="text-[11px] text-stone-500">Mật khẩu đặt ở biến môi trường ADMIN_PASSWORD trên server.</p>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            {(message || error) && (
              <div className={`text-xs px-3 py-2 rounded-lg ${error ? 'bg-rose-950/60 text-rose-300 border border-rose-800' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'}`}>
                {error || message}
              </div>
            )}

            {/* Tổng quan */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['Đang online', overview?.online ?? '–'],
                ['Phật tử đã ghé', overview?.totalUsers ?? '–'],
                ['Dải lụa cầu duyên', overview?.wishes ?? '–'],
                ['Đèn hoa đăng', overview?.lanterns ?? '–']
              ].map(([label, value]) => (
                <div key={label as string} className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800">
                  <div className="text-[10px] text-stone-400">{label}</div>
                  <div className="text-lg font-bold text-amber-200">{value}</div>
                </div>
              ))}
            </div>
            <button type="button" onClick={loadAll} className="self-end -mt-2 text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer">
              <RefreshCw size={12} /> Làm mới
            </button>

            {/* Thông báo toàn chùa */}
            <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 flex flex-col gap-2">
              <div className="text-sm font-semibold text-amber-200 flex items-center gap-1.5">
                <Megaphone size={15} /> Thông báo toàn chùa
              </div>
              <div className="flex gap-2">
                <input
                  value={announce}
                  maxLength={160}
                  onChange={(e) => setAnnounce(e.target.value)}
                  placeholder="VD: 20h tối nay chùa tụng kinh cầu an, mời đại chúng tham dự 🙏"
                  className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg bg-stone-950 border border-stone-700 focus:border-amber-500 focus:outline-none"
                />
                <button type="button" onClick={sendAnnounce} className="px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-bold cursor-pointer">
                  Gửi
                </button>
              </div>
            </div>

            <div className="flex gap-1 border-b border-stone-800">
              {([['merit', 'Cộng / Trừ Công Đức'], ['offerings', `Lời cầu (${offerings.length})`]] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`px-3 py-2 text-sm font-semibold cursor-pointer ${tab === k ? 'text-amber-300 border-b-2 border-amber-400' : 'text-stone-400 hover:text-stone-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'merit' ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Tìm theo tên..."
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-stone-950 border border-stone-700 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <input
                    value={reason}
                    maxLength={80}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Lý do (tuỳ chọn, người nhận sẽ thấy)"
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-stone-950 border border-stone-700 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="text-[11px] text-stone-500 flex items-center gap-1">
                  <Users size={12} /> {users.length} người · đang online hiện trước
                </div>
                <div className="flex flex-col gap-1.5">
                  {shown.map((u) => {
                    const val = custom[u.uid] || '';
                    const n = Math.trunc(Number(val));
                    return (
                      <div key={u.uid} className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-semibold truncate">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${u.isOnline ? 'bg-emerald-400' : 'bg-stone-600'}`} />
                            <span className="truncate">{u.name}</span>
                            {u.room && <span className="text-[10px] text-stone-500 font-normal">· {u.room}</span>}
                          </div>
                          <div className="text-[11px] text-amber-300/90 flex items-center gap-1">
                            <Sparkles size={11} /> {u.merit} công đức · còn dùng được {u.balance}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {[10, 50, 100].map((d) => (
                            <button
                              key={d}
                              type="button"
                              disabled={busyUid === u.uid}
                              onClick={() => adjust(u, d)}
                              className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-700/70 hover:bg-emerald-600 disabled:opacity-50 cursor-pointer"
                            >
                              +{d}
                            </button>
                          ))}
                          <input
                            value={val}
                            inputMode="numeric"
                            onChange={(e) => setCustom((c) => ({ ...c, [u.uid]: e.target.value.replace(/[^\d-]/g, '') }))}
                            placeholder="±số"
                            className="w-16 px-2 py-1 text-xs rounded-lg bg-stone-950 border border-stone-700 focus:border-amber-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={busyUid === u.uid || !n}
                            onClick={() => adjust(u, n)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer ${n < 0 ? 'bg-rose-700 hover:bg-rose-600' : 'bg-amber-600 hover:bg-amber-500 text-stone-950'}`}
                          >
                            {n < 0 ? 'Trừ' : 'Cộng'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!shown.length && <div className="text-xs text-stone-500 py-4 text-center">Chưa có ai</div>}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {offerings.map((o) => (
                  <div key={o.id} className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 flex items-start gap-2">
                    <span className="text-lg">{o.kind === 'wish' ? '💞' : '🏮'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-stone-400">
                        <b className="text-stone-200">{o.playerName}</b> · phòng {o.roomName} · {new Date(o.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </div>
                      <div className="text-sm text-stone-200 break-words">"{o.text}"</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOffering(o)}
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950 cursor-pointer"
                      title="Gỡ lời cầu này"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {!offerings.length && <div className="text-xs text-stone-500 py-4 text-center">Chưa có lời cầu nào</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
