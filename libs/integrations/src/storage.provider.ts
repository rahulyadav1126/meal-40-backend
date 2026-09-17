import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
export interface UploadInput {
  buffer: Buffer;
  folder: string;
  publicId?: string;
}
export interface UploadedFile {
  publicId: string;
  url: string;
  bytes: number;
  format: string;
}
export interface FileStorageProvider {
  upload(input: UploadInput): Promise<UploadedFile>;
  delete(publicId: string): Promise<void>;
}
@Injectable()
export class CloudinaryFileStorageProvider implements FileStorageProvider {
  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }
  upload(input: UploadInput): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: input.folder,
          public_id: input.publicId,
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result)
            return reject(error ?? new Error('Cloudinary upload failed'));
          resolve({
            publicId: result.public_id,
            url: result.secure_url,
            bytes: result.bytes,
            format: result.format,
          });
        },
      );
      stream.end(input.buffer);
    });
  }
  async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }
}
