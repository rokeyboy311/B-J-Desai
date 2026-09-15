import { utils, write } from 'xlsx';

export function generateExcelBuffer(locationName: string, data: any, tab: string = 'all') {
  const wb = utils.book_new();

  // Summary Sheet (Only include if 'all' is exported, or maybe always?)
  if (tab === 'all') {
    const summaryData = [
      ['Bina Enterprise Summary'],
      ['Location:', locationName],
      ['Generated On:', new Date().toLocaleString()],
    ];
    const wsSummary = utils.aoa_to_sheet(summaryData);
    utils.book_append_sheet(wb, wsSummary, 'Summary');
  }

  // Income/Expense Sheet
  if (data.incomeExpense) {
    const ws1 = utils.json_to_sheet(data.incomeExpense.map((r: any) => ({
      'Date': new Date(r.date).toLocaleDateString(),
      'Type': r.type,
      'Amount': Number(r.amount),
      'Refundable': Number(r.refundableAmount || 0),
      'Refunded': Number(r.refundedAmount || 0),
      'Status': r.refundStatus,
      'Party': r.partyName,
      'Category': r.category || '-',
    })));
    utils.book_append_sheet(wb, ws1, 'Income & Expense');
  }

  // Investment Sheet
  if (data.investments) {
    const ws2 = utils.json_to_sheet(data.investments.map((r: any) => ({
      'Date': new Date(r.date).toLocaleDateString(),
      'Party': r.partyName || '-',
      'Type': r.type === 'INVESTMENT' ? 'Investment' : r.type === 'UPAD' ? 'Upad' : r.type,
      'Amount (₹)': Number(r.amount),
      'Payment Method': r.paymentMethod || '-',
      'Reference No': r.referenceNumber || '-',
      'Description': r.description || '-',
    })));
    utils.book_append_sheet(wb, ws2, 'Investments');
  }

  // Material Purchases
  if (data.purchases) {
    const ws3 = utils.json_to_sheet(data.purchases.map((r: any) => ({
      'Date': new Date(r.date).toLocaleDateString(),
      'Party Name': r.partyName,
      'Material': r.materialName,
      'Quantity': Number(r.quantity),
      'Unit': r.unit,
      'Rate ₹': Number(r.rate),
      'Subtotal ₹': Number(r.subtotal || (Number(r.quantity) * Number(r.rate))),
      'Transport Cost ₹': Number(r.transportCost || 0),
      'Discount ₹': Number(r.discount || 0),
      'Tax ₹': Number(r.tax || 0),
      'Total ₹': Number(r.totalAmount),
      'Status': r.paymentStatus,
    })));
    utils.book_append_sheet(wb, ws3, 'Material Purchases');
  }

  // Material Supplies
  if (data.supplies) {
    const ws4 = utils.json_to_sheet(data.supplies.map((r: any) => ({
      'Date': new Date(r.date).toLocaleDateString(),
      'Party Name': r.partyName,
      'Material': r.materialName,
      'Quantity': Number(r.quantity),
      'Unit': r.unit,
      'Rate ₹': Number(r.rate),
      'Subtotal ₹': Number(r.subtotal || (Number(r.quantity) * Number(r.rate))),
      'Transport Cost ₹': Number(r.transportCost || 0),
      'Discount ₹': Number(r.discount || 0),
      'Tax ₹': Number(r.tax || 0),
      'Total ₹': Number(r.totalAmount),
      'Status': r.paymentStatus,
    })));
    utils.book_append_sheet(wb, ws4, 'Material Supplies');
  }

  // Site Supplies (Material + Labour)
  if (data.labourSupplies) {
    const ws5 = utils.json_to_sheet(data.labourSupplies.map((r: any) => ({
      'Date': new Date(r.date).toLocaleDateString(),
      'Party Name': r.partyName,
      'Work': r.workDescription,
      'Material ₹': Number(r.materialAmount),
      'Labour ₹': Number(r.labourAmount),
      'Total ₹': Number(r.totalAmount),
    })));
    utils.book_append_sheet(wb, ws5, 'Site Supplies');
  }

  // Labour Salaries
  if (data.salaries) {
    const ws6 = utils.json_to_sheet(data.salaries.map((r: any) => ({
      'Date': new Date(r.date).toLocaleDateString(),
      'Labour Name': r.labourName,
      'Days': Number(r.days),
      'Rate': Number(r.dailyRate),
      'Gross': Number(r.grossSalary),
      'Net': Number(r.netSalary),
      'Upad': Number(r.upad),
      'Payment': Number(r.paymentAmount),
      'Balance': Number(r.balance),
    })));
    utils.book_append_sheet(wb, ws6, 'Labour Salaries');
  }

  // Invoices & Billing Sheet
  if (data.invoices && data.invoices.length > 0) {
    const wsInvoices = utils.json_to_sheet(data.invoices.map((inv: any) => ({
      'Invoice No': inv.invoiceNumber,
      'Date': inv.invoiceDate,
      'Due Date': inv.dueDate || '-',
      'Type': inv.invoiceType ? inv.invoiceType.replace('_', ' ') : 'TAX INVOICE',
      'Customer': inv.partyName,
      'GSTIN': inv.partyGst || 'Unregistered',
      'Place of Supply': inv.placeOfSupply || 'Gujarat (24)',
      'Taxable Amount (₹)': Number(inv.taxableAmount || 0),
      'CGST (₹)': Number(inv.cgst || 0),
      'SGST (₹)': Number(inv.sgst || 0),
      'IGST (₹)': Number(inv.igst || 0),
      'Total Tax (₹)': Number(inv.totalTax || 0),
      'Grand Total (₹)': Number(inv.totalAmount || 0),
      'Paid Amount (₹)': Number(inv.paidAmount || 0),
      'Balance Due (₹)': Number(inv.balanceAmount || 0),
      'Payment Status': inv.paymentStatus || 'UNPAID',
    })));
    utils.book_append_sheet(wb, wsInvoices, 'GST Invoices');
  }

  // Payments Ledger Sheet
  if (data.payments && data.payments.length > 0) {
    const wsPayments = utils.json_to_sheet(data.payments.map((p: any) => ({
      'Date': p.date,
      'Party Name': p.partyName,
      'Flow Type': p.paymentType === 'PAYMENT_IN' ? 'RECEIPT (IN)' : 'PAYMENT (OUT)',
      'Amount (₹)': Number(p.amount || 0),
      'Payment Mode': p.paymentMode || 'BANK_TRANSFER',
      'Reference No': p.referenceNumber || '-',
      'Notes': p.notes || '-',
    })));
    utils.book_append_sheet(wb, wsPayments, 'Payments Ledger');
  }

  return write(wb, { type: 'buffer', bookType: 'xlsx' });
}
