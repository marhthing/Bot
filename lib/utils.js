/**
 * MATDEV Utilities
 * Common utility functions for the bot
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { Logger } = require('./logger');

class Utils {
    static logger = new Logger('MATDEV-UTILS');

    /**
     * Format file size in human readable format
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format duration in human readable format
     */
    static formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Extract phone number from JID
     */
    static getPhoneNumber(jid) {
        return jid?.split('@')[0]?.split(':')[0] || '';
    }

    /**
     * Check if JID is a group
     */
    static isGroup(jid) {
        return jid?.endsWith('@g.us') || false;
    }

    /**
     * Check if JID is a private chat
     */
    static isPrivate(jid) {
        return jid?.endsWith('@s.whatsapp.net') || false;
    }

    /**
     * Format JID for display
     */
    static formatJid(jid) {
        if (!jid) return 'Unknown';
        
        if (jid.endsWith('@g.us')) {
            return `Group (${jid.split('@')[0]})`;
        } else if (jid.endsWith('@s.whatsapp.net')) {
            return jid.split('@')[0];
        }
        
        return jid;
    }

    /**
     * Generate random string
     */
    static randomString(length = 10) {
        return crypto.randomBytes(length).toString('hex').substring(0, length);
    }

    /**
     * Sleep/delay function
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clean text for command parsing
     */
    static cleanText(text) {
        return text?.trim()?.replace(/\s+/g, ' ') || '';
    }

    /**
     * Extract command and arguments from text
     */
    static parseCommand(text, prefix) {
        const cleanText = this.cleanText(text);
        
        if (!cleanText.startsWith(prefix)) {
            return null;
        }

        const withoutPrefix = cleanText.substring(prefix.length);
        const [command, ...args] = withoutPrefix.split(' ');
        
        return {
            command: command.toLowerCase(),
            args,
            fullArgs: args.join(' '),
            rawText: text
        };
    }

    /**
     * Validate phone number format
     */
    static isValidPhoneNumber(number) {
        const phoneRegex = /^\d{10,15}$/;
        return phoneRegex.test(number.replace(/[^0-9]/g, ''));
    }

    /**
     * Format phone number for WhatsApp
     */
    static formatPhoneNumber(number) {
        const cleaned = number.replace(/[^0-9]/g, '');
        
        if (cleaned.startsWith('0')) {
            return cleaned.substring(1);
        }
        
        return cleaned;
    }

    /**
     * Create temporary file
     */
    static async createTempFile(data, extension = 'tmp') {
        const tempPath = path.join('./temp', `${this.randomString(10)}.${extension}`);
        await fs.writeFile(tempPath, data);
        return tempPath;
    }

    /**
     * Clean temporary files older than specified time
     */
    static async cleanTempFiles(maxAgeHours = 1) {
        try {
            const tempDir = './temp';
            const files = await fs.readdir(tempDir);
            const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
            const now = Date.now();
            
            let cleanedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.remove(filePath);
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                this.logger.info(`🧹 Cleaned ${cleanedCount} temporary files`);
            }
            
        } catch (error) {
            this.logger.error('Failed to clean temp files:', error);
        }
    }

    /**
     * Get file extension from filename
     */
    static getFileExtension(filename) {
        return path.extname(filename).toLowerCase().substring(1);
    }

    /**
     * Check if file is image
     */
    static isImage(filename) {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        return imageExtensions.includes(this.getFileExtension(filename));
    }

    /**
     * Check if file is video
     */
    static isVideo(filename) {
        const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
        return videoExtensions.includes(this.getFileExtension(filename));
    }

    /**
     * Check if file is audio
     */
    static isAudio(filename) {
        const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];
        return audioExtensions.includes(this.getFileExtension(filename));
    }

    /**
     * Escape markdown characters
     */
    static escapeMarkdown(text) {
        return text.replace(/[*_`~]/g, '\\$&');
    }

    /**
     * Create markdown formatted text
     */
    static createMarkdown(text, format = 'bold') {
        const formats = {
            bold: `*${text}*`,
            italic: `_${text}_`,
            mono: `\`${text}\``,
            strike: `~${text}~`
        };
        
        return formats[format] || text;
    }

    /**
     * Rate limiting helper
     */
    static createRateLimiter(maxRequests, windowMs) {
        const requests = new Map();
        
        return (identifier) => {
            const now = Date.now();
            const windowStart = now - windowMs;
            
            // Clean old entries
            requests.forEach((timestamp, key) => {
                if (timestamp < windowStart) {
                    requests.delete(key);
                }
            });
            
            // Check current user's requests
            const userRequests = Array.from(requests.entries())
                .filter(([key, timestamp]) => 
                    key.startsWith(identifier) && timestamp >= windowStart
                ).length;
            
            if (userRequests >= maxRequests) {
                return false; // Rate limited
            }
            
            // Add current request
            requests.set(`${identifier}_${now}`, now);
            return true; // Allowed
        };
    }

    /**
     * Validate URL
     */
    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Extract URLs from text
     */
    static extractUrls(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.match(urlRegex) || [];
    }

    /**
     * Convert buffer to base64
     */
    static bufferToBase64(buffer) {
        return buffer.toString('base64');
    }

    /**
     * Convert base64 to buffer
     */
    static base64ToBuffer(base64) {
        return Buffer.from(base64, 'base64');
    }

    /**
     * Generate hash of data
     */
    static generateHash(data, algorithm = 'sha256') {
        return crypto.createHash(algorithm).update(data).digest('hex');
    }

    /**
     * Retry async function with exponential backoff
     */
    static async retry(fn, maxAttempts = 3, delayMs = 1000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw error;
                }
                
                const delay = delayMs * Math.pow(2, attempt - 1);
                this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await this.sleep(delay);
            }
        }
    }
}

module.exports = { Utils };
