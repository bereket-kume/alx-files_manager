import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

export const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');


fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;
  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }
  const file = await dbClient.client.db().collection('files').findOne({
    _id: new ObjectId(fileId),
    userId: new ObjectId(userId),
  });
  if (!file) {
    throw new Error('file not found');
  }
  const { filePath } = file;
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found on disk');
  }
  const sizes = [500, 250, 100];
  for (const size of sizes) {
    try {
      const thumbnail = await imageThumbnail(filePath, { width: size });
      const thumbnailPath = filePath.replace(/(\.[\w\d_-]+)$/i, `_${size}$1`);
      fs.writeFileSync(thumbnailPath, thumbnail);
      console.log(`Thumbnail of size ${size} generated for fileId: ${fileId}`);
    } catch (err) {
      console.error(`Error generating thumbnail for size ${size}:`, err);
    }
  }
});

export const emailQueue = new Queue('emailQueue', 'redis://127.0.0.1:6379');

emailQueue.process(async (job) => {
    const { email, userId } = job.data;

    if (!userId) {
        throw new Error('Missing userId');
    }
    const user = dbClient.client.db().collection('files').findOne({
        userId: new ObjectId(userId),
    });
    if (!user) {
        throw new Error("User not found");
    }
    console.log(`Welcome ${email}`);
});