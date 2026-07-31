# API Examples

```bash
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/songs
curl -X POST http://localhost:8000/api/v1/search -H 'Content-Type: application/json' -d '{"query":"Bandhu he"}'
curl -X POST http://localhost:8000/api/v1/ai/explain -H 'Content-Type: application/json' -d '{"song_number":1}'
```
