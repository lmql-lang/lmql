from evaluation.eval import results, check_results, shell, set_distribution
import sys

MODEL = "local:gpt2-xl"

set_distribution("latest")

def summary():
    s = f"""
Figure 12 (Values)
Step Size  |         Queries |generate() calls | Billable Tokens |
       20  | {results("react", "hf-20", MODEL, "Queries", raw=True)} | {results("react", "hf-20", MODEL, "generate()calls", raw=True)} | {results("react", "hf-20", MODEL, "billabletokens", raw=True)} |
       30  | {results("react", "hf-30", MODEL, "Queries", raw=True)} | {results("react", "hf-30", MODEL, "generate()calls", raw=True)} | {results("react", "hf-30", MODEL, "billabletokens", raw=True)} |
       40  | {results("react", "hf-40", MODEL, "Queries", raw=True)} | {results("react", "hf-40", MODEL, "generate()calls", raw=True)} | {results("react", "hf-40", MODEL, "billabletokens", raw=True)} |
       50  | {results("react", "hf-50", MODEL, "Queries", raw=True)} | {results("react", "hf-50", MODEL, "generate()calls", raw=True)} | {results("react", "hf-50", MODEL, "billabletokens", raw=True)} |
"""
    open("fig12.txt", "w").write(s)
    print(s)

print("[1/4] Arithmetic Step Size 20")
if not check_results("react", "hf-20", MODEL):
  shell(f"cd evaluation/react && python react_python.py {MODEL} 20")

print("[2/4] Arithmetic Step Size 30")
if not check_results("react", "hf-30", MODEL):
  shell(f"cd evaluation/react && python react_python.py {MODEL} 30")
  
print("[3/4] Arithmetic Step Size 40")
if not check_results("react", "hf-40", MODEL):
  shell(f"cd evaluation/react && python react_python.py {MODEL} 40")

print("[4/4] Arithmetic Step Size 50")
if not check_results("react", "hf-50", MODEL):
  shell(f"cd evaluation/react && python react_python.py {MODEL} 50")

summary()
