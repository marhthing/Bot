/**
 * MATDEV Message Queue
 * High-performance message processing queue
 */

const { Logger } = require('./logger');
const config = require('../config');

class MessageQueue {
    constructor() {
        this.logger = new Logger('MATDEV-QUEUE');
        this.queue = [];
        this.processing = false;
        this.concurrentLimit = config.MAX_CONCURRENT_MESSAGES;
        this.activeProcesses = 0;
        this.stats = {
            processed: 0,
            failed: 0,
            queued: 0,
            startTime: Date.now()
        };
    }

    async add(messageData, handler, priority = 0) {
        if (this.queue.length >= config.MESSAGE_QUEUE_SIZE) {
            this.logger.warn('⚠️ Queue is full, dropping message');
            return false;
        }

        const queueItem = {
            id: this.generateId(),
            data: messageData,
            handler,
            priority,
            timestamp: Date.now(),
            retries: 0,
            maxRetries: 3
        };

        // Insert based on priority (higher priority first)
        const insertIndex = this.queue.findIndex(item => item.priority < priority);
        if (insertIndex === -1) {
            this.queue.push(queueItem);
        } else {
            this.queue.splice(insertIndex, 0, queueItem);
        }

        this.stats.queued++;
        this.processQueue();
        return true;
    }

    async processQueue() {
        if (this.processing || this.activeProcesses >= this.concurrentLimit) {
            return;
        }

        if (this.queue.length === 0) {
            return;
        }

        this.processing = true;
        const item = this.queue.shift();
        this.activeProcesses++;

        try {
            const startTime = Date.now();
            await item.handler(item.data);
            
            const duration = Date.now() - startTime;
            this.stats.processed++;
            this.activeProcesses--;
            
            this.logger.debug(`✅ Processed message ${item.id} in ${duration}ms`);
            
        } catch (error) {
            this.activeProcesses--;
            
            if (item.retries < item.maxRetries) {
                item.retries++;
                item.timestamp = Date.now();
                this.queue.unshift(item); // Add back to front for retry
                this.logger.warn(`🔄 Retrying message ${item.id} (${item.retries}/${item.maxRetries})`);
            } else {
                this.stats.failed++;
                this.logger.error(`❌ Failed to process message ${item.id} after ${item.maxRetries} retries:`, error);
            }
        } finally {
            this.processing = false;
            
            // Process next item if queue not empty
            if (this.queue.length > 0) {
                setImmediate(() => this.processQueue());
            }
        }
    }

    generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const processedPerMinute = this.stats.processed > 0 ? 
            Math.round((this.stats.processed / uptime) * 60000) : 0;

        return {
            ...this.stats,
            queueLength: this.queue.length,
            activeProcesses: this.activeProcesses,
            uptime,
            processedPerMinute,
            successRate: this.stats.processed > 0 ? 
                Math.round((this.stats.processed / (this.stats.processed + this.stats.failed)) * 100) : 0
        };
    }

    clear() {
        this.queue = [];
        this.logger.info('🗑️ Queue cleared');
    }

    pause() {
        this.processing = true;
        this.logger.info('⏸️ Queue paused');
    }

    resume() {
        this.processing = false;
        this.processQueue();
        this.logger.info('▶️ Queue resumed');
    }

    getQueueStatus() {
        return {
            isProcessing: this.processing,
            queueLength: this.queue.length,
            activeProcesses: this.activeProcesses,
            concurrentLimit: this.concurrentLimit
        };
    }

    // Priority levels for different message types
    static PRIORITY = {
        HIGH: 10,      // Commands from owner/sudo users
        NORMAL: 5,     // Regular commands
        LOW: 1,        // Background tasks, status updates
        BACKGROUND: 0  // Cleanup, logging
    };
}

module.exports = { MessageQueue };
