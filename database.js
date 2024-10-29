const mongoose = require('mongoose');
const { MongoClient, GridFSBucket } = require('mongodb');
const startCronJobs = require('./cron'); 
const dotenv = require('dotenv');
dotenv.config();

let bucket;
let mongoClient;

const connectToDatabase = async () => {
  try {
    // Connect using Mongoose
    await mongoose.connect(process.env.DB_URI, { });
    console.log('MongoDB connected successfully');
    
    // Connect using MongoClient for GridFS
    mongoClient = new MongoClient(process.env.DB_URI, { });
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
