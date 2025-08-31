/**
 * MATDEV Backup Manager
 * Handle automated backups and restoration
 */

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const extract = require('extract-zip');
const cron = require('node-cron');
const { Logger } = require('../lib/logger');
const config = require('../config');

class BackupManager {
    constructor() {
        this.logger = new Logger('MATDEV-BACKUP');
        this.backupDir = path.join(config.DIRS.DATABASE, 'backups');
        this.isBackupRunning = false;
        this.backupSchedule = null;
        
        this.initialize();
    }

    async initialize() {
        try {
            await fs.ensureDir(this.backupDir);
            
            // Setup automatic backup schedule if enabled
            if (config.AUTO_BACKUP_ENABLED) {
                this.setupAutoBackup();
            }
            
            this.logger.info('💾 Backup manager initialized');
        } catch (error) {
            this.logger.error('Failed to initialize backup manager:', error);
        }
    }

    setupAutoBackup() {
        // Default: backup every 6 hours
        const schedule = config.AUTO_BACKUP_SCHEDULE || '0 */6 * * *';
        
        this.backupSchedule = cron.schedule(schedule, async () => {
            await this.createFullBackup();
        });
        
        this.logger.info(`📅 Auto-backup scheduled: ${schedule}`);
    }

    async createFullBackup() {
        if (this.isBackupRunning) {
            this.logger.warn('⚠️ Backup already in progress, skipping...');
            return null;
        }

        try {
            this.isBackupRunning = true;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `matdev-backup-${timestamp}`;
            const backupPath = path.join(this.backupDir, `${backupName}.zip`);
            
            this.logger.info('🔄 Creating full backup...');
            
            // Create archive
            const archive = archiver('zip', { zlib: { level: 9 } });
            const output = fs.createWriteStream(backupPath);
            
            return new Promise((resolve, reject) => {
                output.on('close', async () => {
                    try {
                        const size = archive.pointer();
                        this.logger.success(`✅ Backup created: ${backupName}.zip (${this.formatFileSize(size)})`);
                        
                        // Clean old backups
                        await this.cleanOldBackups();
                        
                        resolve(backupPath);
                    } catch (error) {
                        reject(error);
                    } finally {
                        this.isBackupRunning = false;
                    }
                });
                
                output.on('error', reject);
                archive.on('error', reject);
                
                archive.pipe(output);
                
                // Add session files
                if (fs.existsSync(config.DIRS.SESSION)) {
                    archive.directory(config.DIRS.SESSION, 'session');
                }
                
                // Add database files
                if (fs.existsSync(config.DIRS.DATABASE)) {
                    archive.directory(config.DIRS.DATABASE, 'database', (entry) => {
                        // Exclude backup directory to avoid recursive backup
                        return !entry.name.includes('backups/');
                    });
                }
                
                // Add logs (last 7 days)
                if (fs.existsSync(config.DIRS.LOGS)) {
                    this.addRecentLogsSync(archive);
                }
                
                // Add configuration
                if (fs.existsSync('./config.js')) {
                    archive.file('./config.js', { name: 'config.js' });
                }
                
                // Add package.json for reference
                if (fs.existsSync('./package.json')) {
                    archive.file('./package.json', { name: 'package.json' });
                }
                
                // Add backup metadata
                const metadata = {
                    version: '1.0.0',
                    timestamp: new Date().toISOString(),
                    backupName,
                    botVersion: config.BOT_NAME,
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch
                };
                
                archive.append(JSON.stringify(metadata, null, 2), { name: 'backup-metadata.json' });
                
                archive.finalize();
            });
            
        } catch (error) {
            this.logger.error('Failed to create backup:', error);
            this.isBackupRunning = false;
            return null;
        }
    }

    async addRecentLogs(archive) {
        try {
            const logFiles = await fs.readdir(config.DIRS.LOGS);
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            
            for (const logFile of logFiles) {
                const logPath = path.join(config.DIRS.LOGS, logFile);
                const stats = await fs.stat(logPath);
                
                // Only include logs from last 7 days
                if (stats.mtime.getTime() > oneWeekAgo) {
                    archive.file(logPath, { name: `logs/${logFile}` });
                }
            }
        } catch (error) {
            this.logger.warn('Failed to add logs to backup:', error);
        }
    }

    addRecentLogsSync(archive) {
        try {
            if (!fs.existsSync(config.DIRS.LOGS)) return;
            
            const logFiles = fs.readdirSync(config.DIRS.LOGS);
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            
            for (const logFile of logFiles) {
                const logPath = path.join(config.DIRS.LOGS, logFile);
                const stats = fs.statSync(logPath);
                
                // Only include logs from last 7 days
                if (stats.mtime.getTime() > oneWeekAgo) {
                    archive.file(logPath, { name: `logs/${logFile}` });
                }
            }
        } catch (error) {
            this.logger.warn('Failed to add logs to backup:', error);
        }
    }

    async restoreFromBackup(backupPath) {
        try {
            if (!await fs.pathExists(backupPath)) {
                throw new Error('Backup file not found');
            }
            
            this.logger.info(`🔄 Restoring from backup: ${path.basename(backupPath)}`);
            
            // Create temporary extraction directory
            const tempDir = path.join(this.backupDir, 'temp-restore');
            await fs.ensureDir(tempDir);
            
            // Extract backup
            await extract(backupPath, { dir: tempDir });
            
            // Verify backup metadata
            const metadataPath = path.join(tempDir, 'backup-metadata.json');
            if (await fs.pathExists(metadataPath)) {
                const metadata = await fs.readJson(metadataPath);
                this.logger.info(`📋 Backup metadata: ${JSON.stringify(metadata, null, 2)}`);
            }
            
            // Backup current state before restoration
            const currentBackup = await this.createFullBackup();
            if (currentBackup) {
                this.logger.info('💾 Current state backed up before restoration');
            }
            
            // Restore session files
            const sessionBackupPath = path.join(tempDir, 'session');
            if (await fs.pathExists(sessionBackupPath)) {
                await fs.emptyDir(config.DIRS.SESSION);
                await fs.copy(sessionBackupPath, config.DIRS.SESSION);
                this.logger.info('✅ Session files restored');
            }
            
            // Restore database files
            const databaseBackupPath = path.join(tempDir, 'database');
            if (await fs.pathExists(databaseBackupPath)) {
                // Only restore database files, not backups
                const dbFiles = await fs.readdir(databaseBackupPath);
                for (const file of dbFiles) {
                    if (!file.includes('backup') && file.endsWith('.json')) {
                        await fs.copy(
                            path.join(databaseBackupPath, file),
                            path.join(config.DIRS.DATABASE, file)
                        );
                    }
                }
                this.logger.info('✅ Database files restored');
            }
            
            // Cleanup temporary directory
            await fs.remove(tempDir);
            
            this.logger.success('✅ Backup restoration completed successfully!');
            return true;
            
        } catch (error) {
            this.logger.error('Failed to restore backup:', error);
            return false;
        }
    }

    async listBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = [];
            
            for (const file of files) {
                if (file.endsWith('.zip') && file.startsWith('matdev-backup-')) {
                    const filePath = path.join(this.backupDir, file);
                    const stats = await fs.stat(filePath);
                    
                    backups.push({
                        name: file,
                        path: filePath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        formattedSize: this.formatFileSize(stats.size)
                    });
                }
            }
            
            // Sort by creation date (newest first)
            backups.sort((a, b) => b.created - a.created);
            
            return backups;
        } catch (error) {
            this.logger.error('Failed to list backups:', error);
            return [];
        }
    }

    async cleanOldBackups() {
        try {
            const maxBackups = config.MAX_BACKUPS || 10;
            const backups = await this.listBackups();
            
            if (backups.length <= maxBackups) {
                return;
            }
            
            // Remove oldest backups
            const toDelete = backups.slice(maxBackups);
            
            for (const backup of toDelete) {
                await fs.remove(backup.path);
                this.logger.info(`🗑️ Removed old backup: ${backup.name}`);
            }
            
            this.logger.info(`🧹 Cleaned ${toDelete.length} old backups`);
            
        } catch (error) {
            this.logger.error('Failed to clean old backups:', error);
        }
    }

    async deleteBackup(backupName) {
        try {
            const backupPath = path.join(this.backupDir, backupName);
            
            if (!await fs.pathExists(backupPath)) {
                throw new Error('Backup not found');
            }
            
            await fs.remove(backupPath);
            this.logger.info(`🗑️ Deleted backup: ${backupName}`);
            
            return true;
        } catch (error) {
            this.logger.error('Failed to delete backup:', error);
            return false;
        }
    }

    async getBackupStats() {
        try {
            const backups = await this.listBackups();
            const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
            
            return {
                totalBackups: backups.length,
                totalSize,
                formattedTotalSize: this.formatFileSize(totalSize),
                oldestBackup: backups[backups.length - 1]?.created || null,
                newestBackup: backups[0]?.created || null,
                averageSize: backups.length > 0 ? Math.round(totalSize / backups.length) : 0,
                backupDirectory: this.backupDir
            };
        } catch (error) {
            this.logger.error('Failed to get backup stats:', error);
            return null;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async createQuickBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `matdev-quick-backup-${timestamp}`;
            const backupPath = path.join(this.backupDir, `${backupName}.zip`);
            
            this.logger.info('⚡ Creating quick backup (session only)...');
            
            const archive = archiver('zip', { zlib: { level: 6 } });
            const output = fs.createWriteStream(backupPath);
            
            return new Promise((resolve, reject) => {
                output.on('close', () => {
                    const size = archive.pointer();
                    this.logger.success(`✅ Quick backup created: ${backupName}.zip (${this.formatFileSize(size)})`);
                    resolve(backupPath);
                });
                
                output.on('error', reject);
                archive.on('error', reject);
                
                archive.pipe(output);
                
                // Only backup session files for quick backup
                if (fs.existsSync(config.DIRS.SESSION)) {
                    archive.directory(config.DIRS.SESSION, 'session');
                }
                
                archive.finalize();
            });
            
        } catch (error) {
            this.logger.error('Failed to create quick backup:', error);
            return null;
        }
    }

    destroy() {
        if (this.backupSchedule) {
            this.backupSchedule.destroy();
            this.logger.info('📅 Auto-backup schedule stopped');
        }
    }
}

module.exports = { BackupManager };
