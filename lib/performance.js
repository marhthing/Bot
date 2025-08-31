/**
 * MATDEV Performance Monitor
 * Real-time performance tracking and optimization
 */

const os = require('os');
const chalk = require('chalk');
const { Logger } = require('./logger');
const config = require('../config');

class PerformanceMonitor {
    constructor() {
        this.logger = new Logger('MATDEV-PERF');
        this.metrics = {
            startTime: Date.now(),
            messageCount: 0,
            commandCount: 0,
            errorCount: 0,
            memoryPeaks: [],
            responseTimes: [],
            cpuUsage: [],
            lastCleanup: Date.now()
        };
        this.isMonitoring = false;
        this.monitoringInterval = null;
    }

    start() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.logger.info('📊 Performance monitoring started');
        
        // Monitor every 30 seconds
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
            this.checkThresholds();
        }, 30000);

        // Display performance dashboard every 5 minutes
        setInterval(() => {
            this.displayDashboard();
        }, 300000);
    }

    stop() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.logger.info('📊 Performance monitoring stopped');
    }

    collectMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        // Memory tracking
        this.metrics.memoryPeaks.push({
            timestamp: Date.now(),
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss
        });

        // CPU tracking
        this.metrics.cpuUsage.push({
            timestamp: Date.now(),
            user: cpuUsage.user,
            system: cpuUsage.system
        });

        // Keep only last 100 entries
        if (this.metrics.memoryPeaks.length > 100) {
            this.metrics.memoryPeaks = this.metrics.memoryPeaks.slice(-100);
        }
        if (this.metrics.cpuUsage.length > 100) {
            this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-100);
        }
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
        }
    }

    checkThresholds() {
        const memUsage = process.memoryUsage();
        const memUsageMB = memUsage.heapUsed / 1024 / 1024;
        
        // Memory threshold check
        if (memUsageMB > config.MEMORY_THRESHOLD_MB) {
            this.logger.warn(`⚠️ High memory usage: ${memUsageMB.toFixed(2)} MB (threshold: ${config.MEMORY_THRESHOLD_MB} MB)`);
            this.suggestOptimization();
        }

        // Cleanup old metrics if needed
        const now = Date.now();
        if (now - this.metrics.lastCleanup > 3600000) { // 1 hour
            this.cleanupMetrics();
            this.metrics.lastCleanup = now;
        }
    }

    suggestOptimization() {
        const suggestions = [
            '💡 Consider restarting the bot to clear memory',
            '💡 Check for memory leaks in custom plugins',
            '💡 Reduce MAX_CONCURRENT_MESSAGES if high traffic',
            '💡 Enable cluster mode for better resource utilization'
        ];

        this.logger.info('Optimization suggestions:');
        suggestions.forEach(suggestion => {
            this.logger.info(suggestion);
        });
    }

    recordResponseTime(duration) {
        this.metrics.responseTimes.push({
            timestamp: Date.now(),
            duration
        });
    }

    recordMessage() {
        this.metrics.messageCount++;
    }

    recordCommand() {
        this.metrics.commandCount++;
    }

    recordError() {
        this.metrics.errorCount++;
    }

    getAverageResponseTime() {
        if (this.metrics.responseTimes.length === 0) return 0;
        
        const recent = this.metrics.responseTimes.slice(-100); // Last 100 responses
        const sum = recent.reduce((acc, rt) => acc + rt.duration, 0);
        return Math.round(sum / recent.length);
    }

    getMemoryStats() {
        const memUsage = process.memoryUsage();
        return {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
            rss: Math.round(memUsage.rss / 1024 / 1024)
        };
    }

    getSystemStats() {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        
        return {
            platform: os.platform(),
            arch: os.arch(),
            cpuCount: cpus.length,
            cpuModel: cpus[0]?.model || 'Unknown',
            loadAverage: loadAvg.map(load => load.toFixed(2)),
            freeMemory: Math.round(os.freemem() / 1024 / 1024),
            totalMemory: Math.round(os.totalmem() / 1024 / 1024),
            uptime: Math.round(os.uptime())
        };
    }

    displayDashboard() {
        const uptime = Date.now() - this.metrics.startTime;
        const memStats = this.getMemoryStats();
        const sysStats = this.getSystemStats();
        const avgResponseTime = this.getAverageResponseTime();

        console.log(chalk.cyan('\n╔═══════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║                    MATDEV PERFORMANCE DASHBOARD              ║'));
        console.log(chalk.cyan('╠═══════════════════════════════════════════════════════════════╣'));
        console.log(chalk.cyan(`║ Uptime         : ${chalk.green(this.formatUptime(uptime))}                              ║`));
        console.log(chalk.cyan(`║ Messages       : ${chalk.yellow(this.metrics.messageCount.toString().padEnd(8))}                            ║`));
        console.log(chalk.cyan(`║ Commands       : ${chalk.blue(this.metrics.commandCount.toString().padEnd(8))}                            ║`));
        console.log(chalk.cyan(`║ Errors         : ${chalk.red(this.metrics.errorCount.toString().padEnd(8))}                            ║`));
        console.log(chalk.cyan(`║ Avg Response   : ${chalk.magenta((avgResponseTime + 'ms').padEnd(8))}                          ║`));
        console.log(chalk.cyan('╠═══════════════════════════════════════════════════════════════╣'));
        console.log(chalk.cyan(`║ Heap Used      : ${chalk.greenBright((memStats.heapUsed + ' MB').padEnd(8))}                          ║`));
        console.log(chalk.cyan(`║ Heap Total     : ${chalk.yellowBright((memStats.heapTotal + ' MB').padEnd(8))}                          ║`));
        console.log(chalk.cyan(`║ RSS Memory     : ${chalk.blueBright((memStats.rss + ' MB').padEnd(8))}                          ║`));
        console.log(chalk.cyan(`║ System Memory  : ${chalk.cyanBright((sysStats.freeMemory + '/' + sysStats.totalMemory + ' MB').padEnd(15))}     ║`));
        console.log(chalk.cyan(`║ CPU Cores      : ${chalk.redBright(sysStats.cpuCount.toString().padEnd(8))}                            ║`));
        console.log(chalk.cyan(`║ Load Average   : ${chalk.magentaBright(sysStats.loadAverage.join(', ').padEnd(15))}                ║`));
        console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝\n'));
    }

    formatUptime(uptime) {
        const seconds = Math.floor(uptime / 1000);
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    cleanupMetrics() {
        const oneHourAgo = Date.now() - 3600000;
        
        this.metrics.memoryPeaks = this.metrics.memoryPeaks.filter(
            metric => metric.timestamp > oneHourAgo
        );
        
        this.metrics.cpuUsage = this.metrics.cpuUsage.filter(
            metric => metric.timestamp > oneHourAgo
        );
        
        this.metrics.responseTimes = this.metrics.responseTimes.filter(
            metric => metric.timestamp > oneHourAgo
        );
        
        this.logger.info('🧹 Performance metrics cleaned up');
    }

    getMetricsReport() {
        const uptime = Date.now() - this.metrics.startTime;
        const memStats = this.getMemoryStats();
        const sysStats = this.getSystemStats();

        return {
            uptime,
            messages: this.metrics.messageCount,
            commands: this.metrics.commandCount,
            errors: this.metrics.errorCount,
            averageResponseTime: this.getAverageResponseTime(),
            memory: memStats,
            system: sysStats,
            timestamp: Date.now()
        };
    }
}

module.exports = { PerformanceMonitor };
