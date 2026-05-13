# SmartFit AR
### An augmented-reality shoe try-on and multi-shop e-commerce platform for students, shoppers, and local retailers.

![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel&style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Firebase%20%7C%20DeepAR-orange?style=flat-square)

---

## Table of Contents

- [What is this?](#what-is-this)
- [Screenshots](#screenshots)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [User Roles](#user-roles)
- [Live Site](#live-site)
- [How to Log In](#how-to-log-in)
- [Project Structure](#project-structure)
- [Contact & Support](#contact--support)
- [License](#license)

---

## What is this?

**SmartFit AR** is a web-based shoe marketplace that lets customers virtually try on shoes using augmented reality before buying. It connects local shoe shop owners with customers through a single platform — complete with ordering, customization, feedback, and an admin control panel.

This is the capstone thesis project of **Innovator Crews**, a group from the **Bachelor of Science in Information Technology (BSIT), 4th Year** program at **Bataan Peninsula State University**, AY 2025–2026.

---

## Screenshots

**Landing Page**

![Landing Page](./assets/images/screenshots/landing.png)

**Customer Dashboard**

![Customer Dashboard](./assets/images/screenshots/customer_dashboard.png)

**AR Shoe Try-On**

![AR Try-On](./assets/images/screenshots/ar_tryon.png)

**Admin Dashboard**

![Admin Dashboard](./assets/images/screenshots/admin_dashboard.png)

---

## The Problem

Buying shoes online is a gamble — customers can't try them on, and sizing and style mismatches lead to returns, dissatisfaction, and lost sales. Local shoe shop owners also lack an accessible digital storefront to reach a wider audience.

- Customers cannot visualize how a shoe will look on their feet before purchasing.
- Local shoe retailers have no unified platform to list and sell their products online.
- Shop verification and quality control is unmanaged, leading to trust issues.
- Traditional order processes (walk-in, phone calls) are slow and difficult to track.

---

## The Solution

SmartFit AR solves the guesswork of online shoe shopping by integrating a real-time AR try-on feature powered by DeepAR directly into the browser — no app download required. Customers browse shoes from verified local shops, try them on virtually via their camera, and place orders all in one place.

Shop owners get a dedicated dashboard to register, manage products, and fulfill orders. An admin layer ensures all shops and shoe listings are verified before going live, keeping the platform trustworthy.

---

## Key Features

- **AR Shoe Try-On** — Try shoes on in real time using your device camera via DeepAR — no app install needed.
- **QR-Code Try-On** — Scan a QR code on a shoe display to launch the AR preview instantly.
- **Multi-Shop Marketplace** — Browse shoes from multiple registered local shops in a single interface.
- **Shoe Customization** — Customers can customize shoe colors and submit customization orders.
- **Order Management** — Place, track, and manage standard and customization orders end-to-end.
- **Wishlist** — Save favourite shoes and revisit them later before buying.
- **Cart & Checkout** — Add-to-cart flow with a full checkout experience.
- **Shop Registration & Verification** — Shop owners register and await admin approval before going live.
- **Admin Control Panel** — Approve or reject shops, verify shoe listings, manage orders, and moderate content.
- **Shoe Validator** — Automated checks on uploaded shoe listings to maintain quality standards.
- **Customer Feedback** — Buyers can leave reviews and ratings on purchased shoes.
- **Issue Reporting** — Customers can report problems; shop owners can respond directly.
- **AI Chatbot** — Built-in assistant to help users navigate the platform and answer common questions.
- **Account Activation** — Secure email-based account activation flow for new users.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Backend | None — static frontend, logic via Firebase SDK |
| Database | Firebase Realtime Database |
| Storage | Firebase Storage |
| Hosting | Vercel |
| Auth | Firebase Authentication |
| AR Engine | DeepAR |
| Icons | Font Awesome 6 |

No frameworks. Clean vanilla code that runs entirely in the browser, backed by Firebase for real-time data and DeepAR for augmented reality.

---

## User Roles

| Role | What they do |
|---|---|
| **Customer** | Register, browse shoes, use AR try-on, add to cart, place and track orders, customize shoes, leave feedback, report issues |
| **Shop Owner** | Register a shop, list and manage shoe products, fulfill orders, respond to customer issues |
| **Admin** | Approve/reject shop registrations, verify shoe listings, manage all orders, moderate censored words, oversee the platform |

---

## Live Site

🔗 **[smart-fit-ar.vercel.app](https://smart-fit-ar.vercel.app)**

| Page | Path |
|---|---|
| Landing / Home | `/index.html` |
| Login | `/login.html` |
| Customer Dashboard | `/customer/html/customer_dashboard.html` |
| Shop Owner Dashboard | `/shopowner/html/shopowner_dashboard.html` |
| Admin Dashboard | `/admin/html/admin_dashboard.html` |
| AR Try-On | `/ar/arshoetryon.html` |

> Accounts are managed per role. Contact a team member to request access for testing or panel evaluation.

---

## How to Log In

1. Go to [smart-fit-ar.vercel.app/login.html](https://smart-fit-ar.vercel.app/login.html)
2. Select your role (Customer, Shop Owner, or Admin)
3. Enter the credentials provided to you
4. You will be redirected to your role-specific dashboard

> Don't have credentials? [Contact the team](#contact--support) using the details below.

---

## Project Structure

```
├── index.html              ← Public landing page
├── login.html              ← Unified login page (all roles)
├── firebaseMethods.js      ← Shared Firebase utility library
├── deepARMethods.js        ← DeepAR + Firebase Storage helpers
├── shoe_loader.js          ← Dynamic shoe model loader
├── admin/                  ← Admin panel (HTML, CSS, JS)
├── customer/               ← Customer-facing pages
├── shopowner/              ← Shop owner portal
├── ar/                     ← AR try-on pages and DeepAR effects
├── chatbot/                ← AI chatbot interface
├── account_activation/     ← Email-based account activation
├── extras/                 ← About, Contact, Privacy Policy, Terms
└── images/                 ← Static image assets
```

---

## Contact & Support

Built and maintained by the **Innovator Crews** — BSIT Capstone Group, Bataan Peninsula State University AY 2025–2026.

**Marc Parubrub** / Aki1104

- **Portfolio:** [msbp-portfolio.vercel.app](https://msbp-portfolio.vercel.app)
- **Email:** [marcparubrub.dev@gmail.com](mailto:marcparubrub.dev@gmail.com)
- **GitHub:** [@Aki1104](https://github.com/Aki1104)

**Veeny Bautista** / yashamiyuki

- **Portfolio:** [veenybautista.vercel.app](https://veenybautista.vercel.app)
- **Email:** [vrmb.tech@gmail.com](mailto:vrmb.tech@gmail.com)
- **GitHub:** [@yashamiyuki](https://github.com/yashamiyuki)

**Leander Ochea** — Innovator Crews member

**Armabel Ramos** — Innovator Crews member

For account access, bug reports, or feature requests — reach out directly via email or GitHub.

---

## License

© 2026 SmartFit AR — Innovator Crews. All rights reserved.

---

*Built with care as a capstone thesis for BSIT 4th Year — Bataan Peninsula State University, AY 2025–2026.*