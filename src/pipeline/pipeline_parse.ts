export interface PipelineItem {
  [key: string]: string;
}

export interface PipelineJob {
  settings: Record<string, string>;
  items: PipelineItem[];
}

function parseKeyValue(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf(":");
  if (idx === -1) return null;
  const key = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + 1).trim();
  if (!key) return null;
  return { key, value };
}

export function parsePipeline(text: string): PipelineJob {
  const settings: Record<string, string> = {};
  const items: PipelineItem[] = [];

  type Mode = "outside" | "settings" | "item";
  let mode: Mode = "outside";
  let currentItem: PipelineItem | null = null;
  let startSeen = false;

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === "#start") {
      if (mode !== "outside" || currentItem) {
        throw new Error("#start must appear outside of any block");
      }
      if (startSeen) {
        throw new Error("#start specified multiple times");
      }
      startSeen = true;
      items.length = 0;
      continue;
    }

    if (line === "[") {
      mode = "settings";
      continue;
    }
    if (line === "]") {
      mode = "outside";
      continue;
    }
    if (line === "{") {
      mode = "item";
      currentItem = {};
      continue;
    }
    if (line === "}") {
      if (currentItem) items.push(currentItem);
      currentItem = null;
      mode = "outside";
      continue;
    }

    const kv = parseKeyValue(rawLine);
    if (!kv) continue;

    if (mode === "settings" || mode === "outside") {
      // Accumulate duplicate keys with newlines (e.g., multiple alias: lines)
      if (settings[kv.key]) {
        settings[kv.key] += '\n' + kv.value;
      } else {
        settings[kv.key] = kv.value;
      }
    } else if (mode === "item") {
      if (!currentItem) currentItem = {};
      currentItem[kv.key] = kv.value;
    }
  }

  return { settings, items };
}
