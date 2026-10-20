import fs from "fs";
import path from "path";
import multer from "multer";
import { sniffImage } from "./image-sniff";

export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
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
};

export async function reencodeImage(filePath: string): Promise<ProcessedImage> {
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
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), card);
  fs.writeFileSync(path.join(UPLOAD_DIR, thumbnailFilename), thumb);
  return { filename, thumbnailFilename, width, height };
}
