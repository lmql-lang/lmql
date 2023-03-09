from evaluation.eval import *
import sys

MODEL = "local:EleutherAI/gpt-j-6B"

set_distribution("latest")

def summary():
    s = f"""
Evaluated Samples:
    
Odd One Out Samples:
- Standard Decoding {results("revised:odd_one_out", "hf", MODEL, "num_samples")}
- LMQL              {results("revised:odd_one_out", "query.lmql", MODEL, "num_samples")}

Date Understanding Samples:
- Standard Decoding {results("revised:date_understanding", "hf", MODEL, "num_samples")}
- LMQL              {results("revised:date_understanding", "query.lmql", MODEL, "num_samples")}

Table 3 (local:EleutherAI/gpt-j-6B)

                  | Standard Decoding |              LMQL |              diff |      cost savings |
                  | ----------------- | ----------------- |
                  |                   |                   |   
Odd One Out    
                  |                   |                   |   
         Accuracy |{diff_and_cost(results("revised:odd_one_out", "hf", MODEL, "Accuracy"), results("revised:odd_one_out", "query.lmql", MODEL, "Accuracy"))} |
 generate() calls |{diff_and_cost(results("revised:odd_one_out", "hf", MODEL, "generate()calls"), results("revised:odd_one_out", "query.lmql", MODEL, "generate()calls"))} |
    Model Queries |{diff_and_cost(results("revised:odd_one_out", "hf", MODEL, "Queries"), results("revised:odd_one_out", "query.lmql", MODEL, "Queries"))} |
  Billable Tokens |{diff_and_cost(results("revised:odd_one_out", "hf", MODEL, "billabletokens"), results("revised:odd_one_out", "query.lmql", MODEL, "billabletokens"), cost=True)} |

Date Understanding
                  |                   |                   |   
         Accuracy |{diff_and_cost(results("revised:date_understanding", "hf", MODEL, "Accuracy"), results("revised:date_understanding", "query.lmql", MODEL, "Accuracy"))} |
 generate() calls |{diff_and_cost(results("revised:date_understanding", "hf", MODEL, "generate()calls"), results("revised:date_understanding", "query.lmql", MODEL, "generate()calls"))} |
    Model Queries |{diff_and_cost(results("revised:date_understanding", "hf", MODEL, "Queries"), results("revised:date_understanding", "query.lmql", MODEL, "Queries"))} |
  Billable Tokens |{diff_and_cost(results("revised:date_understanding", "hf", MODEL, "billabletokens"), results("revised:date_understanding", "query.lmql", MODEL, "billabletokens"), cost=True)} |
    
Table 3 (openai/text-davinci-003)

                  | Standard Decoding |              LMQL |              diff |      cost savings |
                  | ----------------- | ----------------- | ----------------- | ----------------- |
                  |                   |                   |   
Odd One Out    
                  |                   |                   |   
         Accuracy |{diff_and_cost(results("revised:odd_one_out", "hf", "openai/text-davinci-003", "Accuracy"), results("revised:odd_one_out", "query.lmql", "openai/text-davinci-003", "Accuracy"))} |
 generate() calls |{diff_and_cost(results("revised:odd_one_out", "hf", "openai/text-davinci-003", "generate()calls"), results("revised:odd_one_out", "query.lmql", "openai/text-davinci-003", "generate()calls"))} |
    Model Queries |{diff_and_cost(results("revised:odd_one_out", "hf", "openai/text-davinci-003", "Queries"), results("revised:odd_one_out", "query.lmql", "openai/text-davinci-003", "Queries"))} |
  Billable Tokens |{diff_and_cost(results("revised:odd_one_out", "hf", "openai/text-davinci-003", "billabletokens"), results("revised:odd_one_out", "query.lmql", "openai/text-davinci-003", "billabletokens"), cost=True)} |

Date Understanding
                  |                   |                   |   
         Accuracy |{diff_and_cost(results("revised:date_understanding", "hf", "openai/text-davinci-003", "Accuracy"), results("revised:date_understanding", "query.lmql", "openai/text-davinci-003", "Accuracy"))} |
 generate() calls |{diff_and_cost(results("revised:date_understanding", "hf", "openai/text-davinci-003", "generate()calls"), results("revised:date_understanding", "query.lmql", "openai/text-davinci-003", "generate()calls"))} |
    Model Queries |{diff_and_cost(results("revised:date_understanding", "hf", "openai/text-davinci-003", "Queries"), results("revised:date_understanding", "query.lmql", "openai/text-davinci-003", "Queries"))} |
  Billable Tokens |{diff_and_cost(results("revised:date_understanding", "hf", "openai/text-davinci-003", "billabletokens"), results("revised:date_understanding", "query.lmql", "openai/text-davinci-003", "billabletokens"), cost=True)} |
    """
    
    if "--with-opt-30b" in sys.argv:
      s += f"""
Table 3 (facebook/opt-30B)

                  | Standard Decoding |              LMQL |              diff |      cost savings |
                  | ----------------- | ----------------- | ----------------- | ----------------- |
                  |                   |                   |   
Odd One Out    
                  |                   |                   |   
         Accuracy |{diff_and_cost(results("revised:odd_one_out", "hf", "local:facebook/opt-30B", "Accuracy"), results("revised:odd_one_out", "query.lmql", "local:facebook/opt-30B", "Accuracy"))} |
 generate() calls |{diff_and_cost(results("revised:odd_one_out", "hf", "local:facebook/opt-30B", "generate()calls"), results("revised:odd_one_out", "query.lmql", "local:facebook/opt-30B", "generate()calls"))} |
    Model Queries |{diff_and_cost(results("revised:odd_one_out", "hf", "local:facebook/opt-30B", "Queries"), results("revised:odd_one_out", "query.lmql", "local:facebook/opt-30B", "Queries"))} |
  Billable Tokens |{diff_and_cost(results("revised:odd_one_out", "hf", "local:facebook/opt-30B", "billabletokens"), results("revised:odd_one_out", "query.lmql", "local:facebook/opt-30B", "billabletokens"), cost=True)} |

Date Understanding
                  |                   |                   |   
         Accuracy |{diff_and_cost(results("revised:date_understanding", "hf", "local:facebook/opt-30B", "Accuracy"), results("revised:date_understanding", "query.lmql", "local:facebook/opt-30B", "Accuracy"))} |
 generate() calls |{diff_and_cost(results("revised:date_understanding", "hf", "local:facebook/opt-30B", "generate()calls"), results("revised:date_understanding", "query.lmql", "local:facebook/opt-30B", "generate()calls"))} |
    Model Queries |{diff_and_cost(results("revised:date_understanding", "hf", "local:facebook/opt-30B", "Queries"), results("revised:date_understanding", "query.lmql", "local:facebook/opt-30B", "Queries"))} |
  Billable Tokens |{diff_and_cost(results("revised:date_understanding", "hf", "local:facebook/opt-30B", "billabletokens"), results("revised:date_understanding", "query.lmql", "local:facebook/opt-30B", "billabletokens"), cost=True)} |      
"""
    
    open("table3_revised.txt", "w").write(s)
    print(s)

print("[1/8] Odd One Out (HF)...")
if not check_results("revised:odd_one_out", "hf", MODEL):
  shell(f"python -m eval revised:odd_one_out hf --model {MODEL}")

print("[2/8] Odd One Out (LMQL)...")
if not check_results("revised:odd_one_out", "query.lmql", MODEL):
  shell(f"python -m eval revised:odd_one_out query.lmql --model {MODEL}")

print("[3/8] Date Understanding (HF)...")
if not check_results("revised:date_understanding", "hf", MODEL):
  shell(f"python -m eval revised:date_understanding hf --model {MODEL}")
  
print("[4/8] Date Understanding (LMQL)...")
if not check_results("revised:date_understanding", "query.lmql", MODEL):
  shell(f"python -m eval revised:date_understanding query.lmql --model {MODEL}")

print("[5/8] Odd One Out (HF)...")
if not check_results("revised:odd_one_out", "hf", "openai/text-davinci-003"):
  shell(f"python -m eval revised:odd_one_out hf --model openai/text-davinci-003")

print("[6/8] Odd One Out (LMQL)...")
if not check_results("revised:odd_one_out", "query.lmql", "openai/text-davinci-003"):
  shell(f"python -m eval revised:odd_one_out query.lmql --model openai/text-davinci-003")

print("[7/8] Date Understanding (HF)...")
if not check_results("revised:date_understanding", "hf", "openai/text-davinci-003"):
  shell(f"python -m eval revised:date_understanding hf --model openai/text-davinci-003")
  
print("[8/8] Date Understanding (LMQL)...")
if not check_results("revised:date_understanding", "query.lmql", "openai/text-davinci-003"):
  shell(f"python -m eval revised:date_understanding query.lmql --model openai/text-davinci-003")

if "--with-opt-30b" in sys.argv:
  print("Running extra experiments with OPT-30B...")
  
  print("OPT-30B [1/4] Odd One Out (HF)...")
  if not check_results("revised:odd_one_out", "hf", "local:facebook/opt-30B"):
    shell(f"python -m eval revised:odd_one_out hf --model local:facebook/opt-30B")

  print("OPT-30B [2/4] Odd One Out (LMQL)...")
  if not check_results("revised:odd_one_out", "query.lmql", "local:facebook/opt-30B"):
    shell(f"python -m eval revised:odd_one_out query.lmql --model local:facebook/opt-30B")

  print("OPT-30B [3/4] Date Understanding (HF)...")
  if not check_results("revised:date_understanding", "hf", "local:facebook/opt-30B"):
    shell(f"python -m eval revised:date_understanding hf --model local:facebook/opt-30B")
    
  print("OPT-30B [4/4] Date Understanding (LMQL)...")
  if not check_results("revised:date_understanding", "query.lmql", "local:facebook/opt-30B"):
    shell(f"python -m eval revised:date_understanding query.lmql --model local:facebook/opt-30B")

summary()
