import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { uploadLimiter } from "../middleware/security";
import { imageUpload, reencodeImage } from "../lib/uploads";

export const uploadRouter = Router();

uploadRouter.post(
  "/image",
  requireAuth,
  requireRole(Role.ADMIN),
  uploadLimiter,
  (req, res) => {
    imageUpload.single("image")(req, res, (err) => {
      if (err) {
        const message = err instanceof Error ? err.message : "Upload failed.";
        return res.status(400).json({ error: message });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided." });
      }

      reencodeImage(req.file.path)
        .then((processed) => {
          const host = req.get("host");
          const protocol = req.protocol;
          const url = `${protocol}://${host}${processed.publicPath}`;
          const thumbnailUrl = `${protocol}://${host}${processed.thumbnailPublicPath}`;
          res.status(201).json({
            url,
            thumbnailUrl,
            filename: processed.filename,
            width: processed.width,
            height: processed.height,
          });
        })
        .catch((encodeErr: unknown) => {
          const message = encodeErr instanceof Error ? encodeErr.message : "Upload failed.";
          res.status(400).json({ error: message });
        });
    });
  }
);
