/**
 * MATDEV - High-Performance WhatsApp Bot
 * Main Entry Point with Multi-Core Support
 * Developed by MATDEV Team 2025
 */

const cluster = require('cluster');
const os = require('os');
let chalk;
try {
    chalk = require('chalk');
    // Handle newer versions of chalk
    if (chalk.default) {
        chalk = chalk.default;
    }
} catch (error) {
    chalk = null;
}
const { Client } = require('./lib/client');
const { Logger } = require('./lib/logger');
const { PerformanceMonitor } = require('./lib/performance');
const config = require('./config');

// MATDEV ASCII Art Logo
const MATDEV_LOGO = `
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║    ███╗   ███╗ █████╗ ████████╗██████╗ ███████╗██╗   ██╗      ║
║    ████╗ ████║██╔══██╗╚══██╔══╝██╔══██╗██╔════╝██║   ██║      ║
║    ██╔████╔██║███████║   ██║   ██║  ██║█████╗  ██║   ██║      ║
║    ██║╚██╔╝██║██╔══██║   ██║   ██║  ██║██╔══╝  ╚██╗ ██╔╝      ║
║    ██║ ╚═╝ ██║██║  ██║   ██║   ██████╔╝███████╗ ╚████╔╝       ║
║    ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚══════╝  ╚═══╝        ║
║                                                                ║
║              High-Performance WhatsApp Bot v1.0               ║
║                     Powered by MATDEV Team                    ║
╚════════════════════════════════════════════════════════════════╝
`;

class MatdevBot {
    constructor() {
        this.logger = new Logger('MATDEV-MAIN');
        this.performanceMonitor = new PerformanceMonitor();
        this.client = null;
        this.startTime = Date.now();
    }

    async initialize() {
        try {
            // Display MATDEV Logo
            console.log(chalk ? chalk.cyan(MATDEV_LOGO) : MATDEV_LOGO);
            this.logger.info('🚀 Initializing MATDEV WhatsApp Bot...');
            
            // Performance monitoring setup
            this.performanceMonitor.start();
            
            // Initialize client
            this.client = new Client();
            await this.client.initialize();
            
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            
            this.logger.success('✅ MATDEV Bot initialized successfully!');
            this.displayStartupInfo();
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize MATDEV Bot:', error);
            process.exit(1);
        }
    }

    displayStartupInfo() {
        const uptime = Date.now() - this.startTime;
        const memUsage = process.memoryUsage();
        
        if (chalk) {
            console.log(chalk.green('\n┌─────────────────────────────────────────────────────────────┐'));
            console.log(chalk.green('│                    MATDEV BOT STATUS                       │'));
            console.log(chalk.green('├─────────────────────────────────────────────────────────────┤'));
            console.log(chalk.green(`│ Status         : ${chalk.greenBright('ONLINE')}                                   │`));
            console.log(chalk.green(`│ Startup Time   : ${chalk.yellowBright(uptime + 'ms')}                              │`));
            console.log(chalk.green(`│ Memory Usage   : ${chalk.cyanBright((memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB')}                         │`));
            console.log(chalk.green(`│ Node Version   : ${chalk.magentaBright(process.version)}                              │`));
            console.log(chalk.green(`│ Platform       : ${chalk.blueBright(process.platform)}                               │`));
            console.log(chalk.green(`│ CPU Cores      : ${chalk.redBright(os.cpus().length)}                                   │`));
            console.log(chalk.green('└─────────────────────────────────────────────────────────────┘\n'));
        } else {
            console.log('\n=== MATDEV BOT STATUS ===');
            console.log(`Status         : ONLINE`);
            console.log(`Startup Time   : ${uptime}ms`);
            console.log(`Memory Usage   : ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
            console.log(`Node Version   : ${process.version}`);
            console.log(`Platform       : ${process.platform}`);
            console.log(`CPU Cores      : ${os.cpus().length}\n`);
        }
    }

    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            this.logger.info(`📡 Received ${signal}. Gracefully shutting down MATDEV Bot...`);
            
            try {
                if (this.client) {
                    // Preserve session by not calling destroy which logs out
                    if (this.client.socket) {
                        this.client.socket.end();
                    }
                    await this.client.sessionManager.backup();
                }
                
                this.performanceMonitor.stop();
                this.logger.info('✅ MATDEV Bot shutdown completed successfully');
                process.exit(0);
            } catch (error) {
                this.logger.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);
        process.on('uncaughtException', (error) => {
            this.logger.error('💥 Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('unhandledRejection');
        });
    }
}

// Multi-core cluster implementation
if (cluster.isMaster && config.CLUSTER_MODE && os.cpus().length > 1) {
    console.log(chalk ? chalk.cyan(MATDEV_LOGO) : MATDEV_LOGO);
    console.log(chalk.yellowBright(`🔥 MATDEV Cluster Mode: Spawning ${os.cpus().length} workers...`));
    
    for (let i = 0; i < os.cpus().length; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(chalk.redBright(`💀 Worker ${worker.process.pid} died. Respawning...`));
        cluster.fork();
    });
    
} else {
    // Single instance or worker process
    const bot = new MatdevBot();
    bot.initialize();
}
