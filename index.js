const { Client } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const { GoogleGenAI } = require("@google/genai");
const cron = require("node-cron");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
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
let isAuthenticated = false;

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
  const fallbackMessages = [
    "🌞 सुप्रभात! आज का दिन शानदार रहे। 🔥 मेहनत करने वालों के लिए आसमान भी छोटा पड़ जाता है!",
    "🌞 खुशियों से भरा दिन हो! 🔥 आज अपने लक्ष्य की ओर छोटे-छोटे कदम बढ़ाएं!",
    "🌞 शुभ प्रभात! 🔥 अपने सपनों को सच करने के लिए आज एक कदम आगे बढ़ाएँ!",
  ];

  const prompt = `
${name} के लिए एक प्यारा सा गुड मॉर्निंग संदेश लिखो (हिंदी में)। शुरुआत में "🌞" आइकॉन का उपयोग करो। 
इसे दिल से, पॉज़िटिव और थोड़ा पर्सनल बनाओ। 
फिर नीचे एक मोटिवेशनल लाइन लिखो (बिना किसी टाइटल के) जिसमें "🔥" आइकॉन हो और जो दिन की शुरुआत के लिए प्रेरित करे। 
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
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    return (
      text ||
      fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)]
    );
  } catch (error) {
    logs.push(
      `${new Date().toLocaleString()} ❌ AI Error for ${name}: ${error.message}`
    );
    return fallbackMessages[
      Math.floor(Math.random() * fallbackMessages.length)
    ];
  }
}

async function generateGoodNightMessage(name) {
  const fallbackMessages = [
    "🌙 शुभ रात्रि! आराम करें और अच्छे सपने देखें। 🔥 कल का दिन आपके लिए शानदार हो!",
    "🌙 सुप्रभात की तरह, अब रात भी आपके लिए पॉज़िटिव हो। 🔥 सोते समय अपने सपनों को याद करें!",
    "🌙 रात के लिए शुभकामनाएँ! 🔥 कल नई ऊर्जा और उमंग के साथ उठें!",
  ];

  const prompt = `
${name} के लिए एक प्यारा सा गुड नाईट संदेश लिखो (हिंदी में), शुरुआत में "🌙" आइकॉन का उपयोग करो। 
इसे दिल से, पॉज़िटिव और थोड़ा पर्सनल बनाओ। 
फिर नीचे एक मोटिवेशनल लाइन लिखो (बिना किसी टाइटल के) जिसमें "🔥" आइकॉन हो और दिन के अंत के लिए प्रेरित करे। 
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
      fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)]
    );
  } catch (error) {
    logs.push(
      `${new Date().toLocaleString()} ❌ AI Error for ${name} (Good Night): ${
        error.message
      }`
    );
    return fallbackMessages[
      Math.floor(Math.random() * fallbackMessages.length)
    ];
  }
}

// WhatsApp Events
client.on("qr", async (qr) => {
  logs.push("📌 QR Code generated, scan it in WhatsApp Web app");
  currentQR = await qrcode.toDataURL(qr);
  isAuthenticated = false;
});

client.on("ready", () => {
  logs.push("✅ WhatsApp Client is ready!");
  isAuthenticated = true; // hide QR
  currentQR = null; // remove QR from UI
  logs.push("✅ Daily message scheduler set for 7:00 AM");

  // Daily cron
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

  cron.schedule("30 22 * * *", async () => {
    logs.push("⏰ Sending Good Night Messages...");
    for (const user of recipients) {
      try {
        const message = await generateGoodNightMessage(user.name);
        await client.sendMessage(`${user.number}@c.us`, message);
        logs.push(
          `✅ Good Night message sent to ${user.name} (${user.number})`
        );
      } catch (error) {
        logs.push(
          `❌ Failed to send Good Night message to ${user.name}: ${error.message}`
        );
      }
    }
  });
});

client.on("disconnected", (reason) => {
  logs.push(`❌ WhatsApp disconnected: ${reason}. Re-initializing...`);
  client.initialize();
});

// Express Routes

// Session setup
app.use(
  session({
    secret: "ss##$%$#supersecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 },
  })
);

// Hardcoded password (or store in .env)
const AUTH_PASSWORD = "rr8546001170";

// Middleware to protect routes
function isAuthenticatedMiddleware(req, res, next) {
  if (req.session?.authenticated) {
    return next();
  }
  res.redirect("/login");
}

// Login page
app.get("/login", (req, res) => {
  res.send(`
    <h1>Login</h1>
    <form method="POST" action="/login">
      <input type="password" name="password" placeholder="Enter password" required />
      <button type="submit">Login</button>
    </form>
  `);
});

// Handle login
app.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === AUTH_PASSWORD) {
    req.session.authenticated = true;
    return res.redirect("/recipients");
  }
  res.send("❌ Wrong password. <a href='/login'>Try again</a>");
});

app.post("/logout", async (req, res) => {
  try {
    await client.destroy();
    currentQR = null;
    isAuthenticated = false;
    logs.push("❌ Logged out from WhatsApp");
    res.redirect("/");
  } catch (error) {
    logs.push(`❌ Failed to logout WhatsApp: ${error.message}`);
    res.redirect("/recipients");
  }
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// QR page
app.get("/", async (req, res) => {
  // If WhatsApp not authenticated and no QR, re-initialize client
  if (!isAuthenticated && !currentQR) {
    logs.push("🔄 Generating new QR...");
    try {
      await client.initialize(); // trigger QR event
    } catch (err) {
      logs.push(`❌ Error generating QR: ${err.message}`);
    }
  }

  res.send(`
    <h1>Scan this QR to authenticate WhatsApp</h1>
    ${
      currentQR
        ? `<img src="${currentQR}" />`
        : "<p>QR code not generated yet. Please wait a few seconds...</p>"
    }
    <p><a href="/recipients">Go to Recipients Dashboard</a></p>
  `);
});


// Logs page
app.get("/logs", isAuthenticatedMiddleware, (req, res) => {
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
app.get("/recipients", isAuthenticatedMiddleware, (req, res) => {
  res.render("recipients", { recipients, logs, isAuthenticated });
});
// Add recipient
app.post("/recipients/add", isAuthenticatedMiddleware, (req, res) => {
  const { name, number } = req.body;
  if (!name || !number) return res.send("Name and number are required");

  if (recipients.find((r) => r.number === number))
    return res.send("Recipient already exists");
  recipients.push({ name, number });
  logs.push(`✅ Added recipient ${name} (${number})`);
  res.redirect("/recipients");
});

app.post("/send-message", isAuthenticatedMiddleware, async (req, res) => {
  const { number, message } = req.body;
  if (!number) return res.send("Number is required");

  const user = recipients.find((r) => r.number === number);
  if (!user) return res.send("Recipient not found");

  // If no custom message, generate Good Morning
  const msg = message || (await generateMorningMessage(user.name));

  try {
    await client.sendMessage(`${number}@c.us`, msg);
    logs.push(
      `📩 Instant Good Morning message sent to ${user.name} (${number})`
    );
    res.redirect("/recipients");
  } catch (error) {
    logs.push(
      `❌ Failed to send instant message to ${user.name} (${number}): ${error.message}`
    );
    res.redirect("/recipients");
  }
});

// Edit recipient
app.post("/recipients/edit", isAuthenticatedMiddleware, (req, res) => {
  const { oldNumber, name, number } = req.body;
  const recipient = recipients.find((r) => r.number === oldNumber);
  if (!recipient) return res.send("Recipient not found");

  recipient.name = name;
  recipient.number = number;
  logs.push(`✅ Updated recipient ${name} (${number})`);
  res.redirect("/recipients");
});

// Delete recipient
app.post("/recipients/delete", isAuthenticatedMiddleware, (req, res) => {
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
  client.initialize();
});
