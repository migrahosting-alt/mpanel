# MPanel API Examples

Complete examples for using the MPanel API.

## Authentication

All API requests (except health check) require authentication using JWT tokens.

### Get Token (Mock Example)

```bash
# In production, implement proper authentication endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

## Products

### Create a Hosting Product

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Web Hosting",
    "description": "Premium shared hosting with 100GB storage",
    "type": "hosting",
    "billingCycle": "monthly",
    "price": 29.99,
    "setupFee": 0,
    "currency": "USD",
    "taxable": true,
    "metadata": {
      "storage": "100GB",
      "bandwidth": "unlimited",
      "databases": 25,
      "emails": "unlimited"
    }
  }'
```

### Create a Domain Product with TLD

```bash
# Step 1: Create domain product
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Domain Registration",
    "description": "Domain registration services",
    "type": "domain",
    "billingCycle": "annually",
    "price": 12.99,
    "currency": "USD",
    "taxable": true
  }'

# Step 2: Add TLD pricing (replace PRODUCT_ID)
curl -X POST http://localhost:3000/api/products/PRODUCT_ID/tlds \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tld": "com",
    "registerPrice": 12.99,
    "renewPrice": 12.99,
    "transferPrice": 12.99,
    "icannFee": 0.18,
    "minYears": 1,
    "maxYears": 10,
    "autoRenew": true
  }'
```

### List All Products

```bash
curl -X GET http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### List Products by Type

```bash
curl -X GET "http://localhost:3000/api/products?type=hosting" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Single Product

```bash
curl -X GET http://localhost:3000/api/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Product

```bash
curl -X PUT http://localhost:3000/api/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 24.99,
    "description": "Updated description"
  }'
```

## Subscriptions

### Create Subscription

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-uuid",
    "productId": "product-uuid",
    "billingCycle": "monthly",
    "price": 29.99,
    "nextBillingDate": "2024-12-01",
    "autoRenew": true,
    "metadata": {
      "server": "server01",
      "ip": "192.168.1.100"
    }
  }'
```

### List Customer Subscriptions

```bash
curl -X GET "http://localhost:3000/api/subscriptions?customerId=CUSTOMER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### List Active Subscriptions

```bash
curl -X GET "http://localhost:3000/api/subscriptions?customerId=CUSTOMER_ID&status=active" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Cancel Subscription

```bash
curl -X POST http://localhost:3000/api/subscriptions/SUBSCRIPTION_ID/cancel \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Suspend Subscription

```bash
curl -X POST http://localhost:3000/api/subscriptions/SUBSCRIPTION_ID/suspend \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Reactivate Subscription

```bash
curl -X POST http://localhost:3000/api/subscriptions/SUBSCRIPTION_ID/reactivate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Invoices

### Create Invoice

```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-uuid",
    "invoiceNumber": "INV-2024-000001",
    "items": [
      {
        "description": "Premium Web Hosting - Monthly",
        "quantity": 1,
        "unitPrice": 29.99,
        "amount": 29.99,
        "taxable": true,
        "productId": "product-uuid",
        "subscriptionId": "subscription-uuid"
      },
      {
        "description": "Setup Fee",
        "quantity": 1,
        "unitPrice": 10.00,
        "amount": 10.00,
        "taxable": true
      }
    ],
    "taxRate": 0.10,
    "currency": "USD",
    "dueDate": "2024-12-31",
    "notes": "Thank you for your business!"
  }'
```

### List Customer Invoices

```bash
curl -X GET "http://localhost:3000/api/invoices?customerId=CUSTOMER_ID&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Single Invoice

```bash
curl -X GET http://localhost:3000/api/invoices/INVOICE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Due Invoices

```bash
curl -X GET http://localhost:3000/api/invoices/due \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Pay Invoice with Stripe

```bash
curl -X POST http://localhost:3000/api/invoices/INVOICE_ID/pay \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "stripe",
    "paymentToken": "tok_visa"
  }'
```

### Pay Invoice with Account Credit

```bash
curl -X POST http://localhost:3000/api/invoices/INVOICE_ID/pay \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "credit"
  }'
```

## Complete Workflow Example

### 1. Create a Product

```bash
PRODUCT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Starter Hosting",
    "type": "hosting",
    "billingCycle": "monthly",
    "price": 9.99
  }')

PRODUCT_ID=$(echo $PRODUCT_RESPONSE | jq -r '.id')
echo "Created product: $PRODUCT_ID"
```

### 2. Create a Subscription

```bash
SUBSCRIPTION_RESPONSE=$(curl -s -X POST http://localhost:3000/api/subscriptions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerId\": \"$CUSTOMER_ID\",
    \"productId\": \"$PRODUCT_ID\",
    \"billingCycle\": \"monthly\",
    \"price\": 9.99,
    \"nextBillingDate\": \"2024-12-01\"
  }")

SUBSCRIPTION_ID=$(echo $SUBSCRIPTION_RESPONSE | jq -r '.id')
echo "Created subscription: $SUBSCRIPTION_ID"
```

### 3. Generate Invoice

```bash
INVOICE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerId\": \"$CUSTOMER_ID\",
    \"invoiceNumber\": \"INV-2024-$(date +%s)\",
    \"items\": [{
      \"subscriptionId\": \"$SUBSCRIPTION_ID\",
      \"productId\": \"$PRODUCT_ID\",
      \"description\": \"Starter Hosting - Monthly\",
      \"quantity\": 1,
      \"unitPrice\": 9.99,
      \"amount\": 9.99,
      \"taxable\": true
    }],
    \"taxRate\": 0.10,
    \"currency\": \"USD\",
    \"dueDate\": \"2024-12-31\"
  }")

INVOICE_ID=$(echo $INVOICE_RESPONSE | jq -r '.id')
echo "Created invoice: $INVOICE_ID"
```

### 4. Process Payment

```bash
PAYMENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/invoices/$INVOICE_ID/pay \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "stripe",
    "paymentToken": "tok_visa"
  }')

echo "Payment processed: $PAYMENT_RESPONSE"
```

## Health Check

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-11-05T07:35:21.068Z",
  "version": "v1"
}
```

## Metrics (Prometheus)

```bash
curl http://localhost:3000/api/metrics
```

## Error Handling

All errors follow this format:

```json
{
  "error": "Error message",
  "errors": [
    {
      "field": "field_name",
      "message": "Validation error message"
    }
  ]
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API is rate limited to 100 requests per 15 minutes per IP address.

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699174521
```

## Pagination

List endpoints support pagination:

```bash
curl -X GET "http://localhost:3000/api/invoices?customerId=ID&limit=20&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Parameters:
- `limit` - Number of items per page (default: 10, max: 100)
- `offset` - Number of items to skip (default: 0)

## Testing with Postman

Import this collection URL:
```
https://your-domain.com/postman/mpanel-collection.json
```

Or create a new collection with the examples above.

## WebSocket (Future)

Real-time updates will be available via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (event) => {
  console.log('Update:', JSON.parse(event.data));
};
```

## SDK (Future)

```javascript
import { MPanel } from '@mpanel/sdk';

const client = new MPanel({
  apiKey: 'your-api-key',
  apiUrl: 'http://localhost:3000'
});

const products = await client.products.list();
const invoice = await client.invoices.create({...});
```
