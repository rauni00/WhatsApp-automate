const { Client } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const { GoogleGenAI } = require("@google/genai");
const cron = require("node-cron");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

if (!process.env.API_KEY) {
  console.error("❌ Missing API_KEY in .env");
  process.exit(1);
}

// WhatsApp & AI Setup
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelId = "gemini-2.0-flash-001";
const client = new Client();

// Express Setup
const app = express();
const PORT = process.env.PORT || 8080;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// Store QR and logs
let currentQR = null;
const logs = [];

// Recipients in-memory
let recipients = [
  { number: "918470082791", name: "Kiran" },
  { number: "918423995465", name: "Mummy" },
  { number: "919984431881", name: "Papa" },
  { number: "919125667006", name: "Prince bhaiya" },
  { number: "919936808645", name: "Pritam bhaiya" },
  { number: "918115689808", name: "Annu bhabhi" },
];

// Generate Hindi Morning Message
async function generateMorningMessage(name) {
  const prompt = `
${name} के लिए एक प्यारा सा गुड मॉर्निंग संदेश लिखो (हिंदी में), शुरुआत में "🌞" आइकॉन का उपयोग करो और इसे दिल से, पॉज़िटिव और थोड़ा पर्सनल बनाओ।
फिर नीचे एक मोटिवेशनल लाइन लिखो (बिना किसी टाइटल के), जिसमें "🔥" आइकॉन हो और जो दिन की शुरुआत के लिए प्रेरित करे।
पूरी बात 40-50 शब्दों के अंदर रखें।
`;
  try {
    const contents = [
      { role: "user", parts: [{ type: "text", text: prompt }] },
    ];
    const result = await ai.models.generateContent({
      model: modelId,
      contents,
    });
    return (
      result?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "🌞 सुप्रभात! आज का दिन शानदार रहे। 🔥 मेहनत करने वालों के लिए आसमान भी छोटा पड़ जाता है!"
    );
  } catch (error) {
    logs.push(`❌ AI Error for ${name}: ${error.message}`);
    return "🌞 सुप्रभात! आज का दिन शानदार रहे। 🔥 मेहनत करने वालों के लिए आसमान भी छोटा पड़ जाता है!";
  }
}

// WhatsApp Events
client.on("qr", async (qr) => {
  logs.push("📌 QR Code generated, scan it in WhatsApp Web app");
  currentQR = await qrcode.toDataURL(qr);
});

client.on("ready", () => {
  logs.push("✅ WhatsApp Client is ready!");
  cron.schedule("0 7 * * *", async () => {
    logs.push("⏰ Sending Morning Messages...");
    for (const user of recipients) {
      try {
        const message = await generateMorningMessage(user.name);
        await client.sendMessage(`${user.number}@c.us`, message);
        logs.push(`✅ Message sent to ${user.name} (${user.number})`);
      } catch (error) {
        logs.push(
          `❌ Failed to send message to ${user.name}: ${error.message}`
        );
      }
    }
  });
  logs.push("✅ Daily message scheduler set for 7:00 AM");
});

client.initialize();

// Express Routes

// QR page
app.get("/", (req, res) => {
  res.send(`
    <h1>Scan this QR to authenticate WhatsApp</h1>
    ${
      currentQR
        ? `<img src="${currentQR}" />`
        : "<p>QR code not generated yet</p>"
    }
    <p><a href="/recipients">Go to Recipients Dashboard</a></p>
  `);
});

// Logs page
app.get("/logs", (req, res) => {
  res.send(`
    <h1>Logs</h1>
    <pre style="background:#f5f5f5; padding:10px; height:400px; overflow:auto;">
${logs.join("\n")}
    </pre>
    <br/>
    <a href="/recipients">
      <button style="padding:10px 20px; font-size:16px;">Go to Dashboard</button>
    </a>
  `);
});

// Dashboard: List recipients
app.get("/recipients", (req, res) => {
  res.render("recipients", { recipients });
});

// Add recipient
app.post("/recipients/add", (req, res) => {
  const { name, number } = req.body;
  if (!name || !number) return res.send("Name and number are required");

  if (recipients.find((r) => r.number === number))
    return res.send("Recipient already exists");
  recipients.push({ name, number });
  logs.push(`✅ Added recipient ${name} (${number})`);
  res.redirect("/recipients");
});

// Edit recipient
app.post("/recipients/edit", (req, res) => {
  const { oldNumber, name, number } = req.body;
  const recipient = recipients.find((r) => r.number === oldNumber);
  if (!recipient) return res.send("Recipient not found");

  recipient.name = name;
  recipient.number = number;
  logs.push(`✅ Updated recipient ${name} (${number})`);
  res.redirect("/recipients");
});

// Delete recipient
app.post("/recipients/delete", (req, res) => {
  const { number } = req.body;
  const index = recipients.findIndex((r) => r.number === number);
  if (index !== -1) {
    const removed = recipients.splice(index, 1)[0];
    logs.push(`✅ Removed recipient ${removed.name} (${removed.number})`);
  }
  res.redirect("/recipients");
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
  logs.push(`🌐 Server running at http://localhost:${PORT}`);
});
