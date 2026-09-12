import { utils, write } from 'xlsx';

export function generateExcelBuffer(locationName: string, records: any[], metrics: any) {
  // Format the data for Excel
  const formattedRecords = records.map(record => ({
    'Date': record.date,
    'Type': record.type,
    'Amount': Number(record.amount),
    'Party Name': record.partyName,
    'Category': record.category || '-',
    'Description': record.description || '-',
    'Created At': new Date(record.createdAt).toLocaleString(),
  }));

  // Create a new workbook
  const wb = utils.book_new();

  // Create Summary Sheet
  const summaryData = [
    ['Hisab-Kitab Summary'],
    ['Location:', locationName],
    ['Generated On:', new Date().toLocaleString()],
    [],
    ['Total Income:', Number(metrics.totalIncome)],
    ['Total Expense:', Number(metrics.totalExpense)],
    ['Net Balance:', Number(metrics.netBalance)],
  ];
  const wsSummary = utils.aoa_to_sheet(summaryData);
  
  // Format summary column widths
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 30 }];
  utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Create Records Sheet
  const wsRecords = utils.json_to_sheet(formattedRecords);
  
  // Format records column widths
  wsRecords['!cols'] = [
    { wch: 12 }, // Date
    { wch: 10 }, // Type
    { wch: 15 }, // Amount
    { wch: 25 }, // Party
    { wch: 20 }, // Category
    { wch: 30 }, // Description
    { wch: 20 }, // Created At
  ];
  utils.book_append_sheet(wb, wsRecords, 'All Records');

  // Generate buffer
  return write(wb, { type: 'buffer', bookType: 'xlsx' });
}
