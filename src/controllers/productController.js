import Product from '../models/Product.js';
import logger from '../config/logger.js';

export const createProduct = async (req, res) => {
  try {
    const productData = {
      tenantId: req.user.tenantId,
      ...req.body
    };

    const product = await Product.create(productData);
    
    logger.info(`Product created: ${product.id}`, { userId: req.user.id });
    res.status(201).json(product);
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const getProducts = async (req, res) => {
  try {
    const { type } = req.query;
    const products = await Product.findByTenant(req.user.tenantId, type);
    res.json(products);
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.update(req.params.id, req.body);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    logger.info(`Product updated: ${product.id}`, { userId: req.user.id });
    res.json(product);
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await Product.delete(req.params.id);
    logger.info(`Product deleted: ${req.params.id}`, { userId: req.user.id });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    logger.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

export const addTLD = async (req, res) => {
  try {
    const tld = await Product.addTLD(req.params.id, req.body);
    logger.info(`TLD added to product: ${req.params.id}`, { userId: req.user.id });
    res.status(201).json(tld);
  } catch (error) {
    logger.error('Error adding TLD:', error);
    res.status(500).json({ error: 'Failed to add TLD' });
  }
};

export const getTLDs = async (req, res) => {
  try {
    const tlds = await Product.getTLDs(req.params.id);
    res.json(tlds);
  } catch (error) {
    logger.error('Error fetching TLDs:', error);
    res.status(500).json({ error: 'Failed to fetch TLDs' });
  }
};
