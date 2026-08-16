require('dotenv').config();

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const requiredProductionVariables = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGINS'];
const missingProductionVariables = requiredProductionVariables.filter((name) => !process.env[name]?.trim());

if (isProduction && missingProductionVariables.length) {
  throw new Error(`Missing required production environment variables: ${missingProductionVariables.join(', ')}`);
}
if (isProduction && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production.');
}

const prisma = require('./config/prisma');
const applicationRoutes = require('./routes/applicationRoutes');
const authRoutes = require('./routes/authRoutes');

const developmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = (process.env.CORS_ORIGINS || developmentOrigins.join(','))
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(new Error('This origin is not allowed by CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 600 : 2000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please wait a moment and try again.' },
}));
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 50 : 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please wait and try again.' },
}));

app.get('/', (req, res) => {
  res.json({ service: 'PGCEAP Scholarship Management API', status: 'online' });
});

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check failed:', error.message);
    return res.status(503).json({ status: 'unhealthy', database: 'unavailable', timestamp: new Date().toISOString() });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', applicationRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Resource not found' });
});

app.use((error, req, res, next) => {
  if (error.message === 'This origin is not allowed by CORS.') {
    return res.status(403).json({ message: error.message });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'The uploaded request is too large.' });
  }
  console.error(error);
  return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Internal server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received. Closing the API server.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };
