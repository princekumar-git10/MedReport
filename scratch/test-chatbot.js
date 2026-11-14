import fs from "fs";
import path from "path";
import handler from "../api/chat.js";

// Load OPENROUTER_API_KEY from .env.local
const envLocal = fs.readFileSync(".env.local", "utf8");
const match = envLocal.match(/OPENROUTER_API_KEY=(.+)/);
if (!match) {
  console.error("Missing OPENROUTER_API_KEY in .env.local");
  process.exit(1);
}
process.env.OPENROUTER_API_KEY = match[1].trim();

// Mock req and res helper
function mockReqRes(body) {
  let statusCode = 200;
  let headers = {};
  let responseData = null;

  const req = {
    method: "POST",
    body,
    headers: {}
  };

  const res = {
    setHeader(k, v) { headers[k] = v; },
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    writeHead(code, h) {
      statusCode = code;
      Object.assign(headers, h);
    },
    write(chunk) {
      if (!responseData) responseData = "";
      responseData += chunk.toString();
    },
    end() {}
  };

  return { req, res, getResult: () => ({ statusCode, headers, responseData }) };
}

async function testSingleQuery(messages, reportContext = [], language = "en") {
  const { req, res, getResult } = mockReqRes({ messages, reportContext, language, stream: false });
  await handler(req, res);
  return getResult();
}

async function runTestSuite() {
  console.log("===============================================================");
  console.log("MEDISYNC AI CHATBOT VALIDATION TEST SUITE");
  console.log("===============================================================\n");

  const testCases = [
    { id: 1, query: "Hello, how are you?", type: "Greeting / Casual" },
    { id: 2, query: "Explain artificial intelligence.", type: "Science & Technology" },
    { id: 3, query: "What is the difference between Java and C++?", type: "Programming & CS" },
    { id: 4, query: "What is hemoglobin?", type: "Medical Concept" },
    { id: 5, query: "What is its normal range?", type: "Follow-up (Pronoun Resolution)", isFollowUpTo: 4 },
    { id: 6, query: "Explain diabetes in simple language.", type: "Patient Health Explanation" },
    { id: 7, query: "What is the capital of Japan?", type: "General Knowledge (Non-Medical)" },
    { id: 8, query: "Write a Python program to reverse a string.", type: "Coding & Python" },
    { id: 9, query: "Explain the working of the human heart.", type: "Physiology & Anatomy" },
    { id: 10, query: "Can you explain my medical report?", type: "Report Explanation (With Active Context)", hasReportContext: true },
    { id: 11, query: "Why is my creatinine elevated and what does it mean for my kidneys?", type: "Follow-up on Report Context", isFollowUpTo: 10, hasReportContext: true },
    { id: 12, query: "Who was Albert Einstein and what did he discover?", type: "Unrelated Consecutive Question" }
  ];

  const sampleReportContext = [
    { name: "Hemoglobin", value: 11.2, unit: "g/dL", status: "low", low: 13.0, high: 17.0 },
    { name: "Fasting Blood Glucose", value: 142, unit: "mg/dL", status: "high", low: 70, high: 99 },
    { name: "Serum Creatinine", value: 1.8, unit: "mg/dL", status: "high", low: 0.7, high: 1.3 }
  ];

  let conversationHistory = [];
  let passedCount = 0;

  for (const tc of testCases) {
    console.log(`─────────────────────────────────────────────────────────────`);
    console.log(`TEST #${tc.id}: [${tc.type}]`);
    console.log(`USER: "${tc.query}"`);

    // Reset history if not a follow up
    if (!tc.isFollowUpTo) {
      if (tc.id === 12) {
        // Keep previous message to test consecutive unrelated query
      } else if (![5, 11].includes(tc.id)) {
        conversationHistory = [];
      }
    }

    conversationHistory.push({ role: "user", text: tc.query });

    const activeReport = tc.hasReportContext ? sampleReportContext : [];
    const startTime = Date.now();
    const result = await testSingleQuery(conversationHistory, activeReport, "en");
    const elapsed = Date.now() - startTime;

    if (result.statusCode === 200 && result.responseData?.reply) {
      const reply = result.responseData.reply;
      conversationHistory.push({ role: "assistant", text: reply });

      console.log(`STATUS: ✓ 200 OK (${elapsed}ms) [Model: ${result.responseData.model || "default"}]`);
      console.log(`PREVIEW: ${reply.slice(0, 220).replace(/\n/g, " ")}...`);

      // Validation assertions
      let pass = true;
      if (tc.id === 7 && !reply.toLowerCase().includes("tokyo")) {
        console.error("FAIL: Did not mention Tokyo for capital of Japan");
        pass = false;
      }
      if (tc.id === 5 && !reply.toLowerCase().includes("hemoglobin") && !reply.toLowerCase().includes("g/dl")) {
        console.error("FAIL: Follow up failed to resolve 'its' to hemoglobin");
        pass = false;
      }
      if (tc.id === 8 && !reply.includes("def ") && !reply.includes("[::-1]")) {
        console.error("FAIL: Did not provide Python string reverse code");
        pass = false;
      }
      if (tc.id === 10 && !reply.toLowerCase().includes("creatinine") && !reply.toLowerCase().includes("glucose")) {
        console.error("FAIL: Did not reference active report markers");
        pass = false;
      }

      if (pass) {
        console.log(`RESULT: PASS ✓`);
        passedCount++;
      } else {
        console.log(`RESULT: PARTIAL FAIL ✗`);
      }
    } else {
      console.error(`STATUS: ✗ FAILED ${result.statusCode}`, result.responseData);
    }
  }

  console.log(`\n===============================================================`);
  console.log(`TEST SUMMARY: ${passedCount} / ${testCases.length} PASSED`);
  console.log(`===============================================================`);

  if (passedCount === testCases.length) {
    console.log("ALL TESTS COMPLETED SUCCESSFULLY! ✓");
  } else {
    process.exit(1);
  }
}

runTestSuite();

