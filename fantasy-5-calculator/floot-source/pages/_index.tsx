import React, { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Switch } from "../components/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { fantasy5Geometry } from "../helpers/fantasy5Geometry";
import { batchCoverage, CoverageMode } from "../helpers/batchCoverage";
import {
  GAME_CONFIGS,
  LotteryGame,
  StatePoint,
  stateSpaceGeometry,
} from "../helpers/stateSpaceGeometry";
import styles from "./_index.module.css";

const DEFAULTS: Record<LotteryGame, number[]> = {
  fantasy5: [5, 12, 19, 27, 38],
  powerball: [8, 56, 61, 62, 63],
  megaMillions: [12, 24, 38, 51, 67],
};

const EDGES: Array<[number, number]> = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
];

const fmt = (value: number | null, places = 4) =>
  value === null ? "—" : value.toFixed(places);

const choose = (n: number, k: number) => {
  if (k < 0 || n < k) return 0;
  let value = 1;
  for (let i = 1; i <= k; i += 1) value = (value * (n - k + i)) / i;
  return Math.round(value);
};

export default function Home() {
  const [game, setGame] = useState<LotteryGame>("fantasy5");
  const [values, setValues] = useState(DEFAULTS.fantasy5.map(String));
  const [active, setActive] = useState(DEFAULTS.fantasy5);
  const [error, setError] = useState("");
  const [batchText, setBatchText] = useState("");
  const [batchError, setBatchError] = useState("");
  const [batchResult, setBatchResult] = useState<ReturnType<typeof batchCoverage.analyze> | null>(null);
  const [coverageMode, setCoverageMode] = useState<CoverageMode>("uniform");

  const config = GAME_CONFIGS[game];
  const metrics = useMemo(
    () => stateSpaceGeometry.compute(active, game),
    [active, game],
  );
  const lattice = useMemo(
    () => stateSpaceGeometry.lattice(metrics.R),
    [metrics.R],
  );
  const fantasyMap = useMemo(() => fantasy5Geometry.enumerate(), []);
  const fantasyMetrics = useMemo(
    () => game === "fantasy5" ? fantasy5Geometry.compute(active) : null,
    [active, game],
  );

  const universe = choose(config.max, 5);
  const population = useMemo(() => {
    if (!fantasyMetrics) return null;
    const di = fantasyMetrics.dIndex - 1;
    const gi = fantasyMetrics.gIndex - 1;
    const cell = fantasyMap.counts[di][gi] || 0;
    const occupied = fantasyMap.counts.flat().filter((value) => value > 0);
    const rank = occupied.filter((value) => value > cell).length + 1;
    return {
      di,
      gi,
      cell,
      rank,
      share: (100 * cell) / fantasy5Geometry.TOTAL,
      dPopulation: fantasyMap.dCounts[di],
      gPopulation: fantasyMap.gCounts[gi],
    };
  }, [fantasyMap, fantasyMetrics]);

  const calculate = () => {
    try {
      if (values.some((value) => value.trim() === "")) {
        throw new Error(`Enter five distinct whole numbers from 1 to ${config.max}.`);
      }
      const next = stateSpaceGeometry.compute(values.map(Number), game);
      setActive(next.ticket);
      setValues(next.ticket.map(String));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid ticket.");
    }
  };

  const changeGame = (nextGame: LotteryGame) => {
    const next = DEFAULTS[nextGame];
    setGame(nextGame);
    setActive(next);
    setValues(next.map(String));
    setError("");
    setBatchResult(null);
    setBatchError("");
  };

  const randomize = () => {
    const next = stateSpaceGeometry.random(game);
    setActive(next);
    setValues(next.map(String));
    setError("");
  };

  const calculateBatch = () => {
    try {
      const tickets = batchCoverage.parse(batchText, game);
      setBatchResult(batchCoverage.analyze(tickets, game, coverageMode));
      setBatchError("");
    } catch (cause) {
      setBatchResult(null);
      setBatchError(cause instanceof Error ? cause.message : "Invalid batch.");
    }
  };

  const changeCoverageMode = (population: boolean) => {
    const next: CoverageMode = population ? "population" : "uniform";
    setCoverageMode(next);
    try {
      const tickets = batchCoverage.parse(batchText, game);
      setBatchResult(batchCoverage.analyze(tickets, game, next));
      setBatchError("");
    } catch {
      setBatchResult(null);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.hero}>
          <div className={styles.kicker}>
            CANONICAL {config.short.toUpperCase()} GEOMETRY · 1–{config.max} CHOOSE 5
          </div>
          <h1>Lottery Geometry Calculator</h1>
          <p>
            Exact geometry for all <strong>{universe.toLocaleString()}</strong> legal {config.short} sets.
            Enter a ticket, inspect its intrinsic coordinates, and locate it in the realizable 5D structure.
          </p>
          <div className={styles.structureBadge}>
            <span>5D canonical state</span>
            <span>{metrics.shapeCount.toLocaleString()} shapes at range {metrics.R}</span>
          </div>
        </header>

        <section className={`${styles.panel} ${styles.coveragePanel}`} aria-label="D-space batch coverage">
          <div className={styles.coverageTop}>
            <div>
              <div className={styles.eyebrow}>BATCH DISTRIBUTION</div>
              <h2>{coverageMode === "population" ? "Population-weighted D-space" : "D-space coverage"}</h2>
              <p>{coverageMode === "population" ? "Match your tickets to an N-point baseline fitted to the exact D–G population density." : "How evenly this ticket batch covers the realizable D–G space compared with the best distribution found for the same number of tickets."}</p>
            </div>
            <div className={styles.coverageNumber}>
              <span>{coverageMode === "population" ? "POPULATION MATCH" : "COVERAGE"}</span>
              <strong>{batchResult ? `${batchResult.coverage.toFixed(1)}%` : "—"}</strong>
              <small>{batchResult ? `${batchResult.count} tickets` : "Add 2+ tickets"}</small>
            </div>
          </div>
          <div className={styles.modeBar}>
            <span className={coverageMode === "uniform" ? styles.modeActive : ""}>Uniform geometry</span>
            <Switch checked={coverageMode === "population"} onCheckedChange={changeCoverageMode} aria-label="Toggle population-weighted baseline" />
            <span className={coverageMode === "population" ? styles.modeActive : ""}>Population weighted</span>
          </div>
          <div className={styles.batchControls}>
            <label className={styles.batchGameField}>
              <span>GAME</span>
              <Select value={game} onValueChange={(value) => changeGame(value as LotteryGame)}>
                <SelectTrigger aria-label="Lottery game"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fantasy5">Fantasy 5 · 1–42</SelectItem>
                  <SelectItem value="powerball">Powerball white balls · 1–69</SelectItem>
                  <SelectItem value="megaMillions">Mega Millions white balls · 1–70</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className={styles.batchTicketField}>
              <span>ONE TICKET PER LINE</span>
              <Textarea
                value={batchText}
                onChange={(event) => setBatchText(event.target.value)}
                placeholder={`Example:\n5 12 19 27 38\n2 8 21 31 42`}
                rows={5}
              />
            </label>
            <Button onClick={calculateBatch}>Calculate batch coverage</Button>
          </div>
          <div className={styles.error} role="alert" aria-live="polite">{batchError}</div>
          {batchResult && (
            <>
              <BatchCoveragePlot result={batchResult} />
              {batchResult.mode === "population" && (
                <div className={styles.enrichmentBanner}>
                  <b>HIGH ENRICHMENT ZONE</b>
                  <span>top {batchResult.highClassCount} / {batchResult.occupiedClasses} D×G classes</span>
                  <span>{(100*batchResult.quickPickRate).toFixed(2)}% of legal sets</span>
                  <span>{batchResult.enrichmentRatio.toFixed(2)}× enrichment</span>
                </div>
              )}
              <div className={styles.statGrid}>
                {batchResult.mode === "population" ? <>
                  <Summary label="POPULATION RMS" value={batchResult.rmsDistance.toFixed(4)} />
                  <Summary label="EQUAL-SPACE RMS" value={batchResult.uniformRmsDistance.toFixed(4)} />
                  <Summary label="IN HIGH ZONE" value={`${batchResult.ticketHighCount} / ${batchResult.count}`} />
                  <Summary label="YOUR HIGH-ZONE RATE" value={`${(100*batchResult.ticketHighRate).toFixed(1)}%`} />
                  <Summary label="QUICK-PICK EXPECTED" value={`${(100*batchResult.quickPickRate).toFixed(2)}%`} />
                  <Summary label="EXPECTED IN THIS BATCH" value={batchResult.expectedHighCount.toFixed(1)} />
                  <Summary label="CLOSER BASELINE" value={batchResult.rmsDistance <= batchResult.uniformRmsDistance ? "Population" : "Equal-space"} />
                  <Summary label="EXACT POPULATION" value={batchResult.totalWeight.toLocaleString()} />
                </> : <>
                  <Summary label="YOUR COVERAGE RADIUS" value={batchResult.actualRadius.toFixed(4)} />
                  <Summary label="BEST-FOUND RADIUS" value={batchResult.referenceRadius.toFixed(4)} />
                  <Summary label="EXCESS DISTANCE" value={batchResult.excessRadius.toFixed(4)} />
                  <Summary label="BATCH SIZE" value={String(batchResult.count)} />
                </>}
              </div>
              <p className={styles.derivedNote}>
                {batchResult.mode === "population"
                  ? "Gold X marks are the population-weighted baseline; pale diamonds are the equally spaced baseline. The gold cell haze marks the high-enrichment classes. A true Quick Pick is uniform over legal tickets, so its exact expected high-zone rate equals the zone’s share of legal sets."
                  : "100% means the batch matches the best distribution found by the calculator at this batch size. This is a geometric coverage score, not a prediction of winning probability."}
              </p>
            </>
          )}
        </section>

        <section className={`${styles.panel} ${styles.controls}`} aria-label="Lottery ticket controls">
          <div className={styles.numberField}>
            <span>FIVE DISTINCT WHITE-BALL NUMBERS</span>
            <div className={styles.inputs}>
              {values.map((value, index) => (
                <Input
                  key={index}
                  aria-label={`Number ${index + 1}`}
                  inputMode="numeric"
                  min={1}
                  max={config.max}
                  value={value}
                  onChange={(event) => setValues((old) => old.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item
                  ))}
                  onKeyDown={(event) => event.key === "Enter" && calculate()}
                />
              ))}
            </div>
          </div>
          <Button onClick={calculate}>Calculate</Button>
          <Button variant="secondary" onClick={randomize}>Random example</Button>
          <div className={styles.error} role="alert" aria-live="polite">{error}</div>
        </section>

        <section className={styles.summary} aria-label="Selected ticket summary">
          <Summary label="SORTED TICKET" value={metrics.ticket.map((n) => String(n).padStart(2, "0")).join(" – ")} wide />
          <Summary label="D / SCALE" value={fmt(metrics.D, 2)} />
          <Summary label="G / INEQUALITY" value={fmt(metrics.G, 4)} />
          <Summary label="CANONICAL STATE" value={`(${fmt(metrics.D, 3)}, ${fmt(metrics.S, 4)}, ${fmt(metrics.qH, 4)}, ${fmt(metrics.qK, 4)}, ${fmt(metrics.qT, 4)})`} wide />
          <Summary label="SHAPES AT R" value={metrics.shapeCount.toLocaleString()} />
          <Summary label="STATES AT R" value={metrics.statesAtR.toLocaleString()} />
        </section>

        <Section eyebrow="COORDINATED 5D STATE" title="Scale, translation, and intrinsic shape">
          <p className={styles.sectionLead}>
            These two views are one state: the triangular base fixes scale and translation; the tetrahedral fiber fixes the three intrinsic q-space coordinates.
          </p>
          <div className={styles.twoColumn}>
            <BasePlot metrics={metrics} max={config.max} />
            <FiberPlot metrics={metrics} lattice={lattice} />
          </div>
        </Section>

        {game === "fantasy5" && population ? (
          <Section eyebrow="PRIMARY STRUCTURE" title="D×G realizable map" aside="opacity = cell population">
            <PopulationMap map={fantasyMap} population={population} />
            <div className={styles.statGrid}>
              <Summary label="GRID CELL" value={`(${population.di + 1}, ${population.gi + 1})`} />
              <Summary label="CELL POPULATION" value={population.cell.toLocaleString()} />
              <Summary label="CELL SHARE" value={`${population.share.toFixed(3)}%`} />
              <Summary label="POPULATION RANK" value={`#${population.rank} / ${fantasyMap.occupiedCells}`} />
              <Summary label="EXACT D POPULATION" value={population.dPopulation.toLocaleString()} />
              <Summary label="G-BIN POPULATION" value={population.gPopulation.toLocaleString()} />
            </div>
            <p className={styles.derivedNote}>
              Exact enumeration: all 850,668 Fantasy 5 sets are binned into the calculator’s canonical 38×38 D/G map. The selected cyan cell is the current ticket.
            </p>
          </Section>
        ) : (
          <Section eyebrow="FINITE STATE COUNT" title={`${config.short} structure`} aside="exact at selected range">
            <div className={styles.statGrid}>
              <Summary label="RANGE R" value={String(metrics.R)} />
              <Summary label="SHAPE COMPOSITIONS" value={metrics.shapeCount.toLocaleString()} />
              <Summary label="TRANSLATIONS" value={metrics.translations.toLocaleString()} />
              <Summary label="STATES AT R" value={metrics.statesAtR.toLocaleString()} />
            </div>
            <p className={styles.derivedNote}>
              The exhaustive 38×38 population map is a certified Fantasy 5 reference and is not relabeled as Powerball or Mega Millions data. The 5D coordinates and fixed-range counts above are exact for this game’s white-ball range.
            </p>
          </Section>
        )}

        <div className={styles.twoColumn}>
          <Section eyebrow="INTRINSIC SHAPE" title="q-space coordinates">
            <QPlot metrics={metrics} />
            <div className={styles.statGrid}>
              <Summary label="qH" value={fmt(metrics.qH, 6)} />
              <Summary label="qK" value={fmt(metrics.qK, 6)} />
              <Summary label="qT" value={fmt(metrics.qT, 6)} />
            </div>
            <p className={styles.derivedNote}>qH–qK is a 2D projection; qT remains explicit so no intrinsic coordinate is discarded.</p>
          </Section>

          <Section eyebrow="CANONICAL METRICS" title="Ticket geometry">
            <div className={styles.metricTable}>
              <MetricRow symbol="D" value={fmt(metrics.D, 4)} note="scale = R / 4" />
              <MetricRow symbol="G" value={fmt(metrics.G, 6)} note="population SD(gaps) / D" />
              <MetricRow symbol="H" value={fmt(metrics.H, 6)} note="directed gap gradient" />
              <MetricRow symbol="C" value={fmt(metrics.C, 6)} note="clumpiness" />
              <MetricRow symbol="L" value={fmt(metrics.L, 6)} note="oscillation" />
              <MetricRow symbol="S" value={fmt(metrics.S, 6)} note="normalized start" />
            </div>
          </Section>
        </div>

        <Section eyebrow="NORMALIZED GAP SHAPE" title="Gap coordinates">
          <div className={styles.metricTable}>
            <MetricRow symbol="g" value={`(${metrics.gaps.join(", ")})`} note="raw positive gaps" />
            <MetricRow symbol="Δ" value={`(${metrics.gaps.slice(1).map((gap, index) => gap - metrics.gaps[index]).join(", ")})`} note="successive gap differences" />
            <MetricRow symbol="R" value={String(metrics.R)} note="x₅ − x₁" />
            <MetricRow symbol="p" value={`(${metrics.p.map((value) => fmt(value, 4)).join(", ")})`} note="gᵢ / R" />
            <MetricRow symbol="d" value={`(${metrics.d.map((value) => fmt(value, 4)).join(", ")})`} note="pᵢ − ¼; Σd = 0" />
          </div>
        </Section>

        <Section eyebrow="REFERENCE" title="Canonical definitions">
          <pre className={styles.formulas}>{`Universe = C(${config.max},5) = ${universe.toLocaleString()}
x₁ < x₂ < x₃ < x₄ < x₅
gᵢ = xᵢ₊₁ − xᵢ      R = x₅ − x₁      D = R/4
T = x₁ − 1           S = T / (${config.max} − R − 1)
pᵢ = gᵢ/R            dᵢ = pᵢ − 1/4    Σdᵢ = 0

α = (−3,−1,1,3)/√20
β = (1,−1,−1,1)/2
γ = (1,−3,3,−1)/√20
qH = d·α     qK = d·β     qT = d·γ

G = SD(g)/D
H = (−1.5g₁ − 0.5g₂ + 0.5g₃ + 1.5g₄)/R
C = ¼ Σ max(0, (D/gᵢ − 1)/(D − 1)); D=1 → C=1
L = (r/2)·A·P`}</pre>
        </Section>

        <footer className={styles.footer}>
          This maps geometry; it does not predict a winner. Under an ideal lottery draw, every legal five-number combination remains equally probable. Powerball and Mega Millions special balls are excluded from this white-ball state space.
        </footer>
      </div>
    </main>
  );
}

function BatchCoveragePlot({ result }: { result: ReturnType<typeof batchCoverage.analyze> }) {
  const x0=46, y0=24, width=504, height=286;
  const sampleStep=Math.max(1, Math.ceil(result.space.length/3500));
  const space=result.space.filter((_,index)=>index%sampleStep===0);
  const xy=(point:{d:number;g:number})=>({x:x0+point.d*width,y:y0+(1-point.g)*height});
  const peak=xy(result.peak), cellW=width*result.dStep*.9, cellH=height*result.gStep*.9;
  return (
    <div className={styles.coveragePlotCard}>
      <div className={styles.plotTitle}><b>{result.mode==="population"?"Population vs equal-space baselines":"Your batch vs best-found distribution"}</b><span>D–G SPACE</span></div>
      <svg viewBox="0 0 600 350" className={styles.coveragePlot} role="img" aria-label="Batch distribution across D and G space">
        <rect x={x0} y={y0} width={width} height={height} className={styles.mapBackground} />
        {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={x0+t*width} y1={y0} x2={x0+t*width} y2={y0+height} className={styles.coverageGrid}/><line x1={x0} y1={y0+t*height} x2={x0+width} y2={y0+t*height} className={styles.coverageGrid}/><text x={x0+t*width} y="331" textAnchor="middle" className={styles.axisLabel}>{(1+t*(result.dMax-1)).toFixed(1)}</text><text x="38" y={y0+(1-t)*height+3} textAnchor="end" className={styles.axisLabel}>{(t*result.gMax).toFixed(2)}</text></g>)}
        {result.mode==="population"&&result.highZone.map((cell,index)=>{const p=xy(cell);return <rect key={`hz${index}`} x={p.x-cellW/2} y={p.y-cellH/2} width={cellW} height={cellH} rx="1" className={styles.highZoneCell}/>;})}
        {space.map((point,index)=>{const p=xy(point),opacity=result.mode==="population"?0.08+0.72*Math.sqrt(point.weight/result.peak.weight):0.18;return <circle key={index} cx={p.x} cy={p.y} r={result.mode==="population"?1.35:1} className={styles.coverageSpacePoint} style={{opacity}}/>;})}
        {result.mode==="population"&&result.uniformReference.map((point,index)=>{const p=xy(point);return <rect key={`u${index}`} x={p.x-3.3} y={p.y-3.3} width="6.6" height="6.6" transform={`rotate(45 ${p.x} ${p.y})`} className={styles.uniformMark}/>;})}
        {result.mode==="population"&&result.assignment.map(([ri,ai],index)=>{const a=xy(result.reference[ri]),b=xy(result.actual[ai]);return <line key={`m${index}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.matchLine}/>;})}
        {result.reference.map((point,index)=>{const p=xy(point);return <g key={`r${index}`}><line x1={p.x-5} y1={p.y-5} x2={p.x+5} y2={p.y+5} className={styles.referenceMark}/><line x1={p.x-5} y1={p.y+5} x2={p.x+5} y2={p.y-5} className={styles.referenceMark}/></g>;})}
        {result.actual.map((point,index)=>{const p=xy(point);return <g key={`a${index}`}><circle cx={p.x} cy={p.y} r="5" className={styles.batchPoint}/><text x={p.x+7} y={p.y-6} className={styles.pointLabel}>{index+1}</text></g>;})}
        {result.mode==="population"&&<g><circle cx={peak.x} cy={peak.y} r="8" className={styles.peakRing}/><text x={peak.x+10} y={peak.y+4} className={styles.peakLabel}>population peak</text></g>}
        <text x="285" y="348" className={styles.axisLabel}>D</text>
        <text x="13" y="190" transform="rotate(-90 13 190)" className={styles.axisLabel}>G</text>
      </svg>
      <div className={styles.plotLegend}>
        <span><i className={styles.legendActual}/>your tickets</span>
        <span><i className={styles.legendReference}/>{result.mode==="population"?"population baseline":"best-found reference"}</span>
        {result.mode==="population"&&<><span><i className={styles.legendUniform}/>equal-space baseline</span><span><i className={styles.legendZone}/>high enrichment zone</span></>}
      </div>
    </div>
  );
}

function Section({ eyebrow, title, aside, children }: {
  eyebrow: string;
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.sectionHead}>
        <div><div className={styles.eyebrow}>{eyebrow}</div><h2>{title}</h2></div>
        {aside && <span>{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Summary({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`${styles.summaryCard} ${wide ? styles.summaryWide : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function MetricRow({ symbol, value, note }: { symbol: string; value: string; note: string }) {
  return <div className={styles.metricRow}><b>{symbol}</b><div><strong>{value}</strong><span>{note}</span></div></div>;
}

function BasePlot({ metrics, max }: { metrics: StatePoint; max: number }) {
  const maxD = (max - 1) / 4;
  const x = 48 + ((metrics.D - 1) / (maxD - 1)) * 474;
  const y = 292 - (metrics.T / Math.max(1, max - 5)) * 238;
  return (
    <div className={styles.plotCard}>
      <div className={styles.plotTitle}><b>Scale–translation base</b><span>2 DIMENSIONS</span></div>
      <svg viewBox="0 0 570 335" className={styles.plot} role="img" aria-label={`Scale ${fmt(metrics.D, 3)}, translation ${metrics.T}`}>
        <polygon points="48,292 522,292 48,54" className={styles.hull} />
        {[0, 1, 2, 3, 4].map((index) => <line key={`h${index}`} x1="48" x2="522" y1={54 + index * 59.5} y2={54 + index * 59.5} className={styles.gridLine} />)}
        {[0, 1, 2, 3, 4].map((index) => <line key={`v${index}`} y1="54" y2="292" x1={48 + index * 118.5} x2={48 + index * 118.5} className={styles.gridLine} />)}
        <line x1={x} x2={x} y1={y} y2="292" className={styles.guideLine} />
        <line x1="48" x2={x} y1={y} y2={y} className={styles.guideLine} />
        <circle cx={x} cy={y} r="8" className={styles.pointRing} />
        <circle cx={x} cy={y} r="3" className={styles.pointCore} />
        <text x={x + 11} y={y - 8} className={styles.pointLabel}>ticket</text>
        <text x="240" y="324" className={styles.axisLabel}>D · range / 4</text>
        <text x="16" y="190" transform="rotate(-90 16 190)" className={styles.axisLabel}>T · x₁ − 1</text>
      </svg>
      <p>D = {fmt(metrics.D, 3)}, T = {metrics.T}, S = {fmt(metrics.S, 4)} · {metrics.translations} legal translations at this range.</p>
    </div>
  );
}

function FiberPlot({ metrics, lattice }: { metrics: StatePoint; lattice: Array<[number, number, number]> }) {
  const project = (qH: number, qK: number, qT: number) => ({ x: 210 + qH * 215 + qT * 120, y: 165 - qK * 195 + qT * 72 });
  const root20 = Math.sqrt(20);
  const corners = [[0.75, -0.25, -0.25, -0.25], [-0.25, 0.75, -0.25, -0.25], [-0.25, -0.25, 0.75, -0.25], [-0.25, -0.25, -0.25, 0.75]].map((d) => {
    const qH = d.reduce((sum, value, index) => sum + value * [-3 / root20, -1 / root20, 1 / root20, 3 / root20][index], 0);
    const qK = d.reduce((sum, value, index) => sum + value * [0.5, -0.5, -0.5, 0.5][index], 0);
    const qT = d.reduce((sum, value, index) => sum + value * [1 / root20, -3 / root20, 3 / root20, -1 / root20][index], 0);
    return project(qH, qK, qT);
  });
  const inner = corners.map((point) => ({ x: 210 + (point.x - 210) * metrics.lambda, y: 165 + (point.y - 165) * metrics.lambda }));
  const selected = project(metrics.qH, metrics.qK, metrics.qT);
  const step = Math.max(1, Math.ceil(lattice.length / 3200));
  const sampled = lattice.filter((_, index) => index % step === 0);
  return (
    <div className={styles.plotCard}>
      <div className={styles.plotTitle}><b>Intrinsic q-space fiber</b><span>3 DIMENSIONS</span></div>
      <svg viewBox="0 0 420 330" className={styles.plot} role="img" aria-label="Projected tetrahedral q-space fiber">
        {EDGES.map(([a, b], index) => <line key={index} x1={corners[a].x} y1={corners[a].y} x2={corners[b].x} y2={corners[b].y} className={styles.outerEdge} />)}
        {EDGES.map(([a, b], index) => <line key={`inner${index}`} x1={inner[a].x} y1={inner[a].y} x2={inner[b].x} y2={inner[b].y} className={styles.innerEdge} />)}
        {sampled.map(([qH, qK, qT], index) => { const point = project(qH, qK, qT); return <circle key={index} cx={point.x} cy={point.y} r="0.55" className={styles.latticePoint} />; })}
        <circle cx={selected.x} cy={selected.y} r="8" className={styles.pointRing} />
        <circle cx={selected.x} cy={selected.y} r="3" className={styles.pointCore} />
        <text x={selected.x + 10} y={selected.y - 8} className={styles.pointLabel}>ticket</text>
      </svg>
      <p>{metrics.shapeCount.toLocaleString()} exact positive-integer gap compositions at R = {metrics.R}. Fiber scale λ(D) = {fmt(metrics.lambda, 4)}.</p>
    </div>
  );
}

function PopulationMap({ map, population }: {
  map: ReturnType<typeof fantasy5Geometry.enumerate>;
  population: { di: number; gi: number };
}) {
  const max = map.maxCell;
  const x0 = 54, y0 = 24, width = 494, height = 304;
  const cellWidth = width / 38, cellHeight = height / 38;
  return (
    <svg viewBox="0 0 600 380" className={styles.populationMap} role="img" aria-label="Exact Fantasy 5 D by G population map">
      <rect x={x0} y={y0} width={width} height={height} className={styles.mapBackground} />
      {map.counts.flatMap((row, di) => row.map((count, gi) => {
        const selected = di === population.di && gi === population.gi;
        return <rect key={`${di}-${gi}`} x={x0 + gi * cellWidth + 0.7} y={y0 + (37 - di) * cellHeight + 0.7} width={cellWidth - 1.4} height={cellHeight - 1.4} rx="0.7" className={selected ? styles.selectedCell : styles.mapCell} style={{ opacity: count ? 0.16 + 0.78 * Math.sqrt(count / max) : 0.035 }} />;
      }))}
      <text x="270" y="365" className={styles.axisLabel}>G → 0 … {fmt(fantasy5Geometry.GMAX, 3)}</text>
      <text x="17" y="214" transform="rotate(-90 17 214)" className={styles.axisLabel}>D → 1.00 … 10.25</text>
    </svg>
  );
}

function QPlot({ metrics }: { metrics: StatePoint }) {
  const x = 250 + metrics.qH * 300;
  const y = 176 - metrics.qK * 270;
  return (
    <svg viewBox="0 0 500 355" className={styles.qPlot} role="img" aria-label={`qH ${fmt(metrics.qH, 6)}, qK ${fmt(metrics.qK, 6)}`}>
      <rect x="45" y="20" width="410" height="292" className={styles.qBackground} />
      <line x1="250" y1="20" x2="250" y2="312" className={styles.qAxis} />
      <line x1="45" y1="166" x2="455" y2="166" className={styles.qAxis} />
      <circle cx={x} cy={y} r="7" className={styles.qPoint} />
      <text x="414" y="340" className={styles.axisLabel}>qH</text>
      <text x="14" y="40" className={styles.axisLabel}>qK</text>
    </svg>
  );
}
