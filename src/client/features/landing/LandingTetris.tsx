import { useEffect, useRef } from "react";

/* A self-playing Tetris that fills the hero. Many pieces fall at once; each
   one picks its landing spot with the classic four-feature heuristic
   (height, lines, holes, bumpiness), so rows fill and clear on their own.
   Monochrome: white blocks at low opacity on pure black. */

const SHAPES = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [1, 1, 1],
    [0, 1, 0],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
];

type Cells = [number, number][];

/** Every distinct rotation of every shape, as [x, y] cell lists. */
const PIECES: Cells[][] = SHAPES.map((shape) => {
  const rotations: Cells[] = [];
  let grid = shape;
  for (let turn = 0; turn < 4; turn++) {
    const cells: Cells = [];
    grid.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) cells.push([x, y]);
      }),
    );
    const key = JSON.stringify(cells);
    if (!rotations.some((r) => JSON.stringify(r) === key))
      rotations.push(cells);
    grid = grid[0].map((_, x) => grid.map((row) => row[x]).reverse());
  }
  return rotations;
});

const SHADES = [0.12, 0.16, 0.2, 0.26];
const STEP_MS = 45;
const CLEAR_MS = 320;

type Falling = {
  cells: Cells;
  x: number;
  y: number;
  shade: number;
  /** Falls one row every `every` steps, so pieces drop at mixed speeds. */
  every: number;
};

export function LandingTetris({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cols = 0;
    let rows = 0;
    let size = 0;
    let board = new Float32Array(0); // 0 = empty, else the block's opacity
    let falling: Falling[] = [];
    let clearing: { rows: number[]; at: number } | null = null;
    let fade = 1;
    let last = 0;
    let acc = 0;
    let steps = 0;
    let frame = 0;
    let visible = true;

    const fits = (cells: Cells, x: number, y: number) =>
      cells.every(([cx, cy]) => {
        const bx = x + cx;
        const by = y + cy;
        if (bx < 0 || bx >= cols || by >= rows) return false;
        return by < 0 || board[by * cols + bx] === 0;
      });

    const dropY = (cells: Cells, x: number) => {
      let y = -4;
      while (fits(cells, x, y + 1)) y++;
      return y;
    };

    // Score a placement on a copy of the board (Yiyuan Lee's weights).
    const score = (cells: Cells, x: number, y: number) => {
      const next = board.slice();
      for (const [cx, cy] of cells) {
        if (y + cy < 0) return -Infinity;
        next[(y + cy) * cols + x + cx] = 1;
      }
      let lines = 0;
      for (let r = 0; r < rows; r++) {
        let full = true;
        for (let c = 0; c < cols && full; c++) full = next[r * cols + c] !== 0;
        if (full) lines++;
      }
      let height = 0;
      let holes = 0;
      let bump = 0;
      let prev = -1;
      for (let c = 0; c < cols; c++) {
        let top = rows;
        for (let r = 0; r < rows; r++) {
          if (next[r * cols + c] !== 0) {
            if (top === rows) top = r;
          } else if (top !== rows) holes++;
        }
        const h = rows - top;
        height += h;
        if (prev >= 0) bump += Math.abs(h - prev);
        prev = h;
      }
      return -0.51 * height + 0.76 * lines * cols - 0.36 * holes - 0.18 * bump;
    };

    const spawn = () => {
      const kind = Math.floor(Math.random() * PIECES.length);
      // Columns other pieces are already heading for are off limits.
      const taken = new Set<number>();
      for (const piece of falling)
        for (const [cx] of piece.cells) taken.add(piece.x + cx);
      let best: {
        cells: Cells;
        x: number;
        target: number;
        value: number;
      } | null = null;
      for (const cells of PIECES[kind]) {
        const width = Math.max(...cells.map(([cx]) => cx)) + 1;
        for (let x = 0; x + width <= cols; x++) {
          if (cells.some(([cx]) => taken.has(x + cx))) continue;
          const target = dropY(cells, x);
          // A little noise, so the stack looks played, not solved.
          const value = score(cells, x, target) + Math.random() * 0.8;
          if (!best || value > best.value) best = { cells, x, target, value };
        }
      }
      if (!best) return;
      const top = Math.min(...best.cells.map(([, cy]) => cy));
      falling.push({
        cells: best.cells,
        x: best.x,
        y: -3 - top - Math.floor(Math.random() * 6),
        shade: SHADES[Math.floor(Math.random() * SHADES.length)],
        every: 1 + Math.floor(Math.random() * 3),
      });
    };

    const lock = (piece: Falling) => {
      for (const [cx, cy] of piece.cells) {
        const y = piece.y + cy;
        if (y >= 0) board[y * cols + piece.x + cx] = piece.shade;
      }
      const full: number[] = [];
      for (let r = 0; r < rows; r++) {
        let isFull = true;
        for (let c = 0; c < cols && isFull; c++)
          isFull = board[r * cols + c] !== 0;
        if (isFull) full.push(r);
      }
      if (full.length && !clearing)
        clearing = { rows: full, at: performance.now() };
    };

    const step = () => {
      steps++;
      falling = falling.filter((piece) => {
        if (steps % piece.every !== 0) return true;
        if (fits(piece.cells, piece.x, piece.y + 1)) {
          piece.y++;
          return true;
        }
        lock(piece);
        return false;
      });
      // Rain across the whole hero: about one piece for every three columns.
      const wanted = Math.max(6, Math.round(cols / 3));
      if (falling.length < wanted && Math.random() < 0.6) spawn();
      // Keep the headline clear: when the stack climbs too high, fade it out.
      let highest = rows;
      for (let i = 0; i < board.length; i++)
        if (board[i] !== 0) {
          highest = Math.floor(i / cols);
          break;
        }
      if (highest < rows * 0.55 && fade === 1) fade = 0.999;
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, node.width, node.height);
      const block = (x: number, y: number, alpha: number) => {
        if (alpha <= 0 || y < 0) return;
        const px = x * size;
        const py = y * size;
        ctx.fillStyle = `rgb(255 255 255 / ${alpha})`;
        ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
        ctx.fillStyle = `rgb(255 255 255 / ${alpha * 0.7})`;
        ctx.fillRect(px + 1, py + 1, size - 2, 2);
      };
      const flash = clearing ? 1 - (now - clearing.at) / CLEAR_MS : 0;
      for (let r = 0; r < rows; r++) {
        const lit = clearing?.rows.includes(r);
        for (let c = 0; c < cols; c++) {
          const value = board[r * cols + c];
          if (value === 0) continue;
          block(c, r, (lit ? value + (0.9 - value) * flash : value) * fade);
        }
      }
      for (const piece of falling) {
        // The ghost: where the piece will land.
        ctx.strokeStyle = `rgb(255 255 255 / ${0.07 * fade})`;
        const ghost = dropY(piece.cells, piece.x);
        for (const [cx, cy] of piece.cells) {
          if (ghost + cy < 0) continue;
          ctx.strokeRect(
            (piece.x + cx) * size + 1.5,
            (ghost + cy) * size + 1.5,
            size - 3,
            size - 3,
          );
        }
        for (const [cx, cy] of piece.cells)
          block(
            piece.x + cx,
            piece.y + cy,
            Math.min(0.45, piece.shade * 2.2) * fade,
          );
      }
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible) {
        last = now;
        return;
      }
      acc += Math.min(now - last, 250);
      last = now;
      if (clearing && now - clearing.at >= CLEAR_MS) {
        const gone = new Set(clearing.rows);
        const kept: number[] = [];
        for (let r = rows - 1; r >= 0; r--) if (!gone.has(r)) kept.push(r);
        const next = new Float32Array(board.length);
        kept.forEach((r, i) =>
          next.set(
            board.subarray(r * cols, (r + 1) * cols),
            (rows - 1 - i) * cols,
          ),
        );
        board = next;
        clearing = null;
      }
      if (fade < 1) {
        fade -= 0.02;
        if (fade <= 0) {
          board = new Float32Array(cols * rows);
          falling = [];
          fade = 1;
        }
      }
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        step();
      }
      draw(now);
    };

    const resize = () => {
      const { width, height } = (
        node.parentElement ?? node
      ).getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = width < 640 ? 22 : 30;
      cols = Math.ceil(width / size);
      rows = Math.ceil(height / size);
      node.width = Math.round(cols * size * dpr);
      node.height = Math.round(rows * size * dpr);
      node.style.width = `${cols * size}px`;
      node.style.height = `${rows * size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      board = new Float32Array(cols * rows);
      falling = [];
      clearing = null;
      if (still) {
        // A settled stack for visitors who asked for less motion.
        for (let r = rows - 3; r < rows; r++)
          for (let c = 0; c < cols; c++)
            if (Math.random() < 0.8)
              board[r * cols + c] = SHADES[(r + c) % SHADES.length]!;
        draw(0);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node.parentElement ?? node);
    // Hidden tabs already stop animation frames; this pauses off-screen.
    const seen = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    seen.observe(node);
    if (!still) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      seen.disconnect();
    };
  }, []);

  return <canvas ref={canvas} aria-hidden className={className} />;
}
