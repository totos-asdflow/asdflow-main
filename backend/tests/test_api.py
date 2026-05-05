import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://task-chunker-kids.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ===== Routines =====
class TestRoutines:
    def test_list_seeded(self, s):
        r = s.get(f"{API}/routines", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3
        names_el = [x["name_el"] for x in data]
        assert "Πρωινό" in names_el
        assert "Ύπνος" in names_el
        assert any("Δραστηριότητες" in n for n in names_el)
        # verify choice step exists inside after-school routine
        afterschool = next(x for x in data if "Δραστηριότητες" in x["name_el"])
        choice_steps = [st for st in afterschool["steps"] if st.get("type") == "choice"]
        assert len(choice_steps) >= 1
        assert choice_steps[0]["options"] and len(choice_steps[0]["options"]) == 3

    def test_create_update_delete(self, s):
        payload = {
            "name_el": "TEST_Ρουτίνα",
            "name_en": "TEST_Routine",
            "icon": "sun",
            "color": "#AAA",
            "steps": [{"type": "task", "title_el": "βήμα", "title_en": "step"}],
        }
        r = s.post(f"{API}/routines", json=payload, timeout=15)
        assert r.status_code == 200
        rid = r.json()["id"]

        # GET to verify persistence
        g = s.get(f"{API}/routines/{rid}", timeout=15)
        assert g.status_code == 200
        assert g.json()["name_en"] == "TEST_Routine"

        # Update
        u = s.put(f"{API}/routines/{rid}", json={"name_en": "TEST_Updated"}, timeout=15)
        assert u.status_code == 200
        assert u.json()["name_en"] == "TEST_Updated"

        g2 = s.get(f"{API}/routines/{rid}", timeout=15)
        assert g2.json()["name_en"] == "TEST_Updated"

        # Delete
        d = s.delete(f"{API}/routines/{rid}", timeout=15)
        assert d.status_code == 200

        g3 = s.get(f"{API}/routines/{rid}", timeout=15)
        assert g3.status_code == 404


# ===== Settings =====
class TestSettings:
    def test_get_defaults(self, s):
        r = s.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["pin"] == "1234"
        assert data["language"] in ("el", "en")

    def test_verify_pin_correct(self, s):
        r = s.post(f"{API}/settings/verify-pin", json={"pin": "1234"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["valid"] is True

    def test_verify_pin_wrong(self, s):
        r = s.post(f"{API}/settings/verify-pin", json={"pin": "9999"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_update_language_and_pin(self, s):
        # change language
        r = s.put(f"{API}/settings", json={"language": "en"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["language"] == "en"
        g = s.get(f"{API}/settings", timeout=15)
        assert g.json()["language"] == "en"
        # revert
        s.put(f"{API}/settings", json={"language": "el"}, timeout=15)

        # change pin and verify, then revert
        r2 = s.put(f"{API}/settings", json={"pin": "5678"}, timeout=15)
        assert r2.status_code == 200
        v = s.post(f"{API}/settings/verify-pin", json={"pin": "5678"}, timeout=15)
        assert v.json()["valid"] is True
        s.put(f"{API}/settings", json={"pin": "1234"}, timeout=15)


# ===== SOS =====
class TestSOS:
    def test_sos_lifecycle(self, s):
        payload = {"routine_name": "TEST_Routine", "step_title": "TEST_step", "step_index": 0}
        r = s.post(f"{API}/sos", json=payload, timeout=15)
        assert r.status_code == 200
        sid = r.json()["id"]
        assert r.json()["resolved"] is False

        a = s.get(f"{API}/sos/active", timeout=15)
        assert a.status_code == 200
        assert a.json() is not None
        assert a.json()["resolved"] is False

        res = s.post(f"{API}/sos/{sid}/resolve", timeout=15)
        assert res.status_code == 200

        # After resolve, active may be None or a different active (but not this one)
        a2 = s.get(f"{API}/sos/active", timeout=15)
        body = a2.json()
        if body is not None:
            assert body["id"] != sid


# ===== Assets =====
class TestAssets:
    def test_asset_crud(self, s):
        tiny_png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="
        r = s.post(f"{API}/assets", json={"name": "TEST_asset", "data": tiny_png}, timeout=15)
        assert r.status_code == 200
        aid = r.json()["id"]
        assert r.json()["name"] == "TEST_asset"

        lst = s.get(f"{API}/assets", timeout=15)
        assert lst.status_code == 200
        assert any(a["id"] == aid for a in lst.json())

        d = s.delete(f"{API}/assets/{aid}", timeout=15)
        assert d.status_code == 200

        lst2 = s.get(f"{API}/assets", timeout=15)
        assert not any(a["id"] == aid for a in lst2.json())
