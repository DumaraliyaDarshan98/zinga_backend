import B2 from 'backblaze-b2'
import mime from "mime-types";

export const uploadToBackblazeB2 = async (fileData) => {
    try {
        const b2 = new B2({
            applicationKeyId: "00514ca8b3835aa0000000001",
            applicationKey: "K005iJMVxqx0k0dO+HvyG/Tz9t2dXg0",
        });

      await b2.authorize();
  
      const bucketId = "61244caaf8fbb37893550a1a";
  
      const contentType = mime.lookup(fileData.originalname) || "application/octet-stream";
      const fileName = `zinga/${Date.now()}_${fileData.originalname}`;
  
      const uploadUrlResponse = await b2.getUploadUrl({
        bucketId: bucketId
      });
  
      const uploadResponse = await b2.uploadFile({
        uploadUrl: uploadUrlResponse.data.uploadUrl,
        uploadAuthToken: uploadUrlResponse.data.authorizationToken,
        fileName: fileName,
        data: fileData.buffer,
        mime: contentType
      });
  
      const fileUrl = `https://all-type-file.s3.us-east-005.backblazeb2.com/${fileName}`;
      
      return {
        key: fileName,
        url: fileUrl,
        fileName: fileData.originalname
      };
    } catch (error) {
      console.error("Error uploading file to Backblaze B2:", error);
      throw error;
    }
};

/**
 * Upload multiple files to Backblaze B2
 * @param {Array} files - Array of file objects from multer
 * @returns {Promise<Array>} - Array of uploaded file information
 */
export const uploadMultipleToBackblazeB2 = async (files) => {
  try {
    // If only one file is passed and it's not in an array, wrap it in an array
    if (!Array.isArray(files)) {
      files = [files];
    }

    const b2 = new B2({
      applicationKeyId: "00514ca8b3835aa0000000001",
      applicationKey: "K005iJMVxqx0k0dO+HvyG/Tz9t2dXg0",
    });

    await b2.authorize();
    const bucketId = "61244caaf8fbb37893550a1a";

    // Process each file upload in sequence to avoid rate limiting issues
    const uploadedFiles = [];
    for (const file of files) {
      const contentType = mime.lookup(file.originalname) || "application/octet-stream";
      // Add timestamp to ensure unique filenames
      const fileName = `zinga/${Date.now()}_${file.originalname}`;

      const uploadUrlResponse = await b2.getUploadUrl({
        bucketId: bucketId
      });

      const uploadResponse = await b2.uploadFile({
        uploadUrl: uploadUrlResponse.data.uploadUrl,
        uploadAuthToken: uploadUrlResponse.data.authorizationToken,
        fileName: fileName,
        data: file.buffer,
        mime: contentType
      });

      const fileUrl = `https://all-type-file.s3.us-east-005.backblazeb2.com/${fileName}`;
      
      uploadedFiles.push({
        key: fileName,
        url: fileUrl,
        fileName: file.originalname
      });
    }

    return uploadedFiles;
  } catch (error) {
    console.error("Error uploading multiple files to Backblaze B2:", error);
    throw error;
  }
};