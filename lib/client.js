/**
 * MATDEV WhatsApp Client
 * Enhanced Baileys client with performance optimizations
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
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

const { Logger } = require('./logger');
const { SessionManager } = require('./session');
const { MessageQueue } = require('./queue');
const { MessageHandler } = require('../handlers/message');
const { EventHandler } = require('../handlers/event');
const { PluginLoader } = require('../plugins/loader');
const config = require('../config');

class Client {
    constructor() {
        this.logger = new Logger('MATDEV-CLIENT');
        this.socket = null;
        this.sessionManager = new SessionManager();
        this.messageQueue = new MessageQueue();
        this.messageHandler = new MessageHandler(this);
        this.eventHandler = new EventHandler(this);
        this.pluginLoader = new PluginLoader(this);
        
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.lastActivity = Date.now();
        this.stats = {
            messagesReceived: 0,
            messagesSent: 0,
            commandsExecuted: 0,
            uptime: Date.now()
        };
    }

    async initialize() {
        try {
            this.logger.info('🔧 Initializing MATDEV WhatsApp Client...');
            
            // Get latest Baileys version
            const { version, isLatest } = await fetchLatestBaileysVersion();
            this.logger.info(`📱 Using WhatsApp v${version.join('.')}, isLatest: ${isLatest}`);
            
            // Load session
            const { state, saveCreds } = await useMultiFileAuthState(config.DIRS.SESSION);
            
            // Create socket
            this.socket = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false, // We'll handle QR display ourselves
                logger: this.createBaileysLogger(),
                browser: ['MATDEV Bot', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                markOnlineOnConnect: true,
                getMessage: async (key) => {
                    return { conversation: 'MATDEV Bot Message' };
                }
            });
            
            // Setup event handlers
            this.setupEventHandlers(saveCreds);
            
            // Load plugins
            await this.pluginLoader.loadPlugins();
            
            this.logger.success('✅ MATDEV Client initialized successfully!');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize client:', error);
            throw error;
        }
    }

    setupEventHandlers(saveCreds) {
        // Connection state handler
        this.socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                this.displayQRCode(qr);
            }
            
            if (connection === 'close') {
                this.isConnected = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                this.logger.warn(`🔌 Connection closed due to: ${lastDisconnect?.error}`);
                
                if (shouldReconnect && this.reconnectAttempts < config.MAX_RECONNECT_ATTEMPTS) {
                    this.reconnectAttempts++;
                    this.logger.info(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${config.MAX_RECONNECT_ATTEMPTS}`);
                    setTimeout(() => this.initialize(), 5000);
                } else {
                    this.logger.error('❌ Max reconnection attempts reached or logged out');
                }
            } else if (connection === 'open') {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.logger.success('🎉 MATDEV Bot connected successfully!');
                this.displayConnectionStatus();
            }
        });

        // Credentials update handler
        this.socket.ev.on('creds.update', saveCreds);
        
        // Message handler
        this.socket.ev.on('messages.upsert', async (m) => {
            try {
                await this.messageHandler.handle(m);
                this.stats.messagesReceived++;
                this.lastActivity = Date.now();
            } catch (error) {
                this.logger.error('Message handling error:', error);
            }
        });
        
        // Group events
        this.socket.ev.on('groups.upsert', (groups) => {
            this.eventHandler.handleGroupsUpsert(groups);
        });
        
        this.socket.ev.on('group-participants.update', (update) => {
            this.eventHandler.handleParticipantsUpdate(update);
        });
        
        // Presence update
        this.socket.ev.on('presence.update', (update) => {
            this.eventHandler.handlePresenceUpdate(update);
        });
    }

    displayQRCode(qr) {
        if (chalk) {
            console.log(chalk.cyan('\n┌─────────────────────────────────────────────────────────────┐'));
            console.log(chalk.cyan('│                    MATDEV QR CODE                          │'));
            console.log(chalk.cyan('├─────────────────────────────────────────────────────────────┤'));
            console.log(chalk.cyan('│ 📱 Scan this QR code with your WhatsApp mobile app         │'));
            console.log(chalk.cyan('│ ⏱️  QR Code expires in 20 seconds                           │'));
            console.log(chalk.cyan('└─────────────────────────────────────────────────────────────┘\n'));
        } else {
            console.log('\n=== MATDEV QR CODE ===');
            console.log('📱 Scan this QR code with your WhatsApp mobile app');
            console.log('⏱️  QR Code expires in 20 seconds\n');
        }
        
        qrcode.generate(qr, { small: true });
        
        if (chalk) {
            console.log(chalk.yellow('\n📝 Steps to connect:'));
            console.log(chalk.yellow('   1. Open WhatsApp on your phone'));
            console.log(chalk.yellow('   2. Go to Settings > Linked Devices'));
            console.log(chalk.yellow('   3. Tap "Link a Device"'));
            console.log(chalk.yellow('   4. Scan the QR code above\n'));
        } else {
            console.log('\n📝 Steps to connect:');
            console.log('   1. Open WhatsApp on your phone');
            console.log('   2. Go to Settings > Linked Devices');
            console.log('   3. Tap "Link a Device"');
            console.log('   4. Scan the QR code above\n');
        }
    }

    displayConnectionStatus() {
        const user = this.socket.user;
        if (chalk) {
            console.log(chalk.green('\n┌─────────────────────────────────────────────────────────────┐'));
            console.log(chalk.green('│                 CONNECTION SUCCESSFUL                       │'));
            console.log(chalk.green('├─────────────────────────────────────────────────────────────┤'));
            console.log(chalk.green(`│ Bot Name       : ${chalk.whiteBright(config.BOT_NAME)}                               │`));
            console.log(chalk.green(`│ Connected As   : ${chalk.whiteBright(user?.name || 'Unknown')}                        │`));
            console.log(chalk.green(`│ Phone Number   : ${chalk.whiteBright(user?.id?.split(':')[0] || 'Unknown')}           │`));
            console.log(chalk.green(`│ Prefix         : ${chalk.whiteBright(config.PREFIX)}                                 │`));
            console.log(chalk.green(`│ Plugins Loaded : ${chalk.yellowBright(this.pluginLoader.getLoadedCount())}                               │`));
            console.log(chalk.green('└─────────────────────────────────────────────────────────────┘\n'));
        } else {
            console.log('\n=== CONNECTION SUCCESSFUL ===');
            console.log(`Bot Name       : ${config.BOT_NAME}`);
            console.log(`Connected As   : ${user?.name || 'Unknown'}`);
            console.log(`Phone Number   : ${user?.id?.split(':')[0] || 'Unknown'}`);
            console.log(`Prefix         : ${config.PREFIX}`);
            console.log(`Plugins Loaded : ${this.pluginLoader.getLoadedCount()}\n`);
        }
    }

    createBaileysLogger() {
        return {
            level: 'silent',
            child: () => this.createBaileysLogger(),
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            fatal: () => {}
        };
    }

    async sendMessage(jid, content, options = {}) {
        try {
            if (!this.isConnected) {
                throw new Error('Client not connected');
            }
            
            const result = await this.socket.sendMessage(jid, content, options);
            this.stats.messagesSent++;
            return result;
        } catch (error) {
            this.logger.error('Failed to send message:', error);
            throw error;
        }
    }

    async downloadMedia(message) {
        try {
            const stream = await downloadContentFromMessage(message, message.type);
            const chunks = [];
            
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            
            return Buffer.concat(chunks);
        } catch (error) {
            this.logger.error('Failed to download media:', error);
            throw error;
        }
    }

    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.uptime,
            isConnected: this.isConnected,
            lastActivity: this.lastActivity
        };
    }

    async destroy() {
        this.logger.info('🔌 Destroying MATDEV client...');
        
        if (this.socket) {
            await this.socket.logout();
        }
        
        await this.sessionManager.backup();
        this.logger.success('✅ Client destroyed successfully');
    }
}

module.exports = { Client };
