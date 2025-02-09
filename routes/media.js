const express = require('express');
const router = express.Router();
const MediaModel = require('../models/mediaModel');
const { mediaExtensions, getMediaType, getMimeType } = require('../middlewares/uploadFilesMiddleware');
const { generateSignedUrl } = require('../utils/googleCloudStorage');
const { getBucket } = require('../database');
const path = require('path');



router.get('/:mediatype/:ext', (req, res) => {
    const ext = `.${req.params.ext.toLowerCase()}`;
    if (Object.values(mediaExtensions).flat().includes(ext)) {
      return res.status(200).json({ mediaType: getMediaType(ext) });
    }
    res.status(400).json({ error: 'Unsupported file type' });
  });
  
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

  router.get('/api/v1/media/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch the media info from your database
        const media = await MediaModel.findById(id); // Ensure this is defined
        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }

        // Generate a signed URL if it's a video
        let signedUrl = media.url; // Default to the stored URL
        if (media.mediaType === 'video') {
            signedUrl = await generateSignedUrl(media.fileName);
        }

        // Respond with media details
        res.json({
            ...media.toObject(),
            signedUrl, // Add the signed URL
        });
    } catch (error) {
        console.error('Error fetching media:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/api/v1/media', async (req, res) => {
  const { mediaType, searchQuery, page = 1, limit = 10 } = req.query; // Query parameters for filtering and pagination

  try {
      // Base query for fetching media
      const query = {};

      // Add filters if specified
      if (mediaType) {
          query.mediaType = mediaType;
      }
      if (searchQuery) {
          query.$or = [
              { fileName: { $regex: searchQuery, $options: 'i' } }, // Case-insensitive search
              { altText: { $regex: searchQuery, $options: 'i' } }
          ];
      }

      // Pagination options
      const skip = (page - 1) * limit;

      // Fetch media items from the database
      const mediaItems = await MediaModel.find(query)
          .skip(skip)
          .limit(Number(limit))
          .sort({ fileName: 1 });
        

      // Generate signed URLs for videos
      const itemsWithSignedUrls = await Promise.all(
          mediaItems.map(async (media) => {
              let signedUrl = media.url; // Default to stored URL
              if (media.mediaType === 'video') {
                  signedUrl = await generateSignedUrl(media.fileName);
              }
              return { ...media.toObject(), signedUrl };
          })
      );

      // Count total documents for pagination metadata
      const totalMedia = await MediaModel.countDocuments(query);

      // Prepare response with pagination metadata
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
