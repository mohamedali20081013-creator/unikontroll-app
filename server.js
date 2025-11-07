const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

// --- Stripe
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecret ? require('stripe')(stripeSecret) : null;

const app = express();
const PORT = process.env.PORT || 3000;

// ---- config
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password'; // change in prod
const DATA_FILE = path.join(__dirname, 'data', 'orders.json');

// ---- middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 4 } // 4h
}));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data dir/file
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: [] }, null, 2), 'utf-8');
}

// ---- helpers
function readOrders() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw || '{"orders":[]}');
    return data.orders || [];
  } catch {
    return [];
  }
}
function writeOrders(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ orders }, null, 2), 'utf-8');
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}
function getBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// ---- Storefront: create order + Stripe Checkout session
app.post('/api/checkout', async (req, res) => {
  try {
    const { name, email, address, qty } = req.body;
    const price = 150; // SEK
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const total = price * quantity;

    if (!name || !email || !address) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    // 1) Save order as pending
    const order = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      name,
      email,
      address,
      qty: quantity,
      total,
      currency: 'SEK',
      status: 'pending',
      payment: { method: 'stripe', paidAt: null, last4: null }
    };
    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);

    // 2) Create Stripe Checkout session
    const baseUrl = getBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'sek',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'sek',
            unit_amount: 15000, // 150 kr in öre
            product_data: {
              name: 'UniKontroll',
              images: [`${baseUrl}/assets/all_in_one.png`]
            }
          },
          quantity: quantity
        }
      ],
      success_url: `${baseUrl}/success.html?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel.html?orderId=${order.id}`
    });

    res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stripe-session kunde inte skapas' });
  }
});

// Confirm payment after Stripe redirect
app.get('/api/stripe/confirm', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    const { session_id, orderId } = req.query;
    if (!session_id || !orderId) return res.status(400).json({ error: 'Missing params' });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') return res.json({ ok: false, status: session.payment_status });

    const orders = readOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    orders[idx].status = 'paid';
    orders[idx].payment.paidAt = new Date().toISOString();
    // best effort to fetch last4 via expanded intent if needed (optional)
    writeOrders(orders);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bekräftelse misslyckades' });
  }
});

// ---- Admin auth + data
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Fel användarnamn eller lösenord' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const list = readOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, orders: list });
});

// Delete order
app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const orders = readOrders();
  const next = orders.filter(o => o.id !== id);
  if (next.length === orders.length) {
    return res.status(404).json({ error: 'Order finns inte' });
  }
  writeOrders(next);
  res.json({ ok: true });
});

// ---- fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`UniKontroll running at http://localhost:${PORT}`));
