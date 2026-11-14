// Multilingual HealthBot Engine (Offline-First with Voice & Regional Dialects)
import testsDB from "../data/tests.json";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English", voiceLang: "en-IN" },
  { code: "hi", label: "Hindi", native: "हिंदी", voiceLang: "hi-IN" },
  { code: "bn", label: "Bengali", native: "বাংলা", voiceLang: "bn-IN" },
  { code: "ta", label: "Tamil", native: "தமிழ்", voiceLang: "ta-IN" },
  { code: "te", label: "Telugu", native: "తెలుగు", voiceLang: "te-IN" },
  { code: "mr", label: "Marathi", native: "मराठी", voiceLang: "mr-IN" },
];

export const BOT_TRANSLATIONS = {
  en: {
    greeting: "Hello! I am MediSync AI, your versatile conversational assistant and clinical report guide. I can answer any questions you have—from general knowledge, science, and coding to analyzing your lab reports and health markers. How can I help you today?",
    noReport: "No lab report has been uploaded yet. You can ask me any question (general, scientific, or medical), or upload a PDF report on the Diagnostic Report page for personal lab analysis.",
    allNormal: "Great news! All your analyzed test results are within normal clinical ranges. Keep maintaining your healthy lifestyle and routine checkups.",
    urgentIntro: "The following markers require medical attention because they show significant deviation from reference ranges:",
    doctorIntro: "Here are priority questions tailored to your report that you can ask your physician during your next visit:",
    riskIntro: "Your calculated Patient Deterioration Risk Score is",
    pointsToDiscuss: "Key points to discuss with your doctor:",
    offlineNotice: "⚡ Connected to AI Engine (OpenRouter) • General & Clinical Intelligence",
    offlineNoticeFallback: "⚠️ Operating in Offline Mode. Responses synthesized using local medical library.",
    samplePrompts: [
      "Explain artificial intelligence",
      "Which tests need attention?",
      "What is hemoglobin and its normal range?",
      "Explain diabetes in simple language",
      "Write a Python program to reverse a string",
      "What is the difference between Java and C++?"
    ]
  },
  hi: {
    greeting: "नमस्ते! मैं मेडीसिंक एआई (MediSync AI) हूँ। मैं आपके किसी भी सवाल का जवाब दे सकता हूँ—सामान्य ज्ञान, विज्ञान, कोडिंग से लेकर आपकी लैब रिपोर्ट और स्वास्थ्य परीक्षणों के विश्लेषण तक। आज मैं आपकी क्या सहायता करूँ?",
    noReport: "अभी तक कोई लैब रिपोर्ट लोड नहीं हुई है। फिर भी आप मुझसे कोई भी सामान्य या मेडिकल सवाल पूछ सकते हैं, या डायग्नोस्टिक रिपोर्ट पेज पर पीडीएफ अपलोड कर सकते हैं।",
    allNormal: "शानदार! आपकी रिपोर्ट के सभी टेस्ट सामान्य सीमा (Normal Range) के अंदर हैं। अपनी स्वस्थ दिनचर्या और नियमित जांच जारी रखें।",
    urgentIntro: "आपकी रिपोर्ट में निम्नलिखित टेस्टों पर तुरंत ध्यान देने की आवश्यकता है क्योंकि ये सामान्य सीमा से काफी बाहर हैं:",
    doctorIntro: "आपकी रिपोर्ट के आधार पर अपने डॉक्टर से परामर्श के लिए महत्वपूर्ण सवाल:",
    riskIntro: "आपका अनुमानित पेशेंट डिटेरिओरेशन रिस्क स्कोर है",
    pointsToDiscuss: "डॉक्टर के साथ चर्चा करने योग्य बिंदु:",
    offlineNotice: "⚡ एआई इंजन से कनेक्टेड (OpenRouter) • बहुउद्देशीय एवं क्लिनिकल सहायक",
    offlineNoticeFallback: "⚠️ ऑफ़लाइन क्लिनिकल मोड सक्रिय। इंटरनेट के बिना सुरक्षित स्थानीय लाइब्रेरी से उत्तर।",
    samplePrompts: [
      "आर्टिफिशियल इंटेलिजेंस क्या है?",
      "किन टेस्टों पर ध्यान देना चाहिए?",
      "हीमोग्लोबिन की सामान्य सीमा क्या है?",
      "डायबिटीज को आसान भाषा में समझाइए",
      "जावा और सी++ में क्या अंतर है?",
      "डॉक्टर से क्या पूछना चाहिए?"
    ]
  },
  bn: {
    greeting: "নমস্কার! আমি আপনার এআই স্বাস্থ্য সহায়ক। আমি আপনার ল্যাব রিপোর্টের ফলাফল এবং স্বাস্থ্য সম্পর্কিত প্রশ্নের উত্তর আপনার ভাষায় দিতে পারি। আমি কীভাবে আপনাকে সাহায্য করতে পারি?",
    noReport: "এখনও কোনও ল্যাব রিপোর্ট আপলোড করা হয়নি। আপনি যে কোনও রক্ত পরীক্ষা (যেমন হিমোগ্লোবিন, সুগার, কোলেস্টেরল) সম্পর্কে জিজ্ঞাসা করতে পারেন।",
    allNormal: "শুভ সংবাদ! আপনার সমস্ত পরীক্ষার ফলাফল স্বাভাবিক সীমার মধ্যে রয়েছে।",
    urgentIntro: "আপনার রিপোর্টের নিম্নলিখিত পরীক্ষাগুলির দিকে অবিলম্বে মনোযোগ দেওয়া প্রয়োজন:",
    doctorIntro: "আপনার ডাক্তারের সাথে পরামর্শ করার জন্য গুরুত্বপূর্ণ প্রশ্নাবলী:",
    riskIntro: "আপনার রোগীর অবনতি ঝুঁকি স্কোর হলো",
    pointsToDiscuss: "ডাক্তারের সাথে আলোচনার বিষয়:",
    offlineNotice: "⚡ অফলাইন ক্লিনিক্যাল মোড সক্রিয়।",
    samplePrompts: [
      "কোন কোন টেস্টে সমস্যা আছে?",
      "ডাক্তারকে কী কী প্রশ্ন করব?",
      "আমার হিমোগ্লোবিন কি স্বাভাবিক?",
      "ব্লাড সুগারের মাত্রা ব্যাখ্যা করুন"
    ]
  },
  ta: {
    greeting: "வணக்கம்! நான் உங்கள் மருத்துவ AI உதவியாளர். உங்கள் ஆய்வக அறிக்கை முடிவுகள் மற்றும் சுகாதாரக் கேள்விகளுக்கு உங்கள் மொழியில் பதிலளிக்க முடியும். இன்று உங்களுக்கு நான் எவ்வாறு உதவ வேண்டும்?",
    noReport: "இன்னும் ஆய்வக அறிக்கை பதிவேற்றப்படவில்லை. ஹீமோகுளோபின், சர்க்கரை அளவு, கொலஸ்ட்ரால் போன்ற எந்த இரத்த பரிசோதனை பற்றியும் நீங்கள் கேட்கலாம்.",
    allNormal: "நல்ல செய்தி! உங்கள் அனைத்து சோதனை முடிவுகளும் சாதாரண வரம்பிற்குள் உள்ளன.",
    urgentIntro: "உங்கள் அறிக்கையில் பின்வரும் சோதனைகளில் சிறப்பு கவனம் தேவைப்படுகிறது:",
    doctorIntro: "உங்கள் மருத்துவரிடம் கேட்க வேண்டிய முக்கியமான கேள்விகள்:",
    riskIntro: "உங்கள் உடல்நல பாதிப்பு அபாய மதிப்பீடு",
    pointsToDiscuss: "மருத்துவருடன் விவாதிக்க வேண்டியவை:",
    offlineNotice: "⚡ ஆஃப்லைன் மருத்துவ பயன்முறை செயல்படுகிறது.",
    samplePrompts: [
      "எந்த சோதனைகளில் கவனம் செலுத்த வேண்டும்?",
      "மருத்துவரிடம் என்ன கேட்க வேண்டும்?",
      "ஹீமோகுளோபின் அளவு சரியாக உள்ளதா?"
    ]
  },
  te: {
    greeting: "నమస్కారం! నేను మీ AI ఆరోగ్య సహాయకుడిని. మీ రక్త పరీక్ష నివేదికలు మరియు ఆరోగ్య సందేహాలకు మీ భాషలోనే సమాధానం ఇవ్వగలను. నేను మీకు ఎలా సహాయపడగలను?",
    noReport: "ఇంకా ల్యాబ్ రిపోర్ట్ అప్‌లోడ్ కాలేదు. మీరు హిమోగ్లోబిన్, షుగర్, కొలెస్ట్రాల్ వంటి పరీక్షల గురించి ఎప్పుడైనా నన్ను అడగవచ్చు.",
    allNormal: "శుభవార్త! మీ పరీక్ష ఫలితాలన్నీ సాధారణ పరిమితిలోనే ఉన్నాయి.",
    urgentIntro: "మీ రిపోర్టులో ఈ క్రింది పరీక్షలపై ప్రత్యేక శ్రద్ధ వహించాలి:",
    doctorIntro: "వైద్యుడిని సంప్రదించేటప్పుడు అడగవలసిన ముఖ్యమైన ప్రశ్నలు:",
    riskIntro: "మీ ఆరోగ్య క్షీణత రిస్క్ స్కోరు",
    pointsToDiscuss: "డాక్టర్‌తో చర్చించాల్సిన అంశాలు:",
    offlineNotice: "⚡ ఆఫ్‌లైన్ మెడికల్ మోడ్ ప్రారంభించబడింది.",
    samplePrompts: [
      "ఏ పరీక్షలలో సమస్య ఉంది?",
      "డాక్టర్‌ను ఏమి అడగాలి?",
      "నా హిమోగ్లోబిన్ సాధారణంగా ఉందా?"
    ]
  },
  mr: {
    greeting: "नमस्कार! मी तुमचा AI आरोग्य सहाय्यक आहे. मी तुमच्या लॅब रिपोर्टचे निकाल आणि आरोग्याविषयीच्या प्रश्नांची उत्तरे तुमच्या भाषेत देऊ शकतो. मी तुम्हाला कशी मदत करू शकतो?",
    noReport: "अद्याप कोणताही लॅब रिपोर्ट अपलोड केलेला नाही. तरीही तुम्ही मला हिमोग्लोबिन, साखर, थायरॉईड किंवा इतर रक्त चाचण्यांबद्दल विचारू शकता.",
    allNormal: "आनंदाची बातमी! तुमचे सर्व चाचणी निकाल सामान्य मर्यादेत आहेत.",
    urgentIntro: "तुमच्या अहवालातील खालील चाचण्यांवर विशेष लक्ष देणे आवश्यक आहे:",
    doctorIntro: "तुमच्या डॉक्टरांना विचारण्यासाठी महत्त्वाचे प्रश्न:",
    riskIntro: "तुमचा रुग्ण बिघाड धोका निर्देशांक आहे",
    pointsToDiscuss: "डॉक्टरांशी चर्चा करण्याचे मुद्दे:",
    offlineNotice: "⚡ ऑफलाइन क्लिनिकल मोड सक्रिय आहे.",
    samplePrompts: [
      "कोणत्या चाचण्यांवर लक्ष देणे गरजेचे आहे?",
      "डॉक्टरांना काय विचारले पाहिजे?",
      "हिमोग्लोबिन सामान्य आहे का?"
    ]
  }
};

/**
 * Intelligent Offline Healthcare Query Processor
 * Evaluates patient question against currently loaded lab report + offline test library
 */
export function processHealthQuery(query, results = [], lang = "en") {
  const q = query.trim().toLowerCase();
  const tr = BOT_TRANSLATIONS[lang] || BOT_TRANSLATIONS.en;

  // 0. Conversational Greetings
  if (
    q === "hello" || q === "hi" || q === "hey" || q === "namaste" ||
    q.startsWith("hello ") || q.startsWith("hi ") || q.startsWith("hey ") ||
    q.includes("how are you") || q.includes("kaise ho") || q.includes("namaskar") ||
    q.includes("नमस्ते") || q.includes("हैलो") || q.includes("हाय")
  ) {
    return lang === "hi"
      ? "नमस्ते! मैं मेडीसिंक एआई (MediSync AI) हूँ। मैं आपके किसी भी सवाल का जवाब दे सकता हूँ—चाहे वह सामान्य ज्ञान, विज्ञान, कोडिंग हो या आपकी लैब रिपोर्ट और मेडिकल टेस्ट्स का विश्लेषण। मैं आपकी क्या मदद करूँ?"
      : "Hello! I am MediSync AI. I can answer any questions you have—from general knowledge, science, and programming to detailed explanations of your lab test reports and clinical markers. How can I help you today?";
  }

  // 1. Attention / Urgent Tests Query
  if (
    q.includes("attention") || q.includes("urgent") || q.includes("abnormal") ||
    q.includes("dhyan") || q.includes("samasya") || q.includes("kharab") ||
    q.includes("problem") || q.includes("high") || q.includes("low") ||
    q.includes("ध्यान") || q.includes("समस्या") || q.includes("गंभीर") || q.includes("खराब")
  ) {
    if (results.length === 0) return tr.noReport;
    const abnormal = results.filter((r) => r.status !== "normal");
    if (abnormal.length === 0) return tr.allNormal;

    let response = `${tr.urgentIntro}\n\n`;
    abnormal.forEach((r, idx) => {
      const dev = r.deviation ? `(+${r.deviation}%)` : "";
      response += `${idx + 1}. **${r.test.name}**: ${r.value} ${r.test.unit} — Status: *${r.status.toUpperCase()}* ${dev}\n`;
      response += `   • Reference Range: ${r.low} - ${r.high} ${r.test.unit}\n`;
      if (r.test.what) response += `   • Function: ${r.test.what}\n`;
      if (r.status === "high" && r.test.whyHigh) response += `   • Why High: ${r.test.whyHigh}\n`;
      if (r.status === "low" && r.test.whyLow) response += `   • Why Low: ${r.test.whyLow}\n`;
      response += `\n`;
    });
    return response;
  }

  // 2. Doctor Questions Query
  if (
    q.includes("doctor") || q.includes("question") || q.includes("ask") ||
    q.includes("puch") || q.includes("डॉक्टर") || q.includes("सवाल") ||
    q.includes("प्रश्न") || q.includes("மருத்துவர்") || q.includes("డాక్టర్")
  ) {
    if (results.length === 0) {
      return "Here are general questions to prepare for your doctor visit:\n1. What do these test markers mean for my current symptoms?\n2. Are dietary changes or lifestyle modifications needed?\n3. When should I get a follow-up or repeat screening?";
    }
    const questions = [];
    results.forEach((r) => {
      if (r.status !== "normal" && r.test.questions) {
        questions.push(...r.test.questions);
      }
    });

    if (questions.length === 0) {
      return "Your test markers are generally in range. General follow-up questions:\n1. Are there any preventive lifestyle adjustments recommended for my age?\n2. When should my next annual routine blood screening be scheduled?";
    }

    const uniqueQ = Array.from(new Set(questions)).slice(0, 5);
    let response = `${tr.doctorIntro}\n\n`;
    uniqueQ.forEach((question, i) => {
      response += `${i + 1}. ${question}\n`;
    });
    return response;
  }

  // 3. Risk / Deterioration Query
  if (q.includes("risk") || q.includes("score") || q.includes("khatra") || q.includes("खतरा") || q.includes("धोका")) {
    if (results.length === 0) return tr.noReport;
    const abnormal = results.filter((r) => r.status !== "normal");
    const urgent = results.filter((r) => r.needsAttention);
    return `${tr.riskIntro}: **${abnormal.length > 3 ? "Elevated" : "Guarded"}**.\n\n• ${results.length} total tests analyzed\n• ${abnormal.length} markers out of range\n• ${urgent.length} markers requiring priority consultation.\n\nPlease visit the **Deterioration AI** tab to view your complete organ system matrix and early warning triggers.`;
  }

  // 4. Specific Marker Lookup (match against results first, then tests.json)
  const matchedInResults = results.find((r) => {
    const nameMatch = r.test.name.toLowerCase().includes(q) || q.includes(r.test.name.toLowerCase());
    const aliasMatch = r.test.aliases?.some((a) => q.includes(a.toLowerCase()));
    return nameMatch || aliasMatch;
  });

  if (matchedInResults) {
    const r = matchedInResults;
    let resp = `### 📊 ${r.test.name} Result\n`;
    resp += `• **Your Level**: **${r.value} ${r.test.unit}**\n`;
    resp += `• **Reference Standard**: ${r.low} – ${r.high} ${r.test.unit}\n`;
    resp += `• **Clinical Status**: **${r.status.toUpperCase()}** ${r.deviation ? `(${r.deviation}% deviation)` : ""}\n\n`;
    resp += `**What it is:** ${r.test.what}\n\n`;
    if (r.status === "high" && r.test.whyHigh) resp += `**Why it may be elevated:** ${r.test.whyHigh}\n\n`;
    if (r.status === "low" && r.test.whyLow) resp += `**Why it may be low:** ${r.test.whyLow}\n\n`;
    if (r.test.questions?.length > 0) {
      resp += `**Questions to ask:**\n` + r.test.questions.map((qn) => `• ${qn}`).join("\n");
    }
    return resp;
  }

  // Search local offline dictionary in tests.json
  const matchedInDb = testsDB.find((t) => {
    const nameMatch = t.name.toLowerCase().includes(q) || q.includes(t.name.toLowerCase());
    const aliasMatch = t.aliases?.some((a) => q.includes(a.toLowerCase()));
    return nameMatch || aliasMatch;
  });

  if (matchedInDb) {
    const t = matchedInDb;
    let resp = `### 📚 Medical Library: ${t.name}\n`;
    resp += `• **Standard Healthy Range**: ${t.low} – ${t.high} ${t.unit}\n`;
    resp += `• **Biological Role**: ${t.what}\n\n`;
    resp += `• **Causes for High Level**: ${t.whyHigh}\n`;
    resp += `• **Causes for Low Level**: ${t.whyLow}\n\n`;
    if (t.questions?.length > 0) {
      resp += `**Recommended Doctor Questions:**\n` + t.questions.map((qn) => `• ${qn}`).join("\n");
    }
    return resp;
  }

  // 5. Default guidance when running in local offline library mode
  return lang === "hi"
    ? `मैं वर्तमान में स्थानीय मेडिकल लाइब्रेरी मोड में संचालित हो रहा हूँ।\n• किसी भी रक्त परीक्षण (जैसे हीमोग्लोबिन, शुगर, टीएसएच, क्रिएटिनिन, लिपिड प्रोफाइल) के बारे में पूछें।\n• अपनी रिपोर्ट के असामान्य परीक्षण जानने के लिए "किन टेस्टों पर ध्यान देना चाहिए?" पूछें।\n• ओपनराउटर एआई क्लाउड कनेक्ट होते ही आप किसी भी विषय (सामान्य ज्ञान, विज्ञान, कोडिंग) पर प्रश्न पूछ सकते हैं!`
    : `I am currently answering via the offline medical library (covering 70+ lab markers like Hemoglobin, Glucose, Creatinine, TSH, Platelets).\n\n• Ask about any laboratory test or reference ranges\n• Ask "Which tests need attention?" to review uploaded report anomalies\n• When connected to the cloud AI, you can ask ANY question (general knowledge, science, programming, and everyday topics)!`;
}

