const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');

async function start() {
  try {
    await connectDB();
    logger.info('connected to DB');
    app.listen(env.PORT, () => {
      logger.info(`server is listening on port ${env.PORT}`);
    });
  } catch (err) {
    logger.error('failed to start server', err);
    process.exit(1);
  }
}

start();
