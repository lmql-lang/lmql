import asyncio

import sys
import os
sys.path.append("../")
sys.path.append("../../")

import wikipedia_utils

import lmql
from utils.dc_baseline_prompter import HFPrompter

async def main():
    question = "Chang Ucchin was born in korea during a time that ended with the conclusion of what?"

    model = sys.argv[1] if len(sys.argv) > 2 else "gpt2-xl"
    step_size = int(sys.argv[2]) if len(sys.argv) > 1 else 10

    lmql.autoconnect()
    hf = HFPrompter(model)

    prompt = f"""
What is the elevation range for the area that the eastern sector of the Colorado orogeny extends into?Tho 1: I need to search Colorado orogeny, find the area that the eastern sector of the Colorado orogeny extends into, then find the elevation range of the area.
Act 2: Search 'Colorado orogeny'
Obs 2: The Colorado orogeny was an episode of mountain building (an orogeny) in Colorado and surrounding areas.
Tho 3: It does not mention the eastern sector.  So I need to look up eastern sector.
Act 4: Search 'eastern sector'
Obs 4: The eastern sector extends into the High Plains and is called the Central Plains orogeny.
Tho 5: The eastern sector of Colorado orogeny extends into the High Plains.  So I need to search High Plains and find its elevation range.
Act 6: Search 'High Plains'

Obs 6: High Plains refers to one of two distinct land regions.Tho 7: I need to instead search High Plains (United States).Act 9: Search 'High Plains (United States)'Obs 9: The High Plains are a subregion of the Great Plains.  From east to west, the High Plains rise in elevation from around 1,800 to 7,000 ft (550 to 2,130m).Tho 10: High Plains rise in elevation from around 1,800 to 7,000 ft, so the answer is 1,800 to 7,000 ft.Act 5: Finish '1,800 to 7,000 ft'

Which documentary is about Finnish rock groups, Adam Clayton Powell or The Saimaa Gesture?
Tho 1: I need to search Adam Clayton Powell and The Saimaa Gesture, and find which documentary is about Finnish rock groups.
Act 2: Search 'Adam Clayton Powell'
Obs 2: No results.
Tho 2: To find the documentary, I can search Adam Clayton Powell (film).
Act 3: Search 'Adam Clayton Powell (film)'
Obs 3: Adam Clayton Powell is a 1989 American documentary film directed by Richard Kilberg.  The film is about the rise and fall of influential African-American politician Adam Clayton Powell Jr. It was later aired as part of the PBS series The American Experience.
Tho 4: Adam Clayton Powell (film) is a documentary about an African-American politician, not Finnish rock groups.  So the documentary about Finnish rock groups must instead be The Saimaa Gesture.
Act 5: Finish 'The Saimaa Gesture'\n\n{question}""".strip()

    # print(question)
    
    for i in range(1024):
        new_prompt = await hf.generate(prompt, max_new_tokens=step_size, stopping_phrases=["Act"], step_size=step_size, remove_stopping_phrases=False)
        new_text = new_prompt[len(prompt):]
        # print([new_text])

        # find first Tho or Act
        indices = [i for i in [new_text.find("Tho"), new_text.find("Act")] if i != -1]
        first_kw = min(indices + [len(prompt) + 1])
        if first_kw == len(prompt) + 1:
            # print("No stopping phrase in", new_text)
            # print("======generate()======\n", new_prompt[len(prompt):])
            prompt = new_prompt
            continue
        new_text = new_text[first_kw:]
        # find end of line
        end_of_line = new_text.find("\n")
        if end_of_line != -1: new_text = new_text[:end_of_line]

        if new_text.startswith("Act"):
            s = new_text.strip()
            try:
                query = s.split(": ", 1)[1]
                command, subject = query.split(" '", 1)
                index = s.split(": ", 1)[0].split(" ", 1)[1]
                
                if "Search" in command:
                    if subject.endswith("'"):
                        subject = subject[:-1]
                    result = wikipedia_utils.search(subject)
                    new_text += "\nObs {}: {}".format(index, result)
                elif "Finish" in command:
                    # print("FINISH", subject)
                    # print("======generate()======\n", new_text)
                    prompt += "\n" + new_text
                    break
            except:
                print("Failed to parse action", s)
        
        # print("======generate()======\n", new_text)
        prompt += "\n" + new_text

    with open("results/latest-predictions-react-{}-python.txt".format(step_size), "w") as f:
        f.write(prompt + "\n\n")
        
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