import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_CHANNEL_ID = Deno.env.get('TELEGRAM_CHANNEL_ID');

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
      return new Response(JSON.stringify({ error: 'Telegram not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { fileData, fileName, mimeType } = await req.json();

    if (!fileData || !fileName) {
      return new Response(JSON.stringify({ error: 'Missing fileData or fileName' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Optimized base64 decoding using Deno's built-in
    const binaryData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));

    // Upload to Telegram
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHANNEL_ID);
    formData.append('document', new Blob([binaryData], { type: mimeType || 'application/octet-stream' }), fileName);

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
      { method: 'POST', body: formData }
    );

    const telegramData = await telegramRes.json();

    if (!telegramRes.ok || !telegramData.ok) {
      console.error('Telegram API error:', telegramData);
      return new Response(JSON.stringify({ error: 'Telegram upload failed', details: telegramData }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileId = telegramData.result?.document?.file_id || null;
    const messageId = telegramData.result?.message_id;

    return new Response(JSON.stringify({
      success: true,
      fileId,
      messageIds: [messageId],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
