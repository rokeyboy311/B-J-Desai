import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, Download, Search, Filter, Building, 
  Users, ShoppingCart, Truck, Receipt, Wrench, HardHat, 
  CheckCircle2, ArrowDownToLine, RefreshCw, FolderArchive, Layers
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { downloadExcelReport } from '../lib/excelExport';
import { useToast } from '../contexts/ToastContext';

interface InvestorItem {
  id: number;
  name: string;
  locationId: number;
}

interface VendorItem {
  name: string;
  count: number | string;
  total: number | string;
}

interface CustomerItem {
  name: string;
  count: number | string;
  total: number | string;
}

export default function ExcelDownloadsPage() {
  const { showToast } = useToast();
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [catalog, setCatalog] = useState<{
    investors: InvestorItem[];
    vendors: VendorItem[];
    customers: CustomerItem[];
    counts: any;
  }>({
    investors: [],
    vendors: [],
    customers: [],
    counts: {}
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [selectedLocation]);

  const loadLocations = async () => {
    try {
      const data = await apiFetch('/locations');
      if (Array.isArray(data)) {
        setLocations(data);
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    }
  };

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const query = selectedLocation && selectedLocation !== 'ALL' ? `?locationId=${selectedLocation}` : '';
      const data = await apiFetch(`/reports/download-catalog${query}`);
      setCatalog(data || { investors: [], vendors: [], customers: [], counts: {} });
    } catch (err: any) {
      showToast(err.message || 'Failed to load download catalog', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id: string, endpoint: string, filename: string) => {
    setDownloadingId(id);
    try {
      await downloadExcelReport(endpoint, filename);
      showToast(`Downloaded: ${filename}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Download failed', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // Build the complete list of downloadable items based on catalog & locations
  const allFiles = useMemo(() => {
    const files: Array<{
      id: string;
      title: string;
      filename: string;
      category: string;
      categoryLabel: string;
      icon: any;
      description: string;
      stats?: string;
      endpoint: string;
    }> = [];

    const locName = selectedLocation === 'ALL' 
      ? 'All_Locations' 
      : (locations.find(l => String(l.id) === selectedLocation)?.name || `Loc_${selectedLocation}`);

    // 1. MASTER FILES
    if (selectedLocation === 'ALL') {
      files.push({
        id: 'master_all',
        title: 'Master ERP Database Backup (સમગ્ર ડેટાબેઝ એક્સેલ)',
        filename: 'Export_All_Locations.xlsx',
        category: 'MASTER',
        categoryLabel: 'Master Report',
        icon: FolderArchive,
        description: 'Complete centralized export containing all locations, investments, purchases, supplies, labour, and supervisor records.',
        endpoint: '/reports/export-all'
      });
    }

    // 2. LOCATION MASTER FILES
    if (selectedLocation === 'ALL') {
      locations.forEach(loc => {
        files.push({
          id: `loc_all_${loc.id}`,
          title: `${loc.name} - Complete Project Workbook (પ્રોજેક્ટ સંપૂર્ણ ફાઇલ)`,
          filename: `Export_${loc.name.replace(/\s+/g, '_')}_all.xlsx`,
          category: 'LOCATION',
          categoryLabel: 'Location Master',
          icon: Building,
          description: `All 6 operational category tabs for project ${loc.name} combined in a single formatted Excel sheet.`,
          endpoint: `/reports/export-location/${loc.id}?tab=all`
        });
      });
    } else {
      files.push({
        id: `loc_single_${selectedLocation}`,
        title: `${locName} - Complete Project Workbook (પ્રોજેક્ટ સંપૂર્ણ ફાઇલ)`,
        filename: `Export_${locName.replace(/\s+/g, '_')}_all.xlsx`,
        category: 'LOCATION',
        categoryLabel: 'Location Master',
        icon: Building,
        description: `All 6 operational category tabs for project ${locName} combined in a single formatted Excel sheet.`,
        endpoint: `/reports/export-location/${selectedLocation}?tab=all`
      });
    }

    // 3. REFUNDABLE RECORDS
    files.push({
      id: `refundable_${selectedLocation}`,
      title: `Refundable Records & Security Deposits (${locName})`,
      filename: `Refundable_Records_${locName.replace(/\s+/g, '_')}.xlsx`,
      category: 'REFUNDABLE',
      categoryLabel: 'Refundable Records',
      icon: Receipt,
      description: 'Security deposits, EMD, meter deposits, and advance records with refund status and pending balance.',
      stats: `${catalog.counts?.ref_count || 0} records`,
      endpoint: `/reports/export-refundable-records${selectedLocation !== 'ALL' ? `?locationId=${selectedLocation}` : ''}`
    });

    // 4. INDIVIDUAL INVESTOR PASSBOOKS
    (catalog.investors || []).forEach(inv => {
      const safeName = inv.name.replace(/\s+/g, '_');
      files.push({
        id: `investor_${inv.id}`,
        title: `${inv.name} - Personal Investor Passbook (ઇન્વેસ્ટર પાસબુક)`,
        filename: `Investor_${safeName}_Passbook.xlsx`,
        category: 'INVESTOR',
        categoryLabel: 'Investor Passbook',
        icon: Users,
        description: `Chronological deposit ledger, payment upad, and running balance statement for ${inv.name}.`,
        endpoint: `/reports/export-investor/${inv.id}`
      });
    });

    // 5. INDIVIDUAL VENDOR PURCHASE BILLS
    (catalog.vendors || []).forEach(v => {
      const safeName = v.name.replace(/\s+/g, '_');
      files.push({
        id: `vendor_${safeName}`,
        title: `${v.name} - Vendor Purchase Bill (વેન્ડર બિલ હિસાબ)`,
        filename: `Vendor_${safeName}_Purchases.xlsx`,
        category: 'VENDOR',
        categoryLabel: 'Vendor Bill',
        icon: ShoppingCart,
        description: `All materials purchased from ${v.name}, payment records, and outstanding balance summary.`,
        stats: `${v.count} bills • ₹${Number(v.total || 0).toLocaleString()}`,
        endpoint: `/reports/export-vendor-purchases?partyName=${encodeURIComponent(v.name)}${selectedLocation !== 'ALL' ? `&locationId=${selectedLocation}` : ''}`
      });
    });

    // 6. INDIVIDUAL CUSTOMER SUPPLY BILLS
    (catalog.customers || []).forEach(c => {
      const safeName = c.name.replace(/\s+/g, '_');
      files.push({
        id: `customer_${safeName}`,
        title: `${c.name} - Customer Supply Bill (ગ્રાહક સપ્લાય બિલ)`,
        filename: `Customer_${safeName}_Bill.xlsx`,
        category: 'CUSTOMER',
        categoryLabel: 'Customer Bill',
        icon: Truck,
        description: `Detailed material supply invoices, deliveries, and payment status for customer ${c.name}.`,
        stats: `${c.count} deliveries • ₹${Number(c.total || 0).toLocaleString()}`,
        endpoint: `/reports/export-customer-supplies?partyName=${encodeURIComponent(c.name)}${selectedLocation !== 'ALL' ? `&locationId=${selectedLocation}` : ''}`
      });
    });

    // 7. SITE SUPPLIES REGISTER (Category 5)
    files.push({
      id: `site_supplies_${selectedLocation}`,
      title: `Site Supplies & Materials Register (${locName})`,
      filename: `Site_Supplies_${locName.replace(/\s+/g, '_')}.xlsx`,
      category: 'OPERATIONAL',
      categoryLabel: 'Site Supplies',
      icon: Wrench,
      description: `Internal site material receipts, team dispatches, and itemized GST calculation register for ${locName}.`,
      endpoint: `/reports/export-site-supplies?locationId=${selectedLocation}`
    });

    // 8. MATERIAL PURCHASE VS SUPPLY PRICE ANALYTICS
    files.push({
      id: `mat_analytics_${selectedLocation}`,
      title: `Material Purchase vs Supply Analytics (${locName}) (મટિરિયલ ખરીદી vs સપ્લાય ભાવ એનાલિટિક્સ)`,
      filename: `Material_Purchase_Supply_Analytics_${locName.replace(/\s+/g, '_')}.xlsx`,
      category: 'OPERATIONAL',
      categoryLabel: 'Material Analytics',
      icon: Layers,
      description: `Comprehensive comparison of material purchase price vs supply price, total quantities, remaining stock inventory, and margin analytics.`,
      endpoint: `/reports/export-material-analytics${selectedLocation !== 'ALL' ? `?locationId=${selectedLocation}` : ''}`
    });

    if (selectedLocation !== 'ALL') {
      files.push({
        id: `labour_${selectedLocation}`,
        title: `Labour Wages & Attendance Register (${locName})`,
        filename: `Labour_Salaries_${locName.replace(/\s+/g, '_')}.xlsx`,
        category: 'OPERATIONAL',
        categoryLabel: 'Labour Wages',
        icon: HardHat,
        description: `Labour attendance, team advances (upad), and weekly/monthly wage disbursement passbook.`,
        endpoint: `/reports/export-location/${selectedLocation}?tab=labour-salary`
      });
    }

    return files;
  }, [catalog, locations, selectedLocation]);

  const filteredFiles = useMemo(() => {
    return allFiles.filter(f => {
      const matchSearch = !searchTerm.trim() ||
        f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.categoryLabel.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = activeCategory === 'ALL' || f.category === activeCategory;

      return matchSearch && matchCategory;
    });
  }, [allFiles, searchTerm, activeCategory]);

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30 text-indigo-300 shrink-0">
              <FileSpreadsheet className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white">Excel Downloads Hub (એક્સેલ ડાઉનલોડ સેન્ટર)</h1>
              <p className="text-xs text-indigo-200 mt-0.5">
                તમામ કેટેગરી, ઇન્વેસ્ટર પાસબુક, વેન્ડર બિલ, કસ્ટમર સપ્લાય તથા રિફંડેબલ રેકોર્ડ્સની એક્સેલ ફાઇલો ડાઉનલોડ કરો
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          {/* Location Picker */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 text-xs font-bold text-white">
            <Building className="w-4 h-4 text-indigo-300 shrink-0" />
            <select
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold text-white cursor-pointer w-full pr-2"
            >
              <option value="ALL" className="text-slate-900">All Locations (બધા પ્રોજેક્ટ)</option>
              {locations.map(l => (
                <option key={l.id} value={String(l.id)} className="text-slate-900">{l.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleDownload('master_top', '/reports/export-all', 'Export_All_Locations.xlsx')}
            disabled={downloadingId !== null}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50 min-h-[38px]"
            id="download-master-btn"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Download Master File (.xlsx)
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Total Files Listed</div>
          <div className="text-2xl font-black text-slate-900 mt-0.5">{allFiles.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Ready to Export</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-purple-600 uppercase">Investor Passbooks</div>
          <div className="text-2xl font-black text-purple-700 mt-0.5">{catalog.investors?.length || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Individual passbooks</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-blue-600 uppercase">Vendor Purchases</div>
          <div className="text-2xl font-black text-blue-700 mt-0.5">{catalog.vendors?.length || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Supplier bills</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-600 uppercase">Customer Bills</div>
          <div className="text-2xl font-black text-emerald-700 mt-0.5">{catalog.customers?.length || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Supply records</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-amber-600 uppercase">Refundable Deposits</div>
          <div className="text-2xl font-black text-amber-700 mt-0.5">{catalog.counts?.ref_count || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active security items</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { key: 'ALL', label: 'All Files (બધી ફાઇલ)' },
            { key: 'INVESTOR', label: 'Investor Passbooks (ઇન્વેસ્ટર)' },
            { key: 'VENDOR', label: 'Vendor Bills (ખરીદી)' },
            { key: 'CUSTOMER', label: 'Customer Bills (સપ્લાય)' },
            { key: 'REFUNDABLE', label: 'Refundables (રિફંડેબલ)' },
            { key: 'LOCATION', label: 'Location Bundles (પ્રોજેક્ટ)' },
          ].map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategory === cat.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by file name, party or category..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Downloadable Files List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            Showing {filteredFiles.length} of {allFiles.length} available Excel files
          </span>
          <button
            onClick={loadCatalog}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh List
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredFiles.map((file) => {
            const IconComponent = file.icon;
            const isDownloading = downloadingId === file.id;

            return (
              <div 
                key={file.id} 
                className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl shrink-0 mt-0.5">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 truncate">
                        {file.title}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                        {file.categoryLabel}
                      </span>
                      {file.stats && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                          {file.stats}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {file.description}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                      {file.filename}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 md:self-center">
                  <button
                    onClick={() => handleDownload(file.id, file.endpoint, file.filename)}
                    disabled={isDownloading}
                    className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                  >
                    <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                    {isDownloading ? 'Downloading...' : 'Download Excel (.xlsx)'}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredFiles.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-sm text-slate-700">No Excel files match your filter</p>
              <p className="text-xs text-slate-400 mt-1">Try clearing your search query or choosing "All Files".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
