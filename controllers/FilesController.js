import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import mime from 'mime-types';


const FOLDER_PATH = process.FOLDER_PATH || 'tmp/files_manager';

class FilesController {
    static async postUpload(req, res) {
        const token = req.headers['x-token'];

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized'});
        }
        const key = `auth_${token}`;
        const userId = await redisClient.get(key);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized'});
        }

        const { name, type, parentId = '0', isPublic = false, data } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Missing name" });
        }
        const validTypes = ['folder', 'file', 'image'];
        if (!type || !validTypes.includes(type)) {
            return res.status(400).json({ error: 'Missing type'});
        }

        if (type !== 'folder' && !data) {
            return res.status(400).json({ error: "Missing data" });
        }

        let parentFile = null;
        if (parentId !== '0') {
            const filesCollection = dbClient.client.db().collection('files');
            parentFile = await filesCollection.findOne({ _id: new ObjectId(parentId) })

            if (!parentFile) {
                return res.status(400).json({ error: 'Parent not found' });
            }

            if (parentFile.type !== 'folder') {
                return res.status(400).json({ error: 'Parent is not a folder'});
            }
        }
        const filesCollection = dbClient.client.db().collection('files');
        const fileDocument = {
            userId: new ObjectId(userId),
            name,
            type,
            isPublic,
            parentId: parentId === '0' ? '0': new ObjectId(parentId)
        };

        if (type === 'folder') {
            const result = await filesCollection.insertOne(fileDocument);
            return res.status(201).json({
                id: result.insertedId,
                userId: fileDocument.userId,
                name: fileDocument.name,
                type: fileDocument.type,
                isPublic:fileDocument.isPublic,
                parentId: fileDocument.parentId,
            })
        }
        const localPath = path.join(FOLDER_PATH, uuidv4());
        if (!fs.existsSync(FOLDER_PATH)) {
            fs.mkdirSync(FOLDER_PATH, { recursive: true});
        }

        const fileData = Buffer.from(data, 'base64');
        fs.writeFileSync(localPath, fileData);

        fileDocument.localPath = localPath;

        const result = await filesCollection.insertOne(fileDocument);

        return res.status(201).json({
            id: result.insertedId,
            userId: fileDocument.userId,
            name: fileDocument.name,
            type: fileDocument.type,
            isPublic: fileDocument.isPublic,
            parentId: fileDocument.parentId,
            localPath: fileDocument.localPath,
        });
    }

    static async getShow(req, res) {
        const token = req.headers['x-token'];
        if (!token) {
            return res.status(401).json({ error: "Unauthoried"})
        }

      try {
        const key = `auth_${token}`;

        const userId = await redisClient.client.get(key)
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const fileId = req.params.id;
        if (!ObjectId.isValid(fileId)) {
            return res.status(404).json({ error: "Not found"});
        }
        const file = await dbClient.client.db().collection('files').findOne({
            _id: new ObjectId(fileId),
            userId: new ObjectId(userId)
        });

        if (!file) {
            return res.status(404).json({ error: 'Not found'});
        }
        return res.status(200).json(file);

      } catch(err) {
        console.error("Error retrieving file:", err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    static async getIndex(req, res) {
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
            const parentId = req.query.parentId || '0';
            const page = parseInt(req.query.page, 10) || 0;
            const limit = 20;
            const skip = page * limit;
            const query = {
                userId: new ObjectId(userId),
                parentId: parentId === '0' ? 0 : new ObjectId(parentId),
            };
            const files = await dbClient.client.db().collection('files')
              .find(query)
              .skip(skip)
              .limit(limit)
              .toArray();
            return res.status(200).json(files)
        } catch(err) {
            console.error('Error retrieving files:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async putPublish(req, res) {
        const token = req.headers['x-token'];
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized'});
        }
        const key = `auth_${token}`;

        try {
            const userId = await redisClient.get(key);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const fileId = req.params.id;
            if (!fileId || !ObjectId.isValid(fileId)) {
                return res.status(400).json({ error: "Invalid file id"})
            }

            const file = await dbClient.client.db().collection('files').findOne({
                _id: new ObjectId(fileId),
                userId: new ObjectId(userId)
            })

            if (!file) {
                return res.status(404).json({ error: "Not found"})
            }

            const updateResult = await dbClient.client.db().collection('files').updateOne(
                {userId: new ObjectId(userId), _id: new ObjectId(fileId)}, 
                { $set: { isPublic: true}});
            const updatedFile = await dbClient.client.db().collection('files').findOne({
                _id: new ObjectId(fileId),
                userId: new ObjectId(userId)
            })
            console.log("updated result", updatedFile);
            return res.status(200).json({
                id: file._id,
                userId: file.userId,
                name: file.name,
                type: file.type,
                isPublic: true,
                parentId: file.parentId,
            })

        } catch(err) {
            console.error("Error updating file", err);
            return res.status(500).json({ error: "Internal server error" })
        }

    }

    static async putUnpublish(req, res) {
        const token = req.headers['x-token'];
        if (!token) {
            return res.status(401).json({ error: "Unauthorized"});
        }
        const key = `auth_${token}`;
        try {
            const userId = await redisClient.get(key);
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const fileId = req.params.id;
            if (!fileId || !ObjectId.isValid(fileId)) {
                return res.status(404).json({ error: "Invalid file Id" });
            }
            const file = await dbClient.client.db().collection('files').findOne({
                userId: new ObjectId(userId),
                _id: new ObjectId(fileId)
            });
            if (!file) {
                return res.status(404).json({ error: "Not found" })
            }
            await dbClient.client.db().collection('files').updateOne(
                { userId: new ObjectId(userId), _id: new ObjectId(fileId)},
            { $set: { isPublic: false }});
            return res.status(200).json({
                id: file._id,
                userId: file.userId,
                name: file.name,
                type: file.type,
                isPublic: false,
                parentId: file.parentId,
            });

        } catch (err) {
            console.error("Error updating file", err);
            return res.status(500).json({ error: "Internal server error"})
        }
    }

    static async getFile(req, res) {
        const token = req.headers['x-token'];
        const key = `auth_${token}`;
        const fileId = req.params.id;
        try {
        
        if (!fileId || !ObjectId.isValid(fileId)) {
            return res.status(400).json({ error: "Invalid file id" });
        }
        const file = await dbClient.client.db().collection('files').findOne({
            _id: new ObjectId(fileId)
        });
        if (!file) {
            return res.status(404).json({ error: 'Not found'});
        }
        console.log(file)
        if (!file.isPublic) {
            const userId = await redisClient.get(key);
            if (!userId) {
                return res.status(404).json({ error: "Not found" });
            }
        }
        const localPath = file.localPath;

        if (!fs.existsSync(localPath)) {
            return res.status(404).json({ error: "File not found" });
        }
        const mimeType = mime.lookup(file.name || localPath);
        if (!mimeType) {
            return res.status(400).json({ error: "Unsupported file type" });
        }
        const fileContent = fs.readFileSync(localPath);
        res.setHeader('Content-Type', mimeType);
        return res.send(fileContent);
    } catch(err) {
        console.error("Error retrieving file", err);
        return res.status(500).json({ error: "Internal server error" })
    }
    }
}

export default FilesController;
