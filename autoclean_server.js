// AutoClean Backend — handles ONLY license key storage & verification
// Uses Supabase as a permanent database so keys survive server restarts.

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.options('*', cors());
app.use(express.json());

// Supabase project details (safe to keep URL/anon key here — anon key is public-facing by design)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

app.get('/', (req, res) => {
  res.send('AutoClean backend is running.');
});

// Save a license key after successful payment
app.post('/save-license', async (req, res) => {
  try {
    const { key, email, name, paymentId } = req.body;
    if (!key) return res.status(400).json({ error: 'no_key' });

    const response = await fetch(`${SUPABASE_URL}/rest/v1/licenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([{ key: key.trim(), email, name, payment_id: paymentId }]),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Supabase save error:', errText);
      return res.status(500).json({ error: 'save_failed' });
    }

    console.log(`License saved: ${key} for ${email}`);
    res.json({ saved: true });
  } catch (e) {
    console.error('save-license error', e);
    res.status(500).json({ error: 'save_failed' });
  }
});

// Verify a license key
app.post('/verify-license', async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.json({ valid: false });

    // Check env-based test keys first (quick manual keys you can add in Render)
    const envKeys = (process.env.AUTOCLEAN_LICENSES || '').split(',').map(k => k.trim()).filter(Boolean);
    if (envKeys.includes(key.trim())) {
      return res.json({ valid: true });
    }

    // Check Supabase database
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/licenses?key=eq.${encodeURIComponent(key.trim())}&select=key`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const data = await response.json();
    const valid = Array.isArray(data) && data.length > 0;
    console.log(`License check: ${key} -> ${valid}`);
    res.json({ valid });
  } catch (e) {
    console.error('verify-license error', e);
    res.status(500).json({ valid: false, error: 'verify_failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AutoClean backend listening on port ${PORT}`));
