import { useLayoutEffect, useRef } from "react";
import type { CSSProperties, MouseEvent, RefObject } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { OutletCount, REGIONS, Region, RegionIcon, SourceBadge, SectionLabel } from "./shared";
import { GenreWeights, TopicTags, primaryTag, tagStyle, topicTags } from "./topicTags";
import { sanitizeHtml } from "../sanitize";

export interface BriefSection {
  cluster_id: string;
  headline: string;
  bullets: string[];
  article_count: number;
  // Missing on briefs built before regions existed; those count as U.S. news.
  region?: Region;
  // Missing on older briefs. The topic's own outlets, and (recent) all that
  // reported the story in the last `lookback_hours`.
  outlet_count?: number;
  recent_outlet_count?: number;
  category?: string;
  relevance?: number;
  genre_weights?: Partial<GenreWeights> | null;
}

export interface DailySummary {
  sections: BriefSection[];
  cluster_count: number;
  total_articles: number;
  source_count: number;
  source_links: Array<{ source: string; url: string }>;
  last_updated?: string;
  lookback_hours?: number;
}

export function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-secondary text-secondary-foreground text-sm"
      style={{ fontFamily: "var(--font-data)" }}
    >
      <strong>{value}</strong>&nbsp;{label}
    </span>
  );
}

// ─── Bento layout ─────────────────────────────────────────────────────────────

type TileSize = "hero" | "tall" | "wide" | "small";

interface TileSpan {
  c: number;   // columns on the twelve-column grid
  r: number;   // rows on the twelve-column grid
  c2: number;  // columns on the two-column grid
  size: TileSize;
}

/** Rows for `rest` tiles after the lead block, as column spans: rows of
 *  four, then three, then two, never one tile alone. */
function restRows(rest: number): number[][] {
  const rows: number[][] = [];
  while (rest > 0) {
    const count = rest === 2 ? 2 : rest === 3 || rest === 5 ? 3 : 4;
    rows.push(Array(count).fill(12 / count));
    rest -= count;
  }
  return rows;
}

/**
 * Spans for `n` tiles, most relevant first, that fill every row of the
 * twelve-column grid: the lead story takes the left half for two rows with
 * the next stories beside it (four small tiles, or fewer bigger ones), then
 * rows of four, three or two.
 */
export function bentoSpans(n: number): TileSpan[] {
  if (n <= 0) return [];
  let spans: Array<[number, number]>;
  if (n === 1) spans = [[12, 1]];
  else if (n === 2) spans = [[7, 2], [5, 2]];
  else if (n === 3) spans = [[6, 2], [6, 1], [6, 1]];
  // A lead block of five unless that leaves a lone tile after it.
  else if (n === 4 || n === 6) spans = [[6, 2], [6, 1], [3, 1], [3, 1]];
  else spans = [[6, 2], [3, 1], [3, 1], [3, 1], [3, 1]];
  for (const row of restRows(n - spans.length)) spans.push(...row.map(c => [c, 1] as [number, number]));

  // Two-column grid: the lead story spans both, the rest one each, and a
  // leftover last tile spans both.
  return spans.map(([c, r], i) => ({
    c,
    r,
    c2: i === 0 || (i === n - 1 && (n - 1) % 2 === 1) ? 2 : 1,
    size: i === 0 && n > 1 ? "hero" : r === 2 ? "tall" : c >= 6 ? "wide" : "small",
  }));
}

/** A tile's place when the brief fills the screen: column, row, columns
 *  spanned, rows spanned, on a twelve-column grid of `rows` equal rows. */
type FitPlace = [number, number, number, number];

// Screen-filling layouts by topic count, most relevant topic first: the
// brief's ten topics (summarizer.BRIEF_SLOTS), or fewer on a slow day, on
// every screen. Every layout fills its grid exactly, and no tile is bigger
// than a more relevant topic's: the lead story biggest, the next two tall
// beside it, then a row of thirds, then quarters. Tiles stay at least a
// quarter wide. Bigger screens get bigger tiles and text (FIT_HEADLINE,
// globals.css), not more topics.
const FIT_LAYOUTS: Record<number, { rows: number; tiles: FitPlace[] }> = {
  1: { rows: 1, tiles: [[1, 1, 12, 1]] },
  2: { rows: 1, tiles: [[1, 1, 7, 1], [8, 1, 5, 1]] },
  3: { rows: 2, tiles: [[1, 1, 7, 2], [8, 1, 5, 1], [8, 2, 5, 1]] },
  4: { rows: 2, tiles: [[1, 1, 6, 2], [7, 1, 6, 1], [7, 2, 3, 1], [10, 2, 3, 1]] },
  5: { rows: 2, tiles: [[1, 1, 5, 2], [6, 1, 4, 1], [9, 2, 4, 1], [10, 1, 3, 1], [6, 2, 3, 1]] },
  6: { rows: 3, tiles: [[1, 1, 6, 2], [7, 1, 3, 2], [10, 1, 3, 2], [1, 3, 4, 1], [5, 3, 4, 1], [9, 3, 4, 1]] },
  7: { rows: 3, tiles: [[1, 1, 6, 2], [7, 1, 3, 2], [10, 1, 3, 2], [1, 3, 3, 1], [4, 3, 3, 1], [7, 3, 3, 1], [10, 3, 3, 1]] },
  8: { rows: 3, tiles: [[1, 1, 6, 2], [7, 1, 3, 2], [10, 1, 3, 1], [10, 2, 3, 1], [1, 3, 3, 1], [4, 3, 3, 1], [7, 3, 3, 1], [10, 3, 3, 1]] },
  9: { rows: 4, tiles: [[1, 1, 6, 2], [7, 1, 3, 2], [10, 1, 3, 2], [1, 3, 4, 1], [5, 3, 4, 1], [9, 3, 4, 1], [1, 4, 4, 1], [5, 4, 4, 1], [9, 4, 4, 1]] },
  10: { rows: 4, tiles: [[1, 1, 6, 2], [7, 1, 3, 2], [10, 1, 3, 2], [1, 3, 4, 1], [5, 3, 4, 1], [9, 3, 4, 1], [1, 4, 3, 1], [4, 4, 3, 1], [7, 4, 3, 1], [10, 4, 3, 1]] },
};

// Where the brief scrolls (phones, small windows), each topic's points by
// relevance rank: the lead story four, then three, two, and one for the rest.
const RANK_POINTS = [4, 3, 3, 2, 2, 2];
const rankPoints = (rank: number) => RANK_POINTS[rank] ?? 1;

// What each tile size shows: the lead story its key points, the rest their
// headline and top point. Points are clamped to two lines so rows stay
// short; headlines never are.
const TILE: Record<TileSize, { bullets: number; headline: string; lift: number }> = {
  hero:  { bullets: 4, headline: "clamp(1.35rem, 2.4cqi, 1.8rem)", lift: 1.01 },
  tall:  { bullets: 2, headline: "1.25rem", lift: 1.02 },
  wide:  { bullets: 1, headline: "1.2rem",  lift: 1.02 },
  small: { bullets: 1, headline: "1.1rem",  lift: 1.03 },
};

// Filling the screen, headlines size by relevance rank, not by tile, so a
// less-reported topic never gets a bigger headline because its tile is
// wider. Sizes are shares of the brief's text size (em), which grows with
// the screen (globals.css); the lead story's also grows with its tile. All
// are capped by what the tile's height leaves room for (cqh: tiles are size
// containers there), and short tiles shorten them (globals.css).
const HERO_HEADLINE = "clamp(1.25rem, min(0.5rem + 2.6cqi, 0.3rem + 10cqh), 2.75rem)";
const FIT_HEADLINE_EM = [1.3, 1.3, 1.15, 1.15, 1.15]; // ranks 1-5; later ranks 1.05
const HEADLINE_LINES = 3;

function fitHeadline(rank: number): string {
  if (rank === 0) return HERO_HEADLINE;
  const em = FIT_HEADLINE_EM[rank - 1] ?? 1.05;
  return `clamp(1rem, min(${em}em, 0.25rem + 16cqh), 1.85rem)`;
}

// Matches globals.css's "Daily Brief filling the screen".
const FIT_SCREEN_QUERY = "(min-width: 1024px) and (min-height: 640px)";
// Lines each point gets before the next point gets any.
const POINT_LINES = 2;

/**
 * Fits a screen-filling tile's headline and points into the room its tags
 * (and the lead story's footer) leave. The headline shows whole if it can;
 * then as many points as fit at up to POINT_LINES lines each (the last one
 * shortened to the lines left); then any room left lets the points run
 * longer, earliest first. Elsewhere (`active` false) the tile goes back to
 * its CSS.
 */
function fitTile(tile: HTMLElement, active: boolean) {
  const headline = tile.querySelector<HTMLElement>(".tile-headline");
  const list = tile.querySelector<HTMLElement>(".tile-points");
  if (!headline || !list) return;
  const items = [...list.children] as HTMLElement[];
  const texts = items.map(li => li.querySelector<HTMLElement>("[data-point]")!);
  headline.style.removeProperty("-webkit-line-clamp");
  items.forEach(li => li.style.removeProperty("display"));
  texts.forEach(text => text.style.removeProperty("-webkit-line-clamp"));
  if (!active) return;

  const lineHeight = (el: HTMLElement) => {
    const style = getComputedStyle(el);
    return parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  };
  // Lines an element's whole text takes at its width.
  const fullLines = (el: HTMLElement, line: number) => {
    el.style.setProperty("-webkit-line-clamp", "none");
    return Math.max(1, Math.round(el.getBoundingClientRect().height / line));
  };
  const linesIn = (space: number, line: number) => Math.floor((space + 0.5) / line);

  // Room for the headline and points: the tile's height inside its padding,
  // less the tags, the footer and the gaps between them all.
  const tileStyle = getComputedStyle(tile);
  const fixed = [tile.querySelector<HTMLElement>(".tile-tags"), tile.querySelector<HTMLElement>(".tile-footer")]
    .filter((el): el is HTMLElement => !!el);
  const gap = parseFloat(tileStyle.rowGap) || 0;
  let room = tile.clientHeight - parseFloat(tileStyle.paddingTop) - parseFloat(tileStyle.paddingBottom)
    - fixed.reduce((sum, el) => sum + el.offsetHeight, 0) - gap * (fixed.length + 1);

  const headLine = lineHeight(headline);
  const head = Math.max(1, Math.min(fullLines(headline, headLine), linesIn(room, headLine)));
  headline.style.setProperty("-webkit-line-clamp", String(head));
  room -= head * headLine;
  if (texts.length === 0) return;

  const pointGap = parseFloat(getComputedStyle(list).rowGap) || 0;
  const line = lineHeight(texts[0]);
  const full = texts.map(text => fullLines(text, line));
  const lines: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    const space = room - (i ? pointGap : 0);
    const want = Math.min(full[i], POINT_LINES);
    const take = Math.min(want, linesIn(space, line));
    if (take < 1) break;
    lines.push(take);
    room = space - take * line;
    if (take < want) break;
  }
  for (let i = 0; i < lines.length; i++) {
    const more = Math.min(full[i] - lines[i], linesIn(room, line));
    lines[i] += more;
    room -= more * line;
  }
  items.forEach((li, i) => {
    if (i >= lines.length) li.style.display = "none";
    else texts[i].style.setProperty("-webkit-line-clamp", String(lines[i]));
  });
}

/** Keeps a screen-filling grid's tiles fitted (fitTile) as the
 *  window, fonts or layout change. */
function useFittedPoints(grid: RefObject<HTMLElement | null>, data: unknown) {
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const query = window.matchMedia(FIT_SCREEN_QUERY);
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.querySelectorAll<HTMLElement>(".bento-tile").forEach(tile => fitTile(tile, query.matches));
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    query.addEventListener("change", fit);
    document.fonts?.ready.then(fit);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      query.removeEventListener("change", fit);
    };
  }, [grid, data]);
}

function BriefTile({
  section,
  span,
  rank = 0,
  fit,
  lookbackHours,
  href,
  onSelect,
}: {
  section: BriefSection;
  span: TileSpan;
  // Its place in the brief, most relevant first.
  rank?: number;
  // Its place when the brief fills the screen; the flowing span applies
  // where it doesn't (narrow or short windows).
  fit?: FitPlace;
  lookbackHours?: number;
  href: string;
  onSelect?: (clusterId: string) => void;
}) {
  const t = TILE[span.size];
  const tags = topicTags(section.category, section.region, section.genre_weights);
  const outlets = section.outlet_count;
  const style = {
    ...tagStyle(primaryTag(section.category, section.region)),
    "--c": span.c,
    "--r": span.r,
    "--c2": span.c2,
    "--lift": t.lift,
    // Headline sizes for each layout; globals.css picks the one in use.
    "--flow-headline": t.headline,
    ...(fit && {
      "--fx": fit[0], "--fy": fit[1], "--fw": fit[2], "--fh": fit[3],
      "--fit-headline": fitHeadline(rank), "--headline-lines": HEADLINE_LINES,
    }),
  } as CSSProperties;

  function handleClick(e: MouseEvent) {
    if (!onSelect) return;
    e.preventDefault();
    onSelect(section.cluster_id);
  }

  return (
    <Link
      to={href}
      state={{ from: "today" }}
      onClick={handleClick}
      style={style}
      className={`bento-tile group flex flex-col gap-2 overflow-hidden rounded-lg border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring ${span.size === "hero" ? "tile-hero p-5" : "p-4"}`}
    >
      {/* Accent bar and (on the lead story) a wash in the topic's color. */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--tag)" }} />
      {span.size === "hero" && (
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--tag) 16%, transparent), transparent 60%)" }}
        />
      )}

      <div className="tile-tags relative flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <TopicTags tags={tags} />
        {outlets != null && (
          <OutletCount
            listed={outlets}
            recent={section.recent_outlet_count}
            hours={lookbackHours}
            className="text-[0.875em] text-muted-foreground"
          />
        )}
      </div>

      <h3
        className="tile-headline relative text-foreground"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: span.size === "hero" ? 800 : 700,
          lineHeight: 1.18,
        }}
      >
        {section.headline}
      </h3>

      {/* Today's Brief renders every point: where it scrolls, more relevant
          topics show more (rankPoints, globals.css); where it fills the
          screen, as many as fit (fitTile). */}
      <ul className="tile-points relative space-y-1.5 text-base text-foreground/85 leading-snug">
        {section.bullets.slice(0, fit ? undefined : t.bullets).map((b, i) => (
          <li key={i} className={`flex gap-2 ${fit && i >= rankPoints(rank) ? "point-beyond-flow" : ""}`}>
            <span aria-hidden="true" className="mt-[0.5em] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--tag)" }} />
            <span data-point className="line-clamp-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(b) }} />
          </li>
        ))}
      </ul>

      {span.size === "hero" && (
        <div className="tile-footer relative mt-auto pt-1 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span style={{ fontFamily: "var(--font-data)" }}>
            {section.article_count} article{section.article_count !== 1 ? "s" : ""}
          </span>
          <span className="tile-cta inline-flex items-center gap-1 font-semibold text-brand-accent">
            Open topic <ArrowRight size={15} />
          </span>
        </div>
      )}
    </Link>
  );
}

/** True if `count` topics have a screen-filling layout (FIT_LAYOUTS). */
export function canFitScreen(count: number): boolean {
  return count in FIT_LAYOUTS;
}

/**
 * The Daily Brief as a bento grid per region, most relevant topic largest.
 * Tiles open today's topic page by default; the Archive passes `topicHref`
 * and `onSelect` instead, since topic pages only exist for today's topics.
 *
 * `fit` (Today's Brief) puts every topic in one grid, most relevant first,
 * each tile showing its region in its tags. On screens big enough
 * (globals.css, "Daily Brief filling the screen") that grid fills the
 * space it's given, laid out by FIT_LAYOUTS; elsewhere it's a list that
 * scrolls, more relevant topics showing more points.
 */
export function DailyBrief({
  data,
  topicHref = id => `/cluster/${encodeURIComponent(id)}`,
  onSelect,
  showSources = true,
  fit = false,
}: {
  data: DailySummary;
  topicHref?: (clusterId: string) => string;
  onSelect?: (clusterId: string) => void;
  showSources?: boolean;
  fit?: boolean;
}) {
  const grid = useRef<HTMLDivElement>(null);
  useFittedPoints(grid, data);

  if (fit && canFitScreen(data.sections.length)) {
    const layout = FIT_LAYOUTS[data.sections.length];
    const spans = bentoSpans(data.sections.length);
    return (
      <section aria-label="Today's topics" className="bento-wrap bento-fit-wrap">
        <div ref={grid} className="bento bento-fit" style={{ "--fit-rows": layout.rows } as CSSProperties}>
          {data.sections.map((s, i) => (
            <BriefTile
              key={s.cluster_id}
              section={s}
              span={spans[i]}
              rank={i}
              fit={layout.tiles[i]}
              lookbackHours={data.lookback_hours}
              href={topicHref(s.cluster_id)}
              onSelect={onSelect}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-7">
      {REGIONS.map(({ region, heading }) => {
        const sections = data.sections.filter(s => (s.region ?? "us") === region);
        if (sections.length === 0) return null;
        const spans = bentoSpans(sections.length);
        return (
          <section key={region} aria-labelledby={`brief-${region}`} className="bento-wrap">
            <h2
              id={`brief-${region}`}
              className="flex items-center gap-2.5 pb-1.5 mb-3 border-b border-border"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.35rem", lineHeight: 1.2 }}
            >
              <RegionIcon region={region} size={22} />
              {heading}
              <span className="ml-auto text-sm font-normal text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>
                {sections.length} topic{sections.length !== 1 ? "s" : ""}
              </span>
            </h2>
            <div className="bento">
              {sections.map((s, i) => (
                <BriefTile
                  key={s.cluster_id}
                  section={s}
                  span={spans[i]}
                  lookbackHours={data.lookback_hours}
                  href={topicHref(s.cluster_id)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        );
      })}

      {showSources && data.source_links?.length > 0 && (
        <div className="pt-5 border-t border-border space-y-2">
          <SectionLabel>Sources in today's brief</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {data.source_links.map((s, i) => (
              <SourceBadge key={i} source={s.source} url={s.url} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
