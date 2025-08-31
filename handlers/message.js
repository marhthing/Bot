/**
 * MATDEV Message Handler
 * Process incoming messages and route to appropriate handlers
 */

const { Logger } = require('../lib/logger');
const { Utils } = require('../lib/utils');
const { MessageQueue } = require('../lib/queue');
const { PermissionManager } = require('../lib/permissions');
const config = require('../config');

class MessageHandler {
    constructor(client) {
        this.client = client;
        this.logger = new Logger('MATDEV-MSG');
        this.permissionManager = new PermissionManager();
        this.rateLimiter = Utils.createRateLimiter(
            config.RATE_LIMIT_REQUESTS,
            config.RATE_LIMIT_WINDOW_MS
        );
    }

    async handle(messageUpdate) {
        const { messages, type } = messageUpdate;
        
        for (const message of messages) {
            // Skip if no message content
            if (!message.message) continue;
            
            // Owner permission system: Only process outgoing messages or allowed incoming messages
            if (message.key.fromMe) {
                // If message is from me (outgoing), only process if it starts with prefix
                const messageContent = this.extractMessageContent(message);
                const text = messageContent.text || '';
                if (!text.startsWith(config.PREFIX)) continue;
            } else {
                // If message is incoming, skip unless user has permission
                const messageContent = this.extractMessageContent(message);
                const text = messageContent.text || '';
                const sender = message.key.remoteJid; // Use full JID for permission check
                
                this.logger.debug(`📨 Incoming message from ${sender}: "${text}"`);
                
                // Skip if not a command
                if (!text.startsWith(config.PREFIX)) {
                    this.logger.debug(`⏭️ Skipping non-command message: "${text}"`);
                    continue;
                }
                
                // Extract command name
                const commandData = Utils.parseCommand(text, config.PREFIX);
                if (!commandData) {
                    this.logger.debug(`❌ Failed to parse command from: "${text}"`);
                    continue;
                }
                
                this.logger.debug(`🔍 Checking permission for ${sender} to use '${commandData.command}'`);
                
                // Check if user has permission for this command
                if (!this.permissionManager.hasPermission(sender, commandData.command)) {
                    this.logger.info(`❌ Permission denied for ${sender} to use command '${commandData.command}'`);
                    continue; // Silently ignore unauthorized commands
                }
                
                this.logger.info(`✅ Permission granted for ${sender} to use '${commandData.command}'`);
            }
            
            // Add to processing queue
            await this.client.messageQueue.add(
                message,
                this.processMessage.bind(this),
                this.getMessagePriority(message)
            );
        }
    }

    async processMessage(message) {
        try {
            const context = await this.createMessageContext(message);
            
            // Rate limiting check
            if (!this.rateLimiter(context.sender)) {
                return; // Silently ignore rate-limited users
            }
            
            // Check if user is blocked
            if (this.isUserBlocked(context.sender)) {
                return;
            }
            
            // Auto-read message if enabled
            if (config.AUTO_READ) {
                await this.markAsRead(message);
            }
            
            // Auto-typing if enabled
            if (config.AUTO_TYPING) {
                await this.sendTyping(context.chatId);
            }
            
            // Check if it's a command
            const commandData = Utils.parseCommand(context.text, config.PREFIX);
            
            if (commandData) {
                await this.handleCommand(context, commandData);
            } else {
                await this.handleRegularMessage(context);
            }
            
        } catch (error) {
            this.logger.error('Message processing error:', error);
        }
    }

    async createMessageContext(message) {
        const messageContent = this.extractMessageContent(message);
        const sender = message.key.remoteJid; // Use full JID consistently
        const chatId = message.key.remoteJid;
        const isGroup = Utils.isGroup(chatId);
        
        // Get quoted message if any
        const quotedMessage = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
        
        return {
            message,
            messageContent,
            text: messageContent.text || '',
            sender,
            chatId,
            isGroup,
            isPrivate: !isGroup,
            quotedMessage,
            client: this.client,
            prefix: config.PREFIX,
            
            // Helper functions
            reply: async (text, options = {}) => {
                return await this.client.sendMessage(chatId, {
                    text: text,
                    ...options
                }, {
                    quoted: message
                });
            },
            
            sendMessage: async (content, options = {}) => {
                return await this.client.sendMessage(chatId, content, options);
            },
            
            react: async (emoji) => {
                return await this.client.sendMessage(chatId, {
                    react: {
                        text: emoji,
                        key: message.key
                    }
                });
            }
        };
    }

    extractMessageContent(message) {
        const msg = message.message;
        
        // Text messages
        if (msg.conversation) {
            return { type: 'text', text: msg.conversation };
        }
        
        if (msg.extendedTextMessage) {
            return { 
                type: 'text', 
                text: msg.extendedTextMessage.text,
                contextInfo: msg.extendedTextMessage.contextInfo
            };
        }
        
        // Media messages
        if (msg.imageMessage) {
            return {
                type: 'image',
                text: msg.imageMessage.caption || '',
                media: msg.imageMessage
            };
        }
        
        if (msg.videoMessage) {
            return {
                type: 'video',
                text: msg.videoMessage.caption || '',
                media: msg.videoMessage
            };
        }
        
        if (msg.audioMessage) {
            return {
                type: 'audio',
                media: msg.audioMessage
            };
        }
        
        if (msg.documentMessage) {
            return {
                type: 'document',
                text: msg.documentMessage.caption || '',
                media: msg.documentMessage
            };
        }
        
        if (msg.stickerMessage) {
            return {
                type: 'sticker',
                media: msg.stickerMessage
            };
        }
        
        return { type: 'unknown', text: '' };
    }

    async handleCommand(context, commandData) {
        const { command, args } = commandData;
        
        // Add command data to context
        context.command = command;
        context.args = args;
        context.fullArgs = commandData.fullArgs;
        
        // Check if user is owner (for owner-only commands)
        const isOwner = context.message.key.fromMe || context.sender === config.OWNER_NUMBER;
        context.isOwner = isOwner;
        
        try {
            // Execute command through plugin loader
            const executed = await this.client.pluginLoader.executeCommand(command, context);
            
            if (!executed) {
                // Command not found
                await this.handleUnknownCommand(context, command);
            }
            
        } catch (error) {
            this.logger.error(`Command execution error [${command}]:`, error);
            await context.reply('❌ An error occurred while executing the command.');
        }
    }

    async handleUnknownCommand(context, command) {
        // Check for similar commands (fuzzy matching)
        const allCommands = this.client.pluginLoader.getAllCommands();
        const suggestions = this.findSimilarCommands(command, allCommands);
        
        let response = `❌ Unknown command: *${command}*`;
        
        if (suggestions.length > 0) {
            response += `\n\n💡 Did you mean:\n`;
            suggestions.slice(0, 3).forEach(suggestion => {
                response += `├ ${config.PREFIX}${suggestion.name}\n`;
            });
        }
        
        response += `\nUse *${config.PREFIX}help* to see all available commands.`;
        
        await context.reply(response);
    }

    findSimilarCommands(command, commands) {
        return commands
            .filter(cmd => this.calculateSimilarity(command, cmd.name) > 0.5)
            .sort((a, b) => this.calculateSimilarity(command, b.name) - this.calculateSimilarity(command, a.name));
    }

    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    async handleRegularMessage(context) {
        // Handle non-command messages
        // This can include auto-responses, AI chat, etc.
        
        // Example: Auto-respond to greetings
        const text = context.text.toLowerCase();
        const greetings = ['hello', 'hi', 'hey', 'matdev'];
        
        if (greetings.some(greeting => text.includes(greeting))) {
            const responses = [
                `Hello! 👋 I'm MATDEV Bot. Use *${config.PREFIX}help* to see what I can do!`,
                `Hi there! 🤖 MATDEV at your service. Type *${config.PREFIX}help* for commands.`,
                `Hey! ⚡ MATDEV Bot here. Ready to assist you! Use *${config.PREFIX}help* to get started.`
            ];
            
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            
            // React to message first
            await context.react('👋');
            
            // Delay for more natural interaction
            setTimeout(async () => {
                await context.reply(randomResponse);
            }, 1000);
        }
    }

    getMessagePriority(message) {
        const sender = Utils.getPhoneNumber(message.key.remoteJid);
        const text = this.extractMessageContent(message).text || '';
        
        // Owner messages get highest priority
        if (sender === config.OWNER_NUMBER) {
            return MessageQueue.PRIORITY.HIGH;
        }
        
        // Sudo users get high priority
        if (config.SUDO_USERS.includes(sender)) {
            return MessageQueue.PRIORITY.HIGH;
        }
        
        // Commands get normal priority
        if (text.startsWith(config.PREFIX)) {
            return MessageQueue.PRIORITY.NORMAL;
        }
        
        // Regular messages get low priority
        return MessageQueue.PRIORITY.LOW;
    }

    isUserBlocked(sender) {
        return config.BLOCKED_USERS.includes(sender);
    }

    async markAsRead(message) {
        try {
            await this.client.socket.readMessages([message.key]);
        } catch (error) {
            // Silently fail for read receipts
        }
    }

    async sendTyping(chatId) {
        try {
            await this.client.socket.sendPresenceUpdate('composing', chatId);
            
            // Stop typing after 2 seconds
            setTimeout(async () => {
                await this.client.socket.sendPresenceUpdate('paused', chatId);
            }, 2000);
        } catch (error) {
            // Silently fail for typing indicator
        }
    }
}

module.exports = { MessageHandler };
