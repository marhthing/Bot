/**
 * MATDEV Event Handler
 * Handle WhatsApp events like group changes, presence updates, etc.
 */

const { Logger } = require('../lib/logger');
const { Utils } = require('../lib/utils');
const config = require('../config');

class EventHandler {
    constructor(client) {
        this.client = client;
        this.logger = new Logger('MATDEV-EVENTS');
        this.presenceCache = new Map();
        this.groupCache = new Map();
    }

    async handleGroupsUpsert(groups) {
        try {
            for (const group of groups) {
                this.logger.info(`📊 New group detected: ${group.subject} (${group.id})`);
                
                // Cache group info
                this.groupCache.set(group.id, {
                    subject: group.subject,
                    owner: group.owner,
                    creation: group.creation,
                    participants: group.participants?.length || 0,
                    cached: Date.now()
                });
                
                // Send welcome message if enabled and bot is admin
                if (config.WELCOME_MESSAGE && this.isBotAdmin(group)) {
                    await this.sendGroupWelcome(group.id, group.subject);
                }
            }
        } catch (error) {
            this.logger.error('Group upsert handling error:', error);
        }
    }

    async handleParticipantsUpdate(update) {
        try {
            const { id, participants, action } = update;
            
            this.logger.info(`👥 Group ${id} participants ${action}: ${participants.join(', ')}`);
            
            // Update cached participant count
            const cachedGroup = this.groupCache.get(id);
            if (cachedGroup) {
                if (action === 'add') {
                    cachedGroup.participants += participants.length;
                } else if (action === 'remove') {
                    cachedGroup.participants -= participants.length;
                }
                cachedGroup.lastUpdate = Date.now();
            }
            
            // Handle different participant actions
            switch (action) {
                case 'add':
                    await this.handleParticipantAdd(id, participants);
                    break;
                case 'remove':
                    await this.handleParticipantRemove(id, participants);
                    break;
                case 'promote':
                    await this.handleParticipantPromote(id, participants);
                    break;
                case 'demote':
                    await this.handleParticipantDemote(id, participants);
                    break;
            }
            
        } catch (error) {
            this.logger.error('Participants update handling error:', error);
        }
    }

    async handleParticipantAdd(groupId, participants) {
        if (!config.WELCOME_MESSAGE) return;
        
        try {
            const groupInfo = await this.getGroupInfo(groupId);
            
            for (const participant of participants) {
                const phoneNumber = Utils.getPhoneNumber(participant);
                const welcomeMessage = await this.createWelcomeMessage(groupInfo, phoneNumber);
                
                await this.client.sendMessage(groupId, {
                    text: welcomeMessage
                });
                
                // Add slight delay between messages
                await Utils.sleep(500);
            }
        } catch (error) {
            this.logger.error('Welcome message error:', error);
        }
    }

    async handleParticipantRemove(groupId, participants) {
        try {
            const groupInfo = await this.getGroupInfo(groupId);
            
            for (const participant of participants) {
                const phoneNumber = Utils.getPhoneNumber(participant);
                this.logger.info(`👋 ${phoneNumber} left group ${groupInfo?.subject || groupId}`);
                
                // Optional: Send goodbye message
                if (config.GOODBYE_MESSAGE) {
                    const goodbyeMessage = `👋 *${phoneNumber}* has left the group.\n\nThank you for being part of our community!`;
                    
                    await this.client.sendMessage(groupId, {
                        text: goodbyeMessage
                    });
                }
            }
        } catch (error) {
            this.logger.error('Goodbye message error:', error);
        }
    }

    async handleParticipantPromote(groupId, participants) {
        try {
            const groupInfo = await this.getGroupInfo(groupId);
            
            for (const participant of participants) {
                const phoneNumber = Utils.getPhoneNumber(participant);
                this.logger.info(`👑 ${phoneNumber} promoted to admin in ${groupInfo?.subject || groupId}`);
                
                const promoteMessage = `🎉 Congratulations! 👑\n\n*@${phoneNumber}* has been promoted to group admin!\n\nWith great power comes great responsibility! 💪`;
                
                await this.client.sendMessage(groupId, {
                    text: promoteMessage,
                    mentions: [participant]
                });
            }
        } catch (error) {
            this.logger.error('Promote message error:', error);
        }
    }

    async handleParticipantDemote(groupId, participants) {
        try {
            const groupInfo = await this.getGroupInfo(groupId);
            
            for (const participant of participants) {
                const phoneNumber = Utils.getPhoneNumber(participant);
                this.logger.info(`👤 ${phoneNumber} demoted from admin in ${groupInfo?.subject || groupId}`);
                
                const demoteMessage = `📋 *@${phoneNumber}* is no longer a group admin.\n\nThank you for your service! 🙏`;
                
                await this.client.sendMessage(groupId, {
                    text: demoteMessage,
                    mentions: [participant]
                });
            }
        } catch (error) {
            this.logger.error('Demote message error:', error);
        }
    }

    async handlePresenceUpdate(update) {
        try {
            const { id, presences } = update;
            
            // Cache presence information for analytics
            Object.keys(presences).forEach(participant => {
                const presence = presences[participant];
                this.presenceCache.set(participant, {
                    lastKnownPresence: presence.lastKnownPresence,
                    lastSeen: presence.lastSeen,
                    timestamp: Date.now()
                });
            });
            
            // Clean old presence cache (keep only last hour)
            this.cleanPresenceCache();
            
        } catch (error) {
            this.logger.error('Presence update handling error:', error);
        }
    }

    async createWelcomeMessage(groupInfo, phoneNumber) {
        const welcomeMessage = `┌─────────────────────────────────────────────────────────────┐
│                    🎉 WELCOME TO THE GROUP!                 │
└─────────────────────────────────────────────────────────────┘

Hello *@${phoneNumber}*! 👋

Welcome to *${groupInfo?.subject || 'our group'}*! 🎊

*🤖 About MATDEV Bot:*
├ High-Performance WhatsApp Assistant
├ Available 24/7 to help you
├ Type *${config.PREFIX}help* to see all commands
├ Type *${config.PREFIX}ping* to test response

*📋 Group Guidelines:*
├ Be respectful to all members
├ Keep conversations relevant
├ No spam or inappropriate content
├ Have fun and enjoy your stay!

*💡 Quick Commands:*
├ ${config.PREFIX}help - Show all commands
├ ${config.PREFIX}ping - Test bot response
├ ${config.PREFIX}stats - View bot statistics

Powered by MATDEV Team 2025 ⚡`;

        return welcomeMessage;
    }

    async sendGroupWelcome(groupId, groupName) {
        try {
            const welcomeMessage = `🎉 *MATDEV Bot Added to Group!*

Hello everyone! I'm MATDEV, your new WhatsApp assistant! 🤖

*🔥 What I can do:*
├ ⚡ Lightning-fast command responses
├ 📊 Performance monitoring and statistics
├ 🔧 Media processing and downloads
├ 🎯 Smart command suggestions
├ 🛡️ Advanced security features

*🚀 Get Started:*
Type *${config.PREFIX}help* to see all available commands

*📈 Performance Features:*
├ Multi-core processing support
├ Real-time performance metrics
├ Automated session management
├ Hot-reloadable plugin system

Thank you for choosing MATDEV! Ready to serve ${groupName}! 💪

*Powered by MATDEV Team 2025*`;

            await this.client.sendMessage(groupId, {
                text: welcomeMessage
            });
            
        } catch (error) {
            this.logger.error('Group welcome error:', error);
        }
    }

    async getGroupInfo(groupId) {
        try {
            // Check cache first
            let groupInfo = this.groupCache.get(groupId);
            
            if (!groupInfo || Date.now() - groupInfo.cached > 300000) { // 5 minutes cache
                // Fetch fresh group metadata
                const metadata = await this.client.socket.groupMetadata(groupId);
                
                groupInfo = {
                    subject: metadata.subject,
                    owner: metadata.owner,
                    creation: metadata.creation,
                    participants: metadata.participants?.length || 0,
                    description: metadata.desc,
                    cached: Date.now()
                };
                
                this.groupCache.set(groupId, groupInfo);
            }
            
            return groupInfo;
        } catch (error) {
            this.logger.error('Failed to get group info:', error);
            return null;
        }
    }

    isBotAdmin(group) {
        if (!group.participants) return false;
        
        const botJid = this.client.socket.user?.id;
        if (!botJid) return false;
        
        const botParticipant = group.participants.find(p => p.id === botJid);
        return botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
    }

    cleanPresenceCache() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        for (const [participant, data] of this.presenceCache.entries()) {
            if (data.timestamp < oneHourAgo) {
                this.presenceCache.delete(participant);
            }
        }
    }

    getPresenceStats() {
        const stats = {
            totalTracked: this.presenceCache.size,
            recentlyActive: 0,
            online: 0,
            offline: 0
        };

        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

        for (const [participant, data] of this.presenceCache.entries()) {
            if (data.timestamp > fiveMinutesAgo) {
                stats.recentlyActive++;
            }

            if (data.lastKnownPresence === 'available') {
                stats.online++;
            } else {
                stats.offline++;
            }
        }

        return stats;
    }

    getGroupStats() {
        return {
            totalGroups: this.groupCache.size,
            groupList: Array.from(this.groupCache.values()).map(group => ({
                subject: group.subject,
                participants: group.participants,
                lastUpdate: group.lastUpdate || group.cached
            }))
        };
    }

    clearCache() {
        this.presenceCache.clear();
        this.groupCache.clear();
        this.logger.info('🧹 Event handler cache cleared');
    }
}

module.exports = { EventHandler };
