import React, { useState, useEffect } from 'react';
import { sound } from '../audio/soundEngine.js';
import { X, Volume2, VolumeX, Music, Bell } from 'lucide-react';

interface AudioSettingsModalProps {
  onClose: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({ onClose }) => {
  const [musicVol, setMusicVol] = useState(sound.musicVolume);
  const [sfxVol, setSfxVol] = useState(sound.sfxVolume);
  const [isMuted, setIsMuted] = useState(sound.isMuted);
  const [tracks, setTracks] = useState<{ id: string; name: string }[]>([]);
  const [selectedTrack, setSelectedTrack] = useState(sound.currentTrack);

  useEffect(() => {
    fetch('/api/music')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTracks(data);
      })
      .catch(() => {});
  }, []);

  const handleMusicChange = (val: number) => {
    setMusicVol(val);
    sound.setMusicVolume(val);
  };

  const handleSfxChange = (val: number) => {
    setSfxVol(val);
    sound.setSfxVolume(val);
  };

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm bg-stone-900 border border-amber-600/40 rounded-2xl shadow-2xl p-5 text-stone-100 flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Music size={18} className="text-amber-400" />
            <h2 className="text-base font-serif font-bold text-amber-200">
              Thanh Âm Thiền Tịnh
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nút tắt tiếng nhanh */}
        <div className="flex items-center justify-between p-2.5 bg-stone-950/60 rounded-xl border border-stone-800">
          <div className="text-xs font-medium text-stone-300">
            {isMuted ? 'Đang tắt toàn bộ âm thanh' : 'Âm thanh đang bật'}
          </div>
          <button
            type="button"
            onClick={handleToggleMute}
            className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition ${
              isMuted
                ? 'bg-rose-900/60 text-rose-200 border border-rose-700'
                : 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
            }`}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{isMuted ? 'Bật âm' : 'Tắt âm'}</span>
          </button>
        </div>

        {/* Âm lượng nhạc nền */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Music size={13} /> Nhạc thiền ngũ cung:
            </span>
            <span className="text-stone-400">{Math.round(musicVol * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={musicVol}
            onChange={(e) => handleMusicChange(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Âm lượng hiệu ứng chuông mõ */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Bell size={13} /> Chuông, mõ, trống:
            </span>
            <span className="text-stone-400">{Math.round(sfxVol * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sfxVol}
            onChange={(e) => handleSfxChange(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Danh sách bài nhạc thiền */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-300">Giai điệu thiền:</label>
          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
            {tracks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedTrack(t.id);
                  sound.playTrack(t.id);
                }}
                className={`w-full text-left p-2 rounded-lg text-xs transition cursor-pointer ${
                  selectedTrack === t.id
                    ? 'bg-amber-600/25 border border-amber-500/50 text-amber-200 font-medium'
                    : 'bg-stone-950/40 border border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-stone-400">
          Thêm bài: bỏ file <b className="text-stone-300">.mp3</b> vào thư mục <code className="text-amber-300">public/music</code> rồi deploy lại.
          Đổi tiếng trống/chuông/mõ: bỏ file <code className="text-amber-300">drum.mp3</code>, <code className="text-amber-300">bell.mp3</code>,{' '}
          <code className="text-amber-300">woodfish.mp3</code> vào <code className="text-amber-300">public/sfx</code>.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
        >
          Hoàn tất
        </button>

      </div>
    </div>
  );
};
