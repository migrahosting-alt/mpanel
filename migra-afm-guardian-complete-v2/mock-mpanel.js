/**
 * Mock mPanel API Server
 * 
 * Simple HTTP server that mimics mPanel user summary endpoint
 * for testing Abigail AFM Guardian without full mPanel backend
 * 
 * Run: node mock-mpanel.js
 * Then set MPANEL_API_URL=http://host.docker.internal:3001 in .env
 */

const http = require('http');
const url = require('url');

// Mock user database
const MOCK_USERS = {
  'john@example.com': {
    email: 'john@example.com',
    plans: ['Web Hosting Premium', 'Email Hosting'],
    invoices: 3,
    tickets: 2
  },
  'jane@migrahosting.com': {
    email: 'jane@migrahosting.com',
    plans: ['Dedicated Server', 'SSL Certificate'],
    invoices: 0,
    tickets: 0
  },
  'support@elizefoundation.org': {
    email: 'support@elizefoundation.org',
    plans: ['VPS Hosting', 'Backup Service'],
    invoices: 1,
    tickets: 5
  }
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (parsedUrl.pathname === '/health') {
    console.log('[Mock mPanel] GET /health');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, service: 'mock-mpanel' }));
    return;
  }
  
  if (parsedUrl.pathname === '/users/summary') {
    const query = parsedUrl.query.q;
    
    console.log(`[Mock mPanel] GET /users/summary?q=${query}`);
    
    if (!query) {
      res.writeHead(400);
      res.end(JSON.stringify({
        error: 'invalid_query',
        detail: 'Query parameter "q" is required'
      }));
      return;
    }

    // Check if user exists in mock database
    const user = MOCK_USERS[query.toLowerCase()];
    
    if (user) {
      console.log(`[Mock mPanel] Found user: ${query}`);
      res.writeHead(200);
      res.end(JSON.stringify(user));
      return;
    }

    // Default response for unknown users
    console.log(`[Mock mPanel] Unknown user, returning default: ${query}`);
    res.writeHead(200);
    res.end(JSON.stringify({
      email: query,
      plans: ['Web Hosting Basic'],
      invoices: 0,
      tickets: 0
    }));
    return;
  }
  
  // 404 for other routes
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not_found' }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🎭 Mock mPanel API Server running on http://localhost:${PORT}`);
  console.log(`\n📋 Mock users available:`);
  Object.keys(MOCK_USERS).forEach(email => {
    console.log(`   - ${email}`);
  });
  console.log(`\n🔧 Update .env with: MPANEL_API_URL=http://host.docker.internal:${PORT}\n`);
});
