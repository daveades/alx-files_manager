import Bull from 'bull';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import { ObjectID } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Bull('fileQueue');
const userQueue = new Bull('userQueue');

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  const file = await dbClient.db.collection('files').findOne({
    _id: ObjectID(fileId),
    userId: ObjectID(userId),
  });

  if (!file) throw new Error('File not found');

  const sizes = [500, 250, 100];
  const thumbnailPromises = sizes.map((width) => imageThumbnail(file.localPath, { width })
    .then((thumbnail) => {
      const thumbnailPath = `${file.localPath}_${width}`;
      return fs.promises.writeFile(thumbnailPath, thumbnail);
    }));

  await Promise.all(thumbnailPromises);
});

userQueue.process(async (job) => {
  const { userId } = job.data;

  if (!userId) throw new Error('Missing userId');

  const user = await dbClient.db.collection('users').findOne({
    _id: ObjectID(userId),
  });

  if (!user) throw new Error('User not found');

  console.log(`Welcome ${user.email}!`);
});
