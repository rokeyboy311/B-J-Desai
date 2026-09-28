import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let currentGoogleUser: User | any | null = null;
const listeners = new Set<(user: any | null, token: string | null) => void>();

function notifyListeners() {
  listeners.forEach(cb => cb(currentGoogleUser, cachedAccessToken));
}

export const subscribeToGoogleAuth = (callback: (user: any | null, token: string | null) => void) => {
  listeners.add(callback);
  callback(currentGoogleUser, cachedAccessToken);
  return () => {
    listeners.delete(callback);
  };
};

export const initGoogleAuth = (
  onSuccess?: (user: any, token: string) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      currentGoogleUser = user;
      if (onSuccess) onSuccess(user, cachedAccessToken);
      notifyListeners();
    } else if (!isSigningIn) {
      if (!cachedAccessToken) {
        currentGoogleUser = null;
        if (onFailure) onFailure();
        notifyListeners();
      }
    }
  });
};

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      if ((window as any).google?.accounts?.oauth2) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
      }
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error('Failed to load Google Identity Services SDK'));
    document.head.appendChild(script);
  });
}

/**
 * Fallback to Google Identity Services Token Client.
 * This runs directly without Firebase domain whitelisting restrictions,
 * allowing instant Google Sheets authentication on any custom domain, Vercel, or PWA environment.
 */
export const signInWithGisOAuth = async (): Promise<{ user: any; accessToken: string }> => {
  await loadGisScript();
  const clientId = firebaseConfig.oAuthClientId || '513724511848-j9r3ohsufqij32gclt9f3hcei48ra4mt.apps.googleusercontent.com';

  return new Promise((resolve, reject) => {
    try {
      if (!(window as any).google?.accounts?.oauth2) {
        throw new Error('Google Identity Services client is not available');
      }

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error || 'Google authentication was cancelled or failed'));
            return;
          }
          const accessToken = response.access_token;
          if (!accessToken) {
            reject(new Error('No access token received from Google'));
            return;
          }

          let profile: any = { name: 'Google Account', email: '' };
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userRes.ok) {
              profile = await userRes.json();
            }
          } catch (e) {
            console.warn('Failed to fetch userinfo from Google', e);
          }

          const userObj = {
            uid: profile.sub || 'google-user',
            displayName: profile.name || profile.email || 'Google User',
            email: profile.email || '',
            photoURL: profile.picture || ''
          };

          cachedAccessToken = accessToken;
          currentGoogleUser = userObj;
          notifyListeners();
          resolve({ user: userObj, accessToken });
        }
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    
    // Attempt Firebase popup first
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        currentGoogleUser = result.user;
        notifyListeners();
        return { user: result.user, accessToken: cachedAccessToken };
      }
    } catch (popupErr: any) {
      console.warn('Firebase popup encountered domain error, falling back to Google Identity Services OAuth:', popupErr);
      // Seamless fallback on Vercel or custom domain environments where Firebase authorized domain is restricted
      const gisResult = await signInWithGisOAuth();
      return gisResult;
    }

    // If no access token in credential, fallback to GIS
    const gisResult = await signInWithGisOAuth();
    return gisResult;
  } catch (error: any) {
    console.error('Google Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getGoogleUser = (): any | null => {
  return currentGoogleUser;
};

export const googleLogout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    // Ignore signout error if auth session was GIS-only
  }
  cachedAccessToken = null;
  currentGoogleUser = null;
  notifyListeners();
};
