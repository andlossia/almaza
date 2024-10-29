const functions = require('firebase-functions');
const mongoose = require('mongoose');
const { MongoClient, GridFSBucket } = require('mongodb');
const startCronJobs = require('./cron'); 
const dotenv = require('dotenv');

dotenv.config();

let bucket;
let mongoClient;

const connectToDatabase = async () => {
  try {
    // Use the dbUri from Firebase configuration
    const dbUri = functions.config().mongodb.uri; // Ensure functions is imported
    console.log('Connecting to MongoDB with URI:', dbUri);
    
    // Connect using Mongoose
    await mongoose.connect(dbUri, { });
    console.log('MongoDB connected successfully');
    
    // Connect using MongoClient for GridFS
    mongoClient = new MongoClient(dbUri, { });
    await mongoClient.connect();
    
    const db = mongoClient.db();
    bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    console.log('Storage initialized');
    
    mongoose.set('strictPopulate', false);

    // Start cron jobs after successful database connection
    startCronJobs();

  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

const getBucket = () => {
  if (!bucket) {
    throw new Error('Storage is not initialized');
  }
  return bucket;
};

const closeConnections = async () => {
  if (mongoClient) {
    await mongoClient.close();
    console.log('MongoClient connection closed');
  }
  await mongoose.disconnect();
  console.log('Mongoose connection closed');
};

module.exports = { connectToDatabase, getBucket, closeConnections };
