#!/usr/bin/env python3
"""Acquire a bounded PDMX v9 pilot; never unpack arbitrary archive paths."""
import argparse
import csv
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile
import urllib.request

RECORD = "https://zenodo.org/records/15571083"
API = "https://zenodo.org/api/records/15571083/files/"
CSV_MD5 = "30392ccf38bb63ce70e7afae70f9c88c"
ARCHIVE_MD5 = "49ffd75ecf5489c0be6d41182eb11ff7"

def digest(path):
    h = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def number(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0

def acquire(cache, count):
    cache.mkdir(parents=True, exist_ok=True)
    csv_path = cache / "PDMX.csv"
    if not csv_path.exists():
        with urllib.request.urlopen(API + "PDMX.csv/content", timeout=30) as response, csv_path.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
    if digest(csv_path) != CSV_MD5:
        raise ValueError("PDMX.csv does not match the pinned v9 checksum; refusing ingestion")
    candidates = {}
    with csv_path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if not all(row.get(key) == "True" for key in ["subset:no_license_conflict", "subset:all_valid", "subset:deduplicated"]):
                continue
            if row.get("license_conflict") != "False" or row.get("license") != "publicdomain" or row.get("is_draft") == "True":
                continue
            if not 48 <= number(row.get("n_notes")) <= 1000 or not 10 <= number(row.get("song_length.seconds")) <= 300:
                continue
            mxl = row.get("mxl", "").removeprefix("./")
            source_path = PurePosixPath(mxl)
            if source_path.is_absolute() or ".." in source_path.parts or source_path.suffix != ".mxl" or not mxl.startswith("mxl/"):
                continue
            candidates[mxl] = {key: row.get(key) for key in ["title", "song_name", "composer_name", "artist_name", "genres", "tags", "metadata", "license", "license_url", "n_notes", "rating", "n_ratings", "n_tracks"]}
    print(f"Pinned CSV verified; {len(candidates)} eligible records", flush=True)
    sources = cache / "mxl"
    sources.mkdir(exist_ok=True)
    selected = []
    with urllib.request.urlopen(API + "mxl.tar.gz/content", timeout=30) as response:
        with tarfile.open(fileobj=response, mode="r|gz") as archive:
            for member in archive:
                name = member.name.removeprefix("./")
                if name not in candidates or not member.isfile() or not 0 < member.size <= 2_000_000:
                    continue
                data = archive.extractfile(member).read()
                sha256 = hashlib.sha256(data).hexdigest()
                destination = sources / (sha256 + ".mxl")
                destination.write_bytes(data)
                selected.append({"archivePath": name, "localPath": str(destination.resolve()), "sha256": sha256, **candidates[name]})
                if len(selected) % 100 == 0:
                    print(f"Acquired {len(selected)} eligible MXL records", flush=True)
                if len(selected) == count:
                    break
    result = {"source": {"recordUrl": RECORD, "doi": "10.5281/zenodo.15571083", "release": "v9", "metadataLicense": "CC-BY-4.0", "csvMd5": CSV_MD5, "archiveExpectedMd5": ARCHIVE_MD5, "archiveVerification": "bounded stream; individual MXL SHA-256 retained, full archive not downloaded"},
              "selection": {"candidateCount": len(candidates), "requestedCount": count, "policy": "First eligible members in pinned archive order; no_license_conflict AND all_valid AND deduplicated; publicdomain label; not draft; 48–1000 metadata notes; 10–300 metadata seconds"}, "records": selected}
    (cache / "selection.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if len(selected) != count:
        raise ValueError(f"Only {len(selected)} of {count} requested eligible scores acquired")
    print(f"Saved reproducible selection of {count} scores", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cache", type=Path)
    parser.add_argument("--count", type=int, default=650)
    args = parser.parse_args()
    if not 1 <= args.count <= 2000:
        parser.error("count must be between 1 and 2000")
    acquire(args.cache.resolve(), args.count)
