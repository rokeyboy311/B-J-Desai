import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { 
  initGoogleAuth, 
  googleSignIn, 
  googleLogout, 
  getGoogleAccessToken, 
  getGoogleUser,
  subscribeToGoogleAuth
} from '../lib/googleAuth';
import { 
  syncCentralDataToGoogleSheets,
  syncLocationDataToGoogleSheets,
  syncAllGoogleSheets,
  getSavedCentralSpreadsheetId, 
  getSavedLocationSpreadsheetId,
  getSpreadsheetUrl, 
  clearAllSavedSpreadsheetIds,
  CentralSyncStats,
  LocationSheetStats,
  AllSyncResults
} from '../lib/googleSheetsService';
import { useToast } from './ToastContext';
import { useLiveSync } from '../hooks/useLiveSync';
import { apiFetch } from '../lib/api';

interface GoogleSyncContextType {
  isConnected: boolean;
  googleUser: any | null;
  centralSpreadsheetId: string | null;
  centralSpreadsheetUrl: string | null;
  locationSheets: LocationSheetStats[];
  isSyncing: boolean;
  activeSyncTarget: string | null;
  autoSyncEnabled: boolean;
  lastSyncedAt: string | null;
  lastCentralStats: CentralSyncStats | null;
  isModalOpen: boolean;
  selectedLocationId: number | null;
  setIsModalOpen: (open: boolean) => void;
  setSelectedLocationId: (id: number | null) => void;
  connectGoogle: () => Promise<boolean>;
  disconnectGoogle: () => Promise<void>;
  syncCentralSheet: () => Promise<boolean>;
  syncLocationSheet: (locationId: number) => Promise<boolean>;
  syncAllSheets: () => Promise<boolean>;
  syncNow: () => Promise<boolean>;
  getLocationSpreadsheetUrl: (locationId: number) => string | null;
  setAutoSyncEnabled: (enabled: boolean) => void;
}

const GoogleSyncContext = createContext<GoogleSyncContextType | null>(null);

export function GoogleSyncProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [googleUser, setGoogleUser] = useState<User | null>(getGoogleUser());
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [centralSpreadsheetId, setCentralSpreadsheetId] = useState<string | null>(getSavedCentralSpreadsheetId());
  const [locationSheets, setLocationSheets] = useState<LocationSheetStats[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSyncTarget, setActiveSyncTarget] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(() => {
    return localStorage.getItem('bj_google_auto_sync') !== 'false';
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    return localStorage.getItem('bj_google_last_sync');
  });
  const [lastCentralStats, setLastCentralStats] = useState<CentralSyncStats | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Subscribe to auth updates
  useEffect(() => {
    const unsubscribe = subscribeToGoogleAuth((user, token) => {
      setGoogleUser(user);
      setAccessToken(token);
    });

    initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const setAutoSyncEnabled = (enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    localStorage.setItem('bj_google_auto_sync', enabled ? 'true' : 'false');
  };

  const syncCentralSheet = async (): Promise<boolean> => {
    let token = accessToken;
    if (!token) token = await getGoogleAccessToken();
    if (!token) {
      setIsModalOpen(true);
      return false;
    }

    setIsSyncing(true);
    setActiveSyncTarget('Central Purchases & Admin');
    try {
      const res = await syncCentralDataToGoogleSheets(token);
      setCentralSpreadsheetId(res.spreadsheetId);
      setLastCentralStats(res.stats);
      setLastSyncedAt(res.stats.syncedAt);
      localStorage.setItem('bj_google_last_sync', res.stats.syncedAt);
      showToast('Central Purchases, Stock & Admin Google Sheet synced!', 'success');
      return true;
    } catch (err: any) {
      console.error('Central sync error:', err);
      showToast(err.message || 'Failed to sync Central Sheet', 'error');
      return false;
    } finally {
      setIsSyncing(false);
      setActiveSyncTarget(null);
    }
  };

  const syncLocationSheet = async (locationId: number): Promise<boolean> => {
    let token = accessToken;
    if (!token) token = await getGoogleAccessToken();
    if (!token) {
      setIsModalOpen(true);
      return false;
    }

    setIsSyncing(true);
    setActiveSyncTarget(`Location #${locationId}`);
    try {
      const stat = await syncLocationDataToGoogleSheets(token, locationId);
      setLocationSheets(prev => {
        const filtered = prev.filter(p => p.locationId !== locationId);
        return [...filtered, stat];
      });
      setLastSyncedAt(stat.syncedAt);
      localStorage.setItem('bj_google_last_sync', stat.syncedAt);
      showToast(`Google Sheet for "${stat.locationName}" synced successfully with all Team tabs!`, 'success');
      return true;
    } catch (err: any) {
      console.error(`Location #${locationId} sync error:`, err);
      showToast(err.message || 'Failed to sync Location Sheet', 'error');
      return false;
    } finally {
      setIsSyncing(false);
      setActiveSyncTarget(null);
    }
  };

  const syncAllSheets = async (): Promise<boolean> => {
    let token = accessToken;
    if (!token) token = await getGoogleAccessToken();
    if (!token) {
      setIsModalOpen(true);
      return false;
    }

    setIsSyncing(true);
    setActiveSyncTarget('All Spreadsheets (Central + Locations)');
    try {
      const res = await syncAllGoogleSheets(token);
      setCentralSpreadsheetId(res.central.spreadsheetId);
      setLastCentralStats(res.central.stats);
      setLocationSheets(res.locations);
      setLastSyncedAt(res.syncedAt);
      localStorage.setItem('bj_google_last_sync', res.syncedAt);
      showToast(`All Google Sheets (Central + ${res.locations.length} Sites) synced successfully!`, 'success');
      return true;
    } catch (err: any) {
      console.error('Sync all error:', err);
      showToast(err.message || 'Failed to sync all Google Sheets', 'error');
      return false;
    } finally {
      setIsSyncing(false);
      setActiveSyncTarget(null);
    }
  };

  const syncNow = async (): Promise<boolean> => {
    return syncAllSheets();
  };

  const connectGoogle = async (): Promise<boolean> => {
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        showToast(`Connected to Google as ${result.user.displayName || result.user.email}!`, 'success');
        
        // Trigger immediate full sync
        setIsSyncing(true);
        setActiveSyncTarget('All Sheets Initializing');
        try {
          const res = await syncAllGoogleSheets(result.accessToken);
          setCentralSpreadsheetId(res.central.spreadsheetId);
          setLastCentralStats(res.central.stats);
          setLocationSheets(res.locations);
          setLastSyncedAt(res.syncedAt);
          localStorage.setItem('bj_google_last_sync', res.syncedAt);
          showToast('Live Central & Location Google Spreadsheets created successfully!', 'success');
        } catch (syncErr: any) {
          console.error('Initial sync error:', syncErr);
          showToast(syncErr.message || 'Failed to sync data to sheet', 'error');
        } finally {
          setIsSyncing(false);
          setActiveSyncTarget(null);
        }

        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Google connect error:', err);
      showToast(err.message || 'Google Sign-in failed', 'error');
      return false;
    }
  };

  const disconnectGoogle = async () => {
    await googleLogout();
    clearAllSavedSpreadsheetIds();
    setCentralSpreadsheetId(null);
    setLocationSheets([]);
    setGoogleUser(null);
    setAccessToken(null);
    showToast('Disconnected from Google Sheets', 'info');
  };

  const getLocationSpreadsheetUrl = (locationId: number): string | null => {
    const existing = locationSheets.find(l => l.locationId === locationId);
    if (existing) return existing.spreadsheetUrl;
    const savedId = getSavedLocationSpreadsheetId(locationId);
    return savedId ? getSpreadsheetUrl(savedId) : null;
  };

  // Background Auto-sync
  useLiveSync(async () => {
    if (autoSyncEnabled && accessToken && !isSyncing) {
      try {
        const res = await syncAllGoogleSheets(accessToken);
        setCentralSpreadsheetId(res.central.spreadsheetId);
        setLastCentralStats(res.central.stats);
        setLocationSheets(res.locations);
        setLastSyncedAt(res.syncedAt);
        localStorage.setItem('bj_google_last_sync', res.syncedAt);
      } catch (e) {
        console.warn('Background Google Sheet sync silently failed:', e);
      }
    }
  }, 16000);

  const centralSpreadsheetUrl = centralSpreadsheetId ? getSpreadsheetUrl(centralSpreadsheetId) : null;

  return (
    <GoogleSyncContext.Provider
      value={{
        isConnected: !!googleUser && !!accessToken,
        googleUser,
        centralSpreadsheetId,
        centralSpreadsheetUrl,
        locationSheets,
        isSyncing,
        activeSyncTarget,
        autoSyncEnabled,
        lastSyncedAt,
        lastCentralStats,
        isModalOpen,
        selectedLocationId,
        setIsModalOpen,
        setSelectedLocationId,
        connectGoogle,
        disconnectGoogle,
        syncCentralSheet,
        syncLocationSheet,
        syncAllSheets,
        syncNow,
        getLocationSpreadsheetUrl,
        setAutoSyncEnabled
      }}
    >
      {children}
    </GoogleSyncContext.Provider>
  );
}

export function useGoogleSync() {
  const context = useContext(GoogleSyncContext);
  if (!context) {
    throw new Error('useGoogleSync must be used within a GoogleSyncProvider');
  }
  return context;
}
