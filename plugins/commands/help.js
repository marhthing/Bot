/**
 * MATDEV Help Command
 * Display available commands and bot information
 */

module.exports = {
    name: 'help',
    version: '1.0.0',
    description: 'MATDEV Help System - Display commands and bot information',
    commands: [{
        name: 'help',
        aliases: ['h', 'menu', 'commands'],
        category: 'general',
        description: 'Show all available commands',
        usage: '.help [command]',
        examples: ['.help', '.help ping'],
        
        async handler(context) {
            const { args, reply, client } = context;
            const pluginLoader = client.pluginLoader;
            
            // Show specific command help
            if (args[0]) {
                const command = pluginLoader.getCommand(args[0]);
                if (!command) {
                    return await reply('❌ Command not found!');
                }
                
                return await reply(await this.getCommandHelp(command));
            }
            
            // Show all commands grouped by category
            const commands = pluginLoader.getAllCommands();
            const categories = {};
            
            commands.forEach(cmd => {
                const category = cmd.category || 'other';
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push(cmd);
            });
            
            let helpText = `┌─────────────────────────────────────────────────────────────┐
│                    🤖 MATDEV BOT HELP                       │
├─────────────────────────────────────────────────────────────┤
│ High-Performance WhatsApp Bot v1.0                         │
│ Developed by MATDEV Team                                    │
│                                                             │
│ 📝 Prefix: ${context.prefix}                                          │
│ 📊 Total Commands: ${commands.length}                                  │
│ 🔌 Active Plugins: ${pluginLoader.getLoadedCount()}                              │
└─────────────────────────────────────────────────────────────┘

`;

            // Add commands by category
            Object.keys(categories).sort().forEach(category => {
                helpText += `\n*📂 ${category.toUpperCase()}*\n`;
                
                categories[category].forEach(cmd => {
                    const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
                    helpText += `├ ${context.prefix}${cmd.name}${aliases}\n`;
                    helpText += `│ └ ${cmd.description}\n`;
                });
            });
            
            helpText += `\n*📖 Usage Examples:*
├ ${context.prefix}help ping - Get help for ping command
├ ${context.prefix}stats - View bot statistics  
├ ${context.prefix}ping - Test bot response time

*💡 Tips:*
├ Use ${context.prefix}help <command> for detailed help
├ Commands are case-insensitive
├ Some commands may require permissions

*🔗 MATDEV Bot Features:*
├ ⚡ High-Performance Architecture
├ 🔄 Auto Session Management  
├ 📊 Real-time Performance Monitoring
├ 🔌 Hot-Reloadable Plugin System
├ 🛡️ Advanced Security Features

*Powered by MATDEV Team 2025*`;
            
            await reply(helpText);
        },
        
        async getCommandHelp(command) {
            let helpText = `┌─────────────────────────────────────────────────────────────┐
│                   📖 COMMAND HELP                           │
└─────────────────────────────────────────────────────────────┘

*🔸 Command:* ${command.name}
*📂 Category:* ${command.category || 'other'}
*📝 Description:* ${command.description}

`;

            if (command.aliases && command.aliases.length > 0) {
                helpText += `*🔗 Aliases:* ${command.aliases.join(', ')}\n\n`;
            }
            
            if (command.usage) {
                helpText += `*📋 Usage:* ${command.usage}\n\n`;
            }
            
            if (command.examples && command.examples.length > 0) {
                helpText += `*💡 Examples:*\n`;
                command.examples.forEach(example => {
                    helpText += `├ ${example}\n`;
                });
                helpText += '\n';
            }
            
            if (command.permission) {
                helpText += `*🔒 Permission:* ${command.permission}\n`;
            }
            
            if (command.groupOnly) {
                helpText += `*👥 Group Only:* Yes\n`;
            }
            
            if (command.privateOnly) {
                helpText += `*👤 Private Only:* Yes\n`;
            }
            
            return helpText;
        }
    }]
};
