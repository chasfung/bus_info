const fs = require('fs');
const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// 支援直連與代理備援
async function fetchAPI(url) {
  let res = await fetchJSON(url);
  if (res) return res;
  return await fetchJSON(`https://corsproxy.io/?${encodeURIComponent(url)}`);
}

// 將 API 的 ISO 時間轉換為 HH:mm
function parseTime(etaStr) {
  if (!etaStr) return '';
  const d = new Date(etaStr);
  if (isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// 解析九巴/城巴數據
function getBusTimes(data) {
  if (!data || !data.data || !Array.isArray(data.data)) return ['--', '--'];
  const etas = data.data.filter(item => item.eta).map(item => parseTime(item.eta));
  return [etas[0] || '--', etas[1] || '--'];
}

// 解析綠色小巴數據
function getGMBTimes(data) {
  if (!data || !data.data || !data.data[0] || !Array.isArray(data.data[0].eta)) return ['--', '--'];
  const etas = data.data[0].eta.filter(item => item.timestamp).map(item => parseTime(item.timestamp));
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

  const hkTime = new Date(Date.now() + 8 * 3600000);
  results.update_time = `${String(hkTime.getUTCHours()).padStart(2, '0')}:${String(hkTime.getUTCMinutes()).padStart(2, '0')}`;

  fs.writeFileSync('bus_data.json', JSON.stringify(results, null, 2));
  console.log('巴士數據寫入成功');
}

fetchAllBus();
