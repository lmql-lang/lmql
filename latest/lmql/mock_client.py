import os
import sys
import asyncio

from lmql.language.compiler import LMQLCompiler
import lmql.runtime.lmql_runtime as lmql_runtime
from lmql.runtime.prompt_interpreter import FailedToDecodeVariable
from lmql.ops.token_set import TokenSet

class MockModel:
    def __init__(self) -> None:
        self.result = "A man walks into a bar .".split(" ")
        self.ctr = 0

    async def query(self, prompt, mask=None):
        if self.ctr >= len(self.result):
            return "<EOS>"
        if mask is not None and mask != "*" and str(mask) != "* \ {eos}":
            if len(mask) > 0: 
                if type(mask) is TokenSet:
                    return sorted(list(mask.tokens))[0]
                else:
                    return mask[0]
            return "<EOS>"
        tok = self.result[self.ctr]
        self.ctr += 1
        return tok

async def main():
    # compile query and obtain the where clause computational graph
    compiler = LMQLCompiler()
    lmql_runtime.register_model("mock", MockModel)

    try:
        filepath = sys.argv[1]
        module = compiler.compile(filepath).load()
        result = await module.query()

        # joke = result["JOKE"]
        # print(f"The joke is \"{joke}\"")
        print(result)
    except FailedToDecodeVariable as e:
        print("decoding error: {}".format(str(e)))
if __name__ == "__main__":
    asyncio.run(main())