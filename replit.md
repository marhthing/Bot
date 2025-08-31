# MATDEV - WhatsApp Bot

## Overview

MATDEV is a high-performance WhatsApp bot built on the Baileys library with advanced features for message processing, media handling, and plugin management. The bot is designed for scalability with multi-core support, comprehensive performance monitoring, and a modular architecture that supports hot-reloadable plugins. It provides automated session management, backup systems, and extensive administrative controls for WhatsApp automation and interaction.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture
- **Multi-Core Processing**: Uses Node.js cluster module for horizontal scaling across CPU cores
- **Event-Driven Design**: Built on Baileys WebSocket events with custom handlers for messages, groups, and presence updates
- **Modular Plugin System**: Hot-reloadable plugins with command routing and category-based organization
- **Performance Monitoring**: Real-time metrics collection with memory, CPU, and response time tracking

### Message Processing
- **Priority Queue System**: Message processing with configurable concurrency limits and priority-based queuing
- **Rate Limiting**: Per-user rate limiting to prevent spam and abuse
- **Async Processing**: Non-blocking message handling with retry mechanisms and error recovery

### Session Management
- **Auto-Backup**: Scheduled session backups with configurable intervals
- **Session Recovery**: Automatic session restoration on connection failures
- **Multi-File Auth State**: Uses Baileys' multi-file authentication for better session persistence

### Data Storage
- **JSON-Based Storage**: Primary data storage using JSON files with in-memory caching
- **Configurable Database Types**: Support for JSON, MongoDB, and PostgreSQL (via configuration)
- **Backup System**: Automated database backups with compression and retention policies

### Plugin Architecture
- **Hot Reload**: File system watchers for automatic plugin reloading during development
- **Command Registration**: Dynamic command registration with aliases, categories, and permissions
- **Lifecycle Management**: Plugin initialization, error handling, and cleanup routines

### Security & Access Control
- **Owner-Only Commands**: Administrative commands restricted to bot owner
- **User Blocking**: Built-in user blocking and rate limiting systems
- **Permission System**: Role-based command access control

### Media Processing
- **Image/Video Conversion**: Sharp and FFmpeg integration for media manipulation
- **Sticker Creation**: Automatic conversion of images and videos to WhatsApp stickers
- **File Download**: URL-based media downloading with size and type restrictions
- **Temporary File Management**: Automatic cleanup of temporary files and media cache

## External Dependencies

### WhatsApp Integration
- **@whiskeysockets/baileys**: Primary WhatsApp Web API library for WebSocket communication
- **qrcode-terminal**: QR code display for initial authentication

### Media Processing
- **sharp**: High-performance image processing and manipulation
- **fluent-ffmpeg**: Video processing and conversion utilities
- **archiver & extract-zip**: File compression and extraction for backups

### Utilities & Infrastructure
- **winston**: Advanced logging system with file and console outputs
- **node-cron**: Scheduled tasks for backups and maintenance
- **chokidar**: File system watching for hot reload functionality
- **axios**: HTTP client for external API requests and file downloads
- **chalk**: Terminal color formatting for enhanced console output

### Development & Performance
- **fs-extra**: Enhanced file system operations
- **dotenv**: Environment variable management
- **cluster**: Node.js multi-core processing support

### Potential Database Extensions
- The system is designed to support multiple database types through configuration, with potential for PostgreSQL integration via Drizzle ORM or similar solutions.