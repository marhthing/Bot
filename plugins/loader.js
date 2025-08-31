/**
 * MATDEV Plugin Loader
 * Hot-reloadable plugin system with performance monitoring
 */

const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const { Logger } = require('../lib/logger');
const config = require('../config');

class PluginLoader {
    constructor(client) {
        this.client = client;
        this.logger = new Logger('MATDEV-PLUGINS');
        this.plugins = new Map();
        this.commands = new Map();
        this.watchers = new Map();
        this.loadStartTime = Date.now();
    }

    async loadPlugins() {
        try {
            this.logger.info('🔌 Loading MATDEV plugins...');
            
            const pluginDirs = [
                config.DIRS.PLUGINS,
                config.CUSTOM_PLUGINS_DIR
            ].filter(dir => fs.existsSync(dir));

            for (const pluginDir of pluginDirs) {
                await this.loadPluginsFromDirectory(pluginDir);
            }

            if (config.HOT_RELOAD) {
                this.setupHotReload();
            }

            const loadTime = Date.now() - this.loadStartTime;
            this.logger.success(`✅ Loaded ${this.plugins.size} plugins with ${this.commands.size} commands in ${loadTime}ms`);
            
        } catch (error) {
            this.logger.error('❌ Failed to load plugins:', error);
        }
    }

    async loadPluginsFromDirectory(directory) {
        const items = await fs.readdir(directory, { withFileTypes: true });

        for (const item of items) {
            const itemPath = path.join(directory, item.name);

            if (item.isDirectory()) {
                await this.loadPluginsFromDirectory(itemPath);
            } else if (item.name.endsWith('.js') && !item.name.startsWith('.') && item.name !== 'loader.js') {
                await this.loadPlugin(itemPath);
            }
        }
    }

    async loadPlugin(pluginPath) {
        try {
            // Ensure absolute path for require
            const absolutePath = path.resolve(pluginPath);
            
            // Clear require cache for hot reload
            delete require.cache[absolutePath];
            
            const plugin = require(absolutePath);
            
            if (!this.validatePlugin(plugin)) {
                this.logger.warn(`⚠️ Invalid plugin structure: ${path.basename(pluginPath)}`);
                return;
            }

            const pluginName = plugin.name || path.basename(pluginPath, '.js');
            
            // Register plugin
            this.plugins.set(pluginName, {
                ...plugin,
                path: pluginPath,
                loadTime: Date.now()
            });

            // Register commands if any
            if (plugin.commands) {
                plugin.commands.forEach(cmd => {
                    this.commands.set(cmd.name, {
                        ...cmd,
                        plugin: pluginName,
                        handler: cmd.handler
                    });
                    
                    // Register aliases
                    if (cmd.aliases) {
                        cmd.aliases.forEach(alias => {
                            this.commands.set(alias, {
                                ...cmd,
                                plugin: pluginName,
                                handler: cmd.handler,
                                isAlias: true
                            });
                        });
                    }
                });
            }

            this.logger.info(`📦 Loaded plugin: ${pluginName}`);

        } catch (error) {
            this.logger.error(`❌ Failed to load plugin ${pluginPath}:`, error);
        }
    }

    validatePlugin(plugin) {
        const required = ['name', 'version', 'description'];
        return required.every(field => plugin[field]);
    }

    setupHotReload() {
        const watchPaths = [
            config.DIRS.PLUGINS,
            config.CUSTOM_PLUGINS_DIR
        ].filter(dir => fs.existsSync(dir));

        watchPaths.forEach(watchPath => {
            const watcher = chokidar.watch(watchPath, {
                ignored: /node_modules/,
                persistent: true,
                ignoreInitial: true
            });

            watcher
                .on('change', async (filePath) => {
                    if (filePath.endsWith('.js')) {
                        this.logger.info(`🔄 Hot reloading: ${path.basename(filePath)}`);
                        await this.reloadPlugin(filePath);
                    }
                })
                .on('add', async (filePath) => {
                    if (filePath.endsWith('.js')) {
                        this.logger.info(`➕ New plugin detected: ${path.basename(filePath)}`);
                        await this.loadPlugin(filePath);
                    }
                })
                .on('unlink', (filePath) => {
                    if (filePath.endsWith('.js')) {
                        this.logger.info(`➖ Plugin removed: ${path.basename(filePath)}`);
                        this.unloadPlugin(filePath);
                    }
                });

            this.watchers.set(watchPath, watcher);
        });

        this.logger.info('🔥 Hot reload enabled for plugins');
    }

    async reloadPlugin(pluginPath) {
        try {
            // Find and remove old plugin
            const oldPlugin = Array.from(this.plugins.values())
                .find(p => p.path === pluginPath);

            if (oldPlugin) {
                this.unloadPlugin(pluginPath);
            }

            // Load new version
            await this.loadPlugin(pluginPath);

        } catch (error) {
            this.logger.error(`Failed to reload plugin ${pluginPath}:`, error);
        }
    }

    unloadPlugin(pluginPath) {
        // Find plugin by path
        const pluginEntry = Array.from(this.plugins.entries())
            .find(([name, plugin]) => plugin.path === pluginPath);

        if (!pluginEntry) return;

        const [pluginName, plugin] = pluginEntry;

        // Remove commands
        if (plugin.commands) {
            plugin.commands.forEach(cmd => {
                this.commands.delete(cmd.name);
                if (cmd.aliases) {
                    cmd.aliases.forEach(alias => this.commands.delete(alias));
                }
            });
        }

        // Remove plugin
        this.plugins.delete(pluginName);

        this.logger.info(`🗑️ Unloaded plugin: ${pluginName}`);
    }

    async executeCommand(commandName, context) {
        const command = this.commands.get(commandName);
        
        if (!command) {
            return false;
        }

        try {
            const startTime = Date.now();
            
            // Check permissions
            if (!this.checkPermissions(command, context)) {
                return false;
            }

            // Execute command
            await command.handler(context);
            
            const duration = Date.now() - startTime;
            this.logger.command(commandName, context.sender, context.isGroup ? 'group' : 'private');
            this.logger.performance(`Command ${commandName}`, duration);
            
            return true;

        } catch (error) {
            this.logger.error(`Command execution failed [${commandName}]:`, error);
            
            // Send error message to user
            await context.reply('❌ An error occurred while executing the command.');
            return false;
        }
    }

    checkPermissions(command, context) {
        const { sender, isGroup } = context;
        
        // Owner always has access
        if (sender === config.OWNER_NUMBER) {
            return true;
        }

        // Check sudo users
        if (command.permission === 'sudo' && !config.SUDO_USERS.includes(sender)) {
            return false;
        }

        // Check group/private restrictions
        if (command.groupOnly && !isGroup) {
            return false;
        }

        if (command.privateOnly && isGroup) {
            return false;
        }

        return true;
    }

    getCommand(name) {
        return this.commands.get(name);
    }

    getAllCommands() {
        return Array.from(this.commands.values())
            .filter(cmd => !cmd.isAlias)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getCommandsByCategory(category) {
        return this.getAllCommands()
            .filter(cmd => cmd.category === category);
    }

    getLoadedCount() {
        return this.plugins.size;
    }

    isLoaded() {
        return this.plugins.size > 0;
    }

    getCommandCount() {
        return this.commands.size;
    }

    getPluginStats() {
        const plugins = Array.from(this.plugins.values());
        const commandsByPlugin = {};

        plugins.forEach(plugin => {
            commandsByPlugin[plugin.name] = (plugin.commands || []).length;
        });

        return {
            totalPlugins: this.plugins.size,
            totalCommands: this.commands.size,
            commandsByPlugin,
            loadTime: Date.now() - this.loadStartTime
        };
    }

    destroy() {
        // Close file watchers
        this.watchers.forEach(watcher => watcher.close());
        this.watchers.clear();
        
        // Clear plugins and commands
        this.plugins.clear();
        this.commands.clear();
        
        this.logger.info('🔌 Plugin loader destroyed');
    }
}

module.exports = { PluginLoader };
