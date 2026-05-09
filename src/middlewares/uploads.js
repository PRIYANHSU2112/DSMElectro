import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import createError from 'http-errors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

dotenv.config();

class ObjectStorageService {
  constructor() {
    this.s3 = new S3Client({
      region: process.env.LINODE_OBJECT_STORAGE_REGION,
      endpoint: process.env.LINODE_OBJECT_STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: process.env.LINODE_OBJECT_STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.LINODE_OBJECT_STORAGE_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    this.bucket = process.env.LINODE_OBJECT_BUCKET;
    this.folderPath = process.env.BUCKET_FOLDER_PATH || '';
    this.localUploadPath = path.join(process.cwd(), 'uploads');
  }

  // File filter for specific field types
  multerFilter(req, file, cb) {

    if (file.fieldname === "effectOfAr" && file.mimetype !== "application/octet-stream") {
      return cb(createError("Only .deeper format allowed!"), false);
    }

    if (file.fieldname === "threeDModelData" && file.mimetype !== "model/obj") {
      return cb(createError("Only .obj format allowed!"), false);
    }

    // ✅ ADDED: VIDEO VALIDATION
    if (file.fieldname === "video") {
      if (!file.mimetype.startsWith("video/")) {
        return cb(createError("Only video files allowed!"), false);
      }
    }


    // inside multerFilter

    // ✅ RESUME VALIDATION
    if (file.fieldname === "resume") {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        return cb(createError("Only PDF or DOC/DOCX allowed!"), false);
      }
    }

    cb(null, true);
  }

  // Multer config for S3 upload
  s3Uploader() {
    return multer({
      fileFilter: this.multerFilter,
      storage: multerS3({
        s3: this.s3,
        acl: "public-read",
        bucket: this.bucket,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: (req, file, cb) => {
          cb(null, { fieldName: file.fieldname });
        },
        key: (req, file, cb) => {
          cb(null, this.generateFileName(file));
        },
      }),
    });
  }

  // Upload any file (generic upload method)
  uploadAny() {
    return multer({
      storage: multerS3({
        s3: this.s3,
        acl: "public-read",
        bucket: this.bucket,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: (req, file, cb) => {
          cb(null, { fieldName: file.fieldname });
        },
        key: (req, file, cb) => {
          cb(null, this.generateFileName(file));
        },
      }),
    });
  }

  // generate file name 
  generateFileName(file) {
    const timestamp = Date.now();
    const ext = file.originalname.split(".").pop();
    return `${process.env.BUCKET_FOLDER_PATH}${file.fieldname}-${timestamp}.${ext}`;
  }

  // Multer config for local upload
  localUploader() {
    return multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          if (!fs.existsSync(this.localUploadPath)) {
            fs.mkdirSync(this.localUploadPath, { recursive: true });
          }
          cb(null, this.localUploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    });
  }

  // Delete file from S3
  async deleteFile(key) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return await this.s3.send(command);
  }

  // Get buffer of image or file from S3
  async getBuffer(bucketName, key) {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const response = await this.s3.send(command);

    if (response.Body instanceof Readable) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        response.Body.on('data', chunk => chunks.push(chunk));
        response.Body.on('error', reject);
        response.Body.on('end', () => resolve(Buffer.concat(chunks)));
      });
    }

    return response.Body;
  }

  // Upload buffer to S3
  async uploadBuffer(buffer, fileName, contentType = 'application/pdf') {
    const key = `${this.folderPath}${fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    });
    await this.s3.send(command);

    // Build public URL from env endpoint (e.g. "https://ap-south-1.linodeobjects.com")
    const endpoint = process.env.LINODE_OBJECT_STORAGE_ENDPOINT.replace(/\/$/, '');
    return `${endpoint}/${this.bucket}/${key}`;
  }







}

export default new ObjectStorageService();