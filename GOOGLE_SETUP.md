# B-J DESAI ACCOUNTING APPLICATION
## ₹0 LIVE HOSTING + GOOGLE SHEETS DATABASE + GOOGLE DRIVE BACKUP SETUP GUIDE

This document provides a step-by-step guide to deploying the B-J Desai Accounting Application on a **₹0-cost production infrastructure** using:
1. **GitHub Pages** for frontend hosting
2. **Google Apps Script Web App** as the serverless API layer
3. **Google Sheets** as the live primary database
4. **Google Drive** for automated daily/weekly/monthly backups

---

### STEP 1: CREATE GOOGLE SPREADSHEET (DATABASE)
1. Log in to your Google Account.
2. Go to [Google Sheets](https://sheets.google.com) and click **Blank Spreadsheet**.
3. Name the spreadsheet: `B-J Desai Master Accounting Database`.
4. Copy the **Spreadsheet ID** from the browser URL:
   `https://docs.google.com/spreadsheets/d/`**`1ABC123xyz...`**`/edit`

---

### STEP 2: SETUP GOOGLE APPS SCRIPT BACKEND
1. Inside your Google Sheet, click **Extensions → Apps Script**.
2. Rename the project to `B-J Desai Accounting API`.
3. In the left sidebar, add the following `.gs` files (copy contents from the `/apps-script` directory in this codebase):
   - `Code.gs`
   - `Config.gs`
   - `Utils.gs`
   - `Sheets.gs`
   - `Validation.gs`
   - `Audit.gs`
   - `Auth.gs`
   - `Capital.gs`
   - `Investor.gs`
   - `Location.gs`
   - `Material.gs`
   - `Supply.gs`
   - `Labour.gs`
   - `Contractor.gs`
   - `Reports.gs`
   - `Backup.gs`
   - `Api.gs`
4. In `Config.gs`, paste your `SPREADSHEET_ID` inside quotes if running standalone:
   ```js
   SPREADSHEET_ID: "1ABC123xyz...",
   ```
5. In the toolbar, select `setupDatabaseTables` from the function dropdown and click **Run**.
6. Grant the requested Google permissions. This automatically creates all 18 structured database tables in your spreadsheet with frozen header rows!

---

### STEP 3: DEPLOY AS WEB APP (API ENDPOINT)
1. At the top right of Apps Script Editor, click **Deploy → New Deployment**.
2. Click the gear icon next to "Select type" and choose **Web App**.
3. Configure settings:
   - **Description**: `B-J Desai Production API v1.0.0`
   - **Execute as**: `Me` (your Google Account)
   - **Who has access**: `Anyone` (Required for Web App calls from GitHub Pages)
4. Click **Deploy**.
5. Copy the generated **Web App URL** (e.g. `https://script.google.com/macros/s/AKfycbx.../exec`).

---

### STEP 4: CONFIGURE AUTOMATIC GOOGLE DRIVE BACKUPS
1. Go to [Google Drive](https://drive.google.com) and create a folder named `B-J DESAI BACKUPS`.
2. Inside Apps Script Editor, select `scheduledDailyBackup` from the function dropdown and click **Run** to test.
3. To automate daily backups:
   - Click the **Triggers (clock icon)** in the left sidebar of Apps Script.
   - Click **Add Trigger**.
   - Choose function: `scheduledDailyBackup`.
   - Event source: `Time-driven`.
   - Type: `Day timer` (e.g., Midnight to 1 AM).
   - Click **Save**.

---

### STEP 5: DEPLOY FRONTEND TO GITHUB PAGES
1. Push this codebase to your GitHub Repository.
2. Go to your repository **Settings → Secrets and variables → Actions**.
3. Add a New Repository Secret:
   - **Name**: `VITE_API_URL`
   - **Value**: Your Google Apps Script Web App URL from Step 3.
4. Go to repository **Settings → Pages**:
   - **Source**: `GitHub Actions`
5. Push a commit to `main` or trigger the workflow under **Actions → Deploy B-J Desai Web Application to GitHub Pages**.
6. Once completed, your app is live at `https://<your-github-username>.github.io/<repo-name>/`!

---

### STEP 6: VERIFY MULTI-DEVICE SYNC & RESTORE
1. Open the website on your phone and laptop.
2. Enter a test Investor Capital transfer.
3. Check your Google Sheet — the record appears instantly!
4. Refresh your phone — data is synchronized.
5. In the app settings, click **Backup Now** to save a JSON snapshot to Google Drive.
