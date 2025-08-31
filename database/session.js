/**
 * MATDEV Session Database
 * Handle session data storage and retrieval
 */

const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../lib/logger');
const config = require('../config');

class SessionDatabase {
    constructor() {
        this.logger = new Logger('MATDEV-SESSION-DB');
        this.sessionPath = config.DIRS.SESSION;
        this.dbPath = path.join(config.DIRS.DATABASE, 'session.json');
        this.cache = new Map();
        this.lastSync = Date.now();
        
        this.initialize();
    }

    async initialize() {
        try {
            await fs.ensureDir(path.dirname(this.dbPath));
            await this.loadFromFile();
            this.logger.info('📁 Session database initialized');
        } catch (error) {
            this.logger.error('Failed to initialize session database:', error);
        }
    }

    async loadFromFile() {
        try {
            if (await fs.pathExists(this.dbPath)) {
                const data = await fs.readJson(this.dbPath);
                
                // Load data into cache
                if (data.sessions) {
                    Object.entries(data.sessions).forEach(([key, value]) => {
                        this.cache.set(key, value);
                    });
                }
                
                this.logger.info(`📊 Loaded ${this.cache.size} session records`);
            } else {
                // Create empty database file
                await this.saveToFile();
            }
        } catch (error) {
            this.logger.error('Failed to load session database:', error);
        }
    }

    async saveToFile() {
        try {
            const data = {
                version: '1.0.0',
                lastModified: new Date().toISOString(),
                sessions: Object.fromEntries(this.cache.entries()),
                metadata: {
                    totalSessions: this.cache.size,
                    created: new Date().toISOString()
                }
            };
            
            await fs.writeJson(this.dbPath, data, { spaces: 2 });
            this.lastSync = Date.now();
            
        } catch (error) {
            this.logger.error('Failed to save session database:', error);
        }
    }

    async set(key, value) {
        try {
            this.cache.set(key, {
                ...value,
                lastModified: new Date().toISOString(),
                timestamp: Date.now()
            });
            
            // Auto-save every 5 minutes or when cache gets large
            if (Date.now() - this.lastSync > 300000 || this.cache.size % 50 === 0) {
                await this.saveToFile();
            }
            
            return true;
        } catch (error) {
            this.logger.error('Failed to set session data:', error);
            return false;
        }
    }

    get(key) {
        return this.cache.get(key);
    }

    has(key) {
        return this.cache.has(key);
    }

    async delete(key) {
        try {
            const result = this.cache.delete(key);
            await this.saveToFile();
            return result;
        } catch (error) {
            this.logger.error('Failed to delete session data:', error);
            return false;
        }
    }

    async clear() {
        try {
            this.cache.clear();
            await this.saveToFile();
            this.logger.info('🗑️ Session database cleared');
            return true;
        } catch (error) {
            this.logger.error('Failed to clear session database:', error);
            return false;
        }
    }

    async getUserData(userId) {
        return this.get(`user:${userId}`);
    }

    async setUserData(userId, data) {
        return await this.set(`user:${userId}`, data);
    }

    async getGroupData(groupId) {
        return this.get(`group:${groupId}`);
    }

    async setGroupData(groupId, data) {
        return await this.set(`group:${groupId}`, data);
    }

    async getBotSettings() {
        return this.get('bot:settings') || {};
    }

    async setBotSettings(settings) {
        return await this.set('bot:settings', settings);
    }

    async getStats() {
        const users = Array.from(this.cache.keys()).filter(k => k.startsWith('user:')).length;
        const groups = Array.from(this.cache.keys()).filter(k => k.startsWith('group:')).length;
        const settings = Array.from(this.cache.keys()).filter(k => k.startsWith('bot:')).length;
        
        return {
            totalRecords: this.cache.size,
            users,
            groups,
            settings,
            lastSync: this.lastSync,
            databaseSize: await this.getDatabaseSize()
        };
    }

    async getDatabaseSize() {
        try {
            if (await fs.pathExists(this.dbPath)) {
                const stats = await fs.stat(this.dbPath);
                return stats.size;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    async backup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(config.DIRS.DATABASE, `session-backup-${timestamp}.json`);
            
            await fs.copy(this.dbPath, backupPath);
            this.logger.info(`💾 Session database backed up to: ${backupPath}`);
            
            return backupPath;
        } catch (error) {
            this.logger.error('Failed to backup session database:', error);
            return null;
        }
    }

    async restore(backupPath) {
        try {
            if (!await fs.pathExists(backupPath)) {
                throw new Error('Backup file not found');
            }
            
            // Backup current database
            await this.backup();
            
            // Restore from backup
            await fs.copy(backupPath, this.dbPath);
            await this.loadFromFile();
            
            this.logger.success('✅ Session database restored successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to restore session database:', error);
            return false;
        }
    }

    async cleanup() {
        try {
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            let cleanedCount = 0;
            
            for (const [key, value] of this.cache.entries()) {
                if (value.timestamp && value.timestamp < oneWeekAgo) {
                    this.cache.delete(key);
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                await this.saveToFile();
                this.logger.info(`🧹 Cleaned ${cleanedCount} old session records`);
            }
            
            return cleanedCount;
        } catch (error) {
            this.logger.error('Failed to cleanup session database:', error);
            return 0;
        }
    }

    getAllUsers() {
        const users = [];
        for (const [key, value] of this.cache.entries()) {
            if (key.startsWith('user:')) {
                users.push({
                    userId: key.replace('user:', ''),
                    ...value
                });
            }
        }
        return users;
    }

    getAllGroups() {
        const groups = [];
        for (const [key, value] of this.cache.entries()) {
            if (key.startsWith('group:')) {
                groups.push({
                    groupId: key.replace('group:', ''),
                    ...value
                });
            }
        }
        return groups;
    }

    async export() {
        try {
            const exportData = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                data: Object.fromEntries(this.cache.entries()),
                metadata: await this.getStats()
            };
            
            const exportPath = path.join(config.DIRS.DATABASE, `session-export-${Date.now()}.json`);
            await fs.writeJson(exportPath, exportData, { spaces: 2 });
            
            this.logger.info(`📤 Session database exported to: ${exportPath}`);
            return exportPath;
        } catch (error) {
            this.logger.error('Failed to export session database:', error);
            return null;
        }
    }

    async import(importPath) {
        try {
            if (!await fs.pathExists(importPath)) {
                throw new Error('Import file not found');
            }
            
            const importData = await fs.readJson(importPath);
            
            if (!importData.data) {
                throw new Error('Invalid import file format');
            }
            
            // Backup current database
            await this.backup();
            
            // Import data
            this.cache.clear();
            Object.entries(importData.data).forEach(([key, value]) => {
                this.cache.set(key, value);
            });
            
            await this.saveToFile();
            this.logger.success('✅ Session database imported successfully');
            
            return true;
        } catch (error) {
            this.logger.error('Failed to import session database:', error);
            return false;
        }
    }
}

module.exports = { SessionDatabase };
