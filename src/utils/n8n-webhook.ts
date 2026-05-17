/**
 * n8n Webhook Dispatcher
 * Fire-and-forget pattern: never blocks the API response.
 * If N8N_WEBHOOK_URL is not set, all calls are silently skipped.
 */
export async function fireN8nEvent(event: string, payload: Record<string, any>): Promise<void> {
  const baseUrl = process.env.N8N_WEBHOOK_URL;
  if (!baseUrl) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Remove trailing slashes if present
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // Fire webhook asynchronously
    fetch(`${cleanUrl}/${event}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        source: 'paperland-backend',
        ...payload,
      }),
      signal: controller.signal,
    })
      .then(response => {
        clearTimeout(timeout);
        if (!response.ok) {
          console.warn(`[n8n] Webhook event "${event}" responded with status: ${response.status}`);
        }
      })
      .catch(err => {
        clearTimeout(timeout);
        console.warn(`[n8n] Webhook fetch error for event "${event}": ${(err as Error).message}`);
      });

  } catch (err) {
    console.warn(`[n8n] Webhook fire exception for event "${event}": ${(err as Error).message}`);
  }
}
