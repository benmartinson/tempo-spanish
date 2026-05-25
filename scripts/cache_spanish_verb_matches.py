#!/usr/bin/env python3
"""Build cached Spanish verb/video matches for ``top_verb_video``.

This script ports the matching behavior used by
``src/components/writing-studio/FindVideoMatch.tsx``:

- verbs come from the Supabase ``verb`` table;
- Spanish videos come from ``channel.language = 'es'`` and the matching
  ``video.channel_id`` values;
- transcript text comes from ``transcript_segment`` ordered by ``segment_id``;
- matching normalizes text, counts unique conjugated forms in each passage
  window, keeps the best window per video, then caps results to 10 per
  difficulty;
- rows written to ``top_verb_video`` use the UI shape:
  ``video_id``, ``verb_id``, ``count``, ``difficulty``, ``start``, ``end``.

Assumptions:

- ``video_id`` in ``top_verb_video`` stores the app's video record id
  (``video.id``), not the YouTube id (``video.video_id``).
- There is no reliable uniqueness guarantee for ``top_verb_video`` rows, so
  the default write path deletes existing rows for a verb before inserting the
  replacement set.
- The current TypeScript verb catalog only contains the verbs present on main;
  verbs not found there fall back to matching the normalized verb name itself
  until a larger conjugation data source lands.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import random
import re
import ssl
import subprocess
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


LOGGER = logging.getLogger("cache_spanish_verb_matches")
DEFAULT_LANGUAGE = "es"
DEFAULT_PARAGRAPH_COUNT = 2
DEFAULT_PAGE_SIZE = 1000
DEFAULT_SEGMENT_VIDEO_CHUNK_SIZE = 100
DEFAULT_TOP_PER_DIFFICULTY = 10


@dataclass(frozen=True)
class Verb:
    id: Any
    name: str


@dataclass(frozen=True)
class Channel:
    id: Any
    channel_id: str
    difficulty: str | None


@dataclass(frozen=True)
class Video:
    id: Any
    video_id: str | None
    channel_id: str
    difficulty: str | None
    title: str | None


@dataclass(frozen=True)
class Segment:
    segment_id: int
    start: float | int | None
    end: float | int | None
    text: str
    video_id: Any


@dataclass(frozen=True)
class PassageWindow:
    start_segment_id: int
    end_segment_id: int
    tokens: frozenset[str]


@dataclass(frozen=True)
class VerbMatch:
    video_record_id: Any
    score: int
    difficulty: str
    start_segment_id: int
    end_segment_id: int


class SupabaseRestClient:
    def __init__(self, url: str, service_role_key: str, page_size: int) -> None:
        self.base_url = url.rstrip("/")
        self.page_size = page_size
        self.ssl_context = create_ssl_context()
        self.base_headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        }

    def fetch_all(
        self,
        table: str,
        *,
        select: str = "*",
        filters: dict[str, str] | None = None,
        order: str | None = None,
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        offset = 0

        while True:
            headers = {
                "Range-Unit": "items",
                "Range": f"{offset}-{offset + self.page_size - 1}",
            }
            query = {"select": select}
            if filters:
                query.update(filters)
            if order:
                query["order"] = order

            batch = self._request_json(
                "GET",
                table,
                query=query,
                headers=headers,
            )
            if not isinstance(batch, list):
                raise RuntimeError(f"Expected list response from {table}, got {type(batch).__name__}")
            rows.extend(batch)

            if len(batch) < self.page_size:
                return rows
            offset += self.page_size

    def delete(self, table: str, *, filters: dict[str, str]) -> None:
        self._request_json("DELETE", table, query=filters, headers={"Prefer": "return=minimal"})

    def insert(self, table: str, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        self._request_json(
            "POST",
            table,
            body=rows,
            headers={"Prefer": "return=minimal"},
        )

    def _request_json(
        self,
        method: str,
        table: str,
        *,
        query: dict[str, str] | None = None,
        body: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        query_string = urllib.parse.urlencode(query or {}, safe="(),.*")
        url = f"{self.base_url}/rest/v1/{table}"
        if query_string:
            url = f"{url}?{query_string}"

        request_headers = dict(self.base_headers)
        request_headers.update(headers or {})
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(url, data=data, headers=request_headers, method=method)

        try:
            with urllib.request.urlopen(request, timeout=90, context=self.ssl_context) as response:
                payload = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase {method} {table} failed: {error.code} {detail}") from error
        except urllib.error.URLError as error:
            raise RuntimeError(f"Supabase {method} {table} failed: {error.reason}") from error

        if not payload:
            return None
        return json.loads(payload.decode("utf-8"))


class SegmentWindowCache:
    def __init__(self, client: SupabaseRestClient, paragraph_count: int) -> None:
        self.client = client
        self.paragraph_count = paragraph_count
        self._windows_by_video_id: dict[str, list[PassageWindow]] = {}

    def preload(self, video_record_ids: Iterable[Any], chunk_size: int) -> None:
        pending_ids = [
            video_record_id
            for video_record_id in video_record_ids
            if str(video_record_id) not in self._windows_by_video_id
        ]
        for chunk in chunked(pending_ids, chunk_size):
            segments_by_video_id = load_segments_for_videos(self.client, chunk)
            for video_record_id in chunk:
                segments = segments_by_video_id.get(str(video_record_id), [])
                self._windows_by_video_id[str(video_record_id)] = build_passage_windows(
                    segments,
                    self.paragraph_count,
                )

    def get_windows(self, video_record_id: Any) -> list[PassageWindow]:
        cache_key = str(video_record_id)
        if cache_key not in self._windows_by_video_id:
            segments = load_segments(self.client, video_record_id)
            self._windows_by_video_id[cache_key] = build_passage_windows(segments, self.paragraph_count)
        return self._windows_by_video_id[cache_key]


def normalize_verb_search_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.lower())
    without_marks = "".join(char for char in decomposed if not unicodedata.combining(char))
    normalized = re.sub(r"[^a-zñü]+", " ", without_marks)
    return normalized.strip()


def create_ssl_context() -> ssl.SSLContext:
    default_paths = ssl.get_default_verify_paths()
    if default_paths.cafile and Path(default_paths.cafile).is_file():
        return ssl.create_default_context()

    for candidate in (
        os.environ.get("SSL_CERT_FILE"),
        "/etc/ssl/cert.pem",
        "/opt/homebrew/etc/ca-certificates/cert.pem",
        "/usr/local/etc/openssl@3/cert.pem",
    ):
        if candidate and Path(candidate).is_file():
            return ssl.create_default_context(cafile=candidate)

    return ssl.create_default_context()


def unique_verb_form_count(tokens: frozenset[str], verb_forms: frozenset[str]) -> int:
    return len(tokens.intersection(verb_forms))


def chunked(items: list[Any], chunk_size: int) -> Iterable[list[Any]]:
    for start in range(0, len(items), chunk_size):
        yield items[start : start + chunk_size]


def build_passage_windows(segments: list[Segment], paragraph_count: int) -> list[PassageWindow]:
    if not segments:
        return []

    windows: list[PassageWindow] = []
    max_start = max(0, len(segments) - paragraph_count)
    for start_index in range(max_start + 1):
        end_index = min(len(segments) - 1, start_index + paragraph_count - 1)
        text = " ".join(segment.text for segment in segments[start_index : end_index + 1])
        tokens = frozenset(token for token in normalize_verb_search_text(text).split() if token)
        windows.append(
            PassageWindow(
                start_segment_id=segments[start_index].segment_id,
                end_segment_id=segments[end_index].segment_id,
                tokens=tokens,
            )
        )
    return windows


def limit_verb_suggestions_by_difficulty(
    matches: list[VerbMatch],
    *,
    top_per_difficulty: int,
    shuffle_results: bool,
) -> list[VerbMatch]:
    best_match_by_video_id: dict[str, VerbMatch] = {}
    for match in sorted(matches, key=lambda item: item.score, reverse=True):
        best_match_by_video_id.setdefault(str(match.video_record_id), match)

    groups: dict[str, list[VerbMatch]] = {}
    for match in sorted(best_match_by_video_id.values(), key=lambda item: item.score, reverse=True):
        difficulty_key = match.difficulty.lower()
        group = groups.setdefault(difficulty_key, [])
        if len(group) < top_per_difficulty:
            group.append(match)

    limited = [match for group in groups.values() for match in group]
    if shuffle_results:
        random.shuffle(limited)
    return limited


def load_env_file(path: Path) -> None:
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


def candidate_env_paths(repo_root: Path, explicit_path: str | None) -> Iterable[Path]:
    if explicit_path:
        yield Path(explicit_path).expanduser()

    tempo_env_file = os.environ.get("TEMPO_ENV_FILE")
    if tempo_env_file:
        yield Path(tempo_env_file).expanduser()

    searched: set[Path] = set()
    for base in [Path.cwd(), repo_root, *repo_root.parents]:
        env_path = base / ".env"
        if env_path not in searched:
            searched.add(env_path)
            yield env_path

    try:
        result = subprocess.run(
            ["git", "worktree", "list", "--porcelain"],
            cwd=repo_root,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except OSError:
        return

    for line in result.stdout.splitlines():
        if not line.startswith("worktree "):
            continue
        env_path = Path(line.removeprefix("worktree ")).expanduser() / ".env"
        if env_path not in searched:
            searched.add(env_path)
            yield env_path


def load_environment(repo_root: Path, explicit_env_file: str | None) -> Path | None:
    for env_path in candidate_env_paths(repo_root, explicit_env_file):
        if env_path.is_file():
            load_env_file(env_path)
            return env_path
    return None


def parse_typescript_verb_catalog(repo_root: Path) -> dict[str, frozenset[str]]:
    catalog_path = repo_root / "src" / "components" / "writing-studio" / "verbs.ts"
    if not catalog_path.is_file():
        return {}

    node_catalog = load_typescript_verb_catalog_with_node(repo_root, catalog_path)
    if node_catalog:
        return node_catalog

    source = catalog_path.read_text(encoding="utf-8")
    catalog: dict[str, frozenset[str]] = {}
    for match in re.finditer(r"([A-Za-zñÑüÜáéíóúÁÉÍÓÚ]+):\s*\[(.*?)\]\s*,", source, re.DOTALL):
        verb_name = normalize_verb_search_text(match.group(1))
        forms = [
            normalize_verb_search_text(item)
            for item in re.findall(r'"([^"]+)"|\'([^\']+)\'', match.group(2))
            for item in item
            if item
        ]
        normalized_forms = frozenset(form for form in forms if form)
        if normalized_forms:
            catalog[verb_name] = normalized_forms
    return catalog


def load_typescript_verb_catalog_with_node(
    repo_root: Path,
    catalog_path: Path,
) -> dict[str, frozenset[str]]:
    script = r"""
const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const sourcePath = process.argv[1];
const source = fs.readFileSync(sourcePath, 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const sandbox = { exports: {}, module: { exports: {} }, require };
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(js, sandbox, { filename: sourcePath });
const catalog = sandbox.module.exports.SPANISH_VERB_CONJUGATIONS;
if (!catalog || typeof catalog !== 'object') {
  throw new Error('SPANISH_VERB_CONJUGATIONS export not found');
}
process.stdout.write(JSON.stringify(catalog));
"""
    try:
        result = subprocess.run(
            ["node", "-e", script, str(catalog_path)],
            cwd=repo_root,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        raw_catalog = json.loads(result.stdout)
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError):
        return {}

    catalog: dict[str, frozenset[str]] = {}
    for verb_name, forms in raw_catalog.items():
        if not isinstance(forms, list):
            continue
        normalized_forms = frozenset(
            form
            for form in (
                normalize_verb_search_text(str(item))
                for item in forms
            )
            if form
        )
        if normalized_forms:
            catalog[normalize_verb_search_text(str(verb_name))] = normalized_forms
    return catalog


def get_verb_forms(verb_name: str, catalog: dict[str, frozenset[str]]) -> frozenset[str]:
    normalized_name = normalize_verb_search_text(verb_name)
    return catalog.get(normalized_name) or frozenset([normalized_name])


def load_verbs(client: SupabaseRestClient, selected_verbs: set[str]) -> list[Verb]:
    rows = client.fetch_all("verb", select="id,name", order="name.asc")
    verbs = [
        Verb(id=row.get("id"), name=str(row.get("name") or "").strip())
        for row in rows
        if row.get("id") is not None and str(row.get("name") or "").strip()
    ]
    if not selected_verbs:
        return verbs

    return [
        verb
        for verb in verbs
        if str(verb.id) in selected_verbs or normalize_verb_search_text(verb.name) in selected_verbs
    ]


def load_spanish_channels(client: SupabaseRestClient, language: str) -> list[Channel]:
    rows = client.fetch_all(
        "channel",
        select="id,channel_id,difficulty,language",
        filters={"language": f"eq.{language}"},
    )
    return [
        Channel(
            id=row.get("id"),
            channel_id=str(row.get("channel_id") or ""),
            difficulty=row.get("difficulty"),
        )
        for row in rows
        if row.get("channel_id")
    ]


def load_videos_for_channels(client: SupabaseRestClient, channel_ids: set[str]) -> list[Video]:
    if not channel_ids:
        return []

    rows = client.fetch_all("video", select="id,video_id,channel_id,difficulty,title")
    return [
        Video(
            id=row.get("id"),
            video_id=row.get("video_id"),
            channel_id=str(row.get("channel_id") or ""),
            difficulty=row.get("difficulty"),
            title=row.get("title"),
        )
        for row in rows
        if row.get("id") is not None and str(row.get("channel_id") or "") in channel_ids
    ]


def load_segments(client: SupabaseRestClient, video_record_id: Any) -> list[Segment]:
    rows = client.fetch_all(
        "transcript_segment",
        select="segment_id,start,end,text,video_id",
        filters={"video_id": f"eq.{video_record_id}"},
        order="segment_id.asc",
    )
    segments: list[Segment] = []
    for row in rows:
        text = str(row.get("text") or "").strip()
        if not text:
            continue
        segments.append(
            Segment(
                segment_id=int(row.get("segment_id") or 0),
                start=row.get("start"),
                end=row.get("end"),
                text=text,
                video_id=row.get("video_id"),
            )
        )
    return segments


def load_segments_for_videos(
    client: SupabaseRestClient,
    video_record_ids: list[Any],
) -> dict[str, list[Segment]]:
    if not video_record_ids:
        return {}

    in_filter = ",".join(str(video_record_id) for video_record_id in video_record_ids)
    rows = client.fetch_all(
        "transcript_segment",
        select="segment_id,start,end,text,video_id",
        filters={"video_id": f"in.({in_filter})"},
        order="video_id.asc,segment_id.asc",
    )
    segments_by_video_id: dict[str, list[Segment]] = {}
    for row in rows:
        text = str(row.get("text") or "").strip()
        if not text:
            continue
        segment = Segment(
            segment_id=int(row.get("segment_id") or 0),
            start=row.get("start"),
            end=row.get("end"),
            text=text,
            video_id=row.get("video_id"),
        )
        segments_by_video_id.setdefault(str(row.get("video_id")), []).append(segment)
    return segments_by_video_id


def get_video_difficulty(video: Video, channel_by_channel_id: dict[str, Channel]) -> str:
    channel = channel_by_channel_id.get(video.channel_id)
    return str(channel.difficulty or video.difficulty or "unknown")


def find_verb_matches(
    verb: Verb,
    videos: list[Video],
    channel_by_channel_id: dict[str, Channel],
    segment_cache: SegmentWindowCache,
    verb_catalog: dict[str, frozenset[str]],
    *,
    top_per_difficulty: int,
    shuffle_results: bool,
) -> list[VerbMatch]:
    verb_forms = get_verb_forms(verb.name, verb_catalog)
    matches: list[VerbMatch] = []

    for video in videos:
        best_match: VerbMatch | None = None
        for window in segment_cache.get_windows(video.id):
            score = unique_verb_form_count(window.tokens, verb_forms)
            if score <= 0:
                continue
            if best_match is None or score > best_match.score:
                best_match = VerbMatch(
                    video_record_id=video.id,
                    score=score,
                    difficulty=get_video_difficulty(video, channel_by_channel_id),
                    start_segment_id=window.start_segment_id,
                    end_segment_id=window.end_segment_id,
                )
        if best_match:
            matches.append(best_match)

    return limit_verb_suggestions_by_difficulty(
        matches,
        top_per_difficulty=top_per_difficulty,
        shuffle_results=shuffle_results,
    )


def write_verb_matches(
    client: SupabaseRestClient,
    verb: Verb,
    matches: list[VerbMatch],
    *,
    dry_run: bool,
    clear_existing: bool,
    chunk_size: int = 500,
) -> None:
    rows = [
        {
            "video_id": match.video_record_id,
            "verb_id": verb.id,
            "count": match.score,
            "difficulty": match.difficulty,
            "start": match.start_segment_id,
            "end": match.end_segment_id,
        }
        for match in matches
    ]

    if dry_run:
        LOGGER.info(
            "[dry-run] %s: would %s existing rows and insert %s row(s)",
            verb.name,
            "clear" if clear_existing else "keep",
            len(rows),
        )
        return

    if clear_existing:
        client.delete("top_verb_video", filters={"verb_id": f"eq.{verb.id}"})

    for start in range(0, len(rows), chunk_size):
        client.insert("top_verb_video", rows[start : start + chunk_size])


def parse_selected_verbs(values: list[str] | None) -> set[str]:
    selected: set[str] = set()
    for value in values or []:
        for item in value.split(","):
            cleaned = item.strip()
            if cleaned:
                selected.add(cleaned)
                selected.add(normalize_verb_search_text(cleaned))
    return selected


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Cache Spanish verb/video passage matches into Supabase top_verb_video.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        epilog=(
            "Credentials are read from EXPO_PUBLIC_SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY. The script loads .env from the current "
            "repo when present and also checks sibling git worktrees, which is "
            "useful when this runner is executed from an isolated worktree."
        ),
    )
    parser.add_argument("--limit-verbs", type=int, help="Process at most this many verbs after filtering.")
    parser.add_argument("--verb", action="append", help="Process one verb by id or name. May be repeated or comma-separated.")
    parser.add_argument("--dry-run", action="store_true", help="Compute matches and log write intent without changing Supabase.")
    parser.add_argument("--paragraph-count", type=int, default=DEFAULT_PARAGRAPH_COUNT, help="Number of transcript segments per passage window.")
    parser.add_argument("--language", default=DEFAULT_LANGUAGE, help="Channel language code used to choose videos.")
    parser.add_argument("--env-file", help="Explicit .env file to load before reading credentials.")
    parser.add_argument("--page-size", type=int, default=DEFAULT_PAGE_SIZE, help="Supabase REST page size.")
    parser.add_argument("--segment-video-chunk-size", type=int, default=DEFAULT_SEGMENT_VIDEO_CHUNK_SIZE, help="Number of video ids per bulk transcript segment query.")
    parser.add_argument("--top-per-difficulty", type=int, default=DEFAULT_TOP_PER_DIFFICULTY, help="Maximum cached matches per difficulty.")
    parser.add_argument("--clear-existing", dest="clear_existing", action="store_true", default=True, help="Delete existing cache rows for each verb before inserting replacements.")
    parser.add_argument("--no-clear-existing", dest="clear_existing", action="store_false", help="Insert without deleting existing rows. This is not idempotent unless the table has a unique constraint.")
    parser.add_argument("--shuffle", action="store_true", help="Shuffle the limited matches like the UI does before caching.")
    parser.add_argument("--fail-fast", action="store_true", help="Stop on the first verb failure.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if args.paragraph_count < 1:
        raise SystemExit("--paragraph-count must be at least 1")
    if args.page_size < 1:
        raise SystemExit("--page-size must be at least 1")
    if args.segment_video_chunk_size < 1:
        raise SystemExit("--segment-video-chunk-size must be at least 1")
    if args.top_per_difficulty < 1:
        raise SystemExit("--top-per-difficulty must be at least 1")

    repo_root = Path(__file__).resolve().parents[1]
    env_path = load_environment(repo_root, args.env_file)
    if env_path:
        LOGGER.info("Loaded environment from %s", env_path)

    supabase_url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise SystemExit(
            "Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
            "Set them in the environment or pass --env-file."
        )

    client = SupabaseRestClient(supabase_url, service_role_key, args.page_size)
    selected_verbs = parse_selected_verbs(args.verb)
    verbs = load_verbs(client, selected_verbs)
    if args.limit_verbs is not None:
        verbs = verbs[: max(0, args.limit_verbs)]
    if not verbs:
        LOGGER.warning("No verbs matched the requested filters.")
        return 0

    channels = load_spanish_channels(client, args.language)
    channel_by_channel_id = {channel.channel_id: channel for channel in channels}
    videos = load_videos_for_channels(client, set(channel_by_channel_id))
    if not videos:
        raise SystemExit(f"No videos found for language {args.language!r}.")

    verb_catalog = parse_typescript_verb_catalog(repo_root)
    segment_cache = SegmentWindowCache(client, args.paragraph_count)
    LOGGER.info(
        "Processing %s verb(s) across %s %s video(s); %s catalog verb(s) available.",
        len(verbs),
        len(videos),
        args.language,
        len(verb_catalog),
    )
    LOGGER.info("Preloading transcript windows in chunks of %s video(s).", args.segment_video_chunk_size)
    segment_cache.preload([video.id for video in videos], args.segment_video_chunk_size)

    failures: list[tuple[Verb, Exception]] = []
    for index, verb in enumerate(verbs, start=1):
        try:
            LOGGER.info("[%s/%s] Matching %s (id=%s)", index, len(verbs), verb.name, verb.id)
            matches = find_verb_matches(
                verb,
                videos,
                channel_by_channel_id,
                segment_cache,
                verb_catalog,
                top_per_difficulty=args.top_per_difficulty,
                shuffle_results=args.shuffle,
            )
            LOGGER.info("%s: %s match row(s)", verb.name, len(matches))
            write_verb_matches(
                client,
                verb,
                matches,
                dry_run=args.dry_run,
                clear_existing=args.clear_existing,
            )
        except Exception as error:  # noqa: BLE001 - keep batch running per verb.
            LOGGER.exception("%s failed: %s", verb.name, error)
            failures.append((verb, error))
            if args.fail_fast:
                break

    if failures:
        LOGGER.error("%s verb(s) failed.", len(failures))
        return 1

    LOGGER.info("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
