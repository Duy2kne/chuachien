import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types.js';
import { Send, MessageSquare, ChevronDown, ChevronUp, X } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

const QUICK_PHRASES = [
  'A Di Đà Phật 🙏',
  'Nam Mô Bổn Sư Thích Ca Mâu Ni Phật 🪷',
  'Chúc mọi người an lạc & tinh tấn 🕊️',
  'Tùy hỷ công đức đại chúng 🙏'
];

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage }) => {
  const [text, setText] = useState('');
  // Mặc định trên màn hình nhỏ thu gọn thành nút 💬, trên desktop mở sẵn
  const [isOpen, setIsOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 640 : true);
  const [bottomOffset, setBottomOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Theo dõi visualViewport để khi bàn phím ảo điện thoại mở lên, khung chat nổi lên trên bàn phím
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleViewportChange = () => {
      const vv = window.visualViewport!;
      const keyboardHeight = window.innerHeight - vv.height;
      setBottomOffset(Math.max(0, keyboardHeight));
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setText('');
  };

  const handleQuickPhrase = (phrase: string) => {
    onSendMessage(phrase);
  };

  return (
    <>
      {/* Nút tròn thu gọn 💬 trên điện thoại */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 left-4 z-20 w-12 h-12 rounded-full bg-amber-600 hover:bg-amber-500 text-stone-950 shadow-2xl flex items-center justify-center font-bold transition cursor-pointer border border-amber-300 active:scale-95"
          title="Mở trò chuyện đạo tràng"
        >
          <span className="text-xl">💬</span>
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>
      )}

      {/* Khung chat đầy đủ */}
      {isOpen && (
        <div
          className="fixed left-3 sm:left-4 z-20 w-[92vw] sm:w-80 max-w-sm select-none pointer-events-auto transition-all"
          style={{
            bottom: bottomOffset > 0 ? `${bottomOffset + 8}px` : '80px'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-stone-900/95 border border-stone-800 rounded-t-xl text-xs text-amber-300 font-medium shadow-md">
            <div className="flex items-center gap-1.5">
              <MessageSquare size={14} />
              <span>Đạo Tràng Đàm Thoại</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-stone-400 hover:text-stone-200 p-1 rounded-md hover:bg-stone-800 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="bg-stone-900/90 border-x border-b border-stone-800 rounded-b-xl p-2.5 shadow-2xl backdrop-blur-xs flex flex-col gap-2">
            {/* Danh sách tin nhắn */}
            <div
              ref={scrollRef}
              className="h-32 sm:h-36 overflow-y-auto space-y-1.5 pr-1 text-xs text-stone-200 select-text"
            >
              {messages.length === 0 ? (
                <div className="text-center text-stone-500 py-6 italic text-[11px]">
                  Lời nói ái ngữ, giữ tâm thanh tịnh...
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`py-0.5 ${
                      m.isSystem
                        ? 'text-amber-300 font-serif italic text-[11px]'
                        : 'text-stone-200'
                    }`}
                  >
                    {!m.isSystem && (
                      <span className="font-semibold text-amber-400 mr-1.5">
                        {m.playerName}:
                      </span>
                    )}
                    <span>{m.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Các câu thoại nhanh */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
              {QUICK_PHRASES.map((phrase, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickPhrase(phrase)}
                  className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-md bg-stone-950/80 border border-amber-600/30 text-amber-200 hover:bg-amber-600/20 active:scale-95 transition cursor-pointer"
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/* Ô nhập tin nhắn */}
            <form onSubmit={handleSubmit} className="flex gap-1.5">
              <input
                type="text"
                maxLength={160}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nhập lời đàm thoại (Enter gửi)..."
                className="flex-1 px-3 py-1.5 text-xs bg-stone-950/90 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 rounded-lg transition cursor-pointer flex items-center justify-center font-bold"
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
