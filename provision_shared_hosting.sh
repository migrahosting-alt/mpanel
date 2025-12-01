#!/usr/bin/env bash
set -euo pipefail

###
# MigraHosting Shared Hosting Provisioning Script
# Called by provision-worker.js to create actual hosting accounts
###

USERNAME="$1"           # Linux user to create, e.g. mhabcdef1234
CUSTOMER_EMAIL="$2"     # For logs / future notifications
ORDER_ID="$3"
ITEMS_JSON="${4:-{}}"   # Subscription metadata

WEB_ROOT_BASE="/srv/web/clients"
LOG_DIR="/var/log/migrahosting"
SITE_ROOT="${WEB_ROOT_BASE}/${USERNAME}"

mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/provision_${ORDER_ID}.log"

{
  echo "════════════════════════════════════════════════════════"
  echo "  MigraHosting Auto-Provisioning"
  echo "════════════════════════════════════════════════════════"
  echo "Date : $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Order: ${ORDER_ID}"
  echo "User : ${USERNAME}"
  echo "Email: ${CUSTOMER_EMAIL}"
  echo "Meta : ${ITEMS_JSON}"
  echo ""

  # 1) Create Linux user if not exists
  if id "$USERNAME" >/dev/null 2>&1; then
    echo "✓ User ${USERNAME} already exists"
  else
    echo "→ Creating system user ${USERNAME}..."
    useradd \
      --system \
      --create-home \
      --home-dir "${SITE_ROOT}" \
      --shell /usr/sbin/nologin \
      "${USERNAME}"
    echo "✓ User created"
  fi

  # 2) Create directory structure
  echo "→ Creating directory structure..."
  mkdir -p "${SITE_ROOT}/public"
  mkdir -p "${SITE_ROOT}/logs"
  mkdir -p "${SITE_ROOT}/backups"
  mkdir -p "${SITE_ROOT}/.ssh"

  # 3) Create welcome page
  echo "→ Creating welcome page..."
  cat > "${SITE_ROOT}/public/index.html" <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to MigraHosting</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #050816 0%, #0a1128 100%);
      color: #f9fafb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      width: 100%;
    }
    .card {
      background: linear-gradient(135deg, rgba(17,24,39,0.8), rgba(2,6,23,0.9));
      border: 1px solid rgba(129,140,248,0.2);
      border-radius: 24px;
      padding: 48px 40px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      backdrop-filter: blur(10px);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 999px;
      background: linear-gradient(135deg, rgba(129,140,248,0.2), rgba(139,92,246,0.2));
      border: 1px solid rgba(129,140,248,0.3);
      color: #a5b4fc;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .badge svg {
      width: 16px;
      height: 16px;
    }
    h1 {
      font-size: 36px;
      font-weight: 800;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p {
      color: #d1d5db;
      line-height: 1.7;
      margin-bottom: 12px;
    }
    .info-box {
      background: rgba(17,24,39,0.6);
      border: 1px solid rgba(129,140,248,0.15);
      border-radius: 12px;
      padding: 20px;
      margin-top: 24px;
    }
    .info-box h3 {
      color: #818cf8;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-box ul {
      list-style: none;
      padding: 0;
    }
    .info-box li {
      padding: 8px 0;
      color: #9ca3af;
      font-size: 14px;
      border-bottom: 1px solid rgba(129,140,248,0.1);
    }
    .info-box li:last-child {
      border-bottom: none;
    }
    .info-box strong {
      color: #f9fafb;
      font-weight: 500;
    }
    .cta {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid rgba(129,140,248,0.15);
      text-align: center;
    }
    .cta a {
      display: inline-block;
      padding: 12px 32px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .cta a:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(99,102,241,0.4);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="badge">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Active & Ready
      </div>
      
      <h1>Your Hosting is Live!</h1>
      
      <p>Welcome to MigraHosting. Your hosting space has been provisioned and is ready to use.</p>
      
      <p>This is a placeholder page. Upload your website files to get started.</p>
      
      <div class="info-box">
        <h3>Quick Start</h3>
        <ul>
          <li><strong>Upload files</strong> via SFTP or File Manager</li>
          <li><strong>Install apps</strong> from the control panel</li>
          <li><strong>Manage domains</strong> and email accounts</li>
          <li><strong>View logs</strong> and monitor performance</li>
        </ul>
      </div>
      
      <div class="cta">
        <a href="https://migrapanel.com">Go to Control Panel →</a>
      </div>
    </div>
  </div>
</body>
</html>
EOF

  # 4) Set proper ownership and permissions
  echo "→ Setting permissions..."
  chown -R "${USERNAME}:${USERNAME}" "${SITE_ROOT}"
  chmod 750 "${SITE_ROOT}"
  chmod 755 "${SITE_ROOT}/public"
  chmod 644 "${SITE_ROOT}/public/index.html"

  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "✅ Provisioning Complete"
  echo "════════════════════════════════════════════════════════"
  echo "Username: ${USERNAME}"
  echo "Web Root: ${SITE_ROOT}/public"
  echo "Logs    : ${SITE_ROOT}/logs"
  echo ""

} >> "${LOG_FILE}" 2>&1

# Output success message for worker to capture
echo "OK: Provisioned ${USERNAME} for order ${ORDER_ID}"
exit 0
