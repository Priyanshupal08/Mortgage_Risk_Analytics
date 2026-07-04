import sys
import os
from pathlib import Path

# Add current dir to path
sys.path.append(os.getcwd())

from risk_calc import calculate_risk
from ml.inference.predict import calculate_emi
from monte_carlo import simulate as mc_simulate

def test_scenario(name, income, loan_amount, credit_score, interest_rate, loan_term, region, existing_loans=0):
    print(f"\n>>> TESTING SCENARIO: {name}")
    print(f"    Input: Income={income}, Loan={loan_amount}, Credit={credit_score}, Term={loan_term}y, Region={region}")
    
    emi = calculate_emi(loan_amount, interest_rate, loan_term * 12)
    foir = (emi / income) * 100 if income > 0 else 100
    lti = loan_amount / (income * 12) if income > 0 else 100
    
    risk_level = calculate_risk(income, loan_amount, credit_score, existing_loans, emi=emi, region=region)
    
    mc_results = mc_simulate({
        "income": income, "loan_amount": loan_amount,
        "interest_rate": interest_rate, "loan_term": loan_term,
        "credit_score": credit_score,
    }, n_simulations=1000)
    
    mc_default = mc_results["default_probability"]
    
    # Logic from api.py
    if risk_level == "HIGH" or mc_default > 0.40:
        decision = "REJECT"
    elif risk_level == "LOW" and mc_default < 0.15:
        decision = "APPROVE"
    else:
        decision = "CONDITIONAL"
        
    print(f"    Results: EMI={emi:.0f}, FOIR={foir:.1f}%, LTI={lti:.2f}x")
    print(f"    Risk Level (Rules): {risk_level}")
    print(f"    Default Prob (MC):  {mc_default:.2%}")
    print(f"    FINAL DECISION:     {decision}")
    print("-" * 50)

if __name__ == "__main__":
    # 1. Golden Profile
    test_scenario("Golden Profile", 100000, 1000000, 800, 9.0, 15, "South")
    
    # 2. Poor Credit
    test_scenario("Poor Credit", 100000, 500000, 450, 9.0, 5, "North")
    
    # 3. High Debt (FOIR Stress)
    test_scenario("High FOIR", 30000, 4000000, 750, 9.0, 20, "West")
    
    # 4. Borderline CIBIL
    test_scenario("Borderline CIBIL", 60000, 2000000, 680, 9.0, 20, "Central")
    
    # 5. Low Income but Low Loan
    test_scenario("Low Income/Small Loan", 25000, 500000, 750, 9.0, 10, "East")
