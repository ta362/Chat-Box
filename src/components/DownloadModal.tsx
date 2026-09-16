import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileText,
  FileCode,
  Smartphone,
  Copy,
  Check,
  HardDriveDownload,
  ArrowRight,
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
  posts,
  totalCount,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);

  useEffect(() => {
    // Detect PWA install event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
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

  // 1. Generate text transcript
  const generateTextTranscript = () => {
    const header = `========================================\nANONYMOUS SERIAL POST BOARD - EXPORT LOG\nExported: ${new Date().toLocaleString()}\nTotal Sequential Posts: ${posts.length}\n========================================\n\n`;

    const body = posts
      .map((p) => {
        const timeStr = new Date(p.createdAt).toLocaleString();
        const serialStr = `#${p.serialNumber}`;
        const tagStr = p.tag ? ` [Tag: ${p.tag}]` : '';
        const statsStr = ` (Likes: ${p.likesCount || 0}, Comments: ${p.commentsCount || 0})`;
        return `[Post ${serialStr}]${tagStr} - ${timeStr}${statsStr}\n${p.content}\n`;
      })
      .join('\n----------------------------------------\n\n');

    return header + body;
  };

  // 2. Download .txt file
  const handleDownloadTxt = () => {
    const textContent = generateTextTranscript();
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Anonymous-Serial-Posts-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 3. Download .json file
  const handleDownloadJson = () => {
    const dataToExport = {
      app: 'Anonymous Serial Posts',
      exportDate: new Date().toISOString(),
      totalPosts: posts.length,
      posts: posts.map((p) => ({
        serialNumber: p.serialNumber,
        content: p.content,
        tag: p.tag || null,
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
        createdAt: p.createdAt,
        isoTime: new Date(p.createdAt).toISOString(),
        reactions: p.reactions || {},
      })),
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Anonymous-Serial-Posts-Backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 4. Copy to Clipboard
  const handleCopyTranscript = async () => {
    try {
      const textContent = generateTextTranscript();
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // 5. Trigger PWA Install
  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert(
        'To install on mobile / desktop:\n\n• On Chrome/Android: Tap (⋮) menu and select "Install app" or "Add to Home screen".\n• On iPhone/Safari: Tap Share (⬆) and select "Add to Home Screen".'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-900 text-white rounded-xl shadow-2xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Export & Download
              </h2>
              <p className="text-xs text-zinc-500 font-mono">
                {posts.length} serial posts ready to export
              </p>
            </div>
          </div>
          <button
            id="btn-close-download-modal"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Section 1: Chat Data Downloads */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 font-mono">
              Post Feed Downloads
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Text File */}
              <button
                id="btn-download-txt"
                onClick={handleDownloadTxt}
                className="flex items-start gap-3 p-3.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-2xl text-left transition-all group active:scale-98"
              >
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-900">
                      Text Log (.txt)
                    </span>
                    <HardDriveDownload className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Clean sequential post transcript.
                  </p>
                </div>
              </button>

              {/* JSON File */}
              <button
                id="btn-download-json"
                onClick={handleDownloadJson}
                className="flex items-start gap-3 p-3.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-2xl text-left transition-all group active:scale-98"
              >
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <FileCode className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-900">
                      Raw Data (.json)
                    </span>
                    <HardDriveDownload className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Full structured database export.
                  </p>
                </div>
              </button>
            </div>

            {/* Copy button */}
            <button
              id="btn-copy-transcript"
              onClick={handleCopyTranscript}
              className="w-full mt-2.5 flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 transition-all shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-zinc-500" />
                  <span>Copy Full Text Transcript</span>
                </>
              )}
            </button>
          </div>

          {/* Section 2: Install / Download App to Phone or PC */}
          <div className="pt-2 border-t border-zinc-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 font-mono">
              Install App on Device (PWA)
            </h3>
            <div className="p-4 bg-zinc-900 text-white rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-zinc-800 rounded-xl text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white">
                    Add to Mobile Home Screen or PC
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Install Anonymous Posts directly on your device for fast 1-tap access anytime.
                  </p>
                  
                  <button
                    id="btn-install-pwa"
                    onClick={handleInstallApp}
                    className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                  >
                    <span>{isAppInstalled ? 'App Already Installed' : 'Install / Download App'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <span>Sequential Serial Feed</span>
          <button
            onClick={onClose}
            className="font-medium text-zinc-800 hover:underline"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

