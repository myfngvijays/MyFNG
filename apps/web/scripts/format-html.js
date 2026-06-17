const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

const RAW_TAGS = new Set(['script', 'style', 'pre', 'textarea']);

function getTagName(line) {
  const match = line.match(/^<\/?\s*([a-zA-Z0-9:-]+)/);
  return match ? match[1].toLowerCase() : '';
}

function isClosingTag(line) {
  return /^<\//.test(line);
}

function isSelfClosing(line) {
  return /\/>$/.test(line) || VOID_TAGS.has(getTagName(line));
}

function isOpeningTag(line) {
  return /^<[^!/]/.test(line) && !isClosingTag(line) && !isSelfClosing(line);
}

function preserveRawBlocks(html) {
  const blocks = [];
  const masked = html.replace(
    /<(script|style|pre|textarea)(\s[^>]*)?>[\s\S]*?<\/\1>/gi,
    (block, tag) => {
      const inner = block.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '');
      if (tag.toLowerCase() !== 'pre' && tag.toLowerCase() !== 'textarea') {
        if (!inner.includes('\n') && inner.length < 400) return block;
      }

      const token = `__RAW_BLOCK_${blocks.length}__`;
      blocks.push(block);
      return token;
    }
  );
  return { masked, blocks };
}

function restoreRawBlocks(html, blocks) {
  let output = html;
  blocks.forEach((block, index) => {
    output = output.replace(`__RAW_BLOCK_${index}__`, `\n${block}\n`);
  });
  return output;
}

function collapseEmptyScriptTags(html) {
  return html.replace(/<script([^>]*)>\s*<\/script>/gi, '<script$1></script>');
}

function formatJsonLdScripts(html) {
  return html.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    (_full, json) => {
      try {
        const pretty = JSON.stringify(JSON.parse(String(json).trim()), null, 2);
        return `<script type="application/ld+json">\n${pretty}\n</script>`;
      } catch {
        return _full;
      }
    }
  );
}

function formatHtml(html) {
  const { masked, blocks } = preserveRawBlocks(String(html || '').trim());
  const normalized = masked.replace(/>\s+</g, '><').replace(/>\s*</g, '>\n<');
  const lines = normalized.split('\n');

  let indent = 0;
  const formatted = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isClosingTag(line)) {
      indent = Math.max(0, indent - 1);
    }

    formatted.push(`${'  '.repeat(indent)}${line}`);

    if (isOpeningTag(line)) {
      const tag = getTagName(line);
      if (!RAW_TAGS.has(tag)) {
        indent += 1;
      }
    }
  }

  let output = restoreRawBlocks(`${formatted.join('\n')}\n`, blocks);
  output = collapseEmptyScriptTags(output);
  output = formatJsonLdScripts(output);
  return output;
}

module.exports = { formatHtml };
