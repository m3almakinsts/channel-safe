import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!telegramBotToken) {
      return new Response(JSON.stringify({ error: 'Telegram not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: sharedLink, error: sharedLinkError } = await admin
      .from('shared_links')
      .select('file_id, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (sharedLinkError || !sharedLink) {
      return new Response(JSON.stringify({ error: 'Share link not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (sharedLink.expires_at && new Date(sharedLink.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Share link has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: file, error: fileError } = await admin
      .from('files')
      .select('telegram_file_id, original_name, name, mime_type, encryption_iv')
      .eq('id', sharedLink.file_id)
      .maybeSingle();

    if (fileError || !file?.telegram_file_id || !file.encryption_iv) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileInfoRes = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${file.telegram_file_id}`
    );
    const fileInfo = await fileInfoRes.json();

    if (!fileInfoRes.ok || !fileInfo?.ok) {
      return new Response(JSON.stringify({ error: 'File not found on Telegram' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const downloadUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`;
    const fileRes = await fetch(downloadUrl);

    if (!fileRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to download file from Telegram' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileBuffer = await fileRes.arrayBuffer();
    const fileName = encodeURIComponent(file.original_name || file.name || 'shared-file');
    const mimeType = file.mime_type || 'application/octet-stream';

    return new Response(fileBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': mimeType,
        'X-File-Name': fileName,
        'X-Mime-Type': mimeType,
        'X-Encryption-Iv': file.encryption_iv,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Shared download failed:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
