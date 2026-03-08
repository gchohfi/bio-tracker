import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are a medical data extraction assistant. You receive an image of an InBody body composition report. Extract the following fields as JSON. Use null for any field you cannot confidently read. Do NOT guess or hallucinate values.

Return ONLY valid JSON with these exact keys:
{
  "session_date": "YYYY-MM-DD or null",
  "weight_kg": number or null,
  "bmi": number or null,
  "skeletal_muscle_kg": number or null,
  "body_fat_kg": number or null,
  "body_fat_pct": number or null,
  "visceral_fat_level": number or null,
  "total_body_water_l": number or null,
  "ecw_tbw_ratio": number or null,
  "bmr_kcal": number or null,
  "waist_cm": number or null,
  "hip_cm": number or null,
  "waist_hip_ratio": number or null,
  "device_model": "string or null",
  "notes": null
}

Rules:
- Numbers should use dot as decimal separator (e.g. 65.3, not 65,3)
- visceral_fat_level is typically 1-20 integer
- ecw_tbw_ratio is typically 0.30-0.45
- body_fat_pct is a percentage like 23.0
- If body fat mass appears in kg, put in body_fat_kg. If as %, put in body_fat_pct.
- For date, look for test date, exam date or similar. Convert DD/MM/YYYY to YYYY-MM-DD.
- For device_model, look for "InBody" followed by a model number.
- Only return the JSON object, no markdown fences.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const dataUrl = `data:${mimeType || "image/png"};base64,${imageBase64}`;

    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: "Extract all body composition data from this InBody report image. Return only the JSON object.",
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Lovable AI error:", errText);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from response (strip markdown fences if present)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    }

    const parsed = JSON.parse(jsonStr);

    // Sanity guards matching client-side parser
    if (parsed.weight_kg !== null && (parsed.weight_kg < 20 || parsed.weight_kg > 300)) parsed.weight_kg = null;
    if (parsed.bmi !== null && (parsed.bmi < 10 || parsed.bmi > 70)) parsed.bmi = null;
    if (parsed.body_fat_pct !== null && (parsed.body_fat_pct < 1 || parsed.body_fat_pct > 70)) parsed.body_fat_pct = null;
    if (parsed.visceral_fat_level !== null && (parsed.visceral_fat_level < 1 || parsed.visceral_fat_level > 30)) parsed.visceral_fat_level = null;
    if (parsed.ecw_tbw_ratio !== null && (parsed.ecw_tbw_ratio < 0.2 || parsed.ecw_tbw_ratio > 0.6)) parsed.ecw_tbw_ratio = null;
    if (parsed.bmr_kcal !== null && (parsed.bmr_kcal < 500 || parsed.bmr_kcal > 5000)) parsed.bmr_kcal = null;

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("parse-inbody-ocr error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
