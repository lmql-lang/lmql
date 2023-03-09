import os
import sys
import asyncio

from lmql.language.compiler import LMQLCompiler
import lmql.runtime.lmql_runtime as lmql_runtime
from lmql.runtime.prompt_interpreter import FailedToDecodeVariable
from lmql.runtime.hf_integration import transformers_model

async def main(filepath=None):
    if filepath is None: filepath = sys.argv[1]

    # compile query and obtain the where clause computational graph
    compiler = LMQLCompiler()
    Model = transformers_model("http://localhost:8080", "gpt2-medium")
    lmql_runtime.register_model("gpt2-medium", Model)
    lmql_runtime.register_model("mock", Model)

    try:
        module = compiler.compile(filepath).load()
        result = await module.query()

        # joke = result["JOKE"]
        # print(f"The joke is \"{joke}\"")
        # print("", end="\n\n")
        # print("Variables:")
        # for key in sorted(result.variables.keys()):
        #     print(key, result.variables[key])
    
    except FailedToDecodeVariable as e:
        print("decoding error: {}".format(str(e)))

if __name__ == "__main__":
    asyncio.run(main())