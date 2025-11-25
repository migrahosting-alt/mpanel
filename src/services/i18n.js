// src/services/i18n.js
/**
 * Internationalization (i18n) service
 * Supports multiple languages with dynamic translation loading
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger.js';
import { cache, CacheNamespace, CacheTTL } from './cache.js';

class I18nService {
  constructor() {
    this.defaultLocale = process.env.DEFAULT_LOCALE || 'en';
    this.supportedLocales = (process.env.SUPPORTED_LOCALES || 'en,es,fr,de,pt,it').split(',');
    this.translations = new Map();
    this.fallbackChain = {
      'en-US': ['en', 'en-GB'],
      'en-GB': ['en', 'en-US'],
      'es-MX': ['es', 'es-ES'],
      'es-ES': ['es', 'es-MX'],
      'pt-BR': ['pt', 'pt-PT'],
      'pt-PT': ['pt', 'pt-BR'],
    };
  }

  /**
   * Load translations for a locale
   */
  async loadTranslations(locale) {
    // Check cache first
    const cached = await cache.get(CacheNamespace.STATS, `i18n:${locale}`);
    if (cached) {
      this.translations.set(locale, cached);
      return cached;
    }

    try {
      const translationsPath = path.join(process.cwd(), 'locales', `${locale}.json`);
      const data = await fs.readFile(translationsPath, 'utf-8');
      const translations = JSON.parse(data);

      this.translations.set(locale, translations);
      
      // Cache for 1 day
      await cache.set(CacheNamespace.STATS, `i18n:${locale}`, translations, CacheTTL.DAY);

      logger.info(`Loaded translations for locale: ${locale}`);
      return translations;
    } catch (error) {
      logger.error(`Failed to load translations for locale ${locale}:`, error);
      return null;
    }
  }

  /**
   * Initialize - load all supported locales
   */
  async initialize() {
    logger.info('Initializing i18n service');
    
    await Promise.all(
      this.supportedLocales.map(locale => this.loadTranslations(locale))
    );

    logger.info(`i18n initialized with ${this.supportedLocales.length} locales`);
  }

  /**
   * Get translation for key
   */
  t(locale, key, params = {}) {
    // Try requested locale
    let translation = this.getTranslation(locale, key);

    // Try fallback chain
    if (!translation && this.fallbackChain[locale]) {
      for (const fallback of this.fallbackChain[locale]) {
        translation = this.getTranslation(fallback, key);
        if (translation) break;
      }
    }

    // Try default locale
    if (!translation) {
      translation = this.getTranslation(this.defaultLocale, key);
    }

    // Return key if no translation found
    if (!translation) {
      logger.warn(`Missing translation: ${locale}.${key}`);
      return key;
    }

    // Replace parameters
    return this.interpolate(translation, params);
  }

  /**
   * Get translation from loaded data
   */
  getTranslation(locale, key) {
    const translations = this.translations.get(locale);
    if (!translations) return null;

    // Support nested keys: "common.greeting"
    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Interpolate parameters into translation
   */
  interpolate(template, params) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * Detect user's preferred locale from request
   */
  detectLocale(req) {
    // 1. Check query parameter
    if (req.query.lang && this.supportedLocales.includes(req.query.lang)) {
      return req.query.lang;
    }

    // 2. Check user settings
    if (req.user?.locale && this.supportedLocales.includes(req.user.locale)) {
      return req.user.locale;
    }

    // 3. Check Accept-Language header
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      const preferred = this.parseAcceptLanguage(acceptLanguage);
      for (const lang of preferred) {
        if (this.supportedLocales.includes(lang)) {
          return lang;
        }
      }
    }

    // 4. Default locale
    return this.defaultLocale;
  }

  /**
   * Parse Accept-Language header
   */
  parseAcceptLanguage(header) {
    return header
      .split(',')
      .map(lang => {
        const parts = lang.split(';');
        const code = parts[0].trim().toLowerCase();
        const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1.0;
        return { code, quality };
      })
      .sort((a, b) => b.quality - a.quality)
      .map(item => item.code);
  }

  /**
   * Get all translations for a locale
   */
  async getAllTranslations(locale) {
    if (!this.translations.has(locale)) {
      await this.loadTranslations(locale);
    }
    return this.translations.get(locale) || {};
  }

  /**
   * Update translation (hot reload)
   */
  async updateTranslation(locale, key, value) {
    const translations = this.translations.get(locale) || {};
    
    // Support nested keys
    const keys = key.split('.');
    let obj = translations;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    
    obj[keys[keys.length - 1]] = value;
    
    this.translations.set(locale, translations);
    
    // Update cache
    await cache.set(CacheNamespace.STATS, `i18n:${locale}`, translations, CacheTTL.DAY);
    
    logger.info(`Updated translation: ${locale}.${key}`);
  }

  /**
   * Get supported locales with metadata
   */
  getSupportedLocales() {
    return this.supportedLocales.map(code => ({
      code,
      name: this.getLocaleNameobject_locales_name(code),
      nativeName: this.getNativeName(code),
    }));
  }

  /**
   * Get locale name in English
   */
  getLocaleName(code) {
    const names = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      pt: 'Portuguese',
      it: 'Italian',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      ru: 'Russian',
      ar: 'Arabic',
    };
    return names[code] || code.toUpperCase();
  }

  /**
   * Get locale name in native language
   */
  getNativeName(code) {
    const names = {
      en: 'English',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      pt: 'Português',
      it: 'Italiano',
      zh: '中文',
      ja: '日本語',
      ko: '한국어',
      ru: 'Русский',
      ar: 'العربية',
    };
    return names[code] || code.toUpperCase();
  }

  /**
   * Format date according to locale
   */
  formatDate(date, locale, options = {}) {
    try {
      return new Intl.DateTimeFormat(locale, options).format(new Date(date));
    } catch (error) {
      return new Date(date).toISOString();
    }
  }

  /**
   * Format number according to locale
   */
  formatNumber(number, locale, options = {}) {
    try {
      return new Intl.NumberFormat(locale, options).format(number);
    } catch (error) {
      return number.toString();
    }
  }

  /**
   * Format currency according to locale
   */
  formatCurrency(amount, locale, currency = 'USD') {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }).format(amount);
    } catch (error) {
      return `${currency} ${amount}`;
    }
  }
}

// Export singleton
export const i18n = new I18nService();

/**
 * Express middleware to add i18n to request
 */
export function i18nMiddleware(req, res, next) {
  req.locale = i18n.detectLocale(req);
  
  req.t = (key, params) => i18n.t(req.locale, key, params);
  
  res.locals.locale = req.locale;
  res.locals.t = req.t;

  next();
}

export default i18n;
