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
let currentGoogleUser: User | null = null;
const listeners = new Set<(user: User | null, token: string | null) => void>();

function notifyListeners() {
  listeners.forEach(cb => cb(currentGoogleUser, cachedAccessToken));
}

export const subscribeToGoogleAuth = (callback: (user: User | null, token: string | null) => void) => {
  listeners.add(callback);
  callback(currentGoogleUser, cachedAccessToken);
  return () => {
    listeners.delete(callback);
  };
};

export const initGoogleAuth = (
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    currentGoogleUser = user;
    if (user && cachedAccessToken) {
      if (onSuccess) onSuccess(user, cachedAccessToken);
      notifyListeners();
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onFailure) onFailure();
        notifyListeners();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    currentGoogleUser = result.user;
    notifyListeners();
    return { user: result.user, accessToken: cachedAccessToken };
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

export const getGoogleUser = (): User | null => {
  return currentGoogleUser;
};

export const googleLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  currentGoogleUser = null;
  notifyListeners();
};
