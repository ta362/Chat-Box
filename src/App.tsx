import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { InstallBanner } from './components/InstallBanner';
import { CreatePostCard } from './components/CreatePostCard';
import { PostCard } from './components/PostCard';
import { InfoModal } from './components/InfoModal';
import { DownloadModal } from './components/DownloadModal';
import { SerialPost } from './types';
import { soundPlayer } from './lib/audio';
import { checkIsSimilarPost } from './lib/similarity';
import { computeCurrentLikesForPost } from './lib/likesEngine';
import { computeCurrentCommentsForPost } from './lib/commentsEngine';
import { startAutoPublishEngine, stopAutoPublishEngine, checkAndBackfillOfflinePosts } from './lib/autoPublisher';
import {
  getOrCreateAnonymousToken,
  getSoundPreference,
  setSoundPreference,
} from './lib/storage';
import {
  subscribeToPosts,
  createSerialPost,
  togglePostLike,
  addPostReaction,
  fetchPostBySerial,
  deletePostsBySerials,
  deleteBengaliPosts,
  updateSerialPost,
  deleteSerialPost,
} from './lib/firebase';
import {
  Sparkles,
  Layers,
  MessageSquareOff,
  Plus,
  ArrowDown,
} from 'lucide-react';

const INITIAL_FALLBACK_POSTS: SerialPost[] = [
  {
    id: 'post-init-1',
    serialNumber: 1,
    content: 'Welcome to the Anonymous Serial Post Board!\nEvery post is assigned a permanent, strictly sequential serial number (#1, #2, #3...). You can like, comment, and react anonymously!',
    tag: 'Thoughts',
    authorToken: 'system',
    createdAt: Date.now() - 1000 * 60 * 60 * 8, // 8 hours ago (Stopped at target 50k!)
    likesCount: 50000,
    targetLikes: 50000,
    commentsCount: 142,
    likedBy: [],
    reactions: { '🔥': 820, '❤️': 640, '💡': 410 },
  },
  {
    id: 'post-init-2',
    serialNumber: 2,
    content: 'What is a book, article, or idea that completely changed the way you think about life or work?',
    tag: 'Question',
    authorToken: 'system',
    createdAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago (Growing towards 20k target!)
    likesCount: 5200,
    targetLikes: 20000,
    commentsCount: 98,
    likedBy: [],
    reactions: { '💡': 930, '👏': 310 },
  },
];

const FILTER_TAGS = ['All', 'Thoughts', 'Question', 'Story', 'Tech', 'Idea', 'General'];

export default function App() {
  const [posts, setPosts] = useState<SerialPost[]>(() => {
    try {
      const cached = localStorage.getItem('anon_local_posts_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_FALLBACK_POSTS;
  });

  const [onlineCount, setOnlineCount] = useState<number>(
    () => Math.floor(Math.random() * (100000 - 50000 + 1)) + 50000
  );
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(getSoundPreference());
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  // Serial direct search state
  const [searchedSerialPost, setSearchedSerialPost] = useState<SerialPost | null>(null);
  const [isSearchingSerial, setIsSearchingSerial] = useState<boolean>(false);

  // Scroll to bottom & new post notification states
  const [showScrollDown, setShowScrollDown] = useState<boolean>(false);
  const [hasNewPosts, setHasNewPosts] = useState<boolean>(false);

  const authorToken = useMemo(() => getOrCreateAnonymousToken(), []);
  const previousPostsCountRef = useRef<number>(0);

  // Monitor scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = 250;
      const isAwayFromBottom =
        window.innerHeight + window.scrollY < document.documentElement.scrollHeight - scrollThreshold;
      setShowScrollDown(isAwayFromBottom);
      if (!isAwayFromBottom) {
        setHasNewPosts(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Next continuous serial number calculation
  const nextSerialNumber = useMemo(() => {
    if (posts.length === 0) return 1;
    return Math.max(...posts.map((p) => p.serialNumber)) + 1;
  }, [posts]);

  // Persist local cache
  useEffect(() => {
    try {
      if (posts.length > 0) {
        localStorage.setItem('anon_local_posts_cache', JSON.stringify(posts.slice(0, 300)));
      }
    } catch {
      // ignore
    }
  }, [posts]);

  // Sound preference toggle
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSoundPreference(next);
  };

  // Real-time Firestore Posts Subscription & Likes Engine
  useEffect(() => {
    const unsubscribe = subscribeToPosts(
      (realtimePosts) => {
        if (realtimePosts.length > 0) {
          if (
            previousPostsCountRef.current > 0 &&
            realtimePosts.length > previousPostsCountRef.current
          ) {
            const newest = realtimePosts[realtimePosts.length - 1];
            if (newest.authorToken !== authorToken && soundEnabled) {
              soundPlayer.playPop();
            }
            const isAwayFromBottom =
              window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 250;
            if (isAwayFromBottom) {
              setHasNewPosts(true);
            }
          }
          previousPostsCountRef.current = realtimePosts.length;
          // Compute age-based dynamic likes & comments for each post
          const processed = realtimePosts.map((p) => ({
            ...p,
            likesCount: computeCurrentLikesForPost(p, authorToken),
            commentsCount: computeCurrentCommentsForPost(p),
          }));
          setPosts(processed);
          // Auto-backfill any missed posts generated during offline periods when tab was closed
          checkAndBackfillOfflinePosts(realtimePosts);
        }
      },
      (err) => {
        console.warn('Posts real-time listener notice:', err);
      }
    );

    const timer = setInterval(() => {
      setOnlineCount((c) => {
        const delta = (Math.random() > 0.48 ? 1 : -1) * Math.floor(Math.random() * 300 + 80);
        const next = c + delta;
        if (next < 50000) return 50000 + Math.floor(Math.random() * 400);
        if (next > 100000) return 100000 - Math.floor(Math.random() * 400);
        return next;
      });
    }, 3500);

    // Live likes & comments progression timer (recalculates based on age, stopping after target duration)
    const progressionTimer = setInterval(() => {
      setPosts((prevPosts) => {
        if (prevPosts.length === 0) return prevPosts;
        return prevPosts.map((p) => ({
          ...p,
          likesCount: computeCurrentLikesForPost(p, authorToken),
          commentsCount: computeCurrentCommentsForPost(p),
        }));
      });
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(timer);
      clearInterval(progressionTimer);
    };
  }, [authorToken, soundEnabled]);

  // Auto-publishing engine: Publishes new user posts every 2-3 mins
  useEffect(() => {
    deleteBengaliPosts();
    deletePostsBySerials([3, 4, 5]);
    startAutoPublishEngine();
    return () => {
      stopAutoPublishEngine();
    };
  }, []);

  // Serial search lookup
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchedSerialPost(null);
      setIsSearchingSerial(false);
      return;
    }

    const serialNum = query.startsWith('#')
      ? parseInt(query.slice(1), 10)
      : /^\d+$/.test(query)
      ? parseInt(query, 10)
      : null;

    if (serialNum !== null && !isNaN(serialNum)) {
      const existsLocally = posts.some((p) => p.serialNumber === serialNum);
      if (!existsLocally) {
        setIsSearchingSerial(true);
        fetchPostBySerial(serialNum)
          .then((res) => setSearchedSerialPost(res))
          .finally(() => setIsSearchingSerial(false));
      } else {
        setSearchedSerialPost(null);
      }
    } else {
      setSearchedSerialPost(null);
    }
  }, [searchQuery, posts]);

  // Publish a new post
  const handlePublishPost = async (content: string, tag?: string): Promise<boolean> => {
    // Duplicate / Similarity Protection Check
    const similarityResult = checkIsSimilarPost(content, posts);
    if (similarityResult.isDuplicate) {
      return false;
    }

    setIsPublishing(true);
    if (soundEnabled) {
      soundPlayer.playSend();
    }

    try {
      const newPost = await createSerialPost(content, authorToken, tag);
      // Optimistic update
      setPosts((prev) => {
        if (prev.some((p) => p.id === newPost.id || p.serialNumber === newPost.serialNumber)) {
          return prev;
        }
        return [...prev, newPost].sort((a, b) => a.serialNumber - b.serialNumber);
      });
      return true;
    } catch (err) {
      console.error('Failed to create post:', err);
      // Fallback local post
      const fallbackPost: SerialPost = {
        id: `post-${Date.now()}`,
        serialNumber: nextSerialNumber,
        content,
        tag,
        createdAt: Date.now(),
        authorToken,
        likesCount: 0,
        commentsCount: 0,
        likedBy: [],
        reactions: {},
      };
      setPosts((prev) => [...prev, fallbackPost]);
      return true;
    } finally {
      setIsPublishing(false);
    }
  };

  // Toggle Like on a Post
  const handleToggleLike = async (postId: string, currentLiked: boolean) => {
    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const currentLikedBy = Array.isArray(p.likedBy) ? p.likedBy : [];
        const nextLikedBy = currentLiked
          ? currentLikedBy.filter((t) => t !== authorToken)
          : [...currentLikedBy, authorToken];
        const nextCount = currentLiked
          ? Math.max(0, (p.likesCount || 1) - 1)
          : (p.likesCount || 0) + 1;

        return {
          ...p,
          likesCount: nextCount,
          likedBy: nextLikedBy,
        };
      })
    );

    try {
      await togglePostLike(postId, authorToken, currentLiked);
    } catch (err) {
      console.error('Like toggle failed:', err);
    }
  };

  // Add Reaction on a Post
  const handleAddReaction = async (postId: string, emoji: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const currentCount = p.reactions?.[emoji] || 0;
        return {
          ...p,
          reactions: {
            ...(p.reactions || {}),
            [emoji]: currentCount + 1,
          },
        };
      })
    );

    try {
      await addPostReaction(postId, emoji);
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  // Edit a post within 30 min
  const handleEditPost = async (
    postId: string,
    newContent: string,
    postAuthorToken: string,
    createdAt: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await updateSerialPost(postId, newContent, authorToken, postAuthorToken, createdAt);
      if (res.success) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, content: newContent.trim() } : p))
        );
      }
      return res;
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to edit post.' };
    }
  };

  // Delete a post within 30 min
  const handleDeletePost = async (
    postId: string,
    postAuthorToken: string,
    createdAt: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await deleteSerialPost(postId, authorToken, postAuthorToken, createdAt);
      if (res.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
      return res;
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to delete post.' };
    }
  };

  // Filter & Sort Posts
  const displayedPosts = useMemo(() => {
    let result = [...posts];

    // 1. Tag filtering
    if (selectedTagFilter !== 'All') {
      result = result.filter((p) => p.tag === selectedTagFilter);
    }

    // 2. Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const isSerialSearch = q.startsWith('#')
        ? parseInt(q.slice(1), 10)
        : /^\d+$/.test(q)
        ? parseInt(q, 10)
        : null;

      result = result.filter((p) => {
        if (isSerialSearch !== null && !isNaN(isSerialSearch)) {
          if (p.serialNumber === isSerialSearch) return true;
        }
        return p.content.toLowerCase().includes(q) || (p.tag && p.tag.toLowerCase().includes(q));
      });

      if (searchedSerialPost && !result.some((p) => p.id === searchedSerialPost.id)) {
        result.unshift(searchedSerialPost);
      }
    }

    // 3. Sorting strictly by continuous serial sequence (#1 -> #N)
    result.sort((a, b) => a.serialNumber - b.serialNumber);

    return result;
  }, [posts, selectedTagFilter, searchQuery, searchedSerialPost]);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col selection:bg-zinc-200">
      {/* Top Floating Browser Install Banner */}
      <InstallBanner />

      {/* Top Header */}
      <Header
        totalPosts={posts.length > 0 ? Math.max(...posts.map((p) => p.serialNumber)) : 0}
        onOpenInfo={() => setIsInfoOpen(true)}
        onOpenDownload={() => setIsDownloadOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => {
          setIsSearchOpen(!isSearchOpen);
          if (isSearchOpen) setSearchQuery('');
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-5">
        {/* Create Post Dialog Modal */}
        <CreatePostCard
          onPublishPost={handlePublishPost}
          nextSerialNumber={nextSerialNumber}
          isPublishing={isPublishing}
          isOpen={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          existingPosts={posts}
        />

        {/* Searching Status */}
        {isSearchingSerial && (
          <div className="p-3 bg-zinc-200/60 rounded-xl text-center text-xs text-zinc-600 flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
            <span>Looking up serial post #{searchQuery}...</span>
          </div>
        )}

        {/* Posts Feed */}
        {displayedPosts.length === 0 && !isSearchingSerial ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-400">
            <MessageSquareOff className="w-10 h-10 mx-auto mb-3 opacity-40 text-zinc-400" />
            <h3 className="text-base font-semibold text-zinc-700">No posts found</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              {searchQuery || selectedTagFilter !== 'All'
                ? 'Try adjusting your search query or topic filter.'
                : 'Be the first to publish post #1 on the board!'}
            </p>
            {(searchQuery || selectedTagFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTagFilter('All');
                }}
                className="mt-3 text-xs text-zinc-900 font-semibold underline underline-offset-2"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserToken={authorToken}
                onToggleLike={handleToggleLike}
                onAddReaction={handleAddReaction}
                onEditPost={handleEditPost}
                onDeletePost={handleDeletePost}
                soundEnabled={soundEnabled}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer info banner */}
      <footer className="w-full border-t border-zinc-200 bg-white py-4 mt-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-800">Anonymous Serial Posts</span>
            <span>•</span>
            <span>All posts strictly ordered in continuous sequence</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsInfoOpen(true)}
              className="hover:text-zinc-900 underline underline-offset-2"
            >
              How it works
            </button>
            <button
              onClick={() => setIsDownloadOpen(true)}
              className="hover:text-zinc-900 underline underline-offset-2 font-medium"
            >
              Export data
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Scroll to Bottom Arrow Button (Clean single arrow icon, no circle background) */}
      {(showScrollDown || hasNewPosts) && (
        <button
          id="btn-scroll-bottom"
          onClick={() => {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: 'smooth',
            });
            setHasNewPosts(false);
          }}
          className={`fixed bottom-20 left-6 z-30 p-2 transition-all duration-300 active:scale-90 focus:outline-none ${
            hasNewPosts
              ? 'text-emerald-600 animate-bounce drop-shadow'
              : 'text-black hover:text-zinc-700 drop-shadow'
          }`}
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* Floating '+' Action Button */}
      {!isCreateOpen && (
        <button
          id="btn-fab-new-post"
          onClick={() => {
            setIsCreateOpen(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="fixed bottom-6 right-6 z-30 bg-zinc-900 hover:bg-black text-white p-3.5 sm:px-4 sm:py-3 rounded-2xl shadow-lg hover:shadow-xl flex items-center gap-2 font-semibold text-sm transition-all duration-200 active:scale-95 group border border-zinc-700/50"
          title="Create New Post"
          aria-label="Create New Post"
        >
          <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
          <span className="hidden sm:inline">New Post</span>
        </button>
      )}

      {/* Info Modal */}
      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        totalPosts={posts.length}
      />

      {/* Download / Export Modal */}
      <DownloadModal
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
        posts={posts}
        totalCount={posts.length}
      />
    </div>
  );
}
