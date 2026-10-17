const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'application/pdf': '.pdf',
  'application/octet-stream': '.bin',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/zip': '.zip',
};

export function extensionForMimeType(mimeType: string): string | null {
  return MIME_EXTENSIONS[mimeType.trim().toLowerCase()] || null;
}

export function isValidBase64Payload(value: string, maxBytes: number): boolean {
  if (!value || value.length > Math.ceil(maxBytes / 3) * 4 + 4) return false;
  const normalized = value.replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(normalized)) return false;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length > 0 && decoded.length <= maxBytes && decoded.toString('base64').replace(/=+$/, '') === normalized;
}
