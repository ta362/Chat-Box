/**
 * Periodic Local Push Notification Scheduler
 * Sends engaging English notifications every 3 hours on devices where permission is granted.
 */

const THREE_HOURS_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
const LAST_NOTIF_KEY = 'anon_last_notification_time';

const ENGAGING_NOTIFICATIONS = [
  {
    title: 'Anon is waiting for you 🖤',
    body: "Got something on your mind? Speak your heart freely and anonymously.",
  },
  {
    title: "What's on your mind right now?",
    body: 'Share a secret, thought, or story with thousands of anonymous readers.',
  },
  {
    title: 'Anon is listening 💬',
    body: 'If you have something on your mind, speak up! Your voice is safe here.',
  },
  {
    title: 'Someone might be waiting for your story...',
    body: 'Express yourself freely without any judgment on Anon.',
  },
  {
    title: 'Need a place to vent?',
    body: 'Post anonymously and see what others are sharing right now.',
  },
];

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      schedulePeriodicCheck();
      // Send an immediate welcome check if 3 hours passed or first time
      checkAndTriggerNotification();
      return true;
    }
  } catch (err) {
    console.warn('Notification permission error:', err);
  }
  return false;
}

/**
 * Triggers a random notification if 3 hours have elapsed since last trigger
 */
export function checkAndTriggerNotification(force: boolean = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const lastTimeStr = localStorage.getItem(LAST_NOTIF_KEY);
  const lastTime = lastTimeStr ? parseInt(lastTimeStr, 10) : 0;
  const now = Date.now();

  // If 3 hours passed OR forced
  if (force || now - lastTime >= THREE_HOURS_MS) {
    const randomIndex = Math.floor(Math.random() * ENGAGING_NOTIFICATIONS.length);
    const item = ENGAGING_NOTIFICATIONS[randomIndex];

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(item.title, {
            body: item.body,
            icon: '/icon-192.png',
            badge: '/icon.svg',
            tag: 'anon-3hr-reminder',
            renotify: true,
            data: { url: '/' },
          });
        });
      } else {
        new Notification(item.title, {
          body: item.body,
          icon: '/icon-192.png',
          tag: 'anon-3hr-reminder',
        });
      }
      localStorage.setItem(LAST_NOTIF_KEY, now.toString());
    } catch (err) {
      console.warn('Failed to dispatch notification:', err);
    }
  }
}

let timerId: any = null;

/**
 * Starts periodic interval check while app is open
 */
export function schedulePeriodicCheck() {
  if (timerId) clearInterval(timerId);

  // Check every 10 minutes if 3 hours have passed
  timerId = setInterval(() => {
    checkAndTriggerNotification();
  }, 10 * 60 * 1000);

  // Also check on tab focus / visibility
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAndTriggerNotification();
    }
  });
}

/**
 * Initialize notification system on app load
 */
export function initNotificationScheduler() {
  if ('Notification' in window && Notification.permission === 'granted') {
    schedulePeriodicCheck();
    checkAndTriggerNotification();
  } else if ('Notification' in window && Notification.permission === 'default') {
    // Auto request after 5 seconds if not yet prompted
    setTimeout(() => {
      requestNotificationPermission();
    }, 5000);
  }
}
