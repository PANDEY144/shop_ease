require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const Razorpay = require("razorpay");
const { Resend } = require("resend");

const app = express();
const PORT = process.env.PORT || 4000;

// Use the provided Resend API key directly
const resend = new Resend('re_Zv7aZ6Yp_BB54R6Kw6TxWuw4VSZGbxwTm');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use("/admin", express.static(path.join(__dirname, "..", "ADMIN")));

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error("Missing Razorpay credentials in .env");
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

app.post("/api/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body || {};

    if (!amount || Number.isNaN(Number(amount))) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const amountInPaise = Number(amount);
    if (amountInPaise < 100) {
      return res.status(400).json({ error: "Minimum amount is 100 paise" });
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    });

    return res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (error) {
    if (error?.statusCode === 401) {
      return res.status(401).json({ error: "Razorpay authentication failed" });
    }

    return res.status(500).json({
      error: "Failed to create Razorpay order",
      details: error?.error?.description || error?.message,
    });
  }
});

app.post("/api/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing required payment fields" });
  }

  const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(payload)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false, error: "Signature mismatch" });
  }

  return res.json({ success: true, message: "Payment verified successfully" });
});

app.post("/api/send-email", async (req, res) => {
  try {
    const { to, subject, html } = req.body || {};

    if (!to || !subject) {
      return res.status(400).json({ error: "Email 'to' and 'subject' are required" });
    }

    const data = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: to,
      subject: subject,
      html: html || "",
    });

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to send email",
      details: error?.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

