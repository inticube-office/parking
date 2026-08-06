require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, 'data');
const LOG_FILE = path.join(DATA_DIR, 'log.csv');
const LOGIN_URL = 'https://a22244.pweb.kr/login';

// 주차 시스템 비고란 제한(51바이트)보다 여유 있게 설정
const MEMO_MAX_BYTES = 48;

const DISCOUNT_TYPES = { '1': '30분', '2': '1시간', '3': '2시간', '4': '일일권' };

app.use(express.json());

const adminGuard = basicAuth({
  users: { [process.env.ADMIN_ID]: process.env.ADMIN_PW },
  challenge: true,
  realm: 'parking-admin'
});
app.use('/admin.html', adminGuard);
app.use('/api/logs', adminGuard);

app.use(express.static(path.join(__dirname, 'public')));

// ===== 직원 명단 (CSV) =====
let empCache = { mtime: 0, list: [] };

function loadEmployees() {
  const file = path.join(DATA_DIR, 'employees.csv');
  const mtime = fs.statSync(file).mtimeMs;
  if (mtime === empCache.mtime) return empCache.list;

  const list = fs.readFileSync(file, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .slice(1)
    .filter(line => line.trim())
    .map(line => {
      const c = line.split(',').map(x => x.trim().replace(/^"|"$/g, ''));
      return { empId: c[0], name: c[1] || '', dept: c[2] || '' };
    })
    .filter(e => /^\d{6}$/.test(e.empId));

  empCache = { mtime, list };
  console.log(`직원 명단 로드: ${list.length}명`);
  return list;
}

// ===== 공통 =====
function nowKST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function todayKST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function byteLen(s) {
  return Buffer.byteLength(String(s), 'utf8');
}

// "08:14" -> "8시간 14분"
function formatParkTime(hhmm) {
  const m = String(hhmm || '').match(/^(\d+):(\d+)$/);
  if (!m) return String(hhmm || '');
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  return h > 0 ? `${h}시간 ${mi}분` : `${mi}분`;
}

// 비고 문자열: "사번 이름 방문업체명" (바이트 초과 시 업체명만 잘라냄)
function buildMemo(empId, name, company) {
  const base = `${empId} ${name}`.trim();
  if (!company) return base;

  let c = company;
  while (c.length > 0 && byteLen(`${base} ${c}`) > MEMO_MAX_BYTES) {
    c = c.slice(0, -1);
  }
  c = c.trim();
  return c ? `${base} ${c}` : base;
}

function appendLog(row) {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '\uFEFF일시,사번,이름,부서,방문업체,차량번호,할인,결과,비고전송값\n', 'utf8');
  }
  fs.appendFileSync(LOG_FILE,
    row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n', 'utf8');
}

function readLogs() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf8').replace(/^\uFEFF/, '')
    .split('\n').slice(1).filter(l => l.trim())
    .map(l => {
      const c = l.split('","').map(x => x.replace(/^"|"$/g, ''));
      return {
        date: c[0], empId: c[1], name: c[2], dept: c[3],
        company: c[4], carNo: c[5], type: c[6], result: c[7], memo: c[8]
      };
    }).reverse();
}

// ===== 주차 사이트 접속 (한 번에 하나씩만 실행) =====
let queue = Promise.resolve();

function runExclusive(fn) {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

async function openSite() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const holder = { saveResult: null };

  page.on('dialog', d => d.accept());
  page.on('response', async res => {
    if (res.url().includes('/registration/save')) {
      try { holder.saveResult = (await res.text()).trim(); } catch (e) {}
    }
  });

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#userId', process.env.PARK_ID);
  await page.fill('#userPwd', process.env.PARK_PW);
  await page.click('#btnLogin');
  await page.waitForLoadState('networkidle');

  return { browser, page, holder };
}

async function searchCars(page, carLast4) {
  await page.evaluate(d => {
    const el = document.querySelector('input[name=entryDate]');
    el.removeAttribute('readonly');
    el.value = d;
  }, todayKST());

  await page.fill('#schCarNo', carLast4);
  await page.evaluate(() => fncDoListMst());
  await page.waitForTimeout(4000);

  return await page.evaluate(() => {
    if (typeof dataSetMst === 'undefined' || !dataSetMst) return [];
    return dataSetMst.map(j => ({
      id: String(j.id),
      carNo: j.carNo,
      entryTime: j.entryDateToString,
      parkTimeRaw: j.differentTime,
      iCardType: String(j.iCardType),
      dscntCnt: Number(j.dscnt_cnt || 0)
    }));
  });
}

// ===== API: 1단계 조회 =====
app.post('/api/search', async (req, res) => {
  const carLast4 = String(req.body.carNo || '').replace(/\D/g, '');

  if (carLast4.length < 2 || carLast4.length > 4) {
    return res.json({ ok: false, message: '차량번호 2~4자리를 입력하세요.' });
  }

  try {
    const cars = await runExclusive(async () => {
      const s = await openSite();
      try {
        return await searchCars(s.page, carLast4);
      } finally {
        await s.browser.close();
      }
    });

    if (!cars.length) {
      return res.json({ ok: false, message: '입차 기록이 없습니다. 차량번호를 확인하세요.' });
    }

    return res.json({
      ok: true,
      cars: cars.map(c => ({
        id: c.id,
        carNo: c.carNo,
        entryTime: c.entryTime,
        parkTime: formatParkTime(c.parkTimeRaw),
        dscntCnt: c.dscntCnt
      }))
    });
  } catch (err) {
    console.error('조회 오류:', err.message);
    return res.json({ ok: false, message: '조회 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.' });
  }
});

// ===== API: 2단계 등록 =====
app.post('/api/register', async (req, res) => {
  const empId = String(req.body.empId || '').trim();
  const company = String(req.body.company || '').trim().replace(/\s+/g, ' ');
  const carLast4 = String(req.body.carNo || '').replace(/\D/g, '');
  const carId = String(req.body.carId || '').trim();
  const typeCode = String(req.body.discountType || '');

  if (!/^\d{6}$/.test(empId)) {
    return res.json({ ok: false, message: '사번은 숫자 6자리여야 합니다.' });
  }
  if (company.length < 2) {
    return res.json({ ok: false, message: '방문업체명을 입력하세요.' });
  }
  if (company.length > 30) {
    return res.json({ ok: false, message: '방문업체명은 30자 이내로 입력하세요.' });
  }
  if (!carId || !carLast4) {
    return res.json({ ok: false, message: '차량을 다시 조회해 주세요.' });
  }
  if (!DISCOUNT_TYPES[typeCode]) {
    return res.json({ ok: false, message: '할인 유형을 선택하세요.' });
  }

  const emp = loadEmployees().find(e => e.empId === empId);
  if (!emp) {
    appendLog([nowKST(), empId, '', '', company, carLast4, '', '인증실패', '']);
    return res.json({ ok: false, message: '등록되지 않은 사번입니다.' });
  }

  const memo = buildMemo(empId, emp.name, company);
  const typeName = DISCOUNT_TYPES[typeCode];
  console.log(`등록 요청: ${carLast4} / ${typeName} / 비고 "${memo}" (${byteLen(memo)} bytes)`);

  try {
    const r = await runExclusive(async () => {
      const s = await openSite();
      try {
        const cars = await searchCars(s.page, carLast4);
        const target = cars.find(c => c.id === carId);

        if (!target) {
          return { ok: false, message: '해당 차량을 찾을 수 없습니다. 이미 출차했을 수 있습니다.' };
        }

        // 차량 선택
        await s.page.evaluate(a => fncDetailInfo(a.id, a.ct),
          { id: Number(target.id), ct: target.iCardType });
        await s.page.waitForTimeout(3500);

        const peId = await s.page.inputValue('#peId');
        if (String(peId) !== carId) {
          return { ok: false, message: '차량 선택에 실패했습니다. 다시 조회해 주세요.' };
        }

        const fullCarNo = await s.page.inputValue('#carNo');

        await s.page.fill('#memo', memo);
        await s.page.evaluate(t => fncSetDscntType(t), typeCode);
        await s.page.waitForTimeout(5000);

        if (s.holder.saveResult === 'true') {
          return { ok: true, carNo: fullCarNo };
        }
        return {
          ok: false,
          carNo: fullCarNo,
          message: '등록에 실패했습니다. 잠시 후 다시 시도하세요.'
        };
      } finally {
        await s.browser.close();
      }
    });

    appendLog([nowKST(), empId, emp.name, emp.dept, company,
               r.carNo || carLast4, typeName, r.ok ? '등록성공' : '등록실패', memo]);

    return res.json({
      ok: r.ok,
      message: r.ok
        ? `${r.carNo} · ${typeName} 할인 등록 완료 (${emp.name} / ${company})`
        : r.message
    });
  } catch (err) {
    console.error('등록 오류:', err.message);
    appendLog([nowKST(), empId, emp.name, emp.dept, company,
               carLast4, typeName, '오류', memo]);
    return res.json({ ok: false, message: '시스템 오류가 발생했습니다. 관리자에게 문의하세요.' });
  }
});

app.get('/api/logs', (req, res) => res.json(readLogs()));

// ===== 서버 시작 =====
app.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  const ips = Object.values(nets).flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => n.address);
  console.log(`서버 실행 (내 PC): http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`서버 실행 (사내망): http://${ip}:${PORT}`));
});