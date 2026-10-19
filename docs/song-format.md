# Song format

```json
{
  "schemaVersion": 1,
  "id": "night-transit",
  "title": "Night Transit",
  "project": { "path": "project/main.od", "format": "opendaw-native" },
  "engine": { "repository": "music-collab/opendaw", "commit": "a91f2c" },
  "assets": []
}
```

The project file remains the source of truth. Rendered audio is keyed by song id, commit SHA, and renderer version and is never committed to the song repository.
