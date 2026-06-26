# SmartFit AR — Case Study

> AR shoe try-on and multi-shop marketplace that lets shoppers try shoes on their own feet, in the browser, before they buy — and gives local retailers a verified place to sell.

---

## 1. Project Overview

- **Type:** Passion project — a self-driven build under **Buva** to showcase what the team can ship: a production-grade, real-time AR web product end to end.
- **Industry:** Footwear retail / e-commerce (multi-shop marketplace for local shoe sellers).
- **Timeline:** **4 months** (September 2025 → December 2025), with ongoing refinements after launch.
- **Development Type:** **Custom Code** — hand-written HTML, CSS, and vanilla JavaScript with no framework and no build step.
- **Platform / Technology:** HTML5, CSS3, Vanilla JavaScript (ES6+); Firebase Realtime Database, Firebase Authentication, Firebase Storage; DeepAR (in-browser augmented reality); hosted on Vercel.

---

## 2. Goal

We set out to prove we could build a hard, real-world product end to end — not a demo. The challenge we picked: buying shoes online is a guess. Shoppers can't try them on, so size and style mismatches lead to returns and lost trust, and local shoe sellers have no unified, trustworthy storefront.

SmartFit AR is our answer to that challenge, and a showcase of our range. The goal was to let customers **see a shoe on their own feet before paying**, browse listings from multiple shops in one place, and order without a single store visit — while shop owners get a real online channel and an admin layer keeps every shop and listing verified. Building it meant owning the full stack: real-time data, browser AR, role-based auth, and a verification/moderation layer.

---

## 3. Our Approach

### Research — understanding the real pain

We started from the actual buying journey. To try a pair of shoes, a customer normally has to travel to a physical store, find their size, and try them on — minutes to hours of effort per pair. Online stores remove the travel but reintroduce the risk: you can't see the fit or style on yourself, so returns spike. We also looked at how local sellers operate today — scattered across social media with no unified, trustworthy storefront and no order tracking. The opportunity was clear: collapse the "go to the store to try it on" step into something that takes **seconds in the browser**, and wrap it in a marketplace customers can trust.

### Decisions + why

Every technical decision was deliberate — we chose tools that let us ship a real, real-time product fast, with zero server maintenance, while keeping full control over the code. The logic behind each choice is the point:

- **Vanilla JavaScript over a heavy framework (React/Vue):** We wanted full control of the DOM, no build pipeline, and the smallest possible bundle so the site stays fast on low-end devices. "What we write is what ships" meant faster debugging and no framework lock-in.
- **DeepAR running in the browser, not a native app:** This was the single most important UX decision. Requiring an app download would have killed adoption, so we chose an engine that does live foot-tracking straight in the browser — try-on works the instant a shopper opens the page.
- **Firebase Realtime Database over a traditional SQL backend:** Orders, shop approvals, and listings change live across three separate dashboards (Customer, Shop Owner, Admin). A realtime database pushes those changes to every connected user instantly — no polling, no custom WebSocket server, no backend to keep alive.
- **Firebase Authentication + Storage:** Gave us secure, role-based login and email activation out of the box, and a CDN to stream shoe images and DeepAR `.deepar` effect files directly to the AR engine — so we never built or secured our own auth or file layer.
- **Vercel over Wix/GoDaddy:** Git-push deploys, free global HTTPS/CDN, and zero hosting cost for a fully static frontend — exactly right for a self-funded project that still needed to feel production-grade.

### Styling / UX

The interface is role-aware: each user (Customer, Shop Owner, Admin) lands in a dashboard built only around what they need, so nothing feels cluttered. Browsing uses a clean card-based product layout, and the AR try-on can be launched two ways — from a listing or by scanning a **QR code on a physical shoe display**, bridging the in-store and online experience. The flow is deliberately install-free: open, point the camera, and the shoe appears.

### Security

The platform is well-protected. Authentication and role separation are enforced through Firebase Authentication, so customers, shop owners, and admins each only reach their own areas. New accounts go through a **secure email-based activation** flow before they can be used. A trust layer sits on top of the marketplace: shops must be **approved by an admin** before going live, every shoe listing passes a **validator** before publication, and a **censored-words moderation** system filters user-generated content. Data and assets are served over Firebase's managed, HTTPS-secured infrastructure.

---

## 4. Outcome

A live, working AR shoe marketplace — proof we can take an ambitious idea from zero to a real, running product, entirely on a static + Firebase architecture with **zero server cost**.

**Features delivered:**

- Real-time, in-browser **AR shoe try-on** via DeepAR — no app download.
- **QR-code launch** straight from a physical shoe display into the AR preview.
- **Multi-shop marketplace** serving **3 distinct user roles** (Customer, Shop Owner, Admin).
- Live **order management** synced across all dashboards via Firebase Realtime Database.
- Shoe **customization**, **wishlist**, **cart & checkout**, **feedback/ratings**, and **issue reporting**.
- Admin **verification pipeline** — shop approval, automated shoe-listing validator, and content moderation.
- Built-in **AI chatbot** and secure **email account activation**.

**Measurable impact:**

- **Try-on time: a store visit (minutes to hours of travel + fitting) → seconds in the browser**, with no app install.
- **Returns risk reduced at the source** — shoppers see fit and style on their own feet *before* paying, instead of guessing.
- **3 fully separated role-based dashboards** delivered on a single platform.
- **₱0 / $0 monthly server cost** — fully static frontend on Vercel with Firebase as the realtime backend.
- Built end-to-end in **4 months** by the Buva team — full stack, AR, and infrastructure owned in-house.

---

*Built by **Buva**. Contact: [backupvirtualassistance@gmail.com](mailto:backupvirtualassistance@gmail.com).*
