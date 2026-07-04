import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent))

from risk_calc import calculate_risk

def test_risk():
    print("Testing Credit Score Continuity (699 vs 700):")
    # Old logic: 699 -> +30, 700 -> +10 (Jump of 20)
    # New logic: 699 -> (800-699)*0.2 = 20.2, 700 -> (800-700)*0.2 = 20.0 (Jump of 0.2)
    
    r_699 = calculate_risk(income=5000, loan_amount=200000, credit_score=699, existing_loans=0)
    r_700 = calculate_risk(income=5000, loan_amount=200000, credit_score=700, existing_loans=0)
    print(f"Risk at 699: {r_699}")
    print(f"Risk at 700: {r_700}")
    
    print("\nTesting Collateral Impact (LTV):")
    # Low LTV (high collateral)
    r_low_ltv = calculate_risk(income=5000, loan_amount=100000, credit_score=750, existing_loans=0, collateral_value=200000) # LTV 50%
    # High LTV (low collateral)
    r_high_ltv = calculate_risk(income=5000, loan_amount=100000, credit_score=750, existing_loans=0, collateral_value=105000) # LTV 95%
    
    print(f"Risk at 50% LTV: {r_low_ltv}")
    print(f"Risk at 95% LTV: {r_high_ltv}")

if __name__ == "__main__":
    test_risk()
