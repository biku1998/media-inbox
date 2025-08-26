#!/usr/bin/env ts-node

/**
 * Thumbnail Generation Demo
 *
 * This script demonstrates the thumbnail generation capabilities
 * of the Media Inbox system using the Sharp library.
 */

import { ThumbnailService } from '../uploads/thumbnail.service';
import { ConfigService } from '@nestjs/config';

// Mock config service for demo
const mockConfigService = {
  get: <T>(key: string, defaultValue?: T): T => {
    const config: Record<string, T> = {
      THUMBNAIL_WIDTH: 300 as T,
      THUMBNAIL_HEIGHT: 300 as T,
      THUMBNAIL_QUALITY: 80 as T,
      THUMBNAIL_FORMAT: 'jpeg' as T,
      THUMBNAIL_FIT: 'cover' as T,
      THUMBNAIL_BACKGROUND: '#FFFFFF' as T,
    };
    return (config[key] ?? defaultValue) as T;
  },
} as ConfigService;

async function runThumbnailDemo() {
  console.log('🎨 Thumbnail Generation Demo\n');

  // Create thumbnail service
  const thumbnailService = new ThumbnailService(mockConfigService);

  try {
    // Create a simple test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );

    console.log('📸 Original Image:');
    console.log(`   Size: ${testImageBuffer.length} bytes`);
    console.log(`   Format: PNG (1x1 pixel)`);

    // Generate thumbnail with default options
    console.log('\n🔄 Generating thumbnail with default options...');
    const result = await thumbnailService.generateThumbnail(testImageBuffer);

    console.log('\n✅ Thumbnail Generated Successfully:');
    console.log(`   Output Format: ${result.format.toUpperCase()}`);
    console.log(`   Dimensions: ${result.width}x${result.height} pixels`);
    console.log(`   File Size: ${result.size} bytes`);
    console.log(
      `   Compression: ${(((testImageBuffer.length - result.size) / testImageBuffer.length) * 100).toFixed(1)}%`,
    );

    // Test different options
    console.log('\n🔄 Testing custom options...');
    const customResult = await thumbnailService.generateThumbnail(
      testImageBuffer,
      {
        width: 150,
        height: 150,
        quality: 90,
        format: 'webp',
      },
    );

    console.log('\n✅ Custom Thumbnail Generated:');
    console.log(`   Output Format: ${customResult.format.toUpperCase()}`);
    console.log(
      `   Dimensions: ${customResult.width}x${customResult.height} pixels`,
    );
    console.log(`   File Size: ${customResult.size} bytes`);

    // Test format processing
    console.log('\n🔄 Testing format processing...');
    const formatResult = await thumbnailService.processImageFormat(
      testImageBuffer,
      'png',
      { maxWidth: 200, maxHeight: 200, quality: 85 },
    );

    console.log('\n✅ Format Processing Result:');
    console.log(`   Output Format: ${formatResult.format.toUpperCase()}`);
    console.log(
      `   Dimensions: ${formatResult.width}x${formatResult.height} pixels`,
    );
    console.log(`   File Size: ${formatResult.size} bytes`);

    // Show supported formats
    console.log('\n📋 Supported Output Formats:');
    const supportedFormats = thumbnailService.getSupportedFormats();
    supportedFormats.forEach((format) =>
      console.log(`   - ${format.toUpperCase()}`),
    );

    // Show default options
    console.log('\n⚙️  Default Configuration:');
    const defaultOptions = thumbnailService.getDefaultOptions();
    Object.entries(defaultOptions).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });

    console.log('\n🎉 Demo completed successfully!');
    console.log('\n💡 Key Features Demonstrated:');
    console.log('   ✅ Sharp library integration');
    console.log('   ✅ Multiple output formats (JPEG, PNG, WebP)');
    console.log('   ✅ Configurable dimensions and quality');
    console.log('   ✅ Automatic aspect ratio preservation');
    console.log('   ✅ Compression optimization');
    console.log('   ✅ Error handling and validation');
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  runThumbnailDemo().catch(console.error);
}
