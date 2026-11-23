// Asia/Bangkok timezone & Thai formatting utilities
import { StatementTransaction } from '../types';

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Clean and parse numeric amounts from string or numbers, stripping commas and currency symbols.
 * Supports negative numbers formatted as "-1,234.56", "1,234.56-", "(1,234.56)", or "1,234.56 DR"/"OD".
 */
export function cleanNumericAmount(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-' || trimmed === '--') return 0;
    const isParenNegative = /^\(.*\)$/.test(trimmed);
    const isTrailingMinus = trimmed.endsWith('-');
    const isDrNegative = /\b(DR|OD)\s*$/i.test(trimmed) && !trimmed.startsWith('+');
    const cleaned = trimmed.replace(/,/g, '').replace(/[^0-9.-]/g, '').replace(/(?!^)-/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    if ((isParenNegative || isTrailingMinus || isDrNegative) && num > 0) {
      return -num;
    }
    return num;
  }
  return 0;
}

/**
 * Checks whether a raw field explicitly contains a numeric value (including 0 or negative numbers).
 */
export function hasExplicitNumericValue(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return !isNaN(val);
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t || t === '-' || t === '--') return false;
    return /\d/.test(t);
  }
  return false;
}

/**
 * Format currency in THB format (accepts number or numeric string with commas)
 */
export function formatCurrency(amount: number | string | null | undefined, includeSymbol: boolean = true): string {
  const numeric = typeof amount === 'number' ? (isNaN(amount) ? 0 : amount) : cleanNumericAmount(amount);
  const formatted = numeric.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return includeSymbol ? `${formatted} ฿` : formatted;
}

/**
 * Robustly normalizes various date formats to standard ISO YYYY-MM-DD (Gregorian).
 * Corrects Thai Buddhist Era years (2500-2650 -> 1957-2107) and 2-digit years (e.g. 67 -> 2024, or 2067 -> 2024).
 */
export function normalizeDateISO(dateInput: string | null | undefined): string {
  if (!dateInput || typeof dateInput !== 'string') return '';
  const trimmed = dateInput.trim();
  if (!trimmed || trimmed === '-') return '';

  // 1. Check YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    const month = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(isoMatch[3], 10)).padStart(2, '0');

    if (year >= 2500 && year <= 2650) {
      year -= 543;
    } else if (year >= 2060 && year <= 2085) {
      // 2-digit BE year misparsed as 20xx (e.g. 67 -> 2067 -> 2024)
      year -= 43;
    }

    return `${year}-${month}-${day}`;
  }

  // 2. Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const month = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    let year = parseInt(dmyMatch[3], 10);

    if (year < 100) {
      // 2-digit year (60-85 -> 2560-2585 BE -> 2017-2042 CE)
      if (year >= 60 && year <= 85) {
        year = 2500 + year - 543;
      } else {
        year = 2000 + year;
      }
    } else if (year >= 2500 && year <= 2650) {
      year -= 543;
    } else if (year >= 2060 && year <= 2085) {
      year -= 43;
    }

    return `${year}-${month}-${day}`;
  }

  // 3. Fallback date parse
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      let year = d.getFullYear();
      if (year >= 2500 && year <= 2650) year -= 543;
      else if (year >= 2060 && year <= 2085) year -= 43;
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {}

  return trimmed;
}

/**
 * Convert ISO Date (YYYY-MM-DD) or Timestamp to Thai Buddhist Era Date (e.g., 15 ต.ค. 2567)
 */
export function formatThaiDate(dateStr: string | null | undefined, isFull: boolean = false): string {
  if (!dateStr) return '-';
  try {
    const normalized = normalizeDateISO(dateStr);
    const d = new Date(normalized || dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const day = d.getDate();
    const month = d.getMonth();
    let year = d.getFullYear();

    // Calculate Buddhist Era year accurately
    let thaiYear: number;
    if (year >= 2500) {
      thaiYear = year; // Already Buddhist Era
    } else if (year >= 2060 && year <= 2085) {
      thaiYear = year + 500; // Correct misparsed 20xx BE
    } else {
      thaiYear = year + 543;
    }

    const monthStr = isFull ? THAI_MONTHS_FULL[month] : THAI_MONTHS_SHORT[month];
    return `${day} ${monthStr} ${thaiYear}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format date & time in Thai (e.g. 15 ต.ค. 2567 14:30)
 */
export function formatThaiDateTime(dateTimeStr: string | null | undefined): string {
  if (!dateTimeStr) return '-';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;

    const day = d.getDate();
    const month = d.getMonth();
    let year = d.getFullYear();

    let thaiYear: number;
    if (year >= 2500) {
      thaiYear = year;
    } else if (year >= 2060 && year <= 2085) {
      thaiYear = year + 500;
    } else {
      thaiYear = year + 543;
    }

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day} ${THAI_MONTHS_SHORT[month]} ${thaiYear} ${hours}:${minutes} น.`;
  } catch {
    return dateTimeStr;
  }
}

/**
 * Get current ISO date in Asia/Bangkok
 */
export function getBangkokTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate simple SHA-256 like hex hash for image base64 duplicate check
 */
export async function computeBase64Hash(base64: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(base64.slice(0, 10000) + base64.slice(-10000));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Simple fallback hash
    let hash = 0;
    for (let i = 0; i < base64.length; i++) {
      hash = (hash << 5) - hash + base64.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Classifies whether a Thai/English bank transaction description or code represents a Credit (Deposit) or Debit (Withdrawal).
 * Covers KBANK, SCB, BBL, KTB, TTB, BAY, GSB, BAAC, UOB, EXIM.
 */
function classifyTransactionDirection(description: string, typeOrCode: string, channel: string): 'credit' | 'debit' {
  const combined = `${typeOrCode} ${description} ${channel}`.toLowerCase();
  const codeUpper = typeOrCode.trim().toUpperCase();

  // Explicit bank transaction codes (SCB, BBL, KTB, KBANK, TTB)
  const creditCodes = new Set(['X1', 'CD', 'DP', 'DEP', 'CR', 'IN', 'INT', 'TRR', 'RFT', 'ฝาก', 'รับโอน']);
  const debitCodes = new Set(['X2', 'SW', 'SD', 'WD', 'WDL', 'DR', 'FE', 'FEE', 'CHQ', 'CHK', 'AT', 'ATS', 'POS', 'PMT', 'ENET', 'ถอน', 'โอน']);

  if (creditCodes.has(codeUpper)) return 'credit';
  if (debitCodes.has(codeUpper)) return 'debit';

  // High-priority debit phrases (checked before credit because "โอนเงิน" or "ชำระ" is debit unless "รับโอน")
  const isExplicitCredit =
    combined.includes('รับโอน') ||
    combined.includes('โอนเข้า') ||
    combined.includes('เงินโอนเข้า') ||
    combined.includes('ฝากเงิน') ||
    combined.includes('รายการฝาก') ||
    combined.includes('เงินฝาก') ||
    combined.includes('นำฝาก') ||
    combined.includes('ฝากเช็ค') ||
    combined.includes('ดอกเบี้ยรับ') ||
    combined.includes('ดอกเบี้ยเงินฝาก') ||
    combined.includes('เงินเข้า') ||
    combined.includes('รับเงิน') ||
    combined.includes('คืนเงิน') ||
    combined.includes('refund') ||
    combined.includes('deposit') ||
    combined.includes('credit') ||
    combined.includes('cash in');

  const isExplicitDebit =
    combined.includes('โอนไป') ||
    combined.includes('โอนออก') ||
    combined.includes('ถอนเงิน') ||
    combined.includes('รายการถอน') ||
    combined.includes('ถอน') ||
    combined.includes('หักบัญชี') ||
    combined.includes('หักเงิน') ||
    combined.includes('ชำระเงิน') ||
    combined.includes('เพื่อชำระ') ||
    combined.includes('จ่ายบิล') ||
    combined.includes('จ่ายเงิน') ||
    combined.includes('ค่าธรรมเนียม') ||
    combined.includes('ภาษีหัก') ||
    combined.includes('ดอกเบี้ยจ่าย') ||
    combined.includes('ดอกเบี้ย od') ||
    combined.includes('interest charge') ||
    combined.includes('fee') ||
    combined.includes('withdrawal') ||
    combined.includes('withdraw') ||
    combined.includes('debit') ||
    combined.includes('payment') ||
    combined.includes('cash out') ||
    (!combined.includes('รับโอน') && (combined.includes('โอนเงิน') || combined.includes('ชำระ')));

  if (isExplicitCredit && !isExplicitDebit) {
    return 'credit';
  }
  if (isExplicitDebit && !isExplicitCredit) {
    return 'debit';
  }
  if (isExplicitCredit) {
    return 'credit';
  }
  return 'debit';
}

/**
 * Normalizes a transaction row from OCR or database, reconciling all variations
 * of debit, credit, and balance field names across Thai banks (KBANK, SCB, BBL, KTB, TTB, BAY, GSB),
 * stripping commas, and combining descriptions.
 */
export function normalizeStatementTransaction(t: any): StatementTransaction {
  if (!t || typeof t !== 'object') {
    return {
      id: 'tx_' + Math.random().toString(36).substring(2, 7),
      date: '',
      description: '',
      debitAmount: 0,
      creditAmount: 0,
      balance: 0,
    };
  }

  // 1. Debit (เงินออก / ถอน) - take Math.abs in case OCR outputs negative numbers like -550.00
  const rawDebit = cleanNumericAmount(
    t.debitAmount ??
    t.debit ??
    t.drAmount ??
    t.withdrawalAmount ??
    t.withdrawal ??
    t.withdraw ??
    t.payout ??
    t.expense ??
    t.paidOut ??
    t.moneyOut ??
    t.outflow ??
    t['รายการถอน'] ??
    t['รายการถอน (Debit)'] ??
    t['ถอน (Debit)'] ??
    t.ถอนเงิน ??
    t.ถอน ??
    t.เดบิต ??
    t.เงินออก ??
    t.จ่าย ??
    t.dr
  );
  let debit = Math.abs(rawDebit);

  // 2. Credit (เงินเข้า / ฝาก) - if negative and debit is 0, treat as debit; otherwise Math.abs
  const rawCredit = cleanNumericAmount(
    t.creditAmount ??
    t.credit ??
    t.crAmount ??
    t.depositAmount ??
    t.deposit ??
    t.received ??
    t.income ??
    t.paidIn ??
    t.moneyIn ??
    t.inflow ??
    t['รายการฝาก'] ??
    t['รายการฝาก (Credit)'] ??
    t['ฝาก (Credit)'] ??
    t.ฝากเงิน ??
    t.ฝาก ??
    t.เครดิต ??
    t.เงินเข้า ??
    t.รับ ??
    t.cr
  );
  let credit = 0;
  if (rawCredit < 0 && debit === 0) {
    debit = Math.abs(rawCredit);
  } else {
    credit = Math.abs(rawCredit);
  }

  // 3. Balance (ยอดเงินคงเหลือ) - can be positive, 0, or negative (for Overdraft / OD accounts)
  const balance = cleanNumericAmount(
    t.balance ??
    t.runningBalance ??
    t.outstandingBalance ??
    t.currentBalance ??
    t.remainingBalance ??
    t.ledgerBalance ??
    t.endingBalance ??
    t.totalBalance ??
    t.balanceAmount ??
    t['ยอดคงเหลือ (บาท)'] ??
    t['คงเหลือ'] ??
    t.ยอดคงเหลือ
  );

  // Combine transaction type/code and detailed memo into description if separated
  const typePart = String(t.transactionType || t.type || t.code || t.txCode || t.รายการ || '').trim();
  const detailPart = String(t.description || t.details || t.รายละเอียด || t.memo || t.remarks || '').trim();
  let fullDesc = detailPart;
  if (typePart && detailPart && !detailPart.includes(typePart)) {
    fullDesc = `${typePart}: ${detailPart}`;
  } else if (typePart && !detailPart) {
    fullDesc = typePart;
  }
  if (!fullDesc) fullDesc = 'รายการเดินบัญชี';

  const channelVal = String(t.channel || t.ช่องทาง || t.channelCode || '').trim();

  // 4. Handle combined "ถอนเงิน / ฝากเงิน" or generic amount field if both debit and credit are 0
  const rawGenericVal =
    t.amount ??
    t.transactionAmount ??
    t.value ??
    t['ถอนเงิน / ฝากเงิน'] ??
    t['ถอนเงิน/ฝากเงิน'] ??
    t['ฝาก / ถอน'] ??
    t['ถอน / ฝาก'] ??
    t.ถอนเงิน_ฝากเงิน ??
    t.withdraw_deposit ??
    t.withdrawal_deposit ??
    t['จำนวนเงิน'] ??
    t.จำนวนเงิน ??
    t.ยอดเงิน ??
    t.money ??
    t.netAmount;

  const genericAmount = cleanNumericAmount(rawGenericVal);

  if (debit === 0 && credit === 0 && genericAmount !== 0) {
    const rawStr = typeof rawGenericVal === 'string' ? rawGenericVal.trim() : '';
    const hasExplicitPlus = rawStr.startsWith('+') || /\bCR\s*$/i.test(rawStr);
    const hasExplicitMinus = genericAmount < 0 || rawStr.startsWith('-') || /\bDR\s*$/i.test(rawStr);

    if (hasExplicitMinus && !hasExplicitPlus) {
      debit = Math.abs(genericAmount);
    } else if (hasExplicitPlus && !hasExplicitMinus) {
      credit = Math.abs(genericAmount);
    } else {
      const dir = classifyTransactionDirection(fullDesc, typePart, channelVal);
      if (dir === 'credit') {
        credit = Math.abs(genericAmount);
      } else {
        debit = Math.abs(genericAmount);
      }
    }
  }

  const sourcePageNum = Number(t.sourcePage || t.pageNumber) || 1;

  return {
    id: t.id || 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    date: normalizeDateISO(t.date) || t.date || '',
    time: String(t.time || t['เวลา/วันที่มีผล'] || t.effectiveTime || '').trim(),
    description: fullDesc,
    channel: channelVal,
    debitAmount: debit > 0 ? debit : 0,
    creditAmount: credit > 0 ? credit : 0,
    balance: balance,
    referenceNo: String(t.referenceNo || t.refNo || t.เลขที่อ้างอิง || '').trim(),
    projectId: t.projectId || '',
    projectName: t.projectName || '',
    category: t.category || '',
    notes: String(t.notes || '').trim(),
    sourcePage: sourcePageNum,
  };
}

/**
 * Normalizes an entire array of statement transactions with sequential running balance delta reconciliation.
 * Supports all Thai banks (KBANK, SCB, BBL, KTB, TTB, BAY, GSB, BAAC, EXIM):
 * - Single combined column ("ถอนเงิน / ฝากเงิน") or dual columns ("รายการถอน / รายการฝาก")
 * - Positive, zero, AND negative Overdraft (OD) balances (e.g. -9,258,213.05 ฿)
 * - Both chronological (oldest-to-newest) and reverse-chronological (newest-to-oldest) statements
 */
export function normalizeStatementTransactionsList(
  transactions: any[],
  initialOpeningBalance?: number
): StatementTransaction[] {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  // 1. Initial pass: normalize individual fields and track whether each row had an explicit balance
  const list: StatementTransaction[] = transactions.map((t) => normalizeStatementTransaction(t));
  const hasBalanceFlags: boolean[] = transactions.map((t) => {
    if (!t || typeof t !== 'object') return false;
    const rawBal =
      t.balance ??
      t.runningBalance ??
      t.outstandingBalance ??
      t.currentBalance ??
      t.remainingBalance ??
      t.ledgerBalance ??
      t.endingBalance ??
      t.totalBalance ??
      t.balanceAmount ??
      t['ยอดคงเหลือ (บาท)'] ??
      t['คงเหลือ'] ??
      t.ยอดคงเหลือ;
    return hasExplicitNumericValue(rawBal);
  });

  // 2. Determine ordering (Chronological Oldest->Newest vs Reverse-Chronological Newest->Oldest)
  let isChronological = true;
  if (list.length >= 2) {
    const firstDesc = list[0].description || '';
    const lastDesc = list[list.length - 1].description || '';
    const firstIsBf = firstDesc.includes('ยอดยกมา') || firstDesc.includes('Brought Forward') || firstDesc.includes('Beginning Balance');
    const lastIsBf = lastDesc.includes('ยอดยกมา') || lastDesc.includes('Brought Forward') || lastDesc.includes('Beginning Balance');

    if (firstIsBf && !lastIsBf) {
      isChronological = true;
    } else if (lastIsBf && !firstIsBf) {
      isChronological = false;
    } else {
      let forwardDatePairs = 0;
      let backwardDatePairs = 0;
      let forwardTimePairs = 0;
      let backwardTimePairs = 0;

      for (let i = 0; i < list.length - 1; i++) {
        const dA = list[i].date || '';
        const dB = list[i + 1].date || '';
        if (dA && dB && /^\d{4}-\d{2}-\d{2}$/.test(dA) && /^\d{4}-\d{2}-\d{2}$/.test(dB)) {
          if (dA < dB) forwardDatePairs++;
          else if (dA > dB) backwardDatePairs++;
          else {
            // Same date: check time HH:mm
            const tA = (list[i].time || '').trim();
            const tB = (list[i + 1].time || '').trim();
            if (/^\d{1,2}:\d{2}/.test(tA) && /^\d{1,2}:\d{2}/.test(tB)) {
              const normTA = tA.padStart(5, '0');
              const normTB = tB.padStart(5, '0');
              if (normTA < normTB) forwardTimePairs++;
              else if (normTA > normTB) backwardTimePairs++;
            }
          }
        }
      }

      if (backwardDatePairs > forwardDatePairs && backwardDatePairs >= 1) {
        isChronological = false;
      } else if (forwardDatePairs === 0 && backwardDatePairs === 0 && backwardTimePairs > forwardTimePairs) {
        isChronological = false;
      }
    }
  }

  // Work in chronological order (oldest to newest)
  const chronological = isChronological ? [...list] : [...list].reverse();
  const chronoHasBalance = isChronological ? [...hasBalanceFlags] : [...hasBalanceFlags].reverse();

  // Establish baseline balance (supports positive, negative OD, and explicit 0 balances)
  let baselineBalance: number | undefined =
    initialOpeningBalance !== undefined && !isNaN(initialOpeningBalance) && initialOpeningBalance !== 0
      ? initialOpeningBalance
      : undefined;

  // Check if initialOpeningBalance was mistakenly set by AI to the first transaction's ending balance
  if (
    baselineBalance !== undefined &&
    chronological.length > 0 &&
    chronoHasBalance[0] &&
    Math.abs(baselineBalance - chronological[0].balance) < 0.009
  ) {
    const firstDesc = chronological[0].description || '';
    const firstIsOpening =
      firstDesc.includes('ยอดยกมา') ||
      firstDesc.includes('Brought Forward') ||
      firstDesc.includes('Beginning Balance') ||
      firstDesc.includes('ยอดเริ่มต้น');
    if (!firstIsOpening) {
      // If row 0 already has a debit or credit amount extracted, reconstruct the true opening balance before row 0!
      const row0Debit = chronological[0].debitAmount || 0;
      const row0Credit = chronological[0].creditAmount || 0;
      if (row0Debit > 0) {
        baselineBalance = Math.round((chronological[0].balance + row0Debit) * 100) / 100;
      } else if (row0Credit > 0) {
        baselineBalance = Math.round((chronological[0].balance - row0Credit) * 100) / 100;
      } else {
        baselineBalance = undefined;
      }
    }
  }

  for (let i = 0; i < chronological.length; i++) {
    const item = chronological[i];
    const desc = (item.description || '').trim();
    const isOpeningRow =
      desc.includes('ยอดยกมา') ||
      desc.includes('Brought Forward') ||
      desc.includes('Beginning Balance') ||
      desc.includes('ยอดเริ่มต้น');

    // If this row is "ยอดยกมา" (Opening Balance row), establish baseline balance
    if (isOpeningRow) {
      item.debitAmount = 0;
      item.creditAmount = 0;
      if (chronoHasBalance[i] || item.balance !== 0) {
        baselineBalance = item.balance;
      }
      continue;
    }

    const currentBalance = item.balance;
    // A row has a usable balance if it's non-zero OR explicitly 0 when previous balance equals debit
    const hasUsableCurrentBalance =
      (chronoHasBalance[i] && currentBalance !== 0) ||
      currentBalance !== 0 ||
      (chronoHasBalance[i] &&
        currentBalance === 0 &&
        baselineBalance !== undefined &&
        item.debitAmount !== undefined &&
        Math.abs(baselineBalance - item.debitAmount) < 0.01);

    // Step A: If we have both previous baselineBalance and currentBalance, compute from delta!
    // Works for BOTH positive balances AND negative Overdraft (OD) balances!
    if (baselineBalance !== undefined && hasUsableCurrentBalance) {
      const delta = Math.round((baselineBalance - currentBalance) * 100) / 100;
      if (delta > 0.009) {
        // Running balance decreased (e.g. 35,600 -> 35,100 OR -1,000 -> -1,500) -> WITHDRAWAL (เงินออก/ถอน)
        item.debitAmount = delta;
        item.creditAmount = 0;
      } else if (delta < -0.009) {
        // Running balance increased (e.g. 35,100 -> 36,000 OR -1,500 -> -1,000) -> DEPOSIT (เงินเข้า/ฝาก)
        item.creditAmount = Math.abs(delta);
        item.debitAmount = 0;
      }
    }

    // Step B: If STILL missing both debit and credit (e.g. row 0 without ยอดยกมา, or delta was 0),
    // fallback to raw amount fields or transaction type keywords!
    const stillMissing = (!item.debitAmount || item.debitAmount <= 0) && (!item.creditAmount || item.creditAmount <= 0);
    if (stillMissing) {
      const rawIndex = isChronological ? i : chronological.length - 1 - i;
      const rawItem = transactions[rawIndex];
      const rawAmount = Math.abs(
        cleanNumericAmount(
          rawItem?.amount ??
          rawItem?.transactionAmount ??
          rawItem?.value ??
          rawItem?.['ถอนเงิน / ฝากเงิน'] ??
          rawItem?.['ถอนเงิน/ฝากเงิน'] ??
          rawItem?.['ฝาก / ถอน'] ??
          rawItem?.['ถอน / ฝาก'] ??
          rawItem?.['จำนวนเงิน'] ??
          rawItem?.จำนวนเงิน ??
          rawItem?.debitAmount ??
          rawItem?.creditAmount ??
          rawItem?.withdrawalAmount ??
          rawItem?.depositAmount ??
          rawItem?.['รายการถอน'] ??
          rawItem?.['รายการฝาก'] ??
          rawItem?.ถอนเงิน ??
          rawItem?.ฝากเงิน ??
          rawItem?.ถอน ??
          rawItem?.ฝาก
        )
      );

      if (rawAmount > 0) {
        const dir = classifyTransactionDirection(desc, String(rawItem?.transactionType || rawItem?.type || ''), item.channel || '');
        if (dir === 'credit') {
          item.creditAmount = rawAmount;
          item.debitAmount = 0;
        } else {
          item.debitAmount = rawAmount;
          item.creditAmount = 0;
        }
      }
    }

    // Update baseline balance for the next transaction in sequence
    if (hasUsableCurrentBalance) {
      baselineBalance = item.balance;
    } else if (baselineBalance !== undefined) {
      if (item.debitAmount && item.debitAmount > 0) {
        baselineBalance = Math.round((baselineBalance - item.debitAmount) * 100) / 100;
        item.balance = baselineBalance;
      } else if (item.creditAmount && item.creditAmount > 0) {
        baselineBalance = Math.round((baselineBalance + item.creditAmount) * 100) / 100;
        item.balance = baselineBalance;
      }
    }
  }

  return isChronological ? chronological : chronological.reverse();
}

/**
 * Extracts a numeric page order from a filename like "STM_SA6777_Page2.png" or "page_10.jpg"
 */
export function extractPageOrderFromFileName(fileName?: string): number {
  if (!fileName) return 999999;
  const pageMatch = fileName.match(/(?:page|หน้า|p)[_\-\s]*(\d+)/i);
  if (pageMatch) return parseInt(pageMatch[1], 10);
  const numMatches = fileName.match(/(\d+)/g);
  if (numMatches && numMatches.length > 0) {
    return parseInt(numMatches[numMatches.length - 1], 10);
  }
  return 999999;
}


