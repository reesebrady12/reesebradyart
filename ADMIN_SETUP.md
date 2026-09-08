# Private Admin Setup

The dashboard uses Supabase Auth for login, an `admin_users` database allowlist for authorization, server-side bearer-token verification on every endpoint, Postgres RLS, and restricted Storage writes. `ADMIN_EMAIL` adds a second server-side email check; it does not replace the database role.

## 1. Create Supabase and run migrations

Create a Supabase project. In SQL Editor, run these files in order:

1. `supabase/migrations/20260804000000_ecommerce.sql`
2. `supabase/migrations/20260805000000_admin_dashboard.sql`
3. `supabase/migrations/20260806000000_security_hardening.sql`
4. `supabase/migrations/20260810000000_new_painting_uploads.sql`
5. `supabase/migrations/20260811000000_portfolio_categories.sql`
6. `supabase/migrations/20260812000000_portfolio_constraint_hardening.sql`

The migrations create the private admin role table, catalog fields, image metadata, fulfillment fields, inventory reservations, indexes, RLS policies, and the private `paintings` Storage bucket. Confirm RLS is enabled on every public table. Orders have no public read policy.

The Stripe webhook must subscribe to both `checkout.session.completed` and `checkout.session.expired`. The expiration event releases an abandoned original-painting reservation.

## 2. Create the administrator

In Supabase Dashboard → Authentication → Providers, enable Email and disable new-user signup. Under Authentication → Users, create your user manually with a unique password of at least 16 characters. Copy its UUID and run this in SQL Editor with your real values:

```sql
insert into public.admin_users (id, email, role)
values ('AUTH-USER-UUID', 'YOUR-EMAIL', 'admin');
```

Public registration never writes `admin_users`, so creating an Auth user cannot grant admin access. For MFA, enable TOTP in Supabase Authentication settings. The current UI uses email/password; TOTP enrollment/challenge UI is a recommended next enhancement before granting additional admins.

## 3. Configure environment values

Copy `.env.example` to `.env`. In Supabase → Project Settings → API, copy the Project URL into both URL fields, the public anon key into `VITE_SUPABASE_ANON_KEY`, and the service-role key into the server-only value. Set `ADMIN_EMAIL` to the exact administrator email.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are intentionally public. Never prefix the service-role key, Stripe secret, webhook secret, or Resend key with `VITE_`.

## 4. Run locally

Run the full-stack local server:

```bash
npm install
npm run dev:full
```

Use `http://localhost:5173/admin/login`. `npm run dev` serves the visual frontend but cannot execute the protected `/api` functions.

In Supabase Authentication → URL Configuration, allow `http://localhost:5173/admin/reset-password` for local password recovery. Add the matching HTTPS URL for production.

## 5. Test the workflow

1. Sign in at `/admin/login` and add a painting as a draft.
2. Open its edit page and drop several JPEG, PNG, WebP, or AVIF files into the image area.
3. Change labels and alt text, drag images to reorder, and select a cover.
4. Add the Stripe Product and Price IDs, then publish it.
5. Open the public shop in a private browser window and confirm it appears with its image gallery.
6. Unpublish or archive it and confirm it disappears publicly. Restore it by selecting Draft or Published.
7. Mark an original Sold and confirm its inventory becomes zero and checkout rejects it. Restoring sold inventory requires explicit server confirmation and is intentionally blocked by the initial UI.
8. Open an order, mark it Packing, then Fulfilled, and optionally add carrier, tracking, and a private note.

Security checks:

- Signed out: `/admin` redirects to `/admin/login`.
- Normal Auth user without an `admin_users` row: the UI shows Forbidden and every admin API returns 403.
- The public anon key cannot insert/update products, upload files, or read orders because RLS denies it.
- Files larger than `MAX_IMAGE_UPLOAD_MB`, executable formats, path traversal names, and unsupported MIME types are rejected before a signed upload is issued.

## 6. Deploy

Deploy to Vercel and copy all environment variables into the project settings. Set `SITE_URL` to the production HTTPS domain. Add the production URL to Supabase Authentication → URL Configuration. Register the production Stripe webhook as described in `README.md`.

After deploying, repeat the signed-out, non-admin, draft visibility, upload, sold-original, checkout, order privacy, and webhook tests. Keep Supabase Auth public signup disabled and enable MFA before adding more privileged users.
