# Cleanup Log

## Automated & Manual Cleanup Summary
1. **Removed All Ephemeral Patch and Script Files**:
   - `fix_lab_num.cjs`, `fix_lab_string.cjs`, `fix_labour_routes.cjs`
   - `fix_lint.cjs`, `fix_lint2.cjs`, `fix_lint3.cjs`
   - `fix_master.cjs`, `fix_report.cjs`
   - `patch_handle_bill.cjs`, `patch_master_edit.cjs`, `patch_master_routes.cjs`, `patch_schema.ts`
   - `investment_tab_content.txt`
   - Temporary database test scripts (`test_db.ts`, `test_null.ts`, `test_null_loc.ts`, `test_query.ts`, `test_users.ts`, `test-env.js`, `verify.sql`)

2. **Component Architecture Cleanups**:
   - Removed legacy, deprecated `LabourSalaryTab` in favor of `LabourRecordsTab.tsx` and `LabourAttendanceTab.tsx`.
   - Cleared obsolete TC-related legacy labels across UI and replaced with "Day-wise" and "Work-wise" models.
   - Removed duplicate supply paths and consolidated inventory movement strictly on canonical `stockLedger` and `siteSupplies`.

3. **Production State**:
   - Zero root-level garbage scripts.
   - Clean, standard structure conforming to Vite + Express + Drizzle ORM production standards.
