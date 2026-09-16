export async function loadTrackManifest(url = "./public/tracks/tracks.json", signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load track manifest (${response.status})`);
  const tracks = await response.json();
  if (!Array.isArray(tracks) || tracks.length === 0) throw new Error("Track manifest is empty");
  return tracks;
}
