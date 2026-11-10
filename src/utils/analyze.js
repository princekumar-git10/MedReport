// src/analyze.js

// 1. Synchronous baseline math (keeps your original calculation)
export function calculateRangeStatus(item) {
  let status = "normal";
  if (item.value < item.low) status = "low";
  else if (item.value > item.high) status = "high";

  let deviation = 0;
  if (status === "low") deviation = ((item.low - item.value) / item.low) * 100;
  if (status === "high") deviation = ((item.value - item.high) / item.high) * 100;

  const needsAttention = deviation > 25;

  return {
    ...item,
    status,
    deviation: Math.round(deviation),
    needsAttention
  };
}

// 2. Asynchronous OpenRouter API call for clinical explanation
export async function fetchAIExplanation(item) {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn("OpenRouter API key missing. Falling back to local data.");
    return {
      what: item.what || "No description available.",
      interpretation: item.status === "high" ? item.whyHigh : item.whyLow || "Values within standard limits.",
      questions: item.questions || []
    };
  }

  const prompt = `
Analyze this laboratory blood marker:
- Test: ${item.name}
- Value: ${item.value} ${item.unit}
- Reference Range: ${item.low} - ${item.high} ${item.unit}
- Calculated Status: ${item.status} (${item.deviation}% deviation)

Return strictly valid JSON with no markdown wrapping matching this exact structure:
{
  "what": "1 sentence explaining what this marker does in plain patient-friendly language.",
  "interpretation": "1-2 sentences on what this specific level (${item.status}) could be associated with.",
  "questions": [
    "Question 1 to ask the doctor",
    "Question 2 to ask the doctor"
  ]
}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Medical Report Explainer"
      },
      body: JSON.stringify({
        model: "google/gemma-4-26b-a4b-it:free",
        messages: [
          {
            role: "system",
            content: "You are an educational medical lab assistant. Provide objective, patient-friendly information without giving a definitive diagnosis. Output strictly valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned status ${response.status}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return {
      what: parsed.what,
      interpretation: parsed.interpretation,
      questions: parsed.questions || []
    };
  } catch (error) {
    console.error("AI explanation failed:", error);
    // Graceful fallback to your local tests.json values if offline or rate-limited
    return {
      what: item.what || "Standard laboratory parameter.",
      interpretation: item.status === "high" ? item.whyHigh : item.status === "low" ? item.whyLow : "Value is within expected range.",
      questions: item.questions || ["Should this test be rechecked at my next visit?"]
    };
  }
}

// 3. Main combined analyze function
export async function analyze(item) {
  // Compute numbers first
  const computed = calculateRangeStatus(item);

  // Fetch dynamic explanation from OpenRouter
  const aiDetails = await fetchAIExplanation(computed);

  return {
    ...computed,
    what: aiDetails.what,
    explanation: aiDetails.interpretation,
    questions: aiDetails.questions
  };
}