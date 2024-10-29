const express = require('express');
const router = express.Router();
const { mediaExtensions, getMediaType, getMimeType } = require('../middlewares/uploadFilesMiddleware');
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
  
  
module.exports = router;
