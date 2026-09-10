import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);

assert.ok(scriptMatch, "index.html must contain the calculator script");

function loadCalculator(values) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: "",
        textContent: "",
        innerHTML: "",
        style: {display: "none"}
      });
    }
    return elements.get(id);
  };

  values.forEach((value, index) => {
    element(`n${index + 1}`).value = String(value);
  });

  const context = vm.createContext({
    document: {getElementById: element}
  });
  vm.runInContext(scriptMatch[1], context);
  return {calc: context.calc, element};
}

test("preserves the canonical Fantasy 5 universe and 38x38 census", () => {
  assert.match(html, /const TOTAL=850668;/);
  assert.match(html, /const OCCUPIED=902;/);
  assert.match(html, /const MAX_CELL=3864;/);
  assert.match(html, /const MIN_CELL=2;/);
});

test("uniform consecutive ticket maps to the exact D/G control cell", () => {
  const {calc, element} = loadCalculator([5, 1, 4, 2, 3]);
  calc();

  assert.equal(element("err").textContent, "");
  assert.equal(element("ticket").textContent, "01 – 02 – 03 – 04 – 05");
  assert.equal(element("D").textContent, "1.00");
  assert.equal(element("G").textContent, "0.000");
  assert.equal(element("H").textContent, "0.000");
  assert.equal(element("L").textContent, "0.000");
  assert.equal(element("C").textContent, "1.000");
  assert.equal(element("grid").textContent, "(1, 1)");
  assert.equal(element("cellpop").textContent, "38 sets");
  assert.equal(element("out").style.display, "block");
});

test("rejects duplicate and out-of-range tickets without producing output", () => {
  const duplicate = loadCalculator([1, 2, 3, 4, 4]);
  duplicate.calc();
  assert.equal(duplicate.element("err").textContent, "The five numbers must be distinct.");
  assert.equal(duplicate.element("out").style.display, "none");

  const outOfRange = loadCalculator([0, 2, 3, 4, 5]);
  outOfRange.calc();
  assert.equal(outOfRange.element("err").textContent, "Every number must be from 1 to 42.");
  assert.equal(outOfRange.element("out").style.display, "none");
});
