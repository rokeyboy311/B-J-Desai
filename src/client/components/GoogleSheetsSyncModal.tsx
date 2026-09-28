import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, ExternalLink, RefreshCw, CheckCircle2, 
  LogOut, Layers, Building2, HardHat, CalendarCheck, Package, DollarSign
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
    connectGoogle,
    disconnectGoogle,
    syncCentralSheet,
    syncLocationSheet,
    syncAllSheets,
    getLocationSpreadsheetUrl
  } = useGoogleSync();

  const { confirmAction } = useToast();
  const [locations, setLocations] = useState<any[]>([]);
  const [activeViewTab, setActiveViewTab] = useState<'locations' | 'central'>('locations');

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
      title="Google Sheets Live Synchronization"
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
                Connect Google Sheets for Live Location-Wise &amp; Central Sync
              </h3>
              <p className="text-xs text-slate-600 max-w-lg mx-auto mt-1.5 leading-relaxed">
                Automatically create and maintain dedicated Google Sheets for all project locations (with Investor Details, Site Supply, and individual Team Attendance tabs) alongside the Central Purchases, Customer Supply, and Capital Ledger spreadsheet.
              </p>
            </div>

            {/* Google Sign-in Button */}
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
                <span>Location-Wise Spreadsheets ({locations.length} Sites)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveViewTab('central')}
                className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeViewTab === 'central' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Central Spreadsheet (Purchases, Stock, Customer, Admin)</span>
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
                    Includes: Site Overview + Investor Details + Site Supply + Team Attendance Tabs
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
                                  disabled={isSyncing}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                                >
                                  <span>Create &amp; Sync Sheet</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Stats Pills */}
                          {stat && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60 flex items-center gap-2">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <div>
                                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Allocations</span>
                                  <span className="font-bold text-slate-800">{stat.investorsCount} records</span>
                                </div>
                              </div>

                              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60 flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <div>
                                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Site Supplies</span>
                                  <span className="font-bold text-slate-800">{stat.siteSuppliesCount} records</span>
                                </div>
                              </div>

                              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60 flex items-center gap-2">
                                <HardHat className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <div>
                                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Team Tabs</span>
                                  <span className="font-bold text-slate-800">{stat.teamsCount} created</span>
                                </div>
                              </div>

                              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60 flex items-center gap-2">
                                <CalendarCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <div>
                                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Attendance</span>
                                  <span className="font-bold text-slate-800">{stat.attendanceCount} logs</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 2. CENTRAL SHEET SECTION */}
            {activeViewTab === 'central' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">
                        Central Purchases, Stock &amp; Admin Ledger
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Contains 6 tabs: Admin &amp; Capital Overview, Material Purchases, Stock Inventory, Customer Supplies, Global Expenses, and All Locations Summary.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => syncCentralSheet()}
                      disabled={isSyncing}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing && activeSyncTarget?.includes('Central') ? 'animate-spin text-emerald-600' : ''}`} />
                      <span>Sync Central</span>
                    </button>

                    {centralSpreadsheetUrl ? (
                      <a
                        href={centralSpreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        <span>Open Central Google Sheet</span>
                        <ExternalLink size={13} />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => syncCentralSheet()}
                        disabled={isSyncing}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        <span>Create &amp; Sync Sheet</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabs Preview */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-medium text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>Admin &amp; Capital Overview</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-medium text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span>Material Purchases</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-medium text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span>Stock Inventory</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-medium text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                    <span>Customer Supplies</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-medium text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    <span>Global Expenses</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-medium text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    <span>All Locations Summary</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Modal>
  );
}
