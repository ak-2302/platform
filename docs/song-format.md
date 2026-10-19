# Song format

```json
{
  "schemaVersion": 1,
  "id": "night-transit",
  "title": "Night Transit",
  "project": { "path": "project/main.od", "format": "opendaw-native" },
  "engine": { "repository": "music-collab/opendaw", "commit": "25af248f6df66b321f921b54930f94fe5c09898f" },
  "assets": []
}
```

The project file remains the source of truth. Rendered audio is keyed by song id, commit SHA, and renderer version and is never committed to the song repository.
