/**
 * MATDEV Configuration
 * Centralized configuration management with environment variable support
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const config = {
    // Bot Configuration
    BOT_NAME: process.env.BOT_NAME || 'MATDEV',
    PREFIX: process.env.PREFIX || '.',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '',
    OWNER_NAME: process.env.OWNER_NAME || 'MATDEV Team',
    
    // Session Configuration
    SESSION_ID: process.env.SESSION_ID || '',
    SESSION_BACKUP_INTERVAL: parseInt(process.env.SESSION_BACKUP_INTERVAL) || 300000, // 5 minutes
    AUTO_RECONNECT: process.env.AUTO_RECONNECT !== 'false',
    MAX_RECONNECT_ATTEMPTS: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10,
    
    // Performance Configuration
    CLUSTER_MODE: process.env.CLUSTER_MODE === 'true',
    MAX_CONCURRENT_MESSAGES: parseInt(process.env.MAX_CONCURRENT_MESSAGES) || 50,
    MESSAGE_QUEUE_SIZE: parseInt(process.env.MESSAGE_QUEUE_SIZE) || 1000,
    PERFORMANCE_MONITORING: process.env.PERFORMANCE_MONITORING !== 'false',
    MEMORY_THRESHOLD_MB: parseInt(process.env.MEMORY_THRESHOLD_MB) || 512,
    
    // Features Configuration
    AUTO_TYPING: process.env.AUTO_TYPING === 'true',
    AUTO_READ: process.env.AUTO_READ === 'true',
    AUTO_STATUS_VIEW: process.env.AUTO_STATUS_VIEW === 'true',
    ANTI_DELETE: process.env.ANTI_DELETE === 'true',
    WELCOME_MESSAGE: process.env.WELCOME_MESSAGE === 'true',
    
    // Media Configuration
    MAX_DOWNLOAD_SIZE_MB: parseInt(process.env.MAX_DOWNLOAD_SIZE_MB) || 100,
    TEMP_DIR: process.env.TEMP_DIR || './temp',
    MEDIA_QUALITY: process.env.MEDIA_QUALITY || 'high',
    
    // Database Configuration
    DATABASE_TYPE: process.env.DATABASE_TYPE || 'json', // json, mongodb, postgresql
    DATABASE_URL: process.env.DATABASE_URL || '',
    
    // Logging Configuration
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_TO_FILE: process.env.LOG_TO_FILE !== 'false',
    LOG_ROTATION: process.env.LOG_ROTATION !== 'false',
    MAX_LOG_SIZE_MB: parseInt(process.env.MAX_LOG_SIZE_MB) || 50,
    
    // Security Configuration
    SUDO_USERS: process.env.SUDO_USERS ? process.env.SUDO_USERS.split(',') : [],
    BLOCKED_USERS: process.env.BLOCKED_USERS ? process.env.BLOCKED_USERS.split(',') : [],
    RATE_LIMIT_REQUESTS: parseInt(process.env.RATE_LIMIT_REQUESTS) || 20,
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    
    // Plugin Configuration
    PLUGINS_ENABLED: process.env.PLUGINS_ENABLED !== 'false',
    HOT_RELOAD: process.env.HOT_RELOAD === 'true',
    CUSTOM_PLUGINS_DIR: process.env.CUSTOM_PLUGINS_DIR || './custom_plugins',
    
    // API Keys
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
    WEATHER_API_KEY: process.env.WEATHER_API_KEY || '',
    
    // Directories
    DIRS: {
        SESSION: './session',
        TEMP: './temp',
        LOGS: './logs',
        PLUGINS: './plugins',
        DATABASE: './database'
    }
};

// Validate required configurations
const validateConfig = () => {
    const required = ['BOT_NAME', 'PREFIX'];
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
    
    // Create necessary directories
    Object.values(config.DIRS).forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

// Initialize configuration
validateConfig();

module.exports = config;
