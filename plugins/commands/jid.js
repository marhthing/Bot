/**
 * MATDEV JID Command
 * Display the current chat's JID for administrative purposes
 */

const { Utils } = require('../../lib/utils');
const config = require('../../config');

module.exports = {
    name: 'jid',
    version: '1.0.0',
    description: 'Display current chat JID information',
    author: 'MATDEV Team',

    commands: [
        {
            name: 'jid',
            aliases: ['chatid', 'id'],
            category: 'utility',
            description: 'Get the current chat JID and related information',
            usage: [
                '.jid - Display current chat JID information'
            ],
            async handler(context) {
                const { chatId, isGroup, isPrivate, reply, sender, message } = context;

                try {
                    // Format the response with detailed JID information
                    let response = '📋 *Chat JID Information:*\n\n';

                    // Current chat JID (normalized)
                    const normalizedJid = Utils.normalizeJid(chatId);
                    response += `🎯 *Current Chat JID:*\n\`${normalizedJid}\`\n\n`;

                    // Show raw JID if it's different (like @lid format)
                    if (chatId !== normalizedJid) {
                        response += `🔍 *Raw JID:*\n\`${chatId}\`\n\n`;
                    }

                    // Chat type
                    const chatType = isGroup ? 'Group Chat' : 'Private Chat';
                    response += `💬 *Chat Type:* ${chatType}\n\n`;

                    // Show sender info
                    response += `👤 *Sender JID:*\n\`${sender}\`\n\n`;

                    // Show raw message key info for debugging
                    response += `🔍 *Message Key Info:*\n`;
                    response += `├ Remote JID: \`${message.key.remoteJid}\`\n`;
                    if (message.key.participant) {
                        response += `├ Participant: \`${message.key.participant}\`\n`;
                    }
                    response += `└ From Me: ${message.key.fromMe}\n\n`;

                    // Additional info
                    if (isGroup) {
                        response += `ℹ️ *Note:* This is a group chat JID. Use this JID when managing group permissions.\n\n`;
                    } else {
                        response += `ℹ️ *Note:* This is a private chat JID. Use this JID when managing user permissions.\n\n`;
                    }

                    // Formatted versions
                    response += `📝 *Formatted Info:*\n`;
                    response += `├ Display: ${Utils.formatJid(chatId)}\n`;
                    response += `├ Normalized: ${Utils.normalizeJid(chatId)}\n`;

                    if (!isGroup) {
                        response += `└ Phone: ${Utils.getPhoneNumber(chatId)}\n\n`;
                    } else {
                        response += `└ Group ID: ${chatId.split('@')[0]}\n\n`;
                    }

                    // Usage examples
                    response += `💡 *Usage Examples:*\n`;
                    response += `• Grant permission: \`${config.PREFIX}allow ${chatId} ping\`\n`;
                    response += `• Remove permission: \`${config.PREFIX}remove ${chatId} ping\`\n`;
                    response += `• List permissions: \`${config.PREFIX}permissions ${chatId}\``;

                    await reply(response);

                } catch (error) {
                    await reply(`❌ Failed to get JID information: ${error.message}`);
                }
            }
        }
    ]
};