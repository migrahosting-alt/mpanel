# Domain Pricing Automation System

## 📋 Overview

Automatic domain pricing system that syncs with NameSilo API to ensure your prices are always competitive while maintaining profitability.

### Key Features

✅ **Automatic Price Updates** - Fetches NameSilo wholesale prices daily  
✅ **Profit Margin Protection** - Ensures minimum profit on every domain  
✅ **TLD-Specific Rules** - Custom markup for premium TLDs (.io, .ai, etc.)  
✅ **Competitive Pricing** - Always slightly cheaper than big registrars  
✅ **Never Lose Money** - Automatic validation to prevent selling below cost  
✅ **Real-time API** - Public pricing API for marketing site integration  

---

## 🚀 Quick Setup

### Step 1: Create Database Table

```bash
# Run this SQL in PostgreSQL (adjust docker command if needed)
docker exec mpanel-postgres psql -U mpanel -d mpanel <<'EOF'
CREATE TABLE IF NOT EXISTS domain_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tld VARCHAR(50) UNIQUE NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  registration_price DECIMAL(10, 2) NOT NULL,
  renewal_price DECIMAL(10, 2) NOT NULL,
  transfer_price DECIMAL(10, 2) NOT NULL,
  profit_margin DECIMAL(5, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_updated TIMESTAMP,
  price_source VARCHAR(50) DEFAULT 'namesilo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_domain_pricing_tld ON domain_pricing(tld);
CREATE INDEX idx_domain_pricing_active ON domain_pricing(is_active);

CREATE TRIGGER update_domain_pricing_updated_at
  BEFORE UPDATE ON domain_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert popular TLDs with placeholder pricing
INSERT INTO domain_pricing (tld, cost_price, registration_price, renewal_price, transfer_price, profit_margin)
VALUES 
  ('.com', 9.99, 11.99, 11.99, 11.99, 20.02),
  ('.net', 11.99, 13.99, 13.99, 13.99, 16.68),
  ('.org', 11.99, 13.99, 13.99, 13.99, 16.68),
  ('.io', 39.99, 45.99, 45.99, 45.99, 15.00),
  ('.co', 24.99, 28.99, 28.99, 28.99, 16.01),
  ('.ai', 99.99, 109.99, 109.99, 109.99, 10.00)
ON CONFLICT (tld) DO NOTHING;
EOF
```

### Step 2: Add NameSilo API Key to `.env`

```bash
# NameSilo Configuration
NAMESILO_API_KEY=your_namesilo_api_key_here
NAMESILO_API_URL=https://www.namesilo.com/api
NAMESILO_SANDBOX=false
```

Get your API key from: https://www.namesilo.com/account/api-manager

### Step 3: Install Dependencies

```bash
npm install xml2js
```

### Step 4: Restart Server

```bash
npm run dev
```

---

## 🎯 Pricing Strategy

### Default Markup Rules

```javascript
// Default: 15% markup + minimum $1 profit
Cost: $9.99 → Customer Price: $11.99 (20% margin)
```

### TLD-Specific Rules

| TLD | Markup % | Min Profit | Example |
|-----|----------|------------|---------|
| `.com` | 12% | $1.50 | $9.99 → $11.99 |
| `.net` | 12% | $1.50 | $11.99 → $13.99 |
| `.org` | 12% | $1.50 | $11.99 → $13.99 |
| `.io` | 10% | $3.00 | $39.99 → $45.99 |
| `.ai` | 10% | $5.00 | $99.99 → $109.99 |
| `.co` | 15% | $2.00 | $24.99 → $28.99 |

### Customize Markup Rules

Edit `/src/services/domainPricingService.js`:

```javascript
const PRICING_CONFIG = {
  defaultMarkupPercent: 15, // Change default markup
  minimumProfitPerDomain: 1.00, // Change minimum profit
  
  tldMarkupRules: {
    '.com': { markupPercent: 12, minProfit: 1.50 },
    '.xyz': { markupPercent: 25, minProfit: 0.50 }, // Higher markup for cheap TLDs
    // Add your custom rules here
  },
};
```

---

## 🔄 Automatic Updates

### Cron Schedule

- **Frequency**: Every 24 hours
- **Time**: 3:00 AM server time
- **Trigger**: Automatic (no manual intervention)

### Update Threshold

Only updates prices if change > 2% to avoid constant small fluctuations.

```javascript
updateThresholdPercent: 2, // Only update if price changes by 2% or more
```

---

## 📡 API Endpoints

### Public Endpoints (No Auth)

#### Get All Domain Pricing
```http
GET /api/domain-pricing
```

Response:
```json
{
  "success": true,
  "count": 150,
  "data": [
    {
      "tld": ".com",
      "registration_price": 11.99,
      "renewal_price": 11.99,
      "transfer_price": 11.99,
      "profit_margin": 20.02
    }
  ]
}
```

#### Get Popular TLDs Only
```http
GET /api/domain-pricing/popular
```

Returns: .com, .net, .org, .io, .co, .ai, .app, .dev

#### Get Specific TLD
```http
GET /api/domain-pricing/com
GET /api/domain-pricing/.com  (both work)
```

### Admin Endpoints (Requires Auth)

#### Trigger Manual Price Update
```http
POST /api/domain-pricing/update
Authorization: Bearer <token>

{
  "force": true  // Skip 24-hour check
}
```

#### Get Pricing Statistics
```http
GET /api/domain-pricing/admin/stats
Authorization: Bearer <token>
```

Response:
```json
{
  "total_tlds": 150,
  "active_tlds": 145,
  "avg_profit_margin": 18.5,
  "min_price": 0.99,
  "max_price": 299.99,
  "last_update": "2025-11-16T03:00:00Z"
}
```

#### Audit Pricing (Compare with NameSilo)
```http
POST /api/domain-pricing/admin/audit
Authorization: Bearer <token>
```

#### Manual Price Adjustment
```http
PATCH /api/domain-pricing/.com
Authorization: Bearer <token>

{
  "registrationPrice": 12.99,
  "renewalPrice": 13.99,
  "isActive": true
}
```

---

## 🌐 Marketing Site Integration

### Display Pricing on Marketing Site

```javascript
// Fetch domain pricing
const response = await fetch('https://migrapanel.com/api/domain-pricing/popular');
const { data } = await response.json();

// Display on pricing page
data.forEach(domain => {
  console.log(`${domain.tld}: $${domain.registration_price}/year`);
});
```

### Example: Pricing Table

```html
<div id="domain-pricing"></div>

<script>
fetch('https://migrapanel.com/api/domain-pricing/popular')
  .then(res => res.json())
  .then(({ data }) => {
    const html = data.map(d => `
      <div class="pricing-card">
        <h3>${d.tld}</h3>
        <p class="price">$${d.registration_price}<span>/year</span></p>
        <button onclick="checkDomain('${d.tld}')">Check Availability</button>
      </div>
    `).join('');
    
    document.getElementById('domain-pricing').innerHTML = html;
  });
</script>
```

---

## 🛠️ Manual Operations

### Test Pricing Update

```bash
# Via API (admin only)
curl -X POST https://migrapanel.com/api/domain-pricing/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### Run Pricing Audit

```bash
# Check if any prices are unprofitable
curl -X POST https://migrapanel.com/api/domain-pricing/admin/audit \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Cron Job Status

```bash
# Check server logs
npm run dev
# Look for: "Domain pricing cron job scheduled: Daily at 3 AM"
```

---

## 🔍 Monitoring & Alerts

### Check Last Update Time

```bash
# Query database
SELECT MAX(last_updated) as last_price_update 
FROM domain_pricing;
```

### Find Unprofitable TLDs

```bash
# Query database
SELECT tld, cost_price, registration_price, profit_margin 
FROM domain_pricing 
WHERE registration_price <= cost_price;
```

### Price Change History (Future Enhancement)

Consider adding a `domain_pricing_history` table to track price changes over time.

---

## 🚨 Troubleshooting

### Prices Not Updating

1. Check NameSilo API key in `.env`
2. Verify cron job is running: `ps aux | grep node`
3. Check server logs for errors
4. Manually trigger update via API

### NameSilo API Errors

```bash
# Test API connection
curl "https://www.namesilo.com/api/getPrices?version=1&type=xml&key=YOUR_API_KEY"
```

### Database Connection Issues

```bash
# Verify table exists
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "\d domain_pricing"
```

---

## 📊 Best Practices

1. **Monitor Margins**: Check profit margins weekly
2. **Competitive Research**: Compare prices with GoDaddy/Namecheap monthly
3. **TLD Analysis**: Review which TLDs sell best and adjust margins
4. **Cost Alerts**: Set up alerts if NameSilo raises prices significantly
5. **Manual Overrides**: Use manual adjustments for promotions

---

## 🔐 Security Notes

- NameSilo API key is sensitive - never commit to Git
- Admin endpoints require authentication
- Public endpoints are read-only
- Audit logs track all manual price changes

---

## 📝 Future Enhancements

- [ ] Multi-registrar support (NameCheap, Google Domains)
- [ ] Promotional pricing (temporary discounts)
- [ ] Bulk pricing for resellers
- [ ] Price change notifications (email alerts)
- [ ] Historical price tracking
- [ ] Competitor price comparison API integration

---

## 📞 Support

For issues or questions:
- Check logs: `/var/log/mpanel/domain-pricing.log`
- GitHub Issues: https://github.com/migrahosting-alt/mpanel/issues
- Email: support@migrahosting.com

---

**Created:** November 16, 2025  
**Version:** 1.0.0  
**Registrar:** NameSilo  
**Update Frequency:** Every 24 hours
