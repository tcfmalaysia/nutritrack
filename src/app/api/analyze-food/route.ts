import { NextRequest, NextResponse } from 'next/server';

const getAIConfig = () => {
  const apiKey = process.env.ZAI_API_KEY;
  const baseUrl = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4';
  if (!apiKey) {
    throw new Error('AI not configured. Set ZAI_API_KEY in Vercel env vars.');
  }
  return { baseUrl, apiKey, token: process.env.ZAI_TOKEN, chatId: process.env.ZAI_CHAT_ID, userId: process.env.ZAI_USER_ID };
};

const buildHeaders = (config: ReturnType<typeof getAIConfig>) => {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };
  if (config.token) { h['X-Z-AI-From'] = 'Z'; h['X-Token'] = config.token; if (config.chatId) h['X-Chat-Id'] = config.chatId; if (config.userId) h['X-User-Id'] = config.userId; }
  return h;
};

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i <= maxRetries; i++) {
    const r = await fetch(url, options);
    if (r.status === 429 && i < maxRetries) { await new Promise(res => setTimeout(res, Math.pow(2, i + 1) * 1000)); continue; }
    return r;
  }
  throw new Error('Max retries exceeded');
}

export async function POST(req: NextRequest) {
  try {
    const { image, description } = await req.json();
    if (!image && !description) return NextResponse.json({ error: 'Provide a photo or description' }, { status: 400 });

    const prompt = `You are a certified nutritionist. Analyze this food and return ONLY valid JSON (no markdown fences):
{"foodName":"name","servingSize":"size","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"sodium":0,"calcium":0,"iron":0,"magnesium":0,"potassium":0,"zinc":0,"phosphorus":0,"vitaminA":0,"vitaminC":0,"vitaminD":0,"vitaminB12":0,"confidence":"high/medium/low","notes":"reasoning"}
Units: kcal, grams, mg for minerals, mcg for vitamins (except C in mg). Use USDA values. Think step by step.
 ${description ? `FOOD DESCRIPTION: ${description}` : 'FOOD: Analyze the food in the image.'}`;

    const config = getAIConfig();
    const headers = buildHeaders(config);
    const internal = config.baseUrl.includes('internal-api');
    let result: any;

    if (image) {
      const url = `${config.baseUrl}/chat/completions`;
      const res = await fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify({ model: internal ? 'glm-4v-flash' : 'glm-4.6v-flash', messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: image } }, { type: 'text', text: prompt }] }] }) });
      if (!res.ok) { const t = await res.text(); throw new Error(res.status === 429 ? 'AI busy, try again.' : `Vision failed (${res.status}): ${t}`); }
      result = await res.json();
    } else {
      const url = `${config.baseUrl}/chat/completions`;
      const res = await fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify({ model: internal ? 'glm-4-flash' : 'glm-4.7-flash', messages: [{ role: 'user', content: prompt }] }) });
      if (!res.ok) { const t = await res.text(); throw new Error(res.status === 429 ? 'AI busy, try again.' : `Chat failed (${res.status}): ${t}`); }
      result = await res.json();
    }

    const text = result.choices?.[0]?.message?.content || '';
    let data: any;
    try { data = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) data = JSON.parse(m[0]); else return NextResponse.json({ error: 'Parse failed', raw: text }, { status: 500 }); }

    const s = { foodName: String(data.foodName||'Unknown'), servingSize: String(data.servingSize||'1 serving'), calories: Number(data.calories)||0, protein: Number(data.protein)||0, carbs: Number(data.carbs)||0, fat: Number(data.fat)||0, fiber: Number(data.fiber)||0, sugar: Number(data.sugar)||0, sodium: Number(data.sodium)||0, calcium: Number(data.calcium)||0, iron: Number(data.iron)||0, magnesium: Number(data.magnesium)||0, potassium: Number(data.potassium)||0, zinc: Number(data.zinc)||0, phosphorus: Number(data.phosphorus)||0, vitaminA: Number(data.vitaminA)||0, vitaminC: Number(data.vitaminC)||0, vitaminD: Number(data.vitaminD)||0, vitaminB12: Number(data.vitaminB12)||0, confidence: String(data.confidence||'medium'), notes: String(data.notes||'') };
    return NextResponse.json({ success: true, data: s });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Failed'; return NextResponse.json({ error: msg }, { status: 500 }); }
}
