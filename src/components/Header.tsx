import React, { useState } from 'react';
import { Search, Info, Share2, Check, Volume2, VolumeX } from 'lucide-react';

interface HeaderProps {
  onlineCount: number;
  totalPosts: number;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onOpenInfo: () => void;
  onOpenDownload?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  isSinglePostMode?: boolean;
  onViewAllPosts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalPosts,
  soundEnabled = false,
  onToggleSound,
  onOpenInfo,
  searchQuery,
  onSearchChange,
  isSearchOpen,
  onToggleSearch,
  isSinglePostMode = false,
  onViewAllPosts,
}) => {
  const [copiedAppShare, setCopiedAppShare] = useState(false);

  const handleShareApp = async () => {
    const shareData = {
      title: 'Anonymous Serial Posts',
      text: 'Check out this Anonymous Serial Post Board with real-time posts!',
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard if system share dismissed
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedAppShare(true);
      setTimeout(() => setCopiedAppShare(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md transition-all">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand & Live status */}
        <div className="flex items-center gap-3">
          <button
            onClick={onViewAllPosts}
            className={`flex items-center gap-3 text-left transition-opacity ${
              isSinglePostMode ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
            }`}
            title={isSinglePostMode ? 'Click to view all posts' : 'Anonymous Posts'}
          >
            <div className="flex items-center justify-center text-zinc-950">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" className="w-10 h-10 drop-shadow-sm">
                <path fill="currentColor" d="M320 0c74.4 0 134.9 60.5 134.9 135.1 0 25.1-6.9 48.6-18.8 68.6 23.8 22.9 52 54.3 69.6 87.7 20.3 38.5 25.2 75.3 25.2 92.7 0 35.3-28.7 64-64 64-21.1 0-39.8-10.3-51.5-26.1-14.2 22.4-37.1 38.1-63.5 41.5-20.4-13.9-45.4-22.2-72-22.2-26.6 0-51.7 8.3-72 22.2-26.4-3.5-49.3-19.1-63.5-41.5-11.7 15.8-30.4 26.1-51.5 26.1-35.3 0-64-28.7-64-64 0-17.4 4.9-54.1 25.2-92.7 17.6-33.4 45.8-64.8 69.6-87.7-11.9-20-18.8-43.5-18.8-68.6C185.1 60.5 245.6 0 320 0z"/>
                <circle cx="250" cy="135" r="25" fill="white" />
                <circle cx="390" cy="135" r="25" fill="white" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-zinc-900 tracking-tight flex items-center gap-1.5">
                  Anonymous Posts
                  <svg className="w-4 h-4 shrink-0 text-[#1a73e8]" viewBox="0 0 24 24" fill="currentColor" title="Google Verified">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
                  </svg>
                </h1>
              </div>
            </div>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Sound Toggle Button */}
          {onToggleSound && (
            <button
              id="btn-toggle-sound"
              onClick={onToggleSound}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled
                  ? 'text-zinc-900 bg-zinc-100 hover:bg-zinc-200'
                  : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
              }`}
              title={soundEnabled ? 'Sound is ON (Click to Mute)' : 'Sound is MUTED (Click to Unmute)'}
              aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-400" />
              )}
            </button>
          )}

          {/* Share App Button */}
          <button
            id="btn-share-app"
            onClick={handleShareApp}
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            title={copiedAppShare ? "Link copied!" : "Share App"}
            aria-label="Share App"
          >
            {copiedAppShare ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>

          {/* Search Toggle */}
          <button
            id="btn-toggle-search"
            onClick={onToggleSearch}
            className={`p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors ${
              isSearchOpen ? 'bg-zinc-100 text-zinc-900' : ''
            }`}
            title="Search posts or jump to serial #"
            aria-label="Search posts"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Info Modal Trigger */}
          <button
            id="btn-info"
            onClick={onOpenInfo}
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            title="About Anonymous Serial Posts"
            aria-label="Information"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Search Bar */}
      {isSearchOpen && (
        <div className="border-t border-zinc-100 bg-zinc-50/90 px-4 py-2.5 transition-all">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search post content or enter serial number (e.g. 1, #3)..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 shadow-2xs"
                autoFocus
              />
              {searchQuery && (
                <button
                  id="btn-clear-search"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-800 p-1 rounded-md hover:bg-zinc-100 transition-colors"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

