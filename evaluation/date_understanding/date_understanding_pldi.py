import os
import torch
import pandas as pd
import asyncio
import math
import json
import sys
import random
import argparse
from tqdm import tqdm
from dataclasses import dataclass

from concurrent.futures import ProcessPoolExecutor

sys.path.append("../../")
sys.path.append("../")
import lmql

from pldi_utils.hf_baseline_prompter import HFPrompter

def get_data():
    if not os.path.exists("task.json"):
        os.system('wget https://raw.githubusercontent.com/google/BIG-bench/main/bigbench/benchmark_tasks/date_understanding/task.json')
    # compute sha1
    sha1 = os.popen("sha1sum task.json").read().split(" ")[0]
    assert "6c13a491698efd4b26672919ab918d42dd77afc9" == sha1, "The downloaded task.json has a sha1 mismatch with the expected one (expected: {}, got: {}).".format("6c13a491698efd4b26672919ab918d42dd77afc9", sha1)

    with open("task.json") as f:
        data = json.load(f)
    return data

# excluded samples, as they are used as few shot examples
excluded_samples = [
    # "Today is Christmas Eve of 1937. What is the date 10 days ago in MM/DD/YYYY?",
    # "Tomorrow is 11/12/2019. What is the date one year ago from today in MM/DD/YYYY?"
]

def get_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("method", type=str, help="Method to evaluate.")
    parser.add_argument("--model", type=str, help="Model to evaluate.", default="EleutherAI/gpt-j-6B")
    parser.add_argument("--num-samples", type=int, help="Number of samples to evaluate.", default=None, dest="num_samples")
    parser.add_argument("--workers", type=int, help="Number of workers to use.", default=1)
    return parser.parse_args()

args = get_args()

global module
module = None

@dataclass
class SampleResult:
    correct_item: str
    result_item: str
    result_probs: list
    interaction_trace: str
    query: str = None

async def process_lmql(d):
    a_to_z = ["(A)", "(B)", "(C)", "(D)", "(E)", "(F)", "(G)", "(H)", "(I)"]
    options = list(sorted(d["target_scores"].keys()))
    options_list = ", ".join(options)

    result = await module.query(QUESTION=d["input"], OPTIONS_LIST=options_list)

    if result is None or (type(result) is list and result[0] is None):
        result_item = "ERR"
        result_probs = [(x, 0.0) for x in options]
        reasoning = "<failed to decode full promtp>"
    else:
        result_item = result.variables.get("RESULT")
        result_probs = result.variables.get("P(RESULT)")
        reasoning = result.variables.get("REASONING")
    
    # translate multiple choice answers back
    if result_item.startswith("("):
        # print("translating back multiple choice result", result_item, end="")
        idx = a_to_z.index(result_item)
        result_item = options[idx]
    
    correct_item = sorted(d["target_scores"].items(), key=lambda x: x[1], reverse=True)[0][0]
    print("RESULT IS", [result_item], [correct_item])
    
    # return [correct_item, result_item, reasoning, options, result_probs] 
    return SampleResult(correct_item, result_item, result_probs, result.prompt, None)

async def baseline(d):
    options = ", ".join(sorted(d["target_scores"].keys()))
    correct_item = sorted(d["target_scores"].items(), key=lambda x: x[1], reverse=True)[0][0]

    idx = random.randint(0, len(d["target_scores"]) - 1)
    random_result = options.split(", ")[idx]
    return SampleResult(correct_item, random_result, d["target_scores"], None, None)

async def hf_baseline(d):
    options = sorted(d["target_scores"].keys())
    correct_item = sorted(d["target_scores"].items(), key=lambda x: x[1], reverse=True)[0][0]
    QUESTION = d["input"]

    a_to_z = ["(A)", "(B)", "(C)", "(D)", "(E)", "(F)", "(G)", "(H)", "(I)"]
    options = list(zip(a_to_z, options))
    options_list = "".join([f"{a} {o}\n" for a,o in options])

    prompt = f"""
Q:  Today is Christmas Eve of 1937. What is the date 10 days ago in MM/DD/YYYY?
Options:
(A) 12/14/2026
(B) 12/14/1950
(C) 12/14/2007
(D) 12/14/1937
(E) 07/14/1938
(F) 12/14/1988
A: Let's think step by step. 
If today is Christmas Eve of 1937, then today's date is December 24, 1937. 10 days before today is December 14, 1937, that is 12/14/1937.
So the answer is (D).

Q: Tomorrow is 11/12/2019. What is the date one year ago from today in MM/DD/YYYY?
Options:
(A) 09/04/2018
(B) 11/11/2018
(C) 08/25/2018
(D) 11/02/2018
(E) 11/04/2018
A: Let's think step by step. 
If tomorrow is 11/12/2019, then today is 11/11/2019. The date one year ago from today is 11/11/2018. 
So the answer is (B).

Q: {QUESTION}
Options:
{options_list}
A: Let's think step by step.
""".strip() + ""

    values = [a for a,o in options]
    hf = HFPrompter(args.model)
    
    prompt_with_reasoning = await hf.generate(prompt, max_new_tokens=40, stopping_phrases=["So the answer is"], step_size=20)
    reasoning = prompt_with_reasoning[len(prompt):].strip() + "\nSo the answer is "

    res = await hf.cond_logprob(prompt_with_reasoning + "\nSo the answer is ", values)
    result_item = max(res, key=lambda x: x[1])[0]
    probs = [(x[0], math.exp(x[1])) for x in res]
    original_result_item = result_item

    if result_item.startswith("("):
        # print("translating back multiple choice result", result_item, end="")
        idx = a_to_z.index(result_item)
        result_item = options[idx][1]

    return SampleResult(correct_item, result_item, probs, prompt_with_reasoning.strip() + "\n So the answer is " + original_result_item)

async def process_sample_task(d, sem):
    if d["input"] in excluded_samples:
        print("skipping ", d["input"], "Because it's excluded (selected as few-shot sample)")
    
    async with sem:
        if d["model"] == 'baseline':
            return await baseline(d)
        elif d["model"] == "hf":
            return await hf_baseline(d)
        elif d["model"].endswith(".lmql"):
            return await process_lmql(d)
        else:
            assert False, "Unknown model {}".format(d["model"])

def result_file(file):
    model_name_suffix = ""
    model = args.model.replace("/", "-")
    if model != "EleutherAI/gpt-j-6B" and model is not None:
        model_name_suffix = f"-{model}"
        
    # if args.num_samples is not None:
    #     model_name_suffix += f"-n{args.num_samples}"

    return f"results/pldi-{file}-{args.method}{model_name_suffix}.txt"

async def run_eval():
    model = args.method
    print(f"Running with {model}")
    data = get_data()

    global module
    if module is None and model.endswith(".lmql"):
        module = lmql.load(model, autoconnect=True, force_model=args.model)
        sem = asyncio.Semaphore(args.workers)
        module.query.output_writer = lmql.silent
    else:
        lmql.autoconnect()
        # for other baseline do not process in parallel
        sem = asyncio.Semaphore(1)

    results = []

    n = 0
    n_correct = 0.0

    results = []
    data = data["examples"]
    for d in data: d["model"] = model
    
    # check for samples limit
    if args.num_samples is not None:
        print("Evaluating only the first {} samples".format(args.num_samples))
        data = data[:args.num_samples]

    served_model = lmql.model_registry.get(args.model).served_model
    served_model.reset_stats()

    pbar = tqdm(asyncio.as_completed([process_sample_task(d, sem) for d in data]), total=len(data))
    for result in pbar:
        result = await result

        n += 1
        results += [result]

        result_item = result.result_item
        correct_item = result.correct_item
        n_correct += 1 if (result_item == correct_item) else 0
        
        df = pd.DataFrame([r.__dict__ for r in results])
        df.to_csv(result_file("results.csv"), index=False)

        pbar.set_description("Accuracy: {:.2f}, Queries: {}, Tokens/Prompt: {}".format(n_correct / max(1,n), served_model.num_queries, served_model.consumed_tokens / max(1, n)))
    
    with open(result_file("score"), "w") as f:
        f.write("Accuracy: {:.2f}\n".format(n_correct / max(1,n)))
        f.write("Queries: {}\n".format(served_model.num_queries))
        f.write("Tokens/Prompt: {}\n".format(served_model.consumed_tokens))
        f.write("generate() calls: {}\n".format(served_model.num_generate_calls))
        f.write("billable tokens: {}\n".format(served_model.billable_tokens))

if __name__ == "__main__":
    asyncio.run(run_eval())
