/**
 * MATDEV Permission Management Commands
 * Owner-only commands for managing user permissions
 */

const { Utils } = require('../../lib/utils');
const config = require('../../config');

module.exports = {
    name: 'permissions',
    version: '1.0.0',
    description: 'Permission management system for controlling user access to commands',
    author: 'MATDEV Team',
    
    commands: [
        {
            name: 'allow',
            aliases: ['permit', 'grant'],
            category: 'owner',
            description: 'Allow a user to use specific commands',
            usage: [
                '.allow <command> - Allow current chat user to use a command',
                '.allow <jid> <command> - Allow specific user to use a command',
                '.allow <command> * - Allow current chat user to use all commands'
            ],
            ownerOnly: true,
            async handler(context) {
                const { args, reply, chatId, client } = context;
                
                if (args.length < 1) {
                    return await reply(`❌ Usage:\n• \`${config.PREFIX}allow <command>\` - Allow current chat user\n• \`${config.PREFIX}allow <jid> <command>\` - Allow specific user\n• \`${config.PREFIX}allow *\` - Allow all commands for current chat`);
                }

                let targetJid, command;
                
                if (args.length === 1) {
                    // .allow <command> - for current chat
                    targetJid = chatId;
                    command = args[0].toLowerCase();
                } else {
                    // .allow <jid> <command> - for specific user
                    targetJid = args[0];
                    command = args[1].toLowerCase();
                    
                    // Clean JID format
                    if (!targetJid.includes('@')) {
                        targetJid = targetJid + '@s.whatsapp.net';
                    }
                }

                try {
                    const permissionManager = client.messageHandler.permissionManager;
                    const success = await permissionManager.allowCommand(targetJid, command);
                    
                    if (success) {
                        const displayJid = Utils.formatJid(targetJid);
                        await reply(`✅ Successfully allowed command \`${command}\` for ${displayJid}`);
                    } else {
                        await reply(`⚠️ User already has permission for command \`${command}\``);
                    }
                } catch (error) {
                    await reply(`❌ Failed to grant permission: ${error.message}`);
                }
            }
        },
        
        {
            name: 'remove',
            aliases: ['revoke', 'deny'],
            category: 'owner',
            description: 'Remove user permission for specific commands',
            usage: [
                '.remove <command> - Remove current chat user permission',
                '.remove <jid> <command> - Remove specific user permission'
            ],
            ownerOnly: true,
            async handler(context) {
                const { args, reply, chatId, client } = context;
                
                if (args.length < 1) {
                    return await reply(`❌ Usage:\n• \`${config.PREFIX}remove <command>\` - Remove current chat user permission\n• \`${config.PREFIX}remove <jid> <command>\` - Remove specific user permission`);
                }

                let targetJid, command;
                
                if (args.length === 1) {
                    // .remove <command> - for current chat
                    targetJid = chatId;
                    command = args[0].toLowerCase();
                } else {
                    // .remove <jid> <command> - for specific user
                    targetJid = args[0];
                    command = args[1].toLowerCase();
                    
                    // Clean JID format
                    if (!targetJid.includes('@')) {
                        targetJid = targetJid + '@s.whatsapp.net';
                    }
                }

                try {
                    const permissionManager = client.messageHandler.permissionManager;
                    const success = await permissionManager.removeCommand(targetJid, command);
                    
                    if (success) {
                        const displayJid = Utils.formatJid(targetJid);
                        await reply(`❌ Successfully removed command \`${command}\` permission for ${displayJid}`);
                    } else {
                        await reply(`⚠️ User doesn't have permission for command \`${command}\``);
                    }
                } catch (error) {
                    await reply(`❌ Failed to remove permission: ${error.message}`);
                }
            }
        },
        
        {
            name: 'permissions',
            aliases: ['perms', 'listperms'],
            category: 'owner',
            description: 'List all user permissions',
            usage: [
                '.permissions - List all permissions',
                '.permissions <jid> - List specific user permissions'
            ],
            ownerOnly: true,
            async handler(context) {
                const { args, reply, chatId, client } = context;
                
                try {
                    const permissionManager = client.messageHandler.permissionManager;
                    
                    if (args.length === 0) {
                        // List all permissions
                        const allPermissions = permissionManager.getAllPermissions();
                        const users = Object.keys(allPermissions);
                        
                        if (users.length === 0) {
                            return await reply('📋 No permissions granted yet.');
                        }
                        
                        let message = '📋 *User Permissions:*\n\n';
                        for (const jid of users) {
                            const displayJid = Utils.formatJid(jid);
                            const commands = allPermissions[jid].join(', ');
                            message += `👤 *${displayJid}*\n└ Commands: ${commands}\n\n`;
                        }
                        
                        await reply(message);
                    } else {
                        // List specific user permissions
                        let targetJid = args[0];
                        if (!targetJid.includes('@')) {
                            targetJid = targetJid + '@s.whatsapp.net';
                        }
                        
                        const userPermissions = permissionManager.getUserPermissions(targetJid);
                        const displayJid = Utils.formatJid(targetJid);
                        
                        if (userPermissions.length === 0) {
                            await reply(`📋 *${displayJid}* has no permissions.`);
                        } else {
                            const commands = userPermissions.join(', ');
                            await reply(`📋 *${displayJid}* permissions:\n└ Commands: ${commands}`);
                        }
                    }
                } catch (error) {
                    await reply(`❌ Failed to list permissions: ${error.message}`);
                }
            }
        }
    ]
};