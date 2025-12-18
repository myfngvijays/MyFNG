export type OptimizedUpload = {
  file: File;
  note?: string;
};

function isImage(file: File) {
  return file.type.startsWith('image/');
}

function isVideo(file: File) {
  return file.type.startsWith('video/');
}

function withNewName(originalName: string, ext: string) {
  const base = originalName.replace(/\.[^/.]+$/, '');
  return `${base}.${ext}`;
}

/**
 * High-quality image optimization:
 * - keeps aspect ratio
 * - downscales very large images (max 1920px)
 * - converts to JPEG at high quality
 *
 * This typically reduces upload size without visible quality loss for workshop photos.
 */
export async function optimizeUploadFile(file: File): Promise<OptimizedUpload> {
  if (!isImage(file) && !isVideo(file)) return { file };

  // Videos: keep as-is for now (no safe built-in compression without heavy encoder).
  // We still return the original file; server can accept up to 100MB.
  if (isVideo(file)) {
    return { file };
  }

  // Images: best-effort compress only if large-ish
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB < 1.2) return { file };

  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1920;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file };
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    );
    if (!blob) return { file };

    // If optimization made it bigger, keep original
    if (blob.size >= file.size) return { file };

    const optimized = new File([blob], withNewName(file.name, 'jpg'), { type: 'image/jpeg' });
    return { file: optimized, note: 'optimized' };
  } catch {
    return { file };
  }
}

