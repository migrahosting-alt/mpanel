-- Enterprise Setup Verification Script
-- Run this anytime to verify database health

\echo '=== ENTERPRISE SETUP VERIFICATION ==='
\echo ''

-- 1. Index Coverage
\echo '1. INDEX COVERAGE:'
SELECT 
    'Total Indexes: ' || COUNT(*)::text as metric
FROM pg_indexes WHERE schemaname = 'public';

SELECT 
    'FK Constraints: ' || COUNT(*)::text as metric
FROM pg_constraint WHERE contype = 'f';

SELECT 
    'Missing FK Indexes: ' || COUNT(*)::text as metric
FROM (
    SELECT c.conrelid::regclass
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
      )
) missing;

\echo ''

-- 2. CloudPods Features
\echo '2. CLOUDPODS ENTERPRISE FEATURES:'
SELECT 
    'idempotency_key column: ' || 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cloud_pod_jobs' AND column_name = 'idempotency_key'
    ) THEN '✓ Present' ELSE '✗ Missing' END as status;

SELECT 
    'CloudPod tables indexed: ' || COUNT(DISTINCT tablename)::text || '/24'
FROM pg_indexes 
WHERE schemaname = 'public' AND tablename LIKE 'cloud_pod%';

\echo ''

-- 3. Multi-Tenant Indexes
\echo '3. MULTI-TENANT PERFORMANCE INDEXES:'
SELECT 
    indexname,
    CASE WHEN indexname IS NOT NULL THEN '✓' ELSE '✗' END as status
FROM (VALUES 
    ('subscriptions_tenant_id_status_idx'),
    ('subscriptions_tenant_id_customer_id_idx'),
    ('websites_tenant_id_status_idx'),
    ('deployments_tenant_id_status_idx'),
    ('mailboxes_tenant_id_status_idx'),
    ('backups_tenant_id_status_idx'),
    ('ssl_certificates_tenant_id_idx')
) v(idx_name)
LEFT JOIN pg_indexes ON indexname = idx_name AND schemaname = 'public';

\echo ''

-- 4. Database Health
\echo '4. DATABASE HEALTH:'
SELECT 
    'Database Size: ' || pg_size_pretty(pg_database_size(current_database())) as metric;

SELECT 
    'Total Tables: ' || COUNT(*)::text as metric
FROM information_schema.tables WHERE table_schema = 'public';

\echo ''

-- 5. Top Tables by Size
\echo '5. TOP 5 TABLES BY SIZE:'
SELECT 
    relname as table_name,
    n_live_tup as rows,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as size,
    CASE 
        WHEN seq_scan + idx_scan > 0 
        THEN ROUND(100.0 * idx_scan / (idx_scan + seq_scan), 1)::text || '%'
        ELSE 'N/A'
    END as index_usage
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_live_tup > 0
ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
LIMIT 5;

\echo ''
\echo '=== VERIFICATION COMPLETE ==='
