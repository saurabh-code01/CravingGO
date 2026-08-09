# CravingGo Backend

Node.js + Express + MongoDB API for the CravingGo food ordering site. Handles auth, the menu (products), cart, orders, and payments.

## 1. Prerequisites

- Node.js 18+
- A MongoDB database — either:
  - Local: install MongoDB Community Server and run it (`mongod`), or
  - Free hosted: create a cluster on [MongoDB Atlas](https://www.mongodb.com/atlas) and grab its connection string

## 2. Setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and fill in:
- `MONGO_URI` — your local or Atlas connection string
- `JWT_SECRET` — any long random string
- `CLIENT_ORIGIN` — the URL your frontend is served from (e.g. `http://127.0.0.1:5500` if you use VS Code's Live Server)
- `STRIPE_SECRET_KEY` — optional, leave blank to use mock payments (see below)

## 3. Seed the menu

Loads `products.json` (from the frontend folder) into MongoDB:

```bash
npm run seed
```

Run `npm run seed:destroy` any time to wipe the products collection.

## 4. Run the server

```bash
npm run dev     # with nodemon, auto-restarts on changes
# or
npm start
```

Server runs on `http://localhost:5000` by default. Check `http://localhost:5000/api/health` to confirm it's up.

## 5. Point the frontend at it

In the frontend root, `config.js` sets:

```js
const API_BASE_URL = 'http://localhost:5000/api';
```

Change this if you run the backend on a different port or deploy it elsewhere. Then just open `index.html` (or serve it with Live Server / any static server) — sign up, browse the menu, add to cart, and check out.

## 6. Payments — mock mode vs. real Stripe

By default (no `STRIPE_SECRET_KEY` set), the payment flow runs in **mock mode**: placing a card order creates a fake payment intent and immediately marks the order as paid, so you can test the full checkout flow without any payment credentials.

To use real Stripe:
1. Get test API keys from your [Stripe dashboard](https://dashboard.stripe.com/test/apikeys)
2. Set `STRIPE_SECRET_KEY` in `.env`
3. On the frontend, integrate [Stripe.js/Elements](https://stripe.com/docs/js) to collect card details and confirm the `PaymentIntent` using the `clientSecret` returned from `POST /api/payments/create-intent` (the current frontend JS has a comment marking exactly where to do this)
4. Set up a webhook endpoint in Stripe pointing to `POST /api/payments/webhook` and put its signing secret in `STRIPE_WEBHOOK_SECRET`

## 7. Creating an admin user

There's no separate admin signup — register a normal account, then manually flip its role in MongoDB:

```js
// in mongosh, or MongoDB Compass
use cravinggo
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```

Admins can create/update/delete products (`POST/PUT/DELETE /api/products/:id`) and view/manage all orders (`GET /api/orders`, `PUT /api/orders/:id/status`).

## API Reference

Base URL: `/api`

### Auth
| Method | Route | Access | Body |
|---|---|---|---|
| POST | `/auth/register` | Public | `{ name, email, password }` |
| POST | `/auth/login` | Public | `{ email, password }` |
| GET | `/auth/me` | Private | — |
| PUT | `/auth/me` | Private | `{ name?, addresses? }` |

### Products
| Method | Route | Access | Body |
|---|---|---|---|
| GET | `/products` `?category=&search=` | Public | — |
| GET | `/products/:id` | Public | — |
| POST | `/products` | Admin | `{ name, description, price, image, category, isAvailable }` |
| PUT | `/products/:id` | Admin | any product field |
| DELETE | `/products/:id` | Admin | — |

### Cart (always the logged-in user's cart)
| Method | Route | Access | Body |
|---|---|---|---|
| GET | `/cart` | Private | — |
| POST | `/cart` | Private | `{ productId, quantity }` |
| PUT | `/cart/:productId` | Private | `{ quantity }` |
| DELETE | `/cart/:productId` | Private | — |
| DELETE | `/cart` | Private | — (clears cart) |

### Orders
| Method | Route | Access | Body |
|---|---|---|---|
| POST | `/orders` | Private | `{ shippingAddress, paymentMethod }` — creates an order from the current cart |
| GET | `/orders/my` | Private | — |
| GET | `/orders/:id` | Private (owner or admin) | — |
| GET | `/orders` | Admin | — all orders |
| PUT | `/orders/:id/status` | Admin | `{ status }` |

### Payments
| Method | Route | Access | Body |
|---|---|---|---|
| POST | `/payments/create-intent` | Private | `{ orderId }` |
| POST | `/payments/confirm-mock` | Private | `{ orderId }` — only works when Stripe isn't configured |
| POST | `/payments/webhook` | Public (Stripe-signed) | Stripe event payload |

## Project structure

```
backend/
├── config/db.js            MongoDB connection
├── controllers/            Route handler logic
├── middleware/              JWT auth + error handling
├── models/                  Mongoose schemas (User, Product, Cart, Order)
├── routes/                  Express routers
├── seed/seedProducts.js    Imports products.json into MongoDB
├── server.js                App entry point
└── .env.example
```
