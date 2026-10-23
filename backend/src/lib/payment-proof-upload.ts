import multer from "multer";
import path from "path";
import { tenantUploadDir, UPLOAD_DIR } from "./uploads";

export const paymentProofUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, tenantUploadDir());
      } catch {
        cb(null, UPLOAD_DIR);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || ".bin";
      const safe = `${Date.now()}-proof${ext.replace(/[^a-z0-9.]/g, "")}`;
      cb(null, safe);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) || file.mimetype === "application/pdf";
    if (ok) cb(null, true);
    else cb(new Error("Receipt must be a JPG, PNG, WebP, GIF, or PDF."));
  },
});
