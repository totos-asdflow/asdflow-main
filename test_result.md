#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Autonomous Routine App for Children on the Autism Spectrum (Greek: "Εφαρμογή Αυτόνομης Ρουτίνας").
  Adds Welcome screen with 6-language selection (EL/EN/ES/FR/DE/IT) and a calming Splash screen.
  Backend seeds 3 default routines (Morning / After-school / Bedtime) translated across all 6 languages
  with multilang `names`/`titles`/`labels` dicts. Frontend resolves localized strings via `loc()` helper.

backend:
  - task: "Multi-language Settings (LangCode literal)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Expanded Settings.language and TTSRequest.lang from Literal[el,en] to LangCode (el,en,es,fr,de,it). PUT /api/settings should accept any of the 6 codes."
        - working: true
          agent: "testing"
          comment: "Verified PUT /api/settings accepts all 6 LangCode values (el, en, es, fr, de, it) – each returns 200 with response.language matching the payload and is persisted via upsert on the singleton doc. Invalid code 'xx' correctly rejected with 422 Unprocessable Entity. POST /api/tts with lang in {es, fr, de, it} returned 200 (valid TTS output) and never 422, confirming TTSRequest.lang LangCode is effective. verify-pin endpoint also working (1234->valid:true, 0000->valid:false)."

  - task: "Multi-language seed (names/titles/labels dicts)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Default routines (Morning, After-school, Bedtime) seeded with names dict for es/fr/de/it and step titles dict. SEED_VERSION=3 forces re-seed on startup. Verify GET /api/routines returns 3 default routines, each with non-empty `names` and step.titles for es/fr/de/it; verify icons (sunny-outline, home-outline, moon-outline) and colors are pastel."
        - working: true
          agent: "testing"
          comment: "GET /api/routines returns the 3 expected defaults (Πρωινό / Δραστηριότητες στο Σπίτι μετά το σχολείο / Ύπνος). Each has non-empty names dict with es/fr/de/it keys matching expected translations (Mañana/Matin/Morgen/Mattina; Después del cole/Après l'école/Nach der Schule/Dopo la scuola; Hora de dormir/Coucher/Schlafenszeit/Ora di dormire). Icons verified: sunny-outline, home-outline, moon-outline. Colors verified as hex (#E8C999, #8BA888, #6B7A8F). At least one step per routine has titles dict with all four new-language keys populated. Backend log confirms 'Seeded default routines (v3)'. Seed endpoint idempotent. Additional routines present (5 total) are fine – the 3 defaults are all there. Full CRUD on /api/routines (POST/GET/PUT/DELETE + 404 after delete) also verified."

frontend:
  - task: "Welcome screen with 6-language horizontal chip picker"
    implemented: true
    working: true
    file: "/app/frontend/app/welcome.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Implemented using LinearGradient pastel background, central glowing heart mascot, horizontal scroll language chips (no wrap, numberOfLines=1, marginHorizontal:-32 to bleed full width), gradient CTA. Verified visually in screenshots: Greek chip first (active), all 6 chips render without text wrapping. Language change updates routines list (e.g., Mañana / Después del cole / Hora de dormir in Spanish)."

  - task: "Calming Splash screen inspired by reference image"
    implemented: true
    working: true
    file: "/app/frontend/src/SplashView.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Pastel lavender→peach LinearGradient, central glowing heart mascot inside concentric soft rings (subtle pulsing animation), arc of routine icons (sun, school, music, book, moon), 3-dot loader. Sensory-friendly: slow ease in/out, no harsh motion."

  - task: "i18n loc() helper for routine/step/option localization"
    implemented: true
    working: true
    file: "/app/frontend/src/i18n.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Added loc(item, 'name'|'title'|'label', lang) with fallback chain: direct field → nested dict → en → el. Added stepsLabel for pluralization in 6 langs. Verified visually: Spanish home shows 'Mañana / Después del cole / Hora de dormir', subtitle 'Elige una rutina'."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Welcome + Splash screens are visually verified working. Backend changes need testing: (1) PUT /api/settings with language='es'|'fr'|'de'|'it' should succeed and persist; (2) GET /api/routines should return 3 default routines (Morning/Afternoon/Bedtime) where each has names dict with es/fr/de/it keys and step titles dict; (3) POST /api/tts should accept lang in {el,en,es,fr,de,it} (just check no 422); (4) verify SEED_VERSION=3 produced fresh defaults. Use existing PIN=1234 for any verify-pin tests."
    - agent: "testing"
      message: "Backend testing complete – 52/52 checks passed against the public EXPO_PUBLIC_BACKEND_URL. Both focus tasks verified working: (a) LangCode literal accepts el/en/es/fr/de/it on PUT /api/settings (200) and rejects 'xx' with 422; POST /api/tts with es/fr/de/it returns 200 + data URI (real OpenAI TTS, not mocked). (b) Multi-language seed produced all 3 defaults with full names/titles dicts for es/fr/de/it, correct icons (sunny-outline/home-outline/moon-outline) and pastel hex colors. Regression CRUD on /api/routines and verify-pin also passed. test_result.md updated accordingly."
    - agent: "main"
      message: "UX polish (user-reported on real device): (1) Admin tiles 'Ρυθμίσεις' was wrapping mid-word — fixed by reducing font to 12, paddingHorizontal:6, numberOfLines={1}, adjustsFontSizeToFit minimumFontScale=0.7. (2) Voice recorder in step editor showed both 'Φωνή γονέα (EL)' and 'Φωνή γονέα (EN)' — replaced with single recorder bound to active language (label='Φωνή γονέα' without suffix; voice_el or voice_en updated based on current lang). Verified visually in /admin and step editor modal screenshots. Admin index also now uses loc()/stepsLabel for full multi-language routine names + step counts."
