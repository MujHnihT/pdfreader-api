import app from './app';
import Database from './config/database';


const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await Database.connect();
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server due to error:', err);
    process.exit(1);
  }
})();
