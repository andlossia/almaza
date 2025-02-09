const { Readable, pipeline } = require('stream');
const { cloudBucket } = require('../utils/googleCloudStorage');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;  // Promises version of fs
const dotenv = require('dotenv');
const multer = require('multer');
const Media = require('../models/mediaModel');
const { getBucket } = require('../database');
const { console } = require('inspector');

dotenv.config();



const mediaExtensions = {
  image: ['.png', '.jpg', '.gif', '.jpeg', '.bmp', '.svg', '.webp'],
  video: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'],
  audio: ['.mp3', '.wav', '.ogg', '.wma', '.aac', '.flac', '.alac'],
  file: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv'],
};

// Define MIME types for media types
const mimeTypes = {
  image: 'image/jpeg',
  video: 'video/mp4',
  audio: 'audio/mpeg',
  file: 'application/octet-stream',
};

// Map extensions to their respective media types
const mediaTypeMap = Object.entries(mediaExtensions).reduce((acc, [type, exts]) => {
  exts.forEach(ext => acc[ext] = type);
  return acc;
}, {});

const getMediaType = (ext) => mediaTypeMap[ext] || 'unknown';
const getMimeType = (mediaType) => mimeTypes[mediaType] || 'application/octet-stream';

// Define file size limits per media type
const fileSizeLimits = {
  image: 50 * 1024 * 1024, // 50MB
  video: 2 * 1024 * 1024 * 1024, // 2GB
};

// Multer file filter to validate file type and size
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mediaType = getMediaType(ext);

  if (!Object.values(mediaExtensions).flat().includes(ext)) {
    return cb(new Error('Invalid file type.'));
  }

  const sizeLimit = fileSizeLimits[mediaType];
  if (file.size > sizeLimit) {  
    return cb(new Error(`File size exceeds the limit for ${mediaType}.`));
  }

  cb(null, true);
};

// Configure Multer storage to save files temporarily on disk
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join('uploads', req.user.id || 'default');
    try {
      await fsPromises.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (err) {
      cb(err);  // Pass any error to the callback
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`);
  },
});

// Initialize Multer with storage and file filter
const upload = multer({
  storage,
  limits: { fileSize: Math.max(...Object.values(fileSizeLimits)) },
  fileFilter,
});

// Sanitize filenames by removing unsafe characters
const sanitizeFilename = (name) => name.replace(/[^a-zA-Z0-9.-_]/g, '_');

// Delete temporary files after processing
const cleanupFile = async (filePath) => {
  try {
    await fsPromises.unlink(filePath);
    console.log(`Temporary file ${filePath} deleted.`);
  } catch (err) {
    console.error(`Failed to delete file ${filePath}:`, err.message);
  }
};

// Create or update media metadata in MongoDB
const createOrUpdateMedia = async (mediaData) => {
  const existingMedia = await Media.findOne({ url: mediaData.url });

  if (existingMedia) {
    await Media.updateOne({ _id: existingMedia._id }, mediaData);
    return existingMedia._id;
  } else {
    const newMedia = new Media(mediaData);
    await newMedia.save();
    return newMedia._id;
  }
};

// Upload file to Google Cloud Storage
const uploadToGoogleCloud = async (fileStream, originalname, mimetype) => {
  const gcsFileName = `media/${Date.now()}-${encodeURIComponent(originalname)}`;
  const mediaBlob = cloudBucket.file(gcsFileName);

  return new Promise((resolve, reject) => {
    const mediaStreamUpload = mediaBlob.createWriteStream({
      metadata: { contentType: mimetype },
      resumable: true,
    });

    fileStream
      .pipe(mediaStreamUpload)
      .on('error', (err) => reject(new Error('Failed to upload to GCS: ' + err.message)))
      .on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${cloudBucket.name}/${gcsFileName}`;
        resolve(publicUrl);
      });
  });
};

// Process file upload (supports videos and other media types)
const processFileUpload = async (file, body, user) => {
  const { mimetype, buffer, originalname } = file;
  const ext = path.extname(originalname).toLowerCase();
  const mediaType = getMediaType(ext);
  const owner = user ? user.id : null;

  try {
    if (mediaType === 'video') {
      // Handle video upload
      if (!buffer) {
        console.log('No buffer available for video upload.');
      }

      const fileStream = Readable.from(buffer);
      const googleCloudUrl = await uploadToGoogleCloud(fileStream, originalname, mimetype);

      const videoData = {
        fileName: body.fileName || originalname,
        altText: body.altText || '',
        slug: `video-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        url: googleCloudUrl,
        owner,
        mediaType,
      };

      const mediaId = await createOrUpdateMedia(videoData);
      await cleanupFile(file.path); // Cleanup temp file if needed
      return mediaId;
    } else {
      // Handle non-video media types (e.g., image, document, etc.)
      if (!buffer && !file.path) {
        throw new Error('No buffer or path available for file upload.');
      }

      const uploadStream = getBucket().openUploadStream(originalname, {
        contentType: mimetype,
        metadata: { mediaType },
      });

      await new Promise((resolve, reject) => {
        pipeline(
          buffer ? Readable.from(buffer) : fs.createReadStream(file.path), 
          uploadStream,
          (err) => {
            if (err) {
              reject(new Error('Error uploading file to MongoDB.'));
            } else {
              resolve();
            }
          }
        );
      });

      const mediaData = {
        fileName: body.fileName || originalname,
        altText: body.altText || '',
        slug: `${mediaType}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        url: `/uploads/${mediaType}/${originalname}`,
        owner,
        mediaType,
      };

      const mediaId = await createOrUpdateMedia(mediaData);
      await cleanupFile(file.path); // Cleanup temp file if needed
      return mediaId;
    }
  } catch (error) {
    console.error('Error in file upload process:', error);

    // Attempt fallback upload if primary upload fails
    try {
      if (!buffer && !file.path) {
        throw new Error('No file data available for fallback upload.');
      }

      const fileStream = buffer ? Readable.from(buffer) : fs.createReadStream(file.path);
      const googleCloudUrl = await uploadToGoogleCloud(fileStream, originalname, mimetype);

      const fallbackMediaData = {
        fileName: body.fileName || originalname,
        altText: body.altText || '',
        slug: `${mediaType}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        url: googleCloudUrl,
        owner,
        mediaType,
      };

      const mediaId = await createOrUpdateMedia(fallbackMediaData);
      await cleanupFile(file.path); // Cleanup temp file if needed
      return mediaId;
    } catch (fallbackError) {
      console.error('Fallback upload failed:', fallbackError);
      throw new Error('Failed to upload media to both MongoDB and Google Cloud Storage.');
    }
  }
};

// Middleware for handling file uploads dynamically
const dynamicUpload = (req, res, next) => {
  const fieldName = req.body.fieldName || 'file';
  const multerUpload = upload.single(fieldName);

  multerUpload(req, res, async (err) => {
    if (err) {
      console.error('Error in dynamicUpload middleware:', err);
      res.status(500).json({ message: 'Internal server error', error: err.message });
      return;
    }

    try {
      if (req.file) {
        const mediaId = await processFileUpload(req.file, req.body, req.user);
        req.media = await Media.findById(mediaId);
        res.status(201).json({ message: 'File uploaded successfully', media: req.media });
      } else if (req.body.url) {
        const mediaId = await createOrUpdateMedia(req.body);
        req.media = await Media.findById(mediaId);
        res.status(201).json({ message: 'File data updated successfully', media: req.media });
      } else {
        next();
      }
    } catch (error) {
      console.error('Error in dynamicUpload middleware:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });
};

module.exports = { upload, mediaExtensions, dynamicUpload, getMediaType, getMimeType };
