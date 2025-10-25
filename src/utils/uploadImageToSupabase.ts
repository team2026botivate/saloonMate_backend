import { supabase } from '../helper/supabase.js';

export const uploadImageToSupabase = async (
  path: string,
  fileBody: File | Blob | Buffer,
  folderName: string,
  contentType: string
) => {
  if (!folderName) {
    throw new Error('Folder name is required');
  }
  const { data, error } = await supabase.storage.from(folderName).upload(path, fileBody, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  });
  if (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
  const { data: publicData } = supabase.storage.from(folderName).getPublicUrl(path);

  const publicUrl = publicData?.publicUrl;

  const newUrl = publicUrl.split('billUpload/')[1];

  return { data, publicUrl: newUrl, error } as const;
};
