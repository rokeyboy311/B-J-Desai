import { utils, write } from 'xlsx';

export function generateExcelBuffer(locationName: string, data: any, tab: string = 'all') {
  const wb = utils.book_new();

  // Summary Sheet
  if (tab === 'all') {
    const summaryData = [
      ['BINA ENTERPRISE - ERP FINANCIAL AUDIT REPORT'],
      ['Location / Project:', locationName],
      ['Generated On:', new Date().toLocaleString()],
      ['Status:', 'Live Database Reconciliation'],
      [],
    ];
    const wsSummary = utils.aoa_to_sheet(summaryData);
    utils.book_append_sheet(wb, wsSummary, 'Summary');
  }

  // 1. Income/Expense Sheet
  if (data.incomeExpense && data.incomeExpense.length > 0) {
    const ws1 = utils.json_to_sheet(data.incomeExpense.map((r: any) => ({
      'Date': r.date || '-',
      'Type': r.type,
      'Party / Description': r.partyName || r.description || '-',
      'Amount (₹)': Number(r.amount || 0),
      'Category': r.category || '-',
      'Refundable (₹)': Number(r.refundableAmount || 0),
      'Refunded (₹)': Number(r.refundedAmount || 0),
      'Status': r.refundStatus || 'N/A',
      'Payment Method': r.paymentMethod || '-',
      'Reference No': r.referenceNumber || '-',
      'Notes': r.notes || ''
    })));
    utils.book_append_sheet(wb, ws1, 'Income & Expense');
  }

  // 2. Category 1: Investor Capital & Contributions
  if (data.investors && data.investors.length > 0) {
    const ws2 = utils.json_to_sheet(data.investors.map((r: any) => ({
      'Date': r.date || '-',
      'Investor / Party': r.partyName || '-',
      'Transaction Type': r.type === 'CONTRIBUTION' ? 'Capital In (Contribution)' : r.type === 'INVESTMENT' ? 'Investment Karya (Project Outflow)' : r.type === 'UPAD' ? 'Upad (Withdrawal)' : r.type,
      'Amount (₹)': Number(r.amount || 0),
      'Payment Method': r.paymentMethod || '-',
      'Reference No': r.referenceNumber || '-',
      'Description / Purpose': r.description || '-',
    })));
    utils.book_append_sheet(wb, ws2, 'Investors Ledger');
  }

  // 3. Category 2: Refundable Records & Deposits
  if (data.refundableRecords && data.refundableRecords.length > 0) {
    const wsRef = utils.json_to_sheet(data.refundableRecords.map((r: any) => ({
      'Date': r.date || '-',
      'Party / Company': r.partyName || '-',
      'Deposit Purpose': r.description || 'Security Deposit',
      'Total Deposit (₹)': Number(r.refundableAmount || r.amount || 0),
      'Refunded Back (₹)': Number(r.refundedAmount || 0),
      'Pending Balance (₹)': Math.max(0, Number(r.refundableAmount || r.amount || 0) - Number(r.refundedAmount || 0)),
      'Refund Status': r.refundStatus || 'PENDING',
      'Payment Method': r.paymentMethod || '-',
      'Reference No': r.referenceNumber || '-',
      'Notes': r.notes || ''
    })));
    utils.book_append_sheet(wb, wsRef, 'Refundable Records');
  }

  // 4. Category 2: Itemized Deductions from Project Capital
  if (data.itemizedDeductions && data.itemizedDeductions.length > 0) {
    const wsDed = utils.json_to_sheet(data.itemizedDeductions.map((r: any) => ({
      'Date': r.date || '-',
      'Category': r.categoryName || r.category || '-',
      'Party / Payee': r.partyName || '-',
      'Description / Items': r.description || '-',
      'Deduction Amount (₹)': Number(r.amount || 0),
      'Paid Outflow (₹)': Number(r.paidAmount || 0),
      'Payment Status': r.paymentStatus || 'DEDUCTED',
      'Reference No': r.referenceNumber || '-'
    })));
    utils.book_append_sheet(wb, wsDed, 'Capital Deductions');
  }

  // 5. Category 3: Material Purchases
  if (data.purchases && data.purchases.length > 0) {
    const ws3 = utils.json_to_sheet(data.purchases.map((r: any) => ({
      'Date': r.date || '-',
      'Vendor / Party': r.partyName,
      'Material': r.materialName,
      'Quantity': Number(r.quantity || 0),
      'Unit': r.unit || 'Unit',
      'Rate (₹)': Number(r.rate || 0),
      'Subtotal (₹)': Number(r.subtotal || (Number(r.quantity || 0) * Number(r.rate || 0))),
      'Transport (₹)': Number(r.transportCost || 0),
      'Discount (₹)': Number(r.discount || 0),
      'Tax / GST (₹)': Number(r.tax || 0),
      'Total Bill (₹)': Number(r.totalAmount || 0),
      'Paid (₹)': Number(r.paidAmount || 0),
      'Outstanding (₹)': Number(r.outstandingAmount || 0),
      'Status': r.paymentStatus || 'UNPAID',
    })));
    utils.book_append_sheet(wb, ws3, 'Material Purchases');
  }

  // 6. Category 4: Material Supplies
  if (data.supplies && data.supplies.length > 0) {
    const ws4 = utils.json_to_sheet(data.supplies.map((r: any) => ({
      'Date': r.date || '-',
      'Customer / Party': r.partyName,
      'Material': r.materialName,
      'Quantity': Number(r.quantity || 0),
      'Unit': r.unit || 'Unit',
      'Rate (₹)': Number(r.rate || 0),
      'Subtotal (₹)': Number(r.subtotal || (Number(r.quantity || 0) * Number(r.rate || 0))),
      'Transport (₹)': Number(r.transportCost || 0),
      'Discount (₹)': Number(r.discount || 0),
      'Tax / GST (₹)': Number(r.tax || 0),
      'Total Billed (₹)': Number(r.totalAmount || 0),
      'Paid (₹)': Number(r.paidAmount || 0),
      'Outstanding (₹)': Number(r.outstandingAmount || 0),
      'Status': r.paymentStatus || 'UNPAID',
    })));
    utils.book_append_sheet(wb, ws4, 'Material Supplies');
  }

  // 7. Category 5: Site Supplies (Material + Equipment)
  const siteList = data.siteSupplies || data.labourSupplies;
  if (siteList && siteList.length > 0) {
    const ws5 = utils.json_to_sheet(siteList.map((r: any) => ({
      'Date': r.date || '-',
      'Location / Site': r.locationName || locationName,
      'Party / Contractor': r.partyName || r.contractorName || '-',
      'Work / Description': r.workDescription || r.description || '-',
      'Material Cost (₹)': Number(r.materialAmount || 0),
      'Labour Cost (₹)': Number(r.labourAmount || 0),
      'Total (₹)': Number(r.totalAmount || (Number(r.materialAmount || 0) + Number(r.labourAmount || 0))),
    })));
    utils.book_append_sheet(wb, ws5, 'Site Supplies');
  }

  // 8. Category 6: Labour Salaries & Wages
  if (data.salaries && data.salaries.length > 0) {
    const ws6 = utils.json_to_sheet(data.salaries.map((r: any) => ({
      'Date': r.date || '-',
      'Labour / Worker': r.labourName,
      'Team': r.teamName || 'General',
      'Days Worked': Number(r.days || 0),
      'TC Qty': Number(r.tcQuantity || 0),
      'Daily Rate (₹)': Number(r.dailyRate || 0),
      'Gross Salary (₹)': Number(r.grossSalary || 0),
      'Team Upad (₹)': Number(r.upad || 0),
      'Net Salary (₹)': Number(r.netSalary || 0),
      'Paid (₹)': Number(r.paymentAmount || 0),
      'Unpaid Balance (₹)': Number(r.balance || 0),
    })));
    utils.book_append_sheet(wb, ws6, 'Labour Wages');
  }

  // 9. Category 7 / 8: Supervisor & Site Expenses
  if (data.supervisorCosts && data.supervisorCosts.length > 0) {
    const ws7 = utils.json_to_sheet(data.supervisorCosts.map((r: any) => ({
      'Date': r.date || '-',
      'Supervisor / Staff': r.supervisorName,
      'Amount (₹)': Number(r.amount || 0),
      'Payment Method': r.paymentMethod || '-',
      'Reference No': r.referenceNumber || '-',
      'Description': r.description || '-',
    })));
    utils.book_append_sheet(wb, ws7, 'Supervisor Expenses');
  }

  // If no sheets were added, add an empty sheet to avoid corrupted workbook
  if (wb.SheetNames.length === 0) {
    const wsEmpty = utils.aoa_to_sheet([['No data recorded for this category']]);
    utils.book_append_sheet(wb, wsEmpty, 'Empty');
  }

  return write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// -------------------------------------------------------------
// Specialized Generator: Individual Investor Personal Statement
// -------------------------------------------------------------
export function generateInvestorStatementBuffer(party: any, transactions: any[], locationName: string = 'All Locations') {
  const wb = utils.book_new();

  let totalContributed = 0;
  let totalInvestedKarya = 0;
  let totalUpad = 0;

  transactions.forEach((tx: any) => {
    const amt = Number(tx.amount || 0);
    if (tx.type === 'CONTRIBUTION') totalContributed += amt;
    else if (tx.type === 'INVESTMENT') totalInvestedKarya += amt;
    else if (tx.type === 'UPAD' || tx.type === 'PAYMENT') totalUpad += amt;
  });

  const availableBalance = Math.round((totalContributed - totalInvestedKarya - totalUpad) * 100) / 100;

  const headerData = [
    ['BINA ENTERPRISE - INDIVIDUAL INVESTOR PERSONAL FILE / PASSBOOK'],
    ['Investor Name:', party.partyName],
    ['Project Location:', locationName],
    ['Statement Date:', new Date().toLocaleDateString()],
    [],
    ['FINANCIAL SUMMARY STATEMENT'],
    ['1. Total Capital Contributed (IN):', totalContributed],
    ['2. Project Investment Karya (OUT):', totalInvestedKarya],
    ['3. Investor Upad / Payouts (OUT):', totalUpad],
    ['4. Net Available Investor Balance:', availableBalance],
    [],
    ['TRANSACTION PASSBOOK LEDGER'],
  ];

  const ws = utils.aoa_to_sheet(headerData);

  // Compute running balance chronologically
  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let running = 0;

  const tableRows = sortedTxs.map((tx: any) => {
    const amt = Number(tx.amount || 0);
    let typeLabel = tx.type;
    let inAmt = 0;
    let outAmt = 0;

    if (tx.type === 'CONTRIBUTION') {
      typeLabel = 'Capital Contributed (જમા)';
      inAmt = amt;
      running += amt;
    } else if (tx.type === 'INVESTMENT') {
      typeLabel = 'Investment Karya Deployed (પ્રોજેક્ટ રોકાણ)';
      outAmt = amt;
      running -= amt;
    } else if (tx.type === 'UPAD' || tx.type === 'PAYMENT') {
      typeLabel = 'Investor Upad / Payment (ઉપાડ)';
      outAmt = amt;
      running -= amt;
    }

    return {
      'Date': tx.date,
      'Transaction Type': typeLabel,
      'Capital In (+)': inAmt > 0 ? inAmt : '',
      'Withdrawal / Deployed (-)': outAmt > 0 ? outAmt : '',
      'Running Balance (₹)': running,
      'Payment Method': tx.paymentMethod || '-',
      'Reference No': tx.referenceNumber || '-',
      'Description / Purpose': tx.description || '-'
    };
  });

  utils.sheet_add_json(ws, tableRows, { origin: 'A13' });
  utils.book_append_sheet(wb, ws, 'Investor Statement');

  return write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// -------------------------------------------------------------
// Specialized Generator: Vendor Material Purchases Bill
// -------------------------------------------------------------
export function generateVendorPurchasesBuffer(vendorName: string, purchases: any[], locationName: string = 'All Locations') {
  const wb = utils.book_new();

  let totalBilled = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;

  purchases.forEach((p: any) => {
    totalBilled += Number(p.totalAmount || 0);
    totalPaid += Number(p.paidAmount || 0);
    totalOutstanding += Number(p.outstandingAmount || 0);
  });

  const headerData = [
    ['BINA ENTERPRISE - VENDOR PURCHASE STATEMENT'],
    ['Vendor / Supplier Name:', vendorName],
    ['Project Location:', locationName],
    ['Statement Date:', new Date().toLocaleDateString()],
    [],
    ['Total Purchase Billed (₹):', totalBilled],
    ['Total Amount Paid (₹):', totalPaid],
    ['Outstanding Balance Payable (₹):', totalOutstanding],
    [],
    ['PURCHASE BILL INVOICE DETAILS'],
  ];

  const ws = utils.aoa_to_sheet(headerData);

  const tableRows = purchases.map((p: any) => ({
    'Date': p.date,
    'Invoice / Ref No': p.referenceNumber || '-',
    'Material Name': p.materialName,
    'Quantity': Number(p.quantity || 0),
    'Unit': p.unit || 'Unit',
    'Rate (₹)': Number(p.rate || 0),
    'Subtotal (₹)': Number(p.subtotal || (Number(p.quantity || 0) * Number(p.rate || 0))),
    'Transport Cost (₹)': Number(p.transportCost || 0),
    'Discount (₹)': Number(p.discount || 0),
    'Tax / GST (₹)': Number(p.tax || 0),
    'Total Amount (₹)': Number(p.totalAmount || 0),
    'Paid Amount (₹)': Number(p.paidAmount || 0),
    'Outstanding (₹)': Number(p.outstandingAmount || 0),
    'Payment Status': p.paymentStatus,
    'Payment Method': p.paymentMethod || '-',
    'Notes': p.notes || ''
  }));

  utils.sheet_add_json(ws, tableRows, { origin: 'A11' });
  utils.book_append_sheet(wb, ws, 'Vendor Purchases');

  return write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// -------------------------------------------------------------
// Specialized Generator: Customer Material Supplies Bill
// -------------------------------------------------------------
export function generateCustomerSuppliesBuffer(customerName: string, supplies: any[], locationName: string = 'All Locations') {
  const wb = utils.book_new();

  let totalBilled = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;

  supplies.forEach((s: any) => {
    totalBilled += Number(s.totalAmount || 0);
    totalPaid += Number(s.paidAmount || 0);
    totalOutstanding += Number(s.outstandingAmount || 0);
  });

  const headerData = [
    ['BINA ENTERPRISE - CUSTOMER MATERIAL SUPPLY STATEMENT / BILL'],
    ['Customer / Party Name:', customerName],
    ['Project Location:', locationName],
    ['Statement Date:', new Date().toLocaleDateString()],
    [],
    ['Total Material Billed (₹):', totalBilled],
    ['Total Amount Received (₹):', totalPaid],
    ['Outstanding Receivable (₹):', totalOutstanding],
    [],
    ['MATERIAL SUPPLY INVOICE DETAILS'],
  ];

  const ws = utils.aoa_to_sheet(headerData);

  const tableRows = supplies.map((s: any) => ({
    'Date': s.date,
    'Challan / Bill No': s.referenceNumber || '-',
    'Material Supplied': s.materialName,
    'Quantity': Number(s.quantity || 0),
    'Unit': s.unit || 'Unit',
    'Rate (₹)': Number(s.rate || 0),
    'Subtotal (₹)': Number(s.subtotal || (Number(s.quantity || 0) * Number(s.rate || 0))),
    'Transport Cost (₹)': Number(s.transportCost || 0),
    'Discount (₹)': Number(s.discount || 0),
    'Tax / GST (₹)': Number(s.tax || 0),
    'Total Amount (₹)': Number(s.totalAmount || 0),
    'Received Amount (₹)': Number(s.paidAmount || 0),
    'Pending Balance (₹)': Number(s.outstandingAmount || 0),
    'Payment Status': s.paymentStatus,
    'Payment Method': s.paymentMethod || '-',
    'Notes': s.notes || ''
  }));

  utils.sheet_add_json(ws, tableRows, { origin: 'A11' });
  utils.book_append_sheet(wb, ws, 'Customer Supplies');

  return write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// -------------------------------------------------------------
// Specialized Generator: Refundable Records & Security Deposits
// -------------------------------------------------------------
export function generateRefundableRecordsBuffer(recordsList: any[], locationName: string = 'All Locations') {
  const wb = utils.book_new();

  let totalDisbursed = 0;
  let totalRefunded = 0;

  recordsList.forEach((r: any) => {
    totalDisbursed += Number(r.refundableAmount || r.amount || 0);
    totalRefunded += Number(r.refundedAmount || 0);
  });

  const pendingRefundable = Math.max(0, Math.round((totalDisbursed - totalRefunded) * 100) / 100);

  const headerData = [
    ['BINA ENTERPRISE - REFUNDABLE RECORDS & SECURITY DEPOSITS AUDIT'],
    ['Location / Project:', locationName],
    ['Audit Date:', new Date().toLocaleDateString()],
    [],
    ['Total Refundable Outflow (₹):', totalDisbursed],
    ['Total Received Back (₹):', totalRefunded],
    ['Total Pending Receivable / લેવાના બાકી (₹):', pendingRefundable],
    ['Total Records Count:', recordsList.length],
    [],
    ['DETAILED REFUNDABLE RECORDS REGISTER'],
  ];

  const ws = utils.aoa_to_sheet(headerData);

  const tableRows = recordsList.map((r: any) => {
    const orig = Number(r.refundableAmount || r.amount || 0);
    const refd = Number(r.refundedAmount || 0);
    const pend = Math.max(0, orig - refd);

    return {
      'Date': r.date,
      'Location / Site': r.locationName || locationName,
      'Party / Company Name': r.partyName,
      'Deposit Type / Purpose': r.description || 'Security Deposit',
      'Total Deposit (₹)': orig,
      'Received Back (₹)': refd,
      'Pending Balance (₹)': pend,
      'Refund Status': r.refundStatus || 'PENDING',
      'Payment Method': r.paymentMethod || '-',
      'Reference / Cheque No': r.referenceNumber || '-',
      'Notes': r.notes || ''
    };
  });

  utils.sheet_add_json(ws, tableRows, { origin: 'A11' });
  utils.book_append_sheet(wb, ws, 'Refundable Records');

  return write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// -------------------------------------------------------------
// Specialized Generator: Category 5 Site Material Supplies Register (With GST)
// -------------------------------------------------------------
export function generateSiteSuppliesBuffer(siteSuppliesList: any[], locationName: string = 'All Locations') {
  const wb = utils.book_new();

  let totalTaxable = 0;
  let totalGst = 0;
  let totalGrand = 0;
  let totalUnits = 0;

  const rows: any[] = [];

  siteSuppliesList.forEach((s: any) => {
    const supplyTotal = Number(s.totalAmount || 0);
    const subtotal = Number(s.subtotal || s.totalAmount || 0);
    const tax = Number(s.taxAmount || 0);

    totalTaxable += subtotal;
    totalGst += tax;
    totalGrand += supplyTotal;

    const items = Array.isArray(s.items) && s.items.length > 0 ? s.items : [
      {
        materialName: s.materialName || 'Materials',
        quantity: s.quantity || 1,
        unit: s.unit || 'Nos',
        rate: s.rate || subtotal,
        subtotal: subtotal,
        taxPercentage: s.taxPercentage || 0,
        taxAmount: tax,
        totalWithGst: supplyTotal
      }
    ];

    items.forEach((item: any, idx: number) => {
      const qty = Number(item.quantity || 0);
      totalUnits += qty;
      const rate = Number(item.rate || 0);
      const itemSubtotal = Number(item.subtotal || (qty * rate) || 0);
      const taxRate = Number(item.taxPercentage || (subtotal > 0 ? Math.round((tax / subtotal) * 100) : 0));
      const itemTax = Number(item.taxAmount || item.itemTax || (itemSubtotal * (taxRate / 100)) || 0);
      const itemTotal = Number(item.totalWithGst || item.itemTotal || (itemSubtotal + itemTax) || 0);

      rows.push({
        'Date': s.date || '-',
        'Site / Location': s.locationName || locationName,
        'Labour Team / Contractor': s.teamName || '-',
        'Responsible Person': s.responsiblePerson || '-',
        'Challan / Ref No': s.referenceNumber || '-',
        'Item #': idx + 1,
        'Material Name': item.materialName || s.materialName || 'Material',
        'Quantity': qty,
        'Unit': item.unit || 'Nos',
        'Rate (₹)': rate,
        'Taxable Subtotal (₹)': Math.round(itemSubtotal * 100) / 100,
        'GST Rate (%)': taxRate,
        'GST Tax (₹)': Math.round(itemTax * 100) / 100,
        'Total with GST (₹)': Math.round(itemTotal * 100) / 100,
        'Work Scope / Notes': s.displayNotes || s.workDescription || s.notes || '-'
      });
    });
  });

  const headerData = [
    ['BINA ENTERPRISE - CATEGORY 5: SITE MATERIAL SUPPLY REGISTER (WITH GST)'],
    ['Project Location:', locationName],
    ['Export Date:', new Date().toLocaleDateString()],
    [],
    ['Total Supply Records:', siteSuppliesList.length],
    ['Total Units Dispatched:', totalUnits],
    ['Total Taxable Base Amount (₹):', Math.round(totalTaxable * 100) / 100],
    ['Total GST Tax Amount (₹):', Math.round(totalGst * 100) / 100],
    ['Grand Total Supply Value (₹):', Math.round(totalGrand * 100) / 100],
    [],
    ['ITEMIZED SITE MATERIAL DISPATCHES & GST DETAILS'],
  ];

  const ws = utils.aoa_to_sheet(headerData);
  utils.sheet_add_json(ws, rows, { origin: 'A12' });
  utils.book_append_sheet(wb, ws, 'Site Supplies');

  return write(wb, { type: 'buffer', bookType: 'xlsx' });
}

