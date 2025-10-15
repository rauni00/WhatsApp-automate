const { Client } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { GoogleGenAI } = require("@google/genai");
const cron = require("node-cron");
require("dotenv").config();

const port = process.env.PORT || 8080;

if (!process.env.API_KEY) {
  console.error("❌ Missing API_KEY in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelId = "gemini-2.0-flash-001";
const client = new Client();

// ✅ List of recipients
const recipients = [
  { number: "918470082791", name: "Kiran" },
  { number: "918423995465", name: "Mummy" },
  { number: "919984431881", name: "Papa" },
  { number: "919125667006", name: "Prince bhaiya" },
  { number: "919936808645", name: "Pritam bhaiya" },
  { number: "918115689808", name: "Annu bhabhi" },
];

// ✅ Generate Motivation + Good Morning Message
async function generateMorningMessage(name) {
  const prompt = `
      ${name} के लिए एक प्यारा सा गुड मॉर्निंग संदेश लिखो (हिंदी में), शुरुआत में "🌞" जैसे आइकॉन का उपयोग करो और इसे दिल से, पॉज़िटिव और थोड़ा पर्सनल बनाओ।
फिर नीचे एक मोटिवेशनल लाइन लिखो (बिना किसी टाइटल के), जिसमें "🔥" जैसा आइकॉन हो और जो दिन की शुरुआत के लिए प्रेरित करे।
पूरी बात 40-50 शब्दों के अंदर रखें।
`;

  const contents = [
    {
      role: "user",
      parts: [{ type: "text", text: prompt }],
    },
  ];

  const result = await ai.models.generateContent({
    model: modelId,
    contents,
  });

  return (
    result?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Good Morning! Have a wonderful day! ☀️"
  );
}

// ✅ WhatsApp Ready
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("✅ WhatsApp Client is ready!");

  // ✅ Schedule at 7:00 AM every day (24h format)
  cron.schedule("0 7 * * *", async () => {
    console.log("⏰ Sending Morning Messages...");

    for (const user of recipients) {
      const message = await generateMorningMessage(user.name);
      await client.sendMessage(`${user.number}@c.us`, message);
    }
  });

  console.log("✅ Scheduler is set for 7:00 AM daily!");
});

client.initialize();
