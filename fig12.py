from evaluation.eval import results, check_results, shell, set_distribution
import sys

MODEL = "local:gpt2-xl"

set_distribution("latest")

def summary():
    s = f"""
Figure 12 (Values)

Method            | Chunk Size  |         Queries |generate() calls | Billable Tokens |
------------------|-------------|-----------------|-----------------|-----------------|
Standard Decoding |         20  | {results("react", "hf-20", MODEL, "Queries", raw=True)} | {results("react", "hf-20", MODEL, "generate()calls", raw=True)} | {results("react", "hf-20", MODEL, "billabletokens", raw=True)} |
                  |         30  | {results("react", "hf-30", MODEL, "Queries", raw=True)} | {results("react", "hf-30", MODEL, "generate()calls", raw=True)} | {results("react", "hf-30", MODEL, "billabletokens", raw=True)} |
                  |         40  | {results("react", "hf-40", MODEL, "Queries", raw=True)} | {results("react", "hf-40", MODEL, "generate()calls", raw=True)} | {results("react", "hf-40", MODEL, "billabletokens", raw=True)} |
                  |         50  | {results("react", "hf-50", MODEL, "Queries", raw=True)} | {results("react", "hf-50", MODEL, "generate()calls", raw=True)} | {results("react", "hf-50", MODEL, "billabletokens", raw=True)} |

LMQL              |          -  | {results("react", "query.lmql", MODEL, "Queries", raw=True)} | {results("react", "query.lmql", MODEL, "generate()calls", raw=True)} | {results("react", "query.lmql", MODEL, "billabletokens", raw=True)} |
    
"""
    open("fig12.txt", "w").write(s)
    print(s)

print("[1/5] ReAct Chunk Size 20")
if not check_results("react", "hf-20", MODEL):
  shell(f"cd evaluation/react && python react_python.py {MODEL} 20")

print("[2/5] ReAct Chunk Size 30")
if not check_results("react", "hf-30", MODEL):
  shell(f"cd evaluation/react && python react_python.py {MODEL} 30")
  
print("[3/5] ReAct Chunk Size 40")
if not check_results("react", "hf-40", MODEL):
  shell(f"cd evaluation/react && python react_python.py {MODEL} 40")

print("[4/5] ReAct Chunk Size 50")
if not check_results("react", "hf-50", MODEL):
  shell(f"cd evaluation/react && python react_python.py {MODEL} 50")

print("[5/5] ReAct LMQL Decoding")
if not check_results("react", "query.lmql", MODEL):
  shell(f"cd evaluation/react && python react_lmql.py {MODEL}")

summary()
