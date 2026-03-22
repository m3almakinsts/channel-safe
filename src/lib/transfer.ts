import { supabase } from '@/integrations/supabase/client';

const FUNCTION_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function getAccessToken(required: boolean): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token ?? null;

  if (required && !token) {
    throw new Error('Authentication required');
  }

  return token;
}

async function readFunctionError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || `Request failed (${response.status})`;
  } catch {
    const text = await response.text();
    return text || `Request failed (${response.status})`;
  }
}

export async function uploadEncryptedToTelegram(params: {
  encrypted: ArrayBuffer;
  fileName: string;
  mimeType?: string;
  signal?: AbortSignal;
}): Promise<{ fileId: string | null; messageIds: number[] }> {
  const accessToken = await getAccessToken(true);

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([params.encrypted], { type: params.mimeType || 'application/octet-stream' }),
    params.fileName
  );
  formData.append('fileName', params.fileName);
  formData.append('mimeType', params.mimeType || 'application/octet-stream');

  const response = await fetch(`${FUNCTION_BASE_URL}/telegram-upload`, {
    method: 'POST',
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
    signal: params.signal,
  });

  if (!response.ok) {
    throw new Error(await readFunctionError(response));
  }

  const data = await response.json();
  return {
    fileId: data?.fileId ?? null,
    messageIds: Array.isArray(data?.messageIds) ? data.messageIds : [],
  };
}

export async function downloadEncryptedFromTelegram(params: {
  fileId: string;
  signal?: AbortSignal;
}): Promise<ArrayBuffer> {
  const accessToken = await getAccessToken(true);

  const response = await fetch(`${FUNCTION_BASE_URL}/telegram-download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fileId: params.fileId }),
    signal: params.signal,
  });

  if (!response.ok) {
    throw new Error(await readFunctionError(response));
  }

  return response.arrayBuffer();
}

export async function downloadSharedEncryptedFile(params: {
  token: string;
  signal?: AbortSignal;
}): Promise<{ encrypted: ArrayBuffer; fileName: string; mimeType: string; encryptionIv: string }> {
  const response = await fetch(`${FUNCTION_BASE_URL}/shared-download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ token: params.token }),
    signal: params.signal,
  });

  if (!response.ok) {
    throw new Error(await readFunctionError(response));
  }

  const fileNameHeader = response.headers.get('X-File-Name') || 'shared-file';
  const mimeType = response.headers.get('X-Mime-Type') || 'application/octet-stream';
  const encryptionIv = response.headers.get('X-Encryption-Iv') || '';

  return {
    encrypted: await response.arrayBuffer(),
    fileName: decodeURIComponent(fileNameHeader),
    mimeType,
    encryptionIv,
  };
}
