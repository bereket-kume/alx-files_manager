import { MongoClient } from 'mongodb';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';

const url = 'mongodb://localhost:27017';
const dbName = 'files_manager';

class AuthController {
  static async getConnect(req, res) {
    const authheader = req.headers.authorization;
    if (!authheader || !authheader.startsWith('Basic')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authheader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');

    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const client = new MongoClient(url);
    try {
      await client.connect();
      const db = client.db(dbName);
      const usersCollection = db.collection('users');

      const user = await usersCollection.findOne({ email });
      if (!user || user.password !== crypto.createHash('sha1').update(password).digest('hex')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const token = uuidv4();
      const key = `auth_${token}`;
      try {
        await redisClient.set(key, user._id.toString(), 86400);
      } catch (err) {
        console.error('Error setting key in redis', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      return res.status(200).json({ token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      await client.close();
    }
  }

  static async getDisconnect(req, res) {
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
      await redisClient.del(key);
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default AuthController;
