import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
  max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
});

pool.on('connect', () => {
  console.log('Database pool connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

const transformUser = (dbUser, tenant = null) => {
  return {
    ...dbUser,
    isActive: dbUser.status === 'ACTIVE',
    emailVerified: dbUser.email_verified,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    passwordHash: dbUser.password_hash,
    tenantId: dbUser.tenant_id,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
    roleId: dbUser.role_id,
    tenant: tenant || undefined,
  };
};

const transformTenant = (dbTenant) => {
  return {
    ...dbTenant,
    isActive: dbTenant.status === 'ACTIVE',
    createdAt: dbTenant.created_at,
    updatedAt: dbTenant.updated_at,
  };
};

export const prisma = {
  user: {
    findUnique: async ({ where, include }) => {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1 OR email = $2 LIMIT 1', 
        [where.id || null, where.email || null]
      );
      
      if (result.rows.length === 0) return null;
      
      const user = result.rows[0];
      let tenant = null;
      
      if (include?.tenant && user.tenant_id) {
        const tenantResult = await pool.query(
          'SELECT * FROM tenants WHERE id = $1', 
          [user.tenant_id]
        );
        if (tenantResult.rows.length > 0) {
          tenant = transformTenant(tenantResult.rows[0]);
        }
      }
      
      return transformUser(user, tenant);
    },
    findMany: async () => {
      const result = await pool.query('SELECT * FROM users');
      return result.rows.map(user => transformUser(user));
    },
    update: async ({ where }) => {
      return prisma.user.findUnique({ where });
    },
  },
  
  product: {
    findMany: async ({ where = {}, include = {}, orderBy = {} } = {}) => {
      let query = "SELECT p.* FROM products p WHERE 1=1";
      const params = [];
      let paramCount = 1;
      
      // Always require tenant_id to be non-null (filter out orphaned products)
      query += ` AND p.tenant_id IS NOT NULL`;
      
      if (where.tenantId) {
        query += ` AND p.tenant_id = $${paramCount++}`;
        params.push(where.tenantId);
      }
      if (where.isActive !== undefined) {
        query += ` AND p.status = $${paramCount++}`;
        params.push(where.isActive ? 'active' : 'inactive');
      }
      
      // Support Prisma-style nested where for prices.some
      if (where.prices?.some) {
        // Check if product has at least one price matching the criteria
        query += ` AND EXISTS (SELECT 1 FROM prices pr WHERE pr.product_id = p.id`;
        if (where.prices.some.isActive !== undefined) {
          query += ` AND pr.is_active = $${paramCount++}`;
          params.push(where.prices.some.isActive);
        }
        query += `)`;
      }
      
      // Handle orderBy (Prisma-style)
      if (orderBy.createdAt) {
        query += ` ORDER BY p.created_at ${orderBy.createdAt === 'asc' ? 'ASC' : 'DESC'}`;
      } else {
        query += " ORDER BY p.created_at ASC";
      }
      
      const result = await pool.query(query, params);
      
      const products = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        slug: row.metadata?.slug || row.code,
        type: row.type.toUpperCase(),
        description: row.description,
        tenantId: row.tenant_id,
        isActive: row.status === 'active',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      
      // Include prices if requested
      if (include.prices && products.length > 0) {
        const productIds = products.map(p => p.id);
        
        // Build price query with optional where and orderBy
        let priceQuery = "SELECT * FROM prices WHERE product_id = ANY($1)";
        const priceParams = [productIds];
        let priceParamCount = 2;
        
        // Support include.prices.where
        if (include.prices.where?.isActive !== undefined) {
          priceQuery += ` AND is_active = $${priceParamCount++}`;
          priceParams.push(include.prices.where.isActive);
        } else {
          // Default to active prices only
          priceQuery += " AND is_active = true";
        }
        
        // Support include.prices.orderBy (Prisma-style array)
        if (include.prices.orderBy && Array.isArray(include.prices.orderBy)) {
          const orderClauses = [];
          include.prices.orderBy.forEach(orderItem => {
            if (orderItem.isPopular) {
              orderClauses.push(`(CASE WHEN billing_cycle = 'yearly' THEN 0 ELSE 1 END) ${orderItem.isPopular === 'desc' ? 'DESC' : 'ASC'}`);
            }
            if (orderItem.amountCents) {
              orderClauses.push(`unit_amount ${orderItem.amountCents === 'asc' ? 'ASC' : 'DESC'}`);
            }
          });
          if (orderClauses.length > 0) {
            priceQuery += ` ORDER BY ${orderClauses.join(', ')}`;
          }
        } else {
          // Default ordering
          priceQuery += " ORDER BY unit_amount ASC";
        }
        
        const pricesResult = await pool.query(priceQuery, priceParams);
        
        const pricesByProduct = {};
        pricesResult.rows.forEach(row => {
          if (!pricesByProduct[row.product_id]) {
            pricesByProduct[row.product_id] = [];
          }
          pricesByProduct[row.product_id].push({
            id: row.id,
            productId: row.product_id,
            tenantId: row.tenant_id || null,
            name: `${row.billing_cycle}`,
            slug: `${row.billing_cycle}`,
            interval: row.billing_cycle.toUpperCase(),
            amountCents: row.unit_amount,
            currency: row.currency,
            isPopular: row.billing_cycle === 'yearly',
            isActive: row.is_active,
            stripePriceId: row.stripe_price_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          });
        });
        
        products.forEach(product => {
          product.prices = pricesByProduct[product.id] || [];
        });
      }
      
      return products;
    },
    
    findFirst: async ({ where = {}, include = {} } = {}) => {
      const products = await prisma.product.findMany({ where, include });
      return products[0] || null;
    },
    
    findUnique: async ({ where = {}, include = {} } = {}) => {
      if (where.slug) {
        const result = await pool.query(
          "SELECT * FROM products WHERE metadata->>'slug' = $1 OR code = $1 LIMIT 1",
          [where.slug]
        );
        if (result.rows.length === 0) return null;
        
        const product = {
          id: result.rows[0].id,
          name: result.rows[0].name,
          slug: result.rows[0].metadata?.slug || result.rows[0].code,
          type: result.rows[0].type.toUpperCase(),
          description: result.rows[0].description,
          tenantId: result.rows[0].tenant_id,
          isActive: result.rows[0].status === 'active',
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at,
        };
        
        if (include.prices) {
          const pricesResult = await pool.query(
            "SELECT * FROM prices WHERE product_id = $1 AND is_active = true ORDER BY unit_amount ASC",
            [product.id]
          );
          product.prices = pricesResult.rows.map(row => ({
            id: row.id,
            productId: row.product_id,
            name: row.billing_cycle,
            slug: row.billing_cycle,
            interval: row.billing_cycle.toUpperCase(),
            amountCents: row.unit_amount,
            currency: row.currency,
            isPopular: row.billing_cycle === 'yearly',
            isActive: row.is_active,
            stripePriceId: row.stripe_price_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        }
        
        return product;
      }
      if (where.id) {
        return prisma.product.findFirst({ where: { id: where.id }, include });
      }
      return null;
    },
    
    create: async ({ data = {}, include = {} } = {}) => {
      const query = `
        INSERT INTO products (name, code, type, description, tenant_id, price, currency, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
        RETURNING *
      `;
      const result = await pool.query(query, [
        data.name,
        data.slug,
        data.type.toLowerCase(),
        data.description,
        data.tenantId,
        0,
        'USD',
        JSON.stringify({ slug: data.slug }),
      ]);
      
      return {
        id: result.rows[0].id,
        name: result.rows[0].name,
        slug: data.slug,
        type: result.rows[0].type.toUpperCase(),
        description: result.rows[0].description,
        tenantId: result.rows[0].tenant_id,
        isActive: true,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
        prices: include.prices ? [] : undefined,
      };
    },
    
    update: async ({ where = {}, data = {}, include = {} } = {}) => {
      const setClauses = [];
      const params = [];
      let paramCount = 1;
      
      if (data.name !== undefined) {
        setClauses.push(`name = $${paramCount++}`);
        params.push(data.name);
      }
      if (data.description !== undefined) {
        setClauses.push(`description = $${paramCount++}`);
        params.push(data.description);
      }
      if (data.isActive !== undefined) {
        setClauses.push(`status = $${paramCount++}`);
        params.push(data.isActive ? 'active' : 'inactive');
      }
      
      setClauses.push(`updated_at = NOW()`);
      
      const query = `
        UPDATE products
        SET ${setClauses.join(", ")}
        WHERE id = $${paramCount++}
        ${where.tenantId ? `AND tenant_id = $${paramCount++}` : ""}
        RETURNING *
      `;
      
      params.push(where.id);
      if (where.tenantId) {
        params.push(where.tenantId);
      }
      
      const result = await pool.query(query, params);
      
      if (result.rows.length === 0) {
        throw new Error("Product not found");
      }
      
      const product = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        slug: result.rows[0].metadata?.slug || result.rows[0].code,
        type: result.rows[0].type.toUpperCase(),
        description: result.rows[0].description,
        tenantId: result.rows[0].tenant_id,
        isActive: result.rows[0].status === 'active',
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };
      
      if (include.prices) {
        const pricesResult = await pool.query(
          "SELECT * FROM prices WHERE product_id = $1 AND is_active = true ORDER BY unit_amount ASC",
          [product.id]
        );
        product.prices = pricesResult.rows.map(row => ({
          id: row.id,
          productId: row.product_id,
          name: row.billing_cycle,
          slug: row.billing_cycle,
          interval: row.billing_cycle.toUpperCase(),
          amountCents: row.unit_amount,
          currency: row.currency,
          isPopular: row.billing_cycle === 'yearly',
          isActive: row.is_active,
          stripePriceId: row.stripe_price_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
      }
      
      return product;
    },
  },
  
  price: {
    create: async ({ data = {} } = {}) => {
      const query = `
        INSERT INTO prices (product_id, billing_cycle, unit_amount, currency, stripe_price_id, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
      `;
      const result = await pool.query(query, [
        data.productId,
        data.interval.toLowerCase(),
        data.amountCents,
        data.currency || "usd",
        data.stripePriceId || null,
      ]);
      
      return {
        id: result.rows[0].id,
        productId: result.rows[0].product_id,
        name: result.rows[0].billing_cycle,
        slug: result.rows[0].billing_cycle,
        interval: result.rows[0].billing_cycle.toUpperCase(),
        amountCents: result.rows[0].unit_amount,
        currency: result.rows[0].currency,
        isPopular: result.rows[0].billing_cycle === 'yearly',
        isActive: result.rows[0].is_active,
        stripePriceId: result.rows[0].stripe_price_id,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };
    },
    
    update: async ({ where = {}, data = {} } = {}) => {
      const setClauses = [];
      const params = [];
      let paramCount = 1;
      
      if (data.isActive !== undefined) {
        setClauses.push(`is_active = $${paramCount++}`);
        params.push(data.isActive);
      }
      if (data.amountCents !== undefined) {
        setClauses.push(`unit_amount = $${paramCount++}`);
        params.push(data.amountCents);
      }
      
      setClauses.push(`updated_at = NOW()`);
      
      const query = `
        UPDATE prices
        SET ${setClauses.join(", ")}
        WHERE id = $${paramCount++}
        RETURNING *
      `;
      
      params.push(where.id);
      
      const result = await pool.query(query, params);
      
      if (result.rows.length === 0) {
        throw new Error("Price not found");
      }
      
      return {
        id: result.rows[0].id,
        productId: result.rows[0].product_id,
        name: result.rows[0].billing_cycle,
        slug: result.rows[0].billing_cycle,
        interval: result.rows[0].billing_cycle.toUpperCase(),
        amountCents: result.rows[0].unit_amount,
        currency: result.rows[0].currency,
        isPopular: result.rows[0].billing_cycle === 'yearly',
        isActive: result.rows[0].is_active,
        stripePriceId: result.rows[0].stripe_price_id,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };
    },
    
    findUnique: async ({ where = {}, include = {} } = {}) => {
      let query = "SELECT * FROM prices WHERE ";
      const params = [];
      
      if (where.id) {
        query += "id = $1";
        params.push(where.id);
      } else {
        return null;
      }
      
      const result = await pool.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const price = {
        id: result.rows[0].id,
        productId: result.rows[0].product_id,
        name: result.rows[0].billing_cycle,
        slug: result.rows[0].billing_cycle,
        interval: result.rows[0].billing_cycle.toUpperCase(),
        amountCents: result.rows[0].unit_amount,
        currency: result.rows[0].currency,
        isPopular: result.rows[0].billing_cycle === 'yearly',
        isActive: result.rows[0].is_active,
        stripePriceId: result.rows[0].stripe_price_id,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };
      
      if (include.product) {
        const productResult = await pool.query(
          "SELECT * FROM products WHERE id = $1",
          [price.productId]
        );
        if (productResult.rows.length > 0) {
          price.product = {
            id: productResult.rows[0].id,
            name: productResult.rows[0].name,
            slug: productResult.rows[0].metadata?.slug || productResult.rows[0].code,
            type: productResult.rows[0].type.toUpperCase(),
            description: productResult.rows[0].description,
            tenantId: productResult.rows[0].tenant_id,
            isActive: productResult.rows[0].status === 'active',
            createdAt: productResult.rows[0].created_at,
            updatedAt: productResult.rows[0].updated_at,
          };
        }
      }
      
      return price;
    },
  },
};

export default pool;
