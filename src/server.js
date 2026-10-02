import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { underwriteRouter } from './routes/underwrite.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/underwrite', underwriteRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`CRE Underwriting Agent running on port ${PORT}`);
  console.log(`POST /api/underwrite - Start underwriting process`);
  console.log(`GET /health - Health check`);
});
