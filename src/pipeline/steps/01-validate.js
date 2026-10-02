const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_PDF_TYPE = 'application/pdf';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

export function validateAndClassifyUploads(files) {
  const images = [];
  const pdfs = [];
  const rejected = [];

  for (const file of files) {
    const { mimetype, size, buffer, originalname } = file;

    if (ALLOWED_IMAGE_TYPES.includes(mimetype)) {
      if (size > MAX_IMAGE_SIZE) {
        rejected.push(`${originalname}: exceeds 5MB`);
      } else {
        images.push({ buffer, originalname, mimetype });
      }
    } else if (mimetype === ALLOWED_PDF_TYPE) {
      if (size > MAX_PDF_SIZE) {
        rejected.push(`${originalname}: exceeds 20MB`);
      } else {
        pdfs.push({ buffer, originalname, mimetype });
      }
    } else {
      rejected.push(`${originalname}: unsupported type ${mimetype}`);
    }
  }

  if (rejected.length > 0) {
    console.warn('Rejected files:', rejected);
  }

  return { images, pdfs, rejected };
}
