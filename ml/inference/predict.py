"""
Unified Prediction Module for Mortgage AI
==========================================
Single entry point for ALL model inference — used by api.py, model_router.py,
and shap_router.py. Ensures consistent feature ordering and model loading.

Usage:
    from ml.inference.predict import predict_single, get_model, MODEL_FEATURES

    result = predict_single(applicant_dict)
    result = predict_single(applicant_dict, model_name="lightgbm")
"""

import os
import logging
from typing import Dict, Optional, List
from pathlib import Path

import numpy as np
import pandas as pd
import joblib

logger = logging.getLogger(__name__)

# ─── Single source of truth: feature schema ──────────────────────────────────
# These 15 features are produced by data/pipeline.py and consumed by all models.
# Order matters — models were trained with this exact column order.

MODEL_FEATURES: List[str] = [
    "credit_score",
    "annual_income",
    "loan_amount",
    "loan_term",
    "dti_ratio",
    "employment_years",
    "num_credit_lines",
    "num_derogatory_marks",
    "credit_utilization",
    "payment_history_score",
    "home_ownership",
    "purpose_encoded",
    "num_late_payments",
    "savings_balance",
    "monthly_expenses",
    "collateral_value",
]

FEATURE_LABELS: Dict[str, str] = {
    "credit_score":          "Credit Score",
    "annual_income":         "Annual Income",
    "loan_amount":           "Loan Amount",
    "loan_term":             "Loan Term (months)",
    "dti_ratio":             "Debt-to-Income Ratio",
    "employment_years":      "Employment History (years)",
    "num_credit_lines":      "Open Credit Lines",
    "num_derogatory_marks":  "Derogatory Marks",
    "credit_utilization":    "Credit Utilization",
    "payment_history_score": "Payment History Score",
    "home_ownership":        "Home Ownership",
    "purpose_encoded":       "Loan Purpose",
    "num_late_payments":     "Late Payments (12mo)",
    "savings_balance":       "Savings Balance",
    "monthly_expenses":      "Monthly Expenses",
    "collateral_value":      "Collateral Value",
}

# Available model names (lowercase, no spaces)
AVAILABLE_MODELS = ["logisticregression", "xgboost", "lightgbm", "ensemble"]

# ─── Project root detection ──────────────────────────────────────────────────
# Works whether called from project root or from ml/ subdirectory

def _project_root() -> Path:
    """Resolve the project root directory."""
    # ml/predict.py is at <root>/ml/predict.py
    candidate = Path(__file__).resolve().parent.parent
    if (candidate / "models").is_dir():
        return candidate
    # Fallback: current working directory
    return Path.cwd()


MODELS_DIR = _project_root() / "models"


# ─── Model cache ─────────────────────────────────────────────────────────────

_model_cache: Dict[str, object] = {}


def get_model(name: str = "auto") -> object:
    """
    Load a trained model by name. Uses cache after first load.

    Args:
        name: Model name ('xgboost', 'lightgbm', 'logisticregression', or 'auto')
              'auto' loads the active/best model.

    Returns:
        Trained scikit-learn compatible model

    Raises:
        FileNotFoundError: If model file doesn't exist
    """
    if name == "auto":
        name = get_active_model_name()

    name = name.lower().replace(" ", "")
    if name not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown model '{name}'. Choose from: {AVAILABLE_MODELS}")

    if name not in _model_cache:
        path = MODELS_DIR / f"{name}.joblib"
        if not path.exists():
            raise FileNotFoundError(
                f"Model file not found: {path}\n"
                f"Run 'python -m ml.train' to train models first."
            )
        _model_cache[name] = joblib.load(path)
        logger.info(f"Loaded model: {name} from {path}")

    return _model_cache[name]


def get_active_model_name() -> str:
    """Read the active model name from models/best_model_name.txt."""
    txt_path = MODELS_DIR / "best_model_name.txt"
    if txt_path.exists():
        return txt_path.read_text().strip().lower().replace(" ", "")
    return "xgboost"  # sensible default


def clear_cache():
    """Clear the model cache (e.g., after retraining)."""
    _model_cache.clear()
    logger.info("Model cache cleared")


# ─── Feature preparation ────────────────────────────────────────────────────

def prepare_features(applicant: Dict) -> pd.DataFrame:
    """
    Convert raw applicant dict into a model-ready DataFrame.

    Fills missing features with sensible defaults. Guarantees exact column
    ordering expected by trained models.

    Args:
        applicant: Dictionary with applicant data. Keys should match MODEL_FEATURES.

    Returns:
        DataFrame with shape (1, 15) in exact MODEL_FEATURES order
    """
    # Defaults for optional fields
    defaults = {
        "credit_score": 650,
        "annual_income": 50000,
        "loan_amount": 100000,
        "loan_term": 36,
        "dti_ratio": 0.3,
        "employment_years": 2.0,
        "num_credit_lines": 3,
        "num_derogatory_marks": 0,
        "credit_utilization": 0.3,
        "payment_history_score": 0.9,
        "home_ownership": 1,
        "purpose_encoded": 0,
        "num_late_payments": 0,
        "savings_balance": 5000,
        "monthly_expenses": 2000,
        "collateral_value": 150000,
    }

    row = {}
    for feat in MODEL_FEATURES:
        val = applicant.get(feat, defaults.get(feat, 0))
        row[feat] = float(val)

    return pd.DataFrame([row], columns=MODEL_FEATURES)


# ─── Prediction ──────────────────────────────────────────────────────────────

def predict_single(
    applicant: Dict,
    model_name: str = "auto",
    threshold: float = 0.5,
) -> Dict:
    """
    Score a single applicant and return decision + probability.

    Args:
        applicant: Dictionary with applicant features
        model_name: Model to use ('auto', 'xgboost', 'lightgbm', 'logisticregression')
        threshold: Decision threshold (default 0.5)

    Returns:
        Dict with keys:
            decision: 'approved' | 'rejected'
            approval_probability: float (0-1)
            default_probability: float (0-1)
            risk_level: 'low' | 'medium' | 'high' | 'critical'
            model_used: str
    """
    model = get_model(model_name)
    X = prepare_features(applicant)

    prob_default = float(model.predict_proba(X)[0][1])
    prob_approve = 1.0 - prob_default
    
    decision = "approved" if prob_approve >= threshold else "rejected"

    risk_level = (
        "low"      if prob_approve >= 0.75 else
        "medium"   if prob_approve >= 0.50 else
        "high"     if prob_approve >= 0.25 else
        "critical"
    )

    actual_name = model_name if model_name != "auto" else get_active_model_name()

    return {
        "decision": decision,
        "approval_probability": round(prob_approve, 4),
        "default_probability": round(prob_default, 4),
        "risk_level": risk_level,
        "model_used": actual_name,
    }


def predict_all_models(
    applicant: Dict,
    threshold: float = 0.5,
) -> Dict:
    """
    Score one applicant through ALL available models.

    Returns:
        Dict with per-model results and consensus info
    """
    results = {}
    for name in AVAILABLE_MODELS:
        try:
            results[name] = predict_single(applicant, model_name=name, threshold=threshold)
        except FileNotFoundError:
            logger.warning(f"Model '{name}' not available, skipping")
            continue

    if not results:
        raise FileNotFoundError("No trained models found. Run 'python -m ml.train' first.")

    # Consensus
    decisions = [r["decision"] for r in results.values()]
    probs = [r["approval_probability"] for r in results.values()]
    avg_prob = round(float(np.mean(probs)), 4)

    return {
        "models": results,
        "consensus": {
            "all_agree": len(set(decisions)) == 1,
            "avg_probability": avg_prob,
            "final_decision": "approved" if avg_prob >= threshold else "rejected",
            "models_agreeing_approve": sum(1 for d in decisions if d == "approved"),
            "models_agreeing_reject": sum(1 for d in decisions if d == "rejected"),
        },
    }


# ─── EMI calculation ────────────────────────────────────────────────────────

def calculate_emi(principal: float, annual_rate: float, term_months: int) -> float:
    """
    Calculate Equated Monthly Installment.

    Args:
        principal: Loan amount
        annual_rate: Annual interest rate as percentage (e.g., 8.5)
        term_months: Loan term in months

    Returns:
        Monthly EMI amount
    """
    if principal <= 0 or term_months <= 0:
        return 0.0

    monthly_rate = annual_rate / 12 / 100
    if monthly_rate == 0:
        return round(principal / term_months, 2)

    emi = principal * monthly_rate * (1 + monthly_rate) ** term_months / (
        (1 + monthly_rate) ** term_months - 1
    )
    return round(emi, 2)


if __name__ == "__main__":
    # Quick self-test
    test_applicant = {
        "credit_score": 720,
        "annual_income": 85000,
        "loan_amount": 250000,
        "loan_term": 360,
        "dti_ratio": 0.28,
        "employment_years": 8,
        "num_credit_lines": 5,
        "num_derogatory_marks": 0,
        "credit_utilization": 0.25,
        "payment_history_score": 0.95,
        "home_ownership": 2,
        "purpose_encoded": 1,
        "num_late_payments": 0,
        "savings_balance": 25000,
        "monthly_expenses": 3500,
    }

    print("=" * 60)
    print("  ML Predict — Self Test")
    print("=" * 60)
    print(f"  Models dir: {MODELS_DIR}")
    print(f"  Active model: {get_active_model_name()}")
    print(f"  Features: {len(MODEL_FEATURES)}")

    try:
        result = predict_single(test_applicant)
        print(f"\n  Single prediction:")
        for k, v in result.items():
            print(f"    {k}: {v}")

        all_results = predict_all_models(test_applicant)
        print(f"\n  All models:")
        for name, r in all_results["models"].items():
            print(f"    {name}: {r['decision']} ({r['approval_probability']:.2%})")
        print(f"  Consensus: {all_results['consensus']}")
    except FileNotFoundError as e:
        print(f"\n  [!] {e}")
        print("  Train models first: python -m ml.train")
