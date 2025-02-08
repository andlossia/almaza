const express = require('express');
const router = express.Router();
const MediaModel = require('../models/mediaModel');
const { getMimeTypes } = require('../middlewares/uploadFilesMiddleware');
const { generateSignedUrl } = require('../utils/googleCloudStorage');
const { getBucket } = require('../database');
const path = require('path');

// Helper function to get the first MIME type or a default fallback
const getMimeType = (mediaType) => {
  const mimeTypes = getMimeTypes(mediaType);
  return mimeTypes.length > 0 ? mimeTypes[0] : 'application/octet-stream';
};

// Route to serve files
router.get('/:mediaType/:filename', async (req, res) => {
  try {
    const { mediaType, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);

    const bucket = getBucket();
    const downloadStream = bucket.openDownloadStreamByName(decodedFilename);

    res.setHeader('Content-Type', getMimeType(mediaType));

    downloadStream.on('data', (chunk) => {
      res.write(chunk);
    });

    downloadStream.on('end', () => {
      res.end();
    });

    downloadStream.on('error', (err) => {
      console.error(`Error fetching file ${filename}:`, err);
      res.status(404).send('File not found');
    });
  } catch (err) {
    console.error('Error processing file request:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Route to serve uploaded files
router.get('/uploads/:mediaType/:filename', async (req, res) => {
  try {
    const { mediaType, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const bucket = getBucket();
    const downloadStream = bucket.openDownloadStreamByName(decodedFilename);

    res.setHeader('Content-Type', getMimeType(mediaType));

    downloadStream.on('data', (chunk) => {
      res.write(chunk);
    });

    downloadStream.on('end', () => {
      res.end();
    });

    downloadStream.on('error', (err) => {
      console.error('Error fetching file:', err);
      res.status(404).send('File not found');
    });
  } catch (err) {
    console.error('Error fetching file:', err);
    res.status(500).send('Error fetching file: ' + err.message);
  }
});

// Route to download files
router.get('/download/:mediaType/:filename', async (req, res) => {
  try {
    const { mediaType, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const bucket = getBucket();
    const downloadStream = bucket.openDownloadStreamByName(decodedFilename);
    const safeFilename = encodeURI(path.basename(decodedFilename));

    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', getMimeType(mediaType));

    downloadStream.on('data', (chunk) => {
      res.write(chunk);
    });

    downloadStream.on('end', () => {
      res.end();
    });

    downloadStream.on('error', (err) => {
      console.error('Error fetching file:', err);
      res.status(404).send('File not found');
    });
  } catch (err) {
    console.error('Error fetching file:', err);
    res.status(500).send('Error fetching file: ' + err.message);
  }
});

// Route to fetch a specific media item by ID
router.get('/api/v1/media/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const media = await MediaModel.findById(id);
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    let signedUrl = media.url;
    if (media.mediaType === 'video') {
      signedUrl = await generateSignedUrl(media.fileName);
    }

    res.json({
      ...media.toObject(),
      signedUrl,
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to list media items with filtering and pagination
router.get('/api/v1/media', async (req, res) => {
  const { mediaType, searchQuery, page = 1, limit = 10 } = req.query;

  try {
    const query = {};

    if (mediaType) {
      query.mediaType = mediaType;
    }
    if (searchQuery) {
      query.$or = [
        { fileName: { $regex: searchQuery, $options: 'i' } },
        { altText: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const mediaItems = await MediaModel.find(query)
      .skip(skip)
      .limit(Number(limit))
      .sort({ fileName: 1 });

    const itemsWithSignedUrls = await Promise.all(
      mediaItems.map(async (media) => {
        let signedUrl = media.url;
        if (media.mediaType === 'video') {
          signedUrl = await generateSignedUrl(media.fileName);
        }
        return { ...media.toObject(), signedUrl };
      })
    );

    const totalMedia = await MediaModel.countDocuments(query);

    res.json({
      items: itemsWithSignedUrls,
      total: totalMedia,
      page: Number(page),
      pages: Math.ceil(totalMedia / limit),
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
