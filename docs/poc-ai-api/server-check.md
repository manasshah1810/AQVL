# Server Endpoint Checks

## CASE 1: Missing API Key

**Command:**

```powershell
curl -X POST http://localhost:3000/generate ^
  -H "Content-Type: application/json" ^
  -d "{\"topic\":\"bubble sort\"}"
```

**Expected Result:**

HTTP 500 JSON error.

**Actual Output:**

```json
HTTP/1.1 500 Internal Server Error

{
  "error": "PROVIDER_API_KEY is not configured on the server"
}
```

**Result:** PASS

---

## CASE 2: Real Generation

**Command:**

```powershell
$body = @{
    topic = "bubble sort"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/generate" `
  -ContentType "application/json" `
  -Body $body
```

**Expected Result:**

HTTP 200 with an `aqvl` string in the response.

**Actual Output:**

```text
aqvl
----
SCENE BubbleSort...
```

**Result:** PASS

The generated AQVL was saved temporarily and validated using the existing Y2 validation harness.

**Y2 Validation Command:**

```powershell
npx tsx poc\ai-api\validate.ts poc\ai-api\generated-bubble-sort.aqvl
```

**Y2 Validation Result:**

```json
{
  "valid": true,
  "stage": "AQIRGenerator",
  "errors": []
}
```

The temporary generated AQVL file was deleted after verification.

---

## Verification Summary

| Check | Result |
|---|---|
| Missing API key returns HTTP 500 JSON error | PASS |
| Real `/generate` request returns AQVL | PASS |
| Generated AQVL passes Y2 validation | PASS |
| Temporary generated AQVL file removed | PASS |