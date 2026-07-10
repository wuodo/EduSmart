import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getNurturingRecommendation, predictFollowupOutcome } from '../utils/followupNurturing';

type AskContext = {
  inquiryId?: number;
  followupId?: number;
  pathname?: string;
  pendingChoice?: string | null;
};

type AskAiRequestBody = {
  question: string;
  context?: AskContext;
};

type Source = {
  file: string;
  route?: string;
};

type EndpointEntry = {
  id: string;
  method: string;
  path: string;
  file: string;
  tokens: string[];
};

type AskAiIndex = {
  version: number;
  generatedAt: string;
  endpoints: EndpointEntry[];
};

const repoRoot = path.resolve(__dirname, '../../..');
const INDEX_PATH = path.join(repoRoot, 'backend/data/ask-ai-index.json');
const INDEX_VERSION = 1;

let indexCache: { index: AskAiIndex; loadedAt: number } | null = null;

function toRel(fileAbs: string): string {
  return path.relative(repoRoot, fileAbs).replace(/\\/g, '/');
}

function tokenize(s: string): string[] {
  const cleaned = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9:_\-\/]+/g, ' ')
    .trim();
  if (!cleaned) return [];
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const uniq = Array.from(new Set(parts));
  return uniq.slice(0, 120);
}

function joinTokens(...arrs: Array<string[] | undefined>): string[] {
  const out: string[] = [];
  for (const a of arrs) {
    if (!a) continue;
    out.push(...a);
  }
  return Array.from(new Set(out)).slice(0, 180);
}

function resolveTsFile(maybePath: string): string | null {
  // Accept either full file path or import-ish path without extension.
  const abs = path.isAbsolute(maybePath) ? maybePath : path.resolve(repoRoot, maybePath);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  const ts = `${abs}.ts`;
  if (fs.existsSync(ts) && fs.statSync(ts).isFile()) return ts;
  const tsx = `${abs}.tsx`;
  if (fs.existsSync(tsx) && fs.statSync(tsx).isFile()) return tsx;
  return null;
}

function extractRouteEndpointsFromServer(serverFileAbs: string): EndpointEntry[] {
  const serverText = fs.readFileSync(serverFileAbs, 'utf8');

  // Map local variable name -> mounted base path, e.g. followupRoutes -> /api/followups
  const mountBaseByVar: Record<string, string> = {};
  const appUseRe = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
  let m: RegExpExecArray | null = null;
  while ((m = appUseRe.exec(serverText))) {
    const base = String(m[1] || '').trim();
    const varName = String(m[2] || '').trim();
    if (!base || !varName) continue;
    mountBaseByVar[varName] = base;
  }

  // Map local variable name -> import file path, e.g. followupRoutes -> ./routes/followup.routes
  const importFileByVar: Record<string, string> = {};
  const defaultImportRe = /import\s+([A-Za-z0-9_]+)\s+from\s+['"]([^'"]+)['"]\s*;/g;
  while ((m = defaultImportRe.exec(serverText))) {
    const varName = String(m[1] || '').trim();
    const importPath = String(m[2] || '').trim();
    if (!varName || !importPath) continue;
    importFileByVar[varName] = importPath;
  }

  const namedImportRe = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]\s*;/g;
  while ((m = namedImportRe.exec(serverText))) {
    const inside = String(m[1] || '');
    const importPath = String(m[2] || '').trim();
    if (!inside || !importPath) continue;
    const parts = inside.split(',').map(x => x.trim()).filter(Boolean);
    for (const part of parts) {
      const asMatch = part.match(/^([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)$/i);
      if (asMatch) {
        const [, _left, right] = asMatch;
        importFileByVar[String(right)] = importPath;
      } else {
        const left = part.split(/\s+/)[0];
        if (left) importFileByVar[left] = importPath;
      }
    }
  }

  const serverDir = path.dirname(serverFileAbs);
  const endpoints: EndpointEntry[] = [];

  // Direct endpoints inside server.ts (shims + stable routes).
  const directRe = /app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]\s*,/g;
  while ((m = directRe.exec(serverText))) {
    const method = String(m[1] || '').toUpperCase();
    const routePath = String(m[2] || '');
    if (!routePath || !method) continue;
    endpoints.push({
      id: `server:${method}:${routePath}`,
      method,
      path: routePath,
      file: toRel(serverFileAbs),
      tokens: joinTokens(tokenize(method), tokenize(routePath), tokenize(serverFileAbs)),
    });
  }

  // Mounted routers (derive full path base + router route path).
  const moduleRouteRe = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
  for (const [varName, mountBase] of Object.entries(mountBaseByVar)) {
    const importPath = importFileByVar[varName];
    if (!importPath) continue;
    const absImport = path.resolve(serverDir, importPath);
    const resolved = resolveTsFile(absImport);
    if (!resolved) continue;
    const moduleText = fs.readFileSync(resolved, 'utf8');
    let mm: RegExpExecArray | null = null;
    while ((mm = moduleRouteRe.exec(moduleText))) {
      const mmMethod = String(mm[1] || '').toUpperCase();
      const subPath = String(mm[2] || '');
      if (!subPath) continue;

      const full =
        mountBase.endsWith('/') || subPath.startsWith('/')
          ? `${mountBase.replace(/\/+$/, '')}/${subPath.replace(/^\/+/, '')}`
          : `${mountBase}/${subPath}`;

      endpoints.push({
        id: `${toRel(resolved)}:${mmMethod}:${full}`,
        method: mmMethod,
        path: full,
        file: toRel(resolved),
        tokens: joinTokens(tokenize(mmMethod), tokenize(full), tokenize(resolved)),
      });
    }
  }

  // Deduplicate by method+path+file.
  const seen = new Set<string>();
  const out: EndpointEntry[] = [];
  for (const e of endpoints) {
    const key = `${e.method}:${e.path}:${e.file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function buildAskAiIndex(): AskAiIndex {
  const serverFileAbs = path.join(repoRoot, 'backend/src/server.ts');
  const endpoints = extractRouteEndpointsFromServer(serverFileAbs);
  return {
    version: INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    endpoints,
  };
}

async function loadIndex(forceRebuild: boolean): Promise<AskAiIndex> {
  if (!forceRebuild && indexCache?.index) return indexCache.index;

  try {
    const stat = fs.existsSync(INDEX_PATH) ? fs.statSync(INDEX_PATH) : null;
    if (!forceRebuild && stat && stat.isFile()) {
      const parsed = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')) as AskAiIndex;
      if (parsed?.version === INDEX_VERSION && Array.isArray(parsed.endpoints)) {
        indexCache = { index: parsed, loadedAt: Date.now() };
        return parsed;
      }
    }
  } catch {
    // ignore, rebuild below
  }

  const index = buildAskAiIndex();
  try {
    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
  } catch {
    // If we can't persist, still serve from memory.
  }

  indexCache = { index, loadedAt: Date.now() };
  return index;
}

function getRequester(req: Request): { role: string; email: string; tenantId: number | null } {
  const user = (req as any).user as { role?: string; email?: string } | undefined;
  const tenant = (req as any).tenant as { id?: number } | undefined;
  const role = String(user?.role || '').toLowerCase();
  const email = String(user?.email || '').toLowerCase();
  const tenantId = tenant?.id !== undefined && tenant?.id !== null ? Number(tenant.id) : null;
  return { role, email, tenantId: Number.isFinite(tenantId as any) ? (tenantId as number) : null };
}

function normalizeId(x: unknown): number | null {
  const n = typeof x === 'number' ? x : Number(String(x));
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  if (!Number.isFinite(int)) return null;
  return int > 0 ? int : null;
}

function classifyQuestion(q: string): {
  wantsRecommendation: boolean;
  wantsPrediction: boolean;
  wantsReminder: boolean;
  wantsLetters: boolean;
  wantsRegistrations: boolean;
  wantsFollowupDetails: boolean;
  wantsEndpointHelp: boolean;
} {
  const s = String(q || '').toLowerCase();

  const wantsEndpointHelp = /\b(endpoint|api|route|where.*handled|how.*works|which.*file|code)\b/.test(s);
  const wantsRecommendation = /\b(recommendation|nurtur|nurturing)\b/.test(s);
  const wantsPrediction = /\b(prediction|outcome|convert|conversion|likely)\b/.test(s);
  const wantsReminder = /\b(reminder|remind|reply|response|sentiment|engagement sentiment)\b/.test(s);
  const wantsLetters = /\b(letter|admission letter|pdf|reference|serial|template)\b/.test(s);
  const wantsRegistrations = /\b(registration|registrations|registered|paid)\b/.test(s);
  const wantsFollowupDetails = /\b(follow.?up|followups|history|comments|notes|scheduled)\b/.test(s);

  return {
    wantsRecommendation,
    wantsPrediction,
    wantsReminder,
    wantsLetters,
    wantsRegistrations,
    wantsFollowupDetails,
    wantsEndpointHelp,
  };
}

function extractUserMentions(question: string): string[] {
  const out: string[] = [];
  const re = /@([a-zA-Z0-9._-]+)/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(String(question || ''))) !== null) {
    const token = String(m[1] || '').trim();
    if (token) out.push(token);
  }
  // Keep uniqueness and order
  return Array.from(new Set(out)).slice(0, 5);
}

async function resolveMentionToUserEmail(mention: string, tenantId: number): Promise<string | null> {
  const token = String(mention || '').trim().toLowerCase();
  if (!token) return null;

  const user = await prisma.user.findFirst({
    where: {
      tenantId,
      OR: [
        { email: { equals: token, mode: 'insensitive' } as any },
        { name: { equals: token, mode: 'insensitive' } as any },
        { email: { contains: token, mode: 'insensitive' } as any },
        { name: { contains: token, mode: 'insensitive' } as any },
      ],
    } as any,
    select: { email: true },
  });

  return user?.email ? String(user.email) : null;
}

async function countTotalRegistrations(tenantId: number): Promise<number> {
  return prisma.inquiry.count({
    where: {
      tenantId,
      paymentStatus: 'Paid',
    } as any,
  });
}

async function countRegistrationsForUser(userEmail: string, tenantId: number): Promise<number> {
  const e = String(userEmail || '').toLowerCase();
  return prisma.inquiry.count({
    where: {
      tenantId,
      paymentStatus: 'Paid',
      OR: [
        { createdBy: { equals: e, mode: 'insensitive' } as any },
        { assignedTo: { equals: e, mode: 'insensitive' } as any },
      ],
    } as any,
  });
}

function normalizeHumanText(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\s@\-._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const s = String(a || '');
  const t = String(b || '');
  if (!s) return t.length;
  if (!t) return s.length;
  const m = s.length;
  const n = t.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = dp[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return dp[n];
}

function tokenJaccardScore(a: string, b: string): number {
  const ta = normalizeHumanText(a).split(' ').filter(Boolean);
  const tb = normalizeHumanText(b).split(' ').filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union > 0 ? inter / union : 0;
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'with',
  'from',
  'at',
  'by',
  'is',
  'are',
  'am',
  'be',
  'i',
  'me',
  'my',
  'your',
  'you',
  'we',
  'our',
  'it',
  'this',
  'that',
  'as',
  'into',
  'about',
  'please',
  'help',
  'can',
  'could',
  'would',
  'should',
  'do',
  'next',
]);

function tokenizeForIntent(s: string): string[] {
  const norm = normalizeHumanText(s);
  if (!norm) return [];
  return norm
    .split(' ')
    .map(t => t.trim())
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

function tokenSimilarity(a: string, b: string): number {
  const s1 = String(a || '');
  const s2 = String(b || '');
  const maxLen = Math.max(1, Math.max(s1.length, s2.length));
  const dist = levenshtein(s1, s2);
  return 1 - dist / maxLen;
}

const AUTO_CORRECT_KNOWN_TOKENS = Array.from(
  new Set([
    // greetings
    'hello',
    'hi',
    'hey',
    'good',
    'morning',
    'afternoon',
    'evening',
    'how',
    'are',
    'you',
    // login / access
    'login',
    'loggin',
    'sign',
    'signin',
    'access',
    'password',
    'forgot',
    'credentials',
    'verify',
    'device',
    // inquiry/followups/registrations/letters
    'inquiry',
    'inquiries',
    'lead',
    'student',
    'followup',
    'followups',
    'follow-up',
    'follow-ups',
    'registration',
    'registrations',
    'registered',
    'paid',
    'admission',
    'letter',
    'letters',
    'reference',
    'serial',
    // reports/analytics/users/profile
    'report',
    'reports',
    'export',
    'excel',
    'pdf',
    'analytics',
    'statistics',
    'performance',
    'insights',
    'user',
    'users',
    'account',
    'staff',
    'profile',
    // actions/intents keywords
    'add',
    'create',
    'new',
    'insert',
    'update',
    'edit',
    'change',
    'generate',
    'approve',
    'reject',
    'convert',
    'show',
    'list',
    'view',
    'display',
    'count',
    'total',
    'number',
    'help',
    'what',
    'should',
    'do',
    'next',
    'where',
    'begin',
    'start',
    'login',
  ])
);

function autocorrectQuestion(question: string): string {
  const normalized = normalizeHumanText(question);
  if (!normalized) return '';
  const parts = normalized.split(' ').filter(Boolean);
  if (!parts.length) return normalized;

  const corrected = parts.map(tok => {
    if (!tok) return tok;
    if (tok.startsWith('@')) return tok;
    if (AUTO_CORRECT_KNOWN_TOKENS.includes(tok)) return tok;
    if (tok.length <= 2) return tok;

    let bestTok: string | null = null;
    let bestSim = 0;
    let bestDist = 999;

    for (const known of AUTO_CORRECT_KNOWN_TOKENS) {
      const sim = tokenSimilarity(tok, known);
      const dist = levenshtein(tok, known);
      const ok = dist <= 2 || sim >= 0.75;
      if (!ok) continue;
      if (sim > bestSim || (sim === bestSim && dist < bestDist)) {
        bestTok = known;
        bestSim = sim;
        bestDist = dist;
      }
    }
    return bestTok || tok;
  });

  return corrected.join(' ');
}

type EntityKey = 'inquiries' | 'followups' | 'registrations' | 'admission_letters' | 'users' | 'profile';

function detectEntity(questionNorm: string, tokenSet: Set<string>): { entity: EntityKey | null; score: number } {
  const q = String(questionNorm || '');
  const has = (t: string) => tokenSet.has(t);

  const scoreInquiries = (has('inquiry') || has('inquiries') ? 3 : 0) + (has('lead') ? 1 : 0) + (has('student') ? 1 : 0);

  const scoreFollowups =
    (has('followup') || has('followups') || has('follow-up') || has('follow-ups') ? 3 : 0) + (q.includes('follow') ? 0.5 : 0);

  const scoreRegistrations =
    (has('registration') || has('registrations') ? 3 : 0) + (has('paid') ? 1.5 : 0) + (has('registered') ? 0.5 : 0);

  const admissionLetterToken = has('letter') || has('letters') || q.includes('letter');
  const hasAdmission = has('admission') || q.includes('admission');
  const scoreAdmissionLetters = admissionLetterToken ? (hasAdmission ? 4 : 2) : 0;

  const scoreUsers = (has('user') || has('users') ? 3 : 0) + (has('account') ? 1 : 0) + (has('staff') ? 1 : 0);
  const scoreProfile = has('profile') ? 4 : 0;

  const entries: Array<{ entity: EntityKey; score: number }> = [
    { entity: 'inquiries', score: scoreInquiries },
    { entity: 'followups', score: scoreFollowups },
    { entity: 'registrations', score: scoreRegistrations },
    { entity: 'admission_letters', score: scoreAdmissionLetters },
    { entity: 'users', score: scoreUsers },
    { entity: 'profile', score: scoreProfile },
  ];

  entries.sort((a, b) => b.score - a.score);
  const best = entries[0];
  if (!best || best.score <= 0) return { entity: null, score: 0 };
  return { entity: best.entity, score: best.score };
}

type HumanIntentId =
  | 'greeting'
  | 'login'
  | 'dashboard_navigation'
  | 'inquiries'
  | 'applications'
  | 'users_roles'
  | 'reports'
  | 'errors_help'
  | 'security'
  | 'human_support'
  | 'guidance_next';

type HumanIntent = {
  id: HumanIntentId;
  keywords: string[]; // token keywords
  samples: string[]; // example phrases for set overlap scoring
  response: string;
};

function bestHumanFaqAnswer(question: string): string | null {
  const qNorm = normalizeHumanText(question);
  if (!qNorm) return null;
  const qTokens = tokenizeForIntent(question);

  const intents: HumanIntent[] = [
    {
      id: 'greeting',
      keywords: ['hello', 'hi', 'hey', 'good', 'morning', 'afternoon', 'evening', 'how', 'are', 'you'],
      samples: [
        'hello',
        'hi',
        'good morning',
        'good afternoon',
        'good evening',
        'how are you',
        'who are you',
        'what can you do',
      ],
      response: 'Hello. How can I assist you with the CRM today?',
    },
    {
      id: 'login',
      keywords: ['login', 'signin', 'sign', 'access', 'password', 'forgot', 'credentials', 'verify', 'device', 'loggin'],
      samples: ['i cant log in', 'i can not log in', 'log in', 'sign in', 'forgot password', 'invalid credentials', 'new device login', 'loggin in'],
      response: 'Please check your Institution ID, email, and password. If the issue persists, reset your password.',
    },
    {
      id: 'dashboard_navigation',
      keywords: ['dashboard', 'navigate', 'tasks', 'menu', 'sidebar'],
      samples: ['what is dashboard', 'how to navigate', 'where are tasks', 'where is tasks', 'tasks'],
      response: 'The dashboard provides an overview of activities, key stats, and quick access to features.',
    },
    {
      id: 'inquiries',
      keywords: ['inquiry', 'inquiries', 'lead', 'student', 'follow', 'followup', 'follow-up'],
      samples: ['add inquiry', 'edit inquiry', 'delete inquiry', 'follow up', 'follow-up', 'inquiries'],
      response: 'Inquiries are where you track leads/students. Add a new inquiry from the Inquiries module, and use follow-ups inside an inquiry to track reminders and next steps.',
    },
    {
      id: 'applications',
      keywords: ['application', 'admission', 'convert', 'approve', 'reject', 'letter'],
      samples: ['convert inquiry', 'approve application', 'reject application', 'admission letter', 'admission letters'],
      response: 'Applications move forward from inquiries. Convert an inquiry, then approve/reject based on your role and workflow.',
    },
    {
      id: 'users_roles',
      keywords: ['user', 'users', 'account', 'staff', 'role', 'roles'],
      samples: ['add user', 'roles', 'change role'],
      response: 'Roles include admin, manager, and staff. Each role has different permissions.',
    },
    {
      id: 'reports',
      keywords: ['report', 'reports', 'analytics', 'export', 'excel', 'pdf'],
      samples: ['generate report', 'export data'],
      response: 'Go to Reports, select the report type, and generate it. Reports can be exported as Excel or PDF.',
    },
    {
      id: 'errors_help',
      keywords: ['system', 'error', 'not', 'working', 'slow', 'missing', 'data'],
      samples: ['system not working', 'system slow', 'data missing'],
      response: 'Try refreshing the page. If it continues, contact support. If it’s slow, it may be network load—try again shortly.',
    },
    {
      id: 'security',
      keywords: ['safe', 'security', 'data', 'privacy', 'safe', 'who'],
      samples: ['is my data safe', 'who can see my data'],
      response: 'The system uses secure authentication and access control to protect your data. Only authorized users within your organization can access relevant information.',
    },
    {
      id: 'human_support',
      keywords: ['stuck', 'hard', 'understand', 'confused', 'dont understand', 'dont know'],
      samples: ['i feel stuck', 'this is hard', 'i don’t understand'],
      response: 'Take it one step at a time. Tell me what you’re trying to do, and I’ll guide you.',
    },
    {
      id: 'guidance_next',
      keywords: ['help', 'start', 'where', 'begin'],
      samples: ['what should i do next', 'help me', 'where do i start', 'where should i start'],
      response: 'What would you like to do next?',
    },
  ];

  const scored = intents
    .map(intent => {
      // Phrase/set overlap score.
      let phraseScore = 0;
      for (const sample of intent.samples) {
        phraseScore = Math.max(phraseScore, tokenJaccardScore(qNorm, sample));
      }

      // Token overlap + fuzzy token match.
      const tokenSet = new Set(qTokens);
      let tokenScore = 0;
      for (const kw of intent.keywords) {
        const kwToks = tokenizeForIntent(kw);
        const kwBase = kwToks.length ? kwToks[0] : kw;
        if (tokenSet.has(kwBase)) tokenScore += 2;
        else {
          // Fuzzy token match.
          for (const qt of qTokens) {
            if (tokenSimilarity(qt, kwBase) >= 0.82) {
              tokenScore += 1.5;
              break;
            }
          }
        }
      }

      // Small boost for direct substring matches.
      const directBoost = intent.samples.some(s => qNorm.includes(normalizeHumanText(s)) && normalizeHumanText(s).length >= 4) ? 2 : 0;

      const score = phraseScore * 10 + tokenScore + directBoost;
      return { intent, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score < 5.5) return null;

  // Special-case greetings to keep responses aligned.
  if (top.intent.id === 'greeting') {
    if (/\bgood\s*morning\b/.test(qNorm)) return 'Good morning. Ready to make progress today?';
    if (/\bgood\s*afternoon\b/.test(qNorm)) return 'Good afternoon. How can I assist you?';
    if (/\bgood\s*evening\b/.test(qNorm)) return 'Good evening. You’re doing well. How can I help?';
    if (/\bhow\s+are\s+you\b/.test(qNorm)) return 'I’m here and ready to assist you.';
    if (/\bwho\s+are\s+you\b/.test(qNorm)) return 'I am your assistant inside the CRM, here to help you navigate and complete tasks efficiently.';
    if (/\bwhat\s+can\s+you\s+do\b/.test(qNorm)) return 'I can guide you through the system, answer your questions, and help you complete tasks faster.';
    if (/\bhi\b/.test(qNorm) || /\bhey\b/.test(qNorm)) return 'Hi there. What would you like to do today?';
    return 'Hello. How can I assist you with the CRM today?';
  }

  // Special-case login variations.
  if (top.intent.id === 'login') {
    if (/\bforgot\s+password\b/.test(qNorm) || /\breset\b/.test(qNorm)) {
      return 'Use the password reset option on the login page to create a new password.';
    }
    if (/\binvalid\b/.test(qNorm) || /\bcredentials\b/.test(qNorm)) {
      return 'This usually means your login details are incorrect. Double-check and try again.';
    }
    if (/\bnew\s+device\b/.test(qNorm) || /\bverify\b/.test(qNorm)) {
      return 'For security, you may be asked to verify your identity when using a new device.';
    }
    return 'Please check your Institution ID, email, and password. If the issue persists, reset your password.';
  }

  return top.intent.response;
}

function wantsGuidanceQuestion(question: string): boolean {
  const qNorm = normalizeHumanText(question);
  if (!qNorm) return false;
  const tokens = new Set(tokenizeForIntent(question));

  // Word-order insensitive checks.
  if (/\bhelp\b/.test(qNorm) && /\bme\b/.test(normalizeHumanText(question))) return true;
  if (tokens.has('where') && (tokens.has('start') || tokens.has('begin'))) return true;
  if (tokens.has('what') && tokens.has('should') && tokens.has('do') && tokens.has('next')) return true;

  // Fallback for phrases like "what do i do next"
  if (/\bwhat\b/.test(qNorm) && /\bnext\b/.test(qNorm) && /\bdo\b/.test(qNorm)) return true;
  return false;
}

type AssistantAction = { label: string; href: string };

function handlePendingChoice(
  pendingChoice: string,
  question: string
): { handled: boolean; answer: string; actions?: AssistantAction[]; nextPendingChoice?: string | null } {
  const qNorm = normalizeHumanText(question);
  const qTokens = tokenizeForIntent(question);

  const hasFuzzyToken = (target: string, threshold = 0.82): boolean => {
    for (const t of qTokens) {
      if (tokenSimilarity(t, target) >= threshold) return true;
    }
    return false;
  };

  // Normalize yes/no and action keywords.
  const saysYes = /\b(yes|yeah|yep|ok|okay|sure|please|please\s+do)\b/.test(qNorm);
  const saysNo = /\b(no|nope|nah|not\s+now|cancel|skip)\b/.test(qNorm);

  const saysAddInquiry =
    /\b(add|create|new|insert)\b/.test(qNorm) &&
    (/\blead/i.test(qNorm) || hasFuzzyToken('inquiry') || /\binquir/i.test(qNorm));
  const saysReview = /\b(review|existing|look|view)\b/.test(qNorm) || /\bno\b/.test(qNorm);

  if (pendingChoice === 'inquiries_add_or_review') {
    if (saysYes || saysAddInquiry) {
      return {
        handled: true,
        answer:
          'Great. Go to Inquiries and add your new inquiry. If you share the inquiry ID after creating it, I can guide you with recommendations and next steps.',
        actions: [
          { label: 'Add New Inquiry', href: '/inquiries' },
          { label: 'Review Inquiries', href: '/inquiries' },
        ],
        nextPendingChoice: null,
      };
    }

    if (saysNo || saysReview) {
      return {
        handled: true,
        answer:
          'Okay. Review existing inquiries in the Inquiries module. If you share an inquiry ID, I can show recommendation/prediction and the latest follow-ups.',
        actions: [
          { label: 'Review Inquiries', href: '/inquiries' },
          { label: 'Add New Inquiry', href: '/inquiries' },
        ],
        nextPendingChoice: null,
      };
    }

    // If the user didn't answer yes/no/add/review, don't keep forcing the inquiry question.
    // Let the main intent engine handle their new request (e.g. "I have problem with loggin in").
    return { handled: false, answer: '' };
  }

  return { handled: false, answer: '' };
}

function topEndpointMatches(index: AskAiIndex, question: string): EndpointEntry[] {
  const qTokens = tokenize(question);
  if (!qTokens.length) return [];

  // Cheap scoring: token overlap + small boosts for method/path tokens.
  const scored = index.endpoints
    .map(e => {
      const set = new Set(e.tokens);
      let overlap = 0;
      for (const t of qTokens) {
        if (set.has(t)) overlap++;
      }
      // Extra weight if path segments match strongly.
      const pathTokens = tokenize(e.path);
      let pathOverlap = 0;
      for (const t of pathTokens) {
        if (qTokens.includes(t)) pathOverlap++;
      }
      const score = overlap + pathOverlap * 0.75;
      return { e, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter(x => x.score > 0)
    .slice(0, 6)
    .map(x => x.e);

  return scored;
}

export const ask = async (req: Request, res: Response): Promise<void> => {
  const { role, email, tenantId } = getRequester(req);
  if (!email || !role) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (!tenantId) {
    res.status(400).json({ error: 'Tenant context missing' });
    return;
  }

  const body = (req.body || {}) as AskAiRequestBody;
  const question = autocorrectQuestion(String(body.question || '').trim());
  if (!question) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  const context = body.context || {};
  const inquiryIdFromCtx = normalizeId(context.inquiryId);
  const followupIdFromCtx = normalizeId(context.followupId);
  const pendingChoice = context.pendingChoice ? String(context.pendingChoice) : null;

  // Handle conversational follow-ups (e.g. user answered "yes/no" to a question).
  if (pendingChoice) {
    const handled = handlePendingChoice(pendingChoice, question);
    if (handled.handled) {
      res.json({
        answer: handled.answer,
        sources: [],
        actions: handled.actions || [],
        pendingChoice: handled.nextPendingChoice || null,
      });
      return;
    }
  }

  const computeFlags = classifyQuestion(question);
  const computeWanted =
    computeFlags.wantsRecommendation || computeFlags.wantsPrediction || computeFlags.wantsReminder || computeFlags.wantsLetters;

  // If user asked for computed facts (recommendation/prediction/reminder/letter), require IDs.
  if (computeWanted && !(inquiryIdFromCtx !== null || followupIdFromCtx !== null)) {
    res.json({
      answer: 'To show that, please share an `inquiryId` (and/or `followupId`).',
      sources: [],
      actions: [],
      pendingChoice: null,
    });
    return;
  }

  // If computed facts are requested and IDs are present, let the existing logic handle it.
  if (!computeWanted) {
    const tokenSet = new Set(tokenizeForIntent(question));
    const { entity } = detectEntity(question, tokenSet);
    const mentions = extractUserMentions(question);

    const qNorm = question;
    const hasHowMany = /\bhow many\b/.test(qNorm) || (tokenSet.has('how') && tokenSet.has('many')) || /\bhowmany\b/.test(qNorm);
    const hasCount = tokenSet.has('count') || /\bcount\b/.test(qNorm) || /\btotal\b/.test(qNorm) || /\bnumber\b/.test(qNorm);
    const isCountIntent = (hasHowMany || hasCount) && (/\b(inquiry|inquiries|follow|followup|registration|registrations|letter|letters|user|users|paid)\b/.test(qNorm) || entity !== null);

    const isListIntent =
      /\b(show|list|view|display)\b/.test(qNorm) || /\b(all)\b/.test(qNorm) || (tokenSet.has('show') && entity !== null);

    const isAnalyticsIntent =
      tokenSet.has('analytics') || tokenSet.has('statistics') || tokenSet.has('performance') || tokenSet.has('insights');

    const isReportIntent = /\b(report|reports|export|excel|pdf)\b/.test(qNorm) || (qNorm.includes('generate report') && !isAnalyticsIntent);

    const isCreateIntent = /\b(add|create|new|insert)\b/.test(qNorm) || tokenSet.has('add') || tokenSet.has('create') || tokenSet.has('new');
    const isUpdateIntent = /\b(update|edit|change|modify)\b/.test(qNorm) || tokenSet.has('update') || tokenSet.has('edit') || tokenSet.has('change');

    const isHelpIntent = /\bhow to\b/.test(qNorm) || /\bhow do\b/.test(qNorm) || /\bwhat is\b/.test(qNorm) || /\bwhere\b/.test(qNorm);

    // A) Analytics (data-driven)
    if (isAnalyticsIntent) {
      const whereInquiries: any = { tenantId };
      if (role === 'admissions_officer') {
        whereInquiries.OR = [
          { createdBy: { equals: email, mode: 'insensitive' } as any },
          { assignedTo: { equals: email, mode: 'insensitive' } as any },
        ];
      }

      const totalInquiries = await prisma.inquiry.count({ where: whereInquiries as any });
      const totalRegistrations = await prisma.inquiry.count({
        where: { ...(whereInquiries as any), paymentStatus: 'Paid' } as any,
      });
      const pendingFollowups = await prisma.followup.count({
        where: {
          tenantId,
          ...(role === 'admissions_officer'
            ? {
                OR: [
                  { createdBy: { equals: email, mode: 'insensitive' } as any },
                  { assignedTo: { equals: email, mode: 'insensitive' } as any },
                  { inquiry: { createdBy: { equals: email, mode: 'insensitive' } as any } } as any,
                  { inquiry: { assignedTo: { equals: email, mode: 'insensitive' } as any } } as any,
                ],
              }
            : {}),
          status: 'pending',
        } as any,
      });

      const conv = totalInquiries > 0 ? (totalRegistrations / totalInquiries) * 100 : 0;
      res.json({
        answer: `Analytics: ${totalInquiries} inquiries, ${totalRegistrations} registrations (conversion ${conv.toFixed(1)}%), ${pendingFollowups} pending follow-ups.`,
        sources: [],
        actions: [],
        pendingChoice: null,
      });
      return;
    }

    // B) Count queries (data-driven)
    if (isCountIntent) {
      if (!entity) {
        res.json({
          answer: 'Do you want the count of inquiries, follow-ups, registrations, admission letters, or users?',
          sources: [],
          actions: [],
          pendingChoice: null,
        });
        return;
      }

      const ownershipInquiryFilter =
        role === 'admissions_officer'
          ? {
              OR: [
                { createdBy: { equals: email, mode: 'insensitive' } as any },
                { assignedTo: { equals: email, mode: 'insensitive' } as any },
              ],
            }
          : null;

      const ownershipFollowupFilter =
        role === 'admissions_officer'
          ? {
              OR: [
                { createdBy: { equals: email, mode: 'insensitive' } as any },
                { assignedTo: { equals: email, mode: 'insensitive' } as any },
                { inquiry: { createdBy: { equals: email, mode: 'insensitive' } as any } } as any,
                { inquiry: { assignedTo: { equals: email, mode: 'insensitive' } as any } } as any,
              ],
            }
          : null;

      const eMentions = mentions;
      if (entity === 'registrations') {
        // Total registrations or registrations for a mentioned user.
        if (eMentions.length > 0) {
          const mentionedEmail = await resolveMentionToUserEmail(eMentions[0], tenantId);
          if (!mentionedEmail) {
            res.json({
              answer: `I couldn’t find a user matching \`@${eMentions[0]}\` in this tenant.`,
              sources: [],
              actions: [],
              pendingChoice: null,
            });
            return;
          }

          const userFilter = {
            OR: [
              { createdBy: { equals: mentionedEmail.toLowerCase(), mode: 'insensitive' } as any },
              { assignedTo: { equals: mentionedEmail.toLowerCase(), mode: 'insensitive' } as any },
            ],
          };

          const where: any = {
            tenantId,
            paymentStatus: 'Paid',
            AND: [userFilter],
          };
          if (ownershipInquiryFilter) where.AND.unshift(ownershipInquiryFilter);

          const cnt = await prisma.inquiry.count({ where });
          res.json({
            answer: `You currently have ${cnt} registrations for @${eMentions[0]}.`,
            sources: [],
            actions: [],
            pendingChoice: null,
          });
          return;
        }

        const where: any = {
          tenantId,
          paymentStatus: 'Paid',
        };
        if (ownershipInquiryFilter) Object.assign(where, ownershipInquiryFilter);
        const total = await prisma.inquiry.count({ where });
        res.json({
          answer: `You currently have ${total} registrations.`,
          sources: [],
          actions: [],
          pendingChoice: null,
        });
        return;
      }

      if (entity === 'inquiries') {
        const where: any = { tenantId };
        if (ownershipInquiryFilter) Object.assign(where, ownershipInquiryFilter);
        const cnt = await prisma.inquiry.count({ where });
        res.json({ answer: `You currently have ${cnt} inquiries.`, sources: [], actions: [], pendingChoice: null });
        return;
      }

      if (entity === 'followups') {
        const where: any = { tenantId };
        if (ownershipFollowupFilter) Object.assign(where, ownershipFollowupFilter);
        const cnt = await prisma.followup.count({ where: where as any });
        res.json({ answer: `You currently have ${cnt} follow-ups.`, sources: [], actions: [], pendingChoice: null });
        return;
      }

      if (entity === 'admission_letters') {
        const where: any = {
          tenantId,
          letterStatus: { not: 'Not Generated' },
        };
        if (ownershipInquiryFilter) Object.assign(where, ownershipInquiryFilter);
        const cnt = await prisma.inquiry.count({ where });
        res.json({ answer: `You currently have ${cnt} admission letters.`, sources: [], actions: [], pendingChoice: null });
        return;
      }

      if (entity === 'users') {
        const cnt = await prisma.user.count({ where: { tenantId } as any });
        res.json({ answer: `You currently have ${cnt} users.`, sources: [], actions: [], pendingChoice: null });
        return;
      }
    }

    // C) List queries (data-driven)
    if (isListIntent) {
      if (!entity) {
        res.json({
          answer: 'What would you like to list: inquiries, follow-ups, or admission letters?',
          sources: [],
          actions: [],
          pendingChoice: null,
        });
        return;
      }

      const whereInquiries: any = { tenantId };
      const whereFollowups: any = { tenantId };
      if (role === 'admissions_officer') {
        whereInquiries.OR = [
          { createdBy: { equals: email, mode: 'insensitive' } as any },
          { assignedTo: { equals: email, mode: 'insensitive' } as any },
        ];
        whereFollowups.OR = [
          { createdBy: { equals: email, mode: 'insensitive' } as any },
          { assignedTo: { equals: email, mode: 'insensitive' } as any },
          { inquiry: { createdBy: { equals: email, mode: 'insensitive' } as any } } as any,
          { inquiry: { assignedTo: { equals: email, mode: 'insensitive' } as any } } as any,
        ];
      }

      if (entity === 'inquiries') {
        const items = await prisma.inquiry.findMany({
          where: whereInquiries as any,
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, fullName: true, status: true, paymentStatus: true, createdAt: true },
        });
        const lines = items.map(
          (i: any) => `#${i.id} ${i.fullName || '-'} • ${i.status || 'Pending'} • ${i.paymentStatus || 'Not Paid'}`
        );
        res.json({
          answer: lines.length ? `Recent inquiries:\n${lines.join('\n')}` : 'No inquiries found yet.',
          sources: [],
          actions: [],
          pendingChoice: null,
        });
        return;
      }

      if (entity === 'followups') {
        const items = await prisma.followup.findMany({
          where: whereFollowups as any,
          orderBy: { scheduledFor: 'desc' },
          take: 5,
          select: { id: true, type: true, status: true, scheduledFor: true, inquiryName: true },
        });
        const lines = items.map(
          (f: any) => `${f.type || 'followup'} • ${f.status || 'pending'} • ${f.inquiryName || '-'} • ${f.scheduledFor ? new Date(f.scheduledFor).toISOString().slice(0, 10) : '-'}`
        );
        res.json({
          answer: lines.length ? `Recent follow-ups:\n${lines.join('\n')}` : 'No follow-ups found yet.',
          sources: [],
          actions: [],
          pendingChoice: null,
        });
        return;
      }

      if (entity === 'admission_letters') {
        const items = await prisma.inquiry.findMany({
          where: {
            ...(whereInquiries as any),
            letterStatus: { not: 'Not Generated' },
          } as any,
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, fullName: true, letterStatus: true, letterReferenceNumber: true, letterSerialNumber: true, createdAt: true },
        });
        const lines = items.map(
          (i: any) => `#${i.id} ${i.fullName || '-'} • ${i.letterStatus || 'Generated'} • ref:${i.letterReferenceNumber || '-'} • serial:${i.letterSerialNumber || '-'}`
        );
        res.json({
          answer: lines.length ? `Recent admission letters:\n${lines.join('\n')}` : 'No admission letters generated yet.',
          sources: [],
          actions: [],
          pendingChoice: null,
        });
        return;
      }
    }

    // D) Analytics/Report/Profile/Create/Update actions (guidance-only)
    if (isReportIntent) {
      res.json({
        answer: 'Opening Reports… you can generate or export from here.',
        sources: [],
        actions: [{ label: 'Open Reports', href: '/reports' }],
        pendingChoice: null,
      });
      return;
    }

    if (isUpdateIntent) {
      if (/\bpassword\b/.test(qNorm) || tokenSet.has('password')) {
        res.json({
          answer: 'Opening password reset…',
          sources: [],
          actions: [{ label: 'Reset Password', href: '/forgot-password' }],
          pendingChoice: null,
        });
        return;
      }
      if (entity === 'profile' || tokenSet.has('profile')) {
        res.json({
          answer: 'Opening your profile settings…',
          sources: [],
          actions: [{ label: 'Open Settings', href: '/settings' }],
          pendingChoice: null,
        });
        return;
      }
    }

    if (isCreateIntent) {
      if (!entity) {
        res.json({
          answer: 'What would you like to create: an inquiry, follow-up, registration, or admission letter?',
          sources: [],
          actions: [],
          pendingChoice: null,
        });
        return;
      }

      if (entity === 'inquiries') {
        res.json({
          answer: 'Opening inquiry form…',
          sources: [],
          actions: [{ label: 'Add New Inquiry', href: '/inquiries' }],
          pendingChoice: null,
        });
        return;
      }
      if (entity === 'followups') {
        res.json({
          answer: 'Opening follow-ups…',
          sources: [],
          actions: [{ label: 'Go to Follow-ups', href: '/followups' }],
          pendingChoice: null,
        });
        return;
      }
      if (entity === 'registrations') {
        res.json({
          answer: 'Opening registration form…',
          sources: [],
          actions: [{ label: 'Create Registration', href: '/registrations' }],
          pendingChoice: null,
        });
        return;
      }
      if (entity === 'admission_letters') {
        res.json({
          answer: 'Opening admission letters…',
          sources: [],
          actions: [{ label: 'Generate Admission Letter', href: '/admission-letters' }],
          pendingChoice: null,
        });
        return;
      }
      if (entity === 'users') {
        res.json({
          answer: 'Opening user management…',
          sources: [],
          actions: [{ label: 'Open Settings', href: '/settings' }],
          pendingChoice: null,
        });
        return;
      }
    }

    // E) Help intents (short, actionable)
    if (isHelpIntent && entity) {
      if (entity === 'inquiries') {
        res.json({
          answer: 'To add an inquiry: open Inquiries and click “Add New Inquiry”. To follow up, open the inquiry and use Follow-ups.',
          sources: [],
          actions: [{ label: 'Go to Inquiries', href: '/inquiries' }],
          pendingChoice: null,
        });
        return;
      }
      if (entity === 'followups') {
        res.json({
          answer: 'To add a follow-up, open an inquiry and use the Follow-ups section.',
          sources: [],
          actions: [{ label: 'Go to Follow-ups', href: '/followups' }],
          pendingChoice: null,
        });
        return;
      }
      if (entity === 'registrations') {
        res.json({
          answer: 'To create a registration, open Registrations and click to add a new one.',
          sources: [],
          actions: [{ label: 'Go to Registrations', href: '/registrations' }],
          pendingChoice: null,
        });
        return;
      }
      if (entity === 'admission_letters') {
        res.json({
          answer: 'To generate an admission letter, open Admission Letters. If needed, share an inquiryId.',
          sources: [],
          actions: [{ label: 'Go to Admission Letters', href: '/admission-letters' }],
          pendingChoice: null,
        });
        return;
      }
    }

    // F) Guidance / onboarding (context-aware by data state)
    if (wantsGuidanceQuestion(question)) {
      const whereInquiries: any = { tenantId };
      if (role === 'admissions_officer') {
        whereInquiries.OR = [
          { createdBy: { equals: email, mode: 'insensitive' } as any },
          { assignedTo: { equals: email, mode: 'insensitive' } as any },
        ];
      }
      const totalInquiries = await prisma.inquiry.count({ where: whereInquiries as any });
      if (totalInquiries === 0) {
        res.json({
          answer: 'Looks like you’re getting started. Let’s add your first inquiry.',
          sources: [],
          actions: [{ label: 'Add New Inquiry', href: '/inquiries' }],
          pendingChoice: null,
        });
        return;
      }

      res.json({
        answer: 'Would you like to add a new inquiry or review existing ones?',
        sources: [],
        pendingChoice: 'inquiries_add_or_review',
        actions: [
          { label: 'Add New Inquiry', href: '/inquiries' },
          { label: 'Review Inquiries', href: '/inquiries' },
        ],
      });
      return;
    }

    // G) Human fallback: greetings/login/errors/security (static but user-friendly)
    const faqAnswer = bestHumanFaqAnswer(question);
    if (faqAnswer) {
      res.json({ answer: faqAnswer, sources: [], actions: [], pendingChoice: null });
      return;
    }

    // H) Required fallback sentence (deterministic, no system wording)
    res.json({
      answer: `I didn’t fully understand that. You can ask things like:\n- how many inquiries do we have\n- create a registration\n- show reports`,
      sources: [],
      actions: [],
      pendingChoice: null,
    });
    return;
  }

  const flags = classifyQuestion(question);
  const sources: Source[] = [];

  // Load index for endpoint citations (no LLM, just match relevant endpoints).
  const index = await loadIndex(false);
  const matches = topEndpointMatches(index, question);
  for (const m of matches) {
    sources.push({ file: m.file, route: `${m.method} ${m.path}` });
  }

  const answerParts: string[] = [];
  // -----------------------------
  // Natural language: registrations counts (+ @mentions)
  // -----------------------------
  const qLower = String(question || '').toLowerCase();
  const wantsRegistrationsCount = /\b(how many|count|number of)\b/.test(qLower) && /\b(registration|registrations|registered)\b/.test(qLower);
  const mentions = extractUserMentions(question);

  if (wantsRegistrationsCount) {
    if (mentions.length > 0) {
      const mentionedEmail = await resolveMentionToUserEmail(mentions[0], tenantId);
      if (!mentionedEmail) {
        res.json({
          answer: `I couldn’t find a user matching \`@${mentions[0]}\` in this tenant.`,
          sources: [],
        });
        return;
      }
      const cnt = await countRegistrationsForUser(mentionedEmail, tenantId);
      res.json({
        answer: `${cnt} registrations for @${mentions[0]}.`,
        sources: [],
      });
      return;
    }

    const total = await countTotalRegistrations(tenantId);
    res.json({ answer: `${total} registrations.`, sources: [] });
    return;
  }

  // Optionally compute inquiry-specific facts
  const wantsAnyInquiryCompute =
    inquiryIdFromCtx !== null || followupIdFromCtx !== null || flags.wantsRecommendation || flags.wantsPrediction || flags.wantsReminder || flags.wantsLetters || flags.wantsRegistrations;

  let inquiry: any = null;
  let followup: any = null;
  let inquiryId: number | null = inquiryIdFromCtx;

  if (wantsAnyInquiryCompute && (inquiryIdFromCtx !== null || followupIdFromCtx !== null)) {
    // If followupId is provided, derive inquiryId.
    if (followupIdFromCtx !== null) {
      const f = await prisma.followup.findFirst({
        where: { id: followupIdFromCtx, inquiry: { tenantId } },
        include: { inquiry: true, comments: { orderBy: { createdAt: 'asc' } } },
      });
      if (!f) {
        res.status(404).json({ error: 'Follow-up not found for this tenant' });
        return;
      }
      const followupEmail = f.createdBy ? String(f.createdBy).toLowerCase() : '';
      const followupAssignedTo = f.assignedTo ? String(f.assignedTo).toLowerCase() : '';
      const inquiryCreatedBy = f.inquiry?.createdBy ? String(f.inquiry.createdBy).toLowerCase() : '';
      const inquiryAssignedTo = f.inquiry?.assignedTo ? String(f.inquiry.assignedTo).toLowerCase() : '';

      if (role === 'admissions_officer') {
        const isOwner = followupEmail === email || followupAssignedTo === email || inquiryCreatedBy === email || inquiryAssignedTo === email;
        if (!isOwner) {
          res.status(403).json({ error: 'Forbidden: insufficient access to this follow-up' });
          return;
        }
      }

      followup = f;
      inquiryId = f.inquiryId;
    }

    if (inquiryId !== null && inquiryId !== undefined) {
      const i = await prisma.inquiry.findFirst({
        where: { id: inquiryId, tenantId },
        include: { detail: true },
      });
      if (!i) {
        res.status(404).json({ error: 'Inquiry not found for this tenant' });
        return;
      }

      if (role === 'admissions_officer') {
        const createdBy = i.createdBy ? String(i.createdBy).toLowerCase() : '';
        const assignedTo = i.assignedTo ? String(i.assignedTo).toLowerCase() : '';
        const isOwner = createdBy === email || assignedTo === email;
        if (!isOwner) {
          res.status(403).json({ error: 'Forbidden: insufficient access to this inquiry' });
          return;
        }
      }

      inquiry = i;
    }
  }

  // Build answer based on flags and available context
  if (inquiry) {
    const iName = inquiry.fullName || inquiry.name || '';
    const header = inquiryId ? `Inquiry context: ${iName ? `${iName} (ID ${inquiryId})` : `ID ${inquiryId}`}` : 'Inquiry context: available';
    answerParts.push(header);

    if (flags.wantsRecommendation) {
      const recommendation = await getNurturingRecommendation(inquiryId as number, tenantId);
      sources.push({ file: 'backend/src/utils/followupNurturing.ts', route: 'getNurturingRecommendation(inquiryId, tenantId)' });
      answerParts.push(
        recommendation
        ? `Recommendation: ${recommendation}`
        : 'Recommendation: none specific at the moment.'
      );
    }

    if (flags.wantsPrediction) {
      const prediction = await predictFollowupOutcome(inquiryId as number, tenantId);
      sources.push({ file: 'backend/src/utils/followupNurturing.ts', route: 'predictFollowupOutcome(inquiryId, tenantId)' });
    answerParts.push(`Prediction: ${prediction.outcome}. Suggested action: ${prediction.action}.`);
    }

    if (flags.wantsReminder) {
      sources.push({ file: 'backend/src/server.ts', route: 'GET /api/inquiries/:id/reminder + POST /api/inquiries/:id/reminder/response' });
      answerParts.push(
      `Reminder: status="${inquiry.reminderStatus || 'Pending'}", last sent=${inquiry.lastReminderSent ? new Date(inquiry.lastReminderSent).toISOString() : 'never'}, last response="${String(inquiry.lastReminderResponse || '').slice(0, 140) || '-'}", sentiment="${inquiry.engagementSentiment || 'neutral'}".`
      );
    }

    if (flags.wantsLetters) {
      sources.push({ file: 'backend/src/controllers/admissionLetter.controller.ts', route: 'POST /api/admission-letters + POST /api/admission-letters/generate (+ bulk)' });
      answerParts.push(
      `Admission letter: ${inquiry.letterStatus || 'Not Generated'} (ref: ${inquiry.letterReferenceNumber || '-'}, serial: ${inquiry.letterSerialNumber || '-'})`
      );
    }

    if (flags.wantsRegistrations) {
      sources.push({ file: 'frontend/src/components/marketing/RegistrationsList.tsx', route: 'Registrations list uses inquiries.paymentStatus === "Paid"' });
      const isRegistration = String(inquiry.paymentStatus || '').toLowerCase() === 'paid';
    answerParts.push(isRegistration ? 'Status: registered (paid).' : 'Status: not registered (not paid).');
    }

    // If the user asked about follow-up details but provided inquiryId only.
    if (flags.wantsFollowupDetails && !followupIdFromCtx) {
      sources.push({ file: 'backend/src/controllers/followup.controller.ts', route: 'GET /api/followups?inquiryId=...' });
      // Don't dump full follow-up list by default; instead, show recent summary.
      const followups = await prisma.followup.findMany({
        where: { inquiryId: inquiry.id, tenantId },
        orderBy: { scheduledFor: 'desc' },
        take: 5,
      });
      answerParts.push(
        `Recent follow-ups (up to 5): ${
          followups.map((f: any) => `${f.type || 'followup'}:${f.status}:${new Date(f.scheduledFor).toISOString().slice(0, 10)}`).join(', ')
        }${followups.length ? '' : 'none'}.`
      );
    }
  } else if (inquiryIdFromCtx !== null || followupIdFromCtx !== null) {
    // Context IDs were provided but we didn't load inquiry/followup (should not happen).
    answerParts.push('I couldn’t load the provided ID(s). Please verify the ID and your permissions.');
  }

  // Follow-up details if followupId is provided
  if (followup && flags.wantsFollowupDetails) {
    sources.push({ file: 'backend/src/routes/followup.routes.ts', route: 'GET /api/followups/:inquiryId/recommendation + GET /api/followups/:inquiryId/prediction' });
    const cCount = Array.isArray(followup.comments) ? followup.comments.length : 0;
    const recentComments = (Array.isArray(followup.comments) ? followup.comments : []).slice(-4);
    const commentText = recentComments.length
      ? recentComments.map((c: any) => `${c.createdBy || 'Unknown'}: "${String(c.comment || '').slice(0, 140)}"`).join(' | ')
      : '-';
    answerParts.push(
      `Follow-up details: type="${followup.type || '-'}", status="${followup.status || '-'}", scheduledFor=${followup.scheduledFor ? new Date(followup.scheduledFor).toISOString() : 'null'}, notes="${String(followup.notes || '').slice(0, 180) || '-'}", comments=${cCount}. Recent comments: ${commentText}`
    );
  }

  // If no specific context compute was requested, provide endpoint guidance.
  const needsGenericHelp = !inquiry && !(inquiryIdFromCtx !== null || followupIdFromCtx !== null);
  if (flags.wantsEndpointHelp || needsGenericHelp) {
    if (needsGenericHelp) {
      answerParts.push("I’m not sure about that yet, but I can help you navigate the system. Try asking about tasks, inquiries, or applications.");
    } else {
      // If we can see relevant internal endpoints, guide the user to add IDs for computed results.
      answerParts.push('If you share an inquiryId or followupId, I can give more specific computed guidance.');
    }
  }

  let answer = answerParts.join('\n\n');

  const isGeneric = answer.includes("I'm not sure about that yet") || answer.includes("I can help you navigate");
  const isGreeting = /^(hi|hello|hey|good\s+(morning|afternoon|evening)|what'?s\s+up|yo|sup)\b/i.test(question.trim());
  if ((isGeneric || isGreeting) && process.env.AI_API_KEY) {
    try {
      const { callLLM: llm } = await import('../utils/llmClient');
      const llmAnswer = await llm(`The user is using an EduSmart CRM system for educational institutions. They said: "${question}". Respond helpfully and concisely as an AI assistant for this CRM. Keep it under 3 sentences.`);
      if (llmAnswer) answer = llmAnswer;
    } catch {}
  }

  res.json({ answer, sources });
};

export const reindex = async (req: Request, res: Response): Promise<void> => {
  const { role } = getRequester(req);
  if (!(role === 'admin' || role === 'senior_staff')) {
    res.status(403).json({ error: 'Forbidden: only admin/senior_staff can reindex' });
    return;
  }
  try {
    const index = await loadIndex(true);
    res.json({ success: true, endpoints: index.endpoints.length, generatedAt: index.generatedAt });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to reindex', details: e?.message || String(e) });
  }
};

export const status = async (_req: Request, res: Response): Promise<void> => {
  try {
    const idx = await loadIndex(false);
    res.json({
      version: idx.version,
      generatedAt: idx.generatedAt,
      endpoints: idx.endpoints.length,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load index', details: e?.message || String(e) });
  }
};

// Backwards-compatible export for the router
export const askAiController = { ask: ask as any, reindex, status };

