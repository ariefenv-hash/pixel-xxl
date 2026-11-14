/**
 * calculator.ts — 计算器（原工程 481 块积木的真功能 app）
 *
 * 求值不用 eval：自带 token 化 + 递归下降解析，支持四则、括号、百分比与一元负号。
 * 之所以自己写：eval 会被 CSP 拦、也是明确的注入面；计算器只需要一个 30 行的
 * 语法，没必要引第三方。
 */
import { el } from '../core/dom';
import type { AppModule } from '../core/registry';
import './calculator.css';

/* ------------------------------ 求值内核 ------------------------------ */

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'lp' } | { t: 'rp' };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let s = '';
      while (i < src.length && /[0-9.]/.test(src[i])) s += src[i++];
      out.push({ t: 'num', v: Number(s) });
      continue;
    }
    if ('+-×÷'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      out.push({ t: 'lp' });
      i++;
      continue;
    }
    if (ch === ')') {
      out.push({ t: 'rp' });
      i++;
      continue;
    }
    i++; // 未知字符跳过（键盘只喂合法字符，这里只是兜底）
  }
  return out;
}

/** 递归下降：expr → term (('+'|'-') term)* ; term → unary (('×'|'÷') unary)* */
export function evaluate(src: string): number {
  const toks = tokenize(src);
  let pos = 0;

  const peek = () => toks[pos];
  const eat = () => toks[pos++];

  function expr(): number {
    let left = term();
    while (peek()?.t === 'op' && (peek() as { v: string }).v.match(/[+-]/)) {
      const op = (eat() as { v: string }).v;
      const right = term();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function term(): number {
    let left = unary();
    while (peek()?.t === 'op' && (peek() as { v: string }).v.match(/[×÷]/)) {
      const op = (eat() as { v: string }).v;
      const right = unary();
      if (op === '÷' && right === 0) throw new Error('除数不能为 0');
      left = op === '×' ? left * right : left / right;
    }
    return left;
  }

  function unary(): number {
    const t = peek();
    if (t?.t === 'op' && t.v === '-') {
      eat();
      return -unary();
    }
    if (t?.t === 'op' && t.v === '+') {
      eat();
      return unary();
    }
    return atom();
  }

  function atom(): number {
    const t = eat();
    if (!t) throw new Error('表达式不完整');
    if (t.t === 'num') return t.v;
    if (t.t === 'lp') {
      const v = expr();
      if (eat()?.t !== 'rp') throw new Error('括号未闭合');
      return v;
    }
    throw new Error('意外的符号');
  }

  const value = expr();
  if (pos !== toks.length) throw new Error('表达式有多余内容');
  return value;
}

/** 结果格式化：最多 10 位有效数字，整数不带小数点 */
export function formatResult(v: number): string {
  if (!Number.isFinite(v)) return '错误';
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  const s = v.toPrecision(10);
  return String(Number(s));
}

/* -------------------------------- 界面 -------------------------------- */

const KEYS = [
  ['1', '1', 'num'],
  ['2', '2', 'num'],
  ['3', '3', 'num'],
  ['+', '+', 'op'],
  ['4', '4', 'num'],
  ['5', '5', 'num'],
  ['6', '6', 'num'],
  ['−', '−', 'op'],
  ['7', '7', 'num'],
  ['8', '8', 'num'],
  ['9', '9', 'num'],
  ['=', '=', 'eq'],
  ['0', '0', 'num'],
  ['.', '.', 'num'],
  ['del', '⌫', 'del'],
  ['', '', 'void'],
] as const;

export const mount: AppModule['mount'] = (root, ctx) => {
  let expr = '';
  let result = '0';
  let openParen = false;
  // 按过 = 之后：表达式保留在屏幕上（AOSP 同款），下一次输入再决定是接着算还是重开
  let justEvaluated = false;

  const wrap = el('div', { class: 'calc' });
  wrap.innerHTML =
    '<div class="calc__display">' +
    '<div class="calc__expr" id="calcExpr"></div>' +
    '<div class="calc__result" id="calcResult">0</div>' +
    '</div>' +
    '<div class="calc__keypad" id="calcKeypad"></div>';
  root.append(wrap);

  const exprEl = wrap.querySelector<HTMLElement>('#calcExpr')!;
  const resultEl = wrap.querySelector<HTMLElement>('#calcResult')!;
  const pad = wrap.querySelector<HTMLElement>('#calcKeypad')!;

  // 原版 4×4 布局（计算器 APP 克隆实录，#36）：= 在第 4 列跨 3、4 两行，第 4 行第 4 格为空
  pad.replaceChildren(
    ...KEYS.map(([key, label, kind]) => {
      const b = el('button', {
        class: `calc__key calc__key--${kind}`,
        type: 'button',
        'data-key': key,
      });
      if (kind === 'void') {
        b.disabled = true;
        b.setAttribute('aria-hidden', 'true');
        return b;
      }
      b.textContent = label;
      if (kind === 'eq') { b.style.gridRow = '3 / 5'; b.style.gridColumn = '4'; }
      return b;
    })
  );
  // 长按 ⌫ 清空（原版删除键语义的触屏等价）
  let delTimer = 0;
  pad.addEventListener('pointerdown', (e) => {
    const t = (e.target as HTMLElement).closest('[data-key="del"]');
    if (!t) return;
    delTimer = window.setTimeout(() => {
      expr = '';
      result = '0';
      justEvaluated = false;
      paint();
    }, 550);
  });
  const clearDel = () => window.clearTimeout(delTimer);
  pad.addEventListener('pointerup', clearDel);
  pad.addEventListener('pointerleave', clearDel);
  pad.addEventListener('pointercancel', clearDel);

  const paint = () => {
    // 表达式里的 − 统一成 - 供解析，显示时保留
    exprEl.textContent = expr || '';
    resultEl.textContent = result;
    resultEl.dataset.error = result === '错误' ? '1' : '0';
  };

  const compute = () => {
    if (!expr) {
      result = '0';
      return;
    }
    try {
      // 末尾是运算符时先补一个 0，避免半截表达式报错
      const src = expr.replace(/−/g, '-').replace(/[+\-×÷]$/, '0');
      result = formatResult(evaluate(src));
    } catch (err) {
      result = '错误';
    }
  };

  const press = (key: string) => {
    if (justEvaluated) {
      justEvaluated = false;
      if (/^[0-9.]$/.test(key)) {
        expr = ''; // 输入数字 → 开新表达式
      } else if ('+−×÷'.includes(key) && result !== '错误') {
        expr = result; // 输入运算符 → 用结果接着算
      }
    }
    switch (key) {
      case 'clear':
        expr = '';
        result = '0';
        break;
      case 'paren':
        // 单键切换：未闭合就补 '('，已闭合就补 ')'
        expr += openParen ? ')' : '(';
        openParen = !openParen;
        break;
      case 'pct':
        expr += '%';
        // % 按「除以 100」内联展开，保持表达式可读
        expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1÷100)');
        break;
      case 'sign':
        if (/(^|[+\-×÷(])(\d+(?:\.\d+)?)$/.test(expr)) {
          expr = expr.replace(/(\d+(?:\.\d+)?)$/, '(-$1)');
        } else {
          expr += '-';
        }
        break;
      case '=':
        compute();
        justEvaluated = true;
        if (result === '错误') expr = '';
        openParen = false;
        paint();
        return;
      case '−':
        expr += '−';
        break;
      default:
        expr += key;
        break;
    }
    compute();
    paint();
  };

  pad.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
    if (!btn) return;
    press(btn.dataset.key!);
  });

  // 长按 C 清空表达式（AOSP 的长按清除语义）
  let holdTimer = 0;
  pad.addEventListener('pointerdown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-key="clear"]');
    if (!btn) return;
    holdTimer = window.setTimeout(() => {
      expr = '';
      result = '0';
      openParen = false;
      paint();
      ctx.toast('已清除');
    }, 650);
  });
  const cancelHold = () => window.clearTimeout(holdTimer);
  pad.addEventListener('pointerup', cancelHold);
  pad.addEventListener('pointercancel', cancelHold);

  paint();
  return () => wrap.remove();
};
