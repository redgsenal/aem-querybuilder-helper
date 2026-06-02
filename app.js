'use strict';

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3200;
const AEM_HOST = 'http://localhost:4502';
const AEM_AUTH = Buffer.from('admin:admin').toString('base64');

app.use(express.static(path.join(__dirname, 'public')));

// Proxy GET /query → AEM /bin/querybuilder.json with Basic Auth
app.get('/query', async (req, res) => {
  // Drop empty params before forwarding
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (value !== '') params.set(key, value);
  }

  const aemUrl = `${AEM_HOST}/bin/querybuilder.json?${params.toString()}`;

  try {
    const response = await fetch(aemUrl, {
      headers: { Authorization: `Basic ${AEM_AUTH}` },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: `Could not reach AEM: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`AEM Query Builder UI → http://localhost:${PORT}`);
});
