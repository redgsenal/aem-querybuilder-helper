'use strict';

const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = 3200;

const DOMAINS = {
  local: {
    host: 'http://localhost:4502',
    auth: Buffer.from('admin:admin').toString('base64'),
  },
  sit1: {
    host: 'https://author-p93552-e850488.adobeaemcloud.com',
    auth: Buffer.from('zip-rssenal@bpi.com.ph:bvwR2LrJ4K.-pLm').toString('base64'),
  },
};

app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

// Proxy GET /query → AEM /bin/querybuilder.json with Basic Auth
app.get('/query', async (req, res) => {
  const domainKey = req.query._domain && DOMAINS[req.query._domain] ? req.query._domain : 'local';
  const { host, auth } = DOMAINS[domainKey];

  // Drop internal and empty params before forwarding
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === '_domain' || value === '') continue;
    params.set(key, value);
  }

  const aemUrl = `${host}/bin/querybuilder.json?${params.toString()}`;

  try {
    const response = await fetch(aemUrl, {
      headers: { Authorization: `Basic ${auth}` },
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
