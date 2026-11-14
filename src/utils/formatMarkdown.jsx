import React from "react";

/**
 * Parses inline formatting: **bold**, *italic*, and `inline code`
 */
export function renderInlineContent(str, keyPrefix = "inline") {
  if (!str) return null;
  const nodes = [];
  let remaining = str;
  let idx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

    let firstMatch = null;
    let type = null;

    const candidates = [
      { match: boldMatch, type: "bold" },
      { match: codeMatch, type: "code" },
      { match: italicMatch, type: "italic" },
    ]
      .filter((c) => c.match !== null)
      .sort((a, b) => a.match.index - b.match.index);

    if (candidates.length > 0) {
      firstMatch = candidates[0].match;
      type = candidates[0].type;
    }

    if (!firstMatch) {
      nodes.push(remaining);
      break;
    }

    if (firstMatch.index > 0) {
      nodes.push(remaining.slice(0, firstMatch.index));
    }

    const key = `${keyPrefix}-${idx++}`;
    if (type === "bold") {
      nodes.push(
        <strong key={key} className="formatted-bold">
          {firstMatch[1]}
        </strong>
      );
    } else if (type === "code") {
      nodes.push(
        <code key={key} className="formatted-code">
          {firstMatch[1]}
        </code>
      );
    } else if (type === "italic") {
      nodes.push(
        <em key={key} className="formatted-italic">
          {firstMatch[1]}
        </em>
      );
    }

    remaining = remaining.slice(firstMatch.index + firstMatch[0].length);
  }

  return nodes;
}

/**
 * Formats multi-line Markdown text into structured React elements with bolding, lists, and headers
 */
export function formatMarkdown(rawText, options = {}) {
  if (!rawText) return null;

  const {
    lineClass = "resp-line",
    headingClass = "resp-h3",
    bulletClass = "resp-bullet",
    codeBlockClass = "bot-code-block",
    hrClass = "resp-divider",
  } = options;

  // Split out code blocks first
  const blocks = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: "text", content: rawText.slice(lastIndex, match.index) });
    }
    blocks.push({ type: "code", language: match[1] || "text", code: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < rawText.length) {
    blocks.push({ type: "text", content: rawText.slice(lastIndex) });
  }

  return blocks.map((block, bIdx) => {
    if (block.type === "code") {
      return (
        <pre key={`cb-${bIdx}`} className={codeBlockClass}>
          <code>{block.code}</code>
        </pre>
      );
    }

    const lines = block.content.split("\n");
    return lines.map((line, lIdx) => {
      const trimmed = line.trim();
      const lineKey = `line-${bIdx}-${lIdx}`;

      if (!trimmed) {
        return <div key={lineKey} style={{ height: "6px" }} />;
      }

      // Horizontal rule: --- or *** or ___
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        return <hr key={lineKey} className={hrClass} />;
      }

      // Headings: #, ##, ###
      if (trimmed.startsWith("#")) {
        const headingContent = trimmed.replace(/^#+\s*/, "");
        return (
          <strong key={lineKey} className={headingClass}>
            {renderInlineContent(headingContent, lineKey)}
          </strong>
        );
      }

      // Bullet points: - , * , •
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
        const bulletContent = trimmed.slice(2);
        return (
          <div key={lineKey} className={bulletClass}>
            <span className="bullet-dot">•</span>{" "}
            <span>{renderInlineContent(bulletContent, lineKey)}</span>
          </div>
        );
      }

      // Numbered lists: 1. , 2. , 1)
      const numMatch = trimmed.match(/^(\d+[.)])\s+(.*)/);
      if (numMatch) {
        return (
          <div key={lineKey} className={bulletClass}>
            <strong>{numMatch[1]}</strong>{" "}
            <span>{renderInlineContent(numMatch[2], lineKey)}</span>
          </div>
        );
      }

      // Regular line
      return (
        <p key={lineKey} className={lineClass}>
          {renderInlineContent(line, lineKey)}
        </p>
      );
    });
  });
}
