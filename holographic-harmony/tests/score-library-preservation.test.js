import test from "node:test";
import assert from "node:assert/strict";
import { ScoreComparisonPanel } from "../src/app/score-comparison-panel.js";

test("saving cannot overwrite unreadable score-library records", () => {
  for (const raw of ["broken", "{}", '[{"id":"legacy","title":"Keep me","scoreDescriptor":{}}]']) {
    let writes = 0;
    const panel = { current: { title: "New score", scoreDescriptor: { sourceId: "new" } }, corpus: [], status: {},
      storage: { getItem: () => raw, setItem() { writes++; } }, read: ScoreComparisonPanel.prototype.read };
    ScoreComparisonPanel.prototype.saveCurrent.call(panel);
    assert.equal(writes, 0); assert.match(panel.status.textContent, /preserved/);
  }
});
