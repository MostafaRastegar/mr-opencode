---
name: ui-access-control
description: Implement role-based access control in a web UI (Next.js App Router + Django REST Framework, adaptable). Use when adding admin-only pages, gating routes, filtering navigation, hiding actions/columns, or implementing owner-vs-admin permissions.
---

# UI Access Control (RBAC)

Technical pattern for adding role-based access to a Next.js App Router front end backed by DRF.
Backend authorization is the security boundary; UI gating is only UX. Every hidden action must
also be rejected by the API.

## 1. Define the capability model first

Create ONE module that maps roles to capabilities. Do not scatter role checks.

```ts
// lib/auth/capabilities.ts
export type Role = 'admin' | 'operator' | 'viewer';

export const CAPABILITIES = {
  admin:    ['users:manage', 'audit:read', 'content:write', 'content:moderate'],
  operator: ['content:write', 'content:moderate'],
  viewer:   [],
} as const satisfies Record<Role, readonly string[]>;

export type Capability = (typeof CAPABILITIES)[Role][number];

export const hasCapability = (role: Role | undefined, cap: Capability) =>
  Boolean(role && CAPABILITIES[role].includes(cap));
```

Rules:
- Prefer **capabilities** over raw flag checks in the UI (`content:write`, not `is_admin`).
  Map flags to capabilities in one adapter; the rest of the UI never changes when flags change.
- Default deny: unknown/missing role gets no capabilities.
- Document role semantics (e.g. `is_staff` = admin-site login only, `is_superuser` = backend-only)
  so the UI never uses the wrong flag.
- Keep one source of truth shared with the API contract; mirror the same capability names.

## 2. Resolve the session once, server-side

```ts
// app/(dashboard)/layout.tsx  (server component)
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';

export const getCurrentUser = cache(getSessionUser); // deduped per request
```

- Fetch roles from the backend (`/me`), never from a client cookie or a client-supplied value.
- Wrap it in React `cache()` and provide it to client components via context/`useCurrentUser()`.
- Never re-fetch the session inside individual views or read the JWT payload in the browser.
- If the session is invalid, redirect to login; if the session is valid but unauthorized,
  redirect to a dedicated forbidden route.

## 3. Guard routes on the server

Three placements, pick the narrowest that covers the surface:

| Scope | Where | Example |
|---|---|---|
| Whole subtree | `layout.tsx` | `/dashboard/admin/*` |
| Single page | `page.tsx` | `/reports/[id]/edit` |
| Server action / route handler | action or `route.ts` | mutations, proxies |

```ts
// lib/auth/require.ts
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/(dashboard)/layout';

export async function requireCapability(cap: Capability) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasCapability(user.role, cap)) redirect('/forbidden');
  return user;
}
```

Rules:
- Redirect (or return 403) on the server — do not render an empty/loading state for authorization.
- Run the guard before fetching page data on single-page routes.
- Client-side `useEffect` redirects are not a guard; they flash protected content.
- Provide a shared `/forbidden` page (403), distinct from 404 and login.

## 4. Filter navigation from the same capabilities

Build the menu from a single list and filter it by capability; never hand-maintain per-role menus.

```tsx
const items = ALL_NAV_ITEMS.filter((item) =>
  item.capability ? hasCapability(user.role, item.capability) : true,
);
```

- Every route with a server guard must be absent from the menu for unauthorized users.
- Hide whole groups (e.g. an "Admin" section), not just individual links.
- Keep the role label/avatar derived from the same resolved user.

## 5. Gate actions, columns, and controls

In client views:

```tsx
const canManage = hasCapability(user?.role, 'content:write');
```

- **Primary buttons** (Add/Create/Import): render only when allowed.
- **Row actions**: render only allowed icons; do not leave an empty actions cell/column.
- **Columns**: if the whole column is admin-only, omit it from the columns array:
  build columns via a factory `getColumns(canManage)` and spread the column conditionally.
- **Forms**: never render admin-only fields (role, active, owner) on self-service forms;
  edit them only on admin pages.
- Omit the control; do not render a `disabled` button as a substitute for authorization.
- Do **not** disable/hide the only field that makes the action possible and then let the
  request through — the backend still decides.

## 6. Object-level permissions (owner vs admin)

Row-level access is a separate rule from page access.

```ts
const canEdit = (row: T) => isAdmin || row.ownerId === currentUser.id;
```

Checklist:
1. Backend permission implements the exact same predicate (owner OR admin).
2. Payload exposes the owner id needed by the UI.
3. UI hides the trigger when the predicate is false.
4. Test three identities: owner (allowed), other user (denied), admin (allowed).

Never derive ownership on the client from a display name; use a stable id.

## 7. Backend enforcement contract

For every guarded UI action, confirm the API enforces it:

- Read vs write split: safe methods may be open to authenticated users; writes need a capability.
- Object permissions run on detail/update/delete routes, not only on list.
- Return 403 (not 404) for authenticated-but-unauthorized, and 401 for unauthenticated.
- Apply least privilege by default; add exceptions explicitly.
- Avoid trusting roles from request bodies, query params, or client headers.

## 8. Verification matrix

Test each capability boundary, not just the happy path:

| Identity | Expected |
|---|---|
| Unauthenticated | redirect to login |
| Authenticated, no capability | 403/forbidden page, no nav item |
| Authenticated, capability | page renders, actions visible, API 2xx |
| Other authenticated user (object rule) | action hidden, API 403 |
| Owner (object rule) | action visible, API 2xx |
| Admin (object rule) | action visible, API 2xx |

Gates:
```bash
npx tsc --noEmit
npx eslint .
# backend permission tests for role/object changes
python manage.py test <app>.tests.<PermissionTests> --settings=<test_settings>
```

## Anti-patterns (reject)

- UI-only authorization, or a client check without a matching backend rule.
- Using the wrong flag (`is_staff` for API access, `is_superuser` in UI logic).
- Role checks duplicated across components instead of capabilities.
- Per-role menus maintained by hand.
- Rendering disabled controls instead of hiding them.
- Flash of protected content before a client redirect.
- Fetching the session/role repeatedly in views or decoding it client-side.
- An empty Actions column or an empty nav section left for unauthorized users.
- Assuming a hidden button makes the endpoint safe (IDOR).
