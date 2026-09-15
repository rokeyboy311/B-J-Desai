import React from "react";
import { Printer, X, Download, Building2, CheckCircle2 } from "lucide-react";
import { numberToWords } from "../../lib/numberToWords";

interface InvoicePrintViewProps {
  invoice: any;
  onClose: () => void;
}

export default function InvoicePrintView({ invoice, onClose }: InvoicePrintViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const isInterState = parseFloat(invoice.igst || '0') > 0;
  const items = invoice.items || [];
  const totalAmount = parseFloat(invoice.totalAmount || '0');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Action Header (Hidden on print) */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-indigo-100 text-indigo-800">
              {invoice.invoiceType ? invoice.invoiceType.replace('_', ' ') : 'TAX INVOICE'}
            </span>
            <span className="font-semibold text-slate-800 text-sm">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm shadow-indigo-600/20"
            >
              <Printer size={16} /> Print / PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable GST Invoice Body */}
        <div className="p-6 sm:p-10 overflow-y-auto print:p-0 print:overflow-visible text-slate-800 text-xs sm:text-sm">
          {/* Header */}
          <div className="border border-slate-300 rounded-xl p-6 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                    <Building2 size={18} />
                  </div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">BINA ENTERPRISE</h1>
                </div>
                <p className="text-slate-600 text-xs max-w-sm">
                  Civil Engineering, Material Procurement, Infrastructure & General Contracting
                </p>
                <p className="text-slate-600 text-xs">
                  <span className="font-semibold">GSTIN:</span> 24AABCB1234F1Z5 | <span className="font-semibold">State:</span> Gujarat (24)
                </p>
                <p className="text-slate-600 text-xs">
                  <span className="font-semibold">Email:</span> contact@binaenterprise.com | <span className="font-semibold">Phone:</span> +91 98765 43210
                </p>
              </div>

              <div className="text-right space-y-1 sm:min-w-[200px]">
                <h2 className="text-lg font-black uppercase text-indigo-700 tracking-wider">
                  {invoice.invoiceType ? invoice.invoiceType.replace('_', ' ') : 'TAX INVOICE'}
                </h2>
                <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 text-left space-y-1">
                  <p className="flex justify-between text-xs">
                    <span className="text-slate-500">Invoice No:</span>
                    <span className="font-bold text-slate-800">{invoice.invoiceNumber}</span>
                  </p>
                  <p className="flex justify-between text-xs">
                    <span className="text-slate-500">Invoice Date:</span>
                    <span className="font-medium text-slate-800">{invoice.invoiceDate}</span>
                  </p>
                  {invoice.dueDate && (
                    <p className="flex justify-between text-xs">
                      <span className="text-slate-500">Due Date:</span>
                      <span className="font-medium text-slate-800">{invoice.dueDate}</span>
                    </p>
                  )}
                  <p className="flex justify-between text-xs">
                    <span className="text-slate-500">Place of Supply:</span>
                    <span className="font-medium text-slate-800">{invoice.placeOfSupply || 'Gujarat (24)'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Buyer Details */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Billed To (Customer):</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">{invoice.partyName}</p>
                {invoice.partyAddress && <p className="text-xs text-slate-600 mt-0.5">{invoice.partyAddress}</p>}
                {invoice.partyPhone && <p className="text-xs text-slate-600">Ph: {invoice.partyPhone}</p>}
                <p className="text-xs text-slate-700 mt-1">
                  <span className="font-semibold">GSTIN:</span> {invoice.partyGst || 'Unregistered'}
                </p>
              </div>

              <div className="sm:text-right">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Payment Status:</span>
                <div className="mt-1 sm:flex sm:justify-end">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    invoice.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : invoice.paymentStatus === 'PARTIAL'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    <CheckCircle2 size={12} /> {invoice.paymentStatus || 'UNPAID'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Balance Outstanding: <span className="font-bold text-slate-900">₹{parseFloat(invoice.balanceAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs font-semibold border-b border-slate-300 uppercase tracking-wider">
                  <th className="p-3 text-center w-10">#</th>
                  <th className="p-3">Item / Description</th>
                  <th className="p-3 text-center">HSN/SAC</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Rate (₹)</th>
                  <th className="p-3 text-right">Taxable (₹)</th>
                  {!isInterState && (
                    <>
                      <th className="p-3 text-right">CGST</th>
                      <th className="p-3 text-right">SGST</th>
                    </>
                  )}
                  {isInterState && <th className="p-3 text-right">IGST</th>}
                  <th className="p-3 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={isInterState ? 8 : 9} className="p-6 text-center text-slate-400">
                      No items found on this invoice
                    </td>
                  </tr>
                ) : (
                  items.map((item: any, idx: number) => {
                    const qty = parseFloat(item.quantity || '0');
                    const rate = parseFloat(item.rate || '0');
                    const taxable = parseFloat(item.taxableAmount || '0');
                    const cgst = parseFloat(item.cgst || '0');
                    const sgst = parseFloat(item.sgst || '0');
                    const igst = parseFloat(item.igst || '0');
                    const total = parseFloat(item.totalAmount || '0');
                    const taxRate = parseFloat(item.taxRate || '0');

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-800">{item.description}</p>
                        </td>
                        <td className="p-3 text-center font-mono text-xs text-slate-600">{item.hsnCode || '-'}</td>
                        <td className="p-3 text-right font-medium">
                          {qty} <span className="text-xs text-slate-500">{item.unit || ''}</span>
                        </td>
                        <td className="p-3 text-right font-mono">{rate.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">{taxable.toFixed(2)}</td>
                        {!isInterState && (
                          <>
                            <td className="p-3 text-right font-mono text-xs">
                              {cgst.toFixed(2)} <span className="text-slate-400 block text-[10px]">({taxRate / 2}%)</span>
                            </td>
                            <td className="p-3 text-right font-mono text-xs">
                              {sgst.toFixed(2)} <span className="text-slate-400 block text-[10px]">({taxRate / 2}%)</span>
                            </td>
                          </>
                        )}
                        {isInterState && (
                          <td className="p-3 text-right font-mono text-xs">
                            {igst.toFixed(2)} <span className="text-slate-400 block text-[10px]">({taxRate}%)</span>
                          </td>
                        )}
                        <td className="p-3 text-right font-mono font-bold text-slate-900">{total.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Tax Summary & Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 mb-6">
            {/* Amount in words & Bank info */}
            <div className="sm:col-span-7 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Amount in Words:</span>
                <p className="text-xs font-semibold text-indigo-900 mt-1 italic">
                  {numberToWords(totalAmount)}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="uppercase font-bold tracking-wider text-slate-400 block mb-1">Bank Payment Details:</span>
                <p><span className="font-semibold text-slate-600">Bank Name:</span> State Bank of India</p>
                <p><span className="font-semibold text-slate-600">A/C Name:</span> BINA ENTERPRISE</p>
                <p><span className="font-semibold text-slate-600">A/C Number:</span> 123456789012</p>
                <p><span className="font-semibold text-slate-600">IFSC Code:</span> SBIN0001234</p>
                <p><span className="font-semibold text-slate-600">Branch:</span> Ahmedabad Main</p>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="sm:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Taxable Value:</span>
                <span className="font-mono font-semibold text-slate-800">
                  ₹{parseFloat(invoice.taxableAmount || '0').toFixed(2)}
                </span>
              </div>
              {!isInterState ? (
                <>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Central GST (CGST):</span>
                    <span className="font-mono font-semibold text-slate-800">
                      ₹{parseFloat(invoice.cgst || '0').toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>State GST (SGST):</span>
                    <span className="font-mono font-semibold text-slate-800">
                      ₹{parseFloat(invoice.sgst || '0').toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Integrated GST (IGST):</span>
                  <span className="font-mono font-semibold text-slate-800">
                    ₹{parseFloat(invoice.igst || '0').toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Tax:</span>
                <span className="font-mono font-semibold text-slate-800">
                  ₹{parseFloat(invoice.totalTax || '0').toFixed(2)}
                </span>
              </div>
              {parseFloat(invoice.roundOff || '0') !== 0 && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Round Off:</span>
                  <span className="font-mono text-slate-800">
                    ₹{parseFloat(invoice.roundOff || '0').toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-2 flex justify-between text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-700 text-base">
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-1.5 flex justify-between text-xs text-emerald-700 font-medium">
                <span>Amount Paid:</span>
                <span className="font-mono font-bold">
                  ₹{parseFloat(invoice.paidAmount || '0').toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-rose-700 font-bold">
                <span>Balance Due:</span>
                <span className="font-mono">
                  ₹{parseFloat(invoice.balanceAmount || '0').toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Terms & Signatures */}
          <div className="border-t border-slate-200 pt-6 mt-6 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-slate-500">
            <div className="space-y-1 max-w-sm">
              <p className="font-bold text-slate-700 uppercase">Terms & Conditions:</p>
              <p>1. Goods once sold will not be taken back or exchanged.</p>
              <p>2. Payment due within specified period from invoice date.</p>
              <p>3. Subject to local jurisdiction only.</p>
            </div>
            <div className="text-right space-y-10 sm:min-w-[180px]">
              <p className="font-semibold text-slate-700">For BINA ENTERPRISE</p>
              <div className="border-t border-slate-400 pt-1">
                <p className="text-[11px] font-medium text-slate-600">Authorised Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
