#!/bin/bash
# Manual smoke test for POST /feedback/turn
# Usage: SERVER=http://localhost:3001 bash server/test/feedback-turn.sh

BASE="${SERVER:-http://localhost:3001}"

run() {
  local label="$1"
  local payload="$2"
  echo "--- $label ---"
  curl -s -X POST "$BASE/feedback/turn" \
    -H "Content-Type: application/json" \
    -d "$payload" | python3 -m json.tool 2>/dev/null || echo "(raw)"
  echo
}

# Should return correction: "ho" → "sono" (andare needs essere)
run "Wrong auxiliary verb" \
  '{"italian":"Ieri ho andato al mercato","scenario":{"difficulty":"A2","characterName":"Marco"},"userLevel":"A2"}'

# Should return ok=true (correct)
run "Correct sentence" \
  '{"italian":"Vorrei un caffè macchiato, per favore","scenario":{"difficulty":"A1","characterName":"Giulia"},"userLevel":"A1"}'

# Should return correction: gender agreement error (la caffè → il caffè)
run "Gender agreement error" \
  '{"italian":"Prendo la caffè","scenario":{"difficulty":"A1","characterName":"Giulia"},"userLevel":"A1"}'

# Should return praise for subjunctive usage
run "Correct subjunctive (may get praise)" \
  '{"italian":"Spero che tu possa venire alla festa","scenario":{"difficulty":"B2","characterName":"Sofia"},"userLevel":"B2"}'

# Edge case: very short input
run "Single word" \
  '{"italian":"Ciao","scenario":{"difficulty":"A1","characterName":"Marco"},"userLevel":"A1"}'
