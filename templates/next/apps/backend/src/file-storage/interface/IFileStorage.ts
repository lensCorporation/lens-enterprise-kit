export interface IFileStorage {
    uploadFile(file: Express.Multer.File): Promise<string>;
    deleteFile(fileUrl: string): Promise<boolean>;
}
  