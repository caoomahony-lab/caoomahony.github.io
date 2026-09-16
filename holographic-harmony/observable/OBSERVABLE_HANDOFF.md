# Observable handoff

The source application is intentionally independent of Observable. Do not rewrite the theory, parser, activity engine, admission engine, or visualization logic inside an Observable notebook.

## Deployment task

1. Verify the canonical GitHub commit supplied in `WORK_START_HERE.md` / handoff message.
2. Run `npm ci`, `npm test`, and `npm run build`.
3. Use Observable file attachments for each MusicXML and audio asset.
4. Build a `tracks` array with resolved URLs from `FileAttachment(...).url()`.
5. Mount the application through `mountObservableHolographicHarmony(root, tracks)` or copy the minimal compiled module surface if Observable requires it.
6. Ensure the application stylesheet is loaded exactly once.
7. Verify playback, seeking, repeated song changes, bounded layout height, mobile sizing, and console cleanliness.

## Required track shape

```js
{
  id: "springtime-standchen",
  title: "Springtime Ständchen",
  score: await FileAttachment("springtime.musicxml").url(),
  audio: await FileAttachment("springtime.mp3").url(),
  audioOffset: 0,
  analysis: {
    mode: "paper", // or "adaptive"
    field: { name: "B Lydian / F# collection", pcs: [11,1,3,5,6,8,10], center: 11 },
    latentCenter: 0,
    shadowAdmissionOrder: [2,9,4,0,7]
  }
}
```

## Do not

- Do not add a second playback clock.
- Do not replace MusicXML with audio transcription.
- Do not turn the 12-pitch circle into a page-height visualization.
- Do not call blue pitches "wrong notes".
- Do not present candidate centers or crystallization as measured facts.
- Do not redesign source architecture during deployment.

If Observable integration exposes a source defect, report the smallest reproducible defect and stop before architectural reconstruction.
