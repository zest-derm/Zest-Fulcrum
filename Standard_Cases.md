# Standard Test Cases for Zest Fulcrum

This document contains 25 standardized patient scenarios designed to test various functionalities of the assessment tool.

## Test Case Overview
- **Cases 1-12**: Aetna Commercial formulary
- **Cases 13-25**: United Commercial formulary

## Test Cases

| Case # | Formulary | MRN | Provider | Medication Type | Current Biologic | Dose | Frequency | Indication | PsA Present | Contraindications | Failed Therapies | BMI | Notes |
|--------|-----------|-----|----------|-----------------|------------------|------|-----------|------------|-------------|-------------------|------------------|-----|-------|
| 1 | Aetna | 10001 | Neil Jairath | Biologic | Humira | 40mg | Every 2 weeks | Psoriasis | No | None | None | <25 | Baseline case - stable patient |
| 2 | Aetna | 10002 | Neil Jairath | Biologic | Enbrel | 50mg | Once weekly | Psoriasis | Yes | None | Humira | 25-30 | PsA present, switched from Humira |
| 3 | Aetna | 10003 | Neil Jairath | Biologic | Stelara | 45mg | Every 12 weeks | Psoriasis | No | Heart failure | None | >30 | TNF contraindication (heart failure) |
| 4 | Aetna | 10004 | Neil Jairath | Biologic | Skyrizi | 150mg | Every 12 weeks | Psoriasis | No | Multiple sclerosis | Cosentyx | 25-30 | MS contraindication, IL-17 failure |
| 5 | Aetna | 10005 | Neil Jairath | Biologic | Tremfya | 100mg | Every 8 weeks | Psoriasis | Yes | None | Humira, Enbrel | <25 | Multiple TNF failures |
| 6 | Aetna | 10006 | Neil Jairath | Biologic | Cosentyx | 300mg | Every 4 weeks | Psoriasis | No | Inflammatory bowel disease | None | >30 | IBD with IL-17 (should flag) |
| 7 | Aetna | 10007 | Neil Jairath | Biologic | Taltz | 80mg | Every 2 weeks | Psoriasis | Yes | None | Humira, Stelara | 25-30 | PsA, multiple failures |
| 8 | Aetna | 10008 | Neil Jairath | Biologic | None (not on biologic) | - | - | Psoriasis | No | Active infection | None | <25 | Starting therapy, has infection |
| 9 | Aetna | 10009 | Neil Jairath | Biologic | Otezla | 30mg | Twice daily | Psoriasis | Yes | Heart failure, Multiple sclerosis | None | >30 | Multiple contraindications, on oral |
| 10 | Aetna | 10010 | Neil Jairath | Biologic | Dupixent | 300mg | Every 2 weeks | Atopic Dermatitis | No | None | None | 25-30 | Atopic dermatitis case |
| 11 | Aetna | 10011 | Neil Jairath | Biologic | Rinvoq | 15mg | Once daily | Atopic Dermatitis | No | Drug allergies | Dupixent | <25 | JAK inhibitor, previous biologic failure |
| 12 | Aetna | 10012 | Neil Jairath | Biologic | None (not on biologic) | - | - | Atopic Dermatitis | No | Pregnancy/planning pregnancy | None | 25-30 | Pregnancy contraindication |
| 13 | United | 20001 | Neil Jairath | Biologic | Humira | 40mg | Every 2 weeks | Psoriasis | No | None | None | <25 | Baseline case - different formulary |
| 14 | United | 20002 | Neil Jairath | Biologic | Cimzia | 200mg | Every 2 weeks | Psoriasis | Yes | None | Humira | >30 | PsA, TNF switch |
| 15 | United | 20003 | Neil Jairath | Biologic | Stelara | 90mg | Every 12 weeks | Psoriasis | No | None | None | >30 | High dose for weight >100kg |
| 16 | United | 20004 | Neil Jairath | Biologic | Skyrizi | 150mg | Every 12 weeks | Psoriasis | Yes | None | Humira, Enbrel, Cosentyx | 25-30 | PsA, multiple failures |
| 17 | United | 20005 | Neil Jairath | Biologic | Ilumya | 100mg | Every 12 weeks | Psoriasis | No | Inflammatory bowel disease | None | <25 | IBD present |
| 18 | United | 20006 | Neil Jairath | Biologic | Siliq | 210mg | Once weekly | Psoriasis | No | Drug allergies | Humira, Stelara, Cosentyx | >30 | Multiple failures, high risk drug |
| 19 | United | 20007 | Neil Jairath | Biologic | None (not on biologic) | - | - | Psoriasis | Yes | None | None | 25-30 | New PsA patient, no prior therapy |
| 20 | United | 20008 | Neil Jairath | Biologic | Xeljanz | 5mg | Twice daily | Psoriasis | Yes | None | Humira, Cosentyx | >30 | JAK inhibitor, high BMI |
| 21 | United | 20009 | Neil Jairath | Biologic | Adbry | 300mg | Every 2 weeks | Atopic Dermatitis | No | None | None | <25 | AD, newer biologic |
| 22 | United | 20010 | Neil Jairath | Biologic | Dupixent | 300mg | Every 2 weeks | Atopic Dermatitis | No | Active infection | None | 25-30 | AD with active infection |
| 23 | United | 20011 | Neil Jairath | Biologic | Cibinqo | 100mg | Once daily | Atopic Dermatitis | No | None | Dupixent | >30 | AD, JAK inhibitor |
| 24 | United | 20012 | Neil Jairath | Biologic | Rinvoq | 15mg | Once daily | Atopic Dermatitis | No | Heart failure | None | 25-30 | AD with cardiac contraindication |
| 25 | United | 20013 | Neil Jairath | Biologic | None (not on biologic) | - | - | Atopic Dermatitis | No | Multiple sclerosis, Inflammatory bowel disease | None | <25 | AD, multiple contraindications, new patient |

## Test Coverage

### Diagnosis Distribution
- **Psoriasis**: 17 cases (68%)
- **Atopic Dermatitis**: 8 cases (32%)

### Formulary Distribution
- **Aetna Commercial**: 12 cases (48%)
- **United Commercial**: 13 cases (52%)

### Key Functionality Tests

#### Drug Classes Covered
- **TNF Inhibitors**: Humira, Enbrel, Cimzia
- **IL-17 Inhibitors**: Cosentyx, Taltz, Siliq
- **IL-23 Inhibitors**: Stelara, Tremfya, Skyrizi, Ilumya
- **JAK Inhibitors**: Xeljanz, Rinvoq, Cibinqo
- **IL-4/IL-13 Inhibitors**: Dupixent, Adbry
- **PDE4 Inhibitors**: Otezla

#### Contraindication Testing
- Heart failure (Cases 3, 9, 24)
- Multiple sclerosis (Cases 4, 9, 25)
- Inflammatory bowel disease (Cases 6, 17, 25)
- Active infection (Cases 8, 22)
- Pregnancy/planning pregnancy (Case 12)
- Drug allergies (Cases 11, 18)

#### Special Scenarios
- **Not on biologic**: Cases 8, 12, 19, 25
- **Multiple contraindications**: Cases 9, 25
- **Multiple failed therapies**: Cases 5, 7, 16, 18
- **PsA present**: Cases 2, 5, 7, 9, 14, 16, 19, 20
- **High BMI (>30)**: Cases 3, 6, 9, 15, 18, 20, 23
- **Weight-based dosing**: Case 15 (Stelara 90mg for >100kg)

#### Edge Cases
- **IL-17 + IBD**: Case 6 (should be flagged as relative contraindication)
- **JAK + high BMI**: Case 20 (increased CV risk)
- **Siliq**: Case 18 (requires additional monitoring, suicidal ideation screening)
- **Pregnancy**: Case 12 (requires careful drug selection)
- **Multiple system contraindications**: Cases 9, 25

## Usage Instructions

1. Select the provider "Neil Jairath" for all cases
2. Enter the MRN exactly as shown
3. Select the Partner Name and corresponding Formulary Version
4. Fill in all fields as specified in the table
5. For "None (not on biologic)" cases, check the "Patient not currently on biologic" checkbox
6. Document the recommendations provided and acceptance/decline decisions
7. Track assessment completion time for each case

## Expected Outcomes to Validate

- **Contraindication warnings** should appear for relevant cases
- **Failed therapies** should be excluded from recommendations
- **Formulary tier optimization** should differ between Aetna and United
- **PsA patients** should receive PsA-approved therapies
- **Weight-based dosing** should be considered where applicable
- **JAK inhibitors** should include appropriate warnings (VTE, CV risk)
- **Cost savings** calculations should reflect formulary differences

## Notes

- These cases use "Neil Jairath" as the provider to maintain consistency
- MRNs follow a pattern: 10001-10012 for Aetna, 20001-20013 for United
- Cases are designed to test edge cases and various clinical scenarios
- Each case should be documented with recommendations, provider decisions, and outcomes
