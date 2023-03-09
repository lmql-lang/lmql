import asyncio

import sys
import os
sys.path.append("../")
sys.path.append("../../")

import re

def run(expr):
    # print("====== calc", expr, "======")
    # replace all that is not 0-9 + 0 * ( ) - / with space
    expr = re.sub(r"[^0-9\+\-\*\/\(\)]", " ", expr)
    # eval as python
    return str(eval(expr))

import lmql

if lmql.version == "pldi":
    from pldi_utils.hf_baseline_prompter import HFPrompter
else:
    from utils.dc_baseline_prompter import HFPrompter

async def main():
    question = "Noah is a painter. He paints pictures and sells them at the park. He charges $60 for a large painting and $30 for a small painting. Last month he sold eight large paintings and four small paintings. If he sold twice as much this month, how much is his sales for this month?"

    lmql.autoconnect()
    model = sys.argv[1]
    step_size = int(sys.argv[2]) if len(sys.argv) > 1 else 10
    
    hf = HFPrompter(model)

    prompt = f"""Q: Every hour Joanne has to collect the coins out of the fountain inside the mall. During the first hour, she collected 15 coins. For the next two hours, she collected 35 coins from the fountain. In the fourth hour, she collected 50 coins from the fountain but she gave 15 of them to her coworker so she could buy a soda. How many coins did she have after the fourth hour?
A: Let's think step by step.
15 coins collected in hour one
35 coins collected in hour two
35 coins collected in hour three
50 coins collected in hour four
Before giving her coworker some coins there were 15+35+35+50=<<15+35+35+50=135>>135 coins
The number of coins after given 15 to her coworker is 135-15=<<135-15=120>>120
So the answer is 120 DONE

Q: Jerry’s two daughters play softball on different teams. They each have 8 games this season. Each team practices 4 hours for every game they play. If each game lasts for 2 hours, how many hours will Jerry spend at the field watching his daughters play and practice altogether?
A: Let's think step by step.
Jerry will spend 8 games x 2 hours per game = <<8*2=16>>16 hours watching one daughter play her games.
He will spend 16 x 2 = <<16*2=32>>32 hours watching both daughters play their games.
He will spend 8 games x 4 hours of practice = <<8*4=32>>32 hours watching one daughter practice.
He will spend 32 x 2 = <<32*2=64>>64 hours watching both daughters practice.
He will spend a total of 32 hours watching games + 64 hours watching practice = <<32+64=96>>96 hours.
So the answer is 96 DONE\n
Q: {question}""".strip() + "\n"

    # print(question)

    waiting_for_expr = False
    expr = ""
    new_text_all = ""
    num_calcs = 0
    previous_printed_prompt = ""

    for i in range(1024):
        if num_calcs >= 3: break
        
        # print("======generate()======\n", prompt[len(previous_printed_prompt):])
        previous_printed_prompt = prompt
        
        new_prompt = await hf.generate(prompt, max_new_tokens=step_size, stopping_phrases=["<<", "DONE"], step_size=step_size, remove_stopping_phrases=False)
        new_text = new_prompt[len(prompt):]

        if "DONE" in new_text_all:
            break

        if waiting_for_expr:
            expr += new_text
            if "=" in new_text:
                expr = expr[:expr.index("=")]

                new_text = new_text[:new_text.index("=")]
                prompt = prompt + new_text
                num_calcs += 1
                res = run(expr)
                prompt += "= " + res + " >>\n"
                waiting_for_expr = False
                expr = ""
                new_text_all += new_text + "= " + res + " >>"
                continue

        # find first <<
        indices = [i for i in [new_text.find("<<")] if i != -1]
        first_kw = min(indices + [len(prompt) + 1])
        if first_kw == len(prompt) + 1:
            # print("No stopping phrase in", new_text)
            assert prompt == new_prompt[:len(prompt)]
            prompt = new_prompt
            new_text_all += new_text
            continue
        new_text = new_text[first_kw:]
        # find equal sign
        end_of_line = new_text.find("=")
        if end_of_line != -1: new_text = new_text[:end_of_line]

        expr += new_text[len("<<"):]
        waiting_for_expr = True

        if "=" in expr:
            expr = expr[:expr.index("=")]

            new_text = new_text[:new_text.index("=")]
            prompt = prompt + new_text
            num_calcs += 1
            res = run(expr)
            prompt += "= " + res + " >>\n"
            waiting_for_expr = False
            expr = ""
            new_text_all += new_text + "= " + res
            continue
        
        # print("======generate()======\n", new_text)
        prompt += new_text
        new_text_all += new_text

    stats = hf.model
    if hasattr(stats, "served_model"):
        stats = stats.served_model

    method = f"hf-{step_size}" 
    model_part = model.replace("/", "-")
    results_file = os.path.join("results", f"results.csv-{method}-{model_part}.txt")
    score_file = os.path.join("results", f"score-{method}-{model_part}.txt")

    with open(results_file, "w") as f:
        f.write(prompt + "\n\n")

    with open(score_file, "w") as f:
        f.write("Step Size: {}\n".format(step_size))
        f.write("Queries: {}\n".format(stats.num_queries))
        f.write("Tokens/Prompt: {}\n".format(stats.consumed_tokens))
        f.write("generate() calls: {}\n".format(stats.num_generate_calls))
        f.write("billable tokens: {}\n".format(stats.billable_tokens))

asyncio.run(main())