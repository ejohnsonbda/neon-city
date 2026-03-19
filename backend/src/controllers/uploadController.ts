import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

// ─── Upload Image ─────────────────────────────────────────────────────────────
export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.' });
    return;
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  res.json({
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
};

// ─── Delete Image ─────────────────────────────────────────────────────────────
export const deleteImage = async (req: Request, res: Response): Promise<void> => {
  const { filename } = req.params;

  // Security: prevent path traversal
  const safeName = path.basename(filename);
  const filePath = path.join(__dirname, '../../uploads', safeName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }

  fs.unlinkSync(filePath);
  res.json({ message: 'File deleted successfully.' });
};
