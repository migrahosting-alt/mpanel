import 'dotenv/config';
import { Worker } from 'bullmq';
import pg from 'pg';
import acme from 'acme-client';

const { Client } = pg;

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
};

// PostgreSQL client
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
});
pgClient.connect().catch(console.error);

async function issueLetsEncrypt(domainId) {
  // 1) Load domain + SSL row from DB
  const { rows } = await pgClient.query(
    `SELECT d.domain_name, s.id as ssl_id
     FROM domains d
     JOIN ssl_certificates s ON s.domain_id = d.id
     WHERE d.id = $1
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [domainId]
  );
  if (rows.length === 0) throw new Error('Domain/SSL record not found');

  const { domain_name, ssl_id } = rows[0];

  console.log(`[SSL Worker] Issuing certificate for ${domain_name}...`);

  // 2) Configure ACME client
  const client = new acme.Client({
    directoryUrl: acme.directory.letsencrypt.staging, // switch to .production later
    accountKey: await acme.forge.createPrivateKey(),
  });

  const [key, csr] = await acme.forge.createCsr({
    commonName: domain_name,
  });

  // 3) Issue certificate with HTTP-01 challenge
  const cert = await client.auto({
    csr,
    email: 'admin@migrahosting.com',
    termsOfServiceAgreed: true,
    challengeCreateFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type === 'http-01') {
        // Place challenge file in web root
        const challengePath = `.well-known/acme-challenge/${challenge.token}`;
        await pgClient.query(
          `INSERT INTO acme_challenges (domain_id, token, key_authorization, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (token) DO UPDATE SET key_authorization = $3`,
          [domainId, challenge.token, keyAuthorization]
        );
        console.log(`[SSL Worker] HTTP-01 challenge created: ${challengePath}`);
        // Your web server should serve this from /.well-known/acme-challenge/
      } else if (challenge.type === 'dns-01') {
        // Create DNS TXT record _acme-challenge.domain.com
        console.log(`[SSL Worker] DNS-01 challenge - add TXT record: ${keyAuthorization}`);
        // TODO: Integrate with your DNS provider API
      }
    },
    challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type === 'http-01') {
        await pgClient.query(
          `DELETE FROM acme_challenges WHERE token = $1`,
          [challenge.token]
        );
        console.log(`[SSL Worker] HTTP-01 challenge removed: ${challenge.token}`);
      } else if (challenge.type === 'dns-01') {
        console.log(`[SSL Worker] DNS-01 challenge - remove TXT record`);
        // TODO: Remove DNS TXT record via your DNS provider API
      }
    },
  });

  // 4) Save cert + key in DB
  await pgClient.query(
    `UPDATE ssl_certificates
     SET status = 'issued',
         certificate_pem = $1,
         private_key_pem = $2,
         issued_at = NOW()
     WHERE id = $3`,
    [cert, key.toString(), ssl_id]
  );

  console.log(`[SSL Worker] Certificate issued for ${domain_name}`);
}

// Start worker
new Worker(
  'ssl-issuance',
  async (job) => {
    const { domainId } = job.data;
    await issueLetsEncrypt(domainId);
  },
  { connection }
);

console.log('[SSL Worker] Started and listening for jobs...');

/**
 * Renew an existing SSL certificate
 */
export async function renewCertificate(certificateId, domain, email) {
  console.log(`[SSL Worker] Renewing certificate for ${domain}...`);

  // Configure ACME client
  const client = new acme.Client({
    directoryUrl: acme.directory.letsencrypt.staging, // switch to .production later
    accountKey: await acme.forge.createPrivateKey(),
  });

  const [key, csr] = await acme.forge.createCsr({
    commonName: domain,
  });

  // Get domain ID from certificate
  const certResult = await pgClient.query(
    `SELECT domain_id FROM ssl_certificates WHERE id = $1`,
    [certificateId]
  );
  const domainId = certResult.rows[0]?.domain_id;

  // Issue new certificate
  const cert = await client.auto({
    csr,
    email: email || 'admin@migrahosting.com',
    termsOfServiceAgreed: true,
    challengeCreateFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type === 'http-01') {
        await pgClient.query(
          `INSERT INTO acme_challenges (domain_id, token, key_authorization, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (token) DO UPDATE SET key_authorization = $3`,
          [domainId, challenge.token, keyAuthorization]
        );
        console.log(`[SSL Worker] HTTP-01 challenge created for renewal: ${challenge.token}`);
      }
    },
    challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type === 'http-01') {
        await pgClient.query(
          `DELETE FROM acme_challenges WHERE token = $1`,
          [challenge.token]
        );
        console.log(`[SSL Worker] HTTP-01 challenge removed: ${challenge.token}`);
      }
    },
  });

  // Update certificate in database
  await pgClient.query(
    `UPDATE ssl_certificates
     SET certificate_pem = $1,
         private_key_pem = $2,
         issued_at = NOW(),
         expires_at = NOW() + INTERVAL '90 days'
     WHERE id = $3`,
    [cert, key.toString(), certificateId]
  );

  console.log(`[SSL Worker] Certificate renewed for ${domain}`);
  return { success: true, domain };
}

export default { renewCertificate };
