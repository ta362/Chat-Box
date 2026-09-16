import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Hash,
  Heart,
  MessageSquare,
  Layers,
  BookOpen,
  FileText,
  Lock,
  Scale,
  Sparkles,
  Search,
  Download,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalPosts: number;
}

type TabKey = 'guide' | 'about' | 'privacy' | 'terms' | 'rules';

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  totalPosts,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('guide');

  if (!isOpen) return null;

  return (
    <div
      id="info-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="info-modal-container"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-base leading-tight">
                App Information & Policies
              </h3>
              <p className="text-xs text-zinc-500">
                Anonymous Serial Board • Everything you need to know
              </p>
            </div>
          </div>
          <button
            id="btn-close-info-modal"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 py-2.5 border-b border-zinc-100 bg-white overflow-x-auto scrollbar-none">
          <button
            id="tab-btn-guide"
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Instructions</span>
          </button>

          <button
            id="tab-btn-about"
            onClick={() => setActiveTab('about')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'about'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>About App</span>
          </button>

          <button
            id="tab-btn-privacy"
            onClick={() => setActiveTab('privacy')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>

          <button
            id="tab-btn-terms"
            onClick={() => setActiveTab('terms')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'terms'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Terms & Conditions</span>
          </button>

          <button
            id="tab-btn-rules"
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Guidelines</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-zinc-700 leading-relaxed text-sm space-y-4">
          {/* TAB 1: INSTRUCTIONS */}
          {activeTab === 'guide' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 space-y-3">
                <h4 className="font-bold text-zinc-900 flex items-center gap-2 text-sm">
                  <Hash className="w-4 h-4 text-zinc-900" />
                  Continuous Serial Numbering (#1, #2, #3...)
                </h4>
                <p className="text-xs text-zinc-600">
                  Every post published on this platform is assigned a strictly continuous, permanent sequence number (currently reaching #{totalPosts}). The stream is globally ordered, ensuring fairness, transparency, and a clean chronological archive.
                </p>
              </div>

              <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 space-y-3">
                <h4 className="font-bold text-zinc-900 flex items-center gap-2 text-sm">
                  <Heart className="w-4 h-4 text-rose-500" />
                  Likes, Reactions & Threaded Comments
                </h4>
                <ul className="text-xs text-zinc-600 space-y-1.5 list-disc list-inside">
                  <li><strong>Liking:</strong> Click the heart icon on any post to express appreciation.</li>
                  <li><strong>Emoji Reactions:</strong> Choose from quick reaction badges (🔥, 💡, 👏, 🎯, ❤️) to interact with posts.</li>
                  <li><strong>Comments:</strong> Expand the comment tray on any post to engage in anonymous discussions.</li>
                </ul>
              </div>

              <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 space-y-3">
                <h4 className="font-bold text-zinc-900 flex items-center gap-2 text-sm">
                  <Search className="w-4 h-4 text-zinc-800" />
                  Quick Search & Direct Serial Lookup
                </h4>
                <p className="text-xs text-zinc-600">
                  Click the <strong>Search</strong> icon in the header and type any keyword or serial number (e.g., <code className="px-1.5 py-0.5 bg-zinc-200/80 rounded font-mono font-semibold">1</code> or <code className="px-1.5 py-0.5 bg-zinc-200/80 rounded font-mono font-semibold">#4</code>) to instantly filter or jump directly to that exact post.
                </p>
              </div>

              <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 space-y-3">
                <h4 className="font-bold text-zinc-900 flex items-center gap-2 text-sm">
                  <Download className="w-4 h-4 text-zinc-800" />
                  Open Data Export
                </h4>
                <p className="text-xs text-zinc-600">
                  Click the <strong>Export</strong> button in the top navigation bar to download the entire public board in structured JSON or CSV format at any time.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: ABOUT APP */}
          {activeTab === 'about' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-zinc-900 text-white space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Concept & Architecture</span>
                <h4 className="font-bold text-base">The Free Open Expression Board</h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Anonymous Serial Posts is designed as a minimalist, frictionless digital commons. It empowers people to share honest perspectives, technical queries, daily thoughts, or creative stories without the burden of social media vanity metrics, algorithmic biases, or user profiling.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="border border-zinc-200 rounded-xl p-3.5 space-y-1 bg-white">
                  <h5 className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Zero Sign-Up Barrier
                  </h5>
                  <p className="text-xs text-zinc-500">
                    No account registration, phone numbers, or passwords. Start reading and posting immediately.
                  </p>
                </div>

                <div className="border border-zinc-200 rounded-xl p-3.5 space-y-1 bg-white">
                  <h5 className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Instant Real-Time Sync
                  </h5>
                  <p className="text-xs text-zinc-500">
                    Built with cloud-native real-time database listeners for live updates without page refreshing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="space-y-3.5 animate-in fade-in duration-150 text-xs text-zinc-600">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-xs">Privacy by Design Guarantee</p>
                  <p className="text-emerald-800">
                    This application does not collect, sell, lease, or distribute any Personally Identifiable Information (PII).
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-900 text-sm">1. Information We Do Not Collect</h4>
                <p>
                  We do not collect names, email addresses, phone numbers, social credentials, geographic GPS coordinates, or biometric information. No account registration is ever required.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-900 text-sm">2. Client-Side Device Identification</h4>
                <p>
                  To allow you to edit or delete your own posts and remember your like interactions on your own device, a random cryptographic author token is generated and stored locally in your browser's <code className="px-1 py-0.5 bg-zinc-100 rounded font-mono">localStorage</code>. This token contains zero personal data and is not linked to any real-world identity.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-900 text-sm">3. Public Board Content</h4>
                <p>
                  Any text or tags you publish to the board become part of the public sequential feed. Please exercise personal discretion and avoid publishing personal credentials, confidential financial data, or private contact details.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-900 text-sm">4. Cookies & Third-Party Trackers</h4>
                <p>
                  This service utilizes zero third-party advertising cookies, zero behavioral tracking scripts, and zero cross-site marketing telemetry.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: TERMS & CONDITIONS */}
          {activeTab === 'terms' && (
            <div className="space-y-3.5 animate-in fade-in duration-150 text-xs text-zinc-600">
              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-900 text-sm">1. Acceptance of Terms</h4>
                <p>
                  By accessing or submitting content to the Anonymous Serial Board, you agree to comply with these terms, community standards, and applicable local and international laws.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-900 text-sm">2. Prohibited Conduct & Submissions</h4>
                <p>Users are strictly prohibited from utilizing this platform to submit or broadcast:</p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-zinc-600">
                  <li>Harassment, threats, stalking, or targeted hate speech against individuals or groups.</li>
                  <li>Doxxing (revealing private phone numbers, physical addresses, or confidential identities).</li>
                  <li>Spamming, automated bot flooding, or denial-of-service attempts.</li>
                  <li>Unlawful, fraudulent, or harmful commercial promotions.</li>
                  <li>Distribution of malware, harmful scripts, or exploit payloads.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-900 text-sm">3. Content Moderation & Removal</h4>
                <p>
                  To maintain platform safety, content violating safety standards or legal mandates may be removed or hidden without prior notice.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-900 text-sm">4. Disclaimer of Warranty & Limitation of Liability</h4>
                <p>
                  This service is provided on an "as is" and "as available" basis without warranties of any kind. The platform is not liable for user-submitted opinions, statements, or incidental service interruptions.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: COMMUNITY GUIDELINES */}
          {activeTab === 'rules' && (
            <div className="space-y-3.5 animate-in fade-in duration-150 text-xs text-zinc-600">
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-zinc-900 text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Core Principles of the Community
                </h4>
                <p className="text-zinc-600 leading-relaxed">
                  Anonymity is a privilege designed to protect open ideas, critical thinking, and genuine creativity. Let's make this board a welcoming and insightful space for all.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">1</span>
                  <div>
                    <h5 className="font-bold text-zinc-900">Be Constructive and Thoughtful</h5>
                    <p className="text-zinc-500 mt-0.5">Share interesting questions, perspectives, and helpful replies that add value to the community.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">2</span>
                  <div>
                    <h5 className="font-bold text-zinc-900">Protect Your Own & Others' Privacy</h5>
                    <p className="text-zinc-500 mt-0.5">Never post your own or someone else's private contact information, passwords, or location details.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">3</span>
                  <div>
                    <h5 className="font-bold text-zinc-900">Use Appropriate Topic Tags</h5>
                    <p className="text-zinc-500 mt-0.5">Categorize your thoughts under Thoughts, Question, Story, Tech, or Idea to keep the board organized.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-zinc-50/80 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400 font-mono">
            Version 2.0 • Public Domain
          </span>
          <button
            id="btn-understand-info-modal"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </div>
  );
};


