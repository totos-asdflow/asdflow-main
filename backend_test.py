"""
Backend tests for Routine App multi-language expansion.
Tests against the public EXPO_PUBLIC_BACKEND_URL + /api.
"""
import os
import sys
import json
import requests
from pathlib import Path

# Load backend URL from frontend .env
def load_backend_url() -> str:
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found")


BASE = load_backend_url().rstrip("/") + "/api"
print(f"Testing against: {BASE}")

results = []  # (name, passed, detail)


def record(name: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name} {('- ' + detail) if detail else ''}")
    results.append((name, passed, detail))


def test_root():
    r = requests.get(f"{BASE}/", timeout=15)
    ok = r.status_code == 200 and r.json().get("status") == "ok"
    record("GET /api/ root", ok, f"status={r.status_code} body={r.text[:120]}")


def test_seed_idempotent():
    r1 = requests.post(f"{BASE}/seed", timeout=15)
    r2 = requests.post(f"{BASE}/seed", timeout=15)
    ok = r1.status_code == 200 and r2.status_code == 200
    record("POST /api/seed idempotent", ok, f"r1={r1.status_code} r2={r2.status_code}")


def test_get_routines_multilang():
    r = requests.get(f"{BASE}/routines", timeout=15)
    if r.status_code != 200:
        record("GET /api/routines status 200", False, f"status={r.status_code}")
        return None
    routines = r.json()
    record("GET /api/routines status 200", True, f"count={len(routines)}")

    # Find the three expected defaults by name_el
    expected = {
        "Πρωινό": {"icon": "sunny-outline", "es": "Mañana", "fr": "Matin", "de": "Morgen", "it": "Mattina"},
        "Δραστηριότητες στο Σπίτι μετά το σχολείο": {
            "icon": "home-outline", "es": "Después del cole", "fr": "Après l'école",
            "de": "Nach der Schule", "it": "Dopo la scuola",
        },
        "Ύπνος": {"icon": "moon-outline", "es": "Hora de dormir", "fr": "Coucher",
                  "de": "Schlafenszeit", "it": "Ora di dormire"},
    }

    by_name = {r.get("name_el"): r for r in routines}

    for name_el, exp in expected.items():
        r_obj = by_name.get(name_el)
        if not r_obj:
            record(f"Default routine exists: {name_el}", False, "not found")
            continue
        record(f"Default routine exists: {name_el}", True)

        # names dict
        names = r_obj.get("names") or {}
        missing = [k for k in ("es", "fr", "de", "it") if not names.get(k)]
        record(
            f"{name_el} has names.es/fr/de/it",
            not missing,
            f"names={names} missing={missing}",
        )
        for lang in ("es", "fr", "de", "it"):
            if names.get(lang) != exp[lang]:
                record(
                    f"{name_el} names.{lang} == '{exp[lang]}'",
                    False,
                    f"got='{names.get(lang)}'",
                )
            else:
                record(f"{name_el} names.{lang} == '{exp[lang]}'", True)

        # icon
        record(
            f"{name_el} icon == {exp['icon']}",
            r_obj.get("icon") == exp["icon"],
            f"got={r_obj.get('icon')}",
        )
        # color hex
        color = r_obj.get("color", "")
        record(
            f"{name_el} color is hex",
            isinstance(color, str) and color.startswith("#") and len(color) in (4, 7),
            f"got={color}",
        )
        # steps exist
        steps = r_obj.get("steps") or []
        record(f"{name_el} has >=1 step", len(steps) >= 1, f"count={len(steps)}")
        # at least one step with titles dict containing es/fr/de/it
        ok_step = False
        for s in steps:
            t = s.get("titles") or {}
            if all(t.get(k) for k in ("es", "fr", "de", "it")):
                ok_step = True
                break
        record(
            f"{name_el} step.titles has es/fr/de/it",
            ok_step,
            f"sample_titles={steps[0].get('titles') if steps else None}",
        )

    return routines


def test_put_settings_languages():
    for lang in ("es", "fr", "de", "it", "en", "el"):
        r = requests.put(f"{BASE}/settings", json={"language": lang}, timeout=15)
        ok = r.status_code == 200 and r.json().get("language") == lang
        record(
            f"PUT /api/settings language={lang}",
            ok,
            f"status={r.status_code} body_lang={r.json().get('language') if r.status_code==200 else r.text[:80]}",
        )


def test_put_settings_invalid_language():
    r = requests.put(f"{BASE}/settings", json={"language": "xx"}, timeout=15)
    ok = r.status_code == 422
    record("PUT /api/settings language=xx -> 422", ok, f"status={r.status_code}")


def test_tts_spanish():
    r = requests.post(f"{BASE}/tts", json={"text": "Hola", "lang": "es"}, timeout=30)
    # must NOT be 422. 200 or 5xx acceptable.
    ok = r.status_code != 422
    record(
        "POST /api/tts lang=es not 422",
        ok,
        f"status={r.status_code} body={r.text[:120]}",
    )
    if r.status_code == 200:
        body = r.json()
        has_audio = isinstance(body.get("audio"), str) and body["audio"].startswith("data:audio/")
        record("POST /api/tts returns audio data URI", has_audio, f"cached={body.get('cached')}")


def test_tts_other_langs_not_422():
    for lang in ("fr", "de", "it"):
        r = requests.post(f"{BASE}/tts", json={"text": "Bonjour", "lang": lang}, timeout=30)
        record(
            f"POST /api/tts lang={lang} not 422",
            r.status_code != 422,
            f"status={r.status_code}",
        )


def test_verify_pin():
    r_ok = requests.post(f"{BASE}/settings/verify-pin", json={"pin": "1234"}, timeout=15)
    ok1 = r_ok.status_code == 200 and r_ok.json().get("valid") is True
    record("verify-pin 1234 -> valid true", ok1, f"status={r_ok.status_code} body={r_ok.text[:80]}")

    r_bad = requests.post(f"{BASE}/settings/verify-pin", json={"pin": "0000"}, timeout=15)
    ok2 = r_bad.status_code == 200 and r_bad.json().get("valid") is False
    record("verify-pin 0000 -> valid false", ok2, f"status={r_bad.status_code} body={r_bad.text[:80]}")


def test_routines_crud():
    # Create
    body = {
        "name_el": "Απογευματινή χαλάρωση",
        "name_en": "Afternoon chill",
        "icon": "star-outline",
        "color": "#AABBCC",
        "steps": [
            {
                "type": "task",
                "title_el": "Κάνε μια ανάσα",
                "title_en": "Take a breath",
                "titles": {"es": "Respira", "fr": "Respire", "de": "Atme", "it": "Respira"},
            }
        ],
    }
    r = requests.post(f"{BASE}/routines", json=body, timeout=15)
    created_ok = r.status_code == 200 and "id" in r.json()
    record("POST /api/routines create", created_ok, f"status={r.status_code}")
    if not created_ok:
        return
    rid = r.json()["id"]

    # Get
    r = requests.get(f"{BASE}/routines/{rid}", timeout=15)
    record("GET /api/routines/{id}", r.status_code == 200 and r.json().get("id") == rid, f"status={r.status_code}")

    # Update
    r = requests.put(f"{BASE}/routines/{rid}", json={"name_en": "Afternoon relax"}, timeout=15)
    record(
        "PUT /api/routines/{id}",
        r.status_code == 200 and r.json().get("name_en") == "Afternoon relax",
        f"status={r.status_code}",
    )

    # Delete
    r = requests.delete(f"{BASE}/routines/{rid}", timeout=15)
    record("DELETE /api/routines/{id}", r.status_code == 200 and r.json().get("ok") is True, f"status={r.status_code}")

    # 404 after delete
    r = requests.get(f"{BASE}/routines/{rid}", timeout=15)
    record("GET deleted routine -> 404", r.status_code == 404, f"status={r.status_code}")


def summary():
    print("\n" + "=" * 72)
    passed = sum(1 for _, p, _ in results if p)
    total = len(results)
    print(f"SUMMARY: {passed}/{total} passed")
    fails = [(n, d) for n, p, d in results if not p]
    if fails:
        print("\nFAILURES:")
        for n, d in fails:
            print(f"  - {n}: {d}")
    return passed == total


if __name__ == "__main__":
    try:
        test_root()
        test_seed_idempotent()
        test_get_routines_multilang()
        test_put_settings_languages()
        test_put_settings_invalid_language()
        test_tts_spanish()
        test_tts_other_langs_not_422()
        test_verify_pin()
        test_routines_crud()
    except Exception as e:
        print(f"FATAL: {e}")
        import traceback; traceback.print_exc()
    ok = summary()
    sys.exit(0 if ok else 1)
