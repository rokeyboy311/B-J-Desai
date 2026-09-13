import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { Modal } from "../components/ui/Modal";
import { MapPin, Plus, Edit2, Trash2, MapPinned, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Location {
  id: number;
  name: string;
  address: string | null;
  recordCount: number;
  createdAt: string;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "" });
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();

  const fetchLocations = async () => {
    try {
      const data = await apiFetch("/locations");
      setLocations(data);
    } catch (error) {
      console.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const openCreateModal = () => {
    setSelectedLocation(null);
    setFormData({ name: "", address: "" });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (location: Location, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLocation(location);
    setFormData({ name: location.name, address: location.address || "" });
    setFormError("");
    setIsModalOpen(true);
  };

  const openDeleteModal = (location: Location, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLocation(location);
    setIsDeleteModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Location name is required");
      return;
    }
    
    try {
      const payload = {
        name: formData.name.trim(),
        address: formData.address.trim()
      };

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all your operating regions and folders.</p>
        </div>
        <button type="button" 
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Add Location
        </button>
      </header>

      {locations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPinned size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No locations yet</h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Create your first location to start managing records and organizing your accounting data.
          </p>
          <button type="button" 
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium text-sm hover:bg-indigo-100 transition-colors"
          >
            <Plus size={18} />
            Create First Location
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((loc) => (
            <div 
              key={loc.id} 
              onClick={() => navigate(`/locations/${loc.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all cursor-pointer group flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin size={20} />
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" 
                    onClick={(e) => openEditModal(loc, e)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button type="button" 
                    onClick={(e) => openDeleteModal(loc, e)}
                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{loc.name}</h3>
                {loc.address && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{loc.address}</p>
                )}
              </div>
              

            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedLocation ? "Edit Location" : "Add Location"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-100">
              {formError}
            </div>
          )}
          <div>
            <label htmlFor="locationName" className="block text-sm font-medium text-gray-700 mb-1">
              Location Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="locationName"
              name="locationName"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all"
              placeholder="e.g., Ahmedabad Branch"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="locationAddress" className="block text-sm font-medium text-gray-700 mb-1">
              Address / Details (Optional)
            </label>
            <textarea
              id="locationAddress"
              name="locationAddress"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all resize-none"
              placeholder="Full address or description"
              rows={3}
            />
          </div>
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
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
          <div className="bg-rose-50 p-4 rounded-lg flex items-start gap-3 border border-rose-100">
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-sm font-semibold text-rose-800">Warning</h4>
              <p className="text-sm text-rose-700 mt-1">
                This location contains <strong>{selectedLocation?.recordCount || 0} records</strong>. 
                Deleting this location will also remove access to all associated records.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{selectedLocation?.name}</strong>? This action cannot be undone.
          </p>
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
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
