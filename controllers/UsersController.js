import { error } from 'console';
import crypto from 'crypto';
import { MongoClient, ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import { emailQueue } from '../worker';

const url = 'mongodb://localhost:27017';
const dbName = 'files_manager';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    const client = new MongoClient(url);

    try {
      const usersCollection = dbClient.db.collection('users');

      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Already exist' });
      }
      const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

      const result = await usersCollection.insertOne({
        email,
        password: hashedPassword,
      });
      try {
      await emailQueue.add({
        userId: result.insertedId,
        email: email
      })
    } catch(err) {
      console.error('Failed to add job to email queue:', emailError);
    }
      return res.status(201).json({
        id: result.insertedId,
        email,
      });
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      await client.close();
    }
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    try {
      const userId = await redisClient.get(key);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const db = dbClient.client.db(dbName);

      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.status(200).json({
        id: user._id,
        email: user.email,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server Error' });
    }
  }
}

export default UsersController;
