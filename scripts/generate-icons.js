import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

const sizes = [192, 512];

async function generateIcons() {
  const logoPath = join(publicDir, 'logo.png');

  for (const size of sizes) {
    const outputPath = join(publicDir, `icon-${size}.png`);

    await sharp(logoPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 29, g: 111, b: 66, alpha: 1 } // #1D6F42 green background
      })
      .png()
      .toFile(outputPath);

    console.log(`Generated: icon-${size}.png`);
  }

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
