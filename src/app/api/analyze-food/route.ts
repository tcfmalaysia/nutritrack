import { NextRequest, NextResponse } from 'next/server';

// Read AI API config from environment variables
// For Vercel: use Z AI public API (https://api.z.ai/api/paas/v4)
// For sandbox: use internal API (https://internal-api.z.ai/v1)
const getAIConfig = () => {
  const apiKey = process.env.ZAI_API_KEY;
  const baseUrl = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4';

  if (!apiKey) {
    throw new Error(
      'AI service not configured. Set ZAI_API_KEY env var. Get a key at z.ai > Profile > API Keys.'
    );
  }

  const token = process.env.ZAI_TOKEN;
  const chatId = process.env.ZAI_CHAT_ID;
  const userId = process.env.ZAI_USER_ID;

  return { baseUrl, apiKey, token, chatId, userId };
};

// Build headers for Z AI API requests
const buildHeaders = (config: ReturnType<typeof getAIConfig>) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };

  if (config.token) {
    headers['X-Z-AI-From'] = 'Z';
    headers['X-Token'] = config.token;
    if (config.chatId) headers['X-Chat-Id'] = config.chatId;
    if (config.userId) headers['X-User-Id'] = config.userId;
  }

  return headers;
};

const isInternalAPI = (baseUrl: string) => baseUrl.includes('internal-api');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, description } = body;

    if (!image && !description) {
      return NextResponse.json(
        { error: 'Please provide either a food photo or a description' },
        { status: 400 }
      );
    }

    const prompt = `You are a certified nutritionist and food scientist with expertise in accurate nutritional analysis.

TASK: Analyze the following food and provide a comprehensive nutritional breakdown.

 ${description ? `FOOD DESCRIPTION: ${description}` : 'FOOD: Analyze the food visible in the provided image.'}

ANALYSIS APPROACH (think step by step):
1. IDENTIFY: What specific food(s) are present? List each component separately.
2. ESTIMATE PORTION: For each component, estimate the serving size in grams based on the description or visual cues. Use standard reference portions when uncertain.
3. CALCULATE: For each component, calculate nutrition per the estimated portion using USDA food database reference values.
4. SUM: Add up all components to get totals.
5. CONFIDENCE: Rate your confidence as "high" (common food, clear portion), "medium" (food identified but portion uncertain), or "low" (uncertain identification or portion).
6. NOTES: Briefly explain your reasoning - what assumptions did you make about portion sizes or preparation?

IMPORTANT RULES:
- Use realistic USDA-based values, not generic estimates
- If multiple foods are present, calculate each separately then sum
- For mixed dishes, break into ingredients and estimate each
- If portion size is unclear, assume a STANDARD restaurant portion and note this
- Round all values to 1 decimal place
- For minerals and vitamins, use realistic values based on the food type (e.g., dairy is high in calcium, meat is high in iron, leafy greens are high in magnesium and vitamin K)

Respond ONLY with valid JSON (no markdown, no code fences, no extra text):
{
  "foodName": "descriptive name of the complete meal/food",
  "servingSize": "total estimated serving with breakdown",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "sugar": number,
  "sodium": number,
  "calcium": number,
  "iron": number,
  "magnesium": number,
  "potassium": number,
  "zinc": number,
  "phosphorus": number,
  "vitaminA": number,
  "vitaminC": number,
  "vitaminD": number,
  "vitaminB12": number,
  "confidence": "high" or "medium" or "low",
  "notes": "your reasoning: what foods you identified, portion assumptions, preparation assumptions"
}

Units: calories in kcal, macronutrients in grams, sodium/minerals in mg, vitamins in mcg (except vitamin C in mg).`;

    const config = getAIConfig();
    const headers = buildHeaders(config);
    const internal = isInternalAPI(config.baseUrl);

    let result: any;
    if (image) {
      const url = internal
        ? `${config.baseUrl}/chat/completions/vision`
        : `${config.baseUrl}/chat/completions`;

      const requestBody: any = {
        model: internal ? 'glm-4v-flash' : 'glm-4.7-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: image } },
            { type: 'text', text: prompt }
          ]
        }],
      };
      if (internal) {
        requestBody.thinking = { type: 'enabled' };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vision API failed (${response.status}): ${errorText}`);
      }
      result = await response.json();
    } else {
      const url = `${config.baseUrl}/chat/completions`;

      const requestBody: any = {
        model: internal ? 'glm-4-flash' : 'glm-4.7-flash',
        messages: [{ role: 'user', content: prompt }],
      };
      if (internal) {
        requestBody.thinking = { type: 'enabled' };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chat API failed (${response.status}): ${errorText}`);
      }
      result = await response.json();
    }

    const responseText = result.choices?.[0]?.message?.content || '';

    let nutritionData;
    try {
      nutritionData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        nutritionData = JSON.parse(jsonMatch[1].trim());
      } else {
        const objectMatch = responseText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          nutritionData = JSON.parse(objectMatch[0]);
        } else {
          return NextResponse.json(
            { error: 'Could not parse nutrition data from AI response', raw: responseText },
            { status: 500 }
          );
        }
      }
    }

    const sanitized = {
      foodName: String(nutritionData.foodName || 'Unknown Food'),
      servingSize: String(nutritionData.servingSize || '1 serving'),
      calories: Number(nutritionData.calories) || 0,
      protein: Number(nutritionData.protein) || 0,
      carbs: Number(nutritionData.carbs) || 0,
      fat: Number(nutritionData.fat) || 0,
      fiber: Number(nutritionData.fiber) || 0,
      sugar: Number(nutritionData.sugar) || 0,
      sodium: Number(nutritionData.sodium) || 0,
      calcium: Number(nutritionData.calcium) || 0,
      iron: Number(nutritionData.iron) || 0,
      magnesium: Number(nutritionData.magnesium) || 0,
      potassium: Number(nutritionData.potassium) || 0,
      zinc: Number(nutritionData.zinc) || 0,
      phosphorus: Number(nutritionData.phosphorus) || 0,
      vitaminA: Number(nutritionData.vitaminA) || 0,
      vitaminC: Number(nutritionData.vitaminC) || 0,
      vitaminD: Number(nutritionData.vitaminD) || 0,
      vitaminB12: Number(nutritionData.vitaminB12) || 0,
      confidence: String(nutritionData.confidence || 'medium'),
      notes: String(nutritionData.notes || ''),
    };

    return NextResponse.json({ success: true, data: sanitized });
  } catch (error: unknown) {
    console.error('Food analysis error:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze food';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
