# LLM Decision Flow Architecture

## Overview
This document describes the step-by-step process for generating biologic recommendations, clearly indicating where rule-based logic is used versus where the LLM (Claude) provides clinical reasoning.

---

## Input Data Collection

### Form Inputs (No LLM)
```
Provider Selection ⟶ Required
Partner Selection ⟶ Required
Medication Type ⟶ Filters output to biologics or topicals
Current Biologic ⟶ Determines optimization pathway
    ├─ Drug Name
    ├─ Dose
    └─ Frequency
Diagnosis ⟶ Filters drugs by FDA indication
    └─ Psoriasis or Atopic Dermatitis
Psoriatic Arthritis ⟶ Influences drug selection
Contraindications ⟶ Hard filters (excludes drugs)
Inappropriate Biologics ⟶ Hard filters (excludes specific drugs)
Remission Status ⟶ Determines quadrant assignment
BMI ⟶ Stored for future use (not yet in logic)
```

**LLM Involvement:** ❌ None - Pure data collection

---

## Step 1: Quadrant Determination (Rule-Based)

### Process Flow
```
Input: isStable (remission status) + currentFormularyDrug
    ↓
Rule-Based Logic (NO LLM)
    ↓
Output: Quadrant Assignment
```

### Quadrant Rules (Hard-Coded)
| Remission Status | Formulary Status | Quadrant | Code Location |
|-----------------|------------------|----------|---------------|
| In Remission | Tier 1 | `stable_optimal` | `llm-decision-engine.ts:185-234` |
| In Remission | Tier 2-5 | `stable_suboptimal` | ↑ |
| Active Disease | Tier 1 | `unstable_optimal` | ↑ |
| Active Disease | Tier 2-5 | `unstable_suboptimal` | ↑ |
| Not on biologic | N/A | `not_on_biologic` | ↑ |

### Key Assumptions (Hard-Coded)
- **Formulary Optimal** = Tier 1 drug (regardless of PA requirement for current therapy)
- **Tier 2-5** = Suboptimal
- **Remission** = Assumed ≥3 months stable (minimum for optimization)

**LLM Involvement:** ❌ None - Pure rule-based logic

---

## Step 2: Drug Filtering (Rule-Based)

### Contraindication Filtering
```
Contraindications Input
    ↓
Hard Filter Rules (NO LLM)
    ├─ Heart Failure ⟶ EXCLUDE all TNF inhibitors
    ├─ Multiple Sclerosis ⟶ EXCLUDE all TNF inhibitors
    ├─ Inflammatory Bowel Disease ⟶ EXCLUDE all IL-17 inhibitors
    └─ Active Infection ⟶ EXCLUDE all biologics
    ↓
Filtered Drug List
```

**Code Location:** `llm-decision-engine.ts:550-650`

### Indication Filtering
```
Diagnosis (Psoriasis or AD)
    ↓
Filter by FDA Indications (NO LLM)
    ↓
Only drugs approved for patient's condition
```

**Code Location:** `llm-decision-engine.ts:1150-1200`

### Failed Therapy Filtering
```
Inappropriate Biologics List
    ↓
Hard Exclude (NO LLM)
    ↓
Remove from available options
```

**Code Location:** `llm-decision-engine.ts:1180-1200`

### Formulary Filtering
```
Partner's Formulary
    ↓
Filter by Formulary Status (NO LLM)
    ├─ Keep: Drugs in formulary (any tier)
    └─ Exclude: Drugs not in formulary
    ↓
Available Drug Options
```

**LLM Involvement:** ❌ None - Pure rule-based filtering

---

## Step 3: Dose Reduction Detection (Rule-Based)

### Current Dosing Analysis
```
Current Drug + Frequency
    ↓
Parse Frequency String (NO LLM)
    ↓
Compare to FDA Standard Dosing (NO LLM)
    ├─ Standard: 0% reduction
    ├─ Extended: 25% reduction
    └─ Extended further: 50% reduction
    ↓
Current Dose Reduction Level
```

**Code Location:** `llm-decision-engine.ts:88-117`

**Example:**
- Humira every 2 weeks = Standard (0%)
- Humira every 3 weeks = 25% reduction
- Humira every 4 weeks = 50% reduction

**LLM Involvement:** ❌ None - Algorithmic parsing

---

## Step 4: Triage Decision (LLM-Powered)

### Clinical Reasoning Analysis
```
Patient Info + Quadrant + Available Drugs
    ↓
LLM Clinical Reasoning (✅ LLM)
    ├─ Analyzes clinical situation
    ├─ Considers efficacy hierarchy
    ├─ Evaluates tier trade-offs
    └─ Determines optimization strategy
    ↓
Triage Result:
    ├─ canDoseReduce (boolean)
    ├─ shouldSwitch (boolean)
    ├─ needsInitiation (boolean)
    ├─ shouldContinueCurrent (boolean)
    └─ reasoning (text)
```

**Code Location:** `llm-decision-engine.ts:237-475`

### LLM Prompt Includes:
- Patient diagnosis and remission status
- Current medication and dose status
- Formulary tier structure (relative logic)
- Available tiers in formulary
- Contraindications
- Clinical guidelines for each quadrant

### Triage Rules Given to LLM:

#### For `stable_optimal` (Remission + Tier 1):
1. If standard dose ⟶ Consider **DOSE_REDUCTION** (25% step)
2. If already reduced ⟶ Continue or reduce further
3. Tier switches allowed if significant cost savings

#### For `stable_suboptimal` (Remission + Tier 2-5):
1. Priority 1: **SWITCH_TO_PREFERRED** (lower tier)
2. Priority 2: **DOSE_REDUCTION** if on standard dose
3. Consider biosimilar switches

#### For `unstable_optimal` (Active Disease + Tier 1):
1. If dose-reduced ⟶ **Return to standard dosing** first
2. If standard dose ⟶ **Switch mechanism** (e.g., TNF→IL-17/IL-23)
3. **Never dose reduce** for active disease

#### For `unstable_suboptimal` (Active Disease + Tier 2-5):
1. Switch to most efficacious drug in best available tier
2. Prioritize mechanism switching for better efficacy
3. **Never dose reduce**

#### For `not_on_biologic` (Initiation):
1. Recommend most efficacious drug in lowest available tier
2. Consider PsA indication if applicable
3. Avoid contraindicated drugs

**LLM Involvement:** ✅ **Full LLM** - Clinical reasoning and triage decision

---

## Step 5: RAG Knowledge Retrieval (LLM-Powered)

### Evidence Gathering
```
Triage Result + Patient Context
    ↓
Semantic Search in Knowledge Base (✅ LLM Embeddings)
    ├─ Query: Relevant clinical scenarios
    ├─ Retrieves: Research papers, guidelines, dose reduction studies
    └─ Filters: By drug class, indication, intervention type
    ↓
Top 15 Most Relevant Clinical Findings
```

**Code Location:** `llm-decision-engine.ts:495-590`

### RAG Query Strategy (Based on Triage):
- **Dose Reduction** ⟶ Search for dose reduction efficacy studies
- **Switching** ⟶ Search for comparative efficacy data
- **Initiation** ⟶ Search for first-line treatment guidelines
- **Biosimilar** ⟶ Search for biosimilar switching evidence

**Database:** PostgreSQL with pgvector extension
- **Table:** `ClinicalFinding`
- **Embedding Model:** OpenAI text-embedding-3-small (1536 dimensions)
- **Similarity:** Cosine similarity search

**LLM Involvement:** ✅ **LLM** - Generates query embeddings for semantic search

---

## Step 6: Recommendation Generation (LLM-Powered)

### Detailed Recommendation Creation
```
Triage + Available Drugs + RAG Evidence
    ↓
LLM Generates Structured Recommendations (✅ LLM)
    ├─ Ranks drugs by clinical appropriateness
    ├─ Provides detailed rationale for each
    ├─ Includes evidence citations
    ├─ Creates monitoring plans
    └─ Considers comorbidities
    ↓
JSON Output: Array of Recommendations
```

**Code Location:** `llm-decision-engine.ts:600-1100`

### LLM Prompt Includes:
- **Patient Information:**
  - Diagnosis
  - Current medication and dosing status
  - Remission status (assumed ≥3 months)
  - Psoriatic arthritis presence
  - Contraindications

- **Formulary Context:**
  - Available tiers structure
  - Current tier vs. lowest available tier
  - Relative tier logic (Tier 3 may be "best" if no Tier 1/2 exists)
  - PA requirements for each drug

- **Clinical Evidence:**
  - Top 15 retrieved clinical findings
  - Research citations with DOIs

- **Efficacy Hierarchy:**
  1. IL-23 inhibitors (highest efficacy)
  2. IL-17 inhibitors
  3. TNF inhibitors
  4. IL-4/13 inhibitors (Dupixent)
  5. Oral agents

- **Comorbidity Considerations:**
  - Asthma + AD ⟶ Dupilumab preferred
  - PsA ⟶ IL-17 or TNF preferred
  - IBD ⟶ Avoid IL-17
  - Cardiovascular disease ⟶ Consider IL-23

### Recommendation Output Structure:
```typescript
{
  type: RecommendationType,           // DOSE_REDUCTION, SWITCH_TO_PREFERRED, etc.
  drugName: string,                   // e.g., "Skyrizi (risankizumab)"
  newDose?: string,                   // If dose change
  newFrequency?: string,              // If frequency change
  rationale: string,                  // Clinical justification (2-3 sentences)
  monitoringPlan?: string,            // Follow-up instructions
  rank: number                        // Priority ranking (1-3)
}
```

**LLM Involvement:** ✅ **Full LLM** - Generates all recommendation content, rationale, and rankings

---

## Step 7: Cost Calculation (Rule-Based)

### Cost Analysis
```
Recommended Drug + Dosing
    ↓
Formulary Lookup (NO LLM)
    ├─ Tier assignment
    ├─ PA requirement
    └─ Cost estimates (if available)
    ↓
Calculate Potential Savings
```

**Code Location:** `llm-decision-engine.ts:1300-1400`

### Cost Logic:
- Lower tier = Lower cost
- Biosimilars = ~30% cost savings
- Dose reduction = Proportional cost savings

**LLM Involvement:** ❌ None - Formulary lookup and arithmetic

---

## Step 8: Safety Check (Rule-Based)

### Contraindication Validation
```
Each Recommended Drug
    ↓
Re-check Contraindications (NO LLM)
    ├─ Verify no contraindicated conditions
    ├─ Flag if contraindication found
    └─ Mark as contraindicated
    ↓
Final Recommendation List
```

**Code Location:** `llm-decision-engine.ts:1100-1150`

**Note:** This is a safety redundancy check since drugs were already filtered in Step 2.

**LLM Involvement:** ❌ None - Rule-based safety check

---

## Step 9: Final Formatting & Storage (Rule-Based)

### Save to Database
```
Recommendations Array
    ↓
Format for Database (NO LLM)
    ├─ Convert to Prisma schema format
    ├─ Link to Assessment ID
    ├─ Set status to PENDING
    └─ Store evidence sources
    ↓
Insert into Database (PostgreSQL/Supabase)
    ├─ Recommendation table
    └─ Assessment table
```

**Code Location:** `app/api/assessments/route.ts:95-140`

**LLM Involvement:** ❌ None - Data persistence

---

## Decision Tree Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     INPUT COLLECTION                            │
│                    (No LLM - Form Data)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 1: QUADRANT DETERMINATION                     │
│           (No LLM - Hard-Coded Rules)                           │
│  • Remission Status + Formulary Status → Quadrant              │
│  • Tier 1 = Optimal, Tier 2-5 = Suboptimal                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2: DRUG FILTERING                             │
│           (No LLM - Rule-Based Filters)                         │
│  • Contraindications → Exclude drugs                           │
│  • Failed therapies → Exclude drugs                            │
│  • Indication → Include only FDA-approved drugs                │
│  • Formulary → Include only covered drugs                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         STEP 3: DOSE REDUCTION DETECTION                        │
│           (No LLM - Algorithmic Parsing)                        │
│  • Parse current frequency string                              │
│  • Compare to FDA standard dosing                              │
│  • Calculate % reduction (0%, 25%, 50%)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 4: TRIAGE DECISION                            │
│              (✅ LLM - Clinical Reasoning)                      │
│  • Analyze quadrant + patient context                          │
│  • Determine optimization strategy                             │
│  • Output: canDoseReduce, shouldSwitch, etc.                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│          STEP 5: RAG KNOWLEDGE RETRIEVAL                        │
│              (✅ LLM - Semantic Search)                         │
│  • Generate embedding for clinical query                       │
│  • Search ClinicalFinding table (pgvector)                     │
│  • Retrieve top 15 relevant studies                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         STEP 6: RECOMMENDATION GENERATION                       │
│              (✅ LLM - Full Generation)                         │
│  • Rank drugs by clinical appropriateness                      │
│  • Generate detailed rationale (2-3 sentences)                 │
│  • Include evidence citations                                  │
│  • Create monitoring plans                                     │
│  • Output: JSON array of recommendations                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 7: COST CALCULATION                           │
│           (No LLM - Formulary Lookup)                           │
│  • Lookup tier for each recommended drug                       │
│  • Calculate potential savings                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 8: SAFETY CHECK                               │
│           (No LLM - Redundancy Check)                           │
│  • Re-validate contraindications                               │
│  • Flag any safety concerns                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         STEP 9: FORMAT & STORE                                  │
│           (No LLM - Database Insert)                            │
│  • Format for Prisma schema                                    │
│  • Insert into PostgreSQL                                      │
│  • Return Assessment ID to frontend                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## LLM Involvement Summary

| Step | Component | LLM Used? | Purpose |
|------|-----------|-----------|---------|
| 1 | Quadrant Determination | ❌ No | Hard-coded rules based on remission status & tier |
| 2 | Drug Filtering | ❌ No | Rule-based exclusions (contraindications, indications) |
| 3 | Dose Detection | ❌ No | Algorithmic parsing of frequency strings |
| 4 | Triage Decision | ✅ **Yes** | Clinical reasoning for optimization strategy |
| 5 | RAG Retrieval | ✅ **Yes** | Semantic search using embeddings |
| 6 | Recommendation Generation | ✅ **Yes** | Full recommendation content & rationale |
| 7 | Cost Calculation | ❌ No | Formulary tier lookup and arithmetic |
| 8 | Safety Check | ❌ No | Contraindication validation |
| 9 | Database Storage | ❌ No | Data persistence |

---

## Key Design Principles

### 1. Trust Hard-Coded Rules for Critical Decisions
- **Quadrant assignment** is never delegated to LLM
- **Contraindication filtering** uses deterministic rules
- **Formulary status** is based on tier lookup, not LLM judgment

### 2. Use LLM for Clinical Nuance
- **Triage reasoning** benefits from clinical judgment
- **Evidence synthesis** requires understanding medical literature
- **Ranking recommendations** requires balancing multiple factors

### 3. RAG for Evidence-Based Medicine
- All recommendations backed by retrieved clinical findings
- Citations include DOI links for provider verification
- Knowledge base includes dose reduction studies, efficacy comparisons, biosimilar data

### 4. Medication Type Filtering (New)
- **Input:** Provider selects "biologic" or "topical"
- **Effect:** Filters all recommendations to selected medication type
- **Location:** Applied during drug filtering (Step 2)

---

## Example Walkthrough

### Scenario:
- **Patient:** In remission, on Humira (adalimumab) Tier 3, standard dose
- **Diagnosis:** Psoriasis
- **Contraindications:** None
- **Partner Formulary:** Has Tier 1 (Skyrizi), Tier 3 (Humira)

### Flow:
1. **Quadrant:** `stable_suboptimal` (remission + Tier 3)
2. **Drugs Filtered:** All psoriasis-approved drugs in formulary (no contraindications)
3. **Dose Status:** Standard (0% reduction)
4. **Triage (LLM):** "Patient in remission on Tier 3. Can switch to Tier 1 (Skyrizi) for cost savings. Dose reduction also possible."
5. **RAG Retrieval (LLM):** Finds studies on Skyrizi efficacy, Humira dose reduction in remission
6. **Recommendations (LLM):**
   - **Rank 1:** Switch to Skyrizi (Tier 1) - rationale includes efficacy data + cost savings
   - **Rank 2:** Humira dose reduction to every 3 weeks - rationale cites dose reduction studies
   - **Rank 3:** Continue Humira standard dose - rationale for conservative approach
7. **Cost:** Calculates Tier 1 vs Tier 3 savings
8. **Safety:** Re-confirms no contraindications
9. **Store:** Saves to database with PENDING status

---

## Code References

| Component | File | Lines |
|-----------|------|-------|
| Assessment API | `app/api/assessments/route.ts` | 1-150 |
| LLM Decision Engine | `lib/llm-decision-engine.ts` | 1-1400 |
| Quadrant Logic | `lib/llm-decision-engine.ts` | 185-234 |
| Triage LLM Call | `lib/llm-decision-engine.ts` | 237-475 |
| RAG Retrieval | `lib/llm-decision-engine.ts` | 495-590 |
| Recommendation LLM Call | `lib/llm-decision-engine.ts` | 600-1100 |
| Contraindication Filtering | `lib/llm-decision-engine.ts` | 550-650 |

---

## Future Enhancements

### Planned (Not Yet Implemented):
1. **BMI-based dosing adjustments**
   - Currently stored but not used in logic
   - Future: Adjust dosing recommendations based on BMI

2. **Medication type filtering**
   - Input field exists
   - Future: Filter recommendations by biologic vs topical

3. **Cost optimization scoring**
   - Future: Quantitative cost-benefit analysis
   - Future: Patient out-of-pocket estimates

4. **Real-time formulary updates**
   - Future: Integration with live formulary feeds
   - Future: PA requirement real-time validation

---

## Questions or Clarifications?

This document provides a comprehensive overview of the decision flow. For specific implementation details, refer to the code references above or reach out to the development team.

**Last Updated:** December 2025
