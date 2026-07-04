import sys, os
sys.path.insert(0, '.')
sys.path.insert(0, os.path.join('..'))

from ml.inference.predict import calculate_emi as ml_emi
from emi import calculate_emi as emi_calc
from monte_carlo import simulate
from risk_calc import calculate_risk

print("=" * 60)
print("  DIAGNOSTIC: 60k Salary / 20L Loan / 9% / 20yr / 750 CIBIL")
print("=" * 60)

income = 60000
loan_amount = 2000000
interest_rate = 9.0
loan_term = 20  # years
credit_score = 750

# --- EMI calculations ---
emi_from_emi_py = emi_calc(loan_amount, interest_rate, loan_term)
emi_from_ml_months = ml_emi(loan_amount, interest_rate, loan_term * 12)  # correct
emi_from_ml_years_bug = ml_emi(loan_amount, interest_rate, loan_term)    # wrong (if passed years)

print(f"\nEMI from emi.py (expects years): Rs.{emi_from_emi_py:,.0f}")
print(f"EMI from ml_emi (months=240):   Rs.{emi_from_ml_months:,.0f}")
print(f"EMI from ml_emi (months=20 BUG):Rs.{emi_from_ml_years_bug:,.0f}")

# What api.py does on line 479: loan_term * 12 -> passed to ml_emi
emi_used_in_api = ml_emi(loan_amount, interest_rate, loan_term * 12)
print(f"\n>> EMI used by api.py:  Rs.{emi_used_in_api:,.0f}")
print(f"   FOIR (EMI/income):   {emi_used_in_api/income*100:.1f}%")

# --- Risk Calculation ---
risk = calculate_risk(income, loan_amount, credit_score, 0, emi=emi_used_in_api, region="North")
print(f"\nRule-based Risk Level: {risk}")

# --- Monte Carlo ---
mc = simulate({
    'income': income,
    'loan_amount': loan_amount,
    'interest_rate': interest_rate,
    'loan_term': loan_term,
    'credit_score': credit_score
}, n_simulations=1000)
print(f"\nMonte Carlo Default Prob: {mc['default_probability']:.2%}")
print(f"MC Risk Label:            {mc['risk_label']}")

# --- Final Decision Logic ---
mc_default = mc['default_probability']
if risk == "HIGH" or mc_default > 0.40:
    decision = "REJECT"
elif risk == "LOW" and mc_default < 0.15:
    decision = "APPROVE"
else:
    decision = "CONDITIONAL"

print(f"\n*** FINAL DECISION: {decision} ***")
print("=" * 60)
