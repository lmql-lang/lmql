# PLDI #737 Programming Large Language Models, Artifact Evaluation

This file includes the results obtained by the paper's authors, using the evaluation scripts in this repository. It should serve as a reference for artifact evaluators.

### table3.txt

```
Evaluated Samples:

Odd One Out Samples:
- Standard Decoding         86.0000
- LMQL                      86.0000

Date Understanding Samples:
- Standard Decoding        369.0000
- LMQL                     369.0000

Table 3 (GPT-J-6B)

                  | Standard Decoding |              LMQL |              diff |      cost savings |
                  | ----------------- | ----------------- | ----------------- | ----------------- |
                  |                   |                   |
Odd One Out
                  |                   |                   |
         Accuracy |            0.3256 |            0.3256 |             0.00% |
 generate() calls |            6.9535 |            5.9535 |           -14.38% |
    Model Queries |           52.9767 |           40.8488 |           -22.89% |
  Billable Tokens |          993.4070 |          849.6512 |           -14.47% |          $-0.0029 |

Date Understanding
                  |                   |                   |
         Accuracy |            0.1707 |            0.2276 |             5.69% |
 generate() calls |            7.8428 |            6.8428 |           -12.75% |
    Model Queries |           63.3713 |           57.2602 |            -9.64% |
  Billable Tokens |         3291.8238 |         2843.7615 |           -13.61% |          $-0.0090 |
```

### table4.txt

```
Table 4.

                  | Standard Decoding |              LMQL |
                  | ----------------- | ----------------- |
                  |                   |                   |
ReAct
                  |                   |                   |
 generate() calls |            5.0000 |            1.0000 |           -80.00% |
    Model Queries |          150.0000 |           95.0000 |           -36.67% |
  Billable Tokens |         3404.0000 |          807.0000 |           -76.29% |          $-0.0519 |


Arithmetic Evaluation
                  |                   |                   |
 generate() calls |            7.0000 |            1.0000 |           -85.71% |
    Model Queries |          210.0000 |           71.0000 |           -66.19% |
  Billable Tokens |         3649.0000 |          550.0000 |           -84.93% |          $-0.0620 |
```

### fig12.txt
```

Figure 12 (Values)
Step Size  |         Queries |generate() calls | Billable Tokens |
       20  |        120.0000 |          6.0000 |       4069.0000 |
       30  |        150.0000 |          5.0000 |       3404.0000 |
       40  |        200.0000 |          5.0000 |       3474.0000 |
       50  |        250.0000 |          5.0000 |       3534.0000 |
```

### table3_revised.txt
```
Evaluated Samples:

Odd One Out Samples:
- Standard Decoding         84.0000
- LMQL                      84.0000

Date Understanding Samples:
- Standard Decoding        367.0000
- LMQL                     367.0000

Table 3 (local:EleutherAI/gpt-j-6B)

                  | Standard Decoding |              LMQL |              diff |      cost savings |
                  | ----------------- | ----------------- |
                  |                   |                   |
Odd One Out
                  |                   |                   |
         Accuracy |            0.3333 |            0.3452 |             1.19% |
 generate() calls |            7.9643 |            5.9643 |           -25.11% |
    Model Queries |           73.0357 |           41.5119 |           -43.16% |
  Billable Tokens |         1178.7143 |          861.3214 |           -26.93% |          $-0.0063 |

Date Understanding
                  |                   |                   |
         Accuracy |            0.2289 |            0.2289 |             0.00% |
 generate() calls |            9.8447 |            6.8447 |           -30.47% |
    Model Queries |          103.3787 |           57.2589 |           -44.61% |
  Billable Tokens |         4131.2725 |         2844.9046 |           -31.14% |          $-0.0257 |

Table 3 (openai/text-davinci-003)

                  | Standard Decoding |              LMQL |              diff |      cost savings |
                  | ----------------- | ----------------- | ----------------- | ----------------- |
                  |                   |                   |
Odd One Out
                  |                   |                   |
         Accuracy |            0.4286 |            0.4286 |             0.00% |
 generate() calls |            7.5357 |            6.0238 |           -20.06% |
    Model Queries |            0.0000 |            0.0000 |             0.00% |
  Billable Tokens |         1072.4524 |          849.1548 |           -20.82% |          $-0.0045 |

Date Understanding
                  |                   |                   |
         Accuracy |            0.8529 |            0.8610 |             0.81% |
 generate() calls |            8.7493 |            8.5204 |            -2.62% |
    Model Queries |            0.0000 |            0.0000 |             0.00% |
  Billable Tokens |         3660.8501 |         3557.9346 |            -2.81% |          $-0.0021 |

Table 3 (facebook/opt-30B)

                  | Standard Decoding |              LMQL |              diff |      cost savings |
                  | ----------------- | ----------------- | ----------------- | ----------------- |
                  |                   |                   |   
Odd One Out    
                  |                   |                   |   
         Accuracy |            0.3452 |            0.3452 |             0.00% |
 generate() calls |            7.9643 |            5.9643 |           -25.11% |
    Model Queries |           73.0357 |           40.7024 |           -44.27% |
  Billable Tokens |         1173.2143 |          856.1667 |           -27.02% |          $-0.0063 |

Date Understanding
                  |                   |                   |   
         Accuracy |            0.2916 |            0.2916 |             0.00% |
 generate() calls |            9.8447 |            6.8447 |           -30.47% |
    Model Queries |          103.3787 |           57.0027 |           -44.86% |
  Billable Tokens |         4129.5504 |         2842.9264 |           -31.16% |          $-0.0257 |      

```