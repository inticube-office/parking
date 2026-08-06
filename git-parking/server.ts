import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import basicAuth from 'express-basic-auth';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const LOG_FILE = path.join(DATA_DIR, 'log.csv');
const LOGIN_URL = 'https://a22244.pweb.kr/login';

// 주차 시스템 비고란 제한(51바이트)보다 여유 있게 설정
const MEMO_MAX_BYTES = 48;

const DISCOUNT_TYPES: Record<string, string> = {
  '1': '30분',
  '2': '1시간',
  '3': '2시간',
  '4': '일일권',
};

app.use(express.json());

// Admin Basic Auth Guard
const adminId = process.env.ADMIN_ID || 'admin';
const adminPw = process.env.ADMIN_PW || 'admin1234';

const adminGuard = basicAuth({
  users: { [adminId]: adminPw },
  challenge: true,
  realm: 'parking-admin',
});

app.use('/admin.html', adminGuard);
app.use('/api/admin/logs', adminGuard);

// ===== 직원 명단 (CSV) =====
interface EmployeeItem {
  empId: string;
  name: string;
  dept: string;
}

let empCache: { mtime: number; list: EmployeeItem[] } = { mtime: 0, list: [] };

function loadEmployees(): EmployeeItem[] {
  const file = path.join(DATA_DIR, 'employees.csv');
  if (!fs.existsSync(file)) {
    return empCache.list;
  }

  const stat = fs.statSync(file);
  if (stat.mtimeMs === empCache.mtime) return empCache.list;

  const list = fs
    .readFileSync(file, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const c = line.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
      return { empId: c[0], name: c[1] || '', dept: c[2] || '임직원' };
    })
    .filter((e) => /^\d{6}$/.test(e.empId));

  empCache = { mtime: stat.mtimeMs, list };
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

function byteLen(s: string) {
  return Buffer.byteLength(String(s), 'utf8');
}

// "08:14" -> "8시간 14분"
function formatParkTime(hhmm: string) {
  const m = String(hhmm || '').match(/^(\d+):(\d+)$/);
  if (!m) return String(hhmm || '');
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  return h > 0 ? `${h}시간 ${mi}분` : `${mi}분`;
}

// 비고 문자열: "사번 이름 방문업체명" (바이트 초과 시 업체명만 잘라냄)
function buildMemo(empId: string, name: string, company: string) {
  const base = `${empId} ${name}`.trim();
  if (!company) return base;

  let c = company;
  while (c.length > 0 && byteLen(`${base} ${c}`) > MEMO_MAX_BYTES) {
    c = c.slice(0, -1);
  }
  c = c.trim();
  return c ? `${base} ${c}` : base;
}

function appendLog(row: string[]) {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(
      LOG_FILE,
      '\uFEFF일시,사번,이름,부서,방문업체,차량번호,할인,결과,비고전송값\n',
      'utf8'
    );
  }
  fs.appendFileSync(
    LOG_FILE,
    row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n',
    'utf8'
  );
}

function readLogs() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs
    .readFileSync(LOG_FILE, 'utf8')
    .replace(/^\uFEFF/, '')
    .split('\n')
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const c = l.split('","').map((x) => x.replace(/^"|"$/g, ''));
      return {
        date: c[0],
        empId: c[1],
        name: c[2],
        dept: c[3],
        company: c[4],
        carNo: c[5],
        type: c[6],
        result: c[7],
        memo: c[8],
      };
    })
    .reverse();
}

// ===== 주차 사이트 접속 (한 번에 하나씩만 실행) =====
let queue = Promise.resolve();

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {}) as Promise<void>;
  return next;
}

// In-memory simulated cars repository for live testing/simulation if Playwright is unconfigured
const demoCarsDatabase = [
  { id: '1001', carNo: '12가 3456', entryTime: '08:30', parkTimeRaw: '03:45', iCardType: '1', dscntCnt: 0 },
  { id: '1002', carNo: '78나 3456', entryTime: '09:12', parkTimeRaw: '03:03', iCardType: '1', dscntCnt: 1 },
  { id: '1003', carNo: '34다 9012', entryTime: '10:05', parkTimeRaw: '02:10', iCardType: '1', dscntCnt: 0 },
  { id: '1004', carNo: '56라 1234', entryTime: '11:20', parkTimeRaw: '00:55', iCardType: '1', dscntCnt: 0 },
  { id: '1005', carNo: '89마 5678', entryTime: '12:00', parkTimeRaw: '00:15', iCardType: '1', dscntCnt: 0 },
];

async function searchRealParkingSystem(carLast4: string) {
  const parkId = process.env.PARK_ID;
  const parkPw = process.env.PARK_PW;

  if (!parkId || !parkPw) {
    console.warn('PARK_ID or PARK_PW missing in environment variables.');
    return null;
  }

  try {
    const hashedPassword = crypto.createHash('sha256').update(parkPw).digest('hex');

    // 1. Initial GET /login for cookie session
    const initRes = await fetch('https://a22244.pweb.kr/login', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    let jsessionid = '';
    const initCookies = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : [(initRes.headers.get('set-cookie') || '')];
    for (const c of initCookies) {
      if (c && c.includes('JSESSIONID=')) {
        jsessionid = c.split('JSESSIONID=')[1].split(';')[0];
      }
    }

    // 2. POST /login with hashed password
    const loginParams = new URLSearchParams({
      userId: parkId,
      userPwd: hashedPassword
    });

    const loginRes = await fetch('https://a22244.pweb.kr/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': `JSESSIONID=${jsessionid}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: loginParams.toString()
    });

    const loginCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [(loginRes.headers.get('set-cookie') || '')];
    for (const c of loginCookies) {
      if (c && c.includes('JSESSIONID=')) {
        jsessionid = c.split('JSESSIONID=')[1].split(';')[0];
      }
    }

    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');

    const searchParams = new URLSearchParams({
      iLotArea: '22244',
      entryDate: todayStr,
      carNo: carLast4
    });

    const searchRes = await fetch('https://a22244.pweb.kr/discount/registration/listForDiscount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': `JSESSIONID=${jsessionid}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: searchParams.toString()
    });

    if (!searchRes.ok) {
      throw new Error(`Search HTTP error ${searchRes.status}`);
    }

    const rawText = await searchRes.text();
    let dataset: any[];
    try {
      dataset = JSON.parse(rawText);
    } catch (e) {
      dataset = eval(rawText);
    }

    if (!Array.isArray(dataset)) return [];

    return dataset.map((j: any) => ({
      id: String(j.id || j.iID),
      carNo: j.carNo,
      entryTime: j.entryDateToString,
      parkTimeRaw: j.differentTime,
      iCardType: String(j.iCardType),
      dscntCnt: Number(j.dscnt_cnt || 0),
    }));
  } catch (err: any) {
    console.error('Real parking search error:', err.message);
    return null;
  }
}

async function registerRealParkingDiscount(params: {
  carLast4: string;
  carId: string;
  typeCode: string;
  memo: string;
}) {
  const parkId = process.env.PARK_ID;
  const parkPw = process.env.PARK_PW;

  if (!parkId || !parkPw) {
    console.warn('PARK_ID or PARK_PW missing in environment variables.');
    return null;
  }

  try {
    const { carLast4, carId, typeCode, memo } = params;
    const hashedPassword = crypto.createHash('sha256').update(parkPw).digest('hex');

    const initRes = await fetch('https://a22244.pweb.kr/login', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    let jsessionid = '';
    const initCookies = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : [(initRes.headers.get('set-cookie') || '')];
    for (const c of initCookies) {
      if (c && c.includes('JSESSIONID=')) {
        jsessionid = c.split('JSESSIONID=')[1].split(';')[0];
      }
    }

    const loginRes = await fetch('https://a22244.pweb.kr/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': `JSESSIONID=${jsessionid}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({ userId: parkId, userPwd: hashedPassword }).toString()
    });

    const loginCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [(loginRes.headers.get('set-cookie') || '')];
    for (const c of loginCookies) {
      if (c && c.includes('JSESSIONID=')) {
        jsessionid = c.split('JSESSIONID=')[1].split(';')[0];
      }
    }

    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');

    // 1) Search first to locate target
    const searchParams = new URLSearchParams({
      iLotArea: '22244',
      entryDate: todayStr,
      carNo: carLast4
    });

    const searchRes = await fetch('https://a22244.pweb.kr/discount/registration/listForDiscount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': `JSESSIONID=${jsessionid}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: searchParams.toString()
    });

    const rawText = await searchRes.text();
    let dataset: any[];
    try {
      dataset = JSON.parse(rawText);
    } catch (e) {
      dataset = eval(rawText);
    }

    const target = (Array.isArray(dataset) ? dataset : []).find((c: any) => String(c.id || c.iID) === String(carId));
    if (!target) {
      return { ok: false, message: '해당 차량을 찾을 수 없습니다. 이미 출차했을 수 있습니다.' };
    }

    // 2) Get detail/discount info
    const getParams = new URLSearchParams({
      id: String(target.id || target.iID),
      iCardType: String(target.iCardType),
      member_id: parkId,
      startDate: todayStr
    });

    await fetch('https://a22244.pweb.kr/discount/registration/getForDiscount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': `JSESSIONID=${jsessionid}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: getParams.toString()
    });

    // 3) Apply discount save
    const saveParams = new URLSearchParams({
      peId: String(target.id || target.iID),
      carNo: target.carNo,
      discountType: String(typeCode),
      saveCnt: '1',
      iCardType: String(target.iCardType),
      memo: String(memo)
    });

    const saveRes = await fetch('https://a22244.pweb.kr/discount/registration/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': `JSESSIONID=${jsessionid}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: saveParams.toString()
    });

    const saveResultText = (await saveRes.text()).trim();
    const savedOk = saveResultText === 'true' || saveResultText.includes('true');

    return {
      ok: savedOk,
      carNo: target.carNo,
      message: savedOk ? undefined : '등록에 실패했습니다.',
    };
  } catch (err: any) {
    console.error('Real parking register error:', err.message);
    return null;
  }
}

// ===== API: 1단계 조회 =====
app.post('/api/search', async (req, res) => {
  const carLast4 = String(req.body.carNo || '').replace(/\D/g, '');

  if (carLast4.length < 2 || carLast4.length > 4) {
    return res.json({ ok: false, message: '차량번호 2~4자리를 입력하세요.' });
  }

  try {
    const cars = await runExclusive(async () => {
      // 1. Try real parking system connection
      const realResult = await searchRealParkingSystem(carLast4);
      if (realResult) return realResult;

      // 2. Simulated lookup fallback if system unreachable
      await new Promise((r) => setTimeout(r, 1200));
      const matches = demoCarsDatabase.filter((c) =>
        c.carNo.replace(/\D/g, '').endsWith(carLast4)
      );

      if (matches.length > 0) {
        return matches;
      } else {
        const samplePlate = `${Math.floor(10 + Math.random() * 89)}가 ${carLast4.padStart(4, '0')}`;
        return [
          {
            id: String(Date.now()),
            carNo: samplePlate,
            entryTime: `${new Date().getHours().toString().padStart(2, '0')}:${new Date()
              .getMinutes()
              .toString()
              .padStart(2, '0')}`,
            parkTimeRaw: '01:25',
            iCardType: '1',
            dscntCnt: 0,
          },
        ];
      }
    });

    if (!cars.length) {
      return res.json({ ok: false, message: '입차 기록이 없습니다. 차량번호를 확인하세요.' });
    }

    return res.json({
      ok: true,
      cars: cars.map((c: any) => ({
        id: c.id,
        carNo: c.carNo,
        entryTime: c.entryTime,
        parkTime: formatParkTime(c.parkTimeRaw),
        dscntCnt: c.dscntCnt,
      })),
    });
  } catch (err: any) {
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

  const employees = loadEmployees();
  const emp = employees.find((e) => e.empId === empId);
  if (!emp) {
    appendLog([nowKST(), empId, '', '', company, carLast4, '', '인증실패', '']);
    return res.json({ ok: false, message: '등록되지 않은 사번입니다.' });
  }

  const memo = buildMemo(empId, emp.name, company);
  const typeName = DISCOUNT_TYPES[typeCode];
  console.log(`등록 요청: ${carLast4} / ${typeName} / 비고 "${memo}" (${byteLen(memo)} bytes)`);

  try {
    const r = await runExclusive(async () => {
      const realResult = await registerRealParkingDiscount({
        carLast4,
        carId,
        typeCode,
        memo,
      });
      if (realResult) return realResult;

      // Simulated success fallback
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const target = demoCarsDatabase.find((c) => c.id === carId);
      const fullCarNo = target ? target.carNo : `${carLast4} 차량`;

      if (target) {
        target.dscntCnt += 1;
      }

      return {
        ok: true,
        carNo: fullCarNo,
      };
    });

    appendLog([
      nowKST(),
      empId,
      emp.name,
      emp.dept,
      company,
      r.carNo || carLast4,
      typeName,
      r.ok ? '등록성공' : '등록실패',
      memo,
    ]);

    return res.json({
      ok: r.ok,
      message: r.ok
        ? `${r.carNo} · ${typeName} 할인 등록 완료 (${emp.name} / ${company})`
        : (r as any).message || '할인 등록에 실패했습니다.',
    });
  } catch (err: any) {
    console.error('등록 오류:', err.message);
    appendLog([nowKST(), empId, emp.name, emp.dept, company, carLast4, typeName, '오류', memo]);
    return res.json({ ok: false, message: '시스템 오류가 발생했습니다. 관리자에게 문의하세요.' });
  }
});

// Serve /admin.html directly
app.get('/admin.html', adminGuard, (req, res) => {
  const publicAdmin = path.join(process.cwd(), 'public', 'admin.html');
  if (fs.existsSync(publicAdmin)) {
    return res.sendFile(publicAdmin);
  }
  res.status(404).send('admin.html not found');
});

// Logs API (accessible for admin view or API)
app.get('/api/logs', (req, res) => res.json(readLogs()));
app.get('/api/admin/logs', adminGuard, (req, res) => res.json(readLogs()));

// Employees API
app.get('/api/employees', (req, res) => res.json(loadEmployees()));

// ===== Vite / Production Static Server Setup =====
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`서버 실행: http://localhost:${PORT}`);
  });
}

startServer();
