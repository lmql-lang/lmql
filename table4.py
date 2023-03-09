from evaluation.eval import *

MODEL = "local:EleutherAI/gpt-j-6B"
MODEL_REACT = "local:gpt2-xl"

set_distribution("latest")

def summary():
    s = f"""
Table 4.

                  | Standard Decoding |              LMQL |
                  | ----------------- | ----------------- |
                  |                   |                   |   
ReAct    
                  |                   |                   |   
 generate() calls |{diff_and_cost(results("react", "hf-30", MODEL_REACT, "generate()calls", raw=True), results("react", "query.lmql", MODEL_REACT, "generate()calls", raw=True))} |
    Model Queries |{diff_and_cost(results("react", "hf-30", MODEL_REACT, "Queries", raw=True), results("react", "query.lmql", MODEL_REACT, "Queries", raw=True))} |
  Billable Tokens |{diff_and_cost(results("react", "hf-30", MODEL_REACT, "billabletokens", raw=True), results("react", "query.lmql", MODEL_REACT, "billabletokens", raw=True), cost=True)} |


Arithmetic Evaluation    
                  |                   |                   |   
 generate() calls |{diff_and_cost(results("arithmetic", "hf-30", MODEL, "generate()calls", raw=True), results("arithmetic", "query.lmql", MODEL, "generate()calls", raw=True))} |
    Model Queries |{diff_and_cost(results("arithmetic", "hf-30", MODEL, "Queries", raw=True), results("arithmetic", "query.lmql", MODEL, "Queries", raw=True))} |
  Billable Tokens |{diff_and_cost(results("arithmetic", "hf-30", MODEL, "billabletokens", raw=True), results("arithmetic", "query.lmql", MODEL, "billabletokens", raw=True), cost=True)} |


    """
    open("table4.txt", "w").write(s)
    print(s)

print("[1/4] Arithmetic HF Step Size 30")
if not check_results("arithmetic", "hf-30", MODEL):
  shell(f"cd evaluation/arithmetic && python arith_python.py {MODEL} 30")

print("[2/4] Arithmetic LMQL")
if not check_results("arithmetic", "query.lmql", MODEL):
  shell(f"cd evaluation/arithmetic && python arith_lmql.py {MODEL}")
  
print("[3/4] react HF Step Size 30")
if not check_results("react", "hf-30", MODEL_REACT):
  shell(f"cd evaluation/react && python react_python.py {MODEL_REACT} 30")

print("[4/4] react LMQL")
if not check_results("react", "query.lmql", MODEL_REACT):
  shell(f"cd evaluation/react && python react_lmql.py {MODEL_REACT}")

summary()
