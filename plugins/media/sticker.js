/**
 * MATDEV Sticker Plugin
 * Convert images/videos to WhatsApp stickers
 */

const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { Utils } = require('../../lib/utils');

module.exports = {
    name: 'sticker',
    version: '1.0.0',
    description: 'MATDEV Sticker Creator - Convert media to stickers',
    commands: [{
        name: 'sticker',
        aliases: ['s', 'stiker'],
        category: 'media',
        description: 'Convert image or video to sticker',
        usage: '.sticker [reply to image/video]',
        examples: ['.sticker'],
        
        async handler(context) {
            const { message, reply, client } = context;
            
            let mediaMessage = message;
            
            // Check if replying to a message
            if (message.quotedMessage) {
                mediaMessage = message.quotedMessage;
            }
            
            // Check if message has media
            const imageMessage = mediaMessage.imageMessage;
            const videoMessage = mediaMessage.videoMessage;
            
            if (!imageMessage && !videoMessage) {
                return await reply('❌ Please reply to an image or video to convert to sticker!');
            }
            
            try {
                await reply('🔄 Creating sticker...');
                
                let stickerBuffer;
                
                if (imageMessage) {
                    stickerBuffer = await this.createImageSticker(client, mediaMessage);
                } else if (videoMessage) {
                    stickerBuffer = await this.createVideoSticker(client, mediaMessage);
                }
                
                if (!stickerBuffer) {
                    return await reply('❌ Failed to create sticker!');
                }
                
                // Send sticker
                await client.sendMessage(message.key.remoteJid, {
                    sticker: stickerBuffer
                });
                
            } catch (error) {
                console.error('Sticker creation error:', error);
                await reply('❌ Failed to create sticker. Please try again.');
            }
        },
        
        async createImageSticker(client, message) {
            try {
                // Download image
                const buffer = await client.downloadMedia(message.imageMessage);
                
                // Convert to WebP format with sticker specifications
                const stickerBuffer = await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp({
                        quality: 80,
                        effort: 6
                    })
                    .toBuffer();
                
                return stickerBuffer;
                
            } catch (error) {
                console.error('Image sticker creation error:', error);
                return null;
            }
        },
        
        async createVideoSticker(client, message) {
            try {
                // Download video
                const buffer = await client.downloadMedia(message.videoMessage);
                const tempVideoPath = await Utils.createTempFile(buffer, 'mp4');
                const tempStickerPath = path.join('./temp', `${Utils.randomString(10)}.webp`);
                
                return new Promise((resolve, reject) => {
                    ffmpeg(tempVideoPath)
                        .outputOptions([
                            '-vcodec', 'libwebp',
                            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0',
                            '-loop', '0',
                            '-ss', '00:00:00',
                            '-t', '00:00:06',
                            '-preset', 'default',
                            '-an',
                            '-vsync', '0'
                        ])
                        .toFormat('webp')
                        .save(tempStickerPath)
                        .on('end', async () => {
                            try {
                                const stickerBuffer = await fs.readFile(tempStickerPath);
                                
                                // Cleanup temp files
                                await fs.remove(tempVideoPath);
                                await fs.remove(tempStickerPath);
                                
                                resolve(stickerBuffer);
                            } catch (error) {
                                reject(error);
                            }
                        })
                        .on('error', reject);
                });
                
            } catch (error) {
                console.error('Video sticker creation error:', error);
                return null;
            }
        }
    }]
};
