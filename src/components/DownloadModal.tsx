import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Smartphone,
  Monitor,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Share2,
  PlusSquare,
  Compass,
  Check,
} from 'lucide-react';
import { SerialPost } from '../types';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  posts: SerialPost[];
  totalCount: number;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Catch browser's native PWA install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallSuccess(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isOpen) return null;

  // Direct 1-click install handler
  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsAppInstalled(true);
          setInstallSuccess(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('Install prompt failed:', err);
      }
    } else {
      // If browser doesn't support direct programmatic prompt, the modal below shows visual instructions
    }
  };

  return (
    <div
      id="browser-download-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="browser-download-modal-container"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-base leading-tight">
                Download & Install App
              </h3>
              <p className="text-xs text-zinc-500">
                Install directly to your Browser, Mobile, or PC
              </p>
            </div>
          </div>
          <button
            id="btn-close-browser-download-modal"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-zinc-700 text-sm leading-relaxed">
          {/* Main Action Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Sparkles className="w-3 h-3" /> PWA Web App
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">No App Store Required</span>
                </div>
                <h4 className="text-base font-bold text-white">
                  Add to Home Screen / PC
                </h4>
                <p className="text-xs text-zinc-300">
                  Runs instantly in full-screen mode with ultra-fast offline cache.
                </p>
              </div>

              {/* Install Button */}
              {deferredPrompt ? (
                <button
                  id="btn-trigger-direct-install"
                  onClick={handleInstallApp}
                  className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-zinc-900" />
                  <span>1-Click Download</span>
                </button>
              ) : isAppInstalled || installSuccess ? (
                <div className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Installed on Device</span>
                </div>
              ) : (
                <div className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-medium">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Follow Steps Below</span>
                </div>
              )}
            </div>
          </div>

          {/* Device Specific Instructions */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
              How to Install on Your Browser:
            </h4>

            {/* Android & Google Chrome */}
            <div className="border border-zinc-200 rounded-2xl p-3.5 bg-zinc-50/60 space-y-2">
              <div className="flex items-center gap-2 text-zinc-900 font-semibold text-xs">
                <div className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-800">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <span>Android / Google Chrome</span>
              </div>
              <ol className="text-xs text-zinc-600 space-y-1 list-decimal list-inside pl-1">
                <li>Tap the browser menu button <strong>(⋮)</strong> in the top-right corner.</li>
                <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                <li>Confirm to add the app icon directly to your home screen.</li>
              </ol>
            </div>

            {/* iPhone / iPad (iOS Safari) */}
            <div className="border border-zinc-200 rounded-2xl p-3.5 bg-zinc-50/60 space-y-2">
              <div className="flex items-center gap-2 text-zinc-900 font-semibold text-xs">
                <div className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-800">
                  <Share2 className="w-3.5 h-3.5" />
                </div>
                <span>iPhone & iPad (Safari)</span>
              </div>
              <ol className="text-xs text-zinc-600 space-y-1 list-decimal list-inside pl-1">
                <li>Tap the <strong>Share</strong> button (box with an upward arrow <Share2 className="w-3 h-3 inline" />).</li>
                <li>Scroll down and select <strong>"Add to Home Screen"</strong> (➕).</li>
                <li>Tap <strong>Add</strong> in the top right corner.</li>
              </ol>
            </div>

            {/* PC / Mac Desktop (Chrome, Edge, Brave) */}
            <div className="border border-zinc-200 rounded-2xl p-3.5 bg-zinc-50/60 space-y-2">
              <div className="flex items-center gap-2 text-zinc-900 font-semibold text-xs">
                <div className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-800">
                  <Monitor className="w-3.5 h-3.5" />
                </div>
                <span>Desktop (Chrome, Edge, Brave, Opera)</span>
              </div>
              <ol className="text-xs text-zinc-600 space-y-1 list-decimal list-inside pl-1">
                <li>Look at your browser's address bar at the top.</li>
                <li>Click the <strong>Install App icon (💻 / ⊕)</strong> on the right side of the address bar.</li>
                <li>Click <strong>Install</strong> to run it in a standalone window on your PC.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-zinc-50/80 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400 font-mono">
            Fast, Lightweight & Secure
          </span>
          <button
            id="btn-close-download-guide"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
