class LiteText {
  constructor(text) { this.nodeType = 3; this.nodeName = "#text"; this.childNodes = []; this._text = text; }
  get textContent() { return this._text; }
}

class LiteElement {
  constructor(name, attrs = {}) { this.nodeType = 1; this.nodeName = name; this.childNodes = []; this.attrs = attrs; }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; }
  get textContent() { return this.childNodes.map((n) => n.textContent || "").join(""); }
  getElementsByTagName(tag) {
    const out = [];
    const visit = (node) => {
      for (const child of node.childNodes || []) {
        if (child.nodeType === 1) {
          if (child.nodeName === tag) out.push(child);
          visit(child);
        }
      }
    };
    visit(this);
    return out;
  }
}

class LiteDocument extends LiteElement {
  constructor() { super("#document"); this.nodeType = 9; }
}

function decodeEntities(text) {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function parseAttributes(source) {
  const attrs = {};
  const re = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(source))) attrs[match[1]] = decodeEntities(match[2] ?? match[3] ?? "");
  return attrs;
}

export class LiteDOMParser {
  parseFromString(xml) {
    const doc = new LiteDocument();
    const stack = [doc];
    const sanitized = String(xml)
      .replace(/<\?xml[\s\S]*?\?>/gi, "")
      .replace(/<!--([\s\S]*?)-->/g, "")
      .replace(/<!DOCTYPE[^>]*>/gi, "");
    const tokens = sanitized.match(/<[^>]+>|[^<]+/g) || [];

    for (const token of tokens) {
      if (!token) continue;
      if (token.startsWith("<![CDATA[")) {
        stack.at(-1).childNodes.push(new LiteText(token.slice(9, -3)));
        continue;
      }
      if (token.startsWith("<!") || token.startsWith("<?")) continue;
      if (token.startsWith("</")) {
        const name = token.slice(2, -1).trim();
        if (stack.length <= 1 || stack.at(-1).nodeName !== name) throw new Error(`Malformed XML near closing tag ${name}`);
        stack.pop();
        continue;
      }
      if (token.startsWith("<")) {
        const selfClosing = /\/\s*>$/.test(token);
        const inside = token.slice(1, selfClosing ? token.lastIndexOf("/") : -1).trim();
        const firstSpace = inside.search(/\s/);
        const name = firstSpace < 0 ? inside : inside.slice(0, firstSpace);
        const attrs = parseAttributes(firstSpace < 0 ? "" : inside.slice(firstSpace + 1));
        const el = new LiteElement(name, attrs);
        stack.at(-1).childNodes.push(el);
        if (!selfClosing) stack.push(el);
        continue;
      }
      if (token.trim()) stack.at(-1).childNodes.push(new LiteText(decodeEntities(token)));
    }
    if (stack.length !== 1) throw new Error("Malformed XML: unclosed element");
    return doc;
  }
}
