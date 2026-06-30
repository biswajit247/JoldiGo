# JoldiGo Ride-Hailing Platform Cockpit Simulator

JoldiGo (joldigo.in) is a legally compliant, transparent ride-hailing cockpit simulation tailored for Kolkata. This platform shifts the traditional aggregator power dynamic from hidden pricing algorithms to transparently negotiated fare contracts.

---

## 🚀 Key Modules & Compliance Features

### 1. Transparent Pricing Engine
- **3-Category Fare Structure:** Calculated reactively for **4-Wheeler AC Car**, **4-Wheeler Non-AC Car**, and **App Bike**.
- **Dynamic Fuel Indexing:** Base minimum fares automatically scale index-upward relative to real-time local CNG/fuel API fluctuations.
- **Night Charge Surcharge:** Applies a 1.2x price multiplier strictly during night hours (10:00 PM to 6:00 AM).
- **West Bengal 1.5x Surge Cap:** The peak surge multiplier slider is hard-constrained to a **1.5x maximum limit** to protect passenger rights.
- **Upfront Pricing Splits:** Renders base fare, GST (5% added on top of fare), mandated safety insurance premium (₹2), and toll estimates in pre-flight dispatch pop-ups.
- **Immutable Cryptographic Hash Contracts:** Signs ride payloads with unique SHA hashes, allowing drivers to verify fare breakdowns upfront.

### 2. Legal Cancellation Policy
- **Capped Penalty Fees:** Cancellations after driver match are capped at **10% of total fare** and never exceed **₹100**.
- **Earnings Splits:** Cancellation penalties are debited from the passenger's wallet and split **95% to the driver** (for time/fuel lost) and **5% platform commission**.

### 3. Closed-Loop Passenger Wallet & Disputes
- **Razorpay Top-Ups:** Integrated mockup top-up sheets supporting preset additions (₹100, ₹500, ₹1000) with loading gates.
- **Balance Verification:** Booking is dynamically locked if the wallet balance is lower than the upfront fare quote.
- **Instant Dispute Refund Gateway:** If an Admin rules in favor of a rider during disputes, the suspended ride fare is instantly refunded back to the rider's wallet balance.

### 4. Bilingual Translation Chat
- **Dynamic Local Translations (English ⇆ Bengali):** Translates messages instantly between passenger (English) and driver (Bengali) to eliminate regional language friction.
- **Quick-Reply Templates:** Taps quick replies such as *"Where are you?"* on the passenger app or *"আমি লোকেশনে পৌঁছে গেছি"* (I've arrived) on the driver app.
- **Notification Badges:** Displays red alerts on drawer panels when messages arrive while the chat drawer is toggled shut.

### 5. 24/7 Control Room SOS Dispatch
- **Danger Zone Overlay:** Spawns red pulsing threat circles around distressed drivers on the operations map.
- **Animated Interceptor Dispatch:** Spawns police units and animates coordinates dynamically towards the driver along computed dispatch paths.
- **Dispatch Ledger:** Tracks interceptor arrival ETAs, updating states to *Secured (Patrol Arrived)* once police reach the driver.

### 6. SVG Analytical Charts
- **Fare Ratio Donut:** Visualizes passenger-fare splits (90.5% Driver payout, 4.8% Platform cut, 4.8% GST).
- **Weekly Revenue Trends:** Bar charts showing daily volumes with interactive hover tooltips that merge live simulator earnings reactively.
- **Compliance Gauges:** Progress rings tracking accrued driver safety pools.

---

## 🛠️ Tech Stack & Local Setup

### Installation:
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite local development server:
   ```bash
   npm run dev
   ```
4. Access the cockpit dashboard at **[http://localhost:5173/](http://localhost:5173/)**

<!-- Appflow Webhook Sync Trigger -->
