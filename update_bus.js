const fs = require('fs');
const https = require('https');
const http = require('http');

function fetchJSON(urlStr, redirects = 3) {
  return new Promise((resolve) => {
    const client = urlStr.startsWith('https') ? https : http;
    client.get(urlStr, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        let redir = res.headers.location;
        if (!redir.startsWith('http')) redir = new URL(redir, urlStr).href;
        return resolve(fetchJSON(redir, redirects - 1));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function fetchAPI(url) {
  let res = await fetchJSON(url);
  if (res && res.data) return res;
  
  let proxy = await fetchJSON(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  if (proxy && proxy.data) return proxy;
  
  return res || null;
}

function parseTime(etaStr) {
  if (!etaStr) return '';
  const d = new Date(etaStr);
  if (isNaN(d.getTime())) return '';
  const hkTime = new Date(d.getTime() + 8 * 3600000);
  const h = String(hkTime.getUTCHours()).padStart(2, '0');
  const m = String(hkTime.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// 👑 終極暴力提取法：提取 3 班車時間
function extractTimes(data) {
  let times = [];
  try {
    if (!data) return ['--', '--', '--'];
    let jsonStr = JSON.stringify(data.data || data);
    let regex = /"(?:timestamp|eta)"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"/g;
    let match;
    while ((match = regex.exec(jsonStr)) !== null) {
      let t = parseTime(match[1]);
      if (t) times.push(t);
    }
  } catch (e) {}
  
  // 解封第三班車
  return [times[0] || '--', times[1] || '--', times[2] || '--'];
}

async function fetchAllBus() {
  console.log('開始更新巴士數據...');
  
  const urls = {
    '12A': 'https://data.etabus.gov.hk/v1/transport/kmb/eta/EF5A5CD9C3A038C9/12A/1',
    '7B': 'https://data.etabus.gov.hk/v1/transport/kmb/eta/EF5A5CD9C3A038C9/7B/1',
    '297': 'https://data.etabus.gov.hk/v1/transport/kmb/eta/EF5A5CD9C3A038C9/297/1',
    '15': 'https://data.etabus.gov.hk/v1/transport/kmb/eta/EF5A5CD9C3A038C9/15/1',
    '269B': 'https://data.etabus.gov.hk/v1/transport/kmb/eta/95FAB1D2AD752ECE/269B/1',
    'GMB2': 'https://data.etagmb.gov.hk/eta/route-stop/2009246/1/1',
    'GMB2A': 'https://data.etagmb.gov.hk/eta/route-stop/2009247/1/1',
    '8A': 'https://data.etabus.gov.hk/v1/transport/kmb/eta/75D6E5952B41E1D2/8A/1',
    '8P': 'https://data.etabus.gov.hk/v1/transport/kmb/eta/75D6E5952B41E1D2/8P/1',
    '115': 'https://data.etabus.gov.hk/v1/transport/kmb/eta/7055FEADC58CB1F1/115/1',
    '115CTB': 'https://rt.data.gov.hk/v1/transport/citybus-nwfb/eta/CTB/001477/115'
  };

  const results = {};
  for (const [route, url] of Object.entries(urls)) {
    const rawData = await fetchAPI(url);
    // 所有巴士/小巴統一使用暴力提取法
    results[route] = extractTimes(rawData);
  }

  // 取得香港時間 (加入秒數)
  const hkTime = new Date(Date.now() + 8 * 3600000);
  const h = String(hkTime.getUTCHours()).padStart(2, '0');
  const m = String(hkTime.getUTCMinutes()).padStart(2, '0');
  const s = String(hkTime.getUTCSeconds()).padStart(2, '0');
  results.update_time = `${h}:${m}:${s}`;

  fs.writeFileSync('bus_data.json', JSON.stringify(results, null, 2));
  console.log('巴士數據寫入成功');
}

fetchAllBus();
