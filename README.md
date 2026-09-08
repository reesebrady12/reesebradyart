# Reese Brady Art

A React/Vite gallery shop with TypeScript, a persistent guest cart, Stripe-hosted Checkout, Supabase order storage and inventory, verified webhook fulfillment, and Resend notifications.

The private Supabase-authenticated studio dashboard manages products, images, publication, inventory, print sizes, and fulfillment. Follow [ADMIN_SETUP.md](./ADMIN_SETUP.md) before using `/admin/login`.

## Replace the sample content

Search for `TODO:`. Replace the catalog in `src/data/products.ts`, matching trusted records in `api/_lib/catalog.ts`, sample database rows in the migration, SVGs in `public/art`, Stripe Price IDs, email addresses, and `SITE_URL`.

## Local setup

1. Use Node 20+ and run `npm install`.
2. Create a Supabase project and run every SQL file in `supabase/migrations` in timestamp order.
3. In Stripe test mode, create a product and one-time price for every original and print size, plus a fixed US shipping rate. Copy `.env.example` to `.env` and fill every value.
4. Verify a sending domain in Resend and configure both email values.
5. Run `npm run dev:full` to start Vite and the local `/api` functions together at port 5173. Plain `npm run dev` is UI-only.
6. Forward signed events with `stripe listen --events checkout.session.completed,checkout.session.expired --forward-to localhost:5173/api/webhook`; copy its `whsec_...` into `.env`, then restart.

## Test fulfillment

Use Stripe test card `4242 4242 4242 4242`, any future expiry/CVC, and a valid US address. Confirm the cart clears, order and items exist, an original becomes sold with zero inventory, the webhook event is recorded, and the notification arrives. Resend the same event from Stripe CLI to verify no duplicate fulfillment. Then attempt to buy the sold original and confirm checkout rejects it.

The success page is not proof of payment. Database changes and email occur only after a signed webhook reports a paid session.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

Deploy to Vercel, set the environment values there, use your HTTPS domain for `SITE_URL`, and register `https://YOUR_DOMAIN/api/webhook` for `checkout.session.completed` and `checkout.session.expired`. Never expose server secrets through `VITE_` variables.
