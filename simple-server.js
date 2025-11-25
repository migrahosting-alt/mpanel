import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;

// --- middleware ---
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// --- health check ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'migrahosting-dev-api',
    time: new Date().toISOString(),
  });
});

// --- fake login endpoint ---
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  
  console.log(`[LOGIN] Attempt from: ${email}`);

  // Dev credentials
  const DEV_EMAIL = 'admin@migrahosting.com';
  const DEV_PASS = 'admin123';

  if (email !== DEV_EMAIL || password !== DEV_PASS) {
    console.log(`[LOGIN] Failed - invalid credentials`);
    return res.status(401).json({
      ok: false,
      error: 'Invalid email or password',
    });
  }

  // Return valid JSON payload
  console.log(`[LOGIN] Success - returning token`);
  return res.json({
    ok: true,
    token: 'dev-token-123',
    user: {
      id: 1,
      name: 'MigraHosting Admin',
      email,
      role: 'admin',
      tenant_id: 1
    },
  });
});

// --- catch-all 404 for other routes ---
app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Not found' });
});

// --- error handlers ---
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// --- start server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`▶ Simple server running on http://localhost:${PORT}`);
  console.log(`▶ Health: GET http://localhost:${PORT}/api/health`);
  console.log(`▶ Login: POST http://localhost:${PORT}/api/auth/login`);
  console.log(`▶ Dev credentials: admin@migrahosting.com / admin123`);
});
