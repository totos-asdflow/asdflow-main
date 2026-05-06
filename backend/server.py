from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hashlib
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ===== Models =====
class Step(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["task", "choice"] = "task"
    title_el: str
    title_en: str
    titles: dict = Field(default_factory=dict)  # {lang: text} for additional langs
    image: Optional[str] = None
    voice_el: Optional[str] = None
    voice_en: Optional[str] = None
    options: Optional[List[dict]] = None


class Routine(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name_el: str
    name_en: str
    names: dict = Field(default_factory=dict)
    icon: str = "sun"
    color: str = "#8BA888"
    steps: List[Step] = []
    user_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RoutineCreate(BaseModel):
    name_el: str
    name_en: str
    icon: str = "sun"
    color: str = "#8BA888"
    steps: List[Step] = []


class RoutineUpdate(BaseModel):
    name_el: Optional[str] = None
    name_en: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    steps: Optional[List[Step]] = None


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(BaseModel):
    name: str


class Asset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    data: str  # base64 data URI
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AssetCreate(BaseModel):
    name: str
    data: str


class SOSEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    routine_id: Optional[str] = None
    routine_name: Optional[str] = None
    step_title: Optional[str] = None
    step_index: Optional[int] = None
    resolved: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SOSCreate(BaseModel):
    routine_id: Optional[str] = None
    routine_name: Optional[str] = None
    step_title: Optional[str] = None
    step_index: Optional[int] = None


LangCode = Literal["el", "en", "es", "fr", "de", "it"]


class Settings(BaseModel):
    pin: str = "1234"
    language: LangCode = "el"
    voice_enabled: bool = True
    sos_enabled: bool = True
    sos_sound: Literal["default", "gentle", "silent"] = "default"


class SettingsUpdate(BaseModel):
    pin: Optional[str] = None
    language: Optional[LangCode] = None
    voice_enabled: Optional[bool] = None
    sos_enabled: Optional[bool] = None
    sos_sound: Optional[Literal["default", "gentle", "silent"]] = None


class PairingCode(BaseModel):
    code: str
    expires_at: datetime


class PairingClaim(BaseModel):
    code: str
    push_token: str
    label: Optional[str] = None


class ParentDevice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    push_token: str
    label: str = "Κινητό γονέα"
    paired_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===== Helpers =====
def _clean(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc.pop("_id")
    return doc


# ===== Routines =====
@api_router.get("/routines", response_model=List[Routine])
async def list_routines(user_id: Optional[str] = None):
    query = {"user_id": user_id} if user_id else {}
    docs = await db.routines.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
    return [Routine(**d) for d in docs]


@api_router.get("/routines/{routine_id}", response_model=Routine)
async def get_routine(routine_id: str, user_id: Optional[str] = None):
    query = {"id": routine_id}
    if user_id:
        query["user_id"] = user_id
    doc = await db.routines.find_one(query, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Routine not found")
    return Routine(**doc)


@api_router.post("/routines", response_model=Routine)
async def create_routine(body: RoutineCreate, user_id: Optional[str] = None):
    obj = Routine(**body.dict(), user_id=user_id)
    await db.routines.insert_one(obj.dict())
    return obj


@api_router.put("/routines/{routine_id}", response_model=Routine)
async def update_routine(routine_id: str, body: RoutineUpdate, user_id: Optional[str] = None):
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "No fields to update")
    # Convert Step objects properly
    if "steps" in update_data:
        update_data["steps"] = [s if isinstance(s, dict) else s.dict() for s in update_data["steps"]]
    query = {"id": routine_id}
    if user_id:
        query["user_id"] = user_id
    res = await db.routines.update_one(query, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(404, "Routine not found")
    doc = await db.routines.find_one(query, {"_id": 0})
    return Routine(**doc)


@api_router.delete("/routines/{routine_id}")
async def delete_routine(routine_id: str, user_id: Optional[str] = None):
    query = {"id": routine_id}
    if user_id:
        query["user_id"] = user_id
    res = await db.routines.delete_one(query)
    if res.deleted_count == 0:
        raise HTTPException(404, "Routine not found")
    return {"ok": True}


@api_router.post("/users", response_model=User)
async def create_user(body: UserCreate):
    user = User(**body.dict())
    await db.users.insert_one(user.dict())
    count = await db.routines.count_documents({"user_id": user.id})
    if count == 0:
        for r in DEFAULT_ROUTINES:
            obj = Routine(**r, user_id=user.id)
            await db.routines.insert_one(obj.dict())
    return user


# ===== Assets =====
@api_router.get("/assets", response_model=List[Asset])
async def list_assets():
    docs = await db.assets.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Asset(**d) for d in docs]


@api_router.get("/assets/{asset_id}", response_model=Asset)
async def get_asset(asset_id: str):
    doc = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Asset not found")
    return Asset(**doc)


@api_router.post("/assets", response_model=Asset)
async def create_asset(body: AssetCreate):
    obj = Asset(**body.dict())
    await db.assets.insert_one(obj.dict())
    return obj


@api_router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str):
    res = await db.assets.delete_one({"id": asset_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Asset not found")
    return {"ok": True}


# ===== SOS =====
@api_router.post("/sos", response_model=SOSEvent)
async def create_sos(body: SOSCreate):
    obj = SOSEvent(**body.dict())
    await db.sos_events.insert_one(obj.dict())
    # Send push to all paired parent devices if enabled
    settings_doc = await db.settings.find_one({"id": "singleton"}, {"_id": 0}) or {}
    if settings_doc.get("sos_enabled", True):
        devices = await db.parent_devices.find({}, {"_id": 0, "push_token": 1}).to_list(50)
        tokens = [d["push_token"] for d in devices if d.get("push_token")]
        lang = settings_doc.get("language", "el")
        if lang == "el":
            title = "🆘 Το παιδί ζητά βοήθεια"
            text = f"{obj.routine_name or 'Ρουτίνα'}: {obj.step_title or ''}"
        else:
            title = "🆘 Child needs help"
            text = f"{obj.routine_name or 'Routine'}: {obj.step_title or ''}"
        await _send_push(tokens, title, text, settings_doc.get("sos_sound", "default"))
    return obj


@api_router.get("/sos/active", response_model=Optional[SOSEvent])
async def get_active_sos():
    doc = await db.sos_events.find_one({"resolved": False}, {"_id": 0}, sort=[("created_at", -1)])
    if not doc:
        return None
    return SOSEvent(**doc)


@api_router.post("/sos/{sos_id}/resolve")
async def resolve_sos(sos_id: str):
    res = await db.sos_events.update_one({"id": sos_id}, {"$set": {"resolved": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "SOS not found")
    return {"ok": True}


@api_router.get("/sos", response_model=List[SOSEvent])
async def list_sos():
    docs = await db.sos_events.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [SOSEvent(**d) for d in docs]


# ===== Settings =====
@api_router.get("/settings", response_model=Settings)
async def get_settings():
    doc = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    if not doc:
        default = Settings().dict()
        default["id"] = "singleton"
        await db.settings.insert_one(default)
        default.pop("id", None)
        return Settings(**default)
    doc.pop("id", None)
    return Settings(**doc)


@api_router.put("/settings", response_model=Settings)
async def update_settings(body: SettingsUpdate):
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    if update_data:
        await db.settings.update_one(
            {"id": "singleton"}, {"$set": update_data}, upsert=True
        )
    doc = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    doc.pop("id", None)
    return Settings(**doc)


@api_router.post("/settings/verify-pin")
async def verify_pin(body: dict):
    pin = body.get("pin", "")
    doc = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    stored = doc.get("pin", "1234") if doc else "1234"
    return {"valid": pin == stored}


# ===== Seed =====
SEED_VERSION = 3

def _build_step(t: dict, image: str = None, options: list = None, kind: str = "task") -> dict:
    """t = {el, en, es, fr, de, it}"""
    return {
        "type": kind,
        "title_el": t["el"],
        "title_en": t["en"],
        "titles": {k: v for k, v in t.items() if k not in ("el", "en")},
        **({"image": image} if image else {}),
        **({"options": options} if options else {}),
    }

def _build_opt(opt_id: str, t: dict, image: str = None) -> dict:
    return {
        "id": opt_id,
        "label_el": t["el"],
        "label_en": t["en"],
        "labels": {k: v for k, v in t.items() if k not in ("el", "en")},
        **({"image": image} if image else {}),
    }

DEFAULT_ROUTINES = [
    {
        "name_el": "Πρωινό",
        "name_en": "Morning",
        "names": {"es": "Mañana", "fr": "Matin", "de": "Morgen", "it": "Mattina"},
        "icon": "sunny-outline",
        "color": "#E8C999",
        "steps": [
            _build_step({"el": "Άναψε το φως", "en": "Turn on the light", "es": "Enciende la luz", "fr": "Allume la lumière", "de": "Mach das Licht an", "it": "Accendi la luce"},
                "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800"),
            _build_step({"el": "Πήγαινε τουαλέτα", "en": "Go to the bathroom", "es": "Ve al baño", "fr": "Va aux toilettes", "de": "Geh zur Toilette", "it": "Vai in bagno"},
                "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800"),
            _build_step({"el": "Πλύσου", "en": "Wash your face", "es": "Lávate la cara", "fr": "Lave-toi le visage", "de": "Wasche dein Gesicht", "it": "Lavati la faccia"},
                "https://images.pexels.com/photos/5240458/pexels-photo-5240458.jpeg?w=800"),
            _build_step({"el": "Ντύσου", "en": "Get dressed", "es": "Vístete", "fr": "Habille-toi", "de": "Zieh dich an", "it": "Vestiti"},
                "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800"),
            _build_step({"el": "Φάε πρωινό", "en": "Eat breakfast", "es": "Desayuna", "fr": "Mange le petit-déjeuner", "de": "Frühstücke", "it": "Fai colazione"},
                "https://images.unsplash.com/photo-1635166197966-73207e005887?w=800"),
            _build_step({"el": "Ετοίμασε την τσάντα", "en": "Pack your bag", "es": "Prepara la mochila", "fr": "Prépare ton sac", "de": "Pack deinen Rucksack", "it": "Prepara lo zaino"},
                "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800"),
        ],
    },
    {
        "name_el": "Δραστηριότητες στο Σπίτι μετά το σχολείο",
        "name_en": "After-school activities",
        "names": {"es": "Después del cole", "fr": "Après l'école", "de": "Nach der Schule", "it": "Dopo la scuola"},
        "icon": "home-outline",
        "color": "#8BA888",
        "steps": [
            _build_step({"el": "Βγάλε τα παπούτσια", "en": "Take off your shoes", "es": "Quítate los zapatos", "fr": "Enlève tes chaussures", "de": "Zieh die Schuhe aus", "it": "Togli le scarpe"},
                "https://images.pexels.com/photos/6127572/pexels-photo-6127572.jpeg?w=800"),
            _build_step({"el": "Τακτοποίησε την τσάντα", "en": "Put away your bag", "es": "Guarda la mochila", "fr": "Range ton sac", "de": "Räume deinen Rucksack auf", "it": "Metti via lo zaino"},
                "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800"),
            _build_step({"el": "Πλύνε τα χέρια", "en": "Wash your hands", "es": "Lávate las manos", "fr": "Lave-toi les mains", "de": "Wasche deine Hände", "it": "Lavati le mani"},
                "https://images.unsplash.com/photo-1588702547923-7093a6c3ba33?w=800"),
            _build_step({"el": "Φάε ένα σνακ", "en": "Have a snack", "es": "Come una merienda", "fr": "Prends un goûter", "de": "Iss einen Snack", "it": "Fai uno spuntino"},
                "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=800"),
            _build_step({"el": "Διάλεξε πώς θα ηρεμήσεις", "en": "Choose how to calm down", "es": "Elige cómo calmarte", "fr": "Choisis comment te calmer", "de": "Wähle, wie du dich beruhigst", "it": "Scegli come calmarti"},
                kind="choice", options=[
                    _build_opt("book", {"el": "Βιβλίο", "en": "Book", "es": "Libro", "fr": "Livre", "de": "Buch", "it": "Libro"},
                        "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600"),
                    _build_opt("music", {"el": "Μουσική", "en": "Music", "es": "Música", "fr": "Musique", "de": "Musik", "it": "Musica"},
                        "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600"),
                    _build_opt("drawing", {"el": "Ζωγραφική", "en": "Drawing", "es": "Dibujo", "fr": "Dessin", "de": "Malen", "it": "Disegno"},
                        "https://images.unsplash.com/photo-1499892477393-f675706cbe6e?w=600"),
                ]),
            _build_step({"el": "Διάβασμα", "en": "Study time", "es": "Hora de estudiar", "fr": "Devoirs", "de": "Lernzeit", "it": "Ora di studiare"},
                "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800"),
        ],
    },
    {
        "name_el": "Ύπνος",
        "name_en": "Bedtime",
        "names": {"es": "Hora de dormir", "fr": "Coucher", "de": "Schlafenszeit", "it": "Ora di dormire"},
        "icon": "moon-outline",
        "color": "#6B7A8F",
        "steps": [
            _build_step({"el": "Τακτοποίησε τα παιχνίδια", "en": "Tidy up toys", "es": "Recoge los juguetes", "fr": "Range les jouets", "de": "Räume die Spielsachen weg", "it": "Riordina i giochi"},
                "https://images.unsplash.com/photo-1558877385-8c1c4da82d3e?w=800"),
            _build_step({"el": "Φόρεσε πιτζάμες", "en": "Put on pajamas", "es": "Ponte el pijama", "fr": "Mets ton pyjama", "de": "Zieh den Schlafanzug an", "it": "Metti il pigiama"},
                "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800"),
            _build_step({"el": "Βούρτσισε τα δόντια", "en": "Brush your teeth", "es": "Cepíllate los dientes", "fr": "Brosse-toi les dents", "de": "Putz dir die Zähne", "it": "Lavati i denti"},
                "https://images.pexels.com/photos/5240458/pexels-photo-5240458.jpeg?w=800"),
            _build_step({"el": "Διάλεξε ένα παραμύθι", "en": "Pick a bedtime story", "es": "Elige un cuento", "fr": "Choisis une histoire", "de": "Wähle eine Geschichte", "it": "Scegli una favola"},
                kind="choice", options=[
                    _build_opt("story1", {"el": "Αστέρια", "en": "Stars", "es": "Estrellas", "fr": "Étoiles", "de": "Sterne", "it": "Stelle"},
                        "https://images.unsplash.com/photo-1532798442725-41036acc7489?w=600"),
                    _build_opt("story2", {"el": "Ζωάκια", "en": "Animals", "es": "Animales", "fr": "Animaux", "de": "Tiere", "it": "Animali"},
                        "https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=600"),
                    _build_opt("story3", {"el": "Θάλασσα", "en": "Sea", "es": "Mar", "fr": "Mer", "de": "Meer", "it": "Mare"},
                        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600"),
                ]),
            _build_step({"el": "Ώρα για ύπνο", "en": "Time to sleep", "es": "Hora de dormir", "fr": "C'est l'heure de dormir", "de": "Zeit zu schlafen", "it": "Ora di dormire"},
                "https://images.unsplash.com/photo-1520206183501-b80df61043c2?w=800"),
        ],
    },
]


@api_router.post("/seed")
async def seed(user_id: Optional[str] = None):
    query = {"user_id": user_id} if user_id else {}
    count = await db.routines.count_documents(query)
    if count == 0:
        for r in DEFAULT_ROUTINES:
            obj = Routine(**r, **({"user_id": user_id} if user_id else {}))
            await db.routines.insert_one(obj.dict())
    # Ensure settings exist
    if not await db.settings.find_one({"id": "singleton"}):
        default = Settings().dict()
        default["id"] = "singleton"
        await db.settings.insert_one(default)
    return {"ok": True, "seeded": count == 0}


@api_router.get("/")
async def root():
    return {"message": "Routine App API", "status": "ok"}


# ===== Pairing & Push =====
import secrets
import httpx


def _gen_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"


@api_router.post("/pairing/generate", response_model=PairingCode)
async def pairing_generate():
    code = _gen_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.pairing_codes.delete_many({"used": True})
    await db.pairing_codes.insert_one({
        "code": code,
        "expires_at": expires,
        "used": False,
        "created_at": datetime.now(timezone.utc),
    })
    return PairingCode(code=code, expires_at=expires)


@api_router.post("/pairing/claim", response_model=ParentDevice)
async def pairing_claim(body: PairingClaim):
    rec = await db.pairing_codes.find_one({"code": body.code, "used": False})
    if not rec:
        raise HTTPException(404, "Invalid code")
    if rec["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(410, "Code expired")
    await db.pairing_codes.update_one({"code": body.code}, {"$set": {"used": True}})
    # Replace any device with same token
    await db.parent_devices.delete_many({"push_token": body.push_token})
    dev = ParentDevice(push_token=body.push_token, label=body.label or "Κινητό γονέα")
    await db.parent_devices.insert_one(dev.dict())
    return dev


@api_router.get("/pairing/devices", response_model=List[ParentDevice])
async def pairing_devices():
    docs = await db.parent_devices.find({}, {"_id": 0}).sort("paired_at", -1).to_list(50)
    return [ParentDevice(**d) for d in docs]


@api_router.delete("/pairing/devices/{device_id}")
async def pairing_delete(device_id: str):
    res = await db.parent_devices.delete_one({"id": device_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Device not found")
    return {"ok": True}


async def _send_push(tokens: List[str], title: str, body: str, sound: str):
    if not tokens:
        return
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            payload = [
                {
                    "to": tk,
                    "title": title,
                    "body": body,
                    "sound": "default" if sound == "default" else None,
                    "priority": "high",
                    "channelId": "sos",
                }
                for tk in tokens
            ]
            await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
    except Exception as e:
        logger.error(f"Push error: {e}")


# ===== TTS =====
class TTSRequest(BaseModel):
    text: str
    lang: LangCode = "el"


GOOGLE_TTS_VOICES: dict[str, tuple[str, str]] = {
    "el": ("el-GR", "el-GR-Standard-A"),
    "en": ("en-US", "en-US-Wavenet-D"),
    "es": ("es-ES", "es-ES-Wavenet-B"),
    "fr": ("fr-FR", "fr-FR-Wavenet-B"),
    "de": ("de-DE", "de-DE-Wavenet-B"),
    "it": ("it-IT", "it-IT-Wavenet-B"),
}


def _tts_cache_key(text: str, lang: str) -> str:
    return hashlib.sha256(f"{lang}::{text}::nova::0.9::tts-1-hd".encode("utf-8")).hexdigest()


@api_router.post("/tts")
async def tts(body: TTSRequest):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Empty text")
    key = _tts_cache_key(text, body.lang)

    # Check cache
    cached = await db.audio_cache.find_one({"key": key}, {"_id": 0, "data": 1})
    if cached:
        return {"audio": cached["data"], "cached": True}

    try:
        b64: Optional[str] = None
        google_api_key = os.getenv("GOOGLE_API_KEY")
        if google_api_key:
            try:
                import httpx

                language_code, voice_name = GOOGLE_TTS_VOICES.get(
                    body.lang, ("en-US", "en-US-Wavenet-D")
                )
                payload = {
                    "input": {"text": text},
                    "voice": {"languageCode": language_code, "name": voice_name},
                    "audioConfig": {"audioEncoding": "MP3", "speakingRate": 0.95},
                }
                async with httpx.AsyncClient(timeout=20) as client:
                    response = await client.post(
                        f"https://texttospeech.googleapis.com/v1/text:synthesize?key={google_api_key}",
                        json=payload,
                    )
                if response.status_code == 200:
                    data = response.json()
                    b64 = data.get("audioContent")
                else:
                    logger.warning(
                        "Google TTS failed %s: %s",
                        response.status_code,
                        response.text,
                    )
            except Exception as e:
                logger.warning("Google TTS request error: %s", e)

        if not b64:
            api_key = os.getenv("EMERGENT_LLM_KEY") or os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise HTTPException(
                    500,
                    "Google TTS failed and no EMERGENT_LLM_KEY or OPENAI_API_KEY is configured.",
                )

            try:
                from emergentintegrations.llm.openai import OpenAITextToSpeech  # type: ignore
                tts_client = OpenAITextToSpeech(api_key=api_key)
                b64 = await tts_client.generate_speech_base64(
                    text=text, model="tts-1-hd", voice="nova", speed=0.9,
                )
            except ImportError:
                import base64
                from openai import AsyncOpenAI

                client = AsyncOpenAI(api_key=api_key)
                speech = await client.audio.speech.create(
                    model="tts-1-hd", voice="nova", input=text, speed=0.9,
                )
                audio_bytes = speech.read() if hasattr(speech, "read") else speech.content
                b64 = base64.b64encode(audio_bytes).decode("utf-8")

        if not b64:
            raise HTTPException(500, "TTS produced no audio")

        data_uri = f"data:audio/mp3;base64,{b64}"
        await db.audio_cache.insert_one({
            "key": key,
            "text": text,
            "lang": body.lang,
            "data": data_uri,
            "created_at": datetime.now(timezone.utc),
        })
        return {"audio": data_uri, "cached": False}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(500, f"TTS failed: {str(e)}")


@api_router.get("/download-project")
async def download_project():
    zip_path = "/app/project.zip"
    if not os.path.exists(zip_path):
        raise HTTPException(404, "Project zip not found")
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="routine-app-project.zip",
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_seed():
    try:
        meta = await db.meta.find_one({"id": "seed"}, {"_id": 0}) or {}
        current_version = meta.get("version", 0)
        if current_version < SEED_VERSION:
            # Wipe defaults & re-seed (keep user assets/sos/settings/devices)
            default_names = [r["name_el"] for r in DEFAULT_ROUTINES] + [r["name_en"] for r in DEFAULT_ROUTINES]
            await db.routines.delete_many({"$or": [
                {"name_el": {"$in": default_names}},
                {"name_en": {"$in": default_names}},
            ]})
            for r in DEFAULT_ROUTINES:
                obj = Routine(**r)
                await db.routines.insert_one(obj.dict())
            await db.meta.update_one({"id": "seed"}, {"$set": {"version": SEED_VERSION}}, upsert=True)
            logger.info(f"Seeded default routines (v{SEED_VERSION})")
        if not await db.settings.find_one({"id": "singleton"}):
            default = Settings().dict()
            default["id"] = "singleton"
            await db.settings.insert_one(default)
    except Exception as e:
        logger.error(f"Seed error: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
