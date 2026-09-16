import React from 'react';
import { Layers, Search, Info } from 'lucide-react';

interface HeaderProps {
  onlineCount: number;
  totalPosts: number;
  onOpenInfo: () => void;
  onOpenDownload?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
}

const formatOnlineCount = (count: number) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
};

export const Header: React.FC<HeaderProps> = ({
  onlineCount,
  totalPosts,
  onOpenInfo,
  searchQuery,
  onSearchChange,
  isSearchOpen,
  onToggleSearch,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md transition-all">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand & Live status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold shadow-xs">
            <Layers className="w-5 h-5 text-zinc-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-zinc-900 tracking-tight">
                Anonymous Posts
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>{formatOnlineCount(onlineCount)} online</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
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

