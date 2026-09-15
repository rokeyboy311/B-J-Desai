const fs = require('fs');
const file = 'src/client/components/categories/MaterialPurchaseTab.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetModal = `      {/* Form Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Purchase" : "Add Purchase"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vendor/Party Name</label>
              <input type="text" required value={formData.partyName} onChange={e => setFormData({...formData, partyName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. ABC Cements" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Material</label>
              <select required value={formData.materialId} onChange={e => setFormData({...formData, materialId: e.target.value, materialName: e.target.options[e.target.selectedIndex].text})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">-- Select --</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
              <select value={unitMode} onChange={e => setUnitMode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {PRESET_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              {unitMode === "Custom" && <input type="text" placeholder="Enter custom unit" value={customUnit} onChange={e => setCustomUnit(e.target.value)} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
              <input type="number" step="0.01" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rate (₹)</label>
              <input type="number" step="0.01" required value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100 flex justify-between items-center font-bold text-slate-800">
             <span>Total Amount:</span>
             <span className="text-lg text-rose-700">₹{calculations.total.toLocaleString()}</span>
          </div>

          <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-lg">{editingId ? "Update Purchase" : "Save Purchase"}</button>
        </form>
      </Modal>`;

const replacementModal = `      {/* Form Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Material Purchase" : "Add Material Purchase"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">1. Purchase Date *</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">2. Payment Status *</label>
              <select required value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="PAID">PAID</option>
                <option value="UNPAID">UNPAID (Pending)</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">3. Supplier / Vendor Name *</label>
            <input type="text" required value={formData.partyName} onChange={e => setFormData({...formData, partyName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. ABC Cements" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">4. Material Name *</label>
              <select required value={formData.materialId} onChange={e => setFormData({...formData, materialId: e.target.value, materialName: e.target.options[e.target.selectedIndex].text})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">-- Select Material --</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">6. Unit of Measurement *</label>
              <select value={unitMode} onChange={e => setUnitMode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {PRESET_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              {unitMode === "Custom" && <input type="text" placeholder="Enter custom unit" value={customUnit} onChange={e => setCustomUnit(e.target.value)} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">5. Quantity *</label>
              <input type="number" step="0.01" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">7. Rate (₹ per {effectiveUnit}) *</label>
              <input type="number" step="0.01" required value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">8. Transport / Freight (₹) (+)</label>
              <input type="number" step="0.01" value={formData.transportCost} onChange={e => setFormData({...formData, transportCost: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">9. Discount (₹) (-)</label>
              <input type="number" step="0.01" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">10. Tax / GST (%) (+)</label>
              <input type="number" step="0.01" value={formData.taxPercentage} onChange={e => setFormData({...formData, taxPercentage: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
          </div>

          {formData.paymentStatus === 'PAID' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">11. Payment Method</label>
                <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment / Txn Ref</label>
                <input type="text" value={formData.referenceNumber} onChange={e => setFormData({...formData, referenceNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Txn ID" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">12. Bill / Challan / Ref No.</label>
              <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Bill No." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">13. Notes / Description</label>
              <input type="text" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Vehicle No., Driver Details" />
            </div>
          </div>

          {/* Unit & Total Calculation */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 mt-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Unit & Total Calculation</h4>
            <div className="flex justify-between items-center text-sm text-slate-600">
               <span>14. Base Material Subtotal</span>
               <span className="font-semibold">₹{calculations.subtotal.toLocaleString()}</span>
            </div>
            {Number(formData.discount || 0) > 0 && (
              <div className="flex justify-between items-center text-sm text-emerald-600">
                 <span>Discount</span>
                 <span className="font-semibold">- ₹{Number(formData.discount || 0).toLocaleString()}</span>
              </div>
            )}
            {Number(formData.taxPercentage || 0) > 0 && (
              <div className="flex justify-between items-center text-sm text-slate-600">
                 <span>GST ({formData.taxPercentage}%)</span>
                 <span className="font-semibold">+ ₹{calculations.tax.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm text-slate-600 border-b border-slate-200 pb-2">
               <span>15. Transport / Freight</span>
               <span className="font-semibold">+ ₹{Number(formData.transportCost || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center font-black text-rose-700 text-lg pt-1">
               <span>16. Net Total Payable</span>
               <span>₹{calculations.total.toLocaleString()}</span>
            </div>
          </div>

          <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-sm transition-all mt-4 text-sm">
             17. {editingId ? "Update Material Purchase" : "Save Material Purchase"}
          </button>
        </form>
      </Modal>`;

code = code.replace(targetModal, replacementModal);
fs.writeFileSync(file, code);
