# mPanel – Users Module Specification (`/admin/users`)

This document describes how the **Users** section in mPanel must behave,
so Copilot can implement it consistently.

---

## 1. Route & Component

Route path: **`/admin/users`**

Component location (example paths, adjust to real structure):

- `src/pages/admin/UsersPage.tsx`  
  or  
- `src/features/users/UsersPage.tsx`

The component is rendered inside the main `AdminLayout` with breadcrumb
“Administration / Users”.

---

## 2. Required API Endpoints

The frontend expects these backend endpoints:

1. `GET /api/admin/users`
   - Query params:
     - `limit` (optional, default 50)
     - `offset` (optional, default 0)
   - Response 200:
     ```json
     {
       "items": [
         {
           "id": "user_1",
           "name": "Admin User",
           "email": "admin@migrahosting.com",
           "roles": ["super_admin"],
           "status": "active",
           "createdAt": "2025-11-01T12:00:00.000Z"
         }
       ],
       "total": 1
     }
     ```

2. `POST /api/admin/users`
   - Body:
     ```json
     {
       "name": "New User",
       "email": "new@example.com",
       "password": "Temp123!",
       "roles": ["admin"]
     }
     ```
   - Response: 201 with created user object.

3. `PUT /api/admin/users/:id`
   - Body: partial update (name, email, roles, status).
   - Response: 200 with updated user.

4. `POST /api/admin/users/:id/disable`
   - Body: `{ "reason": "optional" }`
   - Response: 200 with updated user `{ status: "disabled" }`.

Backends MAY initially return static/fake data while DB is being wired,
but shape must follow this contract.

---

## 3. Frontend Types

```ts
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  status: 'active' | 'disabled' | 'invited';
  createdAt: string;
}
```

Central API client:

```ts
// src/lib/apiClient.ts (example)
export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
```

## 4. UsersPage Behavior

### 4.1 Lifecycle

On mount:

```ts
const [state, setState] = useState<{
  loading: boolean;
  error: string | null;
  items: AdminUser[];
  total: number;
}>({ loading: true, error: null, items: [], total: 0 });

useEffect(() => {
  let cancelled = false;
  async function load() {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiGet<{ items: AdminUser[]; total: number }>(
        '/api/admin/users?limit=50&offset=0'
      );
      if (!cancelled) {
        setState({ loading: false, error: null, items: data.items, total: data.total });
      }
    } catch (e: any) {
      if (!cancelled) {
        setState({
          loading: false,
          error: e.message ?? 'Failed to load users',
          items: [],
          total: 0,
        });
      }
    }
  }
  load();
  return () => {
    cancelled = true;
  };
}, []);
```

NEVER render a blank page:

- If loading → show skeleton rows.
- If error → show error box with retry button.
- If `items.length === 0` → show “No users yet” empty state.

### 4.2 UI Layout

The Users page must show:

- Header row:
  - Title: Users
  - Button: `+ Invite User`
- Table with columns:
  - Name
  - Email
  - Roles
  - Status (chip)
  - Created
  - Actions (Edit, Disable)

Each row should be clickable to open a right-side drawer or modal.

### 4.3 Invite User Flow

Clicking `+ Invite User`:

- Opens modal with form:
  - Full name
  - Email
  - Roles (multi-select)
  - Temporary password (optional; can auto-generate)
- On submit:
  - Call `POST /api/admin/users`.
  - On success:
    - Close modal.
    - Show toast “User invited”.
    - Re-fetch list (`GET /api/admin/users`).
  - On error:
    - Show error message inline.

### 4.4 Edit / Disable

For each row:

- Edit opens modal:
  - Fields: name, email, roles, status.
  - On save → `PUT /api/admin/users/:id`.
  - On success → update row or re-fetch list.
- Disable:
  - Confirm dialog:
    - “Disable this user? They will not be able to log in.”
  - On confirm → `POST /api/admin/users/:id/disable`.

All network failures must show toasts, not break the page.

## 5. Handling Missing Backend Gracefully

If `/api/admin/users` returns 404:

Show a full-width card:

> “User management is not yet installed.
> Backend must implement GET /api/admin/users.
> Until then, this page is read-only.”

Do not throw an uncaught error or show a blank screen.

Implementation hint:

```ts
try {
  const data = await apiGet<UsersResponse>('/api/admin/users?limit=50&offset=0');
  setState({ loading: false, error: null, items: data.items, total: data.total });
} catch (err: any) {
  if (err instanceof ApiError && err.status === 404) {
    setState({
      loading: false,
      error: null,
      items: [],
      total: 0,
    });
    setMode('stub'); // render "not installed" view
  } else {
    setState({
      loading: false,
      error: err.message ?? 'Failed to load users',
      items: [],
      total: 0,
    });
  }
}
```

## 6. Copilot: DO / DON’T for Users Module

**DO:**

- Use the central apiClient helpers for all requests.
- Strongly type responses with `AdminUser` and `UsersResponse`.
- Keep CSS / styling consistent with existing mPanel table components.
- Make sure `/admin/users` never produces an uncaught React error.

**DON’T:**

- Don’t introduce new random routes; the path must remain `/admin/users`.
- Don’t re-implement global auth inside UsersPage – just use existing hooks that read authStore / useAuth.
- Don’t block the whole app if `/api/admin/users` fails once; allow retry.

When this module is fixed:

Navigating to `/admin/users` should ALWAYS show something:

- A populated table,
- An empty-state,
- Or a “not installed yet” message –

but never a white screen with console errors.

---

### How to use these with Copilot

1. Drop both files into the repo on mpanel-core:

```bash
cd /opt/mpanel
mkdir -p docs
nano docs/TASKS_BACKEND_TONIGHT.md
# paste file 1, save

nano docs/USERS_MODULE_SPEC.md
# paste file 2, save
```

2. Open `/opt/mpanel` in VS Code.

3. Open the spec file, tell Copilot in a comment:

“Follow docs/USERS_MODULE_SPEC.md and implement /admin/users page + corresponding API calls without breaking existing layout.”

As you go through the backend checklist, if you hit any error (migrate, build, or `/admin/users` still blank), paste the exact command + error and I’ll help you patch it.
