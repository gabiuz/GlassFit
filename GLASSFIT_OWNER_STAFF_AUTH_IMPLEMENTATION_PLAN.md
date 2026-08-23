# GlassFit Owner / Staff Authentication & Admin Access Implementation Plan

## 1. Purpose

This plan adds secure authentication and role-based access to the existing GlassFit Admin area.

Current state:

```text
/admin
→ directly opens the Admin dashboard
→ no Admin login UI
→ no Admin route protection
```

Target state:

```text
/admin/login
→ private Admin login
→ Supabase Auth
→ verify GlassFit Admin profile + role
→ /admin dashboard
```

There will be **no public Admin registration page**.

The business Owner is responsible for creating/inviting Staff accounts from inside the protected Admin area.

The Admin login page may visually reuse the normal customer login design, but it must be operationally separate and must not appear anywhere in the customer-facing navigation or registration flow.

---

# 2. Current Database Basis

The current GlassFit schema already supports the identity model required for this feature.

`profiles` represents both customers and administrators.

Important fields:

```text
profile_id
admin_role_id
first_name
last_name
full_name
email
auth_provider
account_type
status
```

Admin identity is represented by:

```text
profiles.account_type = 'Admin'
profiles.admin_role_id = admin_roles.role_id
```

Profile status supports:

```text
Active
Inactive
Suspended
```

`admin_roles` already stores:

```text
role_id
role_name
permissions JSONB
status
```

Current seeded roles include:

```text
Owner
Manager
Staff
```

The current seeded permission model is conceptually:

```text
Owner
- manage_products = true
- manage_pricing = true
- manage_roles = true
- manage_bookings = true

Manager
- manage_products = true
- manage_pricing = true
- manage_roles = false
- manage_bookings = true

Staff
- manage_products = false
- manage_pricing = false
- manage_roles = false
- manage_bookings = true
```

For the first Owner/Staff implementation, GlassFit may expose only:

```text
Owner
Staff
```

in the Admin account-management UI.

The existing Manager role can remain in the database for future use.

Do not delete it simply because it is not currently exposed.

---

# 3. Main Architecture

Use the same Supabase Auth system already used by customers.

Do **not** build another authentication database.

Architecture:

```text
Supabase Auth
      │
      │ auth.users.id
      ▼
public.profiles
      │
      ├── account_type = Admin
      ├── status = Active
      └── admin_role_id
             │
             ▼
       public.admin_roles
             │
             ├── role_name
             ├── permissions
             └── status
```

The Admin UI uses the same Supabase session infrastructure as the rest of GlassFit.

The difference is that `/admin` requires additional authorization checks.

---

# 4. Important Security Principle

The private Admin URL is a usability/privacy feature.

It is **not** the security boundary.

This:

```text
/admin/login
```

not being linked from the customer website does not make `/admin` secure by itself.

Real protection must come from:

```text
Supabase authentication
+
active Admin profile verification
+
active Admin role verification
+
permission checks
+
RLS / server authorization
```

Even if someone manually types:

```text
/admin
```

they must not see protected Admin data without authorization.

---

# 5. Final Route Structure

Recommended Next.js App Router structure:

```text
src/app/admin/
│
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   │
│   ├── forgot-password/
│   │   └── page.tsx
│   │
│   ├── reset-password/
│   │   └── page.tsx
│   │
│   ├── invite/
│   │   └── page.tsx
│   │
│   └── auth/
│       └── callback/
│           └── route.ts
│
└── (protected)/
    ├── layout.tsx
    ├── page.tsx
    ├── products/
    ├── bookings/
    ├── staff/
    └── ...
```

Route groups do not change the URLs.

The public URLs remain:

```text
/admin/login
/admin/forgot-password
/admin/reset-password
/admin/invite

/admin
/admin/products
/admin/bookings
/admin/staff
```

Only the `(protected)` group gets the Admin authorization layout.

---

# 6. Customer UI Must Not Expose Admin Authentication

Do not add:

```text
Admin Login
Staff Login
Admin Portal
```

to:

```text
customer navbar
customer footer
customer login
customer registration
product pages
customer profile
```

Do not create:

```text
/admin/register
```

The normal customer registration flow remains customer-only.

The Admin login URL is known directly by the business Owner/Staff.

---

# 7. Admin Login UI

The Admin login should reuse the visual design of the existing customer login.

Reuse:

```text
logo / branding
card/container style
input design
password field
show/hide password interaction
button styles
validation messages
loading behavior
responsive behavior
```

The Admin page should look like it belongs to the same GlassFit application.

Recommended content:

```text
GlassFit

Admin Portal

Email
[________________]

Password
[________________]

[ Sign In ]

Forgot password?
```

Do not show:

```text
Create account
Register
Continue with Google
Customer signup CTA
```

unless a future requirement explicitly adds them.

For v1, use:

```text
Email + Password
```

for Admin accounts.

This gives the Owner-controlled invitation flow a predictable authentication method.

---

# 8. Admin Login Page Privacy Metadata

Add:

```text
robots: noindex, nofollow
```

to Admin authentication pages.

Do not add Admin routes to:

```text
public sitemap
customer navigation
marketing pages
```

Again, this reduces discoverability but does not replace authorization.

---

# 9. Login Flow

Admin submits:

```text
email
password
```

Frontend calls:

```text
supabase.auth.signInWithPassword(...)
```

After Supabase Auth succeeds:

```text
session user
      ↓
load profiles row
      ↓
verify account_type = Admin
      ↓
verify profile.status = Active
      ↓
load admin_roles
      ↓
verify role.status = Active
      ↓
authorized
      ↓
redirect /admin
```

If any Admin authorization check fails:

```text
do not enter dashboard
```

---

# 10. Login Failure Behavior

Use safe generic messages.

Authentication failure:

```text
Invalid email or password.
```

Do not reveal whether an email exists.

Authenticated but unauthorized account:

```text
This account does not have access to the Admin portal.
```

Suspended account:

```text
Your Admin account is currently unavailable.
Contact the system Owner.
```

Inactive role:

```text
Your Admin access is currently unavailable.
Contact the system Owner.
```

Do not expose database details such as:

```text
admin_role_id null
account_type mismatch
RLS error
```

to the user.

Log technical details server-side when appropriate.

---

# 11. Shared Supabase Session

Admin and customer authentication use the same Supabase Auth session system.

Do not create a second token system.

Use the existing:

```text
Supabase SSR browser client
Supabase SSR server client
session refresh proxy
```

already used by GlassFit.

Extend the existing auth infrastructure rather than duplicating it.

---

# 12. Protecting `/admin`

Protection should happen at multiple levels.

## Layer 1 — Existing Next.js/Supabase proxy

Extend the current session-refresh proxy.

For protected Admin routes:

```text
/admin
/admin/*
```

except:

```text
/admin/login
/admin/forgot-password
/admin/reset-password
/admin/invite
/admin/auth/callback
```

If there is no authenticated Supabase user:

```text
redirect → /admin/login
```

The proxy is primarily an early session/authentication gate.

---

# 13. Layer 2 — Protected Admin Layout

The authoritative UI route check should live in:

```text
/admin/(protected)/layout.tsx
```

Create a server helper:

```text
requireAdmin()
```

Conceptually:

```ts
type AdminContext = {
  userId: string;
  profileId: string;
  fullName: string;
  email: string;

  role: {
    roleId: string;
    roleName: string;
    permissions: Record<string, boolean>;
  };
};
```

`requireAdmin()`:

```text
get authenticated user
↓
load profile + role
↓
verify:
account_type = Admin
profile status = Active
role status = Active
↓
return AdminContext
```

If not valid:

```text
redirect /admin/login
or
show unauthorized page
```

All protected Admin pages inherit this layout.

---

# 14. Layer 3 — Server Mutation Authorization

Page protection alone is insufficient.

Every server action/API endpoint that mutates Admin data must independently verify authorization.

Example:

```text
create product
update product
upload product asset
create structural rule
invite Staff
suspend Staff
update booking request
```

must call an authorization helper.

Never assume:

```text
"the button is hidden, therefore the request is safe"
```

---

# 15. Admin Authorization Helpers

Create reusable server helpers.

Recommended conceptual functions:

```ts
requireAdmin()
requirePermission(permissionKey)
requireOwner()
getAdminContext()
```

Examples:

```ts
await requirePermission("manage_products");
```

```ts
await requirePermission("manage_bookings");
```

```ts
await requirePermission("manage_roles");
```

`requireOwner()` can be used for highly sensitive account-management operations.

---

# 16. Current RLS Permission Gap

The current lean schema has role permissions in:

```text
admin_roles.permissions
```

but many current Admin write RLS policies use only:

```text
public.is_admin()
```

This means the database currently distinguishes:

```text
Admin
vs
Not Admin
```

but does not fully enforce:

```text
Owner permissions
vs
Staff permissions
```

for every catalog table.

This must be addressed before Staff accounts are considered secure.

Example:

Current Staff permissions may say:

```text
manage_products = false
```

but if product RLS only checks:

```text
is_admin()
```

an authenticated Staff account may still satisfy the database's broad Admin write policy.

Therefore Owner/Staff authentication implementation must include permission-level enforcement.

---

# 17. Add Permission Helper to Current Schema

Add a helper based on the existing current-schema structure.

Conceptual SQL:

```sql
create or replace function public.has_admin_permission(
  permission_key text,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.admin_roles r
      on r.role_id = p.admin_role_id
    where p.profile_id = user_id
      and p.account_type = 'Admin'
      and p.status = 'Active'
      and r.status = 'Active'
      and (
        lower(r.role_name) = 'owner'
        or coalesce((r.permissions ->> permission_key)::boolean, false)
      )
  );
$$;
```

Then restrict function access appropriately:

```sql
revoke all
on function public.has_admin_permission(text, uuid)
from public;

grant execute
on function public.has_admin_permission(text, uuid)
to authenticated;
```

Test this migration on the actual current schema before applying it to production.

---

# 18. Permission Mapping

Use the current permission keys consistently.

Recommended mapping:

```text
manage_products
→ products
→ templates
→ parameters
→ components
→ structural rules
→ product assets
→ product variations

manage_pricing
→ pricing-related changes

manage_roles
→ Admin/Staff account management
→ role assignment

manage_bookings
→ booking request operations
```

Owner:

```text
all true
```

Staff currently:

```text
manage_products = false
manage_pricing = false
manage_roles = false
manage_bookings = true
```

Therefore Staff should initially see only operational Admin features relevant to bookings/consultation work.

---

# 19. Update Database Policies for Permissions

Do not rely only on application-side permission checks.

After `has_admin_permission()` is working, update relevant RLS policies.

Examples conceptually:

```text
products write
→ manage_products

product_templates write
→ manage_products

product_parameters write
→ manage_products

product_components write
→ manage_products

structural_rules write
→ manage_products

product_assets write
→ manage_products

product_variations write
→ manage_products

booking request Admin update
→ manage_bookings

admin_roles management
→ manage_roles
```

Owner automatically passes all permission checks.

This should be done as a dedicated database migration and tested before enabling Staff login.

---

# 20. Admin Navigation Permission Filtering

The Admin sidebar/navigation should reflect permissions.

Owner example:

```text
Dashboard
Products
Pricing
Bookings
Staff Accounts
```

Staff example based on current permissions:

```text
Dashboard
Bookings
```

Do not merely disable forbidden navigation items.

Prefer not rendering them.

However, route and server authorization must still block direct access.

---

# 21. Permission-Based Route Protection

Recommended route requirements:

```text
/admin
→ any active Admin

/admin/products/*
→ manage_products

/admin/pricing/*
→ manage_pricing

/admin/bookings/*
→ manage_bookings

/admin/staff/*
→ manage_roles
```

If an authenticated Admin manually enters a route without permission:

```text
return 403 / unauthorized
```

Do not silently allow it because the user is an Admin.

---

# 22. One-Time First Owner Bootstrap

There is intentionally no public Owner registration flow.

The first Owner is created once during system setup.

Recommended approach:

```text
1. Ensure Owner role exists
2. Create the intended Owner in Supabase Auth
3. Ensure their profile exists
4. Promote that profile to Admin
5. Assign the Owner role
6. Verify login through /admin/login
```

Because the current profile model requires an Admin profile to have a role, update both fields together.

Example current-schema promotion SQL:

```sql
begin;

update public.profiles p
set
  account_type = 'Admin',
  admin_role_id = (
    select role_id
    from public.admin_roles
    where role_name = 'Owner'
      and status = 'Active'
    limit 1
  ),
  status = 'Active',
  updated_at = now()
where lower(p.email) = lower('OWNER_EMAIL_HERE');

commit;
```

Then verify:

```sql
select
  p.profile_id,
  p.full_name,
  p.email,
  p.account_type,
  p.status,
  r.role_name,
  r.permissions,
  r.status as role_status
from public.profiles p
left join public.admin_roles r
  on r.role_id = p.admin_role_id
where lower(p.email) = lower('OWNER_EMAIL_HERE');
```

Expected:

```text
account_type = Admin
profile status = Active
role_name = Owner
role status = Active
```

This is a one-time bootstrap, not a normal business workflow.

---

# 23. No Admin Registration Page

Do not implement:

```text
/admin/register
```

Do not let arbitrary visitors choose:

```text
Owner
Staff
Manager
```

during signup.

Only an authorized Owner can create additional Admin identities.

This keeps administrator creation controlled by the business.

---

# 24. Owner Staff-Management Feature

Add an Owner-only section using the current Admin UI design.

Recommended route:

```text
/admin/staff
```

Permission:

```text
manage_roles
```

Page functions:

```text
View Admin accounts
Invite Staff
View role
View status
Suspend
Reactivate
Resend invite
```

Do not add permanent delete in the first implementation.

---

# 25. Why Suspend Instead of Delete

Admin profiles are referenced by audit fields such as:

```text
created_by
updated_by
```

Deleting them can conflict with historical records and auditability.

Use:

```text
Active
Suspended
Inactive
```

instead.

Recommended meanings:

```text
Active
→ may authenticate and use allowed Admin features

Suspended
→ temporarily blocked

Inactive
→ no longer operational
```

---

# 26. Owner Invites a Staff Member

Recommended flow:

```text
Owner
↓
Staff Accounts
↓
Invite Staff
↓
First Name
Last Name
Email
Role = Staff
↓
Send Invitation
```

The Owner does not set the employee's permanent password.

Use a secure invitation flow.

---

# 27. Staff Creation Backend

This operation requires trusted server code.

The server uses the Supabase Admin Auth API with:

```text
SUPABASE_SERVICE_ROLE_KEY
```

The service-role key must never be exposed to the browser.

Recommended sequence:

```text
Owner submits Staff invitation
        ↓
server verifies Owner/manage_roles
        ↓
validate email/name
        ↓
verify no conflicting existing profile
        ↓
Supabase Auth Admin invites user by email
        ↓
auth.users created
        ↓
profile creation/sync occurs
        ↓
server updates profile:
account_type = Admin
admin_role_id = Staff role
status = Active
        ↓
invitation email sent
```

Use the existing current profile structure.

---

# 28. Staff Invitation Callback

Configure the invitation redirect to:

```text
/admin/auth/callback
```

After Supabase validates the invite/recovery token:

```text
redirect
→ /admin/invite
```

or:

```text
/admin/reset-password
```

depending on the actual Supabase invite flow used.

The Staff member then chooses their password.

Do not ask the Owner to communicate a plaintext temporary password manually.

---

# 29. Invitation Completion Page

Reuse the Admin login visual design.

Example:

```text
Set your Admin password

New Password
Confirm Password

[ Activate Account ]
```

After password setup:

```text
verify current user
↓
verify active Admin profile + role
↓
redirect /admin
```

If the profile was suspended before invite completion:

```text
do not allow Admin dashboard access
```

---

# 30. Staff Invitation Failure / Rollback

Staff creation spans:

```text
Supabase Auth
+
profiles
```

Treat it as a coordinated operation.

If Auth invite succeeds but Admin profile promotion fails:

```text
do not report complete success
```

Recommended compensating behavior:

```text
log failure
attempt cleanup or leave account non-Admin
show retryable Admin error
```

A partially created Customer profile must never gain Admin access accidentally.

---

# 31. Existing Email Conflict

If the Owner tries to invite an email that already belongs to a GlassFit Customer:

Do not silently convert the customer into Staff.

Show:

```text
An account with this email already exists.
```

Then require an explicit controlled Owner action if account conversion is ever supported.

For v1:

```text
block the invite
```

This avoids accidentally changing a real customer account into an administrator.

---

# 32. Staff Account List

Reuse the current Admin table/list design.

Recommended columns:

```text
Name
Email
Role
Status
Created
Actions
```

Example actions:

```text
Suspend
Reactivate
Resend Invitation
```

Owner row should be visibly distinguishable by role badge, using existing badge style.

---

# 33. Protect the Owner Account

Add safeguards.

Do not allow the system to:

```text
suspend the final active Owner
remove the Owner role from the final active Owner
disable the final active Owner role
```

The system should always preserve at least one Active Owner.

For the first implementation, simplest protection:

```text
Owner cannot suspend their own account
Owner cannot change their own role
```

plus server-side validation that at least one other Active Owner exists before any Owner demotion/suspension feature is added later.

---

# 34. Staff Suspension

Owner clicks:

```text
Suspend
```

Server:

```text
require manage_roles
↓
verify target is not protected Owner
↓
profiles.status = Suspended
```

Because current `is_admin()` requires:

```text
profile.status = Active
```

the suspended account fails Admin authorization immediately on future requests.

If feasible, also revoke the Staff member's active Supabase sessions through trusted server code.

Session revocation is recommended so a suspended employee is removed promptly rather than waiting for the next session refresh.

---

# 35. Staff Reactivation

Owner can set:

```text
profiles.status = Active
```

only if:

```text
assigned role exists
role status = Active
```

Then Staff can sign in again.

---

# 36. Admin Logout

Add logout to the existing Admin account/profile menu using the current UI design.

Flow:

```text
supabase.auth.signOut()
↓
redirect /admin/login
```

Clear any Admin-only local UI state.

Do not leave protected Admin content visible after logout.

---

# 37. Forgot Password

The Admin login can include:

```text
Forgot password?
```

Use Supabase password recovery.

Recommended routes:

```text
/admin/forgot-password
/admin/auth/callback
/admin/reset-password
```

The reset page should use the same GlassFit/Admin auth visual style.

No registration link should be shown.

---

# 38. Password Requirements

Reuse the same secure password requirements already used by customer authentication unless a stronger Admin standard is intentionally selected later.

Do not maintain two unrelated validation implementations.

Create/reuse one shared password validation utility where possible.

---

# 39. Session Behavior

Continue using Supabase SSR session refresh.

Do not build custom JWT storage.

Do not store Admin access tokens in:

```text
localStorage
custom cookies
database session table
```

Use Supabase-managed secure session cookies through the existing SSR setup.

---

# 40. Already Logged-In Admin

If an active Admin visits:

```text
/admin/login
```

redirect:

```text
/admin
```

There is no reason to show the login form again.

---

# 41. Logged-In Customer Visits Admin

If a logged-in Customer navigates to:

```text
/admin
```

they must not enter the dashboard.

Recommended result:

```text
/admin/login?error=unauthorized
```

or a dedicated minimal unauthorized screen.

Do not show Admin data while deciding what to do.

If the Admin login form needs a different account while a Customer session exists, provide:

```text
Sign in with a different account
```

which signs out the current Supabase session first.

---

# 42. Inactive/Suspended Admin Visits Admin

Even with a valid Supabase session:

```text
account_type = Admin
status != Active
```

must fail.

Likewise:

```text
role status != Active
```

must fail.

Authentication alone is not authorization.

---

# 43. Admin Context Provider

Protected Admin UI may use a server-loaded Admin context passed to client components where required.

Do not repeatedly refetch role permissions from every component.

Recommended context:

```ts
type AdminSessionContext = {
  profile: {
    id: string;
    fullName: string;
    email: string;
  };

  role: {
    id: string;
    name: string;
  };

  permissions: {
    manageProducts: boolean;
    managePricing: boolean;
    manageRoles: boolean;
    manageBookings: boolean;
  };
};
```

Load authoritative data server-side per protected request/layout.

---

# 44. Permission UI Helper

Create a simple UI helper:

```ts
can("manage_products")
```

Use it only for rendering/navigation behavior.

Do not use it as the only security check.

Examples:

```text
if manage_products
→ show Products navigation

if manage_roles
→ show Staff Accounts

if manage_bookings
→ show Booking Requests
```

---

# 45. Owner Experience

Owner login:

```text
/admin/login
↓
Owner credentials
↓
dashboard
```

Owner should see all current Admin features permitted by role.

For the product-upload workflow being developed:

```text
manage_products = true
```

therefore Owner can:

```text
create products
upload catalog assets
upload structural models
configure rules
validate products
activate products
```

---

# 46. Staff Experience

With the current seeded permissions:

```text
manage_products = false
manage_pricing = false
manage_roles = false
manage_bookings = true
```

Staff should not see:

```text
Add Product
Edit Product
Delete Product
Product Upload Wizard
Structural Validation
Pricing controls
Staff Accounts
Role Management
```

Staff can see operational booking functionality permitted by:

```text
manage_bookings
```

Do not change Staff permissions just to make current Admin pages visible.

If business requirements later say Staff may manage products, update the Staff role permission intentionally.

---

# 47. Manager Compatibility

The current schema includes Manager.

Do not remove support.

The authorization architecture should work automatically for Manager because it evaluates:

```text
admin_roles.permissions
```

rather than hardcoding:

```text
if Owner ...
if Staff ...
```

The UI may hide Manager as an assignable option in v1 if the business only needs Owner and Staff right now.

---

# 48. Do Not Hardcode Role Names for Features

Bad:

```ts
if (role === "Owner") {
  showProducts();
}
```

Better:

```ts
if (permissions.manageProducts) {
  showProducts();
}
```

Role names describe business positions.

Permissions decide application behavior.

`Owner` can remain a superuser override in the server/database helper.

---

# 49. Admin Audit Fields

Existing Admin operations already use fields such as:

```text
created_by
updated_by
```

Once Admin login exists, stop relying on manually known Admin UUIDs.

For server mutations:

```text
created_by = authenticated Admin profile_id
updated_by = authenticated Admin profile_id
```

The browser should not choose these values.

This improves audit accuracy.

---

# 50. Admin Product Upload Integration

The previously planned Admin product-upload flow should use:

```text
requirePermission("manage_products")
```

for every mutation.

Examples:

```text
createProductDraft
updateProduct
prepareCatalogUpload
confirmCatalogUpload
createComponent
prepareComponentUpload
confirmComponentUpload
createStructuralRule
validateProduct
activateProduct
```

The signed R2 upload endpoints must also require the product-management permission.

---

# 51. R2 Presigned Upload Security

Admin authentication must be checked before generating any product-asset upload URL.

Flow:

```text
request signed R2 PUT URL
↓
require authenticated Admin
↓
require manage_products
↓
verify product/component relation
↓
generate URL
```

A Customer or unauthorized Staff account must never be able to generate Admin product-upload URLs.

---

# 52. Admin Dashboard Data Security

Do not load sensitive Admin dashboard queries on the client before authorization finishes.

Preferred:

```text
protected server layout
↓
requireAdmin
↓
render protected page
↓
page performs permitted queries
```

Avoid:

```text
render dashboard
↓
client JS discovers user is unauthorized
↓
redirect
```

because that creates a flash of protected content and weakens architecture.

---

# 53. Suggested Shared Auth Modules

Adapt names to current project conventions.

Recommended conceptual structure:

```text
src/lib/auth/
├── admin.ts
├── permissions.ts
└── password.ts
```

`admin.ts`:

```text
getAdminContext
requireAdmin
requireOwner
```

`permissions.ts`:

```text
permission keys
permission type
requirePermission
canPermission
```

Reuse existing Supabase client files.

Do not duplicate browser/server Supabase creation logic.

---

# 54. Suggested Admin Auth Components

Reuse current login components where possible.

Possible additions:

```text
components/admin/auth/
├── AdminLoginForm.tsx
├── AdminForgotPasswordForm.tsx
├── AdminResetPasswordForm.tsx
└── AdminInvitePasswordForm.tsx
```

If the customer login form is already sufficiently generic:

```text
extract shared auth form primitives
```

rather than copying and maintaining two visually identical forms.

---

# 55. Suggested Owner Staff Components

```text
components/admin/staff/
├── StaffList.tsx
├── InviteStaffDialog.tsx
├── StaffStatusBadge.tsx
└── StaffActionsMenu.tsx
```

Use existing Admin table/dialog/badge/menu components.

Do not build a separate visual language.

---

# 56. Server-Only Supabase Admin Client

Create a server-only helper for Supabase Auth Admin API.

Conceptually:

```text
src/lib/supabase/admin.ts
```

Requirements:

```text
uses SUPABASE_SERVICE_ROLE_KEY
server-only
never imported by client components
```

Use it only for trusted operations such as:

```text
invite Staff
resend invite
optional session revocation
```

Normal Admin database operations should still honor the established Supabase/RLS architecture where possible.

---

# 57. Environment Variables

Client-safe:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Server-only:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Never prefix the service-role key with:

```text
NEXT_PUBLIC_
```

Never return it from an API.

---

# 58. Milestone-Based Implementation

Do not implement the full feature in one shot.

Use the following milestones.

---

# Milestone 1 — Protect `/admin`

Implement only:

```text
/admin/login
protected /admin layout
redirect when unauthenticated
```

Do not implement Staff invitations yet.

## Checks

- [ ] `/admin` no longer opens publicly
- [ ] unauthenticated `/admin` redirects to `/admin/login`
- [ ] `/admin/login` remains accessible
- [ ] customer UI contains no Admin login link
- [ ] current Admin dashboard UI remains unchanged after authorization
- [ ] session-refresh behavior still works

## Stop condition

Do not continue until direct unauthenticated access to every protected Admin route is blocked.

---

# Milestone 2 — First Owner Authentication

Bootstrap one Owner.

Implement Admin email/password login.

## Checks

- [ ] Owner exists in Supabase Auth
- [ ] Owner profile has `account_type = Admin`
- [ ] Owner profile is `Active`
- [ ] Owner role is active
- [ ] Owner can log in from `/admin/login`
- [ ] valid Owner redirects to `/admin`
- [ ] wrong password does not enter Admin
- [ ] normal Customer cannot enter Admin
- [ ] Suspended test Admin cannot enter Admin
- [ ] logout returns to `/admin/login`

## Database verification

```sql
select
  p.profile_id,
  p.full_name,
  p.email,
  p.account_type,
  p.status,
  r.role_name,
  r.permissions,
  r.status as role_status
from public.profiles p
left join public.admin_roles r
  on r.role_id = p.admin_role_id
where p.profile_id = 'OWNER_PROFILE_ID'::uuid;
```

---

# Milestone 3 — Permission Infrastructure

Implement:

```text
has_admin_permission()
permission helpers
server requirePermission()
permission-aware navigation
```

Update RLS policies where necessary.

## Checks

Create temporary Owner and Staff test accounts.

Owner:

```text
manage_products → allowed
manage_roles → allowed
manage_bookings → allowed
```

Staff:

```text
manage_products → denied
manage_roles → denied
manage_bookings → allowed
```

Test both UI and direct requests.

## Critical test

A Staff user manually calls/opens a product mutation endpoint.

Expected:

```text
403 / permission denied
```

not just a hidden button.

Do not continue until this passes.

---

# Milestone 4 — Owner Staff Management UI

Implement:

```text
/admin/staff
Admin list
Invite Staff form
Suspend
Reactivate
```

Use the existing Admin UI design.

## Checks

- [ ] only `manage_roles` users can open Staff page
- [ ] Staff cannot open Staff page
- [ ] Owner can see Admin account list
- [ ] duplicate email is rejected
- [ ] existing Customer email is not silently promoted
- [ ] account status is clearly shown
- [ ] no public registration route exists

---

# Milestone 5 — Staff Invitation

Implement Supabase server-side invite.

## Checks

- [ ] invitation sent to new Staff email
- [ ] auth user created
- [ ] profile linked to same Auth UUID
- [ ] `account_type = Admin`
- [ ] correct Staff `admin_role_id`
- [ ] profile `status = Active`
- [ ] invite callback works
- [ ] Staff sets their own password
- [ ] Staff can sign in through `/admin/login`
- [ ] Staff only sees permitted Admin navigation

## Failure testing

Test:

```text
invalid email
duplicate email
network failure
profile update failure
expired invite
already-used invite
```

The system must not incorrectly report a failed invite as complete.

---

# Milestone 6 — Staff Authorization Regression

Test all currently implemented Admin areas.

At minimum:

```text
Dashboard
Products
Product Upload
Structural Validation
Bookings
Staff Accounts
```

Using both Owner and Staff.

Expected with current permissions:

| Feature | Owner | Staff |
|---|---:|---:|
| Admin dashboard | Yes | Yes |
| Product management | Yes | No |
| Product asset upload | Yes | No |
| Structural validation | Yes | No |
| Pricing | Yes | No |
| Booking operations | Yes | Yes |
| Staff management | Yes | No |

Do not proceed until both navigation and backend behavior match.

---

# Milestone 7 — Suspension / Session Security

## Checks

- [ ] Owner suspends Staff
- [ ] suspended Staff cannot load new Admin requests
- [ ] existing session is rejected on next authorization check
- [ ] session revocation is performed if implemented
- [ ] reactivated Staff can log in again
- [ ] Owner cannot accidentally suspend protected final Owner

---

# Milestone 8 — Password Recovery

Implement:

```text
/admin/forgot-password
/admin/reset-password
```

## Checks

- [ ] recovery email works
- [ ] callback returns to Admin auth flow
- [ ] password can be updated
- [ ] reset account still must pass Admin authorization
- [ ] Customer account reset does not grant Admin access
- [ ] no Admin registration link appears

---

# Milestone 9 — Final Security Regression

Test these scenarios manually:

```text
1. Anonymous → /admin
2. Anonymous → /admin/products
3. Customer → /admin
4. Customer → Admin server action
5. Staff → Owner-only route
6. Staff → product mutation endpoint
7. Staff → booking update
8. Owner → product mutation
9. Suspended Staff → dashboard
10. Active Admin with inactive role → dashboard
11. Expired Supabase session → /admin
12. Admin logout → browser Back button
```

Expected:

```text
no protected data leakage
no unauthorized mutation
correct redirect / 403 behavior
```

---

# 59. Customer Authentication Regression

Admin auth must not break the existing customer flow.

Retest:

```text
Customer registration
Customer email login
Google customer login if enabled
Customer logout
Customer profile
Product browsing
Visualization auth requirements
```

Admin changes must not convert ordinary new signups into Admin accounts.

New public registrations remain:

```text
account_type = Customer
admin_role_id = NULL
```

---

# 60. Important Account-Creation Rule

The frontend must never accept:

```text
account_type
admin_role_id
permissions
role_name
```

from a public registration request.

Admin privilege assignment happens only through trusted Owner/server operations.

---

# 61. Optional Later Improvements

Do not block v1 on these.

Possible later work:

```text
MFA for Owner/Admin
Admin login audit log
last_login_at
invitation status tracking
forced password reset policies
device/session management
custom roles
permission editor
Manager exposure
session timeout customization
IP/rate-limit monitoring
```

MFA is particularly valuable before production deployment, but can be implemented after the fundamental Owner/Staff authorization model is stable.

---

# 62. Definition of Done

Owner/Staff authentication is complete when:

```text
/admin
```

is no longer publicly accessible and:

```text
Owner
→ private Admin login
→ full authorized Admin access
→ can invite/manage Staff

Staff
→ receives Owner-created invitation
→ creates own password
→ private Admin login
→ only permitted Admin functionality
```

with:

```text
no Admin registration page
no Admin link in customer UI
same Supabase Auth identity system
active profile + active role checks
server-side permission checks
permission-aware RLS
protected Admin routes
protected Admin mutations
```

---

# 63. Final Architecture

```text
CUSTOMER AUTH
/public login + register
        │
        ▼
Supabase Auth
        │
        ▼
profiles
account_type = Customer


ADMIN AUTH
/private /admin/login
        │
        ▼
Supabase Auth
        │
        ▼
profiles
account_type = Admin
status = Active
        │
        ▼
admin_roles
role status = Active
permissions
        │
        ▼
Protected Admin Layout
        │
        ├── Owner
        │    ├── products
        │    ├── pricing
        │    ├── bookings
        │    └── Staff management
        │
        └── Staff
             └── permitted operational areas
```

The route being hidden is only a convenience.

The actual security model is:

> **Authenticated Supabase user + active Admin profile + active role + permission authorization.**
