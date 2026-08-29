const fs = require('fs');
const https = require('https');
const http = require('http');

// 🌟 終極抓取模組：支援自動跟隨 301/302 Redirect，突破小巴 API 限制
function fetchJSON(urlStr, redirects = 3) {
  return new Promise((resolve) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'http:' ? http : https;
    
    client.get(urlStr, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      } 
    }, (res) => {
      // 遇到轉址，自動追蹤
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) redirectUrl = new URL(redirectUrl, urlStr).href;
        return resolve(fetchJSON(redirectUrl, redirects - 1));
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { 
          resolve(JSON.parse(data)); 
        } catch (e) { 
          resolve({ _raw: data.substring(0, 100), _status: res.statusCode }); 
        }
      });
    }).on('error', (e) => resolve({ _error: e.message }));
  });
}

// 代理備援機制 (改用 .win/raw 直接獲取 JSON)
async function fetchAPI(url) {
  let res = await fetchJSON(url);
  if (res && res.data) return res;
  
  let proxy1 = await fetchJSON(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  if (proxy1 && proxy1.data) return proxy1;
  
  let proxy2 = await fetchJSON(`https://corsproxy.io/?${encodeURIComponent(url)}`);
  if (proxy2 && proxy2.data) return proxy2;
  
  return res || proxy1 || { _error: "All requests failed" };
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

function getGMBTimes(data) {
  if (!data || !data.data || !Array.isArray(data.data)) return ['--', '--'];
  
  // 防呆機制：搵出真正有時間數據嘅陣列
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
    
    // 📸 照妖鏡機制：專門記錄 GMB2 發生咩事
    if (route === 'GMB2') {
      results.debug_gmb_response = typeof rawData === 'object' ? JSON.stringify(rawData).substring(0, 150) : 'unknown';
    }

    if (route.startsWith('GMB')) {
      results[route] = getGMBTimes(rawData);
    } else {
      results[route] = getBusTimes(rawData);
    }
  }

  const hkTime = new Date(Date.now() + 8 * 3600000);
  const h = String(hkTime.getUTCHours()).padStart(2, '0');
  const m = String(hkTime.getUTCMinutes()).padStart(2, '0');
  const s = String(hkTime.getUTCSeconds()).padStart(2, '0');
  results.update_time = `${h}:${m}:${s}`;

  fs.writeFileSync('bus_data.json', JSON.stringify(results, null, 2));
  console.log('巴士數據寫入成功');
}

fetchAllBus();
