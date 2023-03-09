import asyncio

import sys
import os
sys.path.append("../")
sys.path.append("../../")

import re

import lmql

async def main():
    model = sys.argv[1]
    
    lmql.autoconnect()
    
    stats = lmql.model_registry.get(model).served_model
    if hasattr(lmql.model_registry.get(model), "hf_stats"):
        stats = lmql.model_registry.get(model).hf_stats
    
    result = await lmql.run_file("react.lmql", output_writer=lmql.silent, force_model=model)
    
    prompt = ""

    method = f"query.lmql" 
    model_part = model.replace("/", "-")
    results_file = os.path.join("results", f"results.csv-{method}-{model_part}.txt")
    score_file = os.path.join("results", f"score-{method}-{model_part}.txt")

    with open(results_file, "w") as f:
        f.write(prompt + "\n\n")

    with open(score_file, "w") as f:
        f.write("Queries: {}\n".format(stats.num_queries))
        f.write("Tokens/Prompt: {}\n".format(stats.consumed_tokens))
        f.write("generate() calls: {}\n".format(stats.num_generate_calls))
        f.write("billable tokens: {}\n".format(stats.billable_tokens))

asyncio.run(main())