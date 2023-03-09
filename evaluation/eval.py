import argparse
import os
import sys
import subprocess
import pandas as pd
import termcolor

global prefer_msg_send
prefer_msg_send = False

def check_results(dataset, method, model):
    if "--run-all" in set(sys.argv):
        return False
    
    model = model.replace("/", "-")
    
    prefix = ""
    if dataset.startswith("pldi:"):
        prefix =  "pldi-"
        dataset = dataset[len("pldi:"):]
    elif dataset.startswith("revised:"):
        prefix =  "revised-"
        dataset = dataset[len("revised:"):]
    elif any(arg.startswith("--prefer-tag=") for arg in sys.argv):
        preferred_tag = [arg[len("--prefer-tag="):] for arg in sys.argv if arg.startswith("--prefer-tag=")][0]
        prefixed_results_file = os.path.join(os.path.dirname(__file__), dataset, "results", f"{preferred_tag}-results.csv-{method}-{model}.txt")
        if os.path.exists(prefixed_results_file):
            prefix = f"{preferred_tag}-"
        
        global prefer_msg_send
        if not prefer_msg_send:
            prefer_msg_send = True
            print("Preferring tagged result files", preferred_tag)
    
    result_file_candidates = [
        os.path.join(os.path.dirname(__file__), dataset, "results", f"{prefix}results.csv-{method}-{model}.txt"),
        os.path.join(os.path.dirname(__file__), dataset, "results", f"{prefix}results.csv-{method}-local:{model}.txt")
    ]
    result_file_template = os.path.join(os.path.dirname(__file__), dataset, "results", f"{prefix}results.csv-{method}-{model}.txt")
    
    score_file_candidates = [
        os.path.join(os.path.dirname(__file__), dataset, "results", f"{prefix}score-{method}-{model}.txt"),
        os.path.join(os.path.dirname(__file__), dataset, "results", f"{prefix}score-{method}-local:{model}.txt")
    ]
    score_file_template = os.path.join(os.path.dirname(__file__), dataset, "results", f"{prefix}score-{method}-{model}.txt")
    
    present = True
    
    print(" Checking for results in", result_file_template.ljust(140), end="")
    if not any(os.path.exists(f) for f in result_file_candidates):
        print("[NOT FOUND]")
        present = False
    else:
        print("[FOUND]")
    
    print(" Checking for scores in", score_file_template.ljust(141), end="")
    if not any(os.path.exists(f) for f in score_file_candidates):
        print("[NOT FOUND]")
        present = False
    else:
        print("[FOUND]")
        
    return present

global distribution 
distribution = "latest"

def set_distribution(dist):
    global distribution
    distribution = dist

def shell(cmd):
  print(" [Running required evaluation script.]")
  
  env = os.environ.copy()
  eval_dir = os.path.dirname(os.path.abspath(__file__))
  env["PYTHONPATH"] = env.get("PYTHONPATH", "") + ":" + f"{eval_dir}/:" + ":" + f"{eval_dir}/../{distribution}"
  print(" PYTHONPATH", env["PYTHONPATH"])
  
  if "--dry" in set(sys.argv): 
    print(" [SKIPPED] > ", cmd, end="\n\n")
    return
  else:
    print(" > ", cmd, end="\n\n")
    subprocess.run(cmd, shell=True, check=True, env=env)

def diff_and_cost(baseline_result, lmql_result, cost=False):
    values = [baseline_result, lmql_result]
    
    if "NOT FOUND" in baseline_result or "NOT FOUND" in lmql_result:
        values += ["-"]
        if cost: values += ["-"]
    else:
        baseline_num = float(baseline_result)
        lmql_num = float(lmql_result)
        diff = (lmql_num - baseline_num)
        values.append(f"{(100*diff/max(1,baseline_num)):.2f}%")
        
        if cost:
            savings = diff * 0.02/1000 # text-davinci-3 is 0.02$/1000 tokens
            values.append(f"${savings:.4f}")
    
    # left pad all values
    return " |".join(v.rjust(18) for v in values)

def results(*fargs, raw=False):
    if len(fargs) > 0:
        args = fargs
    else:
        args = sys.argv[2:]
    assert len(args) >= 3, "Usage: lmql-eval results <dataset> <method> <model> [<metric>]"
    dataset, method, model, *rest = args
    
    model = model.replace("/", "-")
    
    prefix = ""
    if dataset.startswith("pldi:"):
        prefix =  "pldi-"
        dataset = dataset[len("pldi:"):]
    elif dataset.startswith("revised:"):
        prefix =  "revised-"
        dataset = dataset[len("revised:"):]
    elif any(arg.startswith("--prefer-tag=") for arg in sys.argv):
        preferred_tag = [arg[len("--prefer-tag="):] for arg in sys.argv if arg.startswith("--prefer-tag=")][0]
        prefixed_results_file = os.path.join(os.path.dirname(__file__), dataset, "results", f"{preferred_tag}-results.csv-{method}-{model}.txt")
        if os.path.exists(prefixed_results_file):
            prefix = f"{preferred_tag}-"
    
    results_file = os.path.join(os.path.dirname(__file__), dataset, "results", f"{prefix}results.csv-{method}-{model}.txt")
    
    if not os.path.exists(results_file):
        # check if we can find a results with the non-local model
        if model.startswith("local:"):
            model = model[len("local:"):]
        local_results_file = os.path.join(os.path.dirname(__file__), dataset, "results", f"{prefix}results.csv-{method}-{model}.txt")
        if os.path.exists(local_results_file):
            # if so, just rely on model without the local: prefix
            results_file = local_results_file
        else:
            # print("Could not find result file at", results_file)
            return termcolor.colored("NOT FOUND".rjust(15), "red")
    
    if not raw:
        df = pd.read_csv(results_file)
        num_samples = len(df)
    else:
        df = None
        num_samples = 1
    
    score_file = os.path.join(os.path.dirname(__file__), dataset, "results", f"{prefix}score-{method}-{model}.txt")
    
    with open(score_file, "r") as f:
        data = {}
        for line in f:
            if line.strip() == "":
                continue
            metric, value = line.split(": ")
            value = value.strip()
            value = float(value)
            if metric != "Accuracy" and not raw:
                value = value / num_samples
            metric = metric.replace(" ", "")
            data[metric] = value
    
    if df is not None and "correct_item" in df.columns:
        accuracy = (df["correct_item"] == df["result_item"]).mean()
        data["Accuracy"] = accuracy
    data["num_samples"] = num_samples
    
    for m in rest:
        k = m.replace(" ", "")
        if not k in data.keys():
            return "Metric '{}' not found. Available metrics: {}".format(m, ", ".join(data.keys()))
        res = "%.4f" % data[m.replace(" ", "")]
        return res.rjust(15)
    if len(rest) == 0:
        return str(data)

actions = {
    "results": results
}

datasets = {
    "date_understanding": "date_understanding/date_understanding.py",
    "pldi:date_understanding": "date_understanding/date_understanding_pldi.py",
    "revised:date_understanding": "date_understanding/date_understanding_revised.py",
    "odd_one_out": "odd_one_out/odd_one_out.py",
    "pldi:odd_one_out": "odd_one_out/odd_one_out_pldi.py",
    "revised:odd_one_out": "odd_one_out/odd_one_out_revised.py",
}

def main():
    args = sys.argv[1:]
    
    if len(args) == 0:
        print("Usage: lmql-eval <dataset|action> [...options]")
        print("Available Actions:")
        for action in actions.keys():
            print("  - {}".format(action))
        print("Available Datasets:")
        for dataset in datasets.keys():
            print("  - {}".format(dataset))
        return
    
    dataset = args[0]
    
    if dataset in actions.keys():
        print(actions[dataset]())
        return
    
    assert dataset in datasets, "Not a valid dataset '{}'".format(dataset)
    suite = datasets[dataset]
    
    env = os.environ.copy()
    env["PYTHONPATH"] = env.get("PYTHONPATH", "") + ":" + \
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..")) + \
            os.path.abspath(os.path.dirname(__file__))
    
    suite = os.path.join(os.path.dirname(__file__), suite)
    cwd = os.path.dirname(suite)
    
    # make sure results/ exists for dataset
    results_folder = os.path.join(cwd, "results")
    os.makedirs(results_folder, exist_ok=True)
    
    print("> python {} {}".format(suite, " ".join(args[1:])))
    p = subprocess.call(["python", suite] + args[1:], env=env, cwd=cwd)

if __name__ == "__main__":
    main()

