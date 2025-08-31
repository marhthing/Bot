/**
 * MATDEV Ping Command
 * Test bot responsiveness and display performance metrics
 */

module.exports = {
    name: 'ping',
    version: '1.0.0',
    description: 'MATDEV Ping Command - Test bot response time and performance',
    commands: [{
        name: 'ping',
        aliases: ['p', 'pong', 'test'],
        category: 'general',
        description: 'Test bot response time and show performance metrics',
        usage: '.ping',
        examples: ['.ping'],
        
        async handler(context) {
            const { reply, client } = context;
            const startTime = Date.now();
            
            // Get performance metrics
            const memUsage = process.memoryUsage();
            const uptime = process.uptime();
            const stats = client.getStats();
            
            const responseTime = Date.now() - startTime;
            
            const pingMessage = `┌─────────────────────────────────────────────────────────────┐
│                    🏓 MATDEV PONG!                          │
├─────────────────────────────────────────────────────────────┤
│ 📡 Response Time    : ${responseTime}ms                           │
│ 🕐 Bot Uptime       : ${this.formatUptime(uptime * 1000)}                    │
│ 💾 Memory Usage     : ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB                         │
│ 📨 Messages Sent    : ${stats.messagesSent || 0}                           │
│ 📥 Messages Received: ${stats.messagesReceived || 0}                           │
│ ⚡ Commands Executed: ${stats.commandsExecuted || 0}                           │
│ 🔌 Connection Status: ${stats.isConnected ? '🟢 Online' : '🔴 Offline'}                   │
│ 📊 Last Activity    : ${this.getLastActivity(stats.lastActivity)}              │
└─────────────────────────────────────────────────────────────┘

*🤖 MATDEV Bot Status: OPERATIONAL*
*⚡ High-Performance Mode: ACTIVE*
*🛡️ Security: ENABLED*

Powered by MATDEV Team 2025`;

            await reply(pingMessage);
            
            // Record performance metrics
            if (client.performanceMonitor) {
                client.performanceMonitor.recordResponseTime(responseTime);
                client.performanceMonitor.recordCommand();
            }
        },
        
        formatUptime(uptime) {
            const seconds = Math.floor(uptime / 1000);
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
            if (!timestamp) return 'N/A';
            
            const diff = Date.now() - timestamp;
            const seconds = Math.floor(diff / 1000);
            
            if (seconds < 60) {
                return `${seconds}s ago`;
            } else if (seconds < 3600) {
                return `${Math.floor(seconds / 60)}m ago`;
            } else {
                return `${Math.floor(seconds / 3600)}h ago`;
            }
        }
    }]
};
