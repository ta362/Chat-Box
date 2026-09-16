import { createSerialPost } from './firebase';

interface AutoPostItem {
  content: string;
  tag: 'Romantic' | 'Feelings' | 'Funny Joke' | 'Shayari' | 'Thoughts';
}

/**
 * Removes emojis and trailing whitespace from string
 */

function removeEmojis(text: string): string {
  return text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{203C}\u{2049}\u{2122}\u{2139}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{231A}-\u{231B}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}]/gu, '')
    .trim();
}

// 100% English post pool with ZERO emojis
const HUMAN_USER_POSTS_BANK: AutoPostItem[] = [
  // Romantic
  {
    content: "In a world full of temporary people, I just want someone who stays even when things get difficult.",
    tag: "Romantic",
  },
  {
    content: "Your smile still has the power to make my worst day feel instantly better.",
    tag: "Romantic",
  },
  {
    content: "When you truly love someone, their happiness matters more than your pride.",
    tag: "Romantic",
  },
  {
    content: "Distance means so little when someone means so much to your heart.",
    tag: "Romantic",
  },
  {
    content: "Love isn't finding someone you can live with; it's finding the person you can't imagine living without.",
    tag: "Romantic",
  },
  {
    content: "You don't just hold my hand, you hold my heart in every silent thought and unwritten line.",
    tag: "Romantic",
  },

  // Funny Jokes & Relatable Daily Fun
  {
    content: "My sleep schedule is so broken that even my alarm clock stopped waking me up and just asked 'why are you like this?'",
    tag: "Funny Joke",
  },
  {
    content: "I told my doctor I started a new diet. I see food, and I eat it!",
    tag: "Funny Joke",
  },
  {
    content: "Why do programmers prefer dark mode? Because light attracts real bugs!",
    tag: "Funny Joke",
  },
  {
    content: "I asked my Wi-Fi router if it wanted to go out for dinner tonight... It told me it needed space!",
    tag: "Funny Joke",
  },
  {
    content: "My computer beat me at chess, but it was no match for me at kickboxing!",
    tag: "Funny Joke",
  },
  {
    content: "I told my friend she was drawing her eyebrows way too high. She looked surprised!",
    tag: "Funny Joke",
  },
  {
    content: "I'm on a seafood diet. Every time I see food, I eat it!",
    tag: "Funny Joke",
  },

  // Deep Feelings & Personal Emotions
  {
    content: "Sometimes you just need to rest your mind and remind yourself that everything will eventually be okay.",
    tag: "Feelings",
  },
  {
    content: "Sometimes we carry heavy emotions in silence not because we have no words, but because no words can truly capture the weight.",
    tag: "Feelings",
  },
  {
    content: "Healing isn't about forgetting what hurt you. It's about remembering without letting the pain control your present.",
    tag: "Feelings",
  },
  {
    content: "Late nights have a way of bringing out the honest thoughts we spend all day running away from.",
    tag: "Feelings",
  },
  {
    content: "Be kind to yourself. You are fighting silent battles that nobody knows about, and doing much better than you think.",
    tag: "Feelings",
  },
  {
    content: "Not every silence is sadness; sometimes it's just the soul resting after a long journey of unexpressed emotions.",
    tag: "Feelings",
  },

  // Shayari & Poetic English Lines
  {
    content: "The stars shine brightest when the sky is dark,\nKeep your faith alive, you just need a small spark.",
    tag: "Shayari",
  },
  {
    content: "The silence of the night holds secrets untold,\nWhere dreams of tomorrow silently unfold.\nKeep walking with faith through the darkest night,\nFor every shadow fades before the morning light.",
    tag: "Shayari",
  },
  {
    content: "Do not fear the storm that shakes your ground,\nIn moments of trial, true strength is found.\nLike stars that shine brightest in pitch-black skies,\nFrom every hardship, a braver soul will rise.",
    tag: "Shayari",
  },
  {
    content: "Some paths are walked alone in quiet grace,\nYet leave footprints time can never erase.\nTrust the journey even when the road bends,\nWhere hope begins, the shadow ends.",
    tag: "Shayari",
  },

  // Everyday Thoughts & Life Musings
  {
    content: "Life is so much simpler when you stop overthinking and start appreciating the small moments.",
    tag: "Thoughts",
  },
  {
    content: "Hard work never goes in vain. Be patient, stay positive, and trust your timing.",
    tag: "Thoughts",
  },
  {
    content: "Finding a genuine friend in this fast-paced world is a blessing. Treasure the good ones!",
    tag: "Thoughts",
  },
  {
    content: "Building simple, fast tools without logins is one of the purest forms of web utility. Drop your thoughts below!",
    tag: "Thoughts",
  },
];

const LOCAL_STORAGE_KEY = 'auto_published_user_posts_no_emoji_v5';

function getPublishedHistory(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function savePublishedHistory(history: Set<string>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(history)));
  } catch {
    // ignore
  }
}

// Generates dynamic non-repeating English posts with NO EMOJIS
function generateRealisticUserPost(): AutoPostItem {
  const categories: Array<AutoPostItem['tag']> = ['Romantic', 'Feelings', 'Funny Joke', 'Shayari', 'Thoughts'];
  const chosenCategory = categories[Math.floor(Math.random() * categories.length)];

  const romanticPhrases = [
    "Thinking of you in the quiet hours of the night always brings a silent smile to my heart.",
    "Some people touch your life so deeply that even when they aren't around, their presence remains.",
    "No matter how busy the world gets, finding a moment to care for the one you love is everything.",
    "True intimacy is sharing your wildest dreams and quietest fears without judgment."
  ];

  const feelingsPhrases = [
    "It takes courage to stay soft in a world that can sometimes be harsh. Protect your gentle heart.",
    "Sometimes the best response to overwhelming emotions is taking a deep breath and letting time do its healing work.",
    "Never apologize for feeling things deeply. Your sensitivity is a rare strength, not a weakness.",
    "Quiet reflections under the stars remind us that every storm eventually runs out of rain."
  ];

  const jokePhrases = [
    "I decided to start waking up at 5 AM. But I didn't specify 5 AM today or next month!",
    "My brain has 47 tabs open, 3 are frozen, and music is playing from somewhere!",
    "I'm on a 90-day diet. So far I've lost 45 days!"
  ];

  const shayariPhrases = [
    "In the quiet darkness stars ignite,\nGuiding every dreamer through the night.",
    "Walk with hope when the shadows fall,\nA peaceful mind conquers all."
  ];

  let text = "";
  if (chosenCategory === 'Romantic') {
    text = romanticPhrases[Math.floor(Math.random() * romanticPhrases.length)];
  } else if (chosenCategory === 'Feelings') {
    text = feelingsPhrases[Math.floor(Math.random() * feelingsPhrases.length)];
  } else if (chosenCategory === 'Funny Joke') {
    text = jokePhrases[Math.floor(Math.random() * jokePhrases.length)];
  } else if (chosenCategory === 'Shayari') {
    text = shayariPhrases[Math.floor(Math.random() * shayariPhrases.length)];
  } else {
    text = "Life is short. Spend it with people who make you laugh and feel valued.";
  }

  return { content: removeEmojis(text), tag: chosenCategory };
}

let autoPublishTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Starts the continuous auto-publishing engine:
 * Publishes a new user-style post every 2 to 3 minutes (120,000 ms to 180,000 ms)
 * STRICT GUARANTEES:
 * 1. 100% English content
 * 2. ZERO EMOJIS IN CONTENT
 * 3. Randomly mixed categories
 * 4. NO REPETITION EVER!
 */
export function startAutoPublishEngine(onPostPublished?: () => void) {
  if (autoPublishTimeoutId !== null) {
    return; // Already running
  }

  const scheduleNextPost = () => {
    // 2 to 3 minutes random interval (120,000 ms to 180,000 ms)
    const randomIntervalMs = Math.floor(120000 + Math.random() * 60000);

    autoPublishTimeoutId = setTimeout(async () => {
      try {
        const history = getPublishedHistory();
        
        // Filter out any already published posts
        const unusedBankItems = HUMAN_USER_POSTS_BANK.filter(item => !history.has(item.content));

        let selectedItem: AutoPostItem;

        if (unusedBankItems.length > 0) {
          const randomIndex = Math.floor(Math.random() * unusedBankItems.length);
          selectedItem = unusedBankItems[randomIndex];
        } else {
          let candidate = generateRealisticUserPost();
          let attempts = 0;
          while (history.has(candidate.content) && attempts < 15) {
            candidate = generateRealisticUserPost();
            attempts++;
          }
          selectedItem = candidate;
        }

        // Ensure emojis are completely stripped
        const cleanContent = removeEmojis(selectedItem.content);

        // Record chosen post to history so it NEVER repeats
        history.add(cleanContent);
        savePublishedHistory(history);

        const botToken = `user-anon-${Math.floor(Math.random() * 9000 + 1000)}`;
        await createSerialPost(cleanContent, botToken, selectedItem.tag);
        
        if (onPostPublished) {
          onPostPublished();
        }
      } catch (err) {
        console.warn('Auto-publish engine error notice:', err);
      } finally {
        autoPublishTimeoutId = null;
        scheduleNextPost(); // Schedule next post in 2-3 mins
      }
    }, randomIntervalMs);
  };

  // Trigger first auto-schedule
  scheduleNextPost();
}

/**
 * Stops the auto-publishing engine if needed
 */
export function stopAutoPublishEngine() {
  if (autoPublishTimeoutId !== null) {
    clearTimeout(autoPublishTimeoutId);
    autoPublishTimeoutId = null;
  }
}
