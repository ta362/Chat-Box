const ANON_TOKEN_KEY = 'anon_client_token';
const SOUND_ENABLED_KEY = 'anon_sound_enabled';

export function getOrCreateAnonymousToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem(ANON_TOKEN_KEY);
  if (!token) {
    token = 'anon_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(ANON_TOKEN_KEY, token);
  }
  return token;
}

export function getSoundPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(SOUND_ENABLED_KEY);
  return val === null ? true : val === 'true';
}

export function setSoundPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}
