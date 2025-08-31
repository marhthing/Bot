/**
 * MATDEV Stats Command
 * Display comprehensive bot statistics and performance metrics
 */

const os = require('os');

module.exports = {
    name: 'stats',
    version: '1.0.0',
    description: 'MATDEV Statistics - Comprehensive bot performance metrics',
    commands: [{
        name: 'stats',
        aliases: ['statistics', 'info', 'status'],
        category: 'general',
        description: 'Display comprehensive bot statistics and performance metrics',
        usage: '.stats [detailed]',
        examples: ['.stats', '.stats detailed'],
        
        async handler(context) {
            const { args, reply, client } = context;
            const isDetailed = args[0] === 'detailed';
            
            if (isDetailed) {
                await this.showDetailedStats(context, client);
            } else {
                await this.showBasicStats(context, client);
            }
        },
        
        async showBasicStats(context, client) {
            const { reply } = context;
            const stats = client.getStats();
            const memUsage = process.memoryUsage();
            const uptime = process.uptime() * 1000;
            
            const statsMessage = `┌─────────────────────────────────────────────────────────────┐
│                   📊 MATDEV BOT STATISTICS                  │
├─────────────────────────────────────────────────────────────┤
│ 🤖 Bot Name         : MATDEV v1.0                          │
│ 🕐 Uptime           : ${this.formatDuration(uptime)}                    │
│ 🔌 Status           : ${stats.isConnected ? '🟢 Online' : '🔴 Offline'}                     │
│ 📨 Messages Sent    : ${(stats.messagesSent || 0).toLocaleString()}                         │
│ 📥 Messages Received: ${(stats.messagesReceived || 0).toLocaleString()}                         │
│ ⚡ Commands Executed: ${(stats.commandsExecuted || 0).toLocaleString()}                         │
│ 💾 Memory Usage     : ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB              │
│ 🔌 Plugins Loaded   : ${client.pluginLoader.getLoadedCount()}                           │
│ 📋 Available Commands: ${client.pluginLoader.getCommandCount()}                         │
└─────────────────────────────────────────────────────────────┘

*Performance Rating:* ${this.getPerformanceRating(memUsage, uptime)}
*Last Activity:* ${this.getLastActivity(stats.lastActivity)}

Use \`.stats detailed\` for comprehensive metrics`;

            await reply(statsMessage);
        },
        
        async showDetailedStats(context, client) {
            const { reply } = context;
            const stats = client.getStats();
            const memUsage = process.memoryUsage();
            const cpus = os.cpus();
            const loadAvg = os.loadavg();
            const uptime = process.uptime() * 1000;
            
            // Get plugin statistics
            const pluginStats = client.pluginLoader.getPluginStats();
            
            // Get performance metrics if available
            let performanceMetrics = '';
            if (client.performanceMonitor) {
                const perfReport = client.performanceMonitor.getMetricsReport();
                performanceMetrics = `
*📈 PERFORMANCE METRICS*
├ Average Response Time: ${perfReport.averageResponseTime}ms
├ Peak Memory Usage: ${Math.max(...(perfReport.memory ? [perfReport.memory.heapUsed] : [0]))} MB
├ Error Rate: ${perfReport.errors}/${perfReport.messages} (${perfReport.messages > 0 ? Math.round((perfReport.errors / perfReport.messages) * 100) : 0}%)
├ Commands Per Hour: ${Math.round((perfReport.commands / (perfReport.uptime / 3600000)) || 0)}
`;
            }
            
            const detailedStats = `┌─────────────────────────────────────────────────────────────┐
│                 📊 DETAILED MATDEV STATISTICS               │
└─────────────────────────────────────────────────────────────┘

*🤖 BOT INFORMATION*
├ Name: MATDEV WhatsApp Bot
├ Version: 1.0.0
├ Uptime: ${this.formatDuration(uptime)}
├ Status: ${stats.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
├ Last Activity: ${this.getLastActivity(stats.lastActivity)}

*📊 MESSAGE STATISTICS*
├ Messages Sent: ${(stats.messagesSent || 0).toLocaleString()}
├ Messages Received: ${(stats.messagesReceived || 0).toLocaleString()}
├ Commands Executed: ${(stats.commandsExecuted || 0).toLocaleString()}
├ Success Rate: ${this.calculateSuccessRate(stats)}%

*💾 MEMORY USAGE*
├ Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB
├ Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)} MB
├ External: ${Math.round(memUsage.external / 1024 / 1024)} MB
├ RSS: ${Math.round(memUsage.rss / 1024 / 1024)} MB

*🖥️ SYSTEM INFORMATION*
├ Platform: ${os.platform()} ${os.arch()}
├ Node.js: ${process.version}
├ CPU Cores: ${cpus.length}x ${cpus[0]?.model || 'Unknown'}
├ Load Average: ${loadAvg.map(l => l.toFixed(2)).join(', ')}
├ Free Memory: ${Math.round(os.freemem() / 1024 / 1024)} MB
├ Total Memory: ${Math.round(os.totalmem() / 1024 / 1024)} MB

*🔌 PLUGIN STATISTICS*
├ Total Plugins: ${pluginStats.totalPlugins}
├ Total Commands: ${pluginStats.totalCommands}
├ Plugin Load Time: ${pluginStats.loadTime}ms
${performanceMetrics}
*🛡️ SECURITY STATUS*
├ Session Health: ${client.sessionManager ? '🟢 Healthy' : '🔴 Unhealthy'}
├ Auto Backup: ${context.config?.SESSION_BACKUP_INTERVAL > 0 ? '🟢 Enabled' : '🔴 Disabled'}
├ Rate Limiting: 🟢 Active
├ Permission System: 🟢 Active

*Powered by MATDEV Team 2025*`;

            await reply(detailedStats);
        },
        
        formatDuration(milliseconds) {
            const seconds = Math.floor(milliseconds / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 0) {
                return `${days}d ${hours % 24}h ${minutes % 60}m`;
            } else if (hours > 0) {
                return `${hours}h ${minutes % 60}m`;
            } else if (minutes > 0) {
                return `${minutes}m ${seconds % 60}s`;
            } else {
                return `${seconds}s`;
            }
        },
        
        getLastActivity(timestamp) {
            if (!timestamp) return 'Never';
            
            const diff = Date.now() - timestamp;
            const seconds = Math.floor(diff / 1000);
            
            if (seconds < 60) {
                return `${seconds}s ago`;
            } else if (seconds < 3600) {
                return `${Math.floor(seconds / 60)}m ago`;
            } else if (seconds < 86400) {
                return `${Math.floor(seconds / 3600)}h ago`;
            } else {
                return `${Math.floor(seconds / 86400)}d ago`;
            }
        },
        
        getPerformanceRating(memUsage, uptime) {
            const memUsageMB = memUsage.heapUsed / 1024 / 1024;
            const uptimeHours = uptime / (1000 * 60 * 60);
            
            if (memUsageMB < 100 && uptimeHours > 24) {
                return '⭐⭐⭐⭐⭐ Excellent';
            } else if (memUsageMB < 200 && uptimeHours > 12) {
                return '⭐⭐⭐⭐ Very Good';
            } else if (memUsageMB < 300 && uptimeHours > 6) {
                return '⭐⭐⭐ Good';
            } else if (memUsageMB < 400) {
                return '⭐⭐ Fair';
            } else {
                return '⭐ Needs Optimization';
            }
        },
        
        calculateSuccessRate(stats) {
            const total = (stats.messagesSent || 0) + (stats.messagesReceived || 0);
            if (total === 0) return 100;
            
            const errors = stats.errorCount || 0;
            return Math.round(((total - errors) / total) * 100);
        }
    }]
};
