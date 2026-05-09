import { S3 } from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";

const s3Client = new S3({
  region: process.env.LINODE_OBJECT_STORAGE_REGION || "sgp1",
  endpoint: process.env.LINODE_OBJECT_STORAGE_ENDPOINT || "https://sgp1.digitaloceanspaces.com",
  forcePathStyle: false,
  credentials: {
    accessKeyId:     process.env.LINODE_OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.LINODE_OBJECT_STORAGE_SECRET_ACCESS_KEY,
  },
});

function multerFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/gif", "video/mp4", "application/pdf"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    req.fileValidationError = "Only JPEG, JPG, PNG, GIF, MP4 or PDF formats allowed!";
    cb(null, true); // still accept so multer doesn't crash, validation happens in middleware
  }
}

export const upload = multer({
  storage: multerS3({
    s3: s3Client,
    acl: "public-read",
    bucket: process.env.LINODE_OBJECT_BUCKET || "satyakabir-bucket",
    contentType: (req, file, cb) => cb(null, file.mimetype),
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      cb(null, (process.env.BUCKET_FOLDER_PATH || "") + Date.now() + file.originalname);
    },
  }),
  fileFilter: multerFilter,
});

export const imageValidation = (req, res, next) => {
  if (req.fileValidationError) {
    return res.status(400).json({ success: false, message: req.fileValidationError });
  }
  next();
};

export const deleteFileFromObjectStorage = async (key) => {
  if (!key) return;
  try {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.LINODE_OBJECT_BUCKET,
      Key: key,
    }));
  } catch (err) {
    console.error("Failed to delete file from storage:", err.message);
  }
};