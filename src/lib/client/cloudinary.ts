type CloudinaryUploadConfig = {
  cloudName: string;
  uploadPreset: string;
};

function getCloudinaryUploadConfig(): CloudinaryUploadConfig | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset || cloudName.trim().length === 0 || uploadPreset.trim().length === 0) {
    return null;
  }

  return { cloudName, uploadPreset };
}

export function isCloudinaryConfigured() {
  return Boolean(getCloudinaryUploadConfig());
}

export async function uploadImageToCloudinary(file: File, folder = 'freshhaul/products'): Promise<{ secureUrl: string; publicId: string }> {
  const config = getCloudinaryUploadConfig();
  if (!config) {
    throw new Error('Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', config.uploadPreset);
  formData.append('folder', folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json() as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.secure_url || !data.public_id) {
    throw new Error(data.error?.message ?? 'Failed to upload product image.');
  }

  return {
    secureUrl: data.secure_url,
    publicId: data.public_id,
  };
}

