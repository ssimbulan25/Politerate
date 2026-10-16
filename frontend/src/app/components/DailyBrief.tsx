import type { CSSProperties, MouseEvent } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { REGIONS, Region, RegionIcon, SourceBadge, SectionLabel } from "./shared";
import { GenreWeights, TopicTags, primaryTag, tagStyle, topicTags } from "./topicTags";
import { sanitizeHtml } from "../sanitize";

export interface BriefSection {
  cluster_id: string;
  headline: string;
  bullets: string[];
  article_count: number;
  // Missing on briefs built before regions existed; those count as U.S. news.
  region?: Region;
  // Missing on older briefs.
  outlet_count?: number;
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

// Screen-filling layouts by topic count, most relevant topic first. Every
// one fills its grid exactly, varies tile sizes (the lead story biggest,
// then tall and wide tiles) and keeps tiles at least a quarter wide, so
// headlines stay readable. The brief holds at most ten topics
// (summarizer.BRIEF_SLOTS); more falls back to the scrolling layout.
const FIT_LAYOUTS: Record<number, { rows: number; tiles: FitPlace[] }> = {
  1: { rows: 1, tiles: [[1, 1, 12, 1]] },
  2: { rows: 1, tiles: [[1, 1, 7, 1], [8, 1, 5, 1]] },
  3: { rows: 2, tiles: [[1, 1, 7, 2], [8, 1, 5, 1], [8, 2, 5, 1]] },
  4: { rows: 2, tiles: [[1, 1, 6, 2], [7, 1, 6, 1], [7, 2, 3, 1], [10, 2, 3, 1]] },
  5: { rows: 2, tiles: [[1, 1, 5, 2], [6, 1, 4, 1], [9, 2, 4, 1], [10, 1, 3, 1], [6, 2, 3, 1]] },
  6: { rows: 3, tiles: [[1, 1, 6, 2], [7, 1, 6, 1], [10, 2, 3, 2], [7, 2, 3, 1], [1, 3, 5, 1], [6, 3, 4, 1]] },
  7: { rows: 3, tiles: [[1, 1, 6, 2], [10, 1, 3, 2], [7, 1, 3, 1], [7, 2, 3, 1], [1, 3, 4, 1], [5, 3, 4, 1], [9, 3, 4, 1]] },
  8: { rows: 3, tiles: [[1, 1, 6, 2], [7, 1, 3, 2], [10, 1, 3, 1], [10, 2, 3, 1], [1, 3, 3, 1], [4, 3, 3, 1], [7, 3, 3, 1], [10, 3, 3, 1]] },
  9: { rows: 4, tiles: [[1, 1, 6, 2], [7, 1, 6, 1], [7, 2, 3, 2], [10, 2, 3, 1], [1, 3, 3, 1], [4, 3, 3, 1], [10, 3, 3, 1], [1, 4, 6, 1], [7, 4, 6, 1]] },
  10: { rows: 4, tiles: [[1, 1, 6, 2], [10, 1, 3, 2], [7, 1, 3, 1], [7, 2, 3, 1], [7, 3, 6, 1], [1, 3, 3, 1], [4, 3, 3, 1], [1, 4, 4, 1], [5, 4, 4, 1], [9, 4, 4, 1]] },
};

// What each tile size shows: the lead story its key points, the rest their
// headline and top point. Points are clamped to two lines so rows stay
// short; headlines never are.
const TILE: Record<TileSize, { bullets: number; headline: string; lift: number }> = {
  hero:  { bullets: 4, headline: "clamp(1.35rem, 2.4cqi, 1.8rem)", lift: 1.01 },
  tall:  { bullets: 2, headline: "1.25rem", lift: 1.02 },
  wide:  { bullets: 1, headline: "1.2rem",  lift: 1.02 },
  small: { bullets: 1, headline: "1.1rem",  lift: 1.03 },
};

// Filling the screen, tiles show as many points as fit (globals.css hides
// any that would be cut off), up to these, and headlines scale with the
// tile's width (cqi: the tile is a size container there).
const FIT_TILE = {
  hero:  { bullets: 5, headline: "clamp(1.25rem, 0.6rem + 2cqi, 1.75rem)", lines: 3 },
  other: { bullets: 3, headline: "clamp(1rem, 0.7rem + 1.7cqi, 1.4rem)",     lines: 3 },
};

function BriefTile({
  section,
  span,
  fit,
  href,
  onSelect,
}: {
  section: BriefSection;
  span: TileSpan;
  // Its place when the brief fills the screen; the flowing span applies
  // where it doesn't (narrow or short windows).
  fit?: FitPlace;
  href: string;
  onSelect?: (clusterId: string) => void;
}) {
  const t = TILE[span.size];
  const f = fit ? FIT_TILE[span.size === "hero" ? "hero" : "other"] : null;
  const tags = topicTags(section.category, section.region, section.genre_weights);
  const outlets = section.outlet_count;
  const style = {
    ...tagStyle(primaryTag(section.category, section.region)),
    "--c": span.c,
    "--r": span.r,
    "--c2": span.c2,
    "--lift": t.lift,
    ...(fit && { "--fx": fit[0], "--fy": fit[1], "--fw": fit[2], "--fh": fit[3], "--headline-lines": f!.lines }),
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

      <div className="relative flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <TopicTags tags={tags} />
        {outlets != null && (
          <span className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-data)" }}>
            {outlets} outlet{outlets !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <h3
        className="tile-headline relative text-foreground"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: span.size === "hero" ? 800 : 700,
          fontSize: f ? f.headline : t.headline,
          lineHeight: 1.18,
        }}
      >
        {section.headline}
      </h3>

      <ul className="tile-points relative space-y-1.5 text-base text-foreground/85 leading-snug">
        {section.bullets.slice(0, f ? f.bullets : t.bullets).map((b, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className="mt-[0.5em] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--tag)" }} />
            <span className="line-clamp-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(b) }} />
          </li>
        ))}
      </ul>

      {span.size === "hero" && (
        <div className="relative mt-auto pt-1 flex items-center justify-between gap-3 text-sm text-muted-foreground">
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
 * space it's given, laid out by FIT_LAYOUTS; elsewhere it flows and scrolls.
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
  if (fit && canFitScreen(data.sections.length)) {
    const layout = FIT_LAYOUTS[data.sections.length];
    const spans = bentoSpans(data.sections.length);
    return (
      <section aria-label="Today's topics" className="bento-wrap bento-fit-wrap">
        <div className="bento bento-fit" style={{ "--fit-rows": layout.rows } as CSSProperties}>
          {data.sections.map((s, i) => (
            <BriefTile
              key={s.cluster_id}
              section={s}
              span={spans[i]}
              fit={layout.tiles[i]}
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
