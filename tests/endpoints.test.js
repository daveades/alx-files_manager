
import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../server';
import dbClient from '../utils/db';

chai.use(chaiHttp);
const { expect } = chai;

describe('API Endpoints', () => {
  let token;
  let fileId;

  before(async () => {
    // Clear collections before tests
    await dbClient.db.collection('users').deleteMany({});
    await dbClient.db.collection('files').deleteMany({});
  });

  describe('GET /status', () => {
    it('should return service status', async () => {
      const res = await chai.request(app).get('/status');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('redis', true);
      expect(res.body).to.have.property('db', true);
    });
  });

  describe('GET /stats', () => {
    it('should return stats', async () => {
      const res = await chai.request(app).get('/stats');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('users');
      expect(res.body).to.have.property('files');
    });
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const res = await chai.request(app)
        .post('/users')
        .send({
          email: 'test@test.com',
          password: 'password123',
        });
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('id');
      expect(res.body).to.have.property('email', 'test@test.com');
      userId = res.body.id;
    });
  });

  describe('GET /connect', () => {
    it('should authenticate user and return token', async () => {
      const credentials = Buffer.from('test@test.com:password123').toString('base64');
      const res = await chai.request(app)
        .get('/connect')
        .set('Authorization', `Basic ${credentials}`);
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('token');
      token = res.body.token;
    });
  });

  describe('POST /files', () => {
    it('should upload a file', async () => {
      const res = await chai.request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          name: 'test.txt',
          type: 'file',
          data: Buffer.from('Hello World').toString('base64'),
        });
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('id');
      fileId = res.body.id;
    });
  });

  describe('GET /files/:id', () => {
    it('should retrieve file information', async () => {
      const res = await chai.request(app)
        .get(`/files/${fileId}`)
        .set('X-Token', token);
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('name', 'test.txt');
    });
  });
});
