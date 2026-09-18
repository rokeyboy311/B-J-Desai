# Changelog AI

### Production Alignment & Gap Resolution
- **Labour Management Refactoring**:
  - Re-architected `labour.routes.ts` with strict TypeScript typing, Work-wise unit/rate calculation, and individual audit logging.
  - Enhanced `LabourAttendanceTab.tsx` with work description, unit dropdown, quantity, rate calculation, and full record editing/deletion.
  - Replaced legacy `TC` wording across all components and navigation bars with `Work-wise`.
- **Investor & Investment Structure**:
  - Added Initial Amount and Initial Date support to Investor creation workflow.
  - Provided full CRUD across Investor entities and transaction ledgers.
  - Enforced 3-part layout on `InvestmentTab.tsx` (Part 1: From Investors, Part 2: From Bills, Part 3: Combined) with visible navigation tabs and independent bill income tracking.
- **Stock & Inventory**:
  - Configured live stock inventory summaries derived directly from `stock_ledger` movements.
  - Added `/reports/stock` API endpoint for real-time inventory ledger retrieval.
  - Ensured transactional reversal of inventory movements upon edit and delete operations in both Material Supply and Site Supply modules.
- **Housekeeping & Clean-Up**:
  - Removed all obsolete `fix_*.cjs`, `patch_*.cjs`, and temporary diagnostic scripts.
  - Updated architectural audit and status documentation (`PROJECT_AUDIT.md`, `IMPLEMENTATION_STATUS.md`, `CLEANUP_LOG.md`).
