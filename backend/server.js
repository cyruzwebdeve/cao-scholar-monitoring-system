const express = require('express');
const cors = require('cors');
require('dotenv').config();

// API entry point watched by Nodemon during local development.
const applicationRoutes = require('./routes/applicationRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Requirement uploads are sent as base64 JSON payloads.
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.send('Centralized Scholar Monitoring System API');
});

app.use('/api/auth', authRoutes);
app.use('/api', applicationRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Resource not found' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
