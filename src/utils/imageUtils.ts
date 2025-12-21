// Compress and resize images for profile photos
export async function compressImage(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      // For profile pics, crop to square
      const size = Math.min(width, height);
      canvas.width = size;
      canvas.height = size;

      // Calculate crop position (center crop)
      const sourceX = (img.width - img.height) / 2;
      const sourceY = (img.height - img.width) / 2;
      const sourceSize = Math.min(img.width, img.height);

      if (ctx) {
        // Draw cropped and resized image
        ctx.drawImage(
          img,
          Math.max(0, sourceX),
          Math.max(0, sourceY),
          sourceSize,
          sourceSize,
          0,
          0,
          size,
          size
        );

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// Validate image file
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const maxSize = 20 * 1024 * 1024; // 20MB max input (will be compressed)

  if (!validTypes.includes(file.type.toLowerCase()) && !file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|heic|heif)$/)) {
    return { valid: false, error: 'Please upload a JPG, PNG, or WebP image' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'Image must be under 20MB' };
  }

  return { valid: true };
}
