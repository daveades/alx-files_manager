import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    // Check if user already exists
    const users = dbClient.db.collection('users');
    const existingUser = await users.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ error: 'Already exist' });
    }

    // Hash password and create new user
    const hashedPassword = sha1(password);
    const result = await users.insertOne({
      email,
      password: hashedPassword,
    });

    // Return new user data
    return res.status(201).json({
      id: result.insertedId,
      email,
    });
  }
}

export default UsersController;
