/**
 * Pretty Console Logger — zero dependencies, ANSI colors
 * Usage:
 *   const log = require('./shared/utils/logger');
 *   log.info('Server started');
 *   log.req(method, path, status, durationMs);
 *   log.slowQuery(durationMs, sql);
 *   log.banner(lines[]);          // boxed startup banner
 */

// ── ANSI helpers ─────────────────────────────────────────────
const c = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  italic:  "\x1b[3m",
  underline: "\x1b[4m",

  black:   "\x1b[30m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",

  bgRed:     "\x1b[41m",
  bgGreen:   "\x1b[42m",
  bgYellow:  "\x1b[43m",
  bgBlue:    "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan:    "\x1b[46m",
  bgWhite:   "\x1b[47m",
};

const paint = (color, text) => `${color}${text}${c.reset}`;

// ── Timestamp ────────────────────────────────────────────────
const ts = () => {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return paint(c.gray, `${h}:${m}:${s}`);
};

// ── Duration coloring ────────────────────────────────────────
function colorDuration(ms) {
  const txt = `${ms}ms`;
  if (ms < 200)  return paint(c.green, txt);
  if (ms < 500)  return paint(c.yellow, txt);
  if (ms < 1000) return paint(c.red, txt);
  return paint(`${c.bold}${c.red}`, txt);
}

// ── HTTP status coloring ─────────────────────────────────────
function colorStatus(status) {
  const s = String(status);
  if (s.startsWith("2")) return paint(c.green, s);
  if (s.startsWith("3")) return paint(c.cyan, s);
  if (s.startsWith("4")) return paint(c.yellow, s);
  if (s.startsWith("5")) return paint(`${c.bold}${c.red}`, s);
  return s;
}

// ── HTTP method coloring ─────────────────────────────────────
function colorMethod(method) {
  const m = method.toUpperCase().padEnd(7);
  switch (method.toUpperCase()) {
    case "GET":    return paint(`${c.bold}${c.green}`, m);
    case "POST":   return paint(`${c.bold}${c.blue}`, m);
    case "PUT":    return paint(`${c.bold}${c.yellow}`, m);
    case "PATCH":  return paint(`${c.bold}${c.magenta}`, m);
    case "DELETE": return paint(`${c.bold}${c.red}`, m);
    default:       return paint(c.white, m);
  }
}

// ── Public API ───────────────────────────────────────────────
const log = {
  /**
   * General info log
   */
  info(msg) {
    console.log(`${ts()}  ${paint(c.cyan, "INFO")}  ${msg}`);
  },

  /**
   * Success log
   */
  ok(msg) {
    console.log(`${ts()}  ${paint(`${c.bold}${c.green}`, " OK ")}  ${msg}`);
  },

  /**
   * Warning log
   */
  warn(msg) {
    console.warn(`${ts()}  ${paint(`${c.bold}${c.yellow}`, "WARN")}  ${msg}`);
  },

  /**
   * Error log
   */
  error(msg, err) {
    console.error(`${ts()}  ${paint(`${c.bold}${c.red}`, " ERR")}  ${msg}`);
    if (err) console.error(paint(c.dim, `       ${err.stack || err}`));
  },

  // ── HTTP request log (replaces morgan + slow-request warning) ──

  /**
   * Logs an HTTP request in a clean, colorful single line.
   * Call from the response-time middleware.
   *
   * @param {string} method   GET / POST / etc.
   * @param {string} path     /api/v1/…
   * @param {number} status   HTTP status code
   * @param {number} ms       Duration in ms
   */
  req(method, path, status, ms) {
    // Shorten path: strip /api/v1 prefix for readability
    const shortPath = path.replace(/^\/api\/v1/, "");
    const dur = colorDuration(ms);
    const line = `${ts()}  ${colorMethod(method)} ${colorStatus(status)}  ${dur}  ${paint(c.white, shortPath)}`;

    if (ms > 500) {
      // slow — add a warning tag
      console.log(`${line}  ${paint(`${c.bgYellow}${c.black}`, " SLOW ")}`);
    } else {
      console.log(line);
    }
  },

  // ── Slow Prisma query ──────────────────────────────────────

  /**
   * Logs a slow Prisma query with truncated + cleaned SQL
   * @param {number} ms       Query duration
   * @param {string} sql      Raw SQL string
   */
  slowQuery(ms, sql) {
    // Clean up: collapse whitespace, truncate
    const cleaned = sql.replace(/\s+/g, " ").trim();
    // Extract table name for a quick label
    const tableMatch = cleaned.match(/FROM\s+"?(\w+)"?\."?(\w+)"?/i);
    const table = tableMatch ? tableMatch[2] : "unknown";
    // Truncate SQL to 120 chars
    const short = cleaned.length > 120 ? cleaned.substring(0, 117) + "..." : cleaned;

    console.log(
      `${ts()}  ${paint(`${c.bgRed}${c.white}`, " SLOW QUERY ")}  ` +
      `${colorDuration(ms)}  ` +
      `${paint(c.magenta, table)}  ` +
      `${paint(c.dim, short)}`
    );
  },

  // ── Startup banner ─────────────────────────────────────────

  /**
   * Print a beautiful boxed startup banner.
   * @param {{ icon: string, text: string }[]} items
   */
  banner(items) {
    const maxLen = Math.max(...items.map((i) => `${i.icon}  ${i.text}`.length));
    const width = Math.max(maxLen + 4, 50);
    const line = paint(c.cyan, "\u2500".repeat(width));
    const pad = (str, w) => str + " ".repeat(Math.max(0, w - str.length));

    console.log("");
    console.log(`  ${paint(c.cyan, "\u250C")}${line}${paint(c.cyan, "\u2510")}`);
    console.log(`  ${paint(c.cyan, "\u2502")}${paint(`${c.bold}${c.white}`, pad("  SGT-UMS Backend", width))}${paint(c.cyan, "\u2502")}`);
    console.log(`  ${paint(c.cyan, "\u251C")}${line}${paint(c.cyan, "\u2524")}`);
    for (const item of items) {
      const content = `  ${item.icon}  ${item.text}`;
      console.log(`  ${paint(c.cyan, "\u2502")}${pad(content, width)}${paint(c.cyan, "\u2502")}`);
    }
    console.log(`  ${paint(c.cyan, "\u2514")}${line}${paint(c.cyan, "\u2518")}`);
    console.log("");
  },
};

module.exports = log;
