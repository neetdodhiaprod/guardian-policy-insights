# Guardian Policy Insights — Taxonomy V1 (Full)

This taxonomy is designed for **database ingestion** of Indian health insurance policy wordings.

Each taxonomy item should be captured (when present) with:
- `value` (normalized)
- `quote` (direct evidence)
- `reference` (page/section; if page unknown use best available section identifier)
- optional: `notes` / `conditions`

## A) Policy identification & metadata
1. Insurer name
2. Policy/product name
3. Variant/plan name
4. UIN
5. Document type (policy wording / brochure / schedule / mixed)
6. Effective date / version date (if stated)
7. Policy type (Individual / Family floater / Multi-individual)
8. Tenure options
9. Renewability (lifelong?)
10. Grace period
11. Free-look period
12. Portability & waiting-period credit transfer

## B) Eligibility & insured definition
13. Entry age (adult)
14. Entry age (child)
15. Maximum age / no-capping
16. Family definition (adults/children cap)
17. Relationships covered
18. Sum insured options / bands
19. Room category entitlement rule (if any)

## C) Waiting periods (core)
20. Initial waiting period (days) + accident exception
21. Pre-existing disease (PED) waiting period (months)
22. PED waiting modification option (12/24/36/48 etc.) + eligibility constraints
23. Specific disease/procedure waiting (months)
24. Longer-of-two rule (PED vs specified)
25. Maternity waiting (months) (store but don’t auto-flag)
26. Newborn cover waiting/conditions (if present)
27. Day-1 cover for chronic conditions (if present)

## D) Room rent & ICU (claim leakage risk)
28. Room rent limit type: any-room / single private AC / % of SI / rupee cap
29. ICU/ICCU limit type
30. Proportionate deduction on room rent rule
31. Exceptions to proportionate deduction (ICU exception etc.)
32. Boarding/nursing/OT inclusion rules

## E) Cost sharing (co-pay/deductibles)
33. Co-pay default present? (Y/N)
34. Co-pay % value(s)
35. Co-pay triggers (age, zone, network, non-PPN, etc.)
36. Co-pay optional trade-off (discount plan / add-on) vs mandatory
37. Deductible type: aggregate annual / per-claim / rider-based
38. Deductible amount and when it applies

## F) Core coverages (hospitalization)
39. Inpatient hospitalization coverage definition (24h rule + exceptions)
40. Day care treatments (covered? list vs all)
41. Pre-hospitalization days
42. Post-hospitalization days
43. Domiciliary hospitalization (covered? min days? conditions)
44. Home healthcare (covered? cashless-only? reimbursement?)
45. Road ambulance (limit)
46. Air ambulance (limit)
47. Organ donor expenses (covered? exclusions like transport/preservation)
48. AYUSH inpatient coverage + sub-limit
49. Modern treatments/advanced procedures coverage + caps
50. Mental illness hospitalization coverage (if present)
51. Obesity/bariatric coverage conditions (if present)
52. HIV/AIDS cover (if present)

## G) Restore / recharge / refill / reload (benefit engineering)
53. Restore present (Y/N)
54. Restore amount (100% / 50% / 2x etc.)
55. Restore trigger (partial vs full exhaustion)
56. Restore frequency (once/year vs unlimited)
57. Restore same-illness allowed? (Y/N)
58. Restore carry-forward? (Y/N)
59. Restore constraints (only subsequent claims, not for first claim, etc.)

## H) Bonus / credits / boosters (renewal dynamics)
60. No-claim bonus / cumulative bonus rate
61. NCB cap
62. NCB reduction on claim
63. Plus benefit / secure benefit / super credit equivalents (name + rules)
64. Accumulation irrespective of claims? (Y/N)

## I) Sub-limits & caps (other)
65. Non-medical expenses waiver / consumables cover (present? list-based?)
66. Cataract cap (if present)
67. Hernia/hydrocele cap (if present)
68. Knee/hip replacement cap (if present)
69. OPD cover (if present)
70. Health check-up benefit (if present)
71. Preventive wellness rewards (if present)

## J) Network & claims process
72. Cashless availability (network) + pre-auth requirement
73. Reimbursement conditions
74. Claim timelines / intimation timelines
75. Waiting period credit on portability
76. Excluded providers / blacklist clause

## K) Geography & international
77. Coverage territory (India vs worldwide)
78. Global emergency-only vs planned options
79. Global deductibles / claim settlement mode

## L) Exclusions handling (for classification logic)
80. Standard IRDAI exclusions (do not auto-flag)
81. Non-standard restrictive exclusions (flag only with evidence)

---

## Notes for implementation
- Treat this taxonomy as **a floor**: always attempt to populate core items; allow `topic="other"` for genuinely unique clauses.
- For V1 database creation without human review, prefer a conservative stance: missing evidence → null/unclear.
