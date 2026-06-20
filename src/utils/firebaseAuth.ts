import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse app initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const provider = new GoogleAuthProvider();
// Request Gmail readonly scope
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');

let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    return localStorage.getItem('gmail_access_token');
  } catch {
    return null;
  }
})();

// Helper to detect mobile devices or standalone PWA installed instances
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return isMobile || isStandalone;
};

// Initialize auth state listener. Call this on app load or when syncing.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check redirect result first for mobile redirects
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          try {
            localStorage.setItem('gmail_access_token', cachedAccessToken);
          } catch (e) {
            console.error(e);
          }
          if (onAuthSuccess) {
            onAuthSuccess(result.user, cachedAccessToken);
          }
        }
      }
    })
    .catch((err) => {
      console.error('Redirect authentication error:', err);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // Try to restore from localStorage
        const storedToken = (() => {
          try {
            return localStorage.getItem('gmail_access_token');
          } catch {
            return null;
          }
        })();
        if (storedToken) {
          cachedAccessToken = storedToken;
          if (onAuthSuccess) onAuthSuccess(user, storedToken);
        } else {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Handled via user button click
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    
    // Check if we can do Popup (most robust across all modern mobile and desktop browsers)
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to get access token from Google Auth Provider');
      }

      cachedAccessToken = credential.accessToken;
      try {
        localStorage.setItem('gmail_access_token', cachedAccessToken);
      } catch (e) {
        console.error(e);
      }
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (popupError: any) {
      // If popup is blocked or closed/errors out, fall back to redirect on mobile
      if (
        isMobileDevice() ||
        popupError?.code === 'auth/popup-blocked' ||
        popupError?.code === 'auth/cancelled-popup-request' ||
        popupError?.code === 'auth/popup-closed-by-user'
      ) {
        console.warn('Popup login failed or bypassed, trying redirect fallback...', popupError);
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw popupError;
    }
  } catch (error: any) {
    console.error('Google Gmail Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    return localStorage.getItem('gmail_access_token');
  } catch {
    return null;
  }
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem('gmail_access_token', token);
    } else {
      localStorage.removeItem('gmail_access_token');
    }
  } catch (e) {
    console.error(e);
  }
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  try {
    localStorage.removeItem('gmail_access_token');
  } catch (e) {
    console.error(e);
  }
};
