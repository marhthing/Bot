/**
 * MATDEV Media Download Plugin
 * Download and process media from various sources
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { Utils } = require('../../lib/utils');

module.exports = {
    name: 'download',
    version: '1.0.0',
    description: 'MATDEV Media Downloader - Download media from URLs',
    commands: [
        {
            name: 'download',
            aliases: ['dl', 'get'],
            category: 'media',
            description: 'Download media from URL',
            usage: '.download <url>',
            examples: ['.download https://example.com/image.jpg'],
            
            async handler(context) {
                const { args, reply, client, message } = context;
                
                if (!args[0]) {
                    return await reply('❌ Please provide a URL to download!');
                }
                
                const url = args[0];
                
                if (!Utils.isValidUrl(url)) {
                    return await reply('❌ Please provide a valid URL!');
                }
                
                try {
                    await reply('📥 Downloading media...');
                    
                    const response = await axios.get(url, {
                        responseType: 'arraybuffer',
                        timeout: 30000,
                        maxContentLength: 100 * 1024 * 1024 // 100MB limit
                    });
                    
                    const buffer = Buffer.from(response.data);
                    const contentType = response.headers['content-type'] || '';
                    const fileName = this.getFileName(url, contentType);
                    
                    // Determine message type based on content
                    if (contentType.startsWith('image/')) {
                        await client.sendMessage(message.key.remoteJid, {
                            image: buffer,
                            caption: `📷 Downloaded: ${fileName}`
                        });
                    } else if (contentType.startsWith('video/')) {
                        await client.sendMessage(message.key.remoteJid, {
                            video: buffer,
                            caption: `🎥 Downloaded: ${fileName}`
                        });
                    } else if (contentType.startsWith('audio/')) {
                        await client.sendMessage(message.key.remoteJid, {
                            audio: buffer,
                            mimetype: contentType
                        });
                    } else {
                        await client.sendMessage(message.key.remoteJid, {
                            document: buffer,
                            fileName: fileName,
                            mimetype: contentType || 'application/octet-stream'
                        });
                    }
                    
                } catch (error) {
                    console.error('Download error:', error);
                    
                    if (error.response?.status === 404) {
                        await reply('❌ File not found at the provided URL!');
                    } else if (error.code === 'ENOTFOUND') {
                        await reply('❌ Unable to reach the URL. Please check the link!');
                    } else if (error.code === 'ETIMEDOUT') {
                        await reply('❌ Download timeout. The file might be too large!');
                    } else {
                        await reply('❌ Failed to download the file. Please try again!');
                    }
                }
            },
            
            getFileName(url, contentType) {
                // Try to extract filename from URL
                const urlPath = new URL(url).pathname;
                let fileName = path.basename(urlPath);
                
                // If no filename or extension, generate one based on content type
                if (!fileName || !path.extname(fileName)) {
                    const extension = this.getExtensionFromContentType(contentType);
                    fileName = `download_${Utils.randomString(8)}.${extension}`;
                }
                
                return fileName;
            },
            
            getExtensionFromContentType(contentType) {
                const typeMap = {
                    'image/jpeg': 'jpg',
                    'image/png': 'png',
                    'image/gif': 'gif',
                    'image/webp': 'webp',
                    'video/mp4': 'mp4',
                    'video/webm': 'webm',
                    'video/quicktime': 'mov',
                    'audio/mpeg': 'mp3',
                    'audio/wav': 'wav',
                    'audio/ogg': 'ogg',
                    'application/pdf': 'pdf',
                    'application/zip': 'zip',
                    'text/plain': 'txt'
                };
                
                return typeMap[contentType] || 'bin';
            }
        },
        
        {
            name: 'ytdl',
            aliases: ['youtube', 'yt'],
            category: 'media',
            description: 'Download YouTube videos (placeholder)',
            usage: '.ytdl <youtube_url>',
            examples: ['.ytdl https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
            
            async handler(context) {
                const { reply } = context;
                
                // Placeholder for YouTube download functionality
                // Requires ytdl-core or similar library
                await reply('🚧 YouTube download feature is under development!\n\nThis feature will be available in the next update.');
            }
        }
    ]
};
