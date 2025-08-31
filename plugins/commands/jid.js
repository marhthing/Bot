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

                    // For private chats, we want the other person's JID (not the bot's own JID)
                    // For group chats, use the group JID
                    let actualChatJid;
                    if (isPrivate) {
                        // In private chat, use the chat JID (which represents the other person)
                        // The chatId in private chats is the other person's JID
                        actualChatJid = Utils.normalizeJid(chatId);
                    } else {
                        // In group chat, use the group JID
                        actualChatJid = Utils.normalizeJid(chatId);
                    }

                    response += `🎯 *Chat JID:*\n\`${actualChatJid}\`\n\n`;

                    // Show raw JID for debugging if it's different
                    if (chatId !== actualChatJid) {
                        response += `🔍 *Raw Chat JID:*\n\`${chatId}\`\n\n`;
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
                        response += `ℹ️ *Note:* This is the other person's JID in this private chat. Use this JID when managing their permissions.\n\n`;
                    }

                    // Formatted versions
                    response += `📝 *Formatted Info:*\n`;
                    response += `├ Display: ${Utils.formatJid(actualChatJid)}\n`;
                    response += `├ Normalized: ${actualChatJid}\n`;

                    if (!isGroup) {
                        response += `└ Phone: ${Utils.getPhoneNumber(actualChatJid)}\n\n`;
                    } else {
                        response += `└ Group ID: ${actualChatJid.split('@')[0]}\n\n`;
                    }

                    // Usage examples
                    response += `💡 *Usage Examples:*\n`;
                    response += `• Grant permission: \`${config.PREFIX}allow ${actualChatJid} ping\`\n`;
                    response += `• Remove permission: \`${config.PREFIX}remove ${actualChatJid} ping\`\n`;
                    response += `• List permissions: \`${config.PREFIX}permissions ${actualChatJid}\``;

                    await reply(response);

                } catch (error) {
                    await reply(`❌ Failed to get JID information: ${error.message}`);
                }
            }
        }
    ]
};