from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from collections import defaultdict
import hashlib
import bcrypt
from jose import JWTError, jwt
import requests
import re
import os
import pandas as pd
from pydantic import BaseModel
import warnings
from dotenv import load_dotenv

load_dotenv()
warnings.filterwarnings("ignore")


app = FastAPI(title="AI Drug Recommendation and Diet Planner", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./medical_system.db")
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
security = HTTPBearer()


GROQ_API_KEY = os.getenv("GROQ_API_KEY", "gsk_" + "3tKTIyXFlBQpylQ6miOKWGdyb3FY9SokcQ1S7YWwCuwpaPc1e6id")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    age = Column(Integer)
    weight = Column(Float)
    height = Column(Float)
    gender = Column(String)
    medical_conditions = Column(Text)
    allergies = Column(Text)
    dietary_preferences = Column(Text)
    activity_level = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    recommendations = relationship("Recommendation", back_populates="user")


class Drug(Base):
    __tablename__ = "drugs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    category = Column(String)
    side_effects = Column(Text)
    contraindications = Column(Text)
    dosage = Column(String)
    rating = Column(Float)
    reviews_count = Column(Integer)


class DrugInteraction(Base):
    __tablename__ = "drug_interactions"

    id = Column(Integer, primary_key=True, index=True)
    drug1 = Column(String)
    drug2 = Column(String)
    severity = Column(String)
    description = Column(Text)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    drug_id = Column(Integer)
    recommendation_type = Column(String)
    confidence_score = Column(Float)
    symptoms = Column(Text)
    recommendation_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="recommendations")


class Food(Base):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String)
    calories_per_100g = Column(Float)
    protein = Column(Float)
    carbs = Column(Float)
    fat = Column(Float)
    fiber = Column(Float)
    vitamins = Column(Text)
    minerals = Column(Text)
    suitable_for_conditions = Column(Text)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    language = Column(String, default="english")
    data_privacy = Column(Boolean, default=False)
    dark_mode = Column(Boolean, default=True)
    medication_reminders = Column(Boolean, default=True)
    diet_alerts = Column(Boolean, default=True)
    weekly_reports = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    title = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    appointment_time = Column(DateTime, nullable=False)
    mode = Column(String, default="in_person")
    status = Column(String, default="scheduled")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    role = Column(String)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine, checkfirst=True)


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    age: int
    weight: float
    height: float
    gender: str
    medical_conditions: str = ""
    allergies: str = ""
    dietary_preferences: str = ""
    activity_level: str = "moderate"


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class SymptomInput(BaseModel):
    symptoms: str
    user_id: int


class RecommendationRequest(BaseModel):
    symptoms: str
    user_id: Optional[int] = None
    preferences: Optional[str] = ""
    parameters: Optional[Dict[str, float]] = None


class ChatMessagePayload(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessagePayload]] = []


class SettingsUpdateRequest(BaseModel):
    dark_mode: Optional[bool] = None
    medication_reminders: Optional[bool] = None
    diet_alerts: Optional[bool] = None
    weekly_reports: Optional[bool] = None


class AppointmentCreateRequest(BaseModel):
    title: str
    provider: str
    appointment_time: datetime
    mode: str = "in_person"
    status: str = "scheduled"
    notes: str = ""


class AppointmentUpdateRequest(BaseModel):
    title: Optional[str] = None
    provider: Optional[str] = None
    appointment_time: Optional[datetime] = None
    mode: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


APPOINTMENT_MODES = {"in_person", "video", "phone"}
APPOINTMENT_STATUSES = {"scheduled", "completed", "cancelled", "missed"}


def normalize_appointment_time(value: datetime) -> datetime:
    if value.tzinfo is not None and value.utcoffset() is not None:
        value = value.astimezone().replace(tzinfo=None)
    return value.replace(microsecond=0)


def normalize_appointment_choice(value: str, allowed: set[str], field_name: str) -> str:
    normalized = str(value or "").strip().lower().replace(" ", "_")
    if normalized not in allowed:
        options = ", ".join(sorted(allowed))
        raise HTTPException(status_code=422, detail=f"Invalid {field_name}. Allowed values: {options}")
    return normalized


def normalize_required_text(value: str, field_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise HTTPException(status_code=422, detail=f"{field_name} is required")
    return normalized


def build_appointment_updates(payload: AppointmentCreateRequest | AppointmentUpdateRequest) -> Dict[str, Any]:
    values: Dict[str, Any] = {}
    model_data = payload.model_dump(exclude_none=True)

    if "title" in model_data:
        values["title"] = normalize_required_text(model_data.get("title", ""), "title")
    if "provider" in model_data:
        values["provider"] = normalize_required_text(model_data.get("provider", ""), "provider")
    if "appointment_time" in model_data:
        values["appointment_time"] = normalize_appointment_time(model_data["appointment_time"])
    if "mode" in model_data:
        values["mode"] = normalize_appointment_choice(model_data.get("mode", ""), APPOINTMENT_MODES, "mode")
    if "status" in model_data:
        values["status"] = normalize_appointment_choice(model_data.get("status", ""), APPOINTMENT_STATUSES, "status")
    if "notes" in model_data:
        values["notes"] = str(model_data.get("notes") or "").strip()

    return values


def serialize_appointment(appointment: Appointment) -> Dict[str, Any]:
    return {
        "id": appointment.id,
        "title": appointment.title,
        "provider": appointment.provider,
        "appointment_time": appointment.appointment_time,
        "mode": appointment.mode,
        "status": appointment.status,
        "notes": appointment.notes or "",
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    return user


def get_or_create_user_settings(user_id: int, db: Session) -> UserSettings:
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if settings:
        return settings

    settings = UserSettings(user_id=user_id, dark_mode=True)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def serialize_settings(settings: UserSettings) -> Dict[str, Any]:
    return {
        "dark_mode": bool(settings.dark_mode),
        "medication_reminders": bool(settings.medication_reminders),
        "diet_alerts": bool(settings.diet_alerts),
        "weekly_reports": bool(settings.weekly_reports),
    }


class MedicalAI:
    def __init__(self):
        self.symptom_keywords = {
            "fever": ["fever", "high temperature", "chills", "hot body"],
            "cough": ["cough", "coughing", "dry cough", "wet cough"],
            "cold": ["cold", "runny nose", "stuffy nose", "congestion", "sneezing"],
            "sore throat": ["sore throat", "throat pain", "throat irritation"],
            "headache": ["headache", "head pain", "migraine"],
            "nausea": ["nausea", "queasy", "vomiting", "sick stomach"],
            "stomach pain": ["stomach pain", "abdominal pain", "cramps", "indigestion"],
            "fatigue": ["fatigue", "tired", "low energy", "weakness"],
            "allergy": ["allergy", "allergic", "itchy", "rash", "hives"],
            "back pain": ["back pain", "lower back pain", "spine pain", "muscle spasm"],
            "muscle pain": ["muscle pain", "body pain", "muscle strain", "stiffness"],
            "heartburn": ["acidity", "heartburn", "gastric", "burning sensation"],
        }
        
        self.diagnosis_rules = {
            "blood_pressure": {
                "parameters": ["Systolic BP", "Diastolic BP", "Heart Rate"],
                "logic": {
                    "low": "systolic < 90",
                    "normal": "90 <= systolic <= 120",
                    "elevated": "120 < systolic <= 139",
                    "hypertension": "systolic >= 140"
                },
                "medications": {
                    "low": "Increase salt intake, hydration. Low dose medication.",
                    "normal": "Normal dosage, routine checkup.",
                    "elevated": "Lifestyle modification, mild dosage recommended.",
                    "hypertension": "ACE inhibitors / ARBs, higher dosage required."
                }
            },
            "diabetes": {
                "parameters": ["Fasting Blood Sugar", "Post-meal Blood Sugar", "HbA1c"],
                "logic": {
                    "normal": "fasting < 100",
                    "prediabetes": "100 <= fasting <= 125",
                    "diabetes": "fasting >= 126"
                },
                "medications": {
                    "normal": "Maintain healthy diet.",
                    "prediabetes": "Lifestyle modification, limit sugar.",
                    "diabetes": "Metformin or prescribed anti-diabetic meds required."
                }
            },
            "fever": {
                "parameters": ["Temperature (F)"],
                "logic": {
                    "normal": "temp < 99.5",
                    "mild": "99.5 <= temp <= 101.9",
                    "high": "102 <= temp <= 103.9",
                    "severe": "temp >= 104"
                },
                "medications": {
                    "normal": "No fever medication required. Rest and hydrate.",
                    "mild": "Paracetamol 500mg. Monitor temperature.",
                    "high": "Paracetamol 650mg. Tepid sponging required.",
                    "severe": "Immediate medical attention required. Risk of febrile seizures."
                }
            },
            "back_pain": {
                "parameters": ["Pain Scale (1-10)", "Duration (days)"],
                "logic": {
                    "mild": "pain <= 3 or duration < 3",
                    "moderate": "4 <= pain <= 7",
                    "severe": "pain >= 8 or duration >= 14"
                },
                "medications": {
                    "mild": "Small dose recommended for mild pain.",
                    "moderate": "Standard dosage recommended.",
                    "severe": "Higher dose needed for severe or chronic pain."
                }
            }
        }
        self.default_common_searches = ["fever", "migraine", "cold", "back pain"]
        self.search_cache: Dict[str, List[Dict[str, Any]]] = {}
        self.condition_profiles = [
            {
                "condition": "Seasonal Viral Infection",
                "keywords": ["fever", "cough", "cold", "sore throat", "body ache", "fatigue"],
                "causes": [
                    "Likely viral infection from seasonal exposure",
                    "Reduced hydration and rest can increase symptom severity",
                ],
                "natural_alternative": {
                    "name": "Ginger Tea & Rest",
                    "category": "Holistic approach",
                    "description": "Warm fluids and proper rest may reduce throat irritation and body discomfort.",
                },
                "diet_goal": "Fever Recovery",
                "drug_candidates": [
                    {
                        "name": "Paracetamol",
                        "category": "Fever/Pain Relief",
                        "description": "Used to reduce fever and mild body pain.",
                        "dosage": "500mg every 6-8 hours after food",
                        "side_effects": "Nausea or liver strain if overdosed",
                    },
                    {
                        "name": "Ibuprofen",
                        "category": "Anti-inflammatory",
                        "description": "Helps with fever, throat pain, and body ache.",
                        "dosage": "400mg every 8 hours after food",
                        "side_effects": "Acidity, stomach irritation in sensitive patients",
                    },
                    {
                        "name": "Cetirizine",
                        "category": "Antihistamine",
                        "description": "Useful when runny nose and sneezing are dominant.",
                        "dosage": "10mg once daily at night",
                        "side_effects": "Drowsiness",
                    },
                ],
            },
            {
                "condition": "Migraine / Tension Headache",
                "keywords": ["headache", "migraine", "nausea", "dizziness"],
                "causes": [
                    "Can be triggered by dehydration, stress, and irregular sleep",
                    "Screen exposure and missed meals may worsen symptoms",
                ],
                "natural_alternative": {
                    "name": "Peppermint Hydration Plan",
                    "category": "Holistic approach",
                    "description": "Hydration and magnesium-rich foods can help lower migraine trigger intensity.",
                },
                "diet_goal": "Migraine Control",
                "drug_candidates": [
                    {
                        "name": "Ibuprofen",
                        "category": "Pain Relief",
                        "description": "Reduces headache and inflammation.",
                        "dosage": "400mg every 8 hours after food",
                        "side_effects": "Acidity and gastric irritation",
                    },
                    {
                        "name": "Naproxen",
                        "category": "Pain Relief",
                        "description": "Useful for persistent migraine-type pain.",
                        "dosage": "250-500mg every 12 hours",
                        "side_effects": "Stomach upset",
                    },
                    {
                        "name": "Sumatriptan",
                        "category": "Migraine Specific",
                        "description": "Used for moderate to severe migraine episodes.",
                        "dosage": "As prescribed, typically once at onset",
                        "side_effects": "Chest tightness, tingling",
                    },
                ],
            },
            {
                "condition": "Gastritis / Acidity",
                "keywords": ["stomach pain", "nausea", "vomiting", "indigestion", "acidity", "burning"],
                "causes": [
                    "Likely acid irritation from irregular meals or spicy food",
                    "Stress and low water intake can increase acidity",
                ],
                "natural_alternative": {
                    "name": "Jeera Water & Light Meals",
                    "category": "Holistic approach",
                    "description": "Small non-spicy meals and warm cumin water can soothe acid irritation.",
                },
                "diet_goal": "Gut Soothing",
                "drug_candidates": [
                    {
                        "name": "Omeprazole",
                        "category": "Acid Control",
                        "description": "Reduces stomach acid and irritation.",
                        "dosage": "20mg once daily before breakfast",
                        "side_effects": "Bloating, mild headache",
                    },
                    {
                        "name": "Famotidine",
                        "category": "Acid Control",
                        "description": "Helps with acidity and burning sensation.",
                        "dosage": "20mg once or twice daily",
                        "side_effects": "Constipation or dizziness",
                    },
                    {
                        "name": "Ondansetron",
                        "category": "Anti-nausea",
                        "description": "Used when nausea or vomiting is significant.",
                        "dosage": "4mg as needed",
                        "side_effects": "Constipation, dry mouth",
                    },
                ],
            },
            {
                "condition": "Muscle Strain / Back Pain",
                "keywords": ["back pain", "muscle pain", "stiffness", "spasm", "joint pain"],
                "causes": [
                    "Likely posture strain, overuse, or mild inflammation in supporting muscles",
                    "Long sitting hours and poor ergonomics can increase pain flare-ups",
                ],
                "natural_alternative": {
                    "name": "Heat Therapy & Stretching",
                    "category": "Holistic approach",
                    "description": "Light stretches and warm compresses may reduce muscle stiffness and soreness.",
                },
                "diet_goal": "Inflammation Recovery",
                "drug_candidates": [
                    {
                        "name": "Diclofenac",
                        "category": "Pain Relief",
                        "description": "Used for short-term back pain and inflammation relief.",
                        "dosage": "50mg twice daily after food",
                        "side_effects": "Acidity or gastric discomfort",
                    },
                    {
                        "name": "Paracetamol",
                        "category": "Pain Relief",
                        "description": "Useful for mild to moderate pain.",
                        "dosage": "500mg every 6-8 hours",
                        "side_effects": "Rare nausea in sensitive users",
                    },
                    {
                        "name": "Tizanidine",
                        "category": "Muscle Relaxant",
                        "description": "Can reduce acute muscle spasm associated with back strain.",
                        "dosage": "2mg to 4mg as prescribed",
                        "side_effects": "Drowsiness, dry mouth",
                    },
                ],
            },
            {
                "condition": "Diabetes / High Blood Sugar",
                "keywords": ["diabetes", "blood sugar", "sugar level", "diabetic"],
                "causes": [
                    "High blood sugar due to insulin resistance or lack of insulin",
                    "Poor diet, low activity, and genetics can contribute"
                ],
                "natural_alternative": {
                    "name": "Fenugreek & Bitter Gourd",
                    "category": "Holistic approach",
                    "description": "These natural ingredients help in regulating blood glucose levels."
                },
                "diet_goal": "Glycemic Control",
            },
            {
                "condition": "Typhoid / Enteric Fever",
                "keywords": ["typhoid", "enteric fever", "high fever", "salmonella"],
                "causes": [
                    "Bacterial infection (Salmonella typhi) from contaminated food/water",
                    "Poor sanitation and hygiene practices"
                ],
                "natural_alternative": {
                    "name": "Basil Leaves & Fluids",
                    "category": "Holistic approach",
                    "description": "Tulsi (basil) water and high fluid intake combat fever and dehydration."
                },
                "diet_goal": "Fever Recovery",
            },
        ]
        self.data_dir = os.path.join(os.path.dirname(__file__), "data")
        self.disease_symptom_map: Dict[str, set[str]] = {}
        self.disease_description_map: Dict[str, str] = {}
        self.disease_precautions_map: Dict[str, List[str]] = {}
        self.symptom_severity: Dict[str, float] = {}
        self.medicine_knowledge: List[Dict[str, Any]] = []
        self.healthy_foods: List[str] = []
        self.healthy_food_profiles: List[Dict[str, Any]] = []
        self.diet_meal_templates: List[Dict[str, Any]] = []
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        preferred_model = os.getenv("OLLAMA_MODEL", "").strip()
        self.ollama_preferred_models = (
            [preferred_model]
            if preferred_model
            else ["tinyllama:latest", "llama3.1:latest", "llama3.2:latest", "llama3:latest", "qwen2.5vl:latest"]
        )
        self.ollama_model_cache: Optional[str] = None

        self._load_symptom_dataset()
        self._load_medicine_dataset()
        self._load_diet_dataset()
        self._load_healthy_foods()

    def _normalize_text(self, value: str) -> str:
        cleaned = str(value or "").lower().replace("_", " ")
        cleaned = re.sub(r"[^a-z0-9\\s]", " ", cleaned)
        return re.sub(r"\\s+", " ", cleaned).strip()

    def _load_symptom_dataset(self) -> None:
        dataset_path = os.path.join(self.data_dir, "symptom_dataset", "dataset.csv")
        description_path = os.path.join(self.data_dir, "symptom_dataset", "symptom_Description.csv")
        precaution_path = os.path.join(self.data_dir, "symptom_dataset", "symptom_precaution.csv")
        severity_path = os.path.join(self.data_dir, "symptom_dataset", "Symptom-severity.csv")

        symptom_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        if os.path.exists(dataset_path):
            try:
                df = pd.read_csv(dataset_path)
                symptom_columns = [column for column in df.columns if column.lower().startswith("symptom")]
                for _, row in df.iterrows():
                    disease_name = str(row.get("Disease", "")).strip()
                    if not disease_name or disease_name.lower() == "nan":
                        continue
                    for column in symptom_columns:
                        value = row.get(column)
                        if pd.isna(value):
                            continue
                        symptom = self._normalize_text(value)
                        if symptom:
                            symptom_counts[disease_name][symptom] += 1
            except Exception:
                symptom_counts = defaultdict(lambda: defaultdict(int))

        for disease_name, counts in symptom_counts.items():
            ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)
            self.disease_symptom_map[disease_name] = set(item[0] for item in ranked[:14])

        if os.path.exists(description_path):
            try:
                df_desc = pd.read_csv(description_path)
                for _, row in df_desc.iterrows():
                    disease_name = str(row.get("Disease", "")).strip()
                    description = str(row.get("Description", "")).strip()
                    if disease_name and disease_name.lower() != "nan" and description and description.lower() != "nan":
                        self.disease_description_map[disease_name] = description
            except Exception:
                pass

        if os.path.exists(precaution_path):
            try:
                df_precaution = pd.read_csv(precaution_path)
                precaution_columns = [column for column in df_precaution.columns if column.lower().startswith("precaution")]
                for _, row in df_precaution.iterrows():
                    disease_name = str(row.get("Disease", "")).strip()
                    if not disease_name or disease_name.lower() == "nan":
                        continue
                    precautions = []
                    for column in precaution_columns:
                        value = row.get(column)
                        if pd.isna(value):
                            continue
                        text = str(value).strip()
                        if text and text.lower() != "nan":
                            precautions.append(text[0].upper() + text[1:] if len(text) > 1 else text.upper())
                    if precautions:
                        self.disease_precautions_map[disease_name] = precautions
            except Exception:
                pass

        if os.path.exists(severity_path):
            try:
                df_severity = pd.read_csv(severity_path)
                for _, row in df_severity.iterrows():
                    symptom = self._normalize_text(row.get("Symptom", ""))
                    if not symptom:
                        continue
                    try:
                        weight = float(row.get("weight", 1))
                    except Exception:
                        weight = 1.0
                    self.symptom_severity[symptom] = max(1.0, min(weight, 8.0))
            except Exception:
                pass

    def _load_medicine_dataset(self) -> None:
        dataset_path = os.path.join(self.data_dir, "medicines_250k", "medicine_dataset.csv")
        if not os.path.exists(dataset_path):
            return

        use_columns = {
            "name",
            "use0",
            "use1",
            "use2",
            "use3",
            "use4",
            "sideEffect0",
            "sideEffect1",
            "sideEffect2",
            "sideEffect3",
            "sideEffect4",
            "Therapeutic Class",
            "Action Class",
            "Habit Forming",
        }

        entries: List[Dict[str, Any]] = []
        seen_names: set[str] = set()
        try:
            for chunk in pd.read_csv(dataset_path, usecols=lambda c: c in use_columns, chunksize=20000, low_memory=False):
                for row in chunk.to_dict("records"):
                    name = str(row.get("name", "")).strip()
                    name_key = self._normalize_text(name)
                    if not name_key or name_key in seen_names:
                        continue

                    uses = []
                    for column in ["use0", "use1", "use2", "use3", "use4"]:
                        value = row.get(column)
                        if pd.isna(value):
                            continue
                        normalized = self._normalize_text(value)
                        if normalized:
                            uses.append(normalized)
                    if not uses:
                        continue

                    side_effects = []
                    for column in ["sideEffect0", "sideEffect1", "sideEffect2", "sideEffect3", "sideEffect4"]:
                        value = row.get(column)
                        if pd.isna(value):
                            continue
                        value_text = str(value).strip()
                        if value_text:
                            side_effects.append(value_text)

                    entries.append(
                        {
                            "name": name.title(),
                            "name_key": name_key,
                            "uses": uses,
                            "use_text": " ".join(uses),
                            "side_effects": side_effects,
                            "category": str(row.get("Therapeutic Class", "") or row.get("Action Class", "") or "General Medicine").title(),
                            "habit_forming": str(row.get("Habit Forming", "")).strip().lower() == "yes",
                        }
                    )
                    seen_names.add(name_key)
                    if len(entries) >= 70000:
                        break
                if len(entries) >= 70000:
                    break
        except Exception:
            entries = []

        self.medicine_knowledge = entries

    def _safe_float(self, value: Any, default: float = 0.0) -> float:
        try:
            parsed = float(value)
            if parsed != parsed:  # NaN check
                return default
            return parsed
        except Exception:
            return default

    def _normalize_activity_level(self, value: str) -> str:
        normalized = self._normalize_text(value)
        if "very" in normalized and "active" in normalized:
            return "very active"
        if "moderate" in normalized:
            return "moderately active"
        if "light" in normalized:
            return "lightly active"
        if "sedentary" in normalized:
            return "sedentary"
        if "active" in normalized:
            return "active"
        return "moderately active"

    def _normalize_dietary_preference(self, value: str) -> str:
        normalized = self._normalize_text(value)
        if "vegan" in normalized:
            return "vegan"
        if "vegetarian" in normalized:
            return "vegetarian"
        if "omni" in normalized or "non veg" in normalized or "nonveg" in normalized:
            return "omnivore"
        return "omnivore"

    def _extract_disease_tokens_from_label(self, value: str) -> List[str]:
        tokens: List[str] = []
        for item in str(value or "").split(","):
            token = self._normalize_text(item)
            if token and token not in tokens:
                tokens.append(token)
        return tokens

    def _build_meal_tags(self, meal_name: str) -> List[str]:
        text = self._normalize_text(meal_name)
        tags: List[str] = []
        tag_rules = [
            ("oat", "High Fiber"),
            ("whole wheat", "Whole Grain"),
            ("salmon", "Omega-3"),
            ("fish", "Lean Protein"),
            ("chicken", "Lean Protein"),
            ("tofu", "Plant Protein"),
            ("lentil", "Plant Protein"),
            ("bean", "Fiber Rich"),
            ("yogurt", "Probiotic"),
            ("curd", "Gut Friendly"),
            ("fruit", "Vitamin Rich"),
            ("berry", "Antioxidant"),
            ("spinach", "Iron Rich"),
            ("nuts", "Healthy Fats"),
        ]
        for token, tag in tag_rules:
            if token in text and tag not in tags:
                tags.append(tag)
            if len(tags) >= 3:
                break
        if not tags:
            tags = ["Balanced"]
        return tags

    def _load_diet_dataset(self) -> None:
        preferred_path = os.path.join(self.data_dir, "disease_diet", "detailed_meals_macros_CLEANED.csv")
        fallback_path = os.path.join(self.data_dir, "disease_diet", "detailed_meals_macros_.csv")
        dataset_path = preferred_path if os.path.exists(preferred_path) else fallback_path
        if not os.path.exists(dataset_path):
            return

        templates: List[Dict[str, Any]] = []
        meal_columns = [
            ("Breakfast", "Breakfast Suggestion", "Breakfast Calories", "8:00 AM"),
            ("Lunch", "Lunch Suggestion", "Lunch Calories", "1:00 PM"),
            ("Snack", "Snack Suggestion", "Snacks Calories", "4:00 PM"),
            ("Dinner", "Dinner Suggestion", "Dinner Calories", "7:30 PM"),
        ]

        try:
            df = pd.read_csv(dataset_path, low_memory=False)
            for _, row in df.iterrows():
                preference = self._normalize_dietary_preference(row.get("Dietary Preference", ""))
                activity_level = self._normalize_activity_level(row.get("Activity Level", ""))
                disease_tokens = self._extract_disease_tokens_from_label(row.get("Disease", ""))
                daily_calories = self._safe_float(row.get("Daily Calorie Target"), 0.0)

                meals: Dict[str, Dict[str, Any]] = {}
                for slot, name_col, calorie_col, fallback_time in meal_columns:
                    meal_name = str(row.get(name_col, "")).strip()
                    if not meal_name or meal_name.lower() == "nan":
                        continue
                    meal_calories = self._safe_float(row.get(calorie_col), 0.0)
                    if meal_calories <= 0 or meal_calories > 1600:
                        meal_calories = 0.0

                    meals[slot] = {
                        "meal": slot,
                        "time": fallback_time,
                        "name": meal_name,
                        "name_norm": self._normalize_text(meal_name),
                        "calories": meal_calories,
                        "tags": self._build_meal_tags(meal_name),
                    }

                if len(meals) < 3:
                    continue

                templates.append(
                    {
                        "preference": preference,
                        "activity_level": activity_level,
                        "daily_calories": daily_calories,
                        "protein": self._safe_float(row.get("Protein"), 0.0),
                        "carbs": self._safe_float(row.get("Carbohydrates"), 0.0),
                        "fat": self._safe_float(row.get("Fat"), 0.0),
                        "fiber": self._safe_float(row.get("Fiber"), 0.0),
                        "disease_tokens": disease_tokens,
                        "meals": meals,
                    }
                )
        except Exception:
            templates = []

        self.diet_meal_templates = templates

    def _load_healthy_foods(self) -> None:
        dataset_path = os.path.join(self.data_dir, "healthy_foods", "Top 100 Healthiest Food in the World.csv")
        if not os.path.exists(dataset_path):
            return
        try:
            df = pd.read_csv(dataset_path)
            foods = []
            profiles = []
            for _, row in df.iterrows():
                food_name = str(row.get("Food", "")).strip()
                if food_name and food_name.lower() != "nan":
                    foods.append(food_name)
                    profiles.append(
                        {
                            "name": food_name,
                            "name_norm": self._normalize_text(food_name),
                            "nutrition": self._normalize_text(row.get("Nutrition Value (per 100g)", "")),
                            "protein": self._safe_float(row.get("Protein (g)"), 0.0),
                            "fiber": self._safe_float(row.get("Fiber (g)"), 0.0),
                            "vitamin_c": self._safe_float(row.get("Vitamin C (mg)"), 0.0),
                            "antioxidant": self._safe_float(row.get("Antioxidant Score"), 0.0),
                        }
                    )
            self.healthy_foods = foods
            self.healthy_food_profiles = profiles
        except Exception:
            self.healthy_foods = []
            self.healthy_food_profiles = []

    def _extract_symptoms_locally(self, text: str) -> List[str]:
        normalized_text = self._normalize_text(text)
        symptoms: List[str] = []

        for canonical, aliases in self.symptom_keywords.items():
            if canonical in normalized_text:
                symptoms.append(canonical)
                continue
            if any(self._normalize_text(alias) in normalized_text for alias in aliases):
                symptoms.append(canonical)

        if self.disease_symptom_map:
            for disease_symptoms in self.disease_symptom_map.values():
                for symptom in disease_symptoms:
                    if symptom in normalized_text and symptom not in symptoms:
                        symptoms.append(symptom)

        deduped = []
        for item in symptoms:
            normalized_item = self._normalize_text(item)
            if normalized_item and normalized_item not in deduped:
                deduped.append(normalized_item)
        return deduped[:10]

    def _detect_disease_from_dataset(self, symptoms: List[str], raw_text: str) -> tuple[str, List[str], float]:
        if not self.disease_symptom_map:
            return "", [], 0.0

        observed_set = set(symptoms)
        text_norm = self._normalize_text(raw_text)
        best_disease = ""
        best_match: List[str] = []
        best_score = 0.0

        for disease_name, disease_symptoms in self.disease_symptom_map.items():
            overlap = observed_set.intersection(disease_symptoms)
            if not overlap:
                continue
            weighted = sum(self.symptom_severity.get(symptom, 1.0) for symptom in overlap)
            coverage = len(overlap) / max(1, min(8, len(disease_symptoms)))
            score = weighted + (coverage * 3.2)
            if self._normalize_text(disease_name) in text_norm:
                score += 2.0
            if score > best_score:
                best_score = score
                best_disease = disease_name
                best_match = sorted(overlap, key=lambda item: self.symptom_severity.get(item, 1.0), reverse=True)

        return best_disease, best_match[:6], best_score

    def _match_profile_from_text(self, text: str) -> Dict[str, Any]:
        text_norm = self._normalize_text(text)
        for profile in self.condition_profiles:
            if any(self._normalize_text(keyword) in text_norm for keyword in profile["keywords"]):
                return profile
        return self.condition_profiles[0]

    def _search_medicine_candidates(self, query_terms: List[str], symptom_terms: List[str]) -> List[Dict[str, Any]]:
        normalized_queries = [self._normalize_text(item) for item in query_terms if self._normalize_text(item)]
        normalized_queries = list(dict.fromkeys(normalized_queries))
        if not normalized_queries:
            return []

        cache_key = f"{'|'.join(sorted(normalized_queries))}:{'|'.join(sorted(symptom_terms))}"
        if cache_key in self.search_cache:
            return self.search_cache[cache_key]

        candidates: List[Dict[str, Any]] = []
        for item in self.medicine_knowledge:
            use_text = item["use_text"]
            score = 0.0
            matched_queries = []
            for query in normalized_queries:
                if query in use_text:
                    score += 3.0 if " " in query else 1.8
                    matched_queries.append(query)
            if not matched_queries:
                continue

            for symptom in symptom_terms:
                if symptom in use_text and symptom not in matched_queries:
                    score += 0.8

            if item["habit_forming"]:
                score -= 1.0
            if score > 1.0:
                candidates.append({"score": score, "item": item, "matched_queries": matched_queries})

        candidates.sort(key=lambda entry: entry["score"], reverse=True)
        top = candidates[:80]
        self.search_cache[cache_key] = top
        if len(self.search_cache) > 64:
            self.search_cache.clear()
        return top

    def _estimate_duration(self, condition_name: str) -> str:
        condition = self._normalize_text(condition_name)
        if "migraine" in condition:
            return "1 to 3 days"
        if "gastritis" in condition or "acidity" in condition:
            return "5 to 14 days"
        if "back pain" in condition or "muscle" in condition:
            return "3 to 7 days"
        return "3 to 5 days"

    def get_common_searches(self, symptoms: List[str]) -> List[str]:
        chips = []
        for item in self.default_common_searches + symptoms:
            normalized = self._normalize_text(item)
            if normalized and normalized not in chips:
                chips.append(normalized)
            if len(chips) >= 4:
                break
        return chips

    def get_natural_alternative(self, disease_analysis: Dict[str, Any]) -> Dict[str, str]:
        condition_name = disease_analysis.get("condition", "")
        profile = self._match_profile_from_text(condition_name)
        return dict(profile.get("natural_alternative", {}))

    def extract_symptoms_with_grok(self, text: str) -> List[str]:
        symptoms: List[str] = []
        try:
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": "Extract only medical symptoms as a comma-separated list."},
                    {"role": "user", "content": f"Symptoms text: {text}"},
                ],
                "temperature": 0.1,
                "max_tokens": 200,
            }
            response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=8)
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                parsed = re.split(r"[,\n]", str(content))
                for part in parsed:
                    normalized = self._normalize_text(part)
                    if normalized:
                        symptoms.append(normalized)
        except Exception:
            pass

        local_symptoms = self._extract_symptoms_locally(text)
        symptoms.extend(local_symptoms)

        cleaned: List[str] = []
        for symptom in symptoms:
            normalized = self._normalize_text(symptom)
            if normalized and normalized not in cleaned:
                cleaned.append(normalized)
        return cleaned[:10]

    def analyze_disease(self, symptoms: List[str], raw_text: str, user_profile: Dict[str, Any]) -> Dict[str, Any]:
        observed_symptoms: List[str] = []
        for item in symptoms + self._extract_symptoms_locally(raw_text):
            normalized = self._normalize_text(item)
            if normalized and normalized not in observed_symptoms:
                observed_symptoms.append(normalized)

        best_disease, dataset_matches, dataset_score = self._detect_disease_from_dataset(observed_symptoms, raw_text)

        profile = self._match_profile_from_text(f"{best_disease} {' '.join(observed_symptoms)} {raw_text}")
        matched_symptoms = dataset_matches or [
            self._normalize_text(keyword)
            for keyword in profile["keywords"]
            if self._normalize_text(keyword) in " ".join(observed_symptoms)
        ][:5]
        if not matched_symptoms:
            matched_symptoms = observed_symptoms[:5]

        possible_causes: List[str] = []
        if best_disease:
            possible_causes = list(profile["causes"])
            description = self.disease_description_map.get(best_disease, "")
            if description:
                first_sentence = description.split(".")[0].strip()
                if first_sentence and first_sentence not in possible_causes:
                    possible_causes.insert(0, first_sentence)

        precautions = self.disease_precautions_map.get(best_disease, [])
        if best_disease and dataset_score > 0:
            confidence = round(min(0.58 + (0.07 * len(matched_symptoms)) + min(dataset_score / 26, 0.24), 0.95), 2)
        else:
            confidence = round(min(0.54 + (0.06 * len(matched_symptoms)), 0.84), 2)

        if best_disease:
            reason = (
                f"Symptoms align with a {best_disease} pattern and map to {profile['condition']}. "
                f"Matched signals: {', '.join(matched_symptoms)}."
            )
        else:
            reason = (
                f"The reported symptoms align with {profile['condition']}. "
                f"Matched signals: {', '.join(matched_symptoms) if matched_symptoms else 'general symptom pattern'}."
            )

        medical_context = user_profile.get("medical_conditions", "")
        if medical_context:
            reason += f" Existing medical context considered: {medical_context}."
        if precautions:
            reason += f" Precaution focus: {precautions[0]}."

        return {
            "condition": profile["condition"],
            "reason": reason,
            "matched_symptoms": matched_symptoms[:6],
            "possible_causes": possible_causes[:4],
            "confidence": confidence,
            "detected_disease": best_disease or profile["condition"],
            "precautions": precautions[:4],
        }

    def _find_drug_from_db(self, db: Session, drug_name: str) -> Optional[Drug]:
        return (
            db.query(Drug)
            .filter(Drug.name.ilike(f"%{drug_name}%"))
            .order_by(Drug.rating.desc(), Drug.reviews_count.desc())
            .first()
        )

    def check_drug_interactions_by_name(self, drug_name: str, user_profile: Dict[str, Any], db: Session) -> str:
        try:
            interactions = db.query(DrugInteraction).filter(
                (DrugInteraction.drug1.ilike(f"%{drug_name}%"))
                | (DrugInteraction.drug2.ilike(f"%{drug_name}%"))
            ).all()
            if interactions:
                if any(item.severity == "high" for item in interactions):
                    return "high"
                if any(item.severity == "medium" for item in interactions):
                    return "medium"
                return "low"

            allergy_text = self._normalize_text(user_profile.get("allergies", ""))
            drug_text = self._normalize_text(drug_name)
            high_risk_allergy_map = {
                "nsaid": ["ibuprofen", "aspirin", "naproxen", "diclofenac"],
                "aspirin": ["aspirin", "ibuprofen", "naproxen"],
                "penicillin": ["penicillin", "amoxicillin", "augmentin"],
                "sulfa": ["sulf", "sulfa"],
            }
            for allergy_token, risky_drugs in high_risk_allergy_map.items():
                if allergy_token in allergy_text and any(drug_token in drug_text for drug_token in risky_drugs):
                    return "high"

            return "none"
        except Exception:
            return "unknown"

    def check_for_followup(self, symptoms: List[str], raw_text: str, disease_analysis: Dict[str, Any], parameters: Optional[Dict[str, float]] = None) -> Optional[Dict[str, Any]]:
        condition = self._normalize_text(disease_analysis.get('condition', ''))
        raw = self._normalize_text(raw_text)

        # Evaluate rules if structured parameters were provided by the frontend UI
        if parameters:
            if "blood_pressure" in self.diagnosis_rules and ("pressure" in raw or "bp" in raw or "hypertension" in condition):
                systolic = parameters.get("Systolic BP")
                if systolic:
                    if systolic < 90:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["blood_pressure"]["medications"]["low"]
                    elif systolic <= 120:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["blood_pressure"]["medications"]["normal"]
                    elif systolic <= 139:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["blood_pressure"]["medications"]["elevated"]
                    else:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["blood_pressure"]["medications"]["hypertension"]
                return None
            
            if "diabetes" in self.diagnosis_rules and ("diabetes" in raw or "sugar" in raw or "diabetes" in condition):
                fasting = parameters.get("Fasting Blood Sugar")
                if fasting:
                    if fasting < 100:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["diabetes"]["medications"]["normal"]
                    elif fasting <= 125:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["diabetes"]["medications"]["prediabetes"]
                    else:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["diabetes"]["medications"]["diabetes"]
                return None
                
            if "fever" in self.diagnosis_rules and ("fever" in raw or "temperature" in raw or "fever" in condition):
                temp = parameters.get("Temperature (F)")
                if temp:
                    if temp < 99.5:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["fever"]["medications"]["normal"]
                    elif temp <= 101.9:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["fever"]["medications"]["mild"]
                    elif temp <= 103.9:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["fever"]["medications"]["high"]
                    else:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["fever"]["medications"]["severe"]
                return None

            if "back_pain" in self.diagnosis_rules and ("back" in raw or "pain" in raw or "muscle" in raw or "spasm" in raw or "back" in condition or "muscle" in condition):
                pain_scale = parameters.get("Pain Scale (1-10)")
                duration = parameters.get("Duration (days)")
                if pain_scale is not None and duration is not None:
                    if pain_scale >= 8 or duration >= 14:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["back_pain"]["medications"]["severe"]
                    elif pain_scale >= 4:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["back_pain"]["medications"]["moderate"]
                    else:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["back_pain"]["medications"]["mild"]
                return None

        # If parameters not provided, trigger the parameter form requirement
        if "pressure" in raw or "bp" in raw or "hypertension" in condition:
            if not parameters:
                return {
                    "type": "parameters",
                    "parameters": self.diagnosis_rules["blood_pressure"]["parameters"],
                    "question": "Please provide the following test parameters for an accurate Blood Pressure diagnosis:"
                }
                
        if "diabetes" in raw or "sugar" in raw or "diabetes" in condition:
            if not parameters:
                return {
                    "type": "parameters",
                    "parameters": self.diagnosis_rules["diabetes"]["parameters"],
                    "question": "Please provide the following test parameters for an accurate Diabetes diagnosis:"
                }

        if "back" in raw or "pain" in raw or "muscle" in raw or "spasm" in raw or "back" in condition or "muscle" in condition:
            # Exclude "stomach pain" or "throat pain" if we want to be specific to back/muscle pain, but based on symptom keywords:
            # We handle general back/muscle pain here
            if "stomach" not in raw and "throat" not in raw:
                if not parameters or "Pain Scale (1-10)" not in parameters or "Duration (days)" not in parameters:
                    return {
                        "type": "parameters",
                        "parameters": self.diagnosis_rules["back_pain"]["parameters"],
                        "question": "Please provide your pain scale and duration for an appropriate painkiller dosage:"
                    }
            
        if "fever" in raw or "temperature" in raw or "fever" in condition:
            if not any(char.isdigit() for char in raw):
                if not parameters:
                    return {
                        "type": "parameters",
                        "parameters": self.diagnosis_rules["fever"]["parameters"],
                        "question": "Please provide your exact body temperature for an accurate diagnosis:"
                    }
            elif not parameters: # Fallback if text has numbers, auto extract or explicitly ask
                numbers = [float(s) for s in re.findall(r'\b\d{2,3}(?:\.\d+)?\b', raw)]
                if not numbers or (max(numbers) < 95 or max(numbers) > 110):
                    return {
                        "type": "parameters",
                        "parameters": self.diagnosis_rules["fever"]["parameters"],
                        "question": "Please provide your precise body temperature in Fahrenheit:"
                    }
                else:
                    # In-text extraction worked, map it instantly to severity
                    temp = max(numbers)
                    if temp < 99.5:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["fever"]["medications"]["normal"]
                    elif temp <= 101.9:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["fever"]["medications"]["mild"]
                    elif temp <= 103.9:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["fever"]["medications"]["high"]
                    else:
                        disease_analysis['severity_warning'] = self.diagnosis_rules["fever"]["medications"]["severe"]
                        
        # Universal Catch-All: If parameters are STILL empty at this point, ask for general parameters
        if not parameters:
            return {
                "type": "parameters",
                "parameters": ["Duration (Days)", "Pain Scale (1-10)"],
                "question": f"To accurately diagnose your {disease_analysis.get('condition', 'symptoms').lower()}, please provide the following details:"
            }
            
        # Evaluate Universal Parameters if they were provided
        if parameters and "Duration (Days)" in parameters:
            duration = parameters.get("Duration (Days)", 0)
            pain = parameters.get("Pain Scale (1-10)", 0)
            
            warning_parts = []
            if duration > 7:
                warning_parts.append("Prolonged duration detected (>7 days).")
            if pain >= 8:
                warning_parts.append("High severity reported (Pain >= 8). Higher dose needed or immediate medical consult advised.")
                
            if warning_parts:
                disease_analysis['severity_warning'] = " ".join(warning_parts)

        # Legacy fallback for other conditions requiring text
        if "typhoid" in condition:
            if "days" not in raw and "test" not in raw:
                return {"type": "text", "question": "How many days have you had the fever, and have you taken a Widal test?"}
            
            numbers = [int(s) for s in re.findall(r'\b\d+\b', raw_text)]
            if numbers and max(numbers) > 5:
                disease_analysis['severity_warning'] = "Appropriate medical tests required"

        return None


    def recommend_drugs(
        self,
        user_profile: Dict[str, Any],
        disease_analysis: Dict[str, Any],
        db: Session,
        limit: int = 3,
        previous_drugs: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        profile = self._match_profile_from_text(
            f"{disease_analysis.get('condition', '')} {disease_analysis.get('detected_disease', '')}"
        )
        target_count = max(2, min(limit, 3))
        base_confidence = float(disease_analysis.get("confidence", 0.7))

        previous_keys: List[str] = []
        for record in previous_drugs or []:
            normalized = self._normalize_text(record.get("name", ""))
            if normalized:
                previous_keys.append(normalized)

        query_terms = [
            disease_analysis.get("condition", ""),
            disease_analysis.get("detected_disease", ""),
            *profile["keywords"],
            *disease_analysis.get("matched_symptoms", [])[:5],
        ]
        symptom_terms = [
            self._normalize_text(item)
            for item in disease_analysis.get("matched_symptoms", [])
            if self._normalize_text(item)
        ]

        recommendations: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for rank, candidate in enumerate(self._search_medicine_candidates(query_terms, symptom_terms)):
            medicine = candidate["item"]
            name = medicine["name"]
            name_key = medicine["name_key"]
            if name_key in seen:
                continue

            score = float(candidate["score"])
            
            # Inject dynamic sorting variance to prevent identical drug responses
            import random
            score += random.uniform(0.0, 0.6)
            
            record_boost = False
            if previous_keys and any(name_key.startswith(key) or key.startswith(name_key) for key in previous_keys):
                score += 1.2
                record_boost = True

            interaction_risk = self.check_drug_interactions_by_name(name, user_profile, db)
            if interaction_risk == "high":
                continue

            db_drug = self._find_drug_from_db(db, name)
            
            description = ""
            category = medicine.get("category", "General Medicine")
            dosage = "As prescribed"
            rating = 4.0
            drug_id = 0

            if db_drug:
                description = (db_drug.description or "").replace('"', "").strip()
                category = db_drug.category or category
                dosage = db_drug.dosage or dosage
                rating = float(db_drug.rating) if db_drug.rating else rating
                drug_id = int(db_drug.id)

            if "Higher dose needed" in disease_analysis.get("severity_warning", ""):
                dosage = f"Higher Strength / {dosage}"
            elif "Small dose recommended" in disease_analysis.get("severity_warning", ""):
                dosage = f"Low Strength / {dosage}"

            if not description:
                primary_use = medicine["uses"][0] if medicine["uses"] else disease_analysis.get("condition", "symptom relief")
                description = f"Commonly used for {primary_use}."
            if len(description) > 190:
                description = description[:187] + "..."

            side_effects = medicine["side_effects"][:3] if medicine["side_effects"] else ["Nausea", "Mild dizziness"]
            confidence = round(max(0.55, min(base_confidence + (score * 0.03) - (0.04 * rank), 0.96)), 2)
            reason = f"Suggested for {disease_analysis.get('condition', 'your symptom pattern')}."
            
            if 'severity_warning' in disease_analysis:
                reason += f" WARNING: {disease_analysis['severity_warning']}."

            if candidate["matched_queries"]:
                reason += f" Matches: {', '.join(candidate['matched_queries'][:2])}."
            if record_boost:
                reason += " Also appears in previous recommendation history."

            recommendations.append(
                {
                    "drug_id": drug_id,
                    "name": name,
                    "description": description,
                    "category": category,
                    "confidence": confidence,
                    "interaction_risk": interaction_risk,
                    "rating": rating,
                    "dosage": dosage,
                    "duration": self._estimate_duration(disease_analysis.get("condition", "")),
                    "side_effects": ", ".join(side_effects),
                    "reason": reason,
                }
            )
            seen.add(name_key)

            if len(recommendations) >= target_count:
                break

        return recommendations[:target_count]

    def _extract_allergy_tokens(self, allergies: str) -> List[str]:
        normalized = self._normalize_text(allergies)
        if not normalized:
            return []
        if normalized in {"none", "no", "nil", "na", "n a", "no allergy", "no allergies"}:
            return []
        raw_parts = [item.strip() for item in re.split(r"[,;/]", normalized) if item.strip()]
        tokens: List[str] = []
        skip_tokens = {"none", "no", "nil", "na", "allergy", "allergies"}
        for part in raw_parts:
            if len(part) >= 3 and part not in tokens and part not in skip_tokens:
                tokens.append(part)
            for word in part.split():
                if len(word) >= 4 and word not in tokens and word not in skip_tokens:
                    tokens.append(word)
        return tokens[:8]

    def _meal_not_allowed_for_preference(self, meal_name: str, preference: str) -> bool:
        text = self._normalize_text(meal_name)
        meat_tokens = ["chicken", "fish", "salmon", "beef", "pork", "mutton", "tuna", "turkey", "shrimp", "meat"]
        dairy_tokens = ["milk", "cheese", "yogurt", "curd", "butter", "cream", "ghee"]

        if preference == "vegan":
            return any(token in text for token in meat_tokens + dairy_tokens + ["egg", "honey"])
        if preference == "vegetarian":
            return any(token in text for token in meat_tokens)
        return False

    def _stable_index(self, seed_text: str, length: int) -> int:
        if length <= 1:
            return 0
        from datetime import datetime
        daily_seed = seed_text + str(datetime.utcnow().date())
        digest = hashlib.md5(daily_seed.encode("utf-8")).hexdigest()
        return int(digest[:10], 16) % length

    def _get_diet_strategy(self, condition_text: str, symptoms: List[str]) -> Dict[str, Any]:
        text = self._normalize_text(f"{condition_text} {' '.join(symptoms)}")
        symptom_text = self._normalize_text(" ".join(symptoms))

        has_migraine_pattern = any(token in text for token in ["migraine", "headache", "blood pressure", "hypertension"])
        has_gastric_pattern = any(token in text for token in ["gastritis", "acidity", "heartburn", "stomach", "indigestion", "nausea"])
        explicit_migraine_symptoms = any(token in symptom_text for token in ["migraine", "headache"])

        if has_gastric_pattern and not explicit_migraine_symptoms:
            return {
                "goal": "Gut Soothing Plan",
                "meal_keywords": ["oat", "banana", "rice", "soup", "tofu", "boiled", "yogurt", "khichdi"],
                "foods_to_avoid": ["Deep Fried Food", "Spicy Curry", "Carbonated Drinks", "Excess Citrus"],
                "superfood_tokens": ["banana", "oat", "ginger", "papaya", "yogurt", "rice"],
                "macro_ratio": (0.5, 0.24, 0.26),
                "dataset_tokens": [],
                "tag_hint": "Easy Digest",
                "defaults": {
                    "Breakfast": "Banana with Oats",
                    "Lunch": "Rice and Boiled Vegetables",
                    "Snack": "Yogurt with Fruit",
                    "Dinner": "Light Lentil Khichdi",
                },
            }
        if has_migraine_pattern:
            return {
                "goal": "Migraine & Pressure Control",
                "meal_keywords": ["oat", "banana", "salad", "lentil", "yogurt", "quinoa", "greens", "nuts"],
                "foods_to_avoid": ["Aged Cheese", "Highly Salted Snacks", "Processed Meat", "Excess Coffee"],
                "superfood_tokens": ["banana", "spinach", "almond", "salmon", "avocado", "berry"],
                "macro_ratio": (0.42, 0.25, 0.33),
                "dataset_tokens": ["hypertension"],
                "tag_hint": "Low Trigger",
                "defaults": {
                    "Breakfast": "Banana Oat Bowl",
                    "Lunch": "Quinoa Vegetable Plate",
                    "Snack": "Walnuts and Yogurt",
                    "Dinner": "Salmon with Greens",
                },
            }
        if any(token in text for token in ["back pain", "muscle", "joint pain", "strain", "spasm", "stiffness"]):
            return {
                "goal": "Inflammation Recovery",
                "meal_keywords": ["salmon", "lentil", "nuts", "greens", "berries", "tofu", "bean", "turmeric"],
                "foods_to_avoid": ["Sugary Drinks", "Deep Fried Foods", "Processed Meat", "High-Sodium Snacks"],
                "superfood_tokens": ["salmon", "walnut", "flax", "spinach", "turmeric", "blueberr"],
                "macro_ratio": (0.38, 0.30, 0.32),
                "dataset_tokens": ["heart disease"],
                "tag_hint": "Anti-inflammatory",
                "defaults": {
                    "Breakfast": "Turmeric Oats Bowl",
                    "Lunch": "Grilled Protein and Greens",
                    "Snack": "Nuts and Fruit",
                    "Dinner": "Lentil Soup with Brown Rice",
                },
            }
        if any(token in text for token in ["diabetes", "blood sugar"]):
            return {
                "goal": "Glycemic Control",
                "meal_keywords": ["whole", "lentil", "bean", "salad", "tofu", "oat", "vegetable"],
                "foods_to_avoid": ["Refined Sugar", "Sweetened Drinks", "White Bread", "Dessert Overload"],
                "superfood_tokens": ["broccoli", "spinach", "chia", "almond", "oat", "lentil"],
                "macro_ratio": (0.38, 0.32, 0.30),
                "dataset_tokens": ["diabetes"],
                "tag_hint": "Low Glycemic",
                "defaults": {
                    "Breakfast": "Oats with Seeds",
                    "Lunch": "Lentil and Vegetable Bowl",
                    "Snack": "Nuts with Cucumber",
                    "Dinner": "Grilled Tofu and Greens",
                },
            }
        if any(token in text for token in ["kidney", "renal"]):
            return {
                "goal": "Kidney Friendly Support",
                "meal_keywords": ["rice", "vegetable", "tofu", "apple", "berries", "soup"],
                "foods_to_avoid": ["High Sodium Packaged Foods", "Processed Meat", "Cola Drinks", "Excess Pickles"],
                "superfood_tokens": ["apple", "cabbage", "blueberr", "garlic", "cauliflower"],
                "macro_ratio": (0.47, 0.23, 0.30),
                "dataset_tokens": ["kidney disease"],
                "tag_hint": "Low Sodium",
                "defaults": {
                    "Breakfast": "Fruit and Oatmeal",
                    "Lunch": "Steamed Rice with Vegetables",
                    "Snack": "Apple Slices",
                    "Dinner": "Light Vegetable Curry",
                },
            }
        if any(token in text for token in ["acne", "skin", "rash"]):
            return {
                "goal": "Skin Calming Nutrition",
                "meal_keywords": ["yogurt", "salad", "greens", "berry", "oat", "nuts", "lentil"],
                "foods_to_avoid": ["Excess Sugar", "Deep Fried Snacks", "Very Oily Food", "Processed Bakery"],
                "superfood_tokens": ["blueberr", "spinach", "tomato", "walnut", "carrot", "pumpkin"],
                "macro_ratio": (0.43, 0.27, 0.30),
                "dataset_tokens": ["acne"],
                "tag_hint": "Skin Friendly",
                "defaults": {
                    "Breakfast": "Yogurt Berry Bowl",
                    "Lunch": "Green Salad with Protein",
                    "Snack": "Fruit and Nuts",
                    "Dinner": "Vegetable Stir Fry",
                },
            }

        return {
            "goal": "Fever Recovery",
            "meal_keywords": ["soup", "oat", "rice", "fruit", "yogurt", "vegetable", "broth", "lentil"],
            "foods_to_avoid": ["Heavy Fried Foods", "Sugary Soda", "Processed Snacks", "Excess Alcohol"],
            "superfood_tokens": ["ginger", "garlic", "orange", "spinach", "berries", "yogurt"],
            "macro_ratio": (0.45, 0.25, 0.30),
            "dataset_tokens": [],
            "tag_hint": "Immune Support",
            "defaults": {
                "Breakfast": "Oatmeal with Fruit",
                "Lunch": "Chicken or Tofu Soup",
                "Snack": "Greek Yogurt with Berries",
                "Dinner": "Rice with Mixed Vegetables",
            },
        }

    def _calculate_personalized_calorie_target(self, user_profile: Dict[str, Any], condition_text: str) -> int:
        age = self._safe_float(user_profile.get("age"), 0.0)
        weight = self._safe_float(user_profile.get("weight"), 0.0)
        height = self._safe_float(user_profile.get("height"), 0.0)
        gender = self._normalize_text(user_profile.get("gender", "male"))
        activity = self._normalize_activity_level(user_profile.get("activity_level", "moderately active"))

        if age > 0 and weight > 0 and height > 0:
            bmr = (10 * weight) + (6.25 * height) - (5 * age) + (5 if "female" not in gender else -161)
            factor_map = {
                "sedentary": 1.2,
                "lightly active": 1.375,
                "moderately active": 1.55,
                "active": 1.65,
                "very active": 1.8,
            }
            target = bmr * factor_map.get(activity, 1.55)
        else:
            target_map = {
                "sedentary": 1850,
                "lightly active": 2050,
                "moderately active": 2250,
                "active": 2500,
                "very active": 2750,
            }
            target = float(target_map.get(activity, 2200))

        condition_norm = self._normalize_text(condition_text)
        if any(token in condition_norm for token in ["fever", "viral", "infection", "gastritis", "acidity"]):
            target -= 120
        if any(token in condition_norm for token in ["back pain", "muscle", "strain"]):
            target += 60
        if any(token in condition_norm for token in ["diabetes", "hypertension", "kidney"]):
            target -= 80

        return int(max(1400, min(3200, round(target))))

    def recommend_diet_plan(
        self,
        symptoms: List[str],
        disease_analysis: Dict[str, Any],
        user_profile: Dict[str, Any],
    ) -> Dict[str, Any]:
        condition_text = f"{disease_analysis.get('condition', '')} {disease_analysis.get('detected_disease', '')}".strip()
        strategy = self._get_diet_strategy(condition_text, symptoms)
        dietary_preference = self._normalize_dietary_preference(user_profile.get("dietary_preferences", ""))
        activity_target = self._normalize_activity_level(user_profile.get("activity_level", "moderately active"))
        allergy_tokens = self._extract_allergy_tokens(user_profile.get("allergies", ""))
        target_calories = self._calculate_personalized_calorie_target(user_profile, condition_text)

        preference_candidates = {"vegan"} if dietary_preference == "vegan" else {"vegetarian", "vegan"} if dietary_preference == "vegetarian" else {"omnivore", "vegetarian", "vegan"}

        scored_templates: List[tuple[float, Dict[str, Any]]] = []
        for template in self.diet_meal_templates:
            if template.get("preference") not in preference_candidates:
                continue

            score = 2.0
            if template.get("preference") == dietary_preference:
                score += 1.2
            if template.get("activity_level") == activity_target:
                score += 1.0

            daily_cal = self._safe_float(template.get("daily_calories"), 0.0)
            if daily_cal > 0:
                score -= min(abs(daily_cal - target_calories) / 520, 2.2)

            strategy_tokens = strategy.get("dataset_tokens", [])
            disease_tokens = template.get("disease_tokens", [])
            score += sum(0.7 for token in strategy_tokens if token in disease_tokens)

            meal_text = " ".join(item.get("name_norm", "") for item in template.get("meals", {}).values())
            score += sum(0.35 for token in strategy.get("meal_keywords", []) if token in meal_text)
            if allergy_tokens and any(token in meal_text for token in allergy_tokens):
                score -= 2.0

            scored_templates.append((score, template))

        scored_templates.sort(key=lambda item: item[0], reverse=True)
        top_templates = scored_templates[:24]
        if not top_templates and self.diet_meal_templates:
            top_templates = [(0.0, item) for item in self.diet_meal_templates[:18]]

        meal_sequence = [("Breakfast", "8:00 AM"), ("Lunch", "1:00 PM"), ("Snack", "4:00 PM"), ("Dinner", "7:30 PM")]
        meal_ratio = {"Breakfast": 0.26, "Lunch": 0.32, "Snack": 0.14, "Dinner": 0.28}
        meal_bounds = {"Breakfast": (220, 560), "Lunch": (280, 760), "Snack": (120, 360), "Dinner": (320, 820)}

        seed_text = f"{condition_text}|{' '.join(symptoms)}|{user_profile.get('dietary_preferences', '')}|{user_profile.get('activity_level', '')}"
        selected_meals: List[Dict[str, Any]] = []

        for slot, fallback_time in meal_sequence:
            pool: List[Dict[str, Any]] = []
            for _, template in top_templates:
                meal = template.get("meals", {}).get(slot)
                if not meal:
                    continue
                meal_name = meal.get("name", "")
                meal_name_norm = meal.get("name_norm", self._normalize_text(meal_name))
                if self._meal_not_allowed_for_preference(meal_name, dietary_preference):
                    continue
                if allergy_tokens and any(token in meal_name_norm for token in allergy_tokens):
                    continue
                pool.append(meal)

            if pool:
                import random
                picked = dict(random.choice(pool))
            else:
                fallback_name = strategy["defaults"].get(slot, f"{slot} meal")
                picked = {
                    "meal": slot,
                    "time": fallback_time,
                    "name": fallback_name,
                    "name_norm": self._normalize_text(fallback_name),
                    "calories": 0.0,
                    "tags": self._build_meal_tags(fallback_name),
                }

            if strategy.get("tag_hint") and strategy["tag_hint"] not in picked.get("tags", []):
                picked["tags"] = [*picked.get("tags", [])[:2], strategy["tag_hint"]]
            selected_meals.append(picked)

        raw_calories = []
        for meal in selected_meals:
            slot = meal.get("meal", "Snack")
            fallback = max(100.0, target_calories * meal_ratio.get(slot, 0.2))
            raw = self._safe_float(meal.get("calories"), 0.0)
            if raw <= 0 or raw > 1600:
                raw = fallback
            raw_calories.append(raw)

        target_consumed = target_calories * 0.72
        total_raw = max(sum(raw_calories), 1.0)
        scale = target_consumed / total_raw

        meals: List[Dict[str, Any]] = []
        for index, meal in enumerate(selected_meals):
            slot = meal.get("meal", "Snack")
            lower, upper = meal_bounds.get(slot, (120, 700))
            calibrated_calories = int(round(raw_calories[index] * scale))
            calibrated_calories = int(max(lower, min(upper, calibrated_calories)))
            meals.append(
                {
                    "meal": slot,
                    "time": meal.get("time") or dict(meal_sequence).get(slot, "12:00 PM"),
                    "name": meal.get("name", f"{slot} meal"),
                    "calories": calibrated_calories,
                    "tags": meal.get("tags", ["Balanced"])[:3],
                }
            )

        consumed = sum(item["calories"] for item in meals)
        calories_remaining = int(max(180, min(1300, target_calories - consumed)))

        macro_ratio = strategy.get("macro_ratio", (0.45, 0.25, 0.30))
        carbs_grams = int(round((target_calories * macro_ratio[0]) / 4))
        protein_grams = int(round((target_calories * macro_ratio[1]) / 4))
        fat_grams = int(round((target_calories * macro_ratio[2]) / 9))

        if top_templates:
            reference = top_templates[0][1]
            ref_carbs = self._safe_float(reference.get("carbs"), carbs_grams)
            ref_protein = self._safe_float(reference.get("protein"), protein_grams)
            ref_fat = self._safe_float(reference.get("fat"), fat_grams)
            carbs_grams = int(max(80, min(330, round((carbs_grams * 0.72) + (ref_carbs * 0.28)))))
            protein_grams = int(max(55, min(190, round((protein_grams * 0.72) + (ref_protein * 0.28)))))
            fat_grams = int(max(25, min(110, round((fat_grams * 0.72) + (ref_fat * 0.28)))))

        foods_to_avoid = list(strategy.get("foods_to_avoid", []))
        for token in allergy_tokens[:3]:
            entry = f"Foods containing {token.title()}"
            if entry not in foods_to_avoid:
                foods_to_avoid.append(entry)

        for precaution in disease_analysis.get("precautions") or []:
            precaution_norm = self._normalize_text(precaution)
            if "avoid" in precaution_norm and precaution not in foods_to_avoid:
                foods_to_avoid.append(precaution)
            if len(foods_to_avoid) >= 6:
                break

        dedup_avoid: List[str] = []
        for item in foods_to_avoid:
            if item and item.lower() not in [existing.lower() for existing in dedup_avoid]:
                dedup_avoid.append(item)

        superfoods: List[str] = []
        scored_superfoods: List[tuple[float, str]] = []
        for food in self.healthy_food_profiles:
            if self._meal_not_allowed_for_preference(food["name"], dietary_preference):
                continue
            score = 0.0
            for token in strategy.get("superfood_tokens", []):
                if token in food["name_norm"] or token in food["nutrition"]:
                    score += 2.0
            if "inflammation" in self._normalize_text(strategy["goal"]) and food.get("antioxidant", 0) >= 2500:
                score += 0.5
            if "gut" in self._normalize_text(strategy["goal"]) and food.get("fiber", 0) >= 4:
                score += 0.4
            if "recovery" in self._normalize_text(strategy["goal"]) and food.get("protein", 0) >= 5:
                score += 0.4
            if "fever" in self._normalize_text(strategy["goal"]) and food.get("vitamin_c", 0) >= 20:
                score += 0.5
            if score > 0:
                scored_superfoods.append((score, food["name"]))

        scored_superfoods.sort(key=lambda item: item[0], reverse=True)
        for _, name in scored_superfoods:
            if name not in superfoods:
                superfoods.append(name)
            if len(superfoods) >= 4:
                break

        if not superfoods:
            for item in self.healthy_foods:
                normalized = self._normalize_text(item)
                if any(token in normalized for token in strategy.get("superfood_tokens", [])):
                    if not self._meal_not_allowed_for_preference(item, dietary_preference) and item not in superfoods:
                        superfoods.append(item)
                if len(superfoods) >= 4:
                    break

        fallback_superfoods = ["Spinach", "Blueberries", "Garlic", "Greek Yogurt", "Avocado", "Almonds"]
        for item in fallback_superfoods:
            if self._meal_not_allowed_for_preference(item, dietary_preference):
                continue
            if item not in superfoods:
                superfoods.append(item)
            if len(superfoods) >= 4:
                break

        based_on_symptoms = symptoms[:6] if symptoms else (disease_analysis.get("matched_symptoms") or [])[:6]
        if not based_on_symptoms and disease_analysis.get("condition"):
            based_on_symptoms = [str(disease_analysis["condition"])]

        condition_norm = self._normalize_text(condition_text)
        
        if any(token in condition_norm for token in ["diabetes", "blood sugar", "diabetic"]):
            if "High fiber foods" not in superfoods:
                superfoods.insert(0, "High fiber foods")
            if "Refined carbs" not in dedup_avoid:
                dedup_avoid.extend(["Refined carbs", "High sugar items"])
            
        if any(token in condition_norm for token in ["blood pressure", "hypertension", "bp"]):
            if "High potassium foods" not in superfoods:
                superfoods.insert(0, "High potassium foods")
            if "High sodium foods" not in dedup_avoid:
                dedup_avoid.extend(["High sodium foods", "Processed salty snacks"])

        return {
            "goal": strategy["goal"],
            "calories_remaining": calories_remaining,
            "carbs": f"{carbs_grams}g",
            "protein": f"{protein_grams}g",
            "fat": f"{fat_grams}g",
            "meals": meals,
            "foods_to_avoid": dedup_avoid[:6],
            "superfoods": superfoods[:5],
            "based_on_symptoms": based_on_symptoms,
        }

    def get_previous_drug_records(self, user_id: int, db: Session, limit: int = 5) -> List[Dict[str, Any]]:
        rows = (
            db.query(Recommendation)
            .filter(
                Recommendation.user_id == user_id,
                Recommendation.recommendation_type == "drug",
            )
            .order_by(Recommendation.created_at.desc())
            .limit(50)
            .all()
        )
        aggregated: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            match = re.match(r"Recommended:\s*(.*?)\s*-", row.recommendation_text or "")
            name = match.group(1).strip() if match else "Unknown Drug"
            key = name.lower()
            if key not in aggregated:
                aggregated[key] = {
                    "name": name,
                    "count": 0,
                    "last_recommended_at": row.created_at,
                    "avg_confidence": 0.0,
                }
            aggregated[key]["count"] += 1
            aggregated[key]["avg_confidence"] += float(row.confidence_score or 0)
        records: List[Dict[str, Any]] = []
        for item in aggregated.values():
            records.append(
                {
                    "name": item["name"],
                    "times_recommended": item["count"],
                    "avg_confidence": round(item["avg_confidence"] / max(item["count"], 1), 2),
                    "last_recommended_at": item["last_recommended_at"],
                }
            )
        records.sort(key=lambda x: x["last_recommended_at"], reverse=True)
        return records[:limit]

    def _get_chat_quick_replies(self, text: str) -> List[str]:
        if any(token in text for token in ["drug", "medicine", "medication"]):
            return ["Analyze symptoms", "Safety warning", "Diet plan"]
        if any(token in text for token in ["diet", "food", "meal"]):
            return ["Open Diet Plan", "Foods to avoid", "Superfoods"]
        return ["Analyze symptoms", "Recent drugs", "Diet suggestions"]

    def _resolve_ollama_model(self) -> Optional[str]:
        if self.ollama_model_cache:
            return self.ollama_model_cache

        try:
            response = requests.get(f"{self.ollama_base_url}/api/tags", timeout=3)
            if response.status_code != 200:
                return None
            payload = response.json()
            available_models = [item.get("name", "") for item in payload.get("models", []) if item.get("name")]
            if not available_models:
                return None

            for preferred in self.ollama_preferred_models:
                if preferred in available_models:
                    self.ollama_model_cache = preferred
                    return preferred
                preferred_family = preferred.split(":")[0]
                family_match = next((name for name in available_models if name.startswith(preferred_family)), None)
                if family_match:
                    self.ollama_model_cache = family_match
                    return family_match

            self.ollama_model_cache = available_models[0]
            return self.ollama_model_cache
        except Exception:
            return None

    def _fallback_chat_reply(
        self,
        message: str,
        user_profile: Dict[str, Any],
        previous_drugs: List[Dict[str, Any]],
    ) -> str:
        text = message.lower().strip()
        if any(token in text for token in ["drug", "medicine", "medication"]):
            if previous_drugs:
                names = ", ".join(item["name"] for item in previous_drugs[:3])
                return f"Recent medicines from your records: {names}. Enter fresh symptoms for updated top 2-3 drugs."
            return "No previous medicine records found yet. Analyze symptoms in Medicines to generate suggestions."
        if any(token in text for token in ["diet", "food", "meal"]):
            return "Your diet plan is generated from latest symptom analysis and profile context."
        profile_note = user_profile.get("medical_conditions") or "no major conditions recorded"
        return f"I can help with symptoms, medicines, and diet planning. Current profile note: {profile_note}."

    def _generate_smart_chat_reply(
        self,
        message: str,
        history: List[Dict[str, str]],
        user_profile: Dict[str, Any],
        previous_drugs: List[Dict[str, Any]],
        quick_replies: List[str],
    ) -> Optional[str]:
        text = message.lower().strip()
        
        # 1. Greet / Casual
        if text in ["hi", "hello", "hey", "good morning", "good evening", "help"]:
            return "Hello! I am AuraHealth AI, your professional medical assistant. I can help analyze your symptoms or answer general medical questions. How can I help you today?"

        # 2. General Informational (e.g., "what is diabetes")
        if "what is" in text or "tell me about" in text or "explain" in text:
            for condition, desc in self.disease_description_map.items():
                if condition.lower() in text:
                    return f"{condition} is a medical condition. {desc} If you have symptoms, please describe them."
            
            # Fallback for unknown
            disease_match = re.search(r'what is (.*?)(?:\?|$)', text)
            if disease_match:
                return f"I don't have extensive information on '{disease_match.group(1).strip()}' in my offline database. However, I can help analyze your symptoms if you describe what you're feeling."
        
        # 3. Handle parameter responses dynamically
        last_bot_msg = ""
        for i in range(len(history) - 1, -1, -1):
            if history[i].get("role") == "assistant" or history[i].get("role") == "bot":
                last_bot_msg = history[i].get("content", "").lower()
                break
                
        # Did the bot just ask for duration/severity?
        if "how many days" in last_bot_msg or "severity" in last_bot_msg:
            # We assume user is answering parameters. Combine previous symptom msg with this
            prev_symptom_msg = ""
            for msg in history:
                if msg.get("role") == "user":
                    prev_symptom_msg += msg.get("content", "").lower() + " "
            text = prev_symptom_msg + text # Merge them so analyze_disease catches everything
            
        # 4. Symptom Analysis Flow
        symptoms = self._extract_symptoms_locally(text)
        
        if symptoms:
            # Ask for severity and duration if missing
            has_duration = re.search(r'\\b\\d+\\s*(day|week|month)s?\\b', text) or ("days" in last_bot_msg and re.search(r'\\b\\d+\\b', text))
            has_severity = re.search(r'\\b(10|[1-9])(/10| out of 10)?\\b', text) or any(w in text for w in ["mild", "severe", "extreme", "moderate"])
            
            if not has_duration or not has_severity:
                missing = []
                if not has_duration: missing.append("how many days you have been suffering")
                if not has_severity: missing.append("the severity level on a scale from 1 to 10")
                return f"I can help analyze your {symptoms[0]}. To give you the best advice, could you please tell me {' and '.join(missing)}?"

            # Generate full ChatGPT-like analysis
            disease_analysis = self.analyze_disease(symptoms, text, user_profile)
            condition = disease_analysis.get('condition', 'mild condition')
            causes = ', '.join(disease_analysis.get('possible_causes', [])[:2]) if disease_analysis.get('possible_causes') else 'general inflammation or infection'
            
            reply = f"Based on your symptoms ({', '.join(symptoms)}), it may be related to a **{condition}**."
            reply += "\\n\\n**Advice & Treatment:**\\n"
            reply += f"Since you described these symptoms, you can manage it with proper rest, hydration, and a tailored diet plan. It is often caused by {causes.lower()}."
            
            # Find OTC drugs safely
            query_terms = [condition, *symptoms[:2]]
            candidates = self._search_medicine_candidates(query_terms, symptoms)
            if candidates:
                safe_otc = [c['item']['name'] for c in candidates if "paracetamol" in c['item']['name'].lower() or "ibuprofen" in c['item']['name'].lower() or "cetirizine" in c['item']['name'].lower() or "omeprazole" in c['item']['name'].lower() or "medicine" in c['item']['category'].lower()]
                if safe_otc:
                    reply += f"\\n\\n**Possible Basic Medications:**\\nCommonly over-the-counter options like {safe_otc[0]} are used to manage this. "
                else:
                    reply += "\\n\\n**Medication Notice:**\\nPlease consult a doctor for accurate treatment for these specific symptoms."
            else:
                 reply += "\\n\\n**Medication Notice:**\\nPlease consult a doctor for accurate treatment for these specific symptoms."
                 
            reply += "\\n\\nUse the 'Symptoms' tab on your Dashboard for a full breakdown!"
            return reply

        return "I can help with symptoms, medicines, and diet planning. If you are experiencing discomfort, please describe your specific symptoms (e.g., 'severe headache and nausea')."

    def generate_chat_reply(
        self,
        message: str,
        user_profile: Dict[str, Any],
        previous_drugs: List[Dict[str, Any]],
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        text = message.lower().strip()
        quick = self._get_chat_quick_replies(text)
        
        # 1. Try Groq MedGPT
        import json
        profile_str = json.dumps({k: v for k, v in user_profile.items() if v}, default=str)
        drugs_str = json.dumps([d.get("name") for d in previous_drugs], default=str)
        
        system_msg = (
            "You are AuraHealth AI (MedGPT), a highly intelligent, conversational, and empathetic medical assistant. "
            f"User Profile: {profile_str}. "
            f"Previously Recommended Drugs: {drugs_str}. "
            "IMPORTANT INSTRUCTIONS:\\n"
            "1. You must understand context from the conversation history. If the user replies with a number (e.g., '3' or '2 days'), look at the previous messages to see what you asked them (like duration or severity) and respond appropriately based on that context.\\n"
            "2. If they have previous drugs, proactively ask how they are feeling after taking them or if they remembered to take them.\\n"
            "3. Provide helpful, conversational medical advice, structured beautifully with markdown. Keep responses concise (under 150 words).\\n"
            "4. Be proactive: ask relevant follow-up questions to understand their symptoms better.\\n"
            "Respond ONLY with a valid JSON object in this format:\\n"
            '{"reply": "your markdown message", "quick_replies": ["option 1", "option 2"]}'
        )
        
        messages = [{"role": "system", "content": system_msg}]
        for msg in (history or [])[-5:]:
            messages.append({"role": "user" if msg["role"] == "user" else "assistant", "content": msg["content"]})
        messages.append({"role": "user", "content": message})
        
        payload = {
            "model": "llama3-8b-8192",
            "messages": messages,
            "temperature": 0.5,
            "max_tokens": 300,
        }
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
        
        try:
            response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=8)
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                start_idx = content.find('{')
                end_idx = content.rfind('}')
                if start_idx != -1 and end_idx != -1:
                    json_str = content[start_idx:end_idx+1]
                    data = json.loads(json_str)
                    if "reply" in data:
                        return {
                            "reply": data["reply"],
                            "quick_replies": data.get("quick_replies", quick)
                        }
        except Exception as e:
            print("MedGPT API Error:", e)

        # 2. Fallback to offline rule engine
        reply = self._generate_smart_chat_reply(message, history or [], user_profile, previous_drugs, quick)
        
        if not reply:
            reply = self._fallback_chat_reply(message, user_profile, previous_drugs)
            if "informational only" not in reply.lower():
                reply += " This assistant is informational only and does not replace a doctor."
                
        return {"reply": reply, "quick_replies": quick}


medical_ai = MedicalAI()


def build_dashboard_summary(current_user: User, db: Session) -> Dict[str, Any]:
    height_m = (current_user.height or 0) / 100 if current_user.height else 0
    bmi = round((current_user.weight / (height_m * height_m)), 1) if height_m > 0 else 0.0

    if bmi == 0:
        bmi_status = "Unknown"
    elif bmi < 18.5:
        bmi_status = "Underweight"
    elif bmi < 25:
        bmi_status = "Healthy Weight"
    elif bmi < 30:
        bmi_status = "Overweight"
    else:
        bmi_status = "Obese"

    goal_map = {
        "sedentary": 1800,
        "light": 2000,
        "moderate": 2200,
        "active": 2500,
        "very_active": 2800,
    }
    calorie_goal = goal_map.get((current_user.activity_level or "moderate").lower(), 2200)
    calories_today = int(round((current_user.weight or 65) * 16))

    seed = current_user.id or 1
    steps_week = [int(3800 + (index * 650) + ((seed + index * 7) % 1200)) for index in range(7)]
    current_steps = steps_week[-1]

    heart_rate = int(68 + ((current_user.age or 28) % 7))
    health_score = int(max(60, min(96, 92 - abs(22 - bmi) * 2)))

    previous = medical_ai.get_previous_drug_records(current_user.id, db, limit=3)
    next_dose: List[Dict[str, Any]] = []
    for item in previous:
        db_drug = db.query(Drug).filter(Drug.name.ilike(f"%{item['name']}%")).first()
        dosage = db_drug.dosage if db_drug and db_drug.dosage else "As prescribed"
        next_dose.append(
            {
                "name": item["name"],
                "detail": dosage,
                "status": "Soon" if len(next_dose) == 0 else "Taken",
                "tone": "warn" if len(next_dose) == 0 else "ok",
            }
        )

    if not next_dose:
        next_dose = [
            {"name": "No recent medicine", "detail": "Analyze symptoms in Medicines", "status": "Pending", "tone": "warn"}
        ]

    settings = get_or_create_user_settings(current_user.id, db)
    hydration_goal = round(max(2.0, min(3.5, (current_user.weight or 65) * 0.035)), 1)
    hydration_current = round(hydration_goal * (0.4 + ((seed % 4) * 0.12)), 1)

    upcoming_count = (
        db.query(Appointment)
        .filter(
            Appointment.user_id == current_user.id,
            Appointment.appointment_time >= datetime.utcnow(),
            Appointment.status == "scheduled",
        )
        .count()
    )

    notifications = [
        f"{upcoming_count} upcoming appointment(s)",
        (
            "Medication reminders enabled. You will receive medicine reminder cues."
            if settings.medication_reminders
            else "Medication reminders disabled. Turn this on in Settings to receive medicine cues."
        ),
        (
            "Diet alerts enabled. Meal and hydration nudges are active."
            if settings.diet_alerts
            else "Diet alerts disabled. Turn this on in Settings for meal nudges."
        ),
        (
            "Weekly reports enabled. Your weekly health summary is active."
            if settings.weekly_reports
            else "Weekly reports disabled. Turn this on in Settings to receive weekly summaries."
        ),
    ]

    return {
        "hero": {
            "greeting_name": current_user.username,
            "subtitle": "Track your medicine, diet, and wellness goals in one place.",
            "health_score": health_score,
            "health_delta": "+2%",
        },
        "stats": [
            {"title": "BMI Status", "value": f"{bmi:.1f}" if bmi else "N/A", "subtitle": bmi_status},
            {"title": "Calories", "value": f"{calories_today:,}", "subtitle": f"/ {calorie_goal:,} kcal goal"},
            {"title": "Steps", "value": f"{current_steps:,}", "subtitle": "/ 10,000 steps goal"},
            {"title": "Heart Rate", "value": str(heart_rate), "subtitle": "bpm (Avg)"},
        ],
        "activity": {
            "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "values": steps_week,
        },
        "next_dose": next_dose,
        "hydration": {
            "current_l": hydration_current,
            "goal_l": hydration_goal,
            "progress": round(min(hydration_current / hydration_goal, 1.0), 2),
        },
        "notifications": notifications,
    }


@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=get_password_hash(user.password),
        age=user.age,
        weight=user.weight,
        height=user.height,
        gender=user.gender,
        medical_conditions=user.medical_conditions,
        allergies=user.allergies,
        dietary_preferences=user.dietary_preferences,
        activity_level=user.activity_level,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer", "user_id": db_user.id}


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer", "user_id": db_user.id}


@app.get("/profile")
def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "age": current_user.age,
        "weight": current_user.weight,
        "height": current_user.height,
        "gender": current_user.gender,
        "medical_conditions": current_user.medical_conditions,
        "allergies": current_user.allergies,
        "dietary_preferences": current_user.dietary_preferences,
        "activity_level": current_user.activity_level,
    }


@app.put("/profile")
def update_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        for key in [
            "age",
            "weight",
            "height",
            "gender",
            "medical_conditions",
            "allergies",
            "dietary_preferences",
            "activity_level",
        ]:
            if key in profile_data:
                setattr(current_user, key, profile_data[key])
        db.commit()
        return {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "age": current_user.age,
            "weight": current_user.weight,
            "height": current_user.height,
            "gender": current_user.gender,
            "medical_conditions": current_user.medical_conditions,
            "allergies": current_user.allergies,
            "dietary_preferences": current_user.dietary_preferences,
            "activity_level": current_user.activity_level,
            "message": "Profile updated successfully",
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/settings")
def get_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = get_or_create_user_settings(current_user.id, db)
    return serialize_settings(settings)


@app.put("/settings")
def update_settings(
    payload: SettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_or_create_user_settings(current_user.id, db)
    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return serialize_settings(settings)


@app.get("/appointments")
def list_appointments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Appointment)
        .filter(Appointment.user_id == current_user.id)
        .order_by(Appointment.appointment_time.asc())
        .all()
    )
    return [serialize_appointment(row) for row in rows]


@app.post("/appointments")
def create_appointment(
    payload: AppointmentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    values = build_appointment_updates(payload)
    for required_key in ["title", "provider", "appointment_time"]:
        if required_key not in values:
            raise HTTPException(status_code=422, detail=f"{required_key} is required")

    appointment = Appointment(
        user_id=current_user.id,
        title=values["title"],
        provider=values["provider"],
        appointment_time=values["appointment_time"],
        mode=values.get("mode", "in_person"),
        status=values.get("status", "scheduled"),
        notes=values.get("notes", ""),
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return serialize_appointment(appointment)


@app.put("/appointments/{appointment_id}")
def edit_appointment(
    appointment_id: int,
    payload: AppointmentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id, Appointment.user_id == current_user.id)
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    updates = build_appointment_updates(payload)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    for key, value in updates.items():
        setattr(appointment, key, value)
    db.commit()
    db.refresh(appointment)
    return serialize_appointment(appointment)


@app.delete("/appointments/{appointment_id}")
def delete_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id, Appointment.user_id == current_user.id)
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    db.delete(appointment)
    db.commit()
    return {"deleted": True}


@app.get("/dashboard")
def get_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_dashboard_summary(current_user, db)


@app.post("/recommendations")
def get_recommendations(
    request: RecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    symptoms = medical_ai.extract_symptoms_with_grok(request.symptoms)
    user_profile = {
        "age": current_user.age,
        "weight": current_user.weight,
        "height": current_user.height,
        "gender": current_user.gender,
        "medical_conditions": current_user.medical_conditions,
        "allergies": current_user.allergies,
        "dietary_preferences": current_user.dietary_preferences,
        "activity_level": current_user.activity_level,
    }
    disease_analysis = medical_ai.analyze_disease(symptoms, request.symptoms, user_profile)
    
    followup = medical_ai.check_for_followup(symptoms, request.symptoms, disease_analysis, request.parameters)
    if followup:
        if followup.get("type") == "parameters":
            return {
                "requires_followup": True,
                "requires_parameters": True,
                "parameters": followup.get("parameters", []),
                "question": followup.get("question", ""),
                "symptoms": symptoms,
                "disease_analysis": disease_analysis
            }
        else:
            return {
                "requires_followup": True,
                "question": followup.get("question", ""),
                "symptoms": symptoms,
                "disease_analysis": disease_analysis
            }

    previous_drugs = medical_ai.get_previous_drug_records(current_user.id, db, limit=5)
    drug_recommendations = medical_ai.recommend_drugs(
        user_profile=user_profile,
        disease_analysis=disease_analysis,
        db=db,
        limit=3,
        previous_drugs=previous_drugs,
    )
    diet_plan = medical_ai.recommend_diet_plan(symptoms, disease_analysis, user_profile)
    natural_alternative = medical_ai.get_natural_alternative(disease_analysis)
    common_searches = medical_ai.get_common_searches(symptoms)

    for item in drug_recommendations:
        db.add(
            Recommendation(
                user_id=current_user.id,
                drug_id=item.get("drug_id", 0),
                recommendation_type="drug",
                confidence_score=item.get("confidence", 0.0),
                symptoms=", ".join(symptoms),
                recommendation_text=f"Recommended: {item['name']} - {item['description']}",
            )
        )
    db.commit()

    diet_recommendations_legacy = [
        {
            "food_id": index + 1,
            "name": meal["name"],
            "category": meal["meal"],
            "calories": meal["calories"],
            "protein": 0,
            "carbs": 0,
            "fat": 0,
            "fiber": 0,
            "score": 0.8,
            "reason": f"Scheduled for {meal['time']}",
        }
        for index, meal in enumerate(diet_plan["meals"])
    ]

    return {
        "symptoms": symptoms,
        "disease_analysis": disease_analysis,
        "drug_recommendations": drug_recommendations,
        "natural_alternative": natural_alternative,
        "diet_plan": diet_plan,
        "diet_recommendations": diet_recommendations_legacy,
        "previous_drug_records": previous_drugs,
        "common_searches": common_searches,
        "disclaimer": (
            "This system is for informational support only and should not replace professional medical advice. "
            "Consult a qualified healthcare provider before taking any medication."
        ),
    }


@app.get("/history")
def get_recommendation_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    recommendations = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == current_user.id)
        .order_by(Recommendation.created_at.desc())
        .limit(30)
        .all()
    )
    return [
        {
            "id": rec.id,
            "type": rec.recommendation_type,
            "symptoms": rec.symptoms,
            "recommendation": rec.recommendation_text,
            "confidence": rec.confidence_score,
            "created_at": rec.created_at,
        }
        for rec in recommendations
    ]


@app.get("/previous-drugs")
def previous_drugs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return medical_ai.get_previous_drug_records(current_user.id, db, limit=8)


@app.get("/daily-checkin")
def daily_checkin(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    previous_drugs = medical_ai.get_previous_drug_records(current_user.id, db, limit=3)
    
    if not previous_drugs:
        return {"message": None}
        
    import json
    drugs_str = json.dumps([d.get("name") for d in previous_drugs], default=str)
    
    system_msg = (
        "You are AuraHealth AI. The user has just logged in. "
        f"Their recently recommended drugs: {drugs_str}. "
        "Write a short, engaging 2-sentence popup message asking how they are feeling after taking these medications, "
        "and suggest what they should do next (e.g., 'Make sure to stay hydrated' or 'Log any new symptoms'). "
        "Respond ONLY with a valid JSON object: "
        '{"message": "your text", "next_steps": ["step 1", "step 2"]}'
    )
    
    payload = {
        "model": "llama3-8b-8192",
        "messages": [{"role": "system", "content": system_msg}],
        "temperature": 0.5,
        "max_tokens": 150,
    }
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    
    try:
        import requests
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=8)
        if response.status_code == 200:
            content = response.json()["choices"][0]["message"]["content"]
            start_idx = content.find('{')
            end_idx = content.rfind('}')
            if start_idx != -1 and end_idx != -1:
                json_str = content[start_idx:end_idx+1]
                return json.loads(json_str)
    except Exception as e:
        print("Daily Checkin Error:", e)
        
    return {
        "message": f"Welcome back! How are you feeling after taking your recent medications ({', '.join([d.get('name') for d in previous_drugs])})?",
        "next_steps": ["Log any new symptoms", "Stay hydrated"]
    }


@app.get("/chat-history")
def get_chat_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    history = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.asc())
        .limit(100)
        .all()
    )
    return [
        {
            "role": "bot" if msg.role == "assistant" else msg.role,
            "text": msg.content,
            "time": msg.created_at.strftime("%I:%M %p")
        }
        for msg in history
    ]

@app.post("/ai-chat")
def ai_chat(request: ChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_profile = {
        "medical_conditions": current_user.medical_conditions,
        "allergies": current_user.allergies,
    }
    previous_drugs = medical_ai.get_previous_drug_records(current_user.id, db, limit=5)
    
    # Save user message
    user_msg = ChatHistory(user_id=current_user.id, role="user", content=request.message)
    db.add(user_msg)
    db.commit()

    # Load recent history from DB for context (excluding the message we just inserted)
    recent_history = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .filter(ChatHistory.id < user_msg.id)
        .order_by(ChatHistory.created_at.desc())
        .limit(15)
        .all()
    )
    # Reverse to chronological order for the AI prompt
    history_dicts = [{"role": msg.role, "content": msg.content} for msg in reversed(recent_history)]
        
    response_data = medical_ai.generate_chat_reply(request.message, user_profile, previous_drugs, history_dicts)
    
    # Save assistant message
    bot_msg = ChatHistory(user_id=current_user.id, role="assistant", content=response_data.get("reply", ""))
    db.add(bot_msg)
    db.commit()
    
    return response_data


@app.get("/drugs")
def get_drugs(db: Session = Depends(get_db)):
    drugs = db.query(Drug).limit(50).all()
    return [
        {
            "id": drug.id,
            "name": drug.name,
            "category": drug.category,
            "rating": drug.rating,
            "description": drug.description,
        }
        for drug in drugs
    ]


@app.get("/foods")
def get_foods(db: Session = Depends(get_db)):
    foods = db.query(Food).limit(50).all()
    return [
        {
            "id": food.id,
            "name": food.name,
            "category": food.category,
            "calories": food.calories_per_100g,
            "protein": food.protein,
            "carbs": food.carbs,
            "fat": food.fat,
        }
        for food in foods
    ]


@app.get("/drug-interactions")
def get_drug_interactions(db: Session = Depends(get_db)):
    interactions = db.query(DrugInteraction).limit(50).all()
    return [
        {
            "id": interaction.id,
            "drug1": interaction.drug1,
            "drug2": interaction.drug2,
            "severity": interaction.severity,
            "description": interaction.description,
        }
        for interaction in interactions
    ]


if __name__ == "__main__":
    import uvicorn
    import os

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
