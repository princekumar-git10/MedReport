/**
 * Vercel Serverless API Function: /api/translate
 * Translates UI content dynamically using Google Cloud Translation API if configured.
 * Safely falls back to original text if API key is not present.
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { text, targetLang = "en", sourceLang = "en" } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: "Missing 'text' in request body." });
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_CLOUD_TRANSLATION_API_KEY;

  if (!apiKey) {
    // Return original text with notice if Google Translate key is not supplied
    return res.status(200).json({
      translatedText: text,
      source: "dictionary_fallback",
      notice: "Google Cloud Translation API key not set. Using dictionary fallback."
    });
  }

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        source: sourceLang,
        format: "text"
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn("Google Translate error, returning original text:", err);
      return res.status(200).json({ translatedText: text, fallback: true });
    }

    const data = await response.json();
    const translated = data?.data?.translations?.[0]?.translatedText || text;

    return res.status(200).json({
      translatedText: translated,
      detectedSourceLanguage: data?.data?.translations?.[0]?.detectedSourceLanguage || sourceLang
    });
  } catch (e) {
    console.error("Translation server error:", e);
    return res.status(200).json({ translatedText: text, fallback: true });
  }
}

