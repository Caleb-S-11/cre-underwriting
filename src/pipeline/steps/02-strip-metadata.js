import sharp from 'sharp';

export async function stripImageMetadata(classified) {
  const { images, pdfs } = classified;

  const cleanedImages = await Promise.all(
    images.map(async (img) => {
      try {
        // Convert to RGB (drops alpha), remove metadata, re-encode as PNG
        const cleaned = await sharp(img.buffer)
          .removeAlpha()
          .png()
          .toBuffer();

        return {
          buffer: cleaned,
          originalname: img.originalname,
          mimetype: 'image/png' // Re-encoded to PNG for consistency
        };
      } catch (error) {
        console.error(`Failed to clean image ${img.originalname}:`, error);
        throw new Error(`Image metadata stripping failed for ${img.originalname}: ${error.message}`);
      }
    })
  );

  return {
    images: cleanedImages,
    pdfs
  };
}
