const fs = require('fs');
const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// 🌟 升級版：4 重代理伺服器輪詢，專門破解綠色小巴 API 封鎖
async function fetchAPI(url) {
  // 1. 直連
  let res = await fetchJSON(url);
  if (res && res.data) return res;
  
  // 2. AllOrigins (使用 .contents 安全解析)
  let proxy1 = await fetchJSON(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
  if (proxy1 && proxy1.contents) {
    try {
      let parsed = JSON.parse(proxy1.contents);
      if (parsed.data) return parsed;
    } catch(e) {}
  }
  
  // 3. CorsProxy
  let proxy2 = await fetchJSON(`https://corsproxy.io/?${encodeURIComponent(url)}`);
  if (proxy2 && proxy2.data) return proxy2;

  // 4. CodeTabs 終極後備
  let proxy3 = await fetchJSON(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
  if (proxy3 && proxy3.data) return proxy3;
  
  return null;
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

function getBusTimes(data) {
  if (!data || !data.data || !Array.isArray(data.data)) return ['--', '--'];
  const etas = data.data.filter(item => item.eta).map(item => parseTime(item.eta));
  return [etas[0] || '--', etas[1] || '--'];
}

// 🌟 升級版：更強嘅綠色小巴數據解析防呆機制
function getGMBTimes(data) {
  if (!data || !data.data || !Array.isArray(data.data)) return ['--', '--'];
  
  // 自動尋找第一個包含 eta 陣列嘅數據點 (防止 API 變陣)
  const validStop = data.data.find(item => item.eta && Array.isArray(item.eta) && item.eta.length > 0);
  if (!validStop) return ['--', '--'];
  
  const etas = validStop.eta
    .filter(item => item.timestamp)
    .map(item => parseTime(item.timestamp));
    
  return [etas[0] || '--', etas[1] || '--'];
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
    if (route.startsWith('GMB')) {
      results[route] = getGMBTimes(rawData);
    } else {
      results[route] = getBusTimes(rawData);
    }
  }

  // 取得香港時間 (包含秒數)
  const hkTime = new Date(Date.now() + 8 * 3600000);
  const h = String(hkTime.getUTCHours()).padStart(2, '0');
  const m = String(hkTime.getUTCMinutes()).padStart(2, '0');
  const s = String(hkTime.getUTCSeconds()).padStart(2, '0');
  results.update_time = `${h}:${m}:${s}`;

  fs.writeFileSync('bus_data.json', JSON.stringify(results, null, 2));
  console.log('巴士數據寫入成功');
}

fetchAllBus();
