import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { 
  Package, Truck, Wrench, Search, Download, 
  RefreshCw, HardHat, Plus, Trash2, Calendar, FileText, CheckCircle2, AlertCircle, Pencil
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { ManageMaterialsModal } from "../ui/ManageMaterialsModal";
import { ManageTeamsModal } from "../ui/ManageTeamsModal";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { downloadExcelReport } from "../../lib/excelExport";
import { useToast } from "../../contexts/ToastContext";

interface LocationMaterialHubProps {
  locationId: number;
}

const PRESET_UNITS = ["Nos", "Bags", "Ton", "Kg", "Brass", "CFT", "Cum", "Sq.ft", "Sq.m", "Trip", "Load", "Ltr", "Mtr"];

export default function LocationMaterialHubTab({ locationId }: LocationMaterialHubProps) {
  const { showToast, confirmAction } = useToast();
  const [loading, setLoading] = useState(true);
  const [customerSupplies, setCustomerSupplies] = useState<any[]>([]);
  const [siteSupplies, setSiteSupplies] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  // Filter states
  const [activeView, setActiveView] = useState<"ALL" | "TEAM_SITE" | "CUSTOMER" | "CATEGORY_SUMMARY">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("ALL");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("ALL");

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [isManageMaterialOpen, setIsManageMaterialOpen] = useState(false);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [targetItemIndex, setTargetItemIndex] = useState<number | null>(null);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Customer Supply Form Data
  const [customerFormData, setCustomerFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    partyId: "",
    partyName: "",
    materialId: "",
    materialName: "",
    quantity: "",
    unit: "Nos",
    rate: "",
    taxPercentage: "18",
    paymentStatus: "PAID",
    referenceNumber: "",
    notes: ""
  });

  // EXACT Site Supply Form Data (Same-to-same as original SiteSupplyTab)
  const [siteFormData, setSiteFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    siteLocationId: locationId.toString(),
    teamId: "",
    notes: "",
    items: [{ materialId: "", quantity: "", unit: "Nos", rate: "0", taxPercentage: "18" }]
  });

  const loadData = async (isBackground = false) => {
    if (!isBackground && customerSupplies.length === 0 && siteSupplies.length === 0) {
      setLoading(true);
    }
    try {
      const [custRes, siteRes, matRes, teamRes, partyRes, locsRes] = await Promise.all([
        apiFetch(`/materials/supply?locationId=${locationId}`).catch(() => []),
        apiFetch(`/site-supplies?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/materials?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/teams?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/parties?locationId=${locationId}`).catch(() => []),
        apiFetch(`/locations`).catch(() => [])
      ]);
      setCustomerSupplies(Array.isArray(custRes) ? custRes : []);
      setSiteSupplies(Array.isArray(siteRes) ? siteRes : []);
      setMaterials(Array.isArray(matRes) ? matRes : []);
      setTeams(Array.isArray(teamRes) ? teamRes : []);
      setParties(Array.isArray(partyRes) ? partyRes : []);
      setLocations(Array.isArray(locsRes) ? locsRes : []);
    } catch (err) {
      console.error("[LocationMaterialHubTab Error]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [locationId]);

  useLiveSync(() => {
    loadData(true);
  }, 3500);

  // Live calculation of current Site Supply modal form (Same to same as original)
  const siteModalCalculations = useMemo(() => {
    let totalTaxable = 0;
    let totalTax = 0;
    let totalQty = 0;

    const computedItems = siteFormData.items.map(item => {
      const qty = Math.max(0, parseFloat(item.quantity) || 0);
      const rate = Math.max(0, parseFloat(item.rate) || 0);
      const taxRate = Math.max(0, parseFloat(item.taxPercentage) || 0);
      const subtotal = Math.round(qty * rate * 100) / 100;
      const itemTax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const itemTotal = Math.round((subtotal + itemTax) * 100) / 100;

      totalQty += qty;
      totalTaxable += subtotal;
      totalTax += itemTax;

      return {
        ...item,
        qty,
        rate,
        subtotal,
        taxRate,
        itemTax,
        itemTotal
      };
    });

    const grandTotal = Math.round((totalTaxable + totalTax) * 100) / 100;

    return {
      computedItems,
      totalQty,
      totalTaxable: Math.round(totalTaxable * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grandTotal
    };
  }, [siteFormData.items]);

  const addSiteItem = () => {
    setSiteFormData({
      ...siteFormData,
      items: [...siteFormData.items, { materialId: "", quantity: "", unit: "Nos", rate: "0", taxPercentage: "18" }]
    });
  };

  const updateSiteItem = (index: number, field: string, value: string) => {
    const newItems = [...siteFormData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-update unit & default rate if material changes
    if (field === "materialId") {
      const mat = materials.find(m => m.id.toString() === value);
      if (mat && mat.defaultUnit) {
        newItems[index].unit = mat.defaultUnit;
      }
      if (mat && mat.defaultRate && (!newItems[index].rate || newItems[index].rate === "0")) {
        newItems[index].rate = String(mat.defaultRate);
      }
    }
    
    setSiteFormData({ ...siteFormData, items: newItems });
  };

  const removeSiteItem = (index: number) => {
    const newItems = [...siteFormData.items];
    newItems.splice(index, 1);
    setSiteFormData({ ...siteFormData, items: newItems });
  };

  // Flatten site supplies items into single row records with team & date
  const flattenedSiteSupplyItems = useMemo(() => {
    const list: any[] = [];
    siteSupplies.forEach(supply => {
      const teamObj = teams.find(t => t.id === supply.teamId);
      const teamLabel = teamObj?.name || supply.teamName || "Site Team";
      
      if (Array.isArray(supply.items) && supply.items.length > 0) {
        supply.items.forEach((item: any, idx: number) => {
          list.push({
            id: `site-${supply.id}-${item.id || idx}`,
            originalSupplyId: supply.id,
            parentRecord: supply,
            date: supply.date,
            type: "TEAM_SITE_SUPPLY",
            typeLabel: "Team-wise Site Supply",
            recipientName: teamLabel,
            teamId: supply.teamId,
            materialId: item.materialId,
            materialName: item.materialName || (materials.find(m => m.id === item.materialId)?.name) || "Material",
            category: (materials.find(m => m.id === item.materialId)?.category) || "General",
            quantity: parseFloat(String(item.quantity || 0)),
            unit: item.unit || "Nos",
            rate: parseFloat(String(item.rate || 0)),
            taxPercentage: parseFloat(String(item.taxPercentage || 0)),
            totalAmount: parseFloat(String(item.totalWithGst || item.amount || (item.quantity * item.rate) || 0)),
            notes: supply.displayNotes || supply.notes || "",
            status: "ISSUED"
          });
        });
      } else {
        list.push({
          id: `site-${supply.id}`,
          originalSupplyId: supply.id,
          parentRecord: supply,
          date: supply.date,
          type: "TEAM_SITE_SUPPLY",
          typeLabel: "Team-wise Site Supply",
          recipientName: teamLabel,
          teamId: supply.teamId,
          materialId: supply.materialId,
          materialName: supply.materialName || "Material",
          category: "General",
          quantity: parseFloat(String(supply.quantity || 0)),
          unit: supply.unit || "Nos",
          rate: parseFloat(String(supply.rate || 0)),
          taxPercentage: 0,
          totalAmount: parseFloat(String(supply.totalAmount || supply.amount || 0)),
          notes: supply.displayNotes || supply.notes || "",
          status: "ISSUED"
        });
      }
    });
    return list;
  }, [siteSupplies, teams, materials]);

  // Flatten customer supplies into standard structure
  const formattedCustomerSupplies = useMemo(() => {
    return customerSupplies.map(cs => {
      const matObj = materials.find(m => m.id === cs.materialId || m.name === cs.materialName);
      return {
        id: `cust-${cs.id}`,
        originalSupplyId: cs.id,
        parentRecord: cs,
        date: cs.date,
        type: "CUSTOMER_SUPPLY",
        typeLabel: "Customer Material Supply",
        recipientName: cs.partyName || cs.customerName || "Customer",
        customerPartyId: cs.partyId,
        materialId: cs.materialId,
        materialName: cs.materialName || matObj?.name || "Material",
        category: matObj?.category || "Sales / GST",
        quantity: parseFloat(String(cs.quantity || 0)),
        unit: cs.unit || "Nos",
        rate: parseFloat(String(cs.rate || 0)),
        taxPercentage: parseFloat(String(cs.taxPercentage || 0)),
        totalAmount: parseFloat(String(cs.totalAmount || cs.amount || 0)),
        notes: cs.notes || cs.description || "",
        status: cs.paymentStatus || "PAID"
      };
    });
  }, [customerSupplies, materials]);

  // Combined records for full ledger view
  const combinedRecords = useMemo(() => {
    return [...formattedCustomerSupplies, ...flattenedSiteSupplyItems].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [formattedCustomerSupplies, flattenedSiteSupplyItems]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalCustomerAmount = formattedCustomerSupplies.reduce((acc, r) => acc + r.totalAmount, 0);
    const totalCustomerQty = formattedCustomerSupplies.reduce((acc, r) => acc + r.quantity, 0);

    const totalSiteAmount = flattenedSiteSupplyItems.reduce((acc, r) => acc + r.totalAmount, 0);
    const totalSiteQty = flattenedSiteSupplyItems.reduce((acc, r) => acc + r.quantity, 0);

    const grandTotalAmount = totalCustomerAmount + totalSiteAmount;
    const grandTotalQty = totalCustomerQty + totalSiteQty;

    const uniqueMaterials = new Set(combinedRecords.map(r => r.materialName.toUpperCase())).size;

    return {
      totalCustomerAmount,
      totalCustomerQty,
      totalSiteAmount,
      totalSiteQty,
      grandTotalAmount,
      grandTotalQty,
      uniqueMaterials
    };
  }, [formattedCustomerSupplies, flattenedSiteSupplyItems, combinedRecords]);

  // Material & Category Matrix aggregation
  const materialCategoryMatrix = useMemo(() => {
    const map = new Map<string, {
      materialName: string;
      category: string;
      unit: string;
      customerQty: number;
      customerAmount: number;
      siteQty: number;
      siteAmount: number;
      totalQty: number;
      totalAmount: number;
    }>();

    combinedRecords.forEach(r => {
      const key = `${r.materialName.trim().toUpperCase()}|${r.category.trim()}|${r.unit}`;
      if (!map.has(key)) {
        map.set(key, {
          materialName: r.materialName.trim().toUpperCase(),
          category: r.category || "General",
          unit: r.unit || "Nos",
          customerQty: 0,
          customerAmount: 0,
          siteQty: 0,
          siteAmount: 0,
          totalQty: 0,
          totalAmount: 0,
        });
      }
      const entry = map.get(key)!;
      if (r.type === "CUSTOMER_SUPPLY") {
        entry.customerQty += r.quantity;
        entry.customerAmount += r.totalAmount;
      } else {
        entry.siteQty += r.quantity;
        entry.siteAmount += r.totalAmount;
      }
      entry.totalQty += r.quantity;
      entry.totalAmount += r.totalAmount;
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [combinedRecords]);

  // Team-wise Grouped Breakdown
  const teamBreakdown = useMemo(() => {
    const map = new Map<string, {
      teamName: string;
      totalAmount: number;
      itemsCount: number;
      materials: Map<string, { materialName: string; quantity: number; unit: string; amount: number }>;
    }>();

    flattenedSiteSupplyItems.forEach(item => {
      const team = item.recipientName || "General Site";
      if (!map.has(team)) {
        map.set(team, {
          teamName: team,
          totalAmount: 0,
          itemsCount: 0,
          materials: new Map()
        });
      }
      const t = map.get(team)!;
      t.totalAmount += item.totalAmount;
      t.itemsCount += 1;

      const matKey = `${item.materialName}|${item.unit}`;
      if (!t.materials.has(matKey)) {
        t.materials.set(matKey, {
          materialName: item.materialName,
          quantity: 0,
          unit: item.unit,
          amount: 0
        });
      }
      const m = t.materials.get(matKey)!;
      m.quantity += item.quantity;
      m.amount += item.totalAmount;
    });

    return Array.from(map.values()).map(t => ({
      teamName: t.teamName,
      totalAmount: t.totalAmount,
      itemsCount: t.itemsCount,
      materialList: Array.from(t.materials.values())
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [flattenedSiteSupplyItems]);

  // Handle Create / Edit Customer Supply
  const handleSaveCustomerSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(customerFormData.quantity);
    const rate = parseFloat(customerFormData.rate);
    const selectedMat = materials.find(m => m.id.toString() === customerFormData.materialId);
    const finalMaterialName = selectedMat ? selectedMat.name : customerFormData.materialName;

    if (!customerFormData.materialId && !finalMaterialName) {
      showToast("Please select a material (કૃપા કરીને મટીરીયલ પસંદ કરો)", "error");
      return;
    }
    if (!qty || isNaN(qty)) {
      showToast("Please enter a valid quantity", "error");
      return;
    }
    setSubmitting(true);
    try {
      const subtotal = qty * (rate || 0);
      const taxRate = parseFloat(customerFormData.taxPercentage) || 0;
      const tax = (subtotal * taxRate) / 100;
      const totalAmount = subtotal + tax;

      const url = editingCustomerId ? `/materials/supply/${editingCustomerId}` : "/materials/supply";
      const method = editingCustomerId ? "PUT" : "POST";

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          locationId,
          date: customerFormData.date,
          partyName: customerFormData.partyName || "Walk-in Customer",
          partyId: customerFormData.partyId ? parseInt(customerFormData.partyId) : null,
          materialId: customerFormData.materialId ? parseInt(customerFormData.materialId) : null,
          materialName: finalMaterialName,
          quantity: qty,
          unit: customerFormData.unit,
          rate: rate || 0,
          taxPercentage: taxRate,
          tax,
          totalAmount,
          paidAmount: customerFormData.paymentStatus === "PAID" ? totalAmount : 0,
          paymentStatus: customerFormData.paymentStatus,
          referenceNumber: customerFormData.referenceNumber,
          notes: customerFormData.notes
        })
      });

      triggerSync("materials");
      triggerSync("stock");
      triggerSync("reports");
      showToast(editingCustomerId ? "Customer Material Supply updated!" : "Customer Material Supply recorded successfully!", "success");
      setIsCustomerModalOpen(false);
      setEditingCustomerId(null);
      setCustomerFormData({
        date: new Date().toISOString().split("T")[0],
        partyId: "",
        partyName: "",
        materialId: "",
        materialName: "",
        quantity: "",
        unit: "Nos",
        rate: "",
        taxPercentage: "18",
        paymentStatus: "PAID",
        referenceNumber: "",
        notes: ""
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to record customer supply", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Customer Supply
  const handleEditCustomerSupply = (cs: any) => {
    setEditingCustomerId(cs.id);
    const matObj = materials.find(m => m.id === cs.materialId || m.name?.toLowerCase() === cs.materialName?.toLowerCase());
    setCustomerFormData({
      date: cs.date || new Date().toISOString().split("T")[0],
      partyId: cs.partyId?.toString() || "",
      partyName: cs.partyName || cs.customerName || "",
      materialId: matObj ? matObj.id.toString() : (cs.materialId?.toString() || ""),
      materialName: cs.materialName || matObj?.name || "",
      quantity: cs.quantity?.toString() || "",
      unit: cs.unit || matObj?.defaultUnit || "Nos",
      rate: cs.rate?.toString() || "",
      taxPercentage: cs.taxPercentage !== undefined && cs.taxPercentage !== null ? cs.taxPercentage.toString() : "18",
      paymentStatus: cs.paymentStatus || "PAID",
      referenceNumber: cs.referenceNumber || "",
      notes: cs.notes || cs.description || ""
    });
    setIsCustomerModalOpen(true);
  };

  // Handle Edit Site Supply (Opens exact same-to-same modal with all loaded items)
  const handleEditSiteSupply = (supplyRecord: any) => {
    setEditingSiteId(supplyRecord.id);
    
    const items = (supplyRecord.items && supplyRecord.items.length > 0) ? supplyRecord.items.map((i: any) => ({
      materialId: i.materialId?.toString() || "",
      quantity: i.quantity?.toString() || "",
      unit: i.unit || "Nos",
      rate: i.rate?.toString() || "0",
      taxPercentage: i.taxPercentage?.toString() || "18"
    })) : [{ materialId: "", quantity: "", unit: "Nos", rate: "0", taxPercentage: "18" }];
    
    setSiteFormData({
      date: supplyRecord.date || new Date().toISOString().split("T")[0],
      siteLocationId: supplyRecord.locationId?.toString() || locationId.toString(),
      teamId: supplyRecord.teamId?.toString() || "",
      notes: supplyRecord.displayNotes || supplyRecord.notes || "",
      items
    });
    setIsSiteModalOpen(true);
  };

  // Handle Submit Site Supply (Same-to-same as original SiteSupplyTab)
  const handleSaveSiteSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validItems = siteFormData.items.filter(i => i.materialId && i.quantity && parseFloat(i.quantity) > 0);
      if (validItems.length === 0) {
        showToast("Please add at least one material with a valid quantity", "error");
        return;
      }
      
      setSubmitting(true);
      const url = editingSiteId ? `/site-supplies/${editingSiteId}` : "/site-supplies";
      const method = editingSiteId ? "PUT" : "POST";
      
      await apiFetch(url, {
        method, 
        body: JSON.stringify({
          locationId: parseInt(siteFormData.siteLocationId) || locationId,
          date: siteFormData.date,
          teamId: siteFormData.teamId ? parseInt(siteFormData.teamId) : null,
          notes: siteFormData.notes,
          items: validItems.map(i => ({
            materialId: parseInt(i.materialId),
            quantity: parseFloat(i.quantity),
            unit: i.unit || 'Nos',
            rate: parseFloat(i.rate) || 0,
            taxPercentage: parseFloat(i.taxPercentage) || 0
          }))
        }),
      });
      triggerSync("site_supplies");
      triggerSync("stock");
      triggerSync("materials");
      triggerSync("reports");
      setIsSiteModalOpen(false);
      setEditingSiteId(null);
      setSiteFormData({
        date: new Date().toISOString().split("T")[0],
        siteLocationId: locationId.toString(),
        teamId: "",
        notes: "",
        items: [{ materialId: "", quantity: "", unit: "Nos", rate: "0", taxPercentage: "18" }]
      });
      showToast(editingSiteId ? "Site supply updated successfully" : "Site supply with GST recorded successfully", "success");
      await loadData();
    } catch (err: any) {
      console.error("Failed to save supply:", err);
      showToast(err.message || "Failed to save site supply", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Record
  const handleDeleteSupply = async (record: any) => {
    const isSite = record.type === "TEAM_SITE_SUPPLY";
    const confirmed = await confirmAction({
      title: "Delete Supply Record",
      message: `Are you sure you want to delete this ${isSite ? "Site Supply to " + record.recipientName : "Customer Supply for " + record.materialName}? Stock will be automatically restored.`,
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      if (isSite) {
        await apiFetch(`/site-supplies/${record.originalSupplyId}?locationId=${locationId}`, { method: "DELETE" });
        triggerSync("site_supplies");
        triggerSync("stock");
      } else {
        await apiFetch(`/materials/supply/${record.originalSupplyId}?locationId=${locationId}`, { method: "DELETE" });
        triggerSync("materials");
        triggerSync("stock");
      }
      showToast("Supply record deleted and stock restored", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete supply record", "error");
    }
  };

  // Filtered records for the main table
  const displayedRecords = useMemo(() => {
    let list = combinedRecords;

    if (activeView === "TEAM_SITE") {
      list = list.filter(r => r.type === "TEAM_SITE_SUPPLY");
    } else if (activeView === "CUSTOMER") {
      list = list.filter(r => r.type === "CUSTOMER_SUPPLY");
    }

    if (selectedTeam !== "ALL") {
      list = list.filter(r => r.recipientName === selectedTeam);
    }

    if (selectedMaterial !== "ALL") {
      list = list.filter(r => r.materialName.toUpperCase() === selectedMaterial.toUpperCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        r.materialName.toLowerCase().includes(q) ||
        r.recipientName.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    }

    return list;
  }, [combinedRecords, activeView, selectedTeam, selectedMaterial, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-indigo-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2">
            <Package className="w-3.5 h-3.5" />
            <span>Category 2 &bull; Location Material Supply Hub</span>
          </div>
          <h2 className="text-2xl font-black text-white">Location Material Supplies (મટીરીયલ સપ્લાય)</h2>
          <p className="text-xs text-slate-300 mt-1">
            <strong>Team-wise Material Supply = Site Supply</strong> &bull; <strong>Customer Material Supply = Material Supply</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action: Add Customer Material Supply */}
          <button
            type="button"
            onClick={() => {
              setEditingCustomerId(null);
              setCustomerFormData({
                date: new Date().toISOString().split("T")[0],
                partyId: "",
                partyName: "",
                materialId: "",
                materialName: "",
                quantity: "",
                unit: "Nos",
                rate: "",
                taxPercentage: "18",
                paymentStatus: "PAID",
                referenceNumber: "",
                notes: ""
              });
              setIsCustomerModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Truck className="w-4 h-4" /> + Customer Supply (ગ્રાહક સપ્લાય)
          </button>

          {/* Action: Issue Team Site Supply (Same-to-same with GST) */}
          <button
            type="button"
            onClick={() => {
              setEditingSiteId(null);
              setSiteFormData({
                date: new Date().toISOString().split("T")[0],
                siteLocationId: locationId.toString(),
                teamId: "",
                notes: "",
                items: [{ materialId: "", quantity: "", unit: "Nos", rate: "0", taxPercentage: "18" }]
              });
              setIsSiteModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Wrench className="w-4 h-4" /> + Add Site Supply with GST (સાઇટ સપ્લાય)
          </button>

          <button
            type="button"
            onClick={() => loadData(false)}
            disabled={loading}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/15 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => downloadExcelReport(`/reports/export-location/${locationId}?tab=materials`, `Location_${locationId}_Material_Supplies.xlsx`)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
            title="Export Excel Report"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* KPI Cards: Exact Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Supplies (Combined)</span>
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            ₹{summary.grandTotalAmount.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            {summary.grandTotalQty.toLocaleString("en-IN")} units across {summary.uniqueMaterials} materials
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-teal-200 shadow-xs">
          <div className="flex items-center justify-between text-teal-800">
            <span className="text-xs font-bold uppercase tracking-wider">Team-wise Site Supply</span>
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-teal-700 mt-2">
            ₹{summary.totalSiteAmount.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-teal-600 mt-1 font-medium">
            = Site Supply (Internal Labour Teams)
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-orange-200 shadow-xs">
          <div className="flex items-center justify-between text-orange-800">
            <span className="text-xs font-bold uppercase tracking-wider">Customer Material Supply</span>
            <div className="p-2 bg-orange-50 text-orange-700 rounded-xl">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-orange-700 mt-2">
            ₹{summary.totalCustomerAmount.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-orange-600 mt-1 font-medium">
            = Material Supply (GST Invoiced Sales)
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-800">
            <span className="text-xs font-bold uppercase tracking-wider">Contractor Cost Impact</span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <HardHat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700 mt-2">
            ₹{summary.totalSiteAmount.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-purple-600 mt-1 font-medium">
            Flows into Category 7 Reconciliation
          </p>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveView("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === "ALL"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All Material Supplies ({combinedRecords.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveView("CATEGORY_SUMMARY")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === "CATEGORY_SUMMARY"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          Material Category Matrix ({materialCategoryMatrix.length} Materials)
        </button>

        <button
          type="button"
          onClick={() => setActiveView("TEAM_SITE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === "TEAM_SITE"
              ? "bg-teal-600 text-white shadow-sm"
              : "bg-teal-50 text-teal-700 hover:bg-teal-100"
          }`}
        >
          Team-wise Site Supplies ({flattenedSiteSupplyItems.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveView("CUSTOMER")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === "CUSTOMER"
              ? "bg-orange-600 text-white shadow-sm"
              : "bg-orange-50 text-orange-700 hover:bg-orange-100"
          }`}
        >
          Customer Material Supplies ({formattedCustomerSupplies.length})
        </button>
      </div>

      {/* VIEW 1: Material Category Matrix */}
      {activeView === "CATEGORY_SUMMARY" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Material & Category Supply Breakdown</h3>
            <p className="text-xs text-slate-500">
              Kya location ma, kai category ma, kyu material ketlu supply thayu teni sampurna vigato:
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Material Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Customer Supply Qty</th>
                  <th className="py-3 px-4 text-right">Customer Supply (₹)</th>
                  <th className="py-3 px-4 text-right">Team Site Supply Qty</th>
                  <th className="py-3 px-4 text-right">Team Site Supply (₹)</th>
                  <th className="py-3 px-4 text-right">Total Qty</th>
                  <th className="py-3 px-4 text-right">Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materialCategoryMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      No material supplies recorded for this location yet.
                    </td>
                  </tr>
                ) : (
                  materialCategoryMatrix.map((item, idx) => (
                    <tr key={`mat-matrix-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.materialName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs font-medium">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-orange-700">
                        {item.customerQty > 0 ? `${item.customerQty} ${item.unit}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-orange-700">
                        {item.customerAmount > 0 ? `₹${item.customerAmount.toLocaleString("en-IN")}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-teal-700">
                        {item.siteQty > 0 ? `${item.siteQty} ${item.unit}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-teal-700">
                        {item.siteAmount > 0 ? `₹${item.siteAmount.toLocaleString("en-IN")}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {item.totalQty} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-indigo-700">
                        ₹{item.totalAmount.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {materialCategoryMatrix.length > 0 && (
                <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={2} className="py-3 px-4 text-slate-800">Grand Total</td>
                    <td className="py-3 px-4 text-right text-orange-800">
                      {summary.totalCustomerQty}
                    </td>
                    <td className="py-3 px-4 text-right text-orange-800">
                      ₹{summary.totalCustomerAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right text-teal-800">
                      {summary.totalSiteQty}
                    </td>
                    <td className="py-3 px-4 text-right text-teal-800">
                      ₹{summary.totalSiteAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {summary.grandTotalQty}
                    </td>
                    <td className="py-3 px-4 text-right text-indigo-800">
                      ₹{summary.grandTotalAmount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Team-wise breakdown visual cards */}
          <div className="pt-6 border-t border-slate-200">
            <h4 className="font-bold text-slate-900 text-sm mb-3">
              Team-wise Site Supply Breakdown (ટીમ વાઇઝ મટીરીયલ સપ્લાય)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamBreakdown.map((t, idx) => (
                <div key={`team-${idx}`} className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-900 text-sm">{t.teamName}</span>
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                      ₹{t.totalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    {t.materialList.map((m, mIdx) => (
                      <div key={`tm-${mIdx}`} className="flex justify-between">
                        <span>{m.materialName} ({m.quantity} {m.unit})</span>
                        <span className="font-semibold">₹{m.amount.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Standard Ledger Table for ALL, TEAM_SITE, or CUSTOMER */}
      {activeView !== "CATEGORY_SUMMARY" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search material, team, customer..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Materials</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>

              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Teams / Parties</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.name}>{t.name} (Team)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supply Classification</th>
                  <th className="py-3 px-4">Recipient (Team / Customer)</th>
                  <th className="py-3 px-4">Material Name</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Rate</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400 text-sm">
                      No matching material supply records found.
                    </td>
                  </tr>
                ) : (
                  displayedRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 text-slate-600 text-xs font-medium">{r.date}</td>
                      <td className="py-3 px-4">
                        {r.type === "TEAM_SITE_SUPPLY" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            <Wrench className="w-3 h-3" /> Site Supply (Team)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            <Truck className="w-3 h-3" /> Customer Supply
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{r.recipientName}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {r.materialName}
                        <span className="text-[10px] text-slate-400 block font-normal">{r.category}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {r.quantity} {r.unit}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700">
                        ₹{r.rate.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        ₹{r.totalAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === "PAID" || r.status === "ISSUED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {r.type === "TEAM_SITE_SUPPLY" && (
                            <button
                              type="button"
                              onClick={() => handleEditSiteSupply(r.parentRecord)}
                              className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer"
                              title="Edit this site supply"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {r.type === "CUSTOMER_SUPPLY" && (
                            <button
                              type="button"
                              onClick={() => handleEditCustomerSupply(r.parentRecord)}
                              className="p-1.5 text-slate-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors cursor-pointer"
                              title="Edit this customer supply"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSupply(r)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete this record"
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
      )}

      {/* MODAL 1: Add Customer Material Supply */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => {
          setIsCustomerModalOpen(false);
          setEditingCustomerId(null);
        }}
        title={editingCustomerId ? "Edit Customer Material Supply (ગ્રાહક સપ્લાય સુધારો)" : "Record Customer Material Supply (ગ્રાહક સપ્લાય)"}
      >
        <form onSubmit={handleSaveCustomerSupply} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={customerFormData.date}
                onChange={(e) => setCustomerFormData({ ...customerFormData, date: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Party Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Patel Builders"
                value={customerFormData.partyName}
                onChange={(e) => setCustomerFormData({ ...customerFormData, partyName: e.target.value })}
                list="partyList"
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
              <datalist id="partyList">
                {parties.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">Material (મટીરીયલ સિલેક્ટ કરો) *</label>
                <button
                  type="button"
                  onClick={() => {
                    setTargetItemIndex(-1);
                    setIsManageMaterialOpen(true);
                  }}
                  className="text-[11px] font-bold text-orange-600 hover:text-orange-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Manage Material
                </button>
              </div>
              <select
                required
                value={customerFormData.materialId}
                onChange={(e) => {
                  const matId = e.target.value;
                  const matched = materials.find(m => m.id.toString() === matId);
                  setCustomerFormData(prev => ({ 
                    ...prev, 
                    materialId: matId,
                    materialName: matched ? matched.name : "",
                    unit: matched?.defaultUnit || prev.unit || "Nos",
                    rate: matched?.defaultRate ? String(matched.defaultRate) : prev.rate
                  }));
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">-- Select Material (મટીરીયલ પસંદ કરો) --</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.category ? `(${m.category})` : ""} {m.defaultUnit ? `[${m.defaultUnit}]` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 50"
                value={customerFormData.quantity}
                onChange={(e) => setCustomerFormData({ ...customerFormData, quantity: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
              <select
                value={customerFormData.unit}
                onChange={(e) => setCustomerFormData({ ...customerFormData, unit: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {PRESET_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rate (₹ per Unit) *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 350"
                value={customerFormData.rate}
                onChange={(e) => setCustomerFormData({ ...customerFormData, rate: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">GST Tax %</label>
              <select
                value={customerFormData.taxPercentage}
                onChange={(e) => setCustomerFormData({ ...customerFormData, taxPercentage: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="0">0% (Nil)</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18% (Standard)</option>
                <option value="28">28%</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Status</label>
              <select
                value={customerFormData.paymentStatus}
                onChange={(e) => setCustomerFormData({ ...customerFormData, paymentStatus: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="PAID">PAID</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="UNPAID">UNPAID</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">GST Invoice / Ref No.</label>
              <input
                type="text"
                placeholder="e.g. INV-2026-081"
                value={customerFormData.referenceNumber}
                onChange={(e) => setCustomerFormData({ ...customerFormData, referenceNumber: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Description</label>
              <input
                type="text"
                placeholder="Optional notes..."
                value={customerFormData.notes}
                onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-600">Calculated Total with Tax:</span>
            <span className="font-black text-slate-900 text-sm">
              ₹{(
                (parseFloat(customerFormData.quantity) || 0) * 
                (parseFloat(customerFormData.rate) || 0) * 
                (1 + (parseFloat(customerFormData.taxPercentage) || 0) / 100)
              ).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Customer Supply"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EXACT SAME-TO-SAME Site Supply to Labour Team with GST & Multi-Item List */}
      <Modal
        isOpen={isSiteModalOpen}
        onClose={() => {
          setIsSiteModalOpen(false);
          setEditingSiteId(null);
        }}
        title={editingSiteId ? "Edit Site Supply (સાઇટ સપ્લાય સુધારો)" : "Add Site Supply with GST (નવી સાઇટ સપ્લાય & જીએસટી)"}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveSiteSupply} className="space-y-4 max-h-[82vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date (તારીખ) *</label>
              <input
                type="date"
                required
                value={siteFormData.date}
                onChange={e => setSiteFormData({ ...siteFormData, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Site Location (સાઇટ લોકેશન) *</label>
              <select
                required
                value={siteFormData.siteLocationId}
                onChange={e => setSiteFormData({ ...siteFormData, siteLocationId: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 font-medium"
              >
                <option value="">-- Select Site --</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">Labour Team (લેબર ટીમ / જવાબદાર)</label>
              <button
                type="button"
                onClick={() => setIsManageTeamOpen(true)}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Manage Team
              </button>
            </div>
            <select
              value={siteFormData.teamId}
              onChange={e => setSiteFormData({ ...siteFormData, teamId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 font-medium"
            >
              <option value="">-- Select Team (Optional) --</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          
          {/* MATERIAL LIST WITH GST (મટીરીયલ લિસ્ટ & જીએસટી) - EXACT ORIGINAL STRUCTURE */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
            <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  MATERIAL LIST WITH GST (મટીરીયલ લિસ્ટ & જીએસટી)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTargetItemIndex(null);
                  setIsManageMaterialOpen(true);
                }}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Manage Material
              </button>
            </div>
            
            <div className="p-3 space-y-3 bg-white">
              {siteFormData.items.map((item, index) => {
                const computed = siteModalCalculations.computedItems[index] || { subtotal: 0, itemTax: 0, itemTotal: 0 };

                return (
                  <div key={index} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[11px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        Material Item
                      </span>
                      {siteFormData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSiteItem(index)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Material (મટીરીયલ) *</label>
                        <select
                          required
                          value={item.materialId}
                          onChange={e => updateSiteItem(index, 'materialId', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800"
                        >
                          <option value="">- Select Material -</option>
                          {materials.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-4 sm:col-span-7 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Qty (જથ્થો) *</label>
                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            required
                            placeholder="0.00"
                            value={item.quantity}
                            onChange={e => updateSiteItem(index, 'quantity', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-teal-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Unit</label>
                          <input
                            type="text"
                            placeholder="Unit"
                            value={item.unit}
                            onChange={e => updateSiteItem(index, 'unit', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Rate (ભાવ ₹)</label>
                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={item.rate}
                            onChange={e => updateSiteItem(index, 'rate', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">GST %</label>
                          <select
                            value={item.taxPercentage}
                            onChange={e => updateSiteItem(index, 'taxPercentage', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-amber-700"
                          >
                            <option value="0">0% (Nil)</option>
                            <option value="5">5% GST</option>
                            <option value="12">12% GST</option>
                            <option value="18">18% GST</option>
                            <option value="28">28% GST</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Live Item Total Strip */}
                    <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex flex-wrap justify-between items-center text-[11px]">
                      <div className="flex gap-3 text-slate-600">
                        <span>Taxable Subtotal: <strong className="text-slate-800">₹{computed.subtotal.toFixed(2)}</strong></span>
                        <span>GST Tax: <strong className="text-amber-700">₹{computed.itemTax.toFixed(2)} ({item.taxPercentage}%)</strong></span>
                      </div>
                      <div className="font-bold text-teal-800">
                        Total with GST: <strong>₹{computed.itemTotal.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addSiteItem}
                className="w-full py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-teal-200/60"
              >
                <Plus className="w-3.5 h-3.5" /> Add another material
              </button>
            </div>

            {/* Live Form Summary Banner */}
            <div className="bg-teal-900 text-white p-3.5 border-t border-teal-800">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] uppercase font-bold text-teal-300">Base Subtotal</div>
                  <div className="text-sm font-bold mt-0.5">₹{siteModalCalculations.totalTaxable.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-amber-300">Total GST Tax</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5">₹{siteModalCalculations.totalTax.toLocaleString()}</div>
                </div>
                <div className="bg-teal-800/80 rounded-lg p-1">
                  <div className="text-[10px] uppercase font-black text-white">Grand Total with GST</div>
                  <div className="text-base font-black text-white mt-0.5">₹{siteModalCalculations.grandTotal.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks (વિગત / શરતો)</label>
            <input
              type="text"
              value={siteFormData.notes}
              onChange={e => setSiteFormData({ ...siteFormData, notes: e.target.value })}
              placeholder="Optional remarks or delivery details"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {editingSiteId ? "Update Site Supply" : "Save Site Supply with GST"}
          </button>
        </form>
      </Modal>

      {/* Quick Manage Material Modal */}
      <ManageMaterialsModal
        isOpen={isManageMaterialOpen}
        onClose={() => {
          setIsManageMaterialOpen(false);
          setTargetItemIndex(null);
        }}
        locationId={locationId}
        onSelectMaterial={(selectedMat) => {
          if (targetItemIndex === -1) {
            setCustomerFormData(prev => ({
              ...prev,
              materialId: String(selectedMat.id),
              materialName: selectedMat.name,
              unit: selectedMat.defaultUnit || prev.unit || "Nos",
              rate: selectedMat.defaultRate ? String(selectedMat.defaultRate) : prev.rate
            }));
          } else if (targetItemIndex !== null && siteFormData.items[targetItemIndex]) {
            updateSiteItem(targetItemIndex, 'materialId', String(selectedMat.id));
          } else {
            const lastIdx = siteFormData.items.length - 1;
            if (lastIdx >= 0 && !siteFormData.items[lastIdx].materialId) {
              updateSiteItem(lastIdx, 'materialId', String(selectedMat.id));
            } else {
              setSiteFormData(prev => ({
                ...prev,
                items: [
                  ...prev.items,
                  {
                    materialId: String(selectedMat.id),
                    quantity: "",
                    unit: selectedMat.defaultUnit || "Nos",
                    rate: selectedMat.defaultRate ? String(selectedMat.defaultRate) : "0",
                    taxPercentage: "18"
                  }
                ]
              }));
            }
          }
          loadData(true);
        }}
      />

      {/* Quick Manage Team Modal */}
      <ManageTeamsModal
        isOpen={isManageTeamOpen}
        onClose={() => setIsManageTeamOpen(false)}
        locationId={locationId}
        currentSelectedId={siteFormData.teamId}
        onSelectTeam={(selectedTeam) => {
          setSiteFormData(prev => ({
            ...prev,
            teamId: String(selectedTeam.id)
          }));
          loadData(true);
        }}
      />
    </div>
  );
}
