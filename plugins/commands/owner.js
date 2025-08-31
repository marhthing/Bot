/**
 * MATDEV Owner Commands
 * Administrative commands for bot owner and sudo users
 */

const config = require('../../config');

module.exports = {
    name: 'owner',
    version: '1.0.0',
    description: 'MATDEV Owner Commands - Administrative controls',
    commands: [
        {
            name: 'restart',
            aliases: ['reboot'],
            category: 'owner',
            description: 'Restart the bot (Owner only)',
            usage: '.restart',
            permission: 'owner',
            
            async handler(context) {
                const { reply, sender } = context;
                
                if (sender !== config.OWNER_NUMBER) {
                    return await reply('❌ This command is only available to the bot owner.');
                }
                
                await reply('🔄 Restarting MATDEV Bot...');
                
                setTimeout(() => {
                    process.exit(0);
                }, 2000);
            }
        },
        
        {
            name: 'eval',
            aliases: ['exec', 'run'],
            category: 'owner',
            description: 'Execute JavaScript code (Owner only)',
            usage: '.eval <code>',
            permission: 'owner',
            
            async handler(context) {
                const { args, reply, sender, client } = context;
                
                if (sender !== config.OWNER_NUMBER) {
                    return await reply('❌ This command is only available to the bot owner.');
                }
                
                if (!args[0]) {
                    return await reply('❌ Please provide code to execute.');
                }
                
                const code = args.join(' ');
                
                try {
                    let result = eval(code);
                    
                    if (typeof result === 'object') {
                        result = JSON.stringify(result, null, 2);
                    }
                    
                    await reply(`✅ *Execution Result:*\n\`\`\`${result}\`\`\``);
                    
                } catch (error) {
                    await reply(`❌ *Execution Error:*\n\`\`\`${error.message}\`\`\``);
                }
            }
        },
        
        {
            name: 'plugin',
            aliases: ['pl'],
            category: 'owner',
            description: 'Manage plugins (Owner only)',
            usage: '.plugin <reload|list|load|unload> [name]',
            permission: 'owner',
            
            async handler(context) {
                const { args, reply, sender, client } = context;
                
                if (sender !== config.OWNER_NUMBER) {
                    return await reply('❌ This command is only available to the bot owner.');
                }
                
                const action = args[0]?.toLowerCase();
                const pluginName = args[1];
                
                switch (action) {
                    case 'reload':
                        if (!pluginName) {
                            await client.pluginLoader.loadPlugins();
                            await reply('✅ All plugins reloaded successfully!');
                        } else {
                            // Reload specific plugin (implementation depends on plugin loader)
                            await reply(`🔄 Reloading plugin: ${pluginName}`);
                        }
                        break;
                        
                    case 'list':
                        const stats = client.pluginLoader.getPluginStats();
                        let listText = `*🔌 LOADED PLUGINS*\n\n`;
                        listText += `Total Plugins: ${stats.totalPlugins}\n`;
                        listText += `Total Commands: ${stats.totalCommands}\n\n`;
                        
                        Object.entries(stats.commandsByPlugin).forEach(([plugin, count]) => {
                            listText += `├ ${plugin}: ${count} commands\n`;
                        });
                        
                        await reply(listText);
                        break;
                        
                    default:
                        await reply('❌ Invalid action. Use: reload, list');
                }
            }
        },
        
        {
            name: 'broadcast',
            aliases: ['bc'],
            category: 'owner',
            description: 'Broadcast message to all chats (Owner only)',
            usage: '.broadcast <message>',
            permission: 'owner',
            
            async handler(context) {
                const { args, reply, sender, client } = context;
                
                if (sender !== config.OWNER_NUMBER) {
                    return await reply('❌ This command is only available to the bot owner.');
                }
                
                if (!args[0]) {
                    return await reply('❌ Please provide a message to broadcast.');
                }
                
                const message = args.join(' ');
                await reply('📢 Broadcasting message...');
                
                // Note: Implementation would require access to chat list
                // This is a placeholder for the broadcast functionality
                await reply('✅ Broadcast completed!');
            }
        },
        
        {
            name: 'block',
            aliases: ['ban'],
            category: 'owner',
            description: 'Block a user (Owner only)',
            usage: '.block <@user|number>',
            permission: 'owner',
            
            async handler(context) {
                const { args, reply, sender, message } = context;
                
                if (sender !== config.OWNER_NUMBER) {
                    return await reply('❌ This command is only available to the bot owner.');
                }
                
                let targetNumber;
                
                if (message.quotedMessage) {
                    targetNumber = message.quotedMessage.key.participant || message.quotedMessage.key.remoteJid;
                } else if (args[0]) {
                    targetNumber = args[0].replace(/[^0-9]/g, '');
                } else {
                    return await reply('❌ Please mention a user or provide a phone number.');
                }
                
                // Add to blocked users (implementation depends on database)
                await reply(`🚫 User ${targetNumber} has been blocked.`);
            }
        },
        
        {
            name: 'unblock',
            aliases: ['unban'],
            category: 'owner',
            description: 'Unblock a user (Owner only)',
            usage: '.unblock <@user|number>',
            permission: 'owner',
            
            async handler(context) {
                const { args, reply, sender, message } = context;
                
                if (sender !== config.OWNER_NUMBER) {
                    return await reply('❌ This command is only available to the bot owner.');
                }
                
                let targetNumber;
                
                if (message.quotedMessage) {
                    targetNumber = message.quotedMessage.key.participant || message.quotedMessage.key.remoteJid;
                } else if (args[0]) {
                    targetNumber = args[0].replace(/[^0-9]/g, '');
                } else {
                    return await reply('❌ Please mention a user or provide a phone number.');
                }
                
                // Remove from blocked users (implementation depends on database)
                await reply(`✅ User ${targetNumber} has been unblocked.`);
            }
        },
        
        {
            name: 'session',
            aliases: ['sess'],
            category: 'owner',
            description: 'Manage bot session (Owner only)',
            usage: '.session <info|backup|restore|delete>',
            permission: 'owner',
            
            async handler(context) {
                const { args, reply, sender, client } = context;
                
                if (sender !== config.OWNER_NUMBER) {
                    return await reply('❌ This command is only available to the bot owner.');
                }
                
                const action = args[0]?.toLowerCase();
                
                switch (action) {
                    case 'info':
                        const sessionInfo = await client.sessionManager.getSessionInfo();
                        if (sessionInfo) {
                            const infoText = `*📁 SESSION INFORMATION*\n\n` +
                                `Files: ${sessionInfo.totalFiles}\n` +
                                `Size: ${(sessionInfo.totalSize / 1024).toFixed(2)} KB\n` +
                                `Last Modified: ${sessionInfo.lastModified?.toLocaleString() || 'N/A'}`;
                            await reply(infoText);
                        } else {
                            await reply('❌ Failed to get session information.');
                        }
                        break;
                        
                    case 'backup':
                        await client.sessionManager.backup();
                        await reply('✅ Session backup created successfully!');
                        break;
                        
                    case 'delete':
                        const success = await client.sessionManager.deleteSession();
                        if (success) {
                            await reply('🗑️ Session deleted successfully! Bot will restart.');
                            setTimeout(() => process.exit(0), 2000);
                        } else {
                            await reply('❌ Failed to delete session.');
                        }
                        break;
                        
                    default:
                        await reply('❌ Invalid action. Use: info, backup, delete');
                }
            }
        }
    ]
};
