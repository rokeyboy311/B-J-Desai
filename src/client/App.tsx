/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { GoogleSyncProvider } from './contexts/GoogleSyncContext';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import LocationsPage from './pages/LocationsPage';
import LocationDetailsPage from './pages/LocationDetailsPage';
import CentralInvestorPoolPage from './pages/CentralInvestorPoolPage';
import GlobalRecordsPage from './pages/GlobalRecordsPage';
import ReportsPage from './pages/ReportsPage';
import ExcelDownloadsPage from './pages/ExcelDownloadsPage';
import ActivityLogPage from './pages/ActivityLogPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import MaterialPurchasePage from './pages/MaterialPurchasePage';
import CustomerSupplyPage from './pages/CustomerSupplyPage';

export default function App() {
  React.useEffect(() => {
    try {
      const CLEAR_MARKER = 'bd_erp_db_cleared_20261030';
      if (!sessionStorage.getItem(CLEAR_MARKER)) {
        sessionStorage.removeItem('bd_erp_locations_breakdown_cache');
        sessionStorage.removeItem('bd_erp_records_cache');
        sessionStorage.removeItem('bd_erp_dash_metrics_cache');
        sessionStorage.removeItem('bd_erp_dash_recon_cache');
        sessionStorage.setItem(CLEAR_MARKER, '1');
      }
    } catch {}
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <GoogleSyncProvider>
          <HashRouter>
            <GoogleSheetsSyncModal />
            <Routes>
              <Route path="/login" element={<Navigate to="/" replace />} />
              
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/investors" element={<AdminPage />} />
                  <Route path="/customer-supply" element={<CustomerSupplyPage />} />
                  <Route path="/material-purchase" element={<MaterialPurchasePage />} />
                  <Route path="/materials" element={<MaterialPurchasePage />} />
                  <Route path="/locations" element={<LocationsPage />} />
                  <Route path="/locations/:id" element={<LocationDetailsPage />} />
                  <Route path="/locations/:locationId/central-investors" element={<CentralInvestorPoolPage />} />
                  <Route path="/records" element={<GlobalRecordsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/excel-downloads" element={<ExcelDownloadsPage />} />
                  <Route path="/activity" element={<ActivityLogPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </HashRouter>
        </GoogleSyncProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
