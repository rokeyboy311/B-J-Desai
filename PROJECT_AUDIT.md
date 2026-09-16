# PROJECT AUDIT

## A. Current Architecture
- Full-stack React + Express app running behind Vite development server.
- Database: PostgreSQL (using Drizzle ORM).
- Authentication: Firebase Auth integrated into both frontend (React context) and backend (Express middleware verifying token).
- UI: React, Tailwind CSS, shadcn/ui components (lucide-react icons, motion for animations).
- Routing: React Router DOM on frontend, Express Routers on backend.
- Modularity: Separation of concerns is visible with categories implemented as React components.

## B. Existing Modules
- Dashboard
- Locations
- Global Records (Income/Expense generic records)
- Reports
- Activity Log
- Profile
- Categories:
  - IncomeExpenseTab
  - InvestmentTab
  - InvestorTab
  - LabourAttendanceTab
  - LabourSalaryTab
  - MasterDataTab
  - MaterialPurchaseTab
  - MaterialSupplyTab
  - SiteSupplyTab
  - SupervisorCostTab

## C. Existing Database Structure
- `users`: Core users mapped to Firebase UID.
- `locations`: Physical/Logical separation for records.
- `records`: Generic income/expense records.
- `investmentParties`, `investmentTransactions`: For tracking investments and parties.
- `materials`, `stockLedger`: Core stock and material management.
- `siteSupplies`, `siteSupplyItems`: Internal site supply logic.
- `parties`, `labourTeams`: Master records.
- `labourMaster`, `labourSalaries`: Labour management.
- `materialPurchases`, `materialSupplies`: External supply operations.

## D. Existing APIs
- `/api/auth`: Handles user sync.
- `/api/audit`: Audit logs.
- `/api/investment`: Investment records.
- `/api/labour`: Labour management.
- `/api/locations`: Location management.
- `/api/master`: Master records logic.
- `/api/material`: Material purchase and supply APIs.
- `/api/records`: Global records logic.
- `/api/reports`: Aggregation for dashboard and reports.
- `/api/site-supply`: Site supply APIs.
- `/api/supervisor`: Supervisor APIs.

## E. Existing Reusable Components
- Modal, AppLayout, ProtectedRoute, Icons.

## F. Existing Business Logic
- Multi-location generic CRUD.
- Authentication & JWT token exchange via Firebase.
- Basic CRUD for major entities is present.

## G. Existing Working Functionality
- Login/Auth flow.
- Locations creation/editing/fetching.
- Generic records (Income/Expense).
- Stock integration in Material Purchases (and Material Supply/Site Supply API seems present).

## H. Existing Incomplete Functionality
- Proper linking of Dashboard numbers to actual calculations.
- Clean separation of Investment vs Investor.
- Correct calculations across different tabs according to specific rules.
- Proper work-wise/day-wise separation for labour.
- Supervisor cost separation from total investment.

## I. Existing Errors
- TBD during specific module testing.

## J. Existing Duplicate Files
- Some overlapping in `records` vs specific category tables.

## K. Existing Unused Files
- To be determined.

## L. Existing Dead Code
- To be determined during individual phase implementations.

## M. Existing Conflicting Implementations
- `records` vs `material_purchases`/`material_supplies` may have overlapping concepts if one is a unified ledger and others are specific. The schema has independent tables for material purchases/supplies.

## N. Existing Mock/Demo/Static Data
- Dashboard may contain hardcoded totals or static charts (needs verification).

## O. Existing Security Problems
- TBD, mostly looks solid with Firebase auth.

## P. Existing Calculation Problems
- Need to verify investor balance logic (Contribution - Withdrawal = Balance).
- Need to verify stock calculation (Purchase = In, Supply = Out).

## Q. Existing Stock Problems
- Must ensure atomic or transactional updates for stock when purchase/supply is saved/edited/deleted.

## R. Existing Accounting Problems
- Supervisor Cost must not be in Total Investment.
