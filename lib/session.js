/**
 * MATDEV Session Manager
 * Advanced session handling with auto-backup and recovery
 */

const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');
const { Logger } = require('./logger');
const config = require('../config');

class SessionManager {
    constructor() {
        this.logger = new Logger('MATDEV-SESSION');
        this.sessionPath = config.DIRS.SESSION;
        this.backupPath = path.join(config.DIRS.SESSION, 'backups');
        this.isBackupRunning = false;
        
        this.initialize();
    }

    async initialize() {
        try {
            // Ensure directories exist
            await fs.ensureDir(this.sessionPath);
            await fs.ensureDir(this.backupPath);
            
            // Setup auto-backup if enabled
            if (config.SESSION_BACKUP_INTERVAL > 0) {
                this.setupAutoBackup();
            }
            
            this.logger.info('📁 Session manager initialized');
        } catch (error) {
            this.logger.error('Failed to initialize session manager:', error);
        }
    }

    setupAutoBackup() {
        // Auto-backup every 5 minutes (configurable)
        const intervalMinutes = Math.floor(config.SESSION_BACKUP_INTERVAL / 60000);
        const cronExpression = `*/${intervalMinutes} * * * *`;
        
        cron.schedule(cronExpression, async () => {
            await this.backup();
        });
        
        this.logger.info(`🔄 Auto-backup scheduled every ${intervalMinutes} minutes`);
    }

    async backup() {
        if (this.isBackupRunning) {
            return;
        }
        
        try {
            this.isBackupRunning = true;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(this.backupPath, `backup-${timestamp}`);
            
            // Check if session files exist
            const sessionFiles = await fs.readdir(this.sessionPath);
            const validFiles = sessionFiles.filter(file => 
                file.endsWith('.json') && !file.includes('backup')
            );
            
            if (validFiles.length === 0) {
                return;
            }
            
            await fs.ensureDir(backupDir);
            
            // Copy session files to backup directory
            for (const file of validFiles) {
                const srcPath = path.join(this.sessionPath, file);
                const destPath = path.join(backupDir, file);
                await fs.copy(srcPath, destPath);
            }
            
            // Clean old backups (keep last 10)
            await this.cleanOldBackups();
            
            this.logger.info(`💾 Session backup created: ${backupDir}`);
        } catch (error) {
            this.logger.error('Backup failed:', error);
        } finally {
            this.isBackupRunning = false;
        }
    }

    async cleanOldBackups() {
        try {
            const backups = await fs.readdir(this.backupPath);
            const backupDirs = backups
                .filter(item => item.startsWith('backup-'))
                .sort()
                .reverse();
            
            // Keep only the latest 10 backups
            const toDelete = backupDirs.slice(10);
            
            for (const dir of toDelete) {
                await fs.remove(path.join(this.backupPath, dir));
                this.logger.info(`🗑️ Removed old backup: ${dir}`);
            }
        } catch (error) {
            this.logger.error('Failed to clean old backups:', error);
        }
    }

    async restore(backupName) {
        try {
            const backupDir = path.join(this.backupPath, backupName);
            
            if (!await fs.pathExists(backupDir)) {
                throw new Error(`Backup not found: ${backupName}`);
            }
            
            const backupFiles = await fs.readdir(backupDir);
            
            for (const file of backupFiles) {
                const srcPath = path.join(backupDir, file);
                const destPath = path.join(this.sessionPath, file);
                await fs.copy(srcPath, destPath);
            }
            
            this.logger.success(`✅ Session restored from backup: ${backupName}`);
            return true;
        } catch (error) {
            this.logger.error('Restore failed:', error);
            return false;
        }
    }

    async getBackups() {
        try {
            const backups = await fs.readdir(this.backupPath);
            return backups
                .filter(item => item.startsWith('backup-'))
                .sort()
                .reverse();
        } catch (error) {
            this.logger.error('Failed to get backups:', error);
            return [];
        }
    }

    async getSessionInfo() {
        try {
            const sessionFiles = await fs.readdir(this.sessionPath);
            const validFiles = sessionFiles.filter(file => 
                file.endsWith('.json') && !file.includes('backup')
            );
            
            const info = {
                files: validFiles,
                totalFiles: validFiles.length,
                totalSize: 0,
                lastModified: null
            };
            
            for (const file of validFiles) {
                const filePath = path.join(this.sessionPath, file);
                const stats = await fs.stat(filePath);
                info.totalSize += stats.size;
                
                if (!info.lastModified || stats.mtime > info.lastModified) {
                    info.lastModified = stats.mtime;
                }
            }
            
            return info;
        } catch (error) {
            this.logger.error('Failed to get session info:', error);
            return null;
        }
    }

    async deleteSession() {
        try {
            const sessionFiles = await fs.readdir(this.sessionPath);
            
            for (const file of sessionFiles) {
                if (file.endsWith('.json') && !file.includes('backup')) {
                    await fs.remove(path.join(this.sessionPath, file));
                }
            }
            
            this.logger.info('🗑️ Session files deleted');
            return true;
        } catch (error) {
            this.logger.error('Failed to delete session:', error);
            return false;
        }
    }

    isSessionExists() {
        try {
            const credsPath = path.join(this.sessionPath, 'creds.json');
            return fs.existsSync(credsPath);
        } catch (error) {
            return false;
        }
    }

    getSessionHealth() {
        try {
            const info = this.getSessionInfo();
            const backups = this.getBackups();
            
            return {
                healthy: this.isSessionExists(),
                sessionInfo: info,
                backupCount: backups.length,
                lastBackup: backups[0] || null
            };
        } catch (error) {
            this.logger.error('Failed to get session health:', error);
            return { healthy: false };
        }
    }
}

module.exports = { SessionManager };
