# ⚡ Moovimiento

**An interactive experience to create your own nut mixes.**

"Moovimiento" is your digital shop to customize and order nutritious 220g mixes. Designed to offer a seamless shopping experience, from ingredient selection to checkout and delivery.

---

## ✨ Key Features

- **🥣 Mix Builder**: Intuitive interface (simple selection) to build your perfect mix.
- **🔐 Google Authentication**: Simplified one-click login for regular customers (disabled due to maintenance costs).
- **🛒 Integrated Checkout**: Optimized purchase process with real-time price calculation.
- **💳 Secure Payments**: Full integration with Mercado Pago for reliable transactions.
- **🎁 Loyalty Program**: Automated progress tracking for frequent customers with rewards.
- **🚚 Delivery Management**: Configurable delivery options, focused on [**Ciudad Universitaria**](https://www.google.com/maps/place/Pabell%C3%B3n+Argentina+%7C+U.N.C./@-31.4377036,-64.1924841,16z/data=!4m15!1m8!3m7!1s0x9432a2f390acbf49:0x76ac4d048e43a498!2sCdad.+Universitaria,+X5000+C%C3%B3rdoba!3b1!8m2!3d-31.4391398!4d-64.1861887!16s%2Fg%2F11rf7v8hwm!3m5!1s0x9432a2f3f4c88b1f:0x52fd4a14aa234bf!8m2!3d-31.4385451!4d-64.1888835!16s%2Fg%2F1q5bm3s9g).

---

## 🛠️ Technology Stack

- **Framework**: [**Next.js 16**](https://nextjs.org/) + [**React 19**](https://react.dev/)
- **Auth**: [**Supabase Auth**](https://supabase.com/auth) with Google Provider
- **Styling**: [**Tailwind CSS 4**](https://tailwindcss.com/) + [**Radix UI**](https://www.radix-ui.com/)
- **Language**: [**TypeScript**](https://www.typescriptlang.org/)
- **Database**: [**Supabase**](https://supabase.com/)
- **Global State**: [**Zustand**](https://github.com/pmndrs/zustand)
- **Payments**: [**Mercado Pago**](https://www.mercadopago.com.ar/developers/es/docs/sdks-library/server-side)
- **Email**: [**Resend**](https://resend.com/)

---

## 🚀 Setup & Configuration

### 🗄️ Supabase
If you created a brand new Supabase project:
1. Copy [**env.example**](env.example) to `.env.local`.
2. Fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Run the SQL in [**supabase/schema.sql**](supabase/schema.sql) in Supabase SQL Editor.

### 🔐 Google Auth (OAuth)
1. Go to **Google Cloud Console** and create an OAuth 2.0 Client ID.
2. In **Supabase Dashboard**, go to **Authentication > Providers > Google**.
3. Enable Google and paste the **Client ID** and **Client Secret**.
4. In Google Cloud Console, add the **Callback URL** provided by Supabase to the **Authorized redirect URIs**.
5. In Supabase **URL Configuration**, add your production URL and localhost URLs to the redirect allowlist (e.g., `https://moovimiento.com/auth/callback`).

---

## 🔐 Admin Panel

The administration interface is accessible at `/admin`. It allows you to:

-   **🎁 Loyalty Management**: Generate random gift codes to add steps to customer loyalty cards.
-   **🎫 Discount Codes**: Create and manage percentage or fixed discount coupons (e.g., `OFF10`).
-   **👤 Customer Insights**: View and edit customer progress, verification status, and purchase history.

To access, you need the `ADMIN_PASSWORD` (configured during deployment).

---

## 🕹 Usage

### 🥣 Build a Mix

1. Explore the variety of nuts, seeds, and dried fruits.
2. Select your favorite ingredients until you complete the 220g.
3. Visualize the cost and nutritional composition (if applicable) in real-time.

### 🛒 Complete the Order

1. Enter your shipping and billing details.
2. Proceed to secure payment via Mercado Pago.
3. Receive confirmation via email and status notifications.

---

## 📄 License

This project is for commercial use by Moovimiento. All rights reserved.

---

Made with 💛 by [**Gonza**](https://gonzagramaglia.github.io/)
