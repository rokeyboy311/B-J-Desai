import { utils, write } from 'xlsx';

export interface ConsolidatedExportData {
  summary?: any;
  invoices?: any[];
  invoiceItems?: any[];
  creditDebitNotes?: any[];
  purchases?: any[];
  supplies?: any[];
  labourSupplies?: any[];
  expenses?: any[];
  income?: any[];
  refunds?: any[];
  salaries?: any[];
  workers?: any[];
  payments?: any[];
  parties?: any[];
  inventory?: any[];
  stockMovements?: any[];
  openingBalances?: any[];
  auditLogs?: any[];
  // Backwards compatibility keys
  incomeExpense?: any[];
  investments?: any[];
}

export function generateExcelBuffer(locationName: string, data: ConsolidatedExportData) {
  const wb = utils.book_new();

  // Helper to ensure a sheet always has at least a header row even if data is empty
  const appendSheetSafe = (sheetName: string, rows: any[], defaultHeaders: string[]) => {
    let ws;
    if (rows && rows.length > 0) {
      ws = utils.json_to_sheet(rows);
    } else {
      ws = utils.aoa_to_sheet([defaultHeaders, ['No records found']]);
    }
    utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Excel max sheet name is 31 chars
  };

  // 1. Executive Summary
  const summaryRows = [
    ['B_D ENTERPRISE / ACCOUNTING SYSTEM — CONSOLIDATED FINANCIAL REPORT'],
    ['Scope / Entity:', locationName || 'All Business Units & Locations'],
    ['Generated On:', new Date().toLocaleString()],
    [],
    ['Key Metric', 'Value (₹)', 'Notes'],
    ['Total Revenue / Billing', data.summary?.totalRevenue ?? 0, 'Invoices + Goods Dispatches + Direct Income'],
    ['Total Purchases (Procurement)', data.summary?.totalPurchases ?? 0, 'Raw materials and goods purchased'],
    ['Cost of Goods Sold (COGS)', data.summary?.cogs ?? 0, 'Opening Stock + Purchases - Closing Stock'],
    ['Gross Profit', data.summary?.grossProfit ?? 0, 'Revenue - Purchases / COGS'],
    ['Operating Expenses', data.summary?.totalOperatingCosts ?? 0, 'Labour, Site Expenses, Overhead'],
    ['Net Profit / (Loss)', data.summary?.netProfit ?? 0, 'Gross Profit - Operating Expenses'],
    ['Total Receivables (Debtors)', data.summary?.totalReceivables ?? 0, 'Customer balances + Pending refunds'],
    ['Total Payables (Creditors)', data.summary?.totalPayables ?? 0, 'Suppliers, Contractors & Labour dues'],
    ['Closing Stock Valuation', data.summary?.stockValuation ?? 0, 'Perpetual weighted-average cost valuation'],
    ['Net GST Output Tax', data.summary?.gst?.outputGst ?? 0, 'Sales CGST + SGST + IGST'],
    ['Net GST Input Tax Credit (ITC)', data.summary?.gst?.inputGst ?? 0, 'Purchase CGST + SGST + IGST'],
    ['GST Net Payable / (Credit)', data.summary?.gst?.netGstPayable ?? 0, 'Output Tax minus Input Tax Credit'],
  ];
  const wsSummary = utils.aoa_to_sheet(summaryRows);
  utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // 2. GST Invoices & Billing
  const invRows = (data.invoices || []).map((inv: any) => ({
    'Invoice No': inv.invoiceNumber,
    'Date': inv.invoiceDate,
    'Due Date': inv.dueDate || '-',
    'Type': inv.invoiceType ? inv.invoiceType.replace(/_/g, ' ') : 'TAX INVOICE',
    'Customer': inv.partyName,
    'Customer GSTIN': inv.partyGst || 'Unregistered',
    'Place of Supply': inv.placeOfSupply || 'Gujarat (24)',
    'Subtotal (₹)': Number(inv.subtotal || 0),
    'Discount (₹)': Number(inv.discount || 0),
    'Taxable Amount (₹)': Number(inv.taxableAmount || 0),
    'CGST (₹)': Number(inv.cgst || 0),
    'SGST (₹)': Number(inv.sgst || 0),
    'IGST (₹)': Number(inv.igst || 0),
    'Cess (₹)': Number(inv.cessAmount || 0),
    'Total Tax (₹)': Number(inv.totalTax || 0),
    'Transport Charges (₹)': Number(inv.transportCharges || 0),
    'Round Off (₹)': Number(inv.roundOff || 0),
    'Grand Total (₹)': Number(inv.totalAmount || 0),
    'Paid Amount (₹)': Number(inv.paidAmount || 0),
    'Balance Due (₹)': Number(inv.balanceAmount || 0),
    'Payment Status': inv.paymentStatus || 'UNPAID',
    'Is Void': inv.isVoid === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('GST Invoices', invRows, [
    'Invoice No', 'Date', 'Due Date', 'Type', 'Customer', 'Customer GSTIN',
    'Place of Supply', 'Taxable Amount (₹)', 'Total Tax (₹)', 'Grand Total (₹)', 'Balance Due (₹)', 'Payment Status'
  ]);

  // 3. Invoice Line Items
  const itemRows = (data.invoiceItems || []).map((item: any) => ({
    'Invoice ID': item.invoiceId,
    'Description': item.description,
    'HSN/SAC': item.hsnCode || '-',
    'Quantity': Number(item.quantity || 1),
    'Unit': item.unit || 'Nos',
    'Rate (₹)': Number(item.rate || 0),
    'Discount (₹)': Number(item.discount || 0),
    'Taxable Amount (₹)': Number(item.taxableAmount || 0),
    'GST Rate (%)': Number(item.taxRate || 0),
    'CGST (₹)': Number(item.cgst || 0),
    'SGST (₹)': Number(item.sgst || 0),
    'IGST (₹)': Number(item.igst || 0),
    'Total Amount (₹)': Number(item.totalAmount || 0),
  }));
  appendSheetSafe('Invoice Items', itemRows, [
    'Invoice ID', 'Description', 'HSN/SAC', 'Quantity', 'Unit', 'Rate (₹)', 'Taxable Amount (₹)', 'GST Rate (%)', 'Total Amount (₹)'
  ]);

  // 4. Credit & Debit Notes
  const noteRows = (data.creditDebitNotes || []).map((note: any) => ({
    'Note Number': note.noteNumber,
    'Date': note.noteDate,
    'Type': note.noteType === 'CREDIT_NOTE' ? 'CREDIT NOTE' : 'DEBIT NOTE',
    'Original Invoice ID': note.originalInvoiceId,
    'Party ID': note.partyId,
    'Reason': note.reason,
    'Taxable Amount (₹)': Number(note.taxableAmount || 0),
    'CGST (₹)': Number(note.cgst || 0),
    'SGST (₹)': Number(note.sgst || 0),
    'IGST (₹)': Number(note.igst || 0),
    'Total Amount (₹)': Number(note.totalAmount || 0),
    'Stock Affecting': note.stockAffecting === 1 ? 'YES' : 'NO',
    'Is Void': note.isVoid === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('Credit Debit Notes', noteRows, [
    'Note Number', 'Date', 'Type', 'Reason', 'Taxable Amount (₹)', 'Total Amount (₹)', 'Stock Affecting'
  ]);

  // 5. Material Purchases (Procurement)
  const purRows = (data.purchases || []).map((p: any) => ({
    'Purchase No': p.purchaseNumber || `PUR-${p.id}`,
    'Date': p.date,
    'Supplier': p.partyName,
    'Material': p.materialName,
    'Category': p.materialCategory || '-',
    'Quantity': Number(p.quantity || 0),
    'Unit': p.unit || '-',
    'Rate (₹)': Number(p.rate || 0),
    'Subtotal (₹)': Number(p.subtotal || 0),
    'Transport (₹)': Number(p.transportCost || 0),
    'Discount (₹)': Number(p.discount || 0),
    'Tax (₹)': Number(p.tax || 0),
    'Total (₹)': Number(p.totalAmount || 0),
    'Paid (₹)': Number(p.paidAmount || 0),
    'Outstanding (₹)': Number(p.outstandingAmount || 0),
    'Status': p.paymentStatus || 'UNPAID',
    'Bill / Ref No': p.invoiceNumber || p.referenceNumber || '-',
    'Is Void': p.isVoid === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('Material Purchases', purRows, [
    'Purchase No', 'Date', 'Supplier', 'Material', 'Quantity', 'Unit', 'Rate (₹)', 'Total (₹)', 'Outstanding (₹)', 'Status'
  ]);

  // 6. Material Supplies (Dispatches / Deliveries)
  const supRows = (data.supplies || []).map((s: any) => ({
    'Supply ID': s.invoiceNumber || `SUP-${s.id}`,
    'Date': s.date,
    'Client / Site': s.partyName,
    'Material': s.materialName,
    'Category': s.materialCategory || '-',
    'Quantity': Number(s.quantity || 0),
    'Unit': s.unit || '-',
    'Rate (₹)': Number(s.rate || 0),
    'Subtotal (₹)': Number(s.subtotal || 0),
    'Transport (₹)': Number(s.transportCost || 0),
    'Discount (₹)': Number(s.discount || 0),
    'Tax (₹)': Number(s.tax || 0),
    'Total (₹)': Number(s.totalAmount || 0),
    'Paid (₹)': Number(s.paidAmount || 0),
    'Outstanding (₹)': Number(s.outstandingAmount || 0),
    'Status': s.paymentStatus || 'UNPAID',
    'Is Void': s.isVoid === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('Material Supplies', supRows, [
    'Supply ID', 'Date', 'Client / Site', 'Material', 'Quantity', 'Unit', 'Rate (₹)', 'Total (₹)', 'Outstanding (₹)', 'Status'
  ]);

  // 7. Site & Contract Supplies
  const mlsRows = (data.labourSupplies || []).map((mls: any) => ({
    'Date': mls.date,
    'Site Location': mls.siteLocationName || '-',
    'Team': mls.teamName || '-',
    'Party': mls.partyName,
    'Work Description': mls.workDescription,
    'Material Amount (₹)': Number(mls.materialAmount || 0),
    'Labour Amount (₹)': Number(mls.labourAmount || 0),
    'Subtotal (₹)': Number(mls.subtotal || 0),
    'Tax (₹)': Number(mls.tax || 0),
    'Total (₹)': Number(mls.totalAmount || 0),
    'Paid (₹)': Number(mls.paidAmount || 0),
    'Outstanding (₹)': Number(mls.outstandingAmount || 0),
    'Status': mls.paymentStatus || 'UNPAID',
    'Is Void': mls.isVoid === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('Site Supplies', mlsRows, [
    'Date', 'Site Location', 'Team', 'Party', 'Work Description', 'Material Amount (₹)', 'Labour Amount (₹)', 'Total (₹)', 'Outstanding (₹)'
  ]);

  // Handle records partitioning (Expense vs Income)
  const allRecords = data.incomeExpense || [];
  const expensesList = data.expenses || allRecords.filter((r: any) => r.type === 'EXPENSE');
  const incomeList = data.income || allRecords.filter((r: any) => r.type === 'INCOME');

  // 8. Operating Expenses
  const expRows = expensesList.map((e: any) => ({
    'Date': e.date,
    'Category': e.category || 'General Expense',
    'Party / Payee': e.partyName,
    'Team': e.teamName || '-',
    'Description': e.description || '-',
    'Payment Method': e.paymentMethod || 'CASH',
    'Reference No': e.referenceNumber || '-',
    'Taxable Amount (₹)': Number(e.taxableAmount || 0),
    'GST Amount (₹)': Number(e.gstAmount || 0),
    'Total Expense (₹)': Number(e.amount || 0),
    'Is Refundable': Number(e.refundableAmount || 0) > 0 ? 'YES' : 'NO',
    'Refundable Amount (₹)': Number(e.refundableAmount || 0),
    'Refund Status': e.refundStatus || 'N/A',
    'Is Void': e.isVoid === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('Operating Expenses', expRows, [
    'Date', 'Category', 'Party / Payee', 'Description', 'Payment Method', 'Total Expense (₹)', 'Is Refundable', 'Refund Status'
  ]);

  // 9. Direct Income Records
  const incRows = incomeList.map((inc: any) => ({
    'Date': inc.date,
    'Category': inc.category || 'Direct Income',
    'Received From': inc.partyName,
    'Description': inc.description || '-',
    'Payment Method': inc.paymentMethod || 'CASH',
    'Reference No': inc.referenceNumber || '-',
    'Taxable (₹)': Number(inc.taxableAmount || 0),
    'GST (₹)': Number(inc.gstAmount || 0),
    'Total Income (₹)': Number(inc.amount || 0),
    'Is Void': inc.isVoid === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('Income Records', incRows, [
    'Date', 'Category', 'Received From', 'Description', 'Payment Method', 'Total Income (₹)'
  ]);

  // 10. Refundable Expense Tracking & Recoveries
  const refRows = (data.refunds || []).map((rf: any) => ({
    'Refund Date': rf.refundDate,
    'Expense Record ID': rf.recordId,
    'Amount Recovered (₹)': Number(rf.amount || 0),
    'Payment Method': rf.paymentMethod || 'CASH',
    'Reference No': rf.referenceNumber || '-',
    'Notes': rf.notes || '-',
    'Is Void': rf.isVoid === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('Refundable Tracking', refRows, [
    'Refund Date', 'Expense Record ID', 'Amount Recovered (₹)', 'Payment Method', 'Reference No', 'Notes'
  ]);

  // 11. Labour Wages & Upad (Day vs TC strictly separated)
  const salaryRows = (data.salaries || []).map((s: any) => ({
    'Date': s.date,
    'Worker Name': s.labourName,
    'Team': s.labourTeam || '-',
    'Site Location': s.siteLocationName || '-',
    'Work Type': s.workType || 'DAY_WORK',
    'Attendance': s.attendanceType || 'Full-day',
    'Days Worked': Number(s.days || 0),
    'Daily Rate (₹)': Number(s.dailyRate || 0),
    'TC No': s.tcNumber || '-',
    'TC Quantity': Number(s.tcQuantity || 0),
    'TC Rate (₹)': Number(s.tcRate || 0),
    'Other Earnings (₹)': Number(s.otherEarnings || 0),
    'Gross Salary (₹)': Number(s.grossSalary || 0),
    'Deductions (₹)': Number(s.deduction || 0),
    'Net Salary (₹)': Number(s.netSalary || 0),
    'Upad / Advance (₹)': Number(s.upad || 0),
    'Disbursed Amount (₹)': Number(s.paymentAmount || 0),
    'Balance Due (₹)': Number(s.balance || 0),
    'Payment Mode': s.paymentMethod || 'CASH',
    'Is Void': s.isVoid === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('Labour Wages', salaryRows, [
    'Date', 'Worker Name', 'Team', 'Work Type', 'Days Worked', 'Daily Rate (₹)', 'TC Quantity', 'TC Rate (₹)',
    'Gross Salary (₹)', 'Net Salary (₹)', 'Upad / Advance (₹)', 'Disbursed Amount (₹)', 'Balance Due (₹)'
  ]);

  // 12. Labour Attendance & Worker Details
  const workerRows = (data.workers || []).map((w: any) => ({
    'Worker Name': w.name,
    'Team': w.team || '-',
    'Default Rate (₹)': Number(w.dailyRate || 0),
    'Phone': w.phone || '-',
    'Address': w.address || '-',
    'Total Records': w.totalRecords || 0,
    'Total Earned (₹)': Number(w.totalEarned || 0),
    'Total Upad (₹)': Number(w.totalUpad || 0),
    'Total Paid (₹)': Number(w.totalPaid || 0),
    'Current Payable (₹)': Number(w.currentPayable || 0),
  }));
  appendSheetSafe('Worker Master', workerRows, [
    'Worker Name', 'Team', 'Default Rate (₹)', 'Phone', 'Total Earned (₹)', 'Total Upad (₹)', 'Current Payable (₹)'
  ]);

  // 13. Centralized Payments & Receipts Ledger
  const payRows = (data.payments || []).map((p: any) => ({
    'Date': p.date,
    'Party / Recipient': p.partyName,
    'Flow': p.paymentType === 'PAYMENT_IN' ? 'RECEIPT (IN)' : 'PAYMENT (OUT)',
    'Amount (₹)': Number(p.amount || 0),
    'Payment Mode': p.paymentMode || 'CASH',
    'Reference No': p.referenceNumber || '-',
    'Linked Invoice ID': p.invoiceId || '-',
    'Linked Purchase ID': p.purchaseId || '-',
    'Linked Labour ID': p.labourSalaryId || '-',
    'Linked Expense ID': p.recordId || '-',
    'Notes': p.notes || '-',
    'Is Reversed': p.isReversed === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('Payments & Receipts', payRows, [
    'Date', 'Party / Recipient', 'Flow', 'Amount (₹)', 'Payment Mode', 'Reference No', 'Notes', 'Is Reversed'
  ]);

  // 14. Master Parties & Customer/Supplier Balances
  const partyRows = (data.parties || []).map((pty: any) => ({
    'Party Name': pty.name,
    'Type': pty.partyType,
    'Phone': pty.phone || '-',
    'GSTIN': pty.gst || '-',
    'PAN': pty.pan || '-',
    'State': pty.state || 'Gujarat',
    'Opening Balance (₹)': Number(pty.openingBalance || 0),
    'Opening Type': pty.openingBalanceType || 'TO_RECEIVE',
    'Receivables Due (₹)': Number(pty.totalReceivable || 0),
    'Payables Due (₹)': Number(pty.totalPayable || 0),
    'Net Outstanding (₹)': Number(pty.netOutstanding || 0),
    'Balance Status': pty.currentBalanceType || 'SETTLED',
  }));
  appendSheetSafe('Parties Ledger', partyRows, [
    'Party Name', 'Type', 'Phone', 'GSTIN', 'Opening Balance (₹)', 'Receivables Due (₹)', 'Payables Due (₹)', 'Net Outstanding (₹)', 'Balance Status'
  ]);

  // 15. Inventory & Products (Stock Valuation)
  const itemRowsSheet = (data.inventory || []).map((it: any) => ({
    'Item Name': it.name,
    'Item Code': it.code || '-',
    'Category': it.category || '-',
    'HSN Code': it.hsnCode || '-',
    'Unit': it.unit || 'Nos',
    'Purchase Price (₹)': Number(it.purchasePrice || 0),
    'Selling Price (₹)': Number(it.salePrice || 0),
    'GST Rate (%)': Number(it.taxRate || 0),
    'Opening Stock': Number(it.openingStock || 0),
    'Current Stock': Number(it.currentStock || 0),
    'Min Stock Alert': Number(it.minStockAlert || 0),
    'Stock Valuation (₹)': Number(it.currentStock || 0) * Number(it.purchasePrice || 0),
  }));
  appendSheetSafe('Inventory Valuation', itemRowsSheet, [
    'Item Name', 'Category', 'Unit', 'Purchase Price (₹)', 'Selling Price (₹)', 'Current Stock', 'Stock Valuation (₹)'
  ]);

  // 16. Stock Movement Ledger
  const smRows = (data.stockMovements || []).map((sm: any) => ({
    'Date': sm.movementDate,
    'Item ID': sm.itemId,
    'Type': sm.movementType,
    'Quantity': Number(sm.quantity || 0),
    'Unit Price (₹)': Number(sm.unitPrice || 0),
    'Total Cost (₹)': Number(sm.totalCost || 0),
    'Ref Type': sm.referenceType || '-',
    'Ref ID': sm.referenceId || '-',
    'Notes': sm.notes || '-',
    'Is Void': sm.isVoid === 1 ? 'YES' : 'NO',
  }));
  appendSheetSafe('Stock Movements', smRows, [
    'Date', 'Item ID', 'Type', 'Quantity', 'Unit Price (₹)', 'Total Cost (₹)', 'Ref Type', 'Ref ID', 'Notes'
  ]);

  // 17. Opening Balances Ledger
  const opRows = (data.openingBalances || []).map((op: any) => ({
    'Financial Year': op.financialYear,
    'Entity Type': op.entityType,
    'Entity Name': op.entityName,
    'Debit Amount (₹)': Number(op.debitAmount || 0),
    'Credit Amount (₹)': Number(op.creditAmount || 0),
    'Stock Qty': Number(op.stockQuantity || 0),
    'Stock Rate (₹)': Number(op.stockRate || 0),
    'Effective Date': op.effectiveDate,
    'Notes': op.notes || '-',
  }));
  appendSheetSafe('Opening Balances', opRows, [
    'Financial Year', 'Entity Type', 'Entity Name', 'Debit Amount (₹)', 'Credit Amount (₹)', 'Effective Date', 'Notes'
  ]);

  // 18. System Audit Logs
  const auditRows = (data.auditLogs || []).map((log: any) => ({
    'Timestamp': log.createdAt ? new Date(log.createdAt).toISOString() : '-',
    'Action': log.action,
    'Entity': log.entityType,
    'Entity ID': log.entityId || '-',
    'User ID': log.userId,
    'Metadata': log.metadata || '-',
  }));
  appendSheetSafe('Audit Logs', auditRows, [
    'Timestamp', 'Action', 'Entity', 'Entity ID', 'User ID', 'Metadata'
  ]);

  return write(wb, { type: 'buffer', bookType: 'xlsx' });
}
