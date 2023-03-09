import os

import sys
sys.path.append("../")
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))

from livelib import LiveApp, live, add_debugger_output
import asyncio
import json
import numpy as np

class LiveDebuggerOutputWriter:
    def __init__(self):
        self.message_log = []
        self.records_graph = True

    def add_decoder_state(self, graph_dict):
        add_debugger_output("decoder-graph-state", graph_dict)
    
    def report_model_stats(self, **kwargs):
        add_debugger_output("openai-token-count", kwargs)

    def add_interpreter_head_state(self, variable, head, prompt, where, trace, is_valid, is_final, mask, num_tokens, program_variables):
        from lmql.utils.graph import CytoscapeGraphWriter

        def node_data(op):
            result = "-"
            if trace is not None and op in trace:
                result = trace[op]

            follow_map = "-"
            if hasattr(op, "follow_map"):
                follow_map = str(op.follow_map)
            return {
                "result": result,
                "follow_map": follow_map,
                "repr": repr(op)
            }

        writer = CytoscapeGraphWriter(extra_data_provider=node_data)
        writer.write(where)

        args = ("interpreter-head", {
            "variable": variable,
            "head_index": head,
            "prompt": prompt,
            "mask": str(mask),
            "valid": str(is_valid),
            "final": is_final,
            "num_tokens": num_tokens,
            "program_variables": program_variables.variable_values if program_variables is not None else {},
            "where": writer.graph.to_json()
        })
        add_debugger_output(*args)
        self.message_log.append(args)

        with open("debugger_state.pkl", "w") as f:
            json.dump(self.message_log, f)
    
    def add_compiler_output(self, code): 
        add_debugger_output("compiled-code", {
            "code": code
        })

# async def lmql_main(filepath, *args, output_writer=None):
#     import lmql

#     module = lmql.load(filepath, autoconnect=True)

#     if module is None: 
#         print("Failed to compile query.")
#         return
    
#     if output_writer is None:
#         module.query.output_writer = LiveDebuggerOutputWriter()
#         module.query.output_writer.add_compiler_output(module.code())
#     else:
#         module.query.output_writer = output_writer

#     if len(args) == 1 and args[0] == "":
#         kwargs = {}
#     else:
#         kwargs = {}
#         for line in args:
#             line = line.strip()
#             print(line)
#             key, value = line.split(":", 1)
#             kwargs[key.strip()] = value.strip()

#     print("running query ", module.code)

#     return await module.query(**kwargs)

@live(client_script="lmql-client.js", client_html="lmql-client.html")
def ast_mock(code, *args):
    os.chdir(os.path.join(os.path.dirname(__file__), "../../"))
    with open("debugger_state.pkl", "r") as f:
        message_log = json.load(f)

    for type, obj in message_log:
        add_debugger_output(type, obj)

@live(client_script="lmql-client.js", client_html="lmql-client.html")
async def lmql(code, *args):
    import lmql

    if code.startswith("./"):
        with open(code) as f:
            code = f.read()

    output_writer = LiveDebuggerOutputWriter()

    result = await lmql.run(code, output_writer=output_writer)

    for r in (result if type(result) is list else [result]):
        if r is None:
            continue
        
        for v in [v for v in r.variables if v.startswith("P(")]:
            distribution = r.variables[v]
            max_prob = max([p for _,p in distribution])
            labels = []
            for value, prob in distribution:
                label = value if prob != max_prob else f"{value} (*)"
                labels.append(label)
            max_length = max([len(str(l)) for l in labels])

            print(v)
            for (value, prob), label in zip(distribution, labels):
                label = label.ljust(max_length)
                print(" - {} {}".format(label, prob))


@live(client_html="decoder/decoder.html", client_script="decoder/decoder-client.js")
def decoders(code):
    print("code", code)
    import json

    import lmql.runtime.dclib as dc
    import lmql.runtime.dclib.decoders as decoders
    from lmql.model.client import ServedPretrainedModel
    
    async def main():
        dc.set_record_graph()

        with ServedPretrainedModel("http://localhost:8080", "gpt2-medium"):
            n = 2
            # parse code as "<decoder function>(<args>)"
            decoder_function, args = code.split("(", 1)
            def capture_args(*args, **kwargs):
                return args, kwargs
            args, kwargs = eval("capture_args(" + args, globals(), locals())
            print("args", args)
            print("kwargs", kwargs)

            # tokenize first arg
            args[0] = np.array(await (dc.gtokenizer()(args[0])))

            # async for 
            async for _ in decoders.__dict__[decoder_function](*args, **kwargs):
                data = await dc.DecoderSequence.graph.json()
                data = replace_inf_nan_with_str(data)
                print("DEBUGGER OUTPUT", json.dumps(data), flush=True)
                # print(await dc.topk(h + done, n).str())

    asyncio.run(main())

def replace_inf_nan_with_str(d):
    import math
    for k, v in d.items():
        if type(v) is dict:
            replace_inf_nan_with_str(v)
        elif type(v) is float:
            if math.isinf(v) or math.isnan(v):
                d[k] = str(v)
    return d

if __name__ == "__main__":
    LiveApp.cli()
