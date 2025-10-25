import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';

type ResourceType = 'image' | 'video' | 'raw' | 'auto';

export const configureCloudinaryFromEnv = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Missing Cloudinary configuration. Ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET are set.'
    );
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
};

const guessResourceType = (
  mimeOrFilename?: string,
  fallback: ResourceType = 'auto'
): ResourceType => {
  if (!mimeOrFilename) return fallback;
  const s = mimeOrFilename.toLowerCase();

  // Handle data URIs, e.g. data:image/png;base64,....
  if (s.startsWith('data:')) {
    const mime = s.substring(5).split(';', 1)[0]; // between 'data:' and first ';'
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    return fallback;
  }

  // Handle explicit mime types
  if (s.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|tiff|heic|heif)(\?|#|$)/i.test(s))
    return 'image';
  if (s.startsWith('video/') || /\.(mp4|mov|avi|mkv|3gp|webm)(\?|#|$)/i.test(s)) return 'video';

  // For unknown or extension-less URLs (e.g., Google Drive), let Cloudinary auto-detect
  return fallback;
};

export interface UploadInput {
  buffer?: Buffer;
  path?: string; // local file path
  url?: string; // remote URL
  filename?: string;
  mimetype?: string;
  resourceTypeHint?: ResourceType;
  folder?: string;
}

export const uploadToCloudinary = async (input: UploadInput): Promise<UploadApiResponse> => {
  configureCloudinaryFromEnv();

  const folder = input.folder ?? 'whatsapp';
  const resourceType: ResourceType =
    input.resourceTypeHint ??
    guessResourceType(input.mimetype || input.filename || input.path || input.url, 'auto');

  const options: UploadApiOptions = { folder, resource_type: resourceType } as UploadApiOptions;
  if (input.filename) {
    // strip extension for public_id
    const base = input.filename.replace(/\.[^.]+$/, '');
    options.public_id = base;
    options.unique_filename = true;
    options.use_filename = true;
  }

  if (input.url) {
    // Check if it's a data URL and convert to buffer
    if (/^data:/i.test(input.url)) {
      const matches = input.url.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URL format. Expected data:[mimetype];base64,[data]');
      }
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      // Use buffer upload path for data URLs
      return await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
          if (err) return reject(err);
          if (!result) return reject(new Error('Cloudinary upload_stream returned no result'));
          resolve(result);
        });
        stream.end(buffer);
      });
    }
    // Direct URL upload for HTTP(S) URLs
    return await cloudinary.uploader.upload(input.url, options);
  }

  if (input.path) {
    // Local file path
    return await cloudinary.uploader.upload(input.path, options);
  }

  if (input.buffer) {
    return await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error('Cloudinary upload_stream returned no result'));
        resolve(result);
      });
      stream.end(input.buffer);
    });
  }

  throw new Error('uploadToCloudinary: No valid input provided (buffer, path, or url required)');
};

// Intentionally minimal: only config and upload utilities are provided in this module.
