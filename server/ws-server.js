import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket, { WebSocketServer } from 'ws';

const PORT = process.env.WS_PORT || 4001;

function heuristicSuggest(inventory = [], salesData = []) {
  const suggestions = [];
  inventory.forEach(item => {
    const estDaily = (item.parLevel || 10) * 0.12;
    const days = estDaily > 0 ? Math.floor(item.currentStock / estDaily) : 999;
    if (days <= 7) {
      const qty = Math.max(1, Math.ceil((item.parLevel - item.currentStock) * 1.0));
      suggestions.push({
        itemId: item.id,
        itemName: item.name,
        currentStock: item.currentStock,
        parLevel: item.parLevel,
        suggestedQuantity: qty,
        unitCost: item.unitCost || 0,
        totalCost: qty * (item.unitCost || 0),
        supplier: item.supplier || 'Unknown',
        unit: item.unit || 'ea',
        priority: days <= 2 ? 'critical' : days <= 4 ? 'high' : 'medium',
        reasoning: `Heuristic: estimated ${days} days until stockout`,
        daysUntilStockout: days,
        confidence: 0.6
      });
    }
  });
  return suggestions;
}

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs JSON arrays of order suggestions when given inventory and sales data.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 800
    })
  });
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text;
  return text;
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

function sendJSON(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS,GET',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(obj));
}

// Simple JSON body parser for POST /scan
function collectRequestData(request, callback) {
  const ct = request.headers['content-type'] || '';
  if (ct.includes('application/json')) {
    let body = '';
    request.on('data', chunk => { body += chunk.toString(); });
    request.on('end', () => {
      try { callback(null, JSON.parse(body)); }
      catch (e) { callback(e); }
    });
  } else {
    callback(new Error('Unsupported content-type'));
  }
}

// Tesseract OCR for image dataURL
import Tesseract from 'tesseract.js';

server.on('request', (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS,GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/scan') {
    collectRequestData(req, async (err, data) => {
      if (err) {
        sendJSON(res, 400, { error: 'Invalid request' });
        return;
      }

      const { imageData } = data || {};
      if (!imageData) {
        sendJSON(res, 400, { error: 'Missing imageData' });
        return;
      }

      try {
        // run tesseract on data URL
        const base64 = imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const buffer = Buffer.from(base64, 'base64');

        const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: m => {} });

        // If OpenAI key present, ask it to parse text into structured recipe
        if (process.env.OPENAI_API_KEY) {
          const prompt = `Extract recipe fields from the following text. Return JSON with keys: menuItemName, category, price, ingredients (array of strings). Text:\n\n${text}`;
          try {
            const aiRes = await callOpenAI(prompt);
            let parsed = null;
            try { parsed = JSON.parse(aiRes); } catch (e) { parsed = null; }
            if (parsed && parsed.ingredients) {
              sendJSON(res, 200, parsed);
              return;
            }
          } catch (e) {
            console.error('OpenAI parse failed', e);
          }
        }

        // Fallback parsing: split lines and attempt to detect price and title
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const menuItemName = lines[0] || 'Scanned Recipe';
        let price = '';
        const ingredients = lines.filter(l => /\d/.test(l) || /tbsp|tsp|oz|lb|g|kg|cup|slice|clove/i.test(l));
        // try to find price-like token
        for (const l of lines.slice(0, 5)) {
          const m = l.match(/\$?([0-9]+\.?[0-9]{0,2})/);
          if (m) { price = m[1]; break; }
        }

        sendJSON(res, 200, { menuItemName, category: 'Uncategorized', price: price || '0.00', ingredients });
      } catch (err) {
        console.error('OCR error', err);
        sendJSON(res, 500, { error: 'OCR failed' });
      }
    });
    return;
  }

  // Serve OpenAPI YAML
  if (req.method === 'GET' && req.url === '/openapi.yaml') {
    const file = path.resolve(process.cwd(), 'openapi.yaml');
    if (fs.existsSync(file)) {
      const yaml = fs.readFileSync(file, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/yaml', 'Access-Control-Allow-Origin': '*' });
      res.end(yaml);
      return;
    }
    sendJSON(res, 404, { error: 'openapi.yaml not found' });
    return;
  }

  // Serve Swagger UI
  if (req.method === 'GET' && req.url === '/docs') {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ZestIQ API Docs</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-bundle.min.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.yaml',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout'
      });
    </script>
  </body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    res.end(html);
    return;
  }

  if (req.method === 'POST' && req.url === '/scan-invoice') {
    collectRequestData(req, async (err, data) => {
      if (err) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); return; }
      const { imageData } = data || {};
      if (!imageData) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing imageData' })); return; }
      try {
        const base64 = imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: m => {} });

        // Try AI parsing first
        if (process.env.OPENAI_API_KEY) {
          const prompt = `Extract invoice fields from the following OCR text. Return JSON with keys: vendor, invoiceNumber, date (YYYY-MM-DD), total (number), items (array of {name,quantity,unit,unitCost,totalCost,category}). Text:\n\n${text}`;
          try {
            const aiRes = await callOpenAI(prompt);
            let parsed = null;
            try { parsed = JSON.parse(aiRes); } catch (e) { parsed = null; }
            if (parsed && parsed.items) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(parsed));
              return;
            }
          } catch (e) {
            console.error('OpenAI invoice parse failed', e);
          }
        }

        // Fallback heuristic parsing
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let vendor = lines[0] || 'Unknown Vendor';
        let invoiceNumber = '';
        let date = new Date().toISOString().split('T')[0];
        let total = 0;
        const items = [];

        // find invoice number and date in first 10 lines
        for (const l of lines.slice(0, 10)) {
          const invMatch = l.match(/inv(?:oice)?\s*#?:?\s*([A-Z0-9-]+)/i);
          if (invMatch) invoiceNumber = invMatch[1];
          const dateMatch = l.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})/);
          if (dateMatch) {
            date = dateMatch[0];
            break;
          }
        }

        // detect lines with quantity and price (simple approach)
        for (const l of lines) {
          const m = l.match(/(.+?)\s+(\d+(?:[\.,]\d+)?)\s+(lbs|lb|oz|g|kg|each|ea|gallons|gal|case|unit|units|pack)?\s+\$?(\d+[\.,]?\d{0,2})/i);
          if (m) {
            const name = m[1].trim();
            const qty = parseFloat(m[2].replace(',', '.')) || 1;
            const unit = (m[3] || '').trim() || 'ea';
            const unitCost = parseFloat(m[4].replace(',', '.')) || 0;
            const totalCost = qty * unitCost;
            items.push({ name, quantity: qty, unit, unitCost, totalCost, category: 'Unknown' });
          }
        }

        // try to find total line
        for (let i = lines.length - 1; i >= 0; i--) {
          const l = lines[i];
          const m = l.match(/total\s*[:\-]?\s*\$?([0-9]+[\.,]?[0-9]{0,2})/i) || l.match(/\$([0-9]+[\.,]?[0-9]{0,2})/);
          if (m) { total = parseFloat(m[1].replace(',', '.')); break; }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ vendor, invoiceNumber, date, items, total }));
      } catch (err) {
        console.error('Invoice OCR error', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'OCR failed' }));
      }
    });
    return;
  }
  // default 404
  res.writeHead(404);
  res.end();
});

wss.on('connection', (ws) => {
  console.log('WS: client connected');

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'requestAiOrder') {
        const { inventory, salesData } = msg.payload || {};

        // If API key present, call OpenAI. Otherwise use heuristic.
        if (process.env.OPENAI_API_KEY) {
          const prompt = `Produce a JSON array of order suggestions. Return only valid JSON array. Each suggestion should have fields: itemId,itemName,currentStock,parLevel,suggestedQuantity,unitCost,totalCost,supplier,unit,priority,reasoning,daysUntilStockout,confidence. Inventory:${JSON.stringify(inventory)} Sales:${JSON.stringify(salesData)}`;
          try {
            const text = await callOpenAI(prompt);
            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch (err) {
              // If parsing fails, fallback to heuristic
              console.error('OpenAI returned non-JSON, falling back to heuristic', err);
              parsed = heuristicSuggest(inventory, salesData);
            }
            ws.send(JSON.stringify({ type: 'aiOrder', data: parsed }));
          } catch (err) {
            console.error('OpenAI call failed, falling back to heuristic', err);
            const fallback = heuristicSuggest(inventory, salesData);
            ws.send(JSON.stringify({ type: 'aiOrder', data: fallback }));
          }
        } else {
          const fallback = heuristicSuggest(inventory, salesData);
          ws.send(JSON.stringify({ type: 'aiOrder', data: fallback }));
        }
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.error('WS message error', err);
      ws.send(JSON.stringify({ type: 'error', message: String(err) }));
    }
  });

  ws.on('close', () => {
    console.log('WS: client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
});
