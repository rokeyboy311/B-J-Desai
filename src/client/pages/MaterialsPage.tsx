import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, ShoppingCart, Truck, Building2, Plus, Search, Filter, 
  FileDown, ArrowUpRight, ArrowDownLeft, Check, AlertCircle, RefreshCw, 
  Trash2, Edit3, X, DollarSign, Calendar, Tag, UserCheck, Layers, Users, ChevronRight,
  HardHat, Wrench
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { apiFetch } from "../lib/api";
import MaterialAnalyticsSection from "../components/MaterialAnalyticsSection";

interface Location {
  id: number;
  name: string;
}

interface MaterialPurchase {
  id: number;
  locationId: number;
  locationName?: string;
  date: string;
  partyName: string;
  materialName: string;
  materialId?: number;
  quantity: string;
  unit: string;
  rate: string;
  subtotal: string;
  transportCost: string;
  discount: string;
  taxPercentage: string;
  tax: string;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  paymentStatus: string;
  paymentMethod?: string;
  referenceNumber?: string;
  description?: string;
}

interface CustomerMaterialSupply {
  id: number;
  locationId: number;
  locationName?: string;
  date: string;
  partyName: string;
  materialName: string;
  materialId?: number;
  quantity: string;
  unit: string;
  rate: string;
  subtotal: string;
  transportCost: string;
  discount: string;
  taxPercentage: string;
  tax: string;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  paymentStatus: string;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
}

interface TeamMaterialSupply {
  id: number;
  locationId: number;
  locationName?: string;
  date: string;
  teamName: string;
  partyName: string;
  workDescription: string;
  materialName: string;
  materialQuantity: string;
  materialUnit: string;
  materialRate: string;
  materialAmount: string;
  totalAmount: string;
  paidAmount: string;
  paymentStatus: string;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
}

export default function MaterialsPage() {
  const { user } = useAuth();
  const { showToast, confirmAction } = useToast();
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"purchases" | "supplies" | "stock">("purchases");
  const [supplySubTab, setSupplySubTab] = useState<"all" | "teams" | "customers">("all");
  
  // Locations state
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | "ALL">("ALL");

  // Data states
  const [purchases, setPurchases] = useState<MaterialPurchase[]>([]);
  const [customerSupplies, setCustomerSupplies] = useState<CustomerMaterialSupply[]>([]);
  const [teamSupplies, setTeamSupplies] = useState<TeamMaterialSupply[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modals state
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isTeamSupplyModalOpen, setIsTeamSupplyModalOpen] = useState(false);
  const [isCustomerSupplyModalOpen, setIsCustomerSupplyModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form states
  const [purchaseForm, setPurchaseForm] = useState({
    locationId: "",
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    materialName: "",
    quantity: "",
    unit: "Bags",
    rate: "",
    transportCost: "0",
    discount: "0",
    taxPercentage: "0",
    paidAmount: "",
    paymentStatus: "PAID",
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    description: ""
  });

  const [teamSupplyForm, setTeamSupplyForm] = useState({
    locationId: "",
    date: new Date().toISOString().split("T")[0],
    teamName: "Mason Team",
    partyName: "",
    workDescription: "Site Wall Masonry Construction",
    materialName: "",
    materialQuantity: "",
    materialUnit: "Bags",
    materialRate: "",
    paidAmount: "0",
    paymentStatus: "PAID",
    notes: ""
  });

  const [customerSupplyForm, setCustomerSupplyForm] = useState({
    locationId: "",
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    materialName: "",
    quantity: "",
    unit: "Bags",
    rate: "",
    paidAmount: "",
    paymentStatus: "PAID",
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: ""
  });

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const data = await apiFetch("/locations");
        if (Array.isArray(data)) {
          setLocations(data);
          if (data.length > 0 && selectedLocationId === "ALL" && !purchaseForm.locationId) {
            setPurchaseForm(prev => ({ ...prev, locationId: data[0].id.toString() }));
            setTeamSupplyForm(prev => ({ ...prev, locationId: data[0].id.toString() }));
            setCustomerSupplyForm(prev => ({ ...prev, locationId: data[0].id.toString() }));
          }
        }
      } catch (err) {
        console.error("Failed to load locations:", err);
      }
    };
    fetchLocations();
  }, []);

  // Fetch material data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const locParam = selectedLocationId === "ALL" ? "" : `?locationId=${selectedLocationId}`;

      const [pData, sData, lsData] = await Promise.all([
        apiFetch(`/materials/purchase${locParam}`).catch(() => []),
        apiFetch(`/materials/supply${locParam}`).catch(() => []),
        apiFetch(`/materials/labour-supply${locParam}`).catch(() => [])
      ]);

      setPurchases(Array.isArray(pData) ? pData : (pData?.purchases || []));
      setCustomerSupplies(Array.isArray(sData) ? sData : (sData?.supplies || []));
      setTeamSupplies(Array.isArray(lsData) ? lsData : (lsData?.labourSupplies || []));

    } catch (err) {
      console.error("Error fetching material records:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedLocationId]);

  // Derived Metrics for Purchases
  const purchaseMetrics = useMemo(() => {
    let totalPurchases = 0;
    let totalPaidFromCapital = 0;
    let totalOutstanding = 0;

    purchases.forEach(p => {
      totalPurchases += Number(p.totalAmount || 0);
      totalPaidFromCapital += Number(p.paidAmount || 0);
      totalOutstanding += Number(p.outstandingAmount || 0);
    });

    return {
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalPaidFromCapital: Math.round(totalPaidFromCapital * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      count: purchases.length
    };
  }, [purchases]);

  // Derived Metrics for Team Supplies
  const teamSupplyMetrics = useMemo(() => {
    let totalTeamSupplyValue = 0;
    teamSupplies.forEach(ts => {
      totalTeamSupplyValue += Number(ts.materialAmount || ts.totalAmount || 0);
    });
    return {
      totalValue: Math.round(totalTeamSupplyValue * 100) / 100,
      count: teamSupplies.length
    };
  }, [teamSupplies]);

  // Derived Metrics for Customer Supplies
  const customerSupplyMetrics = useMemo(() => {
    let totalCustomerSupplyValue = 0;
    let totalPaidByCustomers = 0;
    customerSupplies.forEach(cs => {
      totalCustomerSupplyValue += Number(cs.totalAmount || 0);
      totalPaidByCustomers += Number(cs.paidAmount || 0);
    });
    return {
      totalValue: Math.round(totalCustomerSupplyValue * 100) / 100,
      totalPaid: Math.round(totalPaidByCustomers * 100) / 100,
      outstanding: Math.round((totalCustomerSupplyValue - totalPaidByCustomers) * 100) / 100,
      count: customerSupplies.length
    };
  }, [customerSupplies]);

  // Filtered lists based on search and status
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchSearch = (p.partyName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.materialName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.locationName || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "ALL" || p.paymentStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [purchases, searchQuery, statusFilter]);

  const filteredTeamSupplies = useMemo(() => {
    return teamSupplies.filter(ts => {
      return (ts.teamName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
             (ts.materialName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
             (ts.workDescription || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
             (ts.locationName || "").toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [teamSupplies, searchQuery]);

  const filteredCustomerSupplies = useMemo(() => {
    return customerSupplies.filter(cs => {
      const matchSearch = (cs.partyName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (cs.materialName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (cs.locationName || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "ALL" || cs.paymentStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [customerSupplies, searchQuery, statusFilter]);

  // Unified Supply List (Team/Site Supplies + Customer Material Supplies)
  const allSupplies = useMemo(() => {
    const list: Array<{
      id: number;
      uniqueKey: string;
      sourceType: 'TEAM' | 'CUSTOMER';
      categoryLabel: string;
      categorySubLabel: string;
      locationId: number;
      locationName: string;
      date: string;
      partyName: string;
      materialName: string;
      quantity: string;
      unit: string;
      rate: string;
      totalAmount: string;
      paidAmount: string;
      outstandingAmount: string;
      paymentStatus: string;
      workDescription?: string;
      notes?: string;
      raw: any;
    }> = [];

    teamSupplies.forEach(ts => {
      list.push({
        id: ts.id,
        uniqueKey: `team-${ts.id}`,
        sourceType: 'TEAM',
        categoryLabel: 'Site Supply',
        categorySubLabel: 'Team Wise Supply',
        locationId: ts.locationId,
        locationName: ts.locationName || 'Site',
        date: ts.date,
        partyName: ts.teamName || ts.partyName || 'Direct Site Team',
        materialName: ts.materialName || 'Material',
        quantity: ts.materialQuantity || '0',
        unit: ts.materialUnit || 'Nos',
        rate: ts.materialRate || '0',
        totalAmount: ts.materialAmount || ts.totalAmount || '0',
        paidAmount: ts.paidAmount || ts.materialAmount || ts.totalAmount || '0',
        outstandingAmount: '0.00',
        paymentStatus: ts.paymentStatus || 'PAID',
        workDescription: ts.workDescription,
        notes: ts.notes,
        raw: ts
      });
    });

    customerSupplies.forEach(cs => {
      list.push({
        id: cs.id,
        uniqueKey: `cust-${cs.id}`,
        sourceType: 'CUSTOMER',
        categoryLabel: 'Material Supply',
        categorySubLabel: 'Customer Supply',
        locationId: cs.locationId,
        locationName: cs.locationName || 'Customer Site',
        date: cs.date,
        partyName: cs.partyName || 'Customer',
        materialName: cs.materialName || 'Material',
        quantity: cs.quantity || '0',
        unit: cs.unit || 'Nos',
        rate: cs.rate || '0',
        totalAmount: cs.totalAmount || '0',
        paidAmount: cs.paidAmount || '0',
        outstandingAmount: cs.outstandingAmount || '0',
        paymentStatus: cs.paymentStatus || 'PAID',
        workDescription: cs.notes || '',
        notes: cs.notes,
        raw: cs
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [teamSupplies, customerSupplies]);

  const filteredAllSupplies = useMemo(() => {
    return allSupplies.filter(s => {
      const matchSearch = (s.partyName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.materialName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.locationName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.categoryLabel || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "ALL" || s.paymentStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [allSupplies, searchQuery, statusFilter]);

  // Aggregate Material-Wise Summary (Which material supplied how much and where)
  const materialSupplySummary = useMemo(() => {
    const map: Record<string, {
      materialName: string;
      unit: string;
      teamQty: number;
      customerQty: number;
      totalQty: number;
      teamValue: number;
      customerValue: number;
      totalValue: number;
      locations: Set<string>;
    }> = {};

    teamSupplies.forEach(ts => {
      const key = (ts.materialName || 'UNKNOWN').trim().toUpperCase();
      if (!map[key]) {
        map[key] = {
          materialName: ts.materialName || 'UNKNOWN',
          unit: ts.materialUnit || 'Nos',
          teamQty: 0,
          customerQty: 0,
          totalQty: 0,
          teamValue: 0,
          customerValue: 0,
          totalValue: 0,
          locations: new Set()
        };
      }
      const q = parseFloat(ts.materialQuantity || '0') || 0;
      const v = parseFloat(ts.materialAmount || ts.totalAmount || '0') || 0;
      map[key].teamQty += q;
      map[key].totalQty += q;
      map[key].teamValue += v;
      map[key].totalValue += v;
      if (ts.locationName) map[key].locations.add(ts.locationName);
    });

    customerSupplies.forEach(cs => {
      const key = (cs.materialName || 'UNKNOWN').trim().toUpperCase();
      if (!map[key]) {
        map[key] = {
          materialName: cs.materialName || 'UNKNOWN',
          unit: cs.unit || 'Nos',
          teamQty: 0,
          customerQty: 0,
          totalQty: 0,
          teamValue: 0,
          customerValue: 0,
          totalValue: 0,
          locations: new Set()
        };
      }
      const q = parseFloat(cs.quantity || '0') || 0;
      const v = parseFloat(cs.totalAmount || '0') || 0;
      map[key].customerQty += q;
      map[key].totalQty += q;
      map[key].customerValue += v;
      map[key].totalValue += v;
      if (cs.locationName) map[key].locations.add(cs.locationName);
    });

    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
  }, [teamSupplies, customerSupplies]);

  // Handlers for Material Purchase Submit
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.materialName || !purchaseForm.quantity || !purchaseForm.rate) {
      alert("મહેરબાની કરીને મટિરિયલનું નામ, જથ્થો અને ભાવ ભરો / Please fill material name, qty & rate");
      return;
    }

    try {
      const url = editingItem ? `/materials/purchase/${editingItem.id}` : "/materials/purchase";
      const method = editingItem ? "PUT" : "POST";

      const qty = parseFloat(purchaseForm.quantity) || 0;
      const rate = parseFloat(purchaseForm.rate) || 0;
      const subtotal = Math.round(qty * rate * 100) / 100;
      const transportCost = parseFloat(purchaseForm.transportCost) || 0;
      const discount = parseFloat(purchaseForm.discount) || 0;
      const taxPercentage = parseFloat(purchaseForm.taxPercentage) || 0;
      const taxable = Math.max(0, subtotal - discount);
      const tax = Math.round(taxable * (taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((taxable + tax + transportCost) * 100) / 100;

      const paidAmount = purchaseForm.paidAmount !== "" ? parseFloat(purchaseForm.paidAmount) : totalAmount;
      const outstandingAmount = Math.max(0, totalAmount - paidAmount);

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          locationId: purchaseForm.locationId ? parseInt(purchaseForm.locationId, 10) : null,
          date: purchaseForm.date,
          partyName: purchaseForm.partyName || "General Vendor",
          materialName: purchaseForm.materialName,
          quantity: qty,
          unit: purchaseForm.unit,
          rate,
          transportCost,
          discount,
          taxPercentage,
          totalAmount,
          paidAmount,
          outstandingAmount,
          paymentStatus: purchaseForm.paymentStatus,
          paymentMethod: purchaseForm.paymentMethod,
          referenceNumber: purchaseForm.referenceNumber,
          description: purchaseForm.description
        })
      });

      showToast(editingItem ? "મટિરિયલ ખરીદી રેકોર્ડ અપડેટ થયો!" : "નવી મટિરિયલ ખરીદી સેન્ટ્રલ ઇન્વેન્ટરીમાં સફળતાપૂર્વક નોંધાઈ!", "success");
      setIsPurchaseModalOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (err: any) {
      console.error("Error saving purchase record:", err);
      showToast(err.message || "Error saving purchase record", "error");
    }
  };

  // Handlers for Team Material Supply Submit
  const handleTeamSupplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamSupplyForm.locationId) {
      showToast("મહેરબાની કરીને પ્રોજેક્ટ લોકેશન સિલેક્ટ કરો / Please select location", "error");
      return;
    }
    if (!teamSupplyForm.materialName || !teamSupplyForm.materialQuantity) {
      showToast("મહેરબાની કરીને મટિરિયલનું નામ અને જથ્થો ભરો / Please fill material name & quantity", "error");
      return;
    }

    try {
      const url = editingItem ? `/materials/labour-supply/${editingItem.id}` : "/materials/labour-supply";
      const method = editingItem ? "PUT" : "POST";

      const qty = parseFloat(teamSupplyForm.materialQuantity) || 0;
      const rate = parseFloat(teamSupplyForm.materialRate || "0") || 0;
      const amount = Math.round(qty * rate * 100) / 100;

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          locationId: parseInt(teamSupplyForm.locationId, 10),
          date: teamSupplyForm.date,
          teamName: teamSupplyForm.teamName,
          partyName: teamSupplyForm.teamName,
          workDescription: teamSupplyForm.workDescription,
          materialName: teamSupplyForm.materialName,
          materialQuantity: qty,
          materialUnit: teamSupplyForm.materialUnit,
          materialRate: rate,
          materialAmount: amount,
          labourAmount: 0,
          notes: teamSupplyForm.notes
        })
      });

      showToast(editingItem ? "ટીમ સપ્લાય રેકોર્ડ અપડેટ થયો!" : "ટીમમાં મટિરિયલ સફળતાપૂર્વક સપ્લાય થયું!", "success");
      setIsTeamSupplyModalOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (err: any) {
      console.error("Error saving team supply:", err);
      showToast(err.message || "Error saving record", "error");
    }
  };

  // Handlers for Customer Material Supply Submit
  const handleCustomerSupplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerSupplyForm.locationId) {
      showToast("મહેરબાની કરીને પ્રોજેક્ટ લોકેશન સિલેક્ટ કરો / Please select location", "error");
      return;
    }
    if (!customerSupplyForm.partyName || !customerSupplyForm.materialName || !customerSupplyForm.quantity) {
      showToast("મહેરબાની કરીને કસ્ટમર નામ, મટિરિયલ અને જથ્થો ભરો / Please fill customer name, material & quantity", "error");
      return;
    }

    try {
      const url = editingItem ? `/materials/supply/${editingItem.id}` : "/materials/supply";
      const method = editingItem ? "PUT" : "POST";

      const qty = parseFloat(customerSupplyForm.quantity) || 0;
      const rate = parseFloat(customerSupplyForm.rate) || 0;
      const totalAmount = Math.round(qty * rate * 100) / 100;
      const paidAmount = customerSupplyForm.paidAmount !== "" ? parseFloat(customerSupplyForm.paidAmount) : totalAmount;

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          locationId: parseInt(customerSupplyForm.locationId, 10),
          date: customerSupplyForm.date,
          partyName: customerSupplyForm.partyName,
          materialName: customerSupplyForm.materialName,
          quantity: qty,
          unit: customerSupplyForm.unit,
          rate,
          totalAmount,
          paidAmount,
          paymentStatus: customerSupplyForm.paymentStatus,
          paymentMethod: customerSupplyForm.paymentMethod,
          referenceNumber: customerSupplyForm.referenceNumber,
          notes: customerSupplyForm.notes
        })
      });

      showToast(editingItem ? "કસ્ટમર સપ્લાય અપડેટ થયો!" : "કસ્ટમર મટિરિયલ સપ્લાય સફળતાપૂર્વક ઉમેરાયો!", "success");
      setIsCustomerSupplyModalOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (err: any) {
      console.error("Error saving customer supply:", err);
      showToast(err.message || "Error saving record", "error");
    }
  };

  // Delete item handler
  const handleDelete = async (type: "purchase" | "supply" | "labour-supply", id: number) => {
    const itemLabel =
      type === "purchase"
        ? "Material Purchase (મટિરિયલ ખરીદી)"
        : type === "supply"
        ? "Customer Material Supply (કસ્ટમર સપ્લાય)"
        : "Team Material Supply (લેબર ટીમ સપ્લાય)";

    const confirmed = await confirmAction({
      title: "Delete Material Record",
      message: `શું તમે ખરેખર આ ${itemLabel} રેકોર્ડ ડિલીટ કરવા માગો છો? ઇન્વેસ્ટર કેપિટલ અને સ્ટોક આપોઆપ રીવર્સ થઈ જશે.`,
      confirmLabel: "Delete (ડિલીટ)",
      isDanger: true,
      requirePassword: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/materials/${type}/${id}`, {
        method: "DELETE"
      });
      showToast("મટિરિયલ રેકોર્ડ સફળતાપૂર્વક ડિલીટ થઈ ગયો!", "success");
      fetchData();
    } catch (err: any) {
      console.error("Error deleting material record:", err);
      showToast(err.message || "Failed to delete material record", "error");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-full text-xs font-bold uppercase tracking-wider">
                Category: Material Purchase & Supply
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-xs font-bold">
                Linked with Investor Capital
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Package className="w-8 h-8 text-indigo-400" />
              Material Management (મટિરિયલ વ્યવસ્થાપન)
            </h1>
            <p className="text-sm text-indigo-200 mt-1 max-w-2xl leading-relaxed">
              નવી ખરીદી ઇન્વેસ્ટર મૂડીમાંથી આપોઆપ કપાય છે. લોકેશન વાઇઝ લેબર ટીમ સપ્લાય અને કસ્ટમર સપ્લાય રેકોર્ડ્સ ટ્રેક કરો.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                setEditingItem(null);
                setPurchaseForm({
                  locationId: selectedLocationId !== "ALL" ? selectedLocationId.toString() : (locations[0]?.id?.toString() || ""),
                  date: new Date().toISOString().split("T")[0],
                  partyName: "",
                  materialName: "",
                  quantity: "",
                  unit: "Bags",
                  rate: "",
                  transportCost: "0",
                  discount: "0",
                  taxPercentage: "0",
                  paidAmount: "",
                  paymentStatus: "PAID",
                  paymentMethod: "Bank Transfer",
                  referenceNumber: "",
                  description: ""
                });
                setIsPurchaseModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-emerald-500 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + New Material Purchase
            </button>

            <button
              onClick={() => {
                setEditingItem(null);
                setTeamSupplyForm({
                  locationId: selectedLocationId !== "ALL" ? selectedLocationId.toString() : (locations[0]?.id?.toString() || ""),
                  date: new Date().toISOString().split("T")[0],
                  teamName: "Mason Team",
                  partyName: "Mason Team",
                  workDescription: "Site Wall Masonry Construction",
                  materialName: "",
                  materialQuantity: "",
                  materialUnit: "Bags",
                  materialRate: "",
                  paidAmount: "0",
                  paymentStatus: "PAID",
                  notes: ""
                });
                setIsTeamSupplyModalOpen(true);
              }}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-500 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              + Supply to Team
            </button>

            <button
              onClick={() => {
                setEditingItem(null);
                setCustomerSupplyForm({
                  locationId: selectedLocationId !== "ALL" ? selectedLocationId.toString() : (locations[0]?.id?.toString() || ""),
                  date: new Date().toISOString().split("T")[0],
                  partyName: "",
                  materialName: "",
                  quantity: "",
                  unit: "Bags",
                  rate: "",
                  paidAmount: "",
                  paymentStatus: "PAID",
                  paymentMethod: "Bank Transfer",
                  referenceNumber: "",
                  notes: ""
                });
                setIsCustomerSupplyModalOpen(true);
              }}
              className="px-4 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-amber-500 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              + Supply to Customer
            </button>
          </div>
        </div>
      </div>

      {/* Global Location Selector Filter */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider shrink-0">Filter Location:</span>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            className="w-full md:w-64 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Project Locations (તમામ સાઇટ્સ)</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        {/* Global Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search material, party, team name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-2 border border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("purchases")}
          className={`flex-1 min-w-[200px] px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "purchases"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShoppingCart className="w-4 h-4 text-emerald-600" />
          1. Material Purchase Records ({purchases.length})
        </button>

        <button
          onClick={() => setActiveTab("supplies")}
          className={`flex-1 min-w-[200px] px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "supplies"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Truck className="w-4 h-4 text-indigo-600" />
          2. Location Material Supply Records ({teamSupplies.length + customerSupplies.length})
        </button>

        <button
          onClick={() => setActiveTab("stock")}
          className={`flex-1 min-w-[200px] px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "stock"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4 text-amber-600" />
          3. Master Stock Register & Analytics
        </button>
      </div>

      {/* TAB 1: MATERIAL PURCHASES */}
      {activeTab === "purchases" && (
        <div className="space-y-6">
          {/* Purchase Metrics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total Material Purchases</span>
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-3 text-2xl font-black text-emerald-900">₹{purchaseMetrics.totalPurchases.toLocaleString()}</div>
              <p className="text-[11px] text-emerald-700 mt-1">કુલ મટિરિયલ ખરીદી રકમ ({purchaseMetrics.count} રેકોર્ડ)</p>
            </div>

            <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">Paid from Investor Capital</span>
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-3 text-2xl font-black text-indigo-900">₹{purchaseMetrics.totalPaidFromCapital.toLocaleString()}</div>
              <p className="text-[11px] text-indigo-700 mt-1">ઇન્વેસ્ટર મૂડીમાંથી ચૂકવેલ રકમ (Deducted from Pool)</p>
            </div>

            <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Outstanding Payable</span>
                <AlertCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-3 text-2xl font-black text-rose-900">₹{purchaseMetrics.totalOutstanding.toLocaleString()}</div>
              <p className="text-[11px] text-rose-700 mt-1">વેપારીઓને ચૂકવવાની બાકી રકમ</p>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Net Stock Capital Impact</span>
                <Package className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-3 text-2xl font-black text-white">₹{purchaseMetrics.totalPaidFromCapital.toLocaleString()}</div>
              <p className="text-[11px] text-indigo-300 mt-1">સાઇટ્સ પર વિતરણ માટે ઉપલબ્ધ ખરીદેલ સ્ટોક</p>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Material Purchase Register (મટિરિયલ ખરીદી પત્રક)</h3>
                <span className="text-xs text-slate-500 font-medium">({filteredPurchases.length} Items)</span>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="PAID">PAID</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="UNPAID">UNPAID</option>
                </select>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  Loading Material Purchases...
                </div>
              ) : filteredPurchases.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-medium text-xs">
                  કોઈ મટિરિયલ ખરીદી રેકોર્ડ મળ્યો નથી. Click <b>+ New Material Purchase</b> to record purchases.
                </div>
              ) : (
                filteredPurchases.map((p) => (
                  <div key={`m-card-${p.id}`} className="p-4 space-y-3 bg-white hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded text-[11px] font-bold flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-indigo-600" />
                        {p.locationName || "Site"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs font-medium">{p.date}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          p.paymentStatus === "PAID"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : p.paymentStatus === "PARTIAL"
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-rose-100 text-rose-800 border-rose-200"
                        }`}>
                          {p.paymentStatus}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-extrabold text-slate-900">{p.partyName}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-indigo-700">{p.materialName}</span>
                        <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          {p.quantity} {p.unit}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Rate</div>
                        <div className="font-semibold text-slate-700">₹{Number(p.rate || 0).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Total</div>
                        <div className="font-black text-slate-900">₹{Number(p.totalAmount || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-emerald-600">Paid from Capital</div>
                        <div className="font-bold text-emerald-700">₹{Number(p.paidAmount || 0).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-rose-600">Balance Due</div>
                        <div className="font-bold text-rose-700">₹{Number(p.outstandingAmount || 0).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(p);
                          setPurchaseForm({
                            locationId: p.locationId.toString(),
                            date: p.date,
                            partyName: p.partyName,
                            materialName: p.materialName,
                            quantity: p.quantity,
                            unit: p.unit || "Bags",
                            rate: p.rate,
                            transportCost: p.transportCost || "0",
                            discount: p.discount || "0",
                            taxPercentage: p.taxPercentage || "0",
                            paidAmount: p.paidAmount,
                            paymentStatus: p.paymentStatus,
                            paymentMethod: p.paymentMethod || "Bank Transfer",
                            referenceNumber: p.referenceNumber || "",
                            description: p.description || ""
                          });
                          setIsPurchaseModalOpen(true);
                        }}
                        className="flex-1 min-h-[42px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-600" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete("purchase", p.id)}
                        className="flex-1 min-h-[42px] px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-rose-200 transition-colors cursor-pointer active:scale-95"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" /> Delete (ડિલીટ)
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Project Site</th>
                    <th className="p-3.5">Supplier / Vendor</th>
                    <th className="p-3.5">Material & Quantity</th>
                    <th className="p-3.5 text-right">Rate (₹)</th>
                    <th className="p-3.5 text-right">Total (₹)</th>
                    <th className="p-3.5 text-right font-bold text-indigo-700">Paid from Capital (₹)</th>
                    <th className="p-3.5 text-right text-rose-700">Balance Due (₹)</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading Material Purchases...
                      </td>
                    </tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                        કોઈ મટિરિયલ ખરીદી રેકોર્ડ મળ્યો નથી. Click <b>+ New Material Purchase</b> to record purchases.
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">{p.date}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                            <Building2 className="w-2.5 h-2.5 text-indigo-600" />
                            {p.locationName || "Site"}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">{p.partyName}</td>
                        <td className="p-3.5">
                          <span className="font-extrabold text-slate-900">{p.materialName}</span>
                          <span className="text-slate-500 font-semibold text-[11px] block">{p.quantity} {p.unit}</span>
                        </td>
                        <td className="p-3.5 text-right font-semibold text-slate-700">₹{Number(p.rate || 0).toLocaleString()}</td>
                        <td className="p-3.5 text-right font-bold text-slate-900">₹{Number(p.totalAmount || 0).toLocaleString()}</td>
                        <td className="p-3.5 text-right font-black text-emerald-800 bg-emerald-50/50">
                          ₹{Number(p.paidAmount || 0).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right font-bold text-rose-700">
                          ₹{Number(p.outstandingAmount || 0).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            p.paymentStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : p.paymentStatus === "PARTIAL"
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-rose-100 text-rose-800 border-rose-200"
                          }`}>
                            {p.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem(p);
                                setPurchaseForm({
                                  locationId: p.locationId.toString(),
                                  date: p.date,
                                  partyName: p.partyName,
                                  materialName: p.materialName,
                                  quantity: p.quantity,
                                  unit: p.unit || "Bags",
                                  rate: p.rate,
                                  transportCost: p.transportCost || "0",
                                  discount: p.discount || "0",
                                  taxPercentage: p.taxPercentage || "0",
                                  paidAmount: p.paidAmount,
                                  paymentStatus: p.paymentStatus,
                                  paymentMethod: p.paymentMethod || "Bank Transfer",
                                  referenceNumber: p.referenceNumber || "",
                                  description: p.description || ""
                                });
                                setIsPurchaseModalOpen(true);
                              }}
                              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete("purchase", p.id)}
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOCATION MATERIAL SUPPLY RECORDS */}
      {activeTab === "supplies" && (
        <div className="space-y-6">
          
          {/* Sub-tabs for Team vs Customer Supply */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSupplySubTab("all")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  supplySubTab === "all"
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Layers className="w-4 h-4" />
                All Material Supplies (સર્વ વિતરણ વિગત) ({allSupplies.length})
              </button>

              <button
                onClick={() => setSupplySubTab("teams")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  supplySubTab === "teams"
                    ? "bg-teal-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <HardHat className="w-4 h-4" />
                a) Team Wise Material Supply = Site Supply ({filteredTeamSupplies.length})
              </button>

              <button
                onClick={() => setSupplySubTab("customers")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  supplySubTab === "customers"
                    ? "bg-amber-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Users className="w-4 h-4" />
                b) Customer Material Supply = Material Supply ({filteredCustomerSupplies.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingItem(null);
                  setTeamSupplyForm({
                    locationId: selectedLocationId !== "ALL" ? selectedLocationId.toString() : (locations[0]?.id?.toString() || ""),
                    date: new Date().toISOString().split("T")[0],
                    teamName: "Mason Team",
                    partyName: "Mason Team",
                    workDescription: "Site Wall Masonry Construction",
                    materialName: "",
                    materialQuantity: "",
                    materialUnit: "Bags",
                    materialRate: "",
                    paidAmount: "0",
                    paymentStatus: "PAID",
                    notes: ""
                  });
                  setIsTeamSupplyModalOpen(true);
                }}
                className="px-3.5 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold shadow hover:bg-teal-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Site Supply (Team)
              </button>

              <button
                onClick={() => {
                  setEditingItem(null);
                  setCustomerSupplyForm({
                    locationId: selectedLocationId !== "ALL" ? selectedLocationId.toString() : (locations[0]?.id?.toString() || ""),
                    date: new Date().toISOString().split("T")[0],
                    partyName: "",
                    materialName: "",
                    quantity: "",
                    unit: "Bags",
                    rate: "",
                    paidAmount: "",
                    paymentStatus: "PAID",
                    paymentMethod: "Bank Transfer",
                    referenceNumber: "",
                    notes: ""
                  });
                  setIsCustomerSupplyModalOpen(true);
                }}
                className="px-3.5 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold shadow hover:bg-amber-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Customer Supply
              </button>
            </div>
          </div>

          {/* SUBTAB ALL: COMPLETE MATERIAL SUPPLY REGISTER (LOCATION WISE, CATEGORY WISE, MATERIAL WISE) */}
          {supplySubTab === "all" && (
            <div className="space-y-6">
              {/* High-level KPI summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Site Supply (Team Wise)</span>
                    <HardHat className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="text-2xl font-black text-teal-950 mt-1">₹{teamSupplyMetrics.totalValue.toLocaleString()}</div>
                  <span className="text-[11px] text-teal-700 font-medium">{teamSupplyMetrics.count} સાઇટ વિતરણ એન્ટ્રીઝ (= Site Supply)</span>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Customer Material Supply</span>
                    <Truck className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-950 mt-1">₹{customerSupplyMetrics.totalValue.toLocaleString()}</div>
                  <span className="text-[11px] text-amber-700 font-medium">{customerSupplyMetrics.count} કસ્ટમર સપ્લાય (= Material Supply)</span>
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Total Dispatches</span>
                    <Layers className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-1">{allSupplies.length} Dispatches</div>
                  <span className="text-[11px] text-indigo-200 font-medium">કુલ વિતરણ રેકોર્ડ્સ (ટીમ + કસ્ટમર)</span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Combined Supply Value</span>
                    <Building2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-950 mt-1">
                    ₹{(teamSupplyMetrics.totalValue + customerSupplyMetrics.totalValue).toLocaleString()}
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium">{materialSupplySummary.length} અલગ અલગ મટિરિયલ્સ સપ્લાય થયા</span>
                </div>
              </div>

              {/* Material-Wise Breakdown Summary Cards (કયું મટિરિયલ કેટલું સપ્લાય થયું) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-600" />
                      Material-Wise Supply Summary (કયું મટિરિયલ કેટલું સપ્લાય થયું તેનો સારાંશ)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      દરેક મટિરિયલનું કુલ વિતરણ (સાઇટ / લેબર ટીમ સપ્લાય vs કસ્ટમર મટિરિયલ સપ્લાય) અને ક્યાં ક્યાં લોકેશન માં વપરાયું.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold text-xs rounded-full">
                    {materialSupplySummary.length} Materials Active
                  </span>
                </div>

                {materialSupplySummary.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    હજુ સુધી કોઈ મટિરિયલ સપ્લાય થયું નથી / No material supplies recorded yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {materialSupplySummary.map((m) => (
                      <div key={m.materialName} className="p-3.5 bg-slate-50/70 hover:bg-slate-100/70 transition-colors border border-slate-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900 text-sm tracking-tight">{m.materialName}</span>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-md font-extrabold text-xs">
                            Total: {m.totalQty} {m.unit}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
                          <div className="bg-teal-50/60 border border-teal-100 p-2 rounded-lg">
                            <span className="text-teal-800 font-bold block">Site (Team) Supply:</span>
                            <span className="text-xs font-extrabold text-teal-950">{m.teamQty} {m.unit}</span>
                            <span className="text-[10px] text-teal-700 block">₹{m.teamValue.toLocaleString()}</span>
                          </div>
                          <div className="bg-amber-50/60 border border-amber-100 p-2 rounded-lg">
                            <span className="text-amber-800 font-bold block">Customer Supply:</span>
                            <span className="text-xs font-extrabold text-amber-950">{m.customerQty} {m.unit}</span>
                            <span className="text-[10px] text-amber-700 block">₹{m.customerValue.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span className="font-semibold">Locations:</span>
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            {Array.from(m.locations).map(loc => (
                              <span key={loc} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-700">
                                📍 {loc}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Complete Unified Supply Register Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Unified Material Supply Register (સર્વ મટિરિયલ સપ્લાય રજિસ્ટર)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      તમામ સાઇટ / ટીમ સપ્લાય અને કસ્ટમર સપ્લાયની તારીખ, લોકેશન, કેટેગરી અને મટિરિયલ વાઇઝ વિગતવાર નોંધ.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    Showing {filteredAllSupplies.length} of {allSupplies.length} records
                  </span>
                </div>

                {/* Mobile view */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {isLoading ? (
                    <div className="p-8 text-center text-slate-400">Loading supplies...</div>
                  ) : filteredAllSupplies.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium">
                      કોઈ સપ્લાય રેકોર્ડ મળ્યો નથી. Click <b>+ Site Supply (Team)</b> or <b>+ Customer Supply</b>.
                    </div>
                  ) : (
                    filteredAllSupplies.map(item => (
                      <div key={item.uniqueKey} className="p-4 space-y-3 bg-white hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded text-[11px] font-bold flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-indigo-600" />
                            {item.locationName}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.sourceType === 'TEAM' 
                              ? 'bg-teal-50 text-teal-800 border-teal-200' 
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {item.sourceType === 'TEAM' ? '👷 Site Supply (Team)' : '🏢 Customer Supply'}
                          </span>
                          <span className="text-slate-500 text-xs font-medium">{item.date}</span>
                        </div>

                        <div>
                          <div className="text-xs text-slate-500 font-semibold">{item.partyName}</div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm font-black text-slate-900">{item.materialName}</span>
                            <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Rate</div>
                            <div className="font-semibold text-slate-700">₹{Number(item.rate || 0).toLocaleString()}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Total Value</div>
                            <div className="font-black text-indigo-950">₹{Number(item.totalAmount || 0).toLocaleString()}</div>
                          </div>
                        </div>

                        {(item.workDescription || item.notes) && (
                          <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {item.workDescription || item.notes}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item.raw);
                              if (item.sourceType === 'TEAM') {
                                setTeamSupplyForm({
                                  locationId: item.locationId.toString(),
                                  date: item.date,
                                  teamName: item.partyName,
                                  partyName: item.partyName,
                                  workDescription: item.workDescription || "",
                                  materialName: item.materialName,
                                  materialQuantity: item.quantity,
                                  materialUnit: item.unit || "Nos",
                                  materialRate: item.rate || "",
                                  paidAmount: item.paidAmount || "0",
                                  paymentStatus: item.paymentStatus || "PAID",
                                  notes: item.notes || ""
                                });
                                setIsTeamSupplyModalOpen(true);
                              } else {
                                setCustomerSupplyForm({
                                  locationId: item.locationId.toString(),
                                  date: item.date,
                                  partyName: item.partyName,
                                  materialName: item.materialName,
                                  quantity: item.quantity,
                                  unit: item.unit || "Nos",
                                  rate: item.rate || "",
                                  paidAmount: item.paidAmount || "",
                                  paymentStatus: item.paymentStatus || "PAID",
                                  paymentMethod: item.raw?.paymentMethod || "Bank Transfer",
                                  referenceNumber: item.raw?.referenceNumber || "",
                                  notes: item.notes || ""
                                });
                                setIsCustomerSupplyModalOpen(true);
                              }
                            }}
                            className="flex-1 min-h-[42px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.sourceType === 'TEAM' ? "labour-supply" : "supply", item.id)}
                            className="flex-1 min-h-[42px] px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-rose-200 transition-colors cursor-pointer active:scale-95"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" /> Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop view */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5 whitespace-nowrap">Date</th>
                        <th className="p-3.5 whitespace-nowrap">Location (ક્યાં લોકેશન)</th>
                        <th className="p-3.5 whitespace-nowrap">Category (કઈ કેટેગરી)</th>
                        <th className="p-3.5 whitespace-nowrap">Material (કયું મટિરિયલ)</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Quantity (કેટલું સપ્લાય)</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Rate (ભાવ)</th>
                        <th className="p-3.5 text-right whitespace-nowrap font-bold text-slate-900">Total Value (કુલ રકમ)</th>
                        <th className="p-3.5 whitespace-nowrap">Issued To / Party (કોને સપ્લાય)</th>
                        <th className="p-3.5 whitespace-nowrap">Details / Notes</th>
                        <th className="p-3.5 text-center whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-400">Loading supplies...</td>
                        </tr>
                      ) : filteredAllSupplies.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-400">
                            કોઈ સપ્લાય રેકોર્ડ મળ્યો નથી. Click <b>+ Site Supply (Team)</b> or <b>+ Customer Supply</b> above.
                          </td>
                        </tr>
                      ) : (
                        filteredAllSupplies.map(item => (
                          <tr key={item.uniqueKey} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">{item.date}</td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                                <Building2 className="w-2.5 h-2.5 text-indigo-600" />
                                {item.locationName}
                              </span>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1.5 ${
                                item.sourceType === 'TEAM' 
                                  ? 'bg-teal-50 text-teal-800 border-teal-200' 
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {item.sourceType === 'TEAM' ? (
                                  <>
                                    <HardHat className="w-3 h-3 text-teal-600" />
                                    <span>Site Supply (Team Wise)</span>
                                  </>
                                ) : (
                                  <>
                                    <Truck className="w-3 h-3 text-amber-600" />
                                    <span>Customer Material Supply</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="p-3.5 font-black text-slate-900 whitespace-nowrap">
                              {item.materialName}
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-900 font-extrabold rounded text-[11px]">
                                {item.quantity} {item.unit}
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                              ₹{Number(item.rate || 0).toLocaleString()}
                            </td>
                            <td className="p-3.5 text-right font-black text-indigo-950 bg-indigo-50/30 whitespace-nowrap">
                              ₹{Number(item.totalAmount || 0).toLocaleString()}
                            </td>
                            <td className="p-3.5 font-bold text-slate-800 whitespace-nowrap">
                              {item.partyName}
                            </td>
                            <td className="p-3.5 text-slate-600 max-w-xs truncate" title={item.workDescription || item.notes || ""}>
                              {item.workDescription || item.notes || "-"}
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItem(item.raw);
                                    if (item.sourceType === 'TEAM') {
                                      setTeamSupplyForm({
                                        locationId: item.locationId.toString(),
                                        date: item.date,
                                        teamName: item.partyName,
                                        partyName: item.partyName,
                                        workDescription: item.workDescription || "",
                                        materialName: item.materialName,
                                        materialQuantity: item.quantity,
                                        materialUnit: item.unit || "Nos",
                                        materialRate: item.rate || "",
                                        paidAmount: item.paidAmount || "0",
                                        paymentStatus: item.paymentStatus || "PAID",
                                        notes: item.notes || ""
                                      });
                                      setIsTeamSupplyModalOpen(true);
                                    } else {
                                      setCustomerSupplyForm({
                                        locationId: item.locationId.toString(),
                                        date: item.date,
                                        partyName: item.partyName,
                                        materialName: item.materialName,
                                        quantity: item.quantity,
                                        unit: item.unit || "Nos",
                                        rate: item.rate || "",
                                        paidAmount: item.paidAmount || "",
                                        paymentStatus: item.paymentStatus || "PAID",
                                        paymentMethod: item.raw?.paymentMethod || "Bank Transfer",
                                        referenceNumber: item.raw?.referenceNumber || "",
                                        notes: item.notes || ""
                                      });
                                      setIsCustomerSupplyModalOpen(true);
                                    }
                                  }}
                                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                  title="Edit"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.sourceType === 'TEAM' ? "labour-supply" : "supply", item.id)}
                                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB A: TEAM MATERIAL SUPPLY */}
          {supplySubTab === "teams" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider block">Total Team Supply Value</span>
                  <div className="text-2xl font-black text-indigo-900 mt-1">₹{teamSupplyMetrics.totalValue.toLocaleString()}</div>
                  <span className="text-[11px] text-indigo-600">ટીમોને ફાળવેલ મટિરિયલ મૂલ્ય</span>
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">Total Dispatches</span>
                  <div className="text-2xl font-black text-white mt-1">{teamSupplyMetrics.count} Entries</div>
                  <span className="text-[11px] text-indigo-300">સાઇટ વિતરણ પત્રક</span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Active Site Locations</span>
                  <div className="text-2xl font-black text-emerald-900 mt-1">{selectedLocationId === "ALL" ? locations.length : 1} Sites</div>
                  <span className="text-[11px] text-emerald-600">મટિરિયલ વપરાશ હેઠળ</span>
                </div>
              </div>

              {/* Team Supply Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                {/* Mobile Cards for Team Supplies */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {isLoading ? (
                    <div className="p-8 text-center text-slate-400">Loading Team Supplies...</div>
                  ) : filteredTeamSupplies.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium">
                      કોઈ ટીમ સપ્લાય રેકોર્ડ મળ્યો નથી. Click <b>+ Supply Material to Team</b> above.
                    </div>
                  ) : (
                    filteredTeamSupplies.map(ts => (
                      <div key={`ts-card-${ts.id}`} className="p-4 space-y-3 bg-white hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded text-[11px] font-bold flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-indigo-600" />
                            {ts.locationName || "Site"}
                          </span>
                          <span className="text-slate-500 text-xs font-medium">{ts.date}</span>
                        </div>

                        <div>
                          <div className="text-sm font-extrabold text-slate-900">{ts.teamName || ts.partyName}</div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-bold text-indigo-700">{ts.materialName}</span>
                            <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                              {ts.materialQuantity} {ts.materialUnit || "Units"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Rate</div>
                            <div className="font-semibold text-slate-700">₹{Number(ts.materialRate || 0).toLocaleString()}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Supply Value</div>
                            <div className="font-black text-indigo-900">₹{Number(ts.materialAmount || ts.totalAmount || 0).toLocaleString()}</div>
                          </div>
                        </div>

                        {(ts.workDescription || ts.notes) && (
                          <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {ts.workDescription || ts.notes}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(ts);
                              setTeamSupplyForm({
                                locationId: ts.locationId.toString(),
                                date: ts.date,
                                teamName: ts.teamName || ts.partyName,
                                partyName: ts.partyName || ts.teamName,
                                workDescription: ts.workDescription || "",
                                materialName: ts.materialName,
                                materialQuantity: ts.materialQuantity,
                                materialUnit: ts.materialUnit || "Bags",
                                materialRate: ts.materialRate || "",
                                paidAmount: ts.paidAmount || "0",
                                paymentStatus: ts.paymentStatus || "PAID",
                                notes: ts.notes || ""
                              });
                              setIsTeamSupplyModalOpen(true);
                            }}
                            className="flex-1 min-h-[42px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete("labour-supply", ts.id)}
                            className="flex-1 min-h-[42px] px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-rose-200 transition-colors cursor-pointer active:scale-95"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" /> Delete (ડિલીટ)
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table for Team Supplies */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5">Project Site</th>
                        <th className="p-3.5">Team Name / Contractor</th>
                        <th className="p-3.5">Material & Quantity</th>
                        <th className="p-3.5 text-right">Rate (₹)</th>
                        <th className="p-3.5 text-right font-bold text-indigo-800">Supply Value (₹)</th>
                        <th className="p-3.5">Work Purpose / Notes</th>
                        <th className="p-3.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">Loading Team Supplies...</td>
                        </tr>
                      ) : filteredTeamSupplies.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            કોઈ ટીમ સપ્લાય રેકોર્ડ મળ્યો નથી. Click <b>+ Supply Material to Team</b> above.
                          </td>
                        </tr>
                      ) : (
                        filteredTeamSupplies.map(ts => (
                          <tr key={ts.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">{ts.date}</td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                                <Building2 className="w-2.5 h-2.5 text-indigo-600" />
                                {ts.locationName || "Site"}
                              </span>
                            </td>
                            <td className="p-3.5 font-bold text-slate-900">{ts.teamName || ts.partyName}</td>
                            <td className="p-3.5">
                              <span className="font-extrabold text-slate-900">{ts.materialName}</span>
                              <span className="text-slate-500 font-semibold text-[11px] block">{ts.materialQuantity} {ts.materialUnit || "Units"}</span>
                            </td>
                            <td className="p-3.5 text-right font-semibold text-slate-700">₹{Number(ts.materialRate || 0).toLocaleString()}</td>
                            <td className="p-3.5 text-right font-black text-indigo-900 bg-indigo-50/50">
                              ₹{Number(ts.materialAmount || ts.totalAmount || 0).toLocaleString()}
                            </td>
                            <td className="p-3.5 text-slate-600">{ts.workDescription || ts.notes || "-"}</td>
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItem(ts);
                                    setTeamSupplyForm({
                                      locationId: ts.locationId.toString(),
                                      date: ts.date,
                                      teamName: ts.teamName || ts.partyName,
                                      partyName: ts.partyName || ts.teamName,
                                      workDescription: ts.workDescription || "",
                                      materialName: ts.materialName,
                                      materialQuantity: ts.materialQuantity,
                                      materialUnit: ts.materialUnit || "Bags",
                                      materialRate: ts.materialRate || "",
                                      paidAmount: ts.paidAmount || "0",
                                      paymentStatus: ts.paymentStatus || "PAID",
                                      notes: ts.notes || ""
                                    });
                                    setIsTeamSupplyModalOpen(true);
                                  }}
                                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                  title="Edit"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete("labour-supply", ts.id)}
                                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB B: CUSTOMER MATERIAL SUPPLY */}
          {supplySubTab === "customers" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">Total Customer Sales Value</span>
                  <div className="text-2xl font-black text-amber-900 mt-1">₹{customerSupplyMetrics.totalValue.toLocaleString()}</div>
                  <span className="text-[11px] text-amber-600">કસ્ટમર્સને આપેલ મટિરિયલ રકમ</span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Customer Received Payments</span>
                  <div className="text-2xl font-black text-emerald-900 mt-1">₹{customerSupplyMetrics.totalPaid.toLocaleString()}</div>
                  <span className="text-[11px] text-emerald-600">કસ્ટમર પાસેથી મળેલ રકમ</span>
                </div>

                <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">Customer Balance Receivable</span>
                  <div className="text-2xl font-black text-rose-900 mt-1">₹{customerSupplyMetrics.outstanding.toLocaleString()}</div>
                  <span className="text-[11px] text-rose-600">કસ્ટમર પાસેથી લેવાની બાકી રકમ</span>
                </div>
              </div>

              {/* Customer Supply Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                {/* Mobile Cards for Customer Supplies */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {isLoading ? (
                    <div className="p-8 text-center text-slate-400">Loading Customer Supplies...</div>
                  ) : filteredCustomerSupplies.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium">
                      કોઈ કસ્ટમર સપ્લાય રેકોર્ડ મળ્યો નથી. Click <b>+ Supply Material to Customer</b>.
                    </div>
                  ) : (
                    filteredCustomerSupplies.map(cs => (
                      <div key={`cs-card-${cs.id}`} className="p-4 space-y-3 bg-white hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-900 rounded text-[11px] font-bold flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-amber-600" />
                            {cs.locationName || "Site"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-xs font-medium">{cs.date}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              cs.paymentStatus === "PAID"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                            }`}>
                              {cs.paymentStatus}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-extrabold text-slate-900">{cs.partyName}</div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-bold text-amber-800">{cs.materialName}</span>
                            <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                              {cs.quantity} {cs.unit}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Rate</div>
                            <div className="font-semibold text-slate-700">₹{Number(cs.rate || 0).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-amber-700">Total Bill</div>
                            <div className="font-black text-amber-900">₹{Number(cs.totalAmount || 0).toLocaleString()}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-emerald-700">Paid</div>
                            <div className="font-bold text-emerald-800">₹{Number(cs.paidAmount || 0).toLocaleString()}</div>
                          </div>
                        </div>

                        {cs.notes && (
                          <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {cs.notes}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(cs);
                              setCustomerSupplyForm({
                                locationId: cs.locationId.toString(),
                                date: cs.date,
                                partyName: cs.partyName,
                                materialName: cs.materialName,
                                quantity: cs.quantity,
                                unit: cs.unit || "Bags",
                                rate: cs.rate,
                                paidAmount: cs.paidAmount,
                                paymentStatus: cs.paymentStatus,
                                paymentMethod: cs.paymentMethod || "Bank Transfer",
                                referenceNumber: cs.referenceNumber || "",
                                notes: cs.notes || ""
                              });
                              setIsCustomerSupplyModalOpen(true);
                            }}
                            className="flex-1 min-h-[42px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete("supply", cs.id)}
                            className="flex-1 min-h-[42px] px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-rose-200 transition-colors cursor-pointer active:scale-95"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" /> Delete (ડિલીટ)
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table for Customer Supplies */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5">Project Site</th>
                        <th className="p-3.5">Customer / Party Name</th>
                        <th className="p-3.5">Material & Quantity</th>
                        <th className="p-3.5 text-right">Rate (₹)</th>
                        <th className="p-3.5 text-right font-bold text-amber-900">Total Bill (₹)</th>
                        <th className="p-3.5 text-right text-emerald-700">Paid (₹)</th>
                        <th className="p-3.5 text-center">Status</th>
                        <th className="p-3.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">Loading Customer Supplies...</td>
                        </tr>
                      ) : filteredCustomerSupplies.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">
                            કોઈ કસ્ટમર સપ્લાય રેકોર્ડ મળ્યો નથી. Click <b>+ Supply Material to Customer</b>.
                          </td>
                        </tr>
                      ) : (
                        filteredCustomerSupplies.map(cs => (
                          <tr key={cs.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">{cs.date}</td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-900 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                                <Building2 className="w-2.5 h-2.5 text-amber-600" />
                                {cs.locationName || "Site"}
                              </span>
                            </td>
                            <td className="p-3.5 font-bold text-slate-900">{cs.partyName}</td>
                            <td className="p-3.5">
                              <span className="font-extrabold text-slate-900">{cs.materialName}</span>
                              <span className="text-slate-500 font-semibold text-[11px] block">{cs.quantity} {cs.unit}</span>
                            </td>
                            <td className="p-3.5 text-right font-semibold text-slate-700">₹{Number(cs.rate || 0).toLocaleString()}</td>
                            <td className="p-3.5 text-right font-black text-amber-900 bg-amber-50/50">₹{Number(cs.totalAmount || 0).toLocaleString()}</td>
                            <td className="p-3.5 text-right font-bold text-emerald-700">₹{Number(cs.paidAmount || 0).toLocaleString()}</td>
                            <td className="p-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                cs.paymentStatus === "PAID"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-amber-100 text-amber-800 border-amber-200"
                              }`}>
                                {cs.paymentStatus}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItem(cs);
                                    setCustomerSupplyForm({
                                      locationId: cs.locationId.toString(),
                                      date: cs.date,
                                      partyName: cs.partyName,
                                      materialName: cs.materialName,
                                      quantity: cs.quantity,
                                      unit: cs.unit || "Bags",
                                      rate: cs.rate,
                                      paidAmount: cs.paidAmount,
                                      paymentStatus: cs.paymentStatus,
                                      paymentMethod: cs.paymentMethod || "Bank Transfer",
                                      referenceNumber: cs.referenceNumber || "",
                                      notes: cs.notes || ""
                                    });
                                    setIsCustomerSupplyModalOpen(true);
                                  }}
                                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                  title="Edit"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete("supply", cs.id)}
                                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STOCK & ANALYTICS */}
      {activeTab === "stock" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
          <MaterialAnalyticsSection selectedLocation={selectedLocationId === "ALL" ? "ALL" : selectedLocationId.toString()} />
        </div>
      )}

      {/* MODAL 1: MATERIAL PURCHASE MODAL */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingItem ? "Edit Material Purchase Record" : "+ Add Material Purchase (ઇન્વેસ્ટર મૂડીમાંથી ખરીદી)"}
                </h3>
                <p className="text-xs text-indigo-600 font-medium">આ ખરીદીનું ચુકવણું ઇન્વેસ્ટર મૂડીમાંથી કપાશે.</p>
              </div>
              <button onClick={() => setIsPurchaseModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="space-y-4 text-xs font-semibold">
              {/* Central Inventory Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center gap-2.5 text-blue-900 shadow-2xs">
                <Package className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <span className="font-bold block text-blue-950">સેન્ટ્રલ ઇન્વેન્ટરી (Central Inventory for all sites)</span>
                  <span className="text-[11px] text-blue-700 font-medium">આ ખરીદી આપોઆપ સેન્ટ્રલ સ્ટોકમાં નોંધાશે અને બધી સાઇટ માટે ઉપલબ્ધ રહેશે.</span>
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-bold">Purchase Date *</label>
                <input
                  type="date"
                  value={purchaseForm.date}
                  onChange={e => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-bold">Supplier / Dealer Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ultratech Cement Dealer, Steel Trader"
                  value={purchaseForm.partyName}
                  onChange={e => setPurchaseForm({ ...purchaseForm, partyName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-slate-700 block mb-1 font-bold">Material Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. CEMENT, TMT STEEL 12MM, SAND"
                    value={purchaseForm.materialName}
                    onChange={e => setPurchaseForm({ ...purchaseForm, materialName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. Bags, Tons, Brass"
                    value={purchaseForm.unit}
                    onChange={e => setPurchaseForm({ ...purchaseForm, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={purchaseForm.quantity}
                    onChange={e => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Rate (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={purchaseForm.rate}
                    onChange={e => setPurchaseForm({ ...purchaseForm, rate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Transport (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={purchaseForm.transportCost}
                    onChange={e => setPurchaseForm({ ...purchaseForm, transportCost: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between">
                <span className="text-emerald-900 font-bold">Total Bill Amount:</span>
                <span className="text-lg font-black text-emerald-900">
                  ₹{((parseFloat(purchaseForm.quantity || "0") * parseFloat(purchaseForm.rate || "0")) + parseFloat(purchaseForm.transportCost || "0")).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Paid from Investor Capital (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Leave blank for full bill"
                    value={purchaseForm.paidAmount}
                    onChange={e => setPurchaseForm({ ...purchaseForm, paidAmount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Payment Status</label>
                  <select
                    value={purchaseForm.paymentStatus}
                    onChange={e => setPurchaseForm({ ...purchaseForm, paymentStatus: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PAID">PAID (સંપૂર્ણ ચૂકવાયેલ)</option>
                    <option value="PARTIAL">PARTIAL (અંશતઃ ચૂકવાયેલ)</option>
                    <option value="UNPAID">UNPAID (બાકી)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-bold">Bill / Invoice Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-901"
                  value={purchaseForm.referenceNumber}
                  onChange={e => setPurchaseForm({ ...purchaseForm, referenceNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 shadow"
                >
                  {editingItem ? "Update Record" : "Save Material Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TEAM MATERIAL SUPPLY MODAL */}
      {isTeamSupplyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingItem ? "Edit Team Supply Record" : "+ Record Material Supply to Labour Team"}
                </h3>
                <p className="text-xs text-indigo-600 font-medium">ટીમ વાઇઝ સાઇટ પર મોકલેલ મટિરિયલ પત્રક.</p>
              </div>
              <button onClick={() => setIsTeamSupplyModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTeamSupplySubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Project Location *</label>
                  <select
                    value={teamSupplyForm.locationId}
                    onChange={e => setTeamSupplyForm({ ...teamSupplyForm, locationId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">-- Choose Location --</option>
                    {teamSupplyForm.locationId && !locations.some(loc => loc.id.toString() === teamSupplyForm.locationId.toString()) && (
                      <option value={teamSupplyForm.locationId}>
                        {editingItem?.locationName || `Location #${teamSupplyForm.locationId}`} (Archived/Deleted)
                      </option>
                    )}
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Supply Date *</label>
                  <input
                    type="date"
                    value={teamSupplyForm.date}
                    onChange={e => setTeamSupplyForm({ ...teamSupplyForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-bold">Labour Team / Contractor Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Mason Team A, Shuttering Team, Tile Fitting Team"
                  value={teamSupplyForm.teamName}
                  onChange={e => setTeamSupplyForm({ ...teamSupplyForm, teamName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-700 block mb-1 font-bold">Material Supplied *</label>
                  <input
                    type="text"
                    placeholder="e.g. CEMENT, SAND, STEEL"
                    value={teamSupplyForm.materialName}
                    onChange={e => setTeamSupplyForm({ ...teamSupplyForm, materialName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Unit</label>
                  <input
                    type="text"
                    placeholder="Bags"
                    value={teamSupplyForm.materialUnit}
                    onChange={e => setTeamSupplyForm({ ...teamSupplyForm, materialUnit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Supplied Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={teamSupplyForm.materialQuantity}
                    onChange={e => setTeamSupplyForm({ ...teamSupplyForm, materialQuantity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Rate per Unit (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={teamSupplyForm.materialRate}
                    onChange={e => setTeamSupplyForm({ ...teamSupplyForm, materialRate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-bold">Work Purpose / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. 1st Floor Slab Work, Exterior Plastering"
                  value={teamSupplyForm.workDescription}
                  onChange={e => setTeamSupplyForm({ ...teamSupplyForm, workDescription: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTeamSupplyModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 shadow"
                >
                  {editingItem ? "Update Supply Record" : "Save Team Supply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CUSTOMER MATERIAL SUPPLY MODAL */}
      {isCustomerSupplyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingItem ? "Edit Customer Supply Record" : "+ Supply Material to Customer"}
                </h3>
                <p className="text-xs text-amber-600 font-medium">કસ્ટમરને મટિરિયલ આપ્યાનો સપ્લાય રેકોર્ડ.</p>
              </div>
              <button onClick={() => setIsCustomerSupplyModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCustomerSupplySubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Project Location *</label>
                  <select
                    value={customerSupplyForm.locationId}
                    onChange={e => setCustomerSupplyForm({ ...customerSupplyForm, locationId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">-- Choose Location --</option>
                    {customerSupplyForm.locationId && !locations.some(loc => loc.id.toString() === customerSupplyForm.locationId.toString()) && (
                      <option value={customerSupplyForm.locationId}>
                        {editingItem?.locationName || `Location #${customerSupplyForm.locationId}`} (Archived/Deleted)
                      </option>
                    )}
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Date *</label>
                  <input
                    type="date"
                    value={customerSupplyForm.date}
                    onChange={e => setCustomerSupplyForm({ ...customerSupplyForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-bold">Customer / Client Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Patel, Flat 401 Owner"
                  value={customerSupplyForm.partyName}
                  onChange={e => setCustomerSupplyForm({ ...customerSupplyForm, partyName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-700 block mb-1 font-bold">Material Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. TILES 2X2, GRANITE"
                    value={customerSupplyForm.materialName}
                    onChange={e => setCustomerSupplyForm({ ...customerSupplyForm, materialName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Unit</label>
                  <input
                    type="text"
                    placeholder="Sq.Ft"
                    value={customerSupplyForm.unit}
                    onChange={e => setCustomerSupplyForm({ ...customerSupplyForm, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={customerSupplyForm.quantity}
                    onChange={e => setCustomerSupplyForm({ ...customerSupplyForm, quantity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Rate (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={customerSupplyForm.rate}
                    onChange={e => setCustomerSupplyForm({ ...customerSupplyForm, rate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Paid Amount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={customerSupplyForm.paidAmount}
                    onChange={e => setCustomerSupplyForm({ ...customerSupplyForm, paidAmount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Payment Status</label>
                  <select
                    value={customerSupplyForm.paymentStatus}
                    onChange={e => setCustomerSupplyForm({ ...customerSupplyForm, paymentStatus: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="UNPAID">UNPAID</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustomerSupplyModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-500 shadow"
                >
                  {editingItem ? "Update Customer Supply" : "Save Customer Supply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
