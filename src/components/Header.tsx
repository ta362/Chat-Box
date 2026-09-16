import React from 'react';
import { Radio, Volume2, VolumeX, Search, Info, RefreshCw, Hash } from 'lucide-react';

interface HeaderProps {
  onlineCount: number;
  totalMessages: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenInfo: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  isConnected: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onlineCount,
  totalMessages,
  soundEnabled,
  onToggleSound,
  onOpenInfo,
  searchQuery,
  onSearchChange,
  isSearchOpen,
  onToggleSearch,
  isConnected,
  onRefresh,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md transition-all">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand & Live status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold shadow-xs">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-zinc-900 tracking-tight">
                Anonymous Chat
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {isConnected ? `${onlineCount} online` : 'Connecting...'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 flex items-center gap-1 font-mono">
              <Hash className="w-3 h-3 inline text-zinc-400" />
              Serial sequence • #{totalMessages} total
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search Toggle */}
          <button
            id="btn-toggle-search"
            onClick={onToggleSearch}
            className={`p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors ${
              isSearchOpen ? 'bg-zinc-100 text-zinc-900' : ''
            }`}
            title="Search messages or jump to serial #"
            aria-label="Search messages"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Sound Toggle */}
          <button
            id="btn-toggle-sound"
            onClick={onToggleSound}
            className={`p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors ${
              soundEnabled ? '' : 'text-zinc-400'
            }`}
            title={soundEnabled ? 'Mute message sound' : 'Unmute message sound'}
            aria-label="Toggle sound"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {/* Refresh Connection */}
          <button
            id="btn-refresh"
            onClick={onRefresh}
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            title="Refresh stream"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Info Modal Trigger */}
          <button
            id="btn-info"
            onClick={onOpenInfo}
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            title="About Anonymous Chat"
            aria-label="Information"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Search / Serial Filter Bar */}
      {isSearchOpen && (
        <div className="border-t border-zinc-100 bg-zinc-50/80 px-4 py-2.5 transition-all animate-fadeIn">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search text or enter serial number (e.g. 5, #12)..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                autoFocus
              />
            </div>
            {searchQuery && (
              <button
                id="btn-clear-search"
                onClick={() => onSearchChange('')}
                className="text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1 font-medium rounded hover:bg-zinc-200/50"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
