/**
 * MATDEV Advanced Logger
 * Enhanced logging system with MATDEV branding
 */

const winston = require('winston');
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
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

class Logger {
    constructor(label = 'MATDEV') {
        this.label = label;
        this.setupWinston();
    }

    setupWinston() {
        const logDir = config.DIRS.LOGS;
        fs.ensureDirSync(logDir);

        const customFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.json()
        );

        const consoleFormat = winston.format.combine(
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, label }) => {
                const coloredLevel = this.colorizeLevel(level);
                const coloredLabel = chalk ? chalk.cyan(`[${label || this.label}]`) : `[${label || this.label}]`;
                const coloredTime = chalk ? chalk.gray(timestamp) : timestamp;
                return `${coloredTime} ${coloredLevel} ${coloredLabel} ${message}`;
            })
        );

        const transports = [
            new winston.transports.Console({
                format: consoleFormat,
                level: config.LOG_LEVEL
            })
        ];

        if (config.LOG_TO_FILE) {
            transports.push(
                new winston.transports.File({
                    filename: path.join(logDir, 'error.log'),
                    level: 'error',
                    format: customFormat,
                    maxsize: config.MAX_LOG_SIZE_MB * 1024 * 1024,
                    maxFiles: 5
                }),
                new winston.transports.File({
                    filename: path.join(logDir, 'combined.log'),
                    format: customFormat,
                    maxsize: config.MAX_LOG_SIZE_MB * 1024 * 1024,
                    maxFiles: 10
                })
            );
        }

        this.winston = winston.createLogger({
            level: config.LOG_LEVEL,
            format: customFormat,
            defaultMeta: { service: 'matdev-bot', label: this.label },
            transports
        });
    }

    colorizeLevel(level) {
        if (!chalk) {
            return level.toUpperCase();
        }
        
        const colors = {
            error: chalk.red.bold('ERROR'),
            warn: chalk.yellow.bold('WARN '),
            info: chalk.blue.bold('INFO '),
            debug: chalk.magenta.bold('DEBUG'),
            verbose: chalk.cyan.bold('VERBOSE'),
            silly: chalk.gray.bold('SILLY')
        };
        return colors[level] || chalk.white.bold(level.toUpperCase());
    }

    formatMessage(message, ...args) {
        if (args.length > 0) {
            return `${message} ${args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
            ).join(' ')}`;
        }
        return message;
    }

    info(message, ...args) {
        this.winston.info(this.formatMessage(message, ...args));
    }

    error(message, ...args) {
        this.winston.error(this.formatMessage(message, ...args));
    }

    warn(message, ...args) {
        this.winston.warn(this.formatMessage(message, ...args));
    }

    debug(message, ...args) {
        this.winston.debug(this.formatMessage(message, ...args));
    }

    success(message, ...args) {
        const successMessage = (chalk ? chalk.green('✅ ') : '✅ ') + this.formatMessage(message, ...args);
        this.winston.info(successMessage);
    }

    command(command, user, chat) {
        const commandMessage = chalk ? `Command executed: ${chalk.yellowBright(command)} by ${chalk.cyanBright(user)} in ${chalk.magentaBright(chat)}` : `Command executed: ${command} by ${user} in ${chat}`;
        this.winston.info(commandMessage);
    }

    performance(operation, duration, details = {}) {
        const perfMessage = chalk ? `Performance: ${chalk.blueBright(operation)} took ${chalk.yellowBright(duration + 'ms')} ${Object.keys(details).length > 0 ? JSON.stringify(details) : ''}` : `Performance: ${operation} took ${duration}ms ${Object.keys(details).length > 0 ? JSON.stringify(details) : ''}`;
        this.winston.info(perfMessage);
    }

    static createBanner(title, content = []) {
        const width = 65;
        const border = '═'.repeat(width - 2);
        
        if (chalk) {
            console.log(chalk.cyan(`╔${border}╗`));
            console.log(chalk.cyan(`║${title.padStart((width + title.length) / 2).padEnd(width - 1)}║`));
            
            if (content.length > 0) {
                console.log(chalk.cyan(`╠${border}╣`));
                content.forEach(line => {
                    console.log(chalk.cyan(`║ ${line.padEnd(width - 3)} ║`));
                });
            }
            
            console.log(chalk.cyan(`╚${border}╝`));
        } else {
            console.log(`${title}`);
            content.forEach(line => console.log(line));
        }
    }

    static logStartup() {
        const content = [
            `🚀 Bot Name: ${config.BOT_NAME}`,
            `📝 Prefix: ${config.PREFIX}`,
            `🔧 Node.js: ${process.version}`,
            `💾 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
            `🕐 Started: ${new Date().toLocaleString()}`
        ];
        
        Logger.createBanner('MATDEV BOT STARTUP', content);
    }
}

module.exports = { Logger };
