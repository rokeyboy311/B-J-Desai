import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MapPin, Edit2, Trash2, MapPinned, AlertTriangle } from "lucide-react";
import { apiFetch } from "../lib/api";
import { Modal } from "../components/ui/Modal";
import { motion } from "motion/react";
import { useLiveSync } from "../hooks/useLiveSync";

interface Location {
  id: number;
  name: string;
  address: string | null;
  createdAt: string;
  recordCount?: number;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "" });
  const [formError, setFormError] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchLocations = async (isBackground = false) => {
    try {
      if (!isBackground && locations.length === 0) setLoading(true);
      const res = await apiFetch("/locations");
      setLocations(res);
    } catch (error) {
      console.error("Failed to load locations: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations(false);
  }, []);

  useLiveSync(() => {
    fetchLocations(true);
  }, 3500);

  const openCreateModal = () => {
    setSelectedLocation(null);
    setFormData({ name: "", address: "" });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (loc: Location, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLocation(loc);
    setFormData({ name: loc.name, address: loc.address || "" });
    setFormError("");
    setIsModalOpen(true);
  };

  const openDeleteModal = (loc: Location, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLocation(loc);
    setIsDeleteModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formData.name.trim()) {
      setFormError("Location name is required");
      return;
    }

    try {
      const payload = { name: formData.name.trim(), address: formData.address.trim() || undefined };
      
      if (selectedLocation) {
        await apiFetch(`/locations/${selectedLocation.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/locations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setIsModalOpen(false);
      fetchLocations();
    } catch (error: any) {
      setFormError(error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedLocation) return;
    try {
      await apiFetch(`/locations/${selectedLocation.id}`, { method: "DELETE" });
      setIsDeleteModalOpen(false);
      fetchLocations();
    } catch (error) {
      console.error("Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-6 h-6 text-indigo-500" /> Locations
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage all your operating regions and folders.</p>
        </div>
        <button type="button" 
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-600/20"
        >
          <Plus size={18} />
          Add Location
        </button>
      </header>

      {locations.length === 0 ? (
        <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity:1, scale:1}} className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPinned size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No locations yet</h3>
          <p className="text-slate-500 mb-8 max-w-sm mx-auto">
            Create your first location to start managing records and organizing your accounting data.
          </p>
          <button type="button" 
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-semibold text-sm hover:bg-indigo-100 transition-colors"
          >
            <Plus size={18} />
            Create First Location
          </button>
        </motion.div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {locations.map((loc) => (
            <motion.div 
              variants={item}
              key={loc.id} 
              onClick={() => navigate(`/locations/${loc.id}`)}
              className="bg-white border border-slate-200/60 rounded-2xl p-6 hover:shadow-lg hover:border-indigo-100 transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-50 to-transparent rounded-bl-full -z-0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="w-12 h-12 bg-slate-50 group-hover:bg-indigo-50 text-slate-400 group-hover:text-indigo-600 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                  <MapPin size={24} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" 
                    onClick={(e) => openEditModal(loc, e)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button type="button" 
                    onClick={(e) => openDeleteModal(loc, e)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 relative z-10">
                <h3 className="text-lg font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-700 transition-colors">{loc.name}</h3>
                {loc.address ? (
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">{loc.address}</p>
                ) : (
                  <p className="text-sm text-slate-400 mt-2 italic">No address provided</p>
                )}
              </div>
              
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedLocation ? "Edit Location" : "Add Location"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100">
              {formError}
            </div>
          )}
          <div>
            <label htmlFor="locationName" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Location Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="locationName"
              name="locationName"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g., Ahmedabad Branch"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="locationAddress" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Address / Details (Optional)
            </label>
            <textarea
              id="locationAddress"
              name="locationAddress"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
              placeholder="Full address or description"
              rows={3}
            />
          </div>
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
            >
              {selectedLocation ? "Save Changes" : "Create Location"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Location"
      >
        <div className="space-y-4">
          <div className="bg-rose-50 p-4 rounded-xl flex items-start gap-3 border border-rose-100">
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-sm font-bold text-rose-900">Warning</h4>
              <p className="text-sm text-rose-700 mt-1">
                Deleting this location will also permanently remove access to all associated records.
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <strong>{selectedLocation?.name}</strong>? This action cannot be undone.
          </p>
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button type="button"
              onClick={handleDelete}
              className="px-5 py-2.5 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              Yes, Delete Location
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
