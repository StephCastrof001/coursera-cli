/**
 * Colour tokens.
 *
 * `picocolors` is already a dependency and owns the hard part: deciding whether
 * colour is wanted at all (TTY, NO_COLOR, FORCE_COLOR, dumb terminals). What it
 * does not have is 24-bit colour, and Coursera blue `#0056D2` has no ANSI-16
 * equivalent worth the name. So truecolor is layered on top, degrading to
 * picocolors' own blue when the terminal only advertises 16 colours.
 *
 * Nothing here writes to a stream. Callers decide where the string goes, which
 * keeps `--json` output free of escape codes by construction.
 */
import pc from "picocolors";

/** ESC, spelled out: a literal escape byte in source does not survive editors. */
const ESC = String.fromCharCode(27);

type Rgb = [number, number, number];

/**
 * Coursera's primary blue, `#0056D2`. Read off coursera.org itself, where three
 * independent signals agree: the page's `theme-color` meta tag, the computed
 * primary of the CTA buttons, and the `fill` of the wordmark SVG in the header.
 */
const BRAND: Rgb = [0x00, 0x56, 0xd2];

/**
 * The brand's secondary, `#002457`. Recorded because it is real, but *not* used
 * for the wordmark: against a dark terminal it lands near 1.5:1 contrast and the
 * glyphs vanish. Reach for it only over a light background.
 */
export const BRAND_DEEP: Rgb = [0x00, 0x24, 0x57];

const WHITE: Rgb = [0xff, 0xff, 0xff];

/**
 * Does this terminal do 24-bit colour?
 *
 * COLORTERM is the usual answer, but it is a Unix convention and Windows
 * Terminal does not set it — despite rendering truecolor since 2019. Trusting
 * COLORTERM alone silently downgrades the brand blue to plain ANSI blue on what
 * is the default terminal of this project's own author. So each emulator that
 * is known to support it is also asked by its own marker.
 */
export function detectTruecolor(
  env: NodeJS.ProcessEnv = process.env,
  colorSupported: boolean = pc.isColorSupported,
): boolean {
  if (!colorSupported) return false;

  const colorterm = env.COLORTERM?.toLowerCase() ?? "";
  if (colorterm === "truecolor" || colorterm === "24bit") return true;

  // Windows Terminal sets WT_SESSION and nothing else useful.
  if (env.WT_SESSION) return true;

  // VS Code's integrated terminal, iTerm2, Hyper, WezTerm, Ghostty, Tabby.
  const program = env.TERM_PROGRAM?.toLowerCase() ?? "";
  if (
    ["vscode", "iterm.app", "hyper", "wezterm", "ghostty", "tabby"].includes(program)
  ) {
    return true;
  }

  return /24bit|truecolor|direct/.test(env.TERM?.toLowerCase() ?? "");
}

const TRUECOLOR = detectTruecolor();

function rgb([r, g, b]: Rgb, text: string): string {
  if (!pc.isColorSupported) return text;
  if (!TRUECOLOR) return pc.blue(text);
  return `${ESC}[38;2;${r};${g};${b}m${text}${ESC}[39m`;
}

/** Mixes two colours; `t` runs 0 → 1. Drives the wordmark's vertical fade. */
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * How far the wordmark's bottom row is lifted toward white. The fade exists so
 * the logo reads as a shape rather than a wall of one colour; the light end is
 * derived from BRAND instead of hardcoded so no invented hex enters the palette.
 */
const FADE = 0.35;

export const theme = {
  /** One step of the wordmark's fade; `t` runs 0 (top row) → 1 (bottom row). */
  brandAt: (t: number, text: string): string =>
    rgb(mix(BRAND, mix(BRAND, WHITE, FADE), t), text),
  brand: (text: string): string => rgb(BRAND, text),
  heading: (text: string): string => pc.bold(text),
  dim: (text: string): string => pc.dim(text),
  ok: (text: string): string => pc.green(text),
  warn: (text: string): string => pc.yellow(text),
  bad: (text: string): string => pc.red(text),
  accent: (text: string): string => pc.cyan(text),
  /**
   * Course levels read faster as colour than as text.
   *
   * The value arrives already padded to its column width, so match on the
   * trimmed text but paint the padded string — otherwise only the level whose
   * name happens to equal the column width ever gets a colour.
   */
  level: (value: string): string => {
    switch (value.trim().toUpperCase()) {
      case "BEGINNER":
        return pc.green(value);
      case "INTERMEDIATE":
        return pc.yellow(value);
      case "ADVANCED":
        return pc.magenta(value);
      default:
        return pc.dim(value);
    }
  },
};

export const symbols = {
  ok: pc.isColorSupported ? "●" : "*",
  bad: pc.isColorSupported ? "●" : "x",
  bullet: "·",
  rule: "─",
};

export const colorEnabled = pc.isColorSupported;
