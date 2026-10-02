import express from 'express';
import multer from 'multer';
import { runUnderwritingPipeline } from '../pipeline/orchestrator.js';

export const underwriteRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max
  }
});

// POST /api/underwrite - intake endpoint
underwriteRouter.post('/', upload.array('files'), async (req, res) => {
  try {
    const { dealName, email } = req.body;

    if (!dealName) {
      return res.status(400).json({ error: 'dealName is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required' });
    }

    // Run the full 11-step pipeline
    const result = await runUnderwritingPipeline({
      files: req.files,
      dealName,
      email: email || 'noreply@example.com'
    });

    res.json(result);
  } catch (error) {
    console.error('Underwriting error:', error);
    res.status(500).json({
      error: error.message,
      details: error.stack
    });
  }
});

// GET /api/underwrite/health - endpoint health check
underwriteRouter.get('/health', (req, res) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});
