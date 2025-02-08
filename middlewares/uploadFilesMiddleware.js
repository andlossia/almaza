const { Readable, pipeline } = require('stream');
const { cloudBucket } = require('../utils/googleCloudStorage');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;  // Promises version of fs
const dotenv = require('dotenv');
const multer = require('multer');
const Media = require('../models/mediaModel');
const { getBucket } = require('../database');

dotenv.config();


if (!process.env.KEYFILENAME || !process.env.BUCKET_NAME) {
  throw new Error('Missing required environment variables: KEYFILENAME or BUCKET_NAME');
}


const mediaTypesSchema = {
  image: {
    mediaExtensions: ['.png', '.jpg', '.gif', '.jpeg', '.bmp', '.svg', '.webp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/bmp'],
    fileSizeLimits: 50 * 1024 * 1024, // 50MB
  },
  video: {
    mediaExtensions: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'],
    mimeTypes: ['video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/x-matroska', 'video/webm'],
    fileSizeLimits: 2 * 1024 * 1024 * 1024, // 2GB
  },
  audio: {
    mediaExtensions: ['.mp3', '.wav', '.ogg', '.wma', '.aac', '.flac', '.alac'],
    mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-ms-wma', 'audio/aac', 'audio/flac', 'audio/alac'],
    fileSizeLimits: 12 * 1024 * 1024, // 12MB
  },
  file: {
    mediaExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.json', '.xml'],
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'text/plain', 'application/json', 'application/xml'],
    fileSizeLimits: 150 * 1024 * 1024, // 150MB
  },
};

// Helper to get media type by extension
const getMediaType = (ext) => {
  const mediaType = Object.keys(mediaTypesSchema).find((type) =>
    mediaTypesSchema[type].mediaExtensions.includes(ext.toLowerCase())
  ) || 'unknown';
  return mediaType;
};

// Helper to get MIME type by media type
const getMimeTypes = (mediaType) => {
  return mediaTypesSchema[mediaType]?.mimeTypes || [];
};

const getFileSizeLimit = (mediaType) => {
  return mediaTypesSchema[mediaType]?.fileSizeLimits || 0;
};

// Multer file filter to validate file type and size
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mediaType = getMediaType(ext);

  if (mediaType === 'unknown') {
    return cb(new Error('Invalid file type.'));
  }

  const sizeLimit = getFileSizeLimit(mediaType);

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
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-_]/g, '_');
    const fileName = `${Date.now()}-${sanitizedFileName}`;
    cb(null, fileName);
    },
});

const upload = multer({
  storage,
  limits: { fileSize: Math.max(...Object.values(mediaTypesSchema).map((type) => type.fileSizeLimits)) },
  fileFilter,
});




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

  const baseurl = `https://storage.googleapis.com`;
  const gcsFileName = `media/${Date.now()}-${encodeURIComponent(originalname)}`;
  const mediaBlob = cloudBucket.file(gcsFileName);

  return new Promise((resolve, reject) => {
    const mediaStreamUpload = mediaBlob.createWriteStream({
      metadata: { contentType: mimetype },
      resumable: true, // Ensures resumable uploads
    });

    let uploadedBytes = 0;

    // Handle stream events
    fileStream
      .on('data', (chunk) => {
        uploadedBytes += chunk.length;
      })
      .pipe(mediaStreamUpload)
      .on('error', (err) => {
        console.error('Failed to upload to GCS:', err.message);
        reject(new Error(`Failed to upload to GCS: ${err.message}`));
      })
      .on('finish', () => {
        const publicUrl = `${baseurl}/${cloudBucket.name}/${gcsFileName}`;
        resolve(publicUrl);
      });
  });
};

// Process file upload (supports videos and other media types)
const processFileUpload = async (file, body, user) => {
  const { mimetype, buffer, originalname } = file;

  const ext = path.extname(originalname).toLowerCase();
  const mediaType = getMediaType(ext);
  const owner = user?.id || null;

  // Validate file data
  if (!buffer && !file.path) {
    throw new Error('No valid file data available for upload.');
  }

  const fileStream = buffer ? Readable.from(buffer) : fs.createReadStream(file.path);

  const generateSlug = (type) => `${type}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const createMediaData = (url) => ({
    fileName: body.fileName || originalname,
    altText: body.altText || '',
    slug: generateSlug(mediaType),
    url,
    owner,
    mediaType,
  });

  try {
    let uploadUrl;

    if (mediaType === 'video') {
      // Handle video uploads to Google Cloud Storage
      uploadUrl = await uploadToGoogleCloud(fileStream, originalname, mimetype);
    } else {
      // Handle non-video uploads to MongoDB GridFS
      const uploadStream = getBucket().openUploadStream(originalname, {
        contentType: mimetype,
        metadata: { mediaType },
      });

      await new Promise((resolve, reject) => {
        pipeline(fileStream, uploadStream, (err) => {
          if (err) reject(new Error('Error uploading file to MongoDB GridFS.'));
          else resolve();
        });
      });

      uploadUrl = `/uploads/${mediaType}/${originalname}`;
    }

    const mediaData = createMediaData(uploadUrl);
    const mediaId = await createOrUpdateMedia(mediaData);

   

  } catch (primaryError) {
    console.error('Primary upload failed:', primaryError);

    // Fallback to Google Cloud Storage for all media types
    try {
      const fallbackStream = buffer ? Readable.from(buffer) : fs.createReadStream(file.path);
      const fallbackUrl = await uploadToGoogleCloud(fallbackStream, originalname, mimetype);

      const fallbackMediaData = createMediaData(fallbackUrl);
      const mediaId = await createOrUpdateMedia(fallbackMediaData);

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

module.exports = { upload, dynamicUpload, getMediaType, getMimeTypes };
