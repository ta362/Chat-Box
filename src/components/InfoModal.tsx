import React from 'react';
import { X, ShieldCheck, Hash, Radio, Users } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalMessages: number;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  totalMessages,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-zinc-900 text-base">
              About Anonymous Chat
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-sm text-zinc-600">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-zinc-100 text-zinc-900 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-medium text-zinc-900 mb-0.5">
                100% Anonymous & Private
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                No accounts, emails, passwords, or personal identity required. Anyone can drop in, read, and write freely.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-zinc-100 text-zinc-900 shrink-0">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-medium text-zinc-900 mb-0.5">
                Sequential Serial Stream
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Every message is numbered chronologically (#{totalMessages} recorded so far). Everyone who connects sees the exact same serial order.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-zinc-100 text-zinc-900 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-medium text-zinc-900 mb-0.5">
                Real-Time Global Synchronization
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Powered by live WebSockets. Messages appear instantaneously on all active devices.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-medium rounded-xl transition-all shadow-xs"
          >
            Got it, let's chat
          </button>
        </div>
      </div>
    </div>
  );
};
