/* apps/calculator.js —— 计算器：键位坐标忠实原工程
 * 行 y=-80/-150/-220/-290、列 x=-105/-35/35/105、= 在 (105,-255)、按下态缩放 0.8。
 * 原工程反编译中未见运算逻辑（按键仅动画），本实现按「真实网页项目」要求提供完整四则运算。 */

const KEYS = [
  ["1", -105, -80], ["2", -35, -80], ["3", 35, -80], ["+", 105, -80],
  ["4", -105, -150], ["5", -35, -150], ["6", 35, -150], ["-", 105, -150],
  ["7", -105, -220], ["8", -35, -220], ["9", 35, -220],
  ["0", -105, -290], [".", -35, -290], ["删除", 35, -290], ["=", 105, -255],
];

export function mount(win) {
  const root = document.createElement("div");
  root.className = "aw-master";
  root.style.display = "flex";
  root.style.flexDirection = "column";

  const screen = document.createElement("div");
  screen.className = "calc-screen";
  screen.innerHTML = `<div class="calc-expr"></div><div class="calc-out">0</div>`;
  root.appendChild(screen);

  const pad = document.createElement("div");
  pad.className = "calc-pad";
  root.appendChild(pad);

  const exprEl = screen.querySelector(".calc-expr");
  const outEl = screen.querySelector(".calc-out");

  let expr = "";
  let justEvaluated = false;

  const evaluate = (s) => {
    // 仅 + - 与小数，逐项左结合（无需 eval）
    const tokens = s.match(/(\d+\.?\d*|\+|-)/g);
    if (!tokens) return null;
    let acc = parseFloat(tokens[0]);
    let i = 1;
    while (i < tokens.length) {
      const op = tokens[i], num = parseFloat(tokens[i + 1]);
      if (Number.isNaN(num)) return null;
      acc = op === "+" ? acc + num : acc - num;
      i += 2;
    }
    if (!Number.isFinite(acc)) return null;
    return Math.round(acc * 1e10) / 1e10;
  };

  const render = () => {
    exprEl.textContent = expr.replace(/\+/g, " + ").replace(/-/g, " − ");
    const v = evaluate(expr);
    outEl.textContent = v === null ? (expr ? "…" : "0") : String(v);
  };

  const press = (key, node) => {
    node.classList.add("pressed");
    setTimeout(() => node.classList.remove("pressed"), 110);
    if (key === "删除") {
      expr = expr.slice(0, -1);
    } else if (key === "=") {
      const v = evaluate(expr);
      if (v !== null) { expr = String(v); justEvaluated = true; }
    } else if (key === "+" || key === "-") {
      if (expr && !/[+-]$/.test(expr)) expr += key;
      else if (/[+-]$/.test(expr)) expr = expr.slice(0, -1) + key;
    } else {
      if (justEvaluated) { expr = ""; justEvaluated = false; }
      if (key === "." && /\.\d*$/.test(expr.split(/[+-]/).pop() || "")) return;
      expr += key;
    }
    render();
  };

  for (const [label, x, y] of KEYS) {
    const k = document.createElement("button");
    k.className = `calc-key ${"+-=".includes(label) ? "op" : ""} ${label === "=" ? "eq" : ""}`;
    k.textContent = label;
    // scratch (x,y) → 窗口内 css：窗口左上角为 scratch (-150,324)
    k.style.left = `${150 + x}px`;
    k.style.top = `${324 - y}px`;
    k.addEventListener("pointerdown", (e) => { e.stopPropagation(); press(label, k); });
    pad.appendChild(k);
  }

  render();
  win.appendChild(root);
  return { destroy() { } };
}
