"""
Mortgage AI Decision System - FastAPI REST API
Exposes the mortgage advisor system as a REST API with database persistence.
Uses ml.predict for all model inference — the single source of truth.
"""

from datetime import datetime
from typing import Optional, List
from contextlib import asynccontextmanager
import sqlite3
import logging
import json
import sys
import os
from pathlib import Path
from logging.handlers import RotatingFileHandler

import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import uuid

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

limiter = Limiter(key_func=get_remote_address)

# ─── Path setup ───────────────────────────────────────────────────────────────
_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_ROOT))

from ml.inference.predict import predict_single, predict_all_models, calculate_emi, MODEL_FEATURES
from ml.utils.features import engineer_features, applicant_to_15_features
from ml.inference.ensemble import MortgageEnsembleModel
from risk_calc import calculate_risk
from monte_carlo import simulate as mc_simulate
from model_router import router as model_router
from shap_router import shap_router
from auth import (
    init_users_table, authenticate_user, create_token, revoke_token,
    get_current_user, get_optional_user, require_role, require_min_role,
    LoginRequest, UserCreate, ResetPasswordRequest, ChangePasswordRequest, get_all_users, 
    create_user_db, update_last_login, reset_password_db, change_password_db,
    toggle_user_status_db, terminate_user_sessions, permanently_delete_user_db
)
from audit_log import (
    init_audit_table, log_action, log_from_request,
    get_audit_logs, get_audit_stats,
)


# =============================================================================
# Structured Logging Setup
# =============================================================================

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)


def setup_logging():
    logger = logging.getLogger("mortgage_api")
    logger.setLevel(logging.INFO)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(JSONFormatter())
    logger.addHandler(console_handler)
    file_handler = RotatingFileHandler(
        "mortgage_api.log", maxBytes=10 * 1024 * 1024, backupCount=5
    )
    file_handler.setFormatter(JSONFormatter())
    logger.addHandler(file_handler)
    return logger


logger = setup_logging()


# =============================================================================
# Response Standardization
# =============================================================================

try:
    import google.generativeai as genai
except ModuleNotFoundError:
    genai = None


# =============================================================================
# Gemini AI Integration
# =============================================================================

def get_gemini_underwriting(application_data: dict, risk_result: dict):
    """
    Get professional underwriting insights from Google Gemini.
    Provides a nuanced 'Expert Opinion' based on raw data and ML findings.
    """
    if genai is None:
        logger.warning("google-generativeai is not installed; skipping Gemini underwriting")
        return None

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_KEY_HERE":
        return None
        
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        As a Senior Mortgage Underwriter, analyze this loan application and provide a concise expert opinion.
        
        APPLICANT DATA:
        - Monthly Income: ${application_data['income']}
        - Loan Amount: ${application_data['loan_amount']}
        - Collateral Value: ${application_data.get('collateral_value', 'N/A')}
        - Credit Score: {application_data['credit_score']}
        - Existing Loans: {application_data['existing_loans']}
        - Region: {application_data.get('region', 'General')}
        
        ML SYSTEM FINDINGS:
        - Risk Level: {risk_result['risk_level']}
        - Default Probability: {risk_result['default_probability']:.2%}
        - Decision Recommendation: {risk_result['decision']}
        
        Provide:
        1. A 2-sentence executive summary.
        2. 3 key risk factors or strengths.
        3. A final 'Expert Verdict' (Approve, Reject, or Further Review).
        
        Format as JSON with keys: "summary", "factors" (list), "verdict".
        """
        
        response = model.generate_content(prompt)
        # Attempt to parse JSON from response
        text = response.text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
            
        return json.loads(text)
    except Exception as e:
        logger.error(f"Gemini AI Underwriting failed: {e}")
        return None


def create_response(data=None, success=True, error=None, request_id=None):
    response = {
        "success": success,
        "request_id": request_id or str(uuid.uuid4())[:8],
        "timestamp": datetime.now().isoformat(),
    }
    if data is not None:
        response["data"] = data
    if error is not None:
        response["error"] = error
    return response


# =============================================================================
# Input Sanitization
# =============================================================================

def sanitize_string(value: str) -> str:
    if not isinstance(value, str):
        return value
    value = value.strip().replace("\x00", "")
    suspicious = ["--", "/*", "*/", ";", "DROP", "SELECT", "INSERT", "DELETE", "UPDATE"]
    for pattern in suspicious:
        if pattern.upper() in value.upper():
            logger.warning(f"Suspicious pattern detected in input: {pattern}")
    return value


# =============================================================================
# Pydantic Models
# =============================================================================

class LoanApplication(BaseModel):
    """Validated loan application input — maps to simple /analyze endpoint."""
    income: float = Field(..., gt=0, description="Monthly income")
    loan_amount: float = Field(..., gt=0, description="Loan amount")
    interest_rate: float = Field(..., gt=0, le=50, description="Annual interest rate %")
    loan_term: int = Field(..., gt=0, le=30, description="Loan term in years")
    credit_score: int = Field(..., ge=300, le=850, description="Credit score 300-850")
    existing_loans: int = Field(default=0, ge=0, description="Number of existing loans")
    collateral_value: Optional[float] = Field(default=None, ge=0, description="Value of property/collateral")
    # Optional extended fields for 15-feature model
    employment_years: Optional[float] = Field(default=None, ge=0)
    num_credit_lines: Optional[int] = Field(default=None, ge=0)
    home_ownership: Optional[int] = Field(default=1, ge=0, le=2)
    purpose_encoded: Optional[int] = Field(default=0, ge=0, le=9)
    num_late_payments: Optional[int] = Field(default=0, ge=0)
    savings_balance: Optional[float] = Field(default=None, ge=0)
    monthly_expenses: Optional[float] = Field(default=None, ge=0)
    # Demographic proxies for bias monitoring
    age_band: Optional[str] = Field(default=None)
    region: Optional[str] = Field(default=None)


    @field_validator("income", "loan_amount", "interest_rate")
    @classmethod
    def reject_nonpositive(cls, v):
        if v <= 0:
            raise ValueError("Value must be positive")
        return v

    @field_validator("credit_score")
    @classmethod
    def validate_credit_score(cls, v):
        if v < 300 or v > 850:
            raise ValueError("Credit score must be between 300 and 850")
        return v


# =============================================================================
# Database Setup
# =============================================================================

DATABASE_PATH = "mortgage.db"


def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            timestamp TEXT NOT NULL,
            income REAL NOT NULL,
            loan_amount REAL NOT NULL,
            collateral_value REAL,
            credit_score INTEGER NOT NULL,
            decision TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            default_probability REAL,
            approval_probability REAL,
            emi REAL NOT NULL,
            model_used TEXT,
            advice TEXT,
            age_band TEXT,
            region TEXT
        )
    """)

    conn.commit()
    try:
        cursor.execute("ALTER TABLE decisions ADD COLUMN collateral_value REAL")
        conn.commit()
    except sqlite3.OperationalError:
        pass
    conn.close()


def save_decision(data: dict):
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO decisions
        (user_id, timestamp, income, loan_amount, collateral_value, credit_score, decision, risk_level,
         default_probability, approval_probability, emi, model_used, advice, age_band, region)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("user_id"), data["timestamp"], data["income"], data["loan_amount"],
        data.get("collateral_value"), data["credit_score"], data["decision"], data["risk_level"],
        data.get("default_probability"), data.get("approval_probability"),
        data["emi"], data.get("model_used"), data.get("advice"),
        data.get("age_band"), data.get("region"),
    ))

    conn.commit()
    conn.close()


def get_history(limit: int = 20, user_id: int = None) -> List[dict]:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if user_id:
        cursor.execute("SELECT * FROM decisions WHERE user_id = ? ORDER BY id DESC LIMIT ?", (user_id, limit))
    else:
        cursor.execute("SELECT * FROM decisions ORDER BY id DESC LIMIT ?", (limit,))
        
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_user_stats(user_id: int = None) -> dict:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Use 1=1 as a base so we can safely append AND clauses
    where_clause = "WHERE 1=1"
    params = []
    if user_id:
        where_clause += " AND user_id = ?"
        params.append(user_id)
    
    params = tuple(params)
    
    # Total count
    cursor.execute(f"SELECT COUNT(*) as total FROM decisions {where_clause}", params)
    total = cursor.fetchone()["total"]
    
    if total == 0:
        conn.close()
        return {
            "total": 0, "approved": 0, "rejected": 0,
            "approvalRate": 0, "avgRisk": 0, "avgLoan": 0, "avgCredit": 0
        }
        
    # Approval rate
    cursor.execute(f"SELECT COUNT(*) as approved FROM decisions {where_clause} AND decision = 'APPROVE'", params)
    approved = cursor.fetchone()["approved"]
    
    # Rejected count
    cursor.execute(f"SELECT COUNT(*) as rejected FROM decisions {where_clause} AND decision = 'REJECT'", params)
    rejected = cursor.fetchone()["rejected"]
    
    # Avg risk, loan, and credit score
    cursor.execute(f"""
        SELECT AVG(default_probability) * 100 as avg_risk, 
               AVG(loan_amount) as avg_loan,
               AVG(credit_score) as avg_credit
        FROM decisions {where_clause}
    """, params)
    row = cursor.fetchone()
    
    conn.close()
    return {
        "total": total,
        "approved": approved,
        "rejected": rejected,
        "approvalRate": (approved / total) * 100,
        "avgRisk": row["avg_risk"] or 0,
        "avgLoan": row["avg_loan"] or 0,
        "avgCredit": round(row["avg_credit"] or 0)
    }


# =============================================================================
# Global State
# =============================================================================

startup_time = datetime.now()
prediction_count = 0
_models_loaded = False
error_log = []
MAX_ERROR_LOG = 100
APP_VERSION = "2.0.0"


def log_error(error_data: dict):
    error_log.insert(0, {"timestamp": datetime.now().isoformat(), "error": error_data})
    if len(error_log) > MAX_ERROR_LOG:
        error_log.pop()


def get_uptime_seconds():
    return int((datetime.now() - startup_time).total_seconds())


def get_memory_usage():
    try:
        import psutil
        return psutil.Process().memory_info().rss / 1024 / 1024
    except ImportError:
        return None


# =============================================================================
# Lifespan
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _models_loaded
    logger.info(f"==================================================")
    logger.info(f"   Mortgage AI Decision System v{APP_VERSION}")
    logger.info(f"==================================================")
    
    try:
        # Initialize resources
        init_db()
        init_users_table()
        init_audit_table()
        
        # Log model status
        from ml.inference.predict import get_model, get_active_model_name, AVAILABLE_MODELS, MODELS_DIR, MODEL_FEATURES
        active = get_active_model_name()
        logger.info(f"[Startup] Active Model Target : {active}")
        logger.info(f"[Startup] Expected Features   : {len(MODEL_FEATURES)}")
        
        for name in AVAILABLE_MODELS:
            path = MODELS_DIR / f"{name}.joblib"
            if path.exists():
                logger.info(f"[Startup] Model Status - {name:15}: READY ({(path.stat().st_size/1024):.1f} KB)")
            else:
                logger.warning(f"[Startup] Model Status - {name:15}: MISSING")
        
        # Warm up model cache
        try:
            get_model(active)
            _models_loaded = True
            logger.info(f"[Startup] Cache Status         : WARMED")
        except Exception as me:
            logger.error(f"[Startup] Cache Status         : FAILED ({str(me)})")
            _models_loaded = False
            
    except Exception as e:
        logger.error(f"[Startup] CRITICAL INITIALIZATION ERROR: {str(e)}")
        log_error({"type": "startup_failure", "msg": str(e)})
    
    logger.info(f"==================================================")
    log_action(action="SYSTEM_START", metadata={"version": APP_VERSION})
    yield
    logger.info("=== Mortgage AI Shutdown ===")


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="Mortgage AI Decision API",
    description="AI-powered mortgage loan approval with real ML models, Monte Carlo simulation, and SHAP explainability",
    version=APP_VERSION,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Request size limit
@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    max_size = 1 * 1024 * 1024
    body = await request.body()
    if len(body) > max_size:
        return JSONResponse(
            status_code=413,
            content={"detail": "Request body too large", "type": "payload_too_large"},
        )
    async def receive():
        return {"type": "http.request", "body": body}
    request._receive = receive
    return await call_next(request)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(model_router, prefix="/api")
app.include_router(shap_router, prefix="/api")


# =============================================================================
# Health Check
# =============================================================================

# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
def health_check():
    db_ok = False
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.execute("SELECT 1").fetchone()
        conn.close()
        db_ok = True
    except Exception:
        pass

    from ml.inference.predict import get_active_model_name, MODELS_DIR
    active_model = get_active_model_name()
    model_files = list(MODELS_DIR.glob("*.joblib")) if MODELS_DIR.exists() else []

    response = {
        "status": "ok",
        "version": APP_VERSION,
        "uptime_seconds": get_uptime_seconds(),
        "models_loaded": _models_loaded,
        "active_model": active_model,
        "model_count": len(model_files),
        "db_connected": db_ok,
        "predictions_served": prediction_count,
    }

    mem = get_memory_usage()
    if mem:
        response["memory_usage_mb"] = round(mem, 2)

    return create_response(data=response)


# =============================================================================
# Analyze Endpoint (Primary Prediction)
# =============================================================================

@app.post("/analyze")
async def analyze_application(
    application: LoanApplication, 
    request: Request, 
    persist: bool = Query(True),
    user: dict = Depends(get_optional_user)
):
    """
    Analyze a loan application with real ML + Monte Carlo simulation.

    Pipeline:
    1. engineer_features() → derived ratio features
    2. applicant_to_15_features() → map to full 15-feature schema
    3. predict_single() → real ML model probability
    4. calculate_risk() → rule-based risk level
    5. mc_simulate() → Monte Carlo default probability
    6. Combine into final decision
    """
    global prediction_count
    logger.info(
        f"Analyzing: income={application.income}, "
        f"loan={application.loan_amount}, credit={application.credit_score}"
    )

    try:
        loan_data = application.model_dump()

        # Step 1: Engineer basic features + compute EMI
        emi = calculate_emi(
            loan_data["loan_amount"],
            loan_data["interest_rate"],
            loan_data["loan_term"] * 12,  # years → months
        )
        loan_data["emi"] = emi
        enriched = engineer_features(loan_data)

        # Step 2: Map to 15-feature schema for ML model
        features_15 = applicant_to_15_features(loan_data)

        # Step 3: ML prediction (with graceful fallback)
        ml_result = None
        model_used = "none"
        try:
            ml_result = predict_single(features_15)
            approval_prob = ml_result["approval_probability"]
            model_used = ml_result["model_used"]
        except FileNotFoundError:
            # No trained models yet — use rule-based fallback
            approval_prob = None
            logger.warning("No ML models found — using rule-based decision only")

        # Step 4: Rule-based risk
        risk_level = calculate_risk(
            loan_data["income"],
            loan_data["loan_amount"],
            loan_data["credit_score"],
            loan_data["existing_loans"],
            emi=emi,
            region=loan_data.get("region", "North"),
            collateral_value=loan_data.get("collateral_value")
        )

        # Step 5: Monte Carlo simulation
        mc_results = mc_simulate(
            {
                "income": loan_data["income"],
                "loan_amount": loan_data["loan_amount"],
                "interest_rate": loan_data["interest_rate"],
                "loan_term": loan_data["loan_term"],
                "credit_score": loan_data["credit_score"],
            },
            n_simulations=5000,
        )

        # Step 6: Final decision — Rule Engine is PRIMARY, ML is secondary signal
        mc_default = mc_results["default_probability"]
        
        # Primary Decision: Rule-based (CIBIL + FOIR + LTI + MC + Collateral)
        if risk_level == "HIGH" or mc_default > 0.50:
            decision = "REJECT"
        elif risk_level == "LOW" and mc_default < 0.20:
            decision = "APPROVE"
        elif risk_level == "MEDIUM" or mc_default < 0.40:
            decision = "CONDITIONAL"
        else:
            decision = "REJECT"

        # Secondary: ML model used only to upgrade/downgrade CONDITIONAL cases
        if approval_prob is not None and decision == "CONDITIONAL":
            if approval_prob >= 0.70:
                decision = "APPROVE"
            elif approval_prob <= 0.10:
                decision = "REJECT"

        # Unified Confidence Bar
        if risk_level == "LOW" and mc_default < 0.10:
            rule_confidence = 0.90
        elif risk_level == "LOW" and mc_default < 0.20:
            rule_confidence = 0.75
        elif risk_level == "MEDIUM":
            rule_confidence = 0.50
        else:
            rule_confidence = 0.15  # HIGH risk

        # Hard caps
        if decision == "REJECT":
            unified_confidence = min(rule_confidence, 0.25)
        elif decision == "APPROVE":
            unified_confidence = max(rule_confidence, 0.70)
        else:  # CONDITIONAL
            unified_confidence = max(0.35, min(rule_confidence, 0.65))

        # Step 7: SHAP Explanation (if model available)
        top_factors = []
        plain_english = []
        if approval_prob is not None:
            try:
                from shap_explainer import explain_decision
                from ml.inference.predict import get_model
                
                clf = get_model(model_used)
                explanation = explain_decision(loan_data, clf, model_used)
                
                # Format for frontend: just the labels
                top_factors = [f["label"] for f in explanation["top_factors"][:5]]
                plain_english = explanation["plain_english"]
            except Exception as e:
                logger.warning(f"SHAP explanation failed: {e}")
                top_factors = ["Credit Score", "LTV Ratio", "Income-to-Loan Ratio"]
                plain_english = []

        # Step 8: Underwriting Insights & Advice (Indian Banking Context)
        advice = []
        
        # Primary Rejection Reason
        if decision == "REJECT":
            if loan_data["credit_score"] < 600:
                advice.insert(0, "CRITICAL: CIBIL score is below the minimum lending threshold.")
            elif enriched["emi_to_income_ratio"] > 60:
                advice.insert(0, "CRITICAL: Debt burden (FOIR) exceeds maximum regulatory limits.")
            elif enriched.get("ltv_ratio", 0) > 95:
                advice.insert(0, "CRITICAL: Loan-to-Value (LTV) exceeds safety margins (too little equity).")
            else:
                advice.insert(0, "CRITICAL: High risk profile detected across multi-factor analysis.")

        if mc_default > 0.20:
            advice.append(f"Monte Carlo risk is {mc_default:.1%} — consider a lower loan amount")
        if risk_level == "HIGH" and decision != "REJECT":
            advice.append("Profile flagged as HIGH RISK based on RBI/Bank norms")
        if loan_data["credit_score"] < 720:
            advice.append("CIBIL score below 720 — aim for 750+ for better rates")
        if enriched["emi_to_income_ratio"] > 45:
            advice.append(f"FOIR (EMI-to-Income) is {enriched['emi_to_income_ratio']:.1f}% — Indian banks prefer under 45-50%")
        
        ltv = enriched.get("ltv_ratio", 0)
        if ltv > 85:
            advice.append(f"LTV is high ({ltv:.1f}%) — higher down payment recommended")
        
        # Step 9: Gemini Expert Underwriting
        gemini_result = get_gemini_underwriting(loan_data, {"risk_level": risk_level, "default_probability": mc_default, "decision": decision})
        if gemini_result:
            plain_english = [gemini_result["summary"]] + gemini_result["factors"]
            advice.append(f"AI Underwriter Verdict: {gemini_result['verdict']}")

        if not plain_english:
            plain_english = advice if advice else ["High-level assessment based on standard risk parameters."]

        # Compile response
        response_data = {
            "timestamp": datetime.now().isoformat(),
            "decision": decision,
            "emi": emi,
            "risk_level": risk_level,
            "default_probability": mc_results["default_probability"],
            "approval_probability": round(unified_confidence, 4),
            "model_used": model_used,
            "advice": "; ".join(advice),
            "top_factors": top_factors,
            "plain_english": plain_english,
            "ai_advice": bool(gemini_result),
            "visual_score": (
                90 if decision == "REJECT" else 
                50 if decision == "CONDITIONAL" else 
                min(30, mc_results["default_probability"] * 100)
            ),
            "feature_values": {
                "debt_to_income_ratio": enriched["debt_to_income_ratio"],
                "emi_to_income_ratio": enriched["emi_to_income_ratio"],
                "ltv_ratio": enriched.get("ltv_ratio"),
                "affordability_score": enriched["affordability_score"],
            },
            "monte_carlo": {
                "worst_case_emi": mc_results["worst_case_emi"],
                "safe_income_threshold": mc_results["safe_income_threshold"],
                "scenario_breakdown": mc_results["scenario_breakdown"],
                "mean_emi_ratio": mc_results["mean_emi_ratio"],
            },
        }

        # Persist to DB only if requested
        if persist:
            save_decision({
                "user_id": user.get("user_id") if user else None,
                "timestamp": response_data["timestamp"],
                "income": loan_data["income"],
                "loan_amount": loan_data["loan_amount"],
                "collateral_value": loan_data.get("collateral_value"),
                "credit_score": loan_data["credit_score"],
                "decision": decision,
                "risk_level": risk_level,
                "default_probability": mc_results["default_probability"],
                "approval_probability": approval_prob,
                "emi": emi,
                "model_used": model_used,
                "advice": response_data["advice"],
                "age_band": loan_data.get("age_band"),
                "region": loan_data.get("region"),
            })

            prediction_count += 1
            
            # Audit log
            log_from_request(
                request, action="PREDICT", user=user,
                target_type="application", target_id=str(prediction_count),
                after_value={"decision": decision, "risk_level": risk_level,
                             "default_probability": mc_default, "model_used": model_used},
                metadata={"income": loan_data["income"], "loan_amount": loan_data["loan_amount"],
                          "credit_score": loan_data["credit_score"]},
            )
        else:
            logger.info("Simulation mode: Skipping database persistence")

        return create_response(data=response_data)

    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# =============================================================================
# History Endpoint
# =============================================================================

@app.get("/history")
def get_decisions_history(
    limit: int = Query(default=20, le=100, ge=1),
    user: dict = Depends(get_current_user)
):
    try:
        # Admins see everything, others see only their own
        search_user_id = None if user["role"] == "admin" else user["user_id"]
        history = get_history(limit, search_user_id)
        return create_response(data=history)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve history: {str(e)}")


@app.get("/api/dashboard/stats")
def get_dashboard_stats(user: dict = Depends(get_current_user)):
    try:
        search_user_id = None if user["role"] == "admin" else user["user_id"]
        stats = get_user_stats(search_user_id)
        return create_response(data=stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve stats: {str(e)}")


@app.delete("/api/data/delete/{decision_id}")
def delete_decision(decision_id: int, user: dict = Depends(get_current_user)):
    """Allow admins to delete any record, or users to delete their own."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        # First, check if the record exists and who it belongs to
        cursor.execute("SELECT user_id FROM decisions WHERE id = ?", (decision_id,))
        result = cursor.fetchone()
        
        if not result:
            logger.warning(f"Deletion failed: Decision {decision_id} not found")
            raise HTTPException(status_code=404, detail="Record not found")
            
        record_owner_id = result[0]
        
        # Authorization check: Admin or the owner
        if user["role"] != "admin" and record_owner_id != user.get("user_id"):
            logger.warning(f"Unauthorized deletion attempt by user {user.get('user_id')} on record {decision_id}")
            raise HTTPException(status_code=403, detail="Not authorized to delete this record")

        # Perform deletion
        cursor.execute("DELETE FROM decisions WHERE id = ?", (decision_id,))
        conn.commit()
        
        logger.info(f"Successfully deleted decision {decision_id}")
        
        # Audit logging
        log_action(
            action="DATA_DELETION", 
            user_id=user.get("user_id"), 
            username=user.get("username"),
            user_role=user.get("role"),
            target_type="decision", 
            target_id=str(decision_id),
            metadata={"decision_id": decision_id, "reason": "User request"}
        )
        
        return create_response(data={"message": f"Record {decision_id} deleted successfully"})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting decision {decision_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.delete("/history/clear")
def clear_my_history(user: dict = Depends(get_current_user)):
    """Allow any authenticated user to delete ALL of their own prediction history."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    try:
        if user["role"] == "admin":
            # Admins clear everything
            cursor.execute("DELETE FROM decisions")
            logger.info("Admin cleared ALL history records")
        else:
            # Regular users clear only their own
            cursor.execute("DELETE FROM decisions WHERE user_id = ?", (user["user_id"],))
            logger.info(f"User {user['user_id']} cleared their history")
            
        deleted_count = cursor.rowcount
        conn.commit()
        
        log_action(
            action="HISTORY_CLEAR",
            user_id=user.get("user_id"),
            username=user.get("username"),
            user_role=user.get("role"),
            metadata={"deleted_count": deleted_count, "scope": "all" if user["role"] == "admin" else "own"}
        )
        return create_response(data={"message": f"Cleared {deleted_count} record(s) from history", "deleted_count": deleted_count})
    except Exception as e:
        logger.error(f"Error clearing history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()


@app.delete("/history/bulk-delete")
def bulk_delete_history(ids: List[int] = Query(...), user: dict = Depends(get_current_user)):
    """Allow users to delete specific selected records from their own history."""
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    try:
        placeholders = ",".join("?" * len(ids))
        if user["role"] == "admin":
            cursor.execute(f"DELETE FROM decisions WHERE id IN ({placeholders})", ids)
        else:
            # Crucial: Ensure user_id matches for non-admins
            cursor.execute(
                f"DELETE FROM decisions WHERE id IN ({placeholders}) AND user_id = ?",
                ids + [user["user_id"]]
            )
        
        deleted_count = cursor.rowcount
        conn.commit()
        
        logger.info(f"Bulk deleted {deleted_count} records (requested {len(ids)})")

        log_action(
            action="HISTORY_BULK_DELETE",
            user_id=user.get("user_id"),
            username=user.get("username"),
            user_role=user.get("role"),
            metadata={"ids": ids, "deleted_count": deleted_count}
        )
        return create_response(data={"message": f"Deleted {deleted_count} record(s)", "deleted_count": deleted_count})
    except Exception as e:
        logger.error(f"Error in bulk delete: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/api/analytics/fairness")
def get_fairness_metrics(user: dict = Depends(get_current_user)):
    """Monitor approval rates by demographic proxies for bias detection."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Approval rate by Age Band
    cursor.execute("""
        SELECT age_band, 
               COUNT(*) as total, 
               SUM(CASE WHEN decision = 'APPROVE' THEN 1 ELSE 0 END) as approved
        FROM decisions 
        WHERE age_band IS NOT NULL
        GROUP BY age_band
    """)
    age_stats = [dict(r) for r in cursor.fetchall()]
    for s in age_stats:
        s["approval_rate"] = s["approved"] / s["total"] if s["total"] > 0 else 0
        
    # Approval rate by Region
    cursor.execute("""
        SELECT region, 
               COUNT(*) as total, 
               SUM(CASE WHEN decision = 'APPROVE' THEN 1 ELSE 0 END) as approved
        FROM decisions 
        WHERE region IS NOT NULL
        GROUP BY region
    """)
    region_stats = [dict(r) for r in cursor.fetchall()]
    for s in region_stats:
        s["approval_rate"] = s["approved"] / s["total"] if s["total"] > 0 else 0
        
    conn.close()
    
    return create_response(data={
        "by_age": age_stats,
        "by_region": region_stats,
        "timestamp": datetime.now().isoformat()
    })



# =============================================================================
# Auth Endpoints
# =============================================================================

@app.post("/auth/login")
@limiter.limit("5/minute")
async def login(body: LoginRequest, request: Request):
    """Secure login with role identification via password prefix."""
    # Logic to identify and verify role level during login as requested
    provided_password = body.password
    expected_role = None
    
    if provided_password.startswith("ADMIN_"):
        expected_role = "admin"
        provided_password = provided_password[6:]
    elif provided_password.startswith("UW_"):
        expected_role = "underwriter"
        provided_password = provided_password[3:]
    else:
        expected_role = "loan_officer"

    try:
        user = authenticate_user(body.username, provided_password)
        
        # Verify that the person logging in matches the level identified by the password prefix
        if user["role"] != expected_role:
            log_action(action="LOGIN_ROLE_MISMATCH", 
                       metadata={"username": body.username, "expected": expected_role, "actual": user["role"]},
                       ip_address=request.client.host if request.client else "unknown")
            raise HTTPException(status_code=403, detail=f"Access Level Mismatch. Please use the correct prefix for your level.")
            
    except HTTPException as e:
        # Log failed attempt if it was a 401 or 429
        log_action(action="LOGIN_FAILED", metadata={"username": body.username, "reason": str(e.detail)},
                   ip_address=request.client.host if request.client else "unknown")
        raise e

    token = create_token(user["id"], user["username"], user["role"])
    update_last_login(user["id"])
    log_action(action="LOGIN", user_id=user["id"], username=user["username"],
               user_role=user["role"],
               ip_address=request.client.host if request.client else "unknown")

    return create_response(data={
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email"),
            "role": user["role"],
            "full_name": user["full_name"],
            "created_at": user["created_at"],
            "last_login": user["last_login"],
        }
    })



@app.post("/auth/logout")
async def logout(request: Request, user: dict = Depends(get_current_user)):
    # Revoke token from Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        revoke_token(auth_header[7:])
    log_from_request(request, action="LOGOUT", user=user)
    return create_response(data={"status": "logged_out"})


@app.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    # The user dict here comes from token store. 
    # To get latest data, we should fetch from DB.
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, role, full_name, created_at, last_login FROM users WHERE id = ?", (user["user_id"],))
    db_user = cursor.fetchone()
    conn.close()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return create_response(data=dict(db_user))


@app.get("/auth/users")
async def list_users(user: dict = Depends(require_role("admin"))):
    users = get_all_users()
    return create_response(data=users)


@app.post("/auth/change-password")
async def change_password(body: ChangePasswordRequest, request: Request, user: dict = Depends(get_current_user)):
    """Allow logged-in users to change their own password."""
    change_password_db(user["user_id"], body.current_password, body.new_password)
    log_from_request(request, action="PASSWORD_CHANGE", user=user)
    return create_response(data={"message": "Password updated successfully"})


@app.post("/auth/users")
async def create_user(body: UserCreate, request: Request, user: dict = Depends(require_role("admin"))):
    new_user = create_user_db(body)
    log_from_request(request, action="USER_CREATE", user=user,
                     target_type="user", target_id=str(new_user["id"]),
                     after_value={"username": new_user["username"], "email": new_user.get("email"), "role": new_user["role"]})
    return create_response(data=new_user)


@app.post("/auth/register")
async def register_user(body: UserCreate, request: Request):
    """Public registration endpoint with role identification via password prefix."""
    # Role identification logic based on user request: "added initial for the password"
    if body.password.startswith("ADMIN_"):
        body.role = "admin"
        body.password = body.password[6:] # Strip "ADMIN_"
    elif body.password.startswith("UW_"):
        body.role = "underwriter"
        body.password = body.password[3:] # Strip "UW_"
    else:
        body.role = "loan_officer"
    
    try:
        new_user = create_user_db(body)
        log_action(action="USER_REGISTER", metadata={"username": new_user["username"], "email": new_user.get("email")},
                   ip_address=request.client.host if request.client else "unknown")
        return create_response(data=new_user)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")


@app.post("/auth/reset-password")
async def reset_password(body: ResetPasswordRequest, request: Request):
    """Public endpoint to reset password with verification."""
    try:
        reset_password_db(body)
        log_action(action="PASSWORD_RESET", metadata={"username": body.username},
                   ip_address=request.client.host if request.client else "unknown")
        return create_response(data={"message": "Password reset successfully"})
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Password reset failed: {e}")
        raise HTTPException(status_code=500, detail="Password reset failed")


# =============================================================================
# Audit Log Endpoints (Admin Only)
# =============================================================================

@app.get("/audit")
async def get_audit(
    limit: int = Query(default=50, le=200, ge=1),
    offset: int = Query(default=0, ge=0),
    user_id: Optional[int] = Query(default=None),
    action: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    user: dict = Depends(require_role("admin")),
):
    logs = get_audit_logs(limit=limit, offset=offset, user_id=user_id,
                          action=action, date_from=date_from, date_to=date_to)
    return create_response(data=logs)


@app.get("/audit/stats")
async def audit_stats(user: dict = Depends(require_role("admin"))):
    stats = get_audit_stats()
    return create_response(data=stats)


# =============================================================================
# Admin User Controls (God Mode)
# =============================================================================

@app.post("/admin/users/{target_user_id}/toggle-status")
async def admin_toggle_user(target_user_id: int, request: Request, user: dict = Depends(require_role("admin"))):
    success = toggle_user_status_db(target_user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    
    log_from_request(request, action="ADMIN_USER_TOGGLE", user=user,
                     target_type="user", target_id=str(target_user_id))
    return create_response(data={"message": "User status toggled"})


@app.post("/admin/users/{target_user_id}/terminate")
async def admin_terminate_user(target_user_id: int, request: Request, user: dict = Depends(require_role("admin"))):
    terminate_user_sessions(target_user_id)
    log_from_request(request, action="ADMIN_USER_TERMINATE", user=user,
                     target_type="user", target_id=str(target_user_id))
    return create_response(data={"message": "User sessions terminated"})


@app.get("/admin/user-stats/{target_user_id}")
async def admin_get_user_stats(target_user_id: int, user: dict = Depends(require_role("admin"))):
    stats = get_user_stats(target_user_id)
    return create_response(data=stats)


@app.delete("/admin/users/{target_user_id}")
async def admin_delete_user(target_user_id: int, request: Request, user: dict = Depends(require_role("admin"))):
    """Permanently delete user and blacklist their identifiers."""
    success = permanently_delete_user_db(target_user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    
    log_from_request(request, action="ADMIN_USER_DELETE", user=user,
                     target_type="user", target_id=str(target_user_id))
    return create_response(data={"message": "User permanently deleted and blacklisted"})


# =============================================================================
# What-If Risk Simulator
# =============================================================================

class WhatIfRequest(BaseModel):
    """What-if simulation: original inputs + one or more modified fields."""
    # Original application
    income: float = Field(..., gt=0)
    loan_amount: float = Field(..., gt=0)
    interest_rate: float = Field(..., gt=0, le=50)
    loan_term: int = Field(..., gt=0, le=30)
    credit_score: int = Field(..., ge=300, le=850)
    existing_loans: int = Field(default=0, ge=0)
    # Modified scenario
    new_income: Optional[float] = Field(default=None, gt=0)
    new_loan_amount: Optional[float] = Field(default=None, gt=0)
    new_interest_rate: Optional[float] = Field(default=None, gt=0, le=50)
    new_credit_score: Optional[int] = Field(default=None, ge=300, le=850)
    new_existing_loans: Optional[int] = Field(default=None, ge=0)
    new_loan_term: Optional[int] = Field(default=None, gt=0, le=30)


def _run_risk_pipeline(params: dict) -> dict:
    """Run the full risk pipeline on a set of parameters and return results."""
    emi = calculate_emi(params["loan_amount"], params["interest_rate"], params["loan_term"] * 12)
    params["emi"] = emi
    enriched = engineer_features(params)

    features_15 = applicant_to_15_features(params)
    ml_result = None
    approval_prob = None
    model_used = "none"
    try:
        ml_result = predict_single(features_15)
        approval_prob = ml_result["approval_probability"]
        model_used = ml_result["model_used"]
    except FileNotFoundError:
        pass

    risk_level = calculate_risk(params["income"], params["loan_amount"],
                                params["credit_score"], params["existing_loans"], 
                                emi=emi, region=params.get("region", "North"))

    mc_results = mc_simulate({
        "income": params["income"], "loan_amount": params["loan_amount"],
        "interest_rate": params["interest_rate"], "loan_term": params["loan_term"],
        "credit_score": params["credit_score"],
    }, n_simulations=3000)

    mc_default = mc_results["default_probability"]
    if risk_level == "HIGH" or mc_default > 0.35:
        decision = "REJECT"
    elif risk_level == "LOW" and mc_default < 0.15:
        decision = "APPROVE" if (approval_prob is None or approval_prob > 0.5) else "CONDITIONAL"
    else:
        decision = "CONDITIONAL"

    if approval_prob is not None:
        if approval_prob >= 0.80 and decision == "CONDITIONAL":
            decision = "APPROVE"
        elif approval_prob <= 0.20 and decision == "CONDITIONAL":
            decision = "REJECT"

    return {
        "decision": decision,
        "risk_level": risk_level,
        "default_probability": mc_default,
        "approval_probability": approval_prob,
        "emi": emi,
        "model_used": model_used,
        "feature_values": {
            "debt_to_income_ratio": enriched["debt_to_income_ratio"],
            "emi_to_income_ratio": enriched["emi_to_income_ratio"],
            "credit_utilization_score": enriched.get("credit_utilization_score", 0),
            "loan_burden_index": enriched.get("loan_burden_index", 0),
            "affordability_score": enriched.get("affordability_score", 0),
        },
    }


@app.post("/whatif")
async def whatif_simulator(body: WhatIfRequest, request: Request, user: dict = Depends(get_optional_user)):
    """
    Run the original scenario and a modified scenario side-by-side.
    Returns both results + deltas for every metric.
    """
    try:
        original_params = {
            "income": body.income, "loan_amount": body.loan_amount,
            "interest_rate": body.interest_rate, "loan_term": body.loan_term,
            "credit_score": body.credit_score, "existing_loans": body.existing_loans,
        }

        modified_params = {
            "income": body.new_income or body.income,
            "loan_amount": body.new_loan_amount or body.loan_amount,
            "interest_rate": body.new_interest_rate or body.interest_rate,
            "loan_term": body.new_loan_term or body.loan_term,
            "credit_score": body.new_credit_score or body.credit_score,
            "existing_loans": body.new_existing_loans if body.new_existing_loans is not None else body.existing_loans,
        }

        original_result = _run_risk_pipeline(original_params)
        modified_result = _run_risk_pipeline(modified_params)

        # Compute deltas
        deltas = {
            "default_probability": (modified_result["default_probability"] or 0) - (original_result["default_probability"] or 0),
            "approval_probability": (modified_result["approval_probability"] or 0) - (original_result["approval_probability"] or 0),
            "emi": modified_result["emi"] - original_result["emi"],
            "decision_changed": modified_result["decision"] != original_result["decision"],
            "risk_level_changed": modified_result["risk_level"] != original_result["risk_level"],
        }

        # Which factors improved / worsened
        factor_changes = []
        for key in modified_result["feature_values"]:
            orig_val = original_result["feature_values"].get(key, 0) or 0
            mod_val = modified_result["feature_values"].get(key, 0) or 0
            if abs(mod_val - orig_val) > 0.5:
                factor_changes.append({
                    "factor": key,
                    "original": round(orig_val, 2),
                    "modified": round(mod_val, 2),
                    "delta": round(mod_val - orig_val, 2),
                    "direction": "improved" if mod_val < orig_val else "worsened",
                })

        log_from_request(request, action="WHATIF_SIMULATE", user=user,
                         metadata={"original_params": original_params, "modified_params": modified_params})

        return create_response(data={
            "original": original_result,
            "modified": modified_result,
            "deltas": deltas,
            "factor_changes": factor_changes,
            "changes_applied": {k: v for k, v in {
                "income": body.new_income, "loan_amount": body.new_loan_amount,
                "interest_rate": body.new_interest_rate, "credit_score": body.new_credit_score,
                "existing_loans": body.new_existing_loans, "loan_term": body.new_loan_term,
            }.items() if v is not None},
        })

    except Exception as e:
        logger.error(f"What-if simulation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")


# =============================================================================
# Compare Endpoint
# =============================================================================

@app.get("/compare")
def compare_loan_amounts(
    income: float = Query(..., gt=0),
    loan_amount: float = Query(..., gt=0),
    credit_score: int = Query(..., ge=300, le=850),
):
    """Compare LOW / MEDIUM / HIGH loan amounts for the same applicant."""
    try:
        multipliers = {"low": 0.5, "medium": 1.0, "high": 1.5}
        results = {}

        for label, mult in multipliers.items():
            amt = round(loan_amount * mult, 2)
            emi = calculate_emi(amt, 8.5, 60)  # 8.5% / 5yr default
            risk = calculate_risk(income, amt, credit_score, 0)
            mc = mc_simulate(
                {"income": income, "loan_amount": amt,
                 "interest_rate": 8.5, "loan_term": 5, "credit_score": credit_score},
                n_simulations=3000,
            )

            if risk == "HIGH" or mc["default_probability"] > 0.35:
                decision = "REJECT"
            elif risk == "LOW" and mc["default_probability"] < 0.15:
                decision = "APPROVE"
            else:
                decision = "CONDITIONAL"

            results[label] = {
                "loan_amount": amt,
                "decision": decision,
                "emi": emi,
                "risk_level": risk,
                "default_probability": mc["default_probability"],
                "worst_case_emi": mc["worst_case_emi"],
            }

        return create_response(data={
            "income": income,
            "credit_score": credit_score,
            "comparison": results,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


# =============================================================================
# Error Reporting
# =============================================================================

class ErrorReport(BaseModel):
    message: str = Field(..., max_length=1000)
    stack: Optional[str] = Field(None, max_length=5000)
    url: Optional[str] = Field(None, max_length=500)
    user_agent: Optional[str] = Field(None, max_length=500)


@app.post("/errors")
def report_error(report: ErrorReport):
    log_error(report.model_dump(exclude_none=True))
    logger.warning(f"Client error: {report.message[:200]}")
    return create_response(data={"status": "logged"})


@app.get("/errors")
def get_errors(limit: int = Query(default=20, le=100, ge=1)):
    return create_response(data=error_log[:limit])


# =============================================================================
# Exception Handlers
# =============================================================================

@app.exception_handler(HTTPException)
def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "type": "http_error"},
    )


@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({"field": field, "message": error["msg"], "type": error["type"]})
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation failed", "type": "validation_error", "errors": errors},
    )


@app.exception_handler(sqlite3.Error)
def sqlite_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Database error", "type": "database_error"},
    )


@app.exception_handler(Exception)
def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": "internal_error"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)