# B-J DESAI ACCOUNTING APPLICATION
## PRODUCTION DEPLOYMENT CHECKLIST

- [ ] **Google Sheet Master Database Created**
  - [ ] Spreadsheet named `B-J Desai Master Accounting Database`
  - [ ] Spreadsheet ID copied from URL

- [ ] **Google Apps Script Backend Deployed**
  - [ ] Apps Script project created under Extensions → Apps Script
  - [ ] Code files copied (`Code.gs`, `Config.gs`, `Utils.gs`, `Sheets.gs`, `Validation.gs`, `Audit.gs`, `Auth.gs`, `Capital.gs`, `Investor.gs`, `Location.gs`, `Material.gs`, `Supply.gs`, `Labour.gs`, `Contractor.gs`, `Reports.gs`, `Backup.gs`, `Api.gs`)
  - [ ] Executed `setupDatabaseTables()` function
  - [ ] All 18 database sheets initialized with headers (`Settings`, `Users`, `Investors`, `Locations`, `AdminCapital`, `InvestorCapital`, `InvestmentCapital`, `CapitalTransactions`, `MaterialPurchases`, `MaterialStock`, `CustomerSupply`, `SiteSupply`, `LabourAttendance`, `ContractorCost`, `SupervisorCost`, `Transactions`, `AuditLog`, `SyncMeta`)

- [ ] **Web App Deployment & Permissions**
  - [ ] Deployed as Web App
  - [ ] Execute as: `Me`
  - [ ] Who has access: `Anyone`
  - [ ] Production Web App URL copied

- [ ] **Google Drive Backup System**
  - [ ] Backup folder `B-J DESAI BACKUPS` created in Google Drive
  - [ ] Manual test execution of `scheduledDailyBackup()` passed
  - [ ] Time-driven daily trigger configured in Apps Script Triggers

- [ ] **Financial & Business Logic Verification**
  - [ ] Admin Capital contribution test passed
  - [ ] Admin Capital -> Investor Capital atomic transfer test passed
  - [ ] Investor Capital -> Investment Capital atomic transfer test passed
  - [ ] Server-side balance overdraw prevention test passed
  - [ ] Material Purchase deduction from Admin Capital test passed
  - [ ] Material Stock ledger auto-calculation test passed
  - [ ] Customer Supply & Site Supply separate rate test passed
  - [ ] Labour attendance & work-wise salary calculation test passed
  - [ ] Contractor cost deduction & net payment test passed

- [ ] **Security & Audit Safety**
  - [ ] `requestId` duplicate submission protection test passed
  - [ ] Security PIN lock verification test passed (`190190`)
  - [ ] AuditLog recording every financial write verified

- [ ] **GitHub Pages Deployment**
  - [ ] GitHub repository created and codebase pushed
  - [ ] Repository secret `VITE_API_URL` set to Web App URL
  - [ ] GitHub Pages source set to `GitHub Actions`
  - [ ] Automated build & deployment workflow passed (`npm run build` & `npm run lint`)

- [ ] **Cross-Device & Multi-User Verification**
  - [ ] Responsive layout verified on Mobile (Android & iPhone viewports)
  - [ ] Responsive layout verified on Tablet, Laptop, Desktop
  - [ ] Multi-device real-time sync verified between phone and laptop
