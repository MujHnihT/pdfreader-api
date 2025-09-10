import mongoose from 'mongoose';

class Database {
  private static isConnected = false;

  private constructor() {}

  public static async connect(): Promise<void> {
    if (Database.isConnected) return;
    try {
      await mongoose.connect(process.env.DB_URI as string);
      console.log('✅ Database connection established.');
      Database.isConnected = true;
    } catch (error) {
      console.error('❌ Unable to connect to the database:', error);
      throw error;
    }
  }

  public static getConnection(): mongoose.Connection {
    return mongoose.connection;
  }
}

export default Database;
