import { expect } from 'chai';
import dbClient from '../utils/db';

describe('DBClient', () => {
  before(async () => {
    // Clear collections before tests
    const collections = ['users', 'files'];
    for (const collection of collections) {
      await dbClient.db.collection(collection).deleteMany({});
    }
  });

  it('should connect to MongoDB', () => {
    expect(dbClient.isAlive()).to.be.true;
  });

  it('should count users correctly', async () => {
    const initialCount = await dbClient.nbUsers();
    await dbClient.db.collection('users').insertOne({ email: 'test@test.com' });
    const newCount = await dbClient.nbUsers();
    expect(newCount).to.equal(initialCount + 1);
  });

  it('should count files correctly', async () => {
    const initialCount = await dbClient.nbFiles();
    await dbClient.db.collection('files').insertOne({ name: 'test.txt' });
    const newCount = await dbClient.nbFiles();
    expect(newCount).to.equal(initialCount + 1);
  });
});