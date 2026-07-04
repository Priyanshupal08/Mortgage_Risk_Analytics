"""
Model Router — manages model switching, comparison, and feature importance.
Uses ml.predict as the unified inference layer.
"""

from pathlib import Path
from typing import Optional
import json
import sys
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import joblib

_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_ROOT))

from ml.inference.predict import (
    get_model, get_active_model_name, predict_all_models,
    prepare_features, MODEL_FEATURES, AVAILABLE_MODELS, MODELS_DIR,
)

router = APIRouter(tags=["models"])

COMPARISON_REPORT = MODELS_DIR / "comparison_report.json"
BEST_MODEL_NAME   = MODELS_DIR / "best_model_name.txt"


# ─── Schema ────────────────────────────────────────────────────────────────────

class ApplicantForComparison(BaseModel):
    credit_score:          float = Field(..., ge=300, le=850)
    annual_income:         float = Field(..., ge=0)
    loan_amount:           float = Field(..., ge=1000)
    loan_term:             int   = Field(36, ge=12, le=360)
    dti_ratio:             float = Field(..., ge=0, le=1)
    employment_years:      float = Field(2.0, ge=0)
    num_credit_lines:      int   = Field(3, ge=0)
    num_derogatory_marks:  int   = Field(0, ge=0)
    credit_utilization:    float = Field(0.3, ge=0, le=1)
    payment_history_score: float = Field(0.9, ge=0, le=1)
    home_ownership:        int   = Field(1, ge=0, le=2)
    purpose_encoded:       int   = Field(0, ge=0, le=9)
    num_late_payments:     int   = Field(0, ge=0)
    savings_balance:       float = Field(5000, ge=0)
    monthly_expenses:      float = Field(2000, ge=0)


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/models")
def list_models():
    """List all available models and which is active."""
    active = get_active_model_name()
    models_info = []
    for name in AVAILABLE_MODELS:
        path = MODELS_DIR / f"{name}.joblib"
        models_info.append({
            "name": name,
            "available": path.exists(),
            "active": name == active,
            "size_mb": round(path.stat().st_size / 1024 / 1024, 2) if path.exists() else None,
        })
    return {
        "models": models_info,
        "active_model": active,
        "models_dir": str(MODELS_DIR),
    }


@router.get("/models/comparison")
def get_comparison():
    """Return last training comparison report."""
    if not COMPARISON_REPORT.exists():
        return {
            "best_model": "xgboost",
            "models": {
                "randomforest": {"accuracy": 0.912, "f1": 0.895, "auc": 0.941},
                "xgboost": {"accuracy": 0.935, "f1": 0.918, "auc": 0.962},
                "lightgbm": {"accuracy": 0.928, "f1": 0.906, "auc": 0.955},
            },
            "timestamp": "2026-05-03T12:00:00",
            "is_mock": True
        }
    with open(COMPARISON_REPORT) as f:
        return json.load(f)



@router.post("/models/switch/{model_name}")
def switch_model(model_name: str):
    """Switch the active model."""
    model_name = model_name.lower().replace(" ", "")
    if model_name not in AVAILABLE_MODELS:
        raise HTTPException(400, f"Unknown model. Choose from: {AVAILABLE_MODELS}")
    path = MODELS_DIR / f"{model_name}.joblib"
    if not path.exists():
        raise HTTPException(404, f"Model '{model_name}' not trained yet. Run 'python -m ml.retrain'.")

    BEST_MODEL_NAME.write_text(model_name)
    # Clear cache so next prediction loads the new model
    from ml.inference.predict import clear_cache
    clear_cache()

    return {"message": f"Active model switched to '{model_name}'", "active_model": model_name}


@router.get("/models/feature-importance/{model_name}")
def get_feature_importance(model_name: str):
    """Return feature importances for a model from the comparison report."""
    model_name = model_name.lower().replace(" ", "")
    if not COMPARISON_REPORT.exists():
        raise HTTPException(404, "No comparison report. Run training first.")

    with open(COMPARISON_REPORT) as f:
        report = json.load(f)

    # Match by normalized name
    importance_dict = report.get("importance", {})
    match = None
    for key in importance_dict:
        if key.lower().replace(" ", "") == model_name:
            match = importance_dict[key]
            break

    if match is None:
        raise HTTPException(404, f"No importance data for '{model_name}'")

    # Sort by importance descending
    sorted_pairs = sorted(match.items(), key=lambda x: x[1], reverse=True)
    return {
        "model": model_name,
        "feature_importance": dict(sorted_pairs),
        "feature_names": [p[0] for p in sorted_pairs],
        "values": [p[1] for p in sorted_pairs],
    }


@router.post("/analyze/compare")
def compare_all_models(applicant: ApplicantForComparison):
    """Score applicant through ALL trained models and return consensus."""
    applicant_dict = applicant.model_dump()
    try:
        result = predict_all_models(applicant_dict)
        return result
    except FileNotFoundError as e:
        raise HTTPException(404, detail=str(e))
    except Exception as e:
        raise HTTPException(500, detail=f"Comparison failed: {str(e)}")