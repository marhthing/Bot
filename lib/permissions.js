/**
 * MATDEV Permission System
 * Manages user permissions for commands
 */

const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('./logger');
const config = require('../config');

class PermissionManager {
    constructor() {
        this.logger = new Logger('MATDEV-PERMS');
        this.permissionsFile = path.join(config.DIRS.DATABASE, 'permissions.json');
        this.permissions = new Map();
        this.loadPermissions();
    }

    async loadPermissions() {
        try {
            if (await fs.pathExists(this.permissionsFile)) {
                const data = await fs.readJson(this.permissionsFile);
                this.permissions = new Map(Object.entries(data));
                this.logger.info(`📋 Loaded permissions for ${this.permissions.size} users`);
            } else {
                this.permissions = new Map();
                await this.savePermissions();
            }
        } catch (error) {
            this.logger.error('Failed to load permissions:', error);
            this.permissions = new Map();
        }
    }

    async savePermissions() {
        try {
            const data = Object.fromEntries(this.permissions);
            await fs.writeJson(this.permissionsFile, data, { spaces: 2 });
        } catch (error) {
            this.logger.error('Failed to save permissions:', error);
        }
    }

    // Allow a command for a specific user
    async allowCommand(jid, command) {
        const userPermissions = this.permissions.get(jid) || [];
        if (!userPermissions.includes(command)) {
            userPermissions.push(command);
            this.permissions.set(jid, userPermissions);
            await this.savePermissions();
            this.logger.info(`✅ Allowed command '${command}' for ${jid}`);
            return true;
        }
        return false; // Already allowed
    }

    // Remove a command permission for a specific user
    async removeCommand(jid, command) {
        const userPermissions = this.permissions.get(jid) || [];
        const index = userPermissions.indexOf(command);
        if (index > -1) {
            userPermissions.splice(index, 1);
            if (userPermissions.length === 0) {
                this.permissions.delete(jid);
            } else {
                this.permissions.set(jid, userPermissions);
            }
            await this.savePermissions();
            this.logger.info(`❌ Removed command '${command}' for ${jid}`);
            return true;
        }
        return false; // Not found
    }

    // Check if a user has permission for a command
    hasPermission(jid, command) {
        // First try exact match
        let userPermissions = this.permissions.get(jid) || [];
        if (userPermissions.includes(command) || userPermissions.includes('*')) {
            return true;
        }
        
        // Try alternate JID formats for the same user
        const phoneNumber = jid.split('@')[0].split(':')[0];
        
        // Check all possible formats for this phone number
        const possibleJids = [
            `${phoneNumber}@s.whatsapp.net`,
            `${phoneNumber}@lid`,
            `${phoneNumber}:1@s.whatsapp.net`,
            `${phoneNumber}:0@s.whatsapp.net`
        ];
        
        for (const altJid of possibleJids) {
            userPermissions = this.permissions.get(altJid) || [];
            if (userPermissions.includes(command) || userPermissions.includes('*')) {
                this.logger.debug(`✅ Permission found using alternate JID format: ${altJid}`);
                return true;
            }
        }
        
        return false;
    }

    // Get all permissions for a user
    getUserPermissions(jid) {
        return this.permissions.get(jid) || [];
    }

    // Get all users with permissions
    getAllPermissions() {
        return Object.fromEntries(this.permissions);
    }

    // Clear all permissions for a user
    async clearUserPermissions(jid) {
        if (this.permissions.has(jid)) {
            this.permissions.delete(jid);
            await this.savePermissions();
            this.logger.info(`🗑️ Cleared all permissions for ${jid}`);
            return true;
        }
        return false;
    }
}

module.exports = { PermissionManager };