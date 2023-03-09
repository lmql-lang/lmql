from evaluation.eval import *

MODEL = "local:EleutherAI/gpt-j-6B"

set_distribution("latest")

def summary():
    s = f"""
Evaluated Samples:
    
Odd One Out Samples:
- Standard Decoding {results("odd_one_out", "hf", MODEL, "num_samples")}
- LMQL              {results("odd_one_out", "query.lmql", MODEL, "num_samples")}

Date Understanding Samples:
- Standard Decoding {results("date_understanding", "hf", MODEL, "num_samples")}
- LMQL              {results("date_understanding", "query.lmql", MODEL, "num_samples")}

Table 3 (GPT-J-6B)

                  | Standard Decoding |              LMQL |              diff |      cost savings |
                  | ----------------- | ----------------- | ----------------- | ----------------- |
                  |                   |                   |   
Odd One Out    
                  |                   |                   |   
         Accuracy |{diff_and_cost(results("odd_one_out", "hf", MODEL, "Accuracy"), results("odd_one_out", "query.lmql", MODEL, "Accuracy"))} |
 generate() calls |{diff_and_cost(results("odd_one_out", "hf", MODEL, "generate()calls"), results("odd_one_out", "query.lmql", MODEL, "generate()calls"))} |
    Model Queries |{diff_and_cost(results("odd_one_out", "hf", MODEL, "Queries"), results("odd_one_out", "query.lmql", MODEL, "Queries"))} |
  Billable Tokens |{diff_and_cost(results("odd_one_out", "hf", MODEL, "billabletokens"), results("odd_one_out", "query.lmql", MODEL, "billabletokens"), cost=True)} |

Date Understanding
                  |                   |                   |   
         Accuracy |{diff_and_cost(results("date_understanding", "hf", MODEL, "Accuracy"), results("date_understanding", "query.lmql", MODEL, "Accuracy"))} |
 generate() calls |{diff_and_cost(results("date_understanding", "hf", MODEL, "generate()calls"), results("date_understanding", "query.lmql", MODEL, "generate()calls"))} |
    Model Queries |{diff_and_cost(results("date_understanding", "hf", MODEL, "Queries"), results("date_understanding", "query.lmql", MODEL, "Queries"))} |
  Billable Tokens |{diff_and_cost(results("date_understanding", "hf", MODEL, "billabletokens"), results("date_understanding", "query.lmql", MODEL, "billabletokens"), cost=True)} |
    """
    open("table3.txt", "w").write(s)
    print(s)

print("[1/4] Odd One Out (HF)...")
if not check_results("odd_one_out", "hf", MODEL):
  shell(f"python -m eval odd_one_out hf --model {MODEL}")

print("[2/4] Odd One Out (LMQL)...")
if not check_results("odd_one_out", "query.lmql", MODEL):
  shell(f"python -m eval odd_one_out query.lmql --model {MODEL}")

print("[3/4] Date Understanding (HF)...")
if not check_results("date_understanding", "hf", MODEL):
  shell(f"python -m eval date_understanding hf --model {MODEL}")
  
print("[4/4] Date Understanding (LMQL)...")
if not check_results("date_understanding", "query.lmql", MODEL):
  shell(f"python -m eval date_understanding query.lmql --model {MODEL}")

summary()
