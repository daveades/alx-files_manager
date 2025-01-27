import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    
    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.db = null;
    
    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
      })
      .catch(error => console.log(error));
  }

  isAlive() {
    return !!this.db;
  }

  async nbUsers() {
    if (!this.db) return 0;
    const users = this.db.collection('users');
    return users.countDocuments();
  }

  async nbFiles() {
    if (!this.db) return 0;
    const files = this.db.collection('files');
    return files.countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;