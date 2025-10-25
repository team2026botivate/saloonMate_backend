import { google } from 'googleapis';
import { Readable } from 'stream';

const auth = new google.auth.OAuth2({
  clientId: process.env.GOOGLE_CLIENT,
  clientSecret: process.env.GOOGLE_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URL,
});

auth.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth });

export const uploadFileToGoogleDrive = async (file: Express.Multer.File) => {
  try {
    const mimeType = file?.mimetype || 'application/octet-stream';
    const bufferStream = Readable.from(file.buffer);

    const response = await drive.files.create({
      requestBody: {
        name: file.originalname ?? 'file',
        mimeType,
      },
      media: {
        mimeType,
        body: bufferStream,
      },
      fields: 'id, name, webViewLink',
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error('Failed to upload file to Google Drive');
    }

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const fileInfo = await drive.files.get({
      fileId,
      fields: 'webViewLink, webContentLink, name',
    });

    return {
      fileId,
      fileName: fileInfo.data.name,
      webViewLink: fileInfo.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      webContentLink:
        fileInfo.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`,
      downloadLink: `https://drive.google.com/uc?export=download&id=${fileId}`,
    };
  } catch (error: any) {
    console.error('Google Drive Upload Error:', error?.message || error);
    throw new Error('Google Drive Upload Failed');
  }
};
