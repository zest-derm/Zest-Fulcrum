# LLM Decision Flow Architecture

## Overview
This system helps providers select the best on-formulary biologic when a patient needs to **switch agents** or **start a biologic** for the first time. The tool does NOT make dose reduction or cessation recommendations - it only recommends the next best treatment option.

---

## System Purpose

### ✅ Use Cases:
1. **Switching:** Patient on biologic but needs to switch (active disease, side effects, etc.)
2. **Initiation:** Patient not on biologic and needs to start treatment

### ❌ Out of Scope:
- Dose reduction recommendations
- Cessation/stopping recommendations
- Optimization of stable patients

---

## Input Data Collection

### Form Inputs (No LLM)
```
Provider Selection ⟶ Required
Partner Selection ⟶ Required
Medication Type ⟶ Filters output to biologics or topicals
Current Biologic ⟶ EXCLUDED from recommendations
    ├─ Drug Name
    ├─ Dose
    └─ Frequency
Diagnosis ⟶ Filters drugs by FDA indication
    └─ Psoriasis or Atopic Dermatitis
Psoriatic Arthritis ⟶ Influences drug class selection
    └─ If YES → Prefer IL-17, IL-23, or TNF inhibitors
Contraindications ⟶ Hard filters (excludes drugs)
    ├─ Heart Failure → Exclude TNF inhibitors
    ├─ Multiple Sclerosis → Exclude TNF inhibitors
    ├─ IBD → Exclude IL-17 inhibitors
    └─ Active Infection → Exclude all biologics
Inappropriate Biologics ⟶ Hard filters (excludes specific drugs)
    └─ Previous failures, allergies, etc.
BMI ⟶ Influences drug selection
    ├─ High BMI → Note concerns with weight-based dosing
    └─ Mentioned in clinical notes
Comorbidities Inferred from Fields:
    └─ Asthma + Atopic Dermatitis → Prefer Dupixent
```

**LLM Involvement:** ❌ None - Pure data collection

**Note:** Remission status is NOT collected. This tool is used when provider has decided patient needs a switch or initiation.

---

## Step 1: Drug Filtering (Rule-Based)

### Process Flow
```
Input: Diagnosis + Contraindications + Inappropriate Biologics + Current Drug
    ↓
Apply Hard Filters (NO LLM)
    ↓
Output: Eligible Drug List
```

### Filter Rules (Applied in Order)

#### 1. Indication Filtering
```
Diagnosis (Psoriasis or AD)
    ↓
Filter by FDA Indications (NO LLM)
    ↓
Only drugs approved for patient's condition
```

**Code Location:** `llm-decision-engine.ts:1150-1200`

#### 2. Contraindication Filtering
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

#### 3. Current Drug Exclusion
```
Current Biologic Name
    ↓
Hard Exclude (NO LLM)
    ↓
Remove current drug from options
```

**Purpose:** Don't recommend what they're already on

#### 4. Failed Therapy Exclusion
```
Inappropriate Biologics List
    ↓
Hard Exclude (NO LLM)
    ↓
Remove from available options
```

**Purpose:** Don't re-recommend drugs that already failed or caused issues

#### 5. Formulary Filtering
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

## Step 2: Tier-Based Grouping (Rule-Based)

### Formulary Tier Organization
```
Available Drugs
    ↓
Group by Tier (NO LLM)
    ├─ Tier 1 drugs
    ├─ Tier 2 drugs
    ├─ Tier 3 drugs
    └─ Tier 4-5 drugs
    ↓
Identify Lowest Available Tier
```

**Purpose:** Prioritize lower tier (lower cost) options

**Code Location:** `llm-decision-engine.ts:1200-1250`

**Example:**
- If formulary has Tier 1, 3, 4 → Focus on Tier 1 options first
- If formulary only has Tier 3, 4 → Tier 3 is "best available"

**LLM Involvement:** ❌ None - Simple tier lookup and grouping

---

## Step 3: Clinical Appropriateness Ranking (LLM-Powered)

### Drug Selection & Ranking
```
Eligible Drugs + Patient Context
    ↓
LLM Clinical Reasoning (✅ LLM)
    ├─ Prioritizes lowest tier options
    ├─ Considers comorbidities (PsA, Asthma+AD, BMI)
    ├─ Applies efficacy hierarchy within tier
    ├─ Evaluates PA requirements
    └─ Ranks top 3 options
    ↓
Output: 3 Ranked Recommendations
```

**Code Location:** `llm-decision-engine.ts:600-1100`

### LLM Prompt Includes:

#### Patient Context:
- **Diagnosis:** Psoriasis or Atopic Dermatitis
- **Current medication:** (excluded from recommendations)
- **Psoriatic Arthritis:** YES/NO
- **BMI:** <25, 25-30, or >30
- **Contraindications:** List of conditions

#### Formulary Context:
- **Available tiers:** e.g., [1, 3, 4]
- **Lowest available tier:** e.g., Tier 1
- **Drugs by tier:** Which drugs are in each tier
- **PA requirements:** For each drug

#### Clinical Guidelines:

##### Tier Prioritization:
1. **Primary Focus:** Lowest tier drugs
2. **Secondary:** Next lowest tier if needed
3. Always mention tier in rationale

##### Comorbidity Matching:

**Psoriatic Arthritis:**
```
PsA Present
    ↓
Prefer (in order):
    1. IL-17 inhibitors (excellent for PsA)
    2. IL-23 inhibitors (good for PsA)
    3. TNF inhibitors (good for PsA)
    ↓
Deprioritize:
    └─ IL-12/23 (Stelara) - less effective for PsA
```

**Asthma + Atopic Dermatitis:**
```
Both Asthma + AD
    ↓
Strongly Prefer:
    └─ Dupixent (IL-4/13) - treats both conditions
```

**High BMI (>30):**
```
BMI >30
    ↓
Consider:
    ├─ Weight-based dosing may be less ideal
    └─ Mention in clinical notes
    ↓
Still recommend but note in rationale
```

##### Efficacy Hierarchy (Within Same Tier):
```
If multiple drugs in lowest tier:
    ↓
Rank by efficacy:
    1. IL-23 inhibitors (highest)
    2. IL-17 inhibitors
    3. TNF inhibitors
    4. IL-4/13 inhibitors (Dupixent)
    5. JAK inhibitors
    6. Oral agents (lowest)
    ↓
But override for comorbidities
```

**Example:**
- If Tier 1 has both Skyrizi (IL-23) and Cosentyx (IL-17)
- Default: Recommend Skyrizi first (higher efficacy)
- But if patient has PsA: Recommend Cosentyx first (better for PsA)

**LLM Involvement:** ✅ **Full LLM** - Balances tier, comorbidities, efficacy, and PA requirements

---

## Step 4: RAG Knowledge Retrieval (LLM-Powered)

### Evidence Gathering
```
Patient Context + Drug Options
    ↓
Semantic Search in Knowledge Base (✅ LLM Embeddings)
    ├─ Query: Drug efficacy for specific indication
    ├─ Query: Drug effectiveness for comorbidities (e.g., PsA)
    ├─ Retrieves: Research papers, guidelines, comparative studies
    └─ Filters: By drug class, indication
    ↓
Top 15 Most Relevant Clinical Findings
```

**Code Location:** `llm-decision-engine.ts:495-590`

### RAG Query Strategy:
- **Psoriasis + PsA** ⟶ Search for "IL-17 psoriatic arthritis efficacy"
- **Atopic Dermatitis + Asthma** ⟶ Search for "dupilumab atopic asthma"
- **General** ⟶ Search for comparative efficacy studies

**Database:** PostgreSQL with pgvector extension
- **Table:** `ClinicalFinding`
- **Embedding Model:** OpenAI text-embedding-3-small (1536 dimensions)
- **Similarity:** Cosine similarity search

**LLM Involvement:** ✅ **LLM** - Generates query embeddings for semantic search

---

## Step 5: Recommendation Generation (LLM-Powered)

### Final Recommendation Output
```
Filtered Drugs + Tier Structure + Patient Context + RAG Evidence
    ↓
LLM Generates 3 Ranked Recommendations (✅ LLM)
    ├─ Ranks by: Tier → Comorbidity Match → Efficacy
    ├─ Provides detailed rationale (2-3 sentences)
    ├─ Includes evidence citations
    ├─ Notes PA requirements
    └─ Creates monitoring plans
    ↓
JSON Output: Array of 3 Recommendations
```

**Code Location:** `llm-decision-engine.ts:600-1100`

### Recommendation Output Structure:
```typescript
{
  type: "INITIATE_BIOLOGIC",           // All recommendations are initiations now
  drugName: string,                    // e.g., "Skyrizi (risankizumab)"
  rationale: string,                   // Why this drug? (tier + comorbidity + efficacy)
  monitoringPlan?: string,             // Follow-up instructions
  rank: number,                        // 1, 2, or 3
  tier: number,                        // Formulary tier
  requiresPA: boolean,                 // Prior authorization needed?
  evidenceSources: string[]            // DOI citations
}
```

### Rationale Should Include:
1. **Tier justification:** "This is a Tier 1 option on your formulary"
2. **Comorbidity match:** "Excellent choice for patients with PsA"
3. **Efficacy:** "IL-23 inhibitors have high efficacy in psoriasis"
4. **Evidence:** "Studies show 90% achieve PASI 90"

**LLM Involvement:** ✅ **Full LLM** - Generates all content

---

## Step 6: Cost Calculation (Rule-Based)

### Cost Context
```
Recommended Drug
    ↓
Formulary Lookup (NO LLM)
    ├─ Tier assignment
    └─ PA requirement
    ↓
Cost Implications
```

**Code Location:** `llm-decision-engine.ts:1300-1400`

### Cost Logic:
- Lower tier = Lower cost
- PA requirement = Additional administrative burden
- Cost included in recommendation display

**LLM Involvement:** ❌ None - Formulary lookup

---

## Step 7: Safety Check (Rule-Based)

### Final Validation
```
Each Recommended Drug
    ↓
Re-check Contraindications (NO LLM)
    ├─ Verify no contraindicated conditions
    ├─ Flag if contraindication found
    └─ Mark as contraindicated (shouldn't happen)
    ↓
Final Recommendation List
```

**Code Location:** `llm-decision-engine.ts:1100-1150`

**Note:** This is a redundancy check since drugs were already filtered in Step 1.

**LLM Involvement:** ❌ None - Rule-based safety check

---

## Step 8: Storage (Rule-Based)

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
```

**Code Location:** `app/api/assessments/route.ts:95-140`

**LLM Involvement:** ❌ None - Data persistence

---

## Complete Decision Flow

```
┌────────────────────────────────────────────────────────────┐
│                  INPUT COLLECTION                          │
│                 (No LLM - Form Data)                       │
│  • Provider, Partner, Medication Type                     │
│  • Current Biologic (will be excluded)                    │
│  • Diagnosis, PsA, BMI                                    │
│  • Contraindications, Inappropriate Biologics             │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│              STEP 1: DRUG FILTERING                        │
│            (No LLM - Rule-Based)                           │
│  • Filter by indication (Psoriasis/AD)                    │
│  • Exclude contraindicated drugs                          │
│  • Exclude current biologic                               │
│  • Exclude inappropriate biologics                        │
│  • Keep only formulary drugs                              │
│  Output: Eligible Drug List                               │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│          STEP 2: TIER-BASED GROUPING                       │
│            (No LLM - Rule-Based)                           │
│  • Group drugs by tier                                    │
│  • Identify lowest available tier                         │
│  Output: Drugs organized by tier                          │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│    STEP 3: CLINICAL APPROPRIATENESS RANKING                │
│              (✅ LLM - Full Reasoning)                     │
│  • Prioritize lowest tier options                         │
│  • Match comorbidities (PsA, Asthma+AD, BMI)             │
│  • Apply efficacy hierarchy within tier                   │
│  • Consider PA requirements                               │
│  Output: Top 3 ranked options                             │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│         STEP 4: RAG KNOWLEDGE RETRIEVAL                    │
│              (✅ LLM - Semantic Search)                    │
│  • Generate embeddings for clinical queries              │
│  • Search knowledge base (pgvector)                       │
│  • Retrieve top 15 relevant studies                       │
│  Output: Evidence citations                               │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│        STEP 5: RECOMMENDATION GENERATION                   │
│              (✅ LLM - Full Content)                       │
│  • Generate detailed rationale for each option            │
│  • Include tier, comorbidity match, efficacy              │
│  • Add evidence citations                                 │
│  • Create monitoring plans                                │
│  Output: 3 complete recommendations                       │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│            STEP 6: COST CALCULATION                        │
│            (No LLM - Formulary Lookup)                     │
│  • Lookup tier for each drug                              │
│  • Note PA requirements                                   │
│  Output: Cost context                                     │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│             STEP 7: SAFETY CHECK                           │
│            (No LLM - Redundancy Check)                     │
│  • Re-validate contraindications                          │
│  • Flag any safety concerns                               │
│  Output: Validated recommendations                        │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│             STEP 8: STORAGE                                │
│            (No LLM - Database Insert)                      │
│  • Format for database schema                             │
│  • Insert into PostgreSQL                                 │
│  • Return Assessment ID                                   │
└────────────────────────────────────────────────────────────┘
```

---

## LLM Involvement Summary

| Step | Component | LLM Used? | Purpose |
|------|-----------|-----------|---------|
| 1 | Drug Filtering | ❌ No | Rule-based exclusions |
| 2 | Tier Grouping | ❌ No | Simple tier lookup |
| 3 | Clinical Ranking | ✅ **Yes** | Balance tier, comorbidities, efficacy |
| 4 | RAG Retrieval | ✅ **Yes** | Semantic search for evidence |
| 5 | Recommendation Content | ✅ **Yes** | Generate rationale & details |
| 6 | Cost Calculation | ❌ No | Formulary tier lookup |
| 7 | Safety Check | ❌ No | Contraindication validation |
| 8 | Database Storage | ❌ No | Data persistence |

---

## Example Walkthrough

### Scenario:
- **Patient:** On Humira (adalimumab), not achieving control
- **Diagnosis:** Psoriasis with Psoriatic Arthritis
- **BMI:** 32 (obese)
- **Contraindications:** None
- **Partner Formulary:**
  - Tier 1: Skyrizi (IL-23), Taltz (IL-17)
  - Tier 3: Humira (TNF), Cosentyx (IL-17)

### Flow:

#### Step 1: Drug Filtering
- ✅ Keep: All psoriasis-approved drugs
- ❌ Exclude: Humira (current drug)
- ❌ Exclude: None contraindicated
- Result: Skyrizi (T1), Taltz (T1), Cosentyx (T3)

#### Step 2: Tier Grouping
- Lowest available tier: **Tier 1**
- Tier 1 options: Skyrizi, Taltz
- Tier 3 options: Cosentyx

#### Step 3: Clinical Ranking (LLM)
LLM considers:
- **PsA present:** Prefer IL-17 (Taltz) over IL-23 (Skyrizi) for joint involvement
- **High BMI:** Note weight considerations but don't exclude
- **Tier 1 priority:** Focus on Tier 1 options

**Ranking Decision:**
1. **Taltz (Tier 1)** - IL-17, excellent for PsA + psoriasis
2. **Skyrizi (Tier 1)** - IL-23, high efficacy but less ideal for PsA
3. **Cosentyx (Tier 3)** - IL-17, good for PsA but higher tier

#### Step 4: RAG Retrieval (LLM)
Finds studies on:
- IL-17 inhibitors for psoriatic arthritis
- Taltz efficacy in PsA patients
- Comparative studies IL-17 vs IL-23

#### Step 5: Recommendations (LLM)

**Rank 1: Taltz (ixekizumab)**
```
Rationale: "Taltz is a Tier 1 option on your formulary and an excellent
choice for patients with both psoriasis and psoriatic arthritis. IL-17
inhibitors have demonstrated superior efficacy for joint symptoms
compared to other drug classes. Clinical trials show 70% of patients
achieve PASI 90 and significant improvement in joint pain."

Monitoring: Monitor for injection site reactions and signs of infection.
Check CBC and liver enzymes at baseline and periodically.

Evidence: [Citation links to PsA studies]
```

**Rank 2: Skyrizi (risankizumab)**
```
Rationale: "Skyrizi is also a Tier 1 option with high efficacy in
psoriasis (90% achieve PASI 90). While IL-23 inhibitors are highly
effective for skin disease, they may be less optimal than IL-17
inhibitors for managing the psoriatic arthritis component."

Evidence: [Citation links]
```

**Rank 3: Cosentyx (secukinumab)**
```
Rationale: "Cosentyx is an IL-17 inhibitor that is excellent for both
psoriasis and psoriatic arthritis. However, it is Tier 3 on your
formulary, which may result in higher costs compared to the Tier 1
options above."

Evidence: [Citation links]
```

#### Step 6-8: Cost, Safety, Storage
- Cost: Tier 1 vs Tier 3 noted
- Safety: All drugs validated
- Storage: Saved to database

---

## Key Design Principles

### 1. Simplicity Over Complexity
- No quadrant system
- No dose reduction logic
- No cessation recommendations
- Focus: **Best next option**

### 2. Tier-First Approach
- Always prioritize lowest tier
- Only recommend higher tiers if clinically necessary

### 3. Comorbidity Matching
- **PsA** → IL-17, IL-23, or TNF preferred
- **Asthma + AD** → Dupixent strongly preferred
- **High BMI** → Note in considerations

### 4. Evidence-Based
- All recommendations backed by RAG-retrieved evidence
- Citations for provider verification

### 5. Clinical Judgment
- LLM balances multiple factors
- Human provider makes final decision

---

## Code References

| Component | File | Lines (approximate) |
|-----------|------|---------------------|
| Assessment API | `app/api/assessments/route.ts` | 1-150 |
| LLM Decision Engine | `lib/llm-decision-engine.ts` | 1-1400 |
| Drug Filtering | `lib/llm-decision-engine.ts` | 550-650 |
| Tier Grouping | `lib/llm-decision-engine.ts` | 1200-1250 |
| Clinical Ranking LLM | `lib/llm-decision-engine.ts` | 600-1100 |
| RAG Retrieval | `lib/llm-decision-engine.ts` | 495-590 |

---

## What Was Removed

### ❌ Removed from OLD System:
1. **Quadrant Determination** - No longer categorizing stable_optimal, stable_suboptimal, etc.
2. **Dose Reduction Detection** - Not parsing current dosing for reduction
3. **Triage Decision** - No longer asking "should we optimize?"
4. **Remission Status Field** - Not collected or used
5. **Time in Remission** - Already removed
6. **Optimization Logic** - No cost optimization for stable patients
7. **Cessation Recommendations** - Never recommend stopping

### ✅ Kept from OLD System:
1. **Drug Filtering** - Contraindications, indications, formulary
2. **RAG Knowledge Base** - Evidence retrieval
3. **LLM Recommendation Generation** - Clinical reasoning
4. **Comorbidity Matching** - PsA, Asthma+AD considerations
5. **Tier Prioritization** - Cost-conscious selection

---

## Future Enhancements

### Planned:
1. **BMI-based contraindications**
   - Currently noted in recommendations
   - Future: Hard exclude if BMI creates absolute contraindication

2. **Medication type filtering**
   - Input field exists
   - Fully implement topical recommendations

3. **Real-time formulary updates**
   - Integration with live formulary feeds
   - Dynamic tier updates

4. **Patient outcome tracking**
   - Track which recommendations were accepted
   - Measure real-world effectiveness

---

## Questions or Clarifications?

This simplified system focuses on one core function: **helping providers choose the best on-formulary biologic for their patient.**

**Last Updated:** December 2025 (v2.0 - Simplified Architecture)
