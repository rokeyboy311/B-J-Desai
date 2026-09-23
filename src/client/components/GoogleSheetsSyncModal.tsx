import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, ExternalLink, RefreshCw, CheckCircle2, 
  LogOut, ShieldCheck, Database, Sparkles, Layers,
  ShoppingBag, MapPin, Users, DollarSign, AlertCircle, ArrowUpRight,
  HardHat, CalendarCheck, Package, Building2, Check
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { useGoogleSync } from '../contexts/GoogleSyncContext';
import { useToast } from '../contexts/ToastContext';
import { apiFetch } from '../lib/api';

export function GoogleSheetsSyncModal() {
  const {
    isModalOpen,
    setIsModalOpen,
    isConnected,
    googleUser,
    centralSpreadsheetUrl,
    locationSheets,
    isSyncing,
    activeSyncTarget,
    autoSyncEnabled,
    lastSyncedAt,
    lastCentralStats,
    connectGoogle,
    disconnectGoogle,
    syncCentralSheet,
    syncLocationSheet,
    syncAllSheets,
    getLocationSpreadsheetUrl,
    setAutoSyncEnabled,
    selectedLocationId,
    setSelectedLocationId
  } = useGoogleSync();

  const { confirmAction, showToast } = useToast();
  const [locations, setLocations] = useState<any[]>([]);
  const [activeViewTab, setActiveViewTab] = useState<'central' | 'locations'>('locations');

  useEffect(() => {
    if (isModalOpen) {
      apiFetch('/locations')
        .then((res) => {
          if (Array.isArray(res)) setLocations(res);
        })
        .catch(() => {});
    }
  }, [isModalOpen]);

  const handleDisconnect = async () => {
    const confirmed = await confirmAction({
      title: 'Disconnect Google Sheets',
      message: 'Are you sure you want to disconnect Google Sheets? Live synchronization will pause.',
      confirmLabel: 'Disconnect',
      isDanger: true
    });
    if (confirmed) {
      await disconnectGoogle();
    }
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      title="Google Sheets Live Sync (લાઇવ સ્પ્રેડશીટ સિન્ક)"
      maxWidth="3xl"
    >
      <div className="space-y-5">
        
        {/* Connection Status Banner */}
        {!isConnected ? (
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
              <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Connect Google Sheets for Real-Time Location-Wise & Central Sync
              </h3>
              <p className="text-xs text-slate-600 max-w-lg mx-auto mt-1.5 leading-relaxed">
                તમારા તમામ પ્રોજેક્ટ્સ માટે અલગ-અલગ લોકેશન સ્પ્રેડશીટ (Investor Details, Site Supply, અને તમામ Team Tabs with Attendance) તેમજ સેન્ટ્રલ પર્ચેઝ, કસ્ટમર સપ્લાય અને એડમિન કેપિટલની અલગ Google Sheet ઓટોમેટિક અપડેટ થશે.
              </p>
            </div>

            {/* Official Google Sign in Button */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={connectGoogle}
                disabled={isSyncing}
                className="gsi-material-button group inline-flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                <span>Sign in with Google to Enable Sync</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Account Card & Live Status */}
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {googleUser?.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName || 'Google User'}
                    className="w-11 h-11 rounded-full border-2 border-emerald-500 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {googleUser?.displayName?.[0] || googleUser?.email?.[0] || 'G'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">{googleUser?.displayName || 'Google Account'}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      Live Sync Connected
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium block">{googleUser?.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncAllSheets()}
                  disabled={isSyncing}
                  className="px-3.5 py-1.5 bg-[#0B1D3A] hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>{isSyncing ? (activeSyncTarget || 'Syncing...') : 'Sync All Spreadsheets'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>

            {/* View Selector Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveViewTab('locations')}
                className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeViewTab === 'locations' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Location-Wise Sheets (પ્રોજેક્ટ લોકેશન સ્પ્રેડશીટ્સ)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveViewTab('central')}
                className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeViewTab === 'central' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Central Sheet (Purchases, Stock, Customer, Admin)</span>
              </button>
            </div>

            {/* 1. LOCATION-WISE SHEETS SECTION */}
            {activeViewTab === 'locations' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Site Location Spreadsheets ({locations.length} Sites)
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Each site includes: Investor Details + Site Supply + Team Attendance Tabs
                  </span>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {locations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                      No locations found. Create a location first in Site Locations.
                    </div>
                  ) : (
                    locations.map((loc) => {
                      const sheetUrl = getLocationSpreadsheetUrl(loc.id);
                      const stat = locationSheets.find(l => l.locationId === loc.id);

                      return (
                        <div key={loc.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 hover:border-blue-300 transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                                <Building2 className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                                  <span>{loc.name} (Site Ledger)</span>
                                  {sheetUrl && (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                                      Active Sheet
                                    </span>
                                  )}
                                </h4>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                  {loc.address || 'Construction Project Site'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => syncLocationSheet(loc.id)}
                                disabled={isSyncing}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing && activeSyncTarget?.includes(`#${loc.id}`) ? 'animate-spin text-blue-600' : ''}`} />
                                <span>Sync Site</span>
                              </button>

                              {sheetUrl ? (
                                <a
                                  href={sheetUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                                >
                                  <span>Open Google Sheet</span>
                                  <ExternalLink size={13} />
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => syncLocationSheet(loc.id)}
                                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                                >
                                  <span>Create & Sync Sheet</span>
                                  <ArrowUpRight size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Sheet Structure Pill Badges */}
                          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-[10px]">
                            <span className="text-slate-400 font-semibold mr-1">Tabs in this sheet:</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">1. Site Overview</span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-md font-bold">2. Investor Details ({stat?.investorsCount ?? '✓'})</span>
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-bold">3. Site Supply Record ({stat?.siteSuppliesCount ?? '✓'})</span>
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-md font-bold">4. Team Attendance & Supplies Tabs ({stat?.teamsCount ?? 'Teams'} Tabs)</span>
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-md font-medium">5. Site Expenses</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 2. CENTRAL PURCHASES, CUSTOMER & ADMIN SHEET SECTION */}
            {activeViewTab === 'central' && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">B J Enterprise - Central Purchases & Admin Ledger</h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Last Synced: {lastSyncedAt || 'Just now'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => syncCentralSheet()}
                      disabled={isSyncing}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing && activeSyncTarget?.includes('Central') ? 'animate-spin text-emerald-600' : ''}`} />
                      <span>Sync Central</span>
                    </button>

                    {centralSpreadsheetUrl && (
                      <a
                        href={centralSpreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        <span>Open Central Sheet</span>
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Synced Tabs breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-blue-600" />
                      Admin Capital
                    </span>
                    <span className="font-bold text-slate-800">{lastCentralStats?.investorsCount ?? '✓'} Investors</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <ShoppingBag size={14} className="text-purple-600" />
                      Purchases
                    </span>
                    <span className="font-bold text-slate-800">{lastCentralStats?.purchasesCount ?? '✓'}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <Layers size={14} className="text-emerald-600" />
                      Stock Items
                    </span>
                    <span className="font-bold text-slate-800">{lastCentralStats?.stockCount ?? '✓'}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <Users size={14} className="text-indigo-600" />
                      Customer Supply
                    </span>
                    <span className="font-bold text-slate-800">{lastCentralStats?.customerSuppliesCount ?? '✓'}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <DollarSign size={14} className="text-rose-600" />
                      Global Expenses
                    </span>
                    <span className="font-bold text-slate-800">{lastCentralStats?.expensesCount ?? '✓'}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <Building2 size={14} className="text-teal-600" />
                      Site Locations
                    </span>
                    <span className="font-bold text-slate-800">{locations.length} Sites</span>
                  </div>
                </div>
              </div>
            )}

            {/* Auto Sync Toggle */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black text-slate-900 block">Automatic Real-Time Sync</span>
                <span className="text-[11px] text-slate-500 font-medium">
                  નવો ડેટા (પર્ચેઝ, સાઇટ સપ્લાય, હાજરી કે ઇન્વેસ્ટર ટ્રાન્સફર) ઉમેરાતા જ Google Sheets માં આપોઆપ લાઇવ અપડેટ થશે
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

          </div>
        )}

      </div>
    </Modal>
  );
}
