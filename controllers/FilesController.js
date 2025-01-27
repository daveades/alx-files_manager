import { ObjectID } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    // Get user from token
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Validate inputs
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Validate parent if specified
    if (parentId !== 0) {
      const parent = await dbClient.db.collection('files')
        .findOne({ _id: ObjectID(parentId) });
      if (!parent) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // Create file document
    const fileDoc = {
      userId: ObjectID(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? '0' : ObjectID(parentId),
    };

    // Handle folder creation
    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileDoc);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }

    // Handle file/image creation
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const filename = uuidv4();
    const localPath = path.join(folderPath, filename);
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

    fileDoc.localPath = localPath;
    const result = await dbClient.db.collection('files').insertOne(fileDoc);

    return res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getShow(req, res) {
    // Get user from token
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Find file by ID
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectID(fileId),
      userId: ObjectID(userId),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    // Get user from token
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get pagination params
    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const limit = 20;

    // Query files collection
    const files = await dbClient.db.collection('files')
      .aggregate([
        {
          $match: {
            userId: ObjectID(userId),
            parentId: parentId === '0' ? '0' : ObjectID(parentId),
          },
        },
        { $skip: page * limit },
        { $limit: limit },
      ]).toArray();

    // Format response
    const formattedFiles = files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    }));

    return res.status(200).json(formattedFiles);
  }

  static async putPublish(req, res) {
    // Get user from token
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Find and update file
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectID(fileId),
      userId: ObjectID(userId),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    // Update isPublic to true
    await dbClient.db.collection('files').updateOne(
      { _id: ObjectID(fileId) },
      { $set: { isPublic: true } },
    );

    // Return updated file
    const updatedFile = {
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId,
    };

    return res.status(200).json(updatedFile);
  }

  static async putUnpublish(req, res) {
    // Get user from token
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Find and update file
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectID(fileId),
      userId: ObjectID(userId),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    // Update isPublic to false
    await dbClient.db.collection('files').updateOne(
      { _id: ObjectID(fileId) },
      { $set: { isPublic: false } },
    );

    // Return updated file
    const updatedFile = {
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId,
    };

    return res.status(200).json(updatedFile);
  }

  static async getFile(req, res) {
    // Get user from token if provided
    const token = req.header('X-Token');
    const userId = token ? await redisClient.get(`auth_${token}`) : null;

    // Find file by ID
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectID(fileId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check file permissions
    if (!file.isPublic && (!userId || userId !== file.userId.toString())) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check if it's a folder
    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    // Check if file exists locally
    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Get MIME type
    const mimeType = mime.lookup(file.name);

    // Read and return file content
    const fileContent = fs.readFileSync(file.localPath);
    res.setHeader('Content-Type', mimeType);
    return res.send(fileContent);
  }
}

export default FilesController;
