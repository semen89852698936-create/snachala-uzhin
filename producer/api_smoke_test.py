#!/usr/bin/env python3
"""Minimal, low-token OpenAI Responses API connectivity check. Never prints secrets."""
import json, os, sys, urllib.request, urllib.error
key=os.environ.get("OPENAI_API_KEY")
if not key:
    raise SystemExit("OPENAI_API_KEY is missing from this workflow environment")
payload={
  "model": os.environ.get("OPENAI_MODEL","gpt-6.1-sol"),
  "instructions":"You are the connectivity checker for Producer 24/7. Reply with exactly: PRODUCER_ONLINE",
  "input":"Confirm the API connection.",
  "max_output_tokens":80,
  "store":False
}
req=urllib.request.Request("https://api.openai.com/v1/responses",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"},
    method="POST")
try:
    with urllib.request.urlopen(req,timeout=45) as res:
        data=json.loads(res.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    # Deliberately do not print request headers, key, or full request.
    body=e.read().decode("utf-8","replace")[:1200]
    print("OpenAI API returned HTTP",e.code,body,file=sys.stderr)
    raise SystemExit(1)
except Exception as e:
    print("API connectivity failed:",type(e).__name__,str(e)[:300],file=sys.stderr)
    raise SystemExit(1)
text="".join(part.get("text","") for item in data.get("output",[]) if item.get("type")=="message" for part in item.get("content",[]) if part.get("type")=="output_text").strip()
if data.get("status")!="completed" or text!="PRODUCER_ONLINE":
    print("Unexpected model response status or content; response id:",data.get("id"),"status:",data.get("status"),file=sys.stderr)
    raise SystemExit(1)
print(json.dumps({"ok":True,"model":data.get("model"),"response_id":data.get("id"),"status":data.get("status"),"usage":data.get("usage",{})},ensure_ascii=False))
