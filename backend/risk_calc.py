def calculate_risk(income, loan_amount, credit_score, existing_loans, emi=None, region="North", collateral_value=None):
    """
    Balanced Risk Calculation (Indian Banking Context).
    Refactored for continuous scoring and collateral integration.
    """
    total_risk_score = 0
    
    # 1. Regional Context
    is_high_col_region = region in ["West", "South"]
    
    # 2. Loan-to-Income (LTI) Multiple
    annual_income = income * 12
    lti_ratio = loan_amount / annual_income if annual_income > 0 else 100
    
    if lti_ratio > 10:
        total_risk_score += 45
    elif lti_ratio > 7:
        total_risk_score += 25
    elif lti_ratio > 5:
        total_risk_score += 10
        
    # 3. Credit Score Penalty (Continuous)
    # Instead of hard jumps at 750/700/640, we use a sliding scale.
    # Target: 0 penalty at 800+, 100 penalty at 300.
    if credit_score >= 800:
        penalty = 0
    else:
        # Scale 300-800 to 100-0 penalty
        penalty = max(0, min(100, (800 - credit_score) * 0.2))
        # Add extra weight if below critical threshold
        if credit_score < 600:
            penalty += 30
    
    total_risk_score += penalty
         
    # 4. FOIR (Debt Burden)
    if emi and income > 0:
        foir = (emi / income) * 100
        foir_limit = 55 if is_high_col_region else 50
        
        if foir > (foir_limit + 10):
            total_risk_score += 100 
        elif foir > foir_limit:
            total_risk_score += 40  
        elif foir > (foir_limit - 10):
            total_risk_score += 15  
            
    # 5. Collateral Impact (LTV)
    if collateral_value and collateral_value > 0:
        ltv = (loan_amount / collateral_value) * 100
        if ltv > 95:
            total_risk_score += 60  # Extreme risk
        elif ltv > 90:
            total_risk_score += 30  # High risk
        elif ltv > 80:
            total_risk_score += 10  # Moderate
        elif ltv < 60:
            total_risk_score -= 10  # Good equity (bonus)
    else:
        # No collateral provided -> slightly higher risk for unsecured-like profile
        total_risk_score += 10

    # 6. Existing Debt
    if existing_loans > 4:
        total_risk_score += 20
    elif existing_loans >= 2:
        total_risk_score += 5

    # 7. Level Thresholds
    # LOW (<45), MEDIUM (45-85), HIGH (>85)
    if total_risk_score >= 85:
        return "HIGH"
    elif total_risk_score >= 45:
        return "MEDIUM"
    else:
        return "LOW"


# Test
if __name__ == "__main__":
    risk = calculate_risk(50000, 200000, 650, 2)
    print("Risk Level:", risk)