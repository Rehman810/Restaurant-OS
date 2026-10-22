import fs from "fs";
import path from "path";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { sniffImage } from "./image-sniff";
import { getRestaurantId } from "./restaurant-context";
import { DEFAULT_RESTAURANT_ID } from "./restaurant-context";

export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function tenantUploadDir(restaurantId?: string) {
  const id = restaurantId || getRestaurantId();
  const dir = path.join(UPLOAD_DIR, id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function uploadPublicPath(filename: string, restaurantId?: string) {
  const id = restaurantId || getRestaurantId();
  return `/uploads/${id}/${filename}`;
}

export const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, tenantUploadDir());
      } catch {
        cb(null, UPLOAD_DIR);
      }
    },
    filename: (_req, _file, cb) => {
      const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.upload`;
      cb(null, safe);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, WebP or GIF images are allowed."));
    }
  },
});

export type ProcessedImage = {
  filename: string;
  thumbnailFilename: string;
  width: number;
  height: number;
  publicPath: string;
  thumbnailPublicPath: string;
};

export async function reencodeImage(filePath: string, restaurantId?: string): Promise<ProcessedImage> {
  const dir = tenantUploadDir(restaurantId);
  const buf = fs.readFileSync(filePath);
  const kind = sniffImage(buf);
  if (!kind) {
    fs.unlinkSync(filePath);
    throw new Error("Only JPG, PNG, WebP or GIF images are allowed.");
  }
  const sharp = (await import("sharp")).default;
  const pipeline = sharp(buf, { failOn: "error" }).rotate();
  const meta = await pipeline.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const card = await pipeline.clone().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumb = await pipeline.clone().resize({ width: 320, height: 320, fit: "cover" }).webp({ quality: 78 }).toBuffer();
  const base = filePath.replace(/\.[^.]+$/, "");
  const filename = `${path.basename(base)}.webp`;
  const thumbnailFilename = `${path.basename(base)}-thumb.webp`;
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  fs.writeFileSync(path.join(dir, filename), card);
  fs.writeFileSync(path.join(dir, thumbnailFilename), thumb);
  const rid = restaurantId || getRestaurantId();
  const publicPath = uploadPublicPath(filename, rid);
  const thumbnailPublicPath = uploadPublicPath(thumbnailFilename, rid);
  return { filename, thumbnailFilename, width, height, publicPath, thumbnailPublicPath };
}

function safeFilename(name: string) {
  const base = path.basename(name);
  if (!base || base.includes("..")) return null;
  return base;
}

/** Serves tenant-prefixed files and legacy flat paths (redirect to tenant #1 when found). */
export function serveUpload(req: Request, res: Response, next: NextFunction) {
  const raw = req.path.replace(/^\/+/, "");
  if (!raw) return next();
  const segments = raw.split("/").filter(Boolean);
  const setHeaders = () => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
  };

  if (segments.length === 2) {
    const [tenantId, file] = segments;
    const safe = safeFilename(file);
    if (!safe) return res.status(400).end();
    const full = path.join(UPLOAD_DIR, tenantId, safe);
    if (fs.existsSync(full)) {
      setHeaders();
      return res.sendFile(full);
    }
    return res.status(404).end();
  }

  if (segments.length === 1) {
    const safe = safeFilename(segments[0]);
    if (!safe) return res.status(400).end();
    const legacy = path.join(UPLOAD_DIR, safe);
    if (fs.existsSync(legacy)) {
      setHeaders();
      return res.sendFile(legacy);
    }
    const tenantPath = path.join(UPLOAD_DIR, DEFAULT_RESTAURANT_ID, safe);
    if (fs.existsSync(tenantPath)) {
      return res.redirect(301, `/uploads/${DEFAULT_RESTAURANT_ID}/${safe}`);
    }
    return res.status(404).end();
  }

  return res.status(404).end();
}
