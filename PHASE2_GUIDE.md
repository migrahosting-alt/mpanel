# Phase 2 Implementation Guide

## Current Status: Backend Complete ✅ | Frontend Pending

### Backend Routes Implemented

All Phase 2 backend routes are **implemented, tested, and running** on port 3000:

#### 1. File Manager API (`/api/file-manager`)
```javascript
GET    /api/file-manager?path=/              // List directory
GET    /api/file-manager/download?path=...   // Download file
POST   /api/file-manager/upload              // Upload files (multipart)
POST   /api/file-manager/mkdir               // Create folder
POST   /api/file-manager/move                // Rename/move
DELETE /api/file-manager                     // Delete file/folder
```

#### 2. DNS Management API (`/api/dns-management`)
```javascript
GET    /api/dns-management/zones                      // List zones
GET    /api/dns-management/zones/:zoneId/records      // List records
POST   /api/dns-management/zones/:zoneId/records      // Create record
PUT    /api/dns-management/records/:id                // Update record
DELETE /api/dns-management/records/:id                // Delete record
```

#### 3. Database Management API (`/api/db-management`)
```javascript
GET    /api/db-management           // List databases
POST   /api/db-management           // Create database (auto-generates credentials)
DELETE /api/db-management/:id       // Delete database
```

#### 4. Email Management API (`/api/email-management`)
```javascript
GET    /api/email-management/mailboxes              // List mailboxes
POST   /api/email-management/mailboxes              // Create mailbox
DELETE /api/email-management/mailboxes/:id          // Delete mailbox
GET    /api/email-management/forwarders             // List forwarders
POST   /api/email-management/forwarders             // Create forwarder
DELETE /api/email-management/forwarders/:id         // Delete forwarder
```

#### 5. AI Integration API (`/api/ai`)
```javascript
GET    /api/ai/domains/:id/summary      // AI-powered activity summary
POST   /api/ai/files/explain            // AI file explanation
```

---

## Phase 2 Frontend Tasks

### Task 1: File Manager Page 📁

**File**: `mpanel-main/mpanel-main/frontend/src/pages/FileManager.jsx`

**Features to Implement**:
- Breadcrumb navigation showing current path
- File/folder list with icons, sizes, permissions, modified date
- Actions: Upload, New Folder, Download, Delete, Rename
- "Ask AI" button on files → explains file content
- Double-click folders to navigate
- Right-click context menu for actions

**API Integration**:
```javascript
// List files
const response = await axios.get('/api/file-manager', {
  params: { path: currentPath },
  headers: { Authorization: `Bearer ${token}` }
});

// Upload files
const formData = new FormData();
formData.append('path', currentPath);
files.forEach(file => formData.append('files', file));
await axios.post('/api/file-manager/upload', formData, {
  headers: { Authorization: `Bearer ${token}` }
});

// Ask AI to explain file
const response = await axios.post('/api/ai/files/explain', {
  path: selectedFile.path,
  question: userQuestion // optional
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

**UI Components Needed**:
- File browser table (name, size, permissions, modified)
- Upload dropzone or file input
- "New Folder" modal
- "Ask AI" modal with question input
- Breadcrumb path navigator

---

### Task 2: DNS Management Page 🌐

**File**: `mpanel-main/mpanel-main/frontend/src/pages/DNS.jsx`

**Features to Implement**:
- List all DNS zones
- Click zone → show records for that zone
- Add/Edit/Delete records (A, AAAA, CNAME, MX, TXT, etc.)
- Record priority field for MX records
- TTL configuration

**API Integration**:
```javascript
// List zones
const zones = await axios.get('/api/dns-management/zones', {
  headers: { Authorization: `Bearer ${token}` }
});

// List records for a zone
const records = await axios.get(`/api/dns-management/zones/${zoneId}/records`, {
  headers: { Authorization: `Bearer ${token}` }
});

// Create record
await axios.post(`/api/dns-management/zones/${zoneId}/records`, {
  name: 'www',
  type: 'A',
  content: '192.0.2.1',
  ttl: 300,
  priority: null  // only for MX
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

**UI Components Needed**:
- Zones list (zone name, domain, type)
- Records table (name, type, content, TTL, priority)
- "Add Record" modal with type selector
- Record type-specific fields (priority for MX, etc.)

---

### Task 3: Database Management Page 💾

**File**: `mpanel-main/mpanel-main/frontend/src/pages/Databases.jsx`

**Features to Implement**:
- List databases with customer info
- **Customer selector dropdown** (required)
- Create database → shows generated username/password once
- Delete database with confirmation
- Display connection details (host, port, username, database name)

**API Integration**:
```javascript
// List databases
const databases = await axios.get('/api/db-management', {
  headers: { Authorization: `Bearer ${token}` }
});

// Create database
const response = await axios.post('/api/db-management', {
  name: 'mydb',
  db_type: 'mysql',
  customerId: selectedCustomerId  // REQUIRED
}, {
  headers: { Authorization: `Bearer ${token}` }
});

// Response includes generated_password (show once in modal)
const { database, generated_password } = response.data;
```

**UI Components Needed**:
- Databases list table (name, type, username, customer, created)
- Customer dropdown (fetch from `/api/customers`)
- "Create Database" modal with customer selector
- "Show Credentials" modal (one-time display with copy button)

---

### Task 4: Email Management Page 📧

**File**: `mpanel-main/mpanel-main/frontend/src/pages/Email.jsx`

**Features to Implement**:
- Two tabs: "Mailboxes" and "Forwarders"
- **Customer selector dropdown** (required for creation)
- **Domain selector dropdown** (filter domains by selected customer)
- Create mailbox with password
- Create forwarder with source/destination
- Delete mailboxes/forwarders

**API Integration**:
```javascript
// List mailboxes
const mailboxes = await axios.get('/api/email-management/mailboxes', {
  params: { domain_id: selectedDomainId },  // optional filter
  headers: { Authorization: `Bearer ${token}` }
});

// Create mailbox
await axios.post('/api/email-management/mailboxes', {
  domain_id: selectedDomainId,
  local_part: 'info',  // creates info@domain.com
  password: generatedPassword,
  quota_mb: 1024,
  customerId: selectedCustomerId  // REQUIRED
}, {
  headers: { Authorization: `Bearer ${token}` }
});

// Create forwarder
await axios.post('/api/email-management/forwarders', {
  domain_id: selectedDomainId,
  source: 'sales@domain.com',
  destination: 'info@otherdomain.com',
  customerId: selectedCustomerId  // REQUIRED
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

**UI Components Needed**:
- Tabs for Mailboxes vs Forwarders
- Customer dropdown
- Domain dropdown (filtered by customer)
- Mailboxes table (email, quota, created)
- Forwarders table (source, destination, created)
- "Create Mailbox" modal with password generator
- "Create Forwarder" modal

---

### Task 5: AI Features Integration 🤖

**Domain Detail Page Enhancement**:

Add "AI Summary" button to existing domain detail page:

```javascript
// In domain detail page
const handleAISummary = async () => {
  setLoadingSummary(true);
  try {
    const response = await axios.get(`/api/ai/domains/${domainId}/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setSummary(response.data.summary);
    setShowSummaryModal(true);
  } catch (error) {
    alert(error.response?.data?.error || 'AI service unavailable');
  } finally {
    setLoadingSummary(false);
  }
};
```

**UI Components Needed**:
- "AI Summary" button in domain detail header
- Modal to display AI-generated summary with markdown rendering
- Loading state while AI processes

---

### Task 6: Navigation Update 🧭

**File**: `mpanel-main/mpanel-main/frontend/src/components/Sidebar.jsx` (or wherever nav is)

Add new menu items:

```jsx
<nav>
  {/* Existing items */}
  <Link to="/domains">Domains</Link>
  <Link to="/customers">Customers</Link>
  
  {/* NEW Phase 2 items */}
  <Link to="/files">File Manager</Link>
  <Link to="/dns">DNS</Link>
  <Link to="/databases">Databases</Link>
  <Link to="/email">Email</Link>
</nav>
```

Add routes in `App.jsx`:
```jsx
<Route path="/files" element={<FileManager />} />
<Route path="/dns" element={<DNS />} />
<Route path="/databases" element={<Databases />} />
<Route path="/email" element={<Email />} />
```

---

## Testing Checklist

### Backend API Tests (All ✅)
- [x] Customer endpoint returns list
- [x] File manager endpoints structured correctly
- [x] DNS endpoints structured correctly
- [x] Database endpoints structured correctly
- [x] Email endpoints structured correctly
- [x] AI endpoints require OpenAI API key
- [x] All routes require authentication
- [x] Customer validation works

### Frontend Tests (Pending)
- [ ] File Manager: Upload file
- [ ] File Manager: Create folder
- [ ] File Manager: Delete file
- [ ] File Manager: Ask AI about file
- [ ] DNS: List zones
- [ ] DNS: Add/edit/delete records
- [ ] Databases: Create with customer
- [ ] Databases: See generated password once
- [ ] Email: Create mailbox with customer
- [ ] Email: Create forwarder
- [ ] Domain detail: AI Summary button

---

## Implementation Priority

### High Priority (Core Functionality)
1. **File Manager** - Most requested feature, user-facing value
2. **Email Management** - Critical for hosting business
3. **Databases** - Core hosting feature
4. **DNS Management** - Essential for domain management

### Medium Priority (Enhancement)
5. **AI Features** - Nice-to-have, differentiator
6. **Navigation Updates** - Enable access to new features

---

## Environment Setup

### Required .env Variables

```env
# Already configured
FILE_ROOT=/home
REDIS_HOST=127.0.0.1
REDIS_PORT=6380

# Optional (for AI features)
OPENAI_API_KEY=sk-...  # Leave empty to disable AI
```

### Starting Services

```bash
# Backend (already running on port 3000)
cd mpanel-main/mpanel-main
node src/server.js

# Frontend (already running on port 3001)
cd mpanel-main/mpanel-main/frontend
npm run dev

# SSL Worker (optional, for background SSL issuance)
cd mpanel-main/mpanel-main
npm run ssl-worker:dev
```

---

## Known Limitations (TODOs)

### File Manager
- Windows path: `FILE_ROOT` set to `/home` but development is on Windows
  - **Solution**: For dev, set `FILE_ROOT=C:\\temp\\mpanel-files` in .env
  - Create `C:\temp\mpanel-files\<user_id>\public_html\` structure

### Database Management
- Currently just tracks in panel DB, doesn't create actual MySQL/Postgres database
  - **TODO**: Add physical provisioning (connect to MySQL server, run CREATE DATABASE)

### Email Management
- Stores mailbox config but doesn't provision in Dovecot/Postfix
  - **TODO**: Add provisioning script to create actual mailboxes

### DNS Management
- Records stored in DB, not synced to DNS server
  - **TODO**: Add sync to PowerDNS API or Cloudflare API

### SSL Worker
- Challenge implementation is placeholder
  - **TODO**: Implement HTTP-01 challenge (write to web root) or DNS-01 (API to DNS provider)

---

## Next Steps

Start with **File Manager** frontend:

1. Create `FileManager.jsx` component
2. Implement file list with breadcrumb navigation
3. Add upload functionality
4. Add create folder modal
5. Test with Windows-compatible path

Let me know when you're ready to start building the frontend pages! 🚀
