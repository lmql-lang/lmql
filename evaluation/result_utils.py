import pandas as pd
import os

def reasoning(row):
    lines = row.interaction_trace.split("\n")
    for i in range(len(lines) - 1, 0, -1):
        if "Let's think step by step." in lines[i]:
            break
    lines = lines[i:]
    return "\n".join(lines)
    

class Results:
    def __init__(self, task):
        if task.startswith("pldi:"):
            task = task[len("pldi:"):]
            self.prefix = "pldi-"
        self.task = task
    
    def inspect(self, method, model, n=None):
        model = model.replace("/", "-")
        suffix = ""
        
        if n is not None:
            suffix = f"-n{n}"
        
        if len(model) > 0:
            model = f"-{model}"
        df = pd.read_csv(os.path.join("evaluation", self.task, f"results/{self.prefix}results.csv-{method}{model}{suffix}.txt"))

        # accuracy
        print("Accuracy", (df["correct_item"] == df["result_item"]).mean())
        print("Num Samples", len(df))

        rows = list(df.iloc)
        rows = sorted(rows, key=lambda x: x["correct_item"])

        for i, row in enumerate(rows):
            if i > 5: break
            
            print("model reasoning\t", reasoning(row))
            print("target\t\t", [row.correct_item])
            print("prediction\t", [row.result_item], end="\n")
            # print("query:\t", row.query)
        return df