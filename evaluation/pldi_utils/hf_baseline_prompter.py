from dataclasses import dataclass
import torch
import lmql
from lmql.runtime.postprocessing.conditional_prob import ScoringQuery

@dataclass
class MockLMQLResult:
    distribution_variable: str
    variables: any

class HFPrompter:
    def __init__(self, model):
        self.client = lmql.model_registry.get(model)
        self.model = self.client.served_model
        
        self.last_num_steps = -1

    async def generate(self, prompt, remove_stopping_phrases = True, truncate=None, **kwargs):
        input_ids = torch.tensor(await self.client.tokenize(prompt), dtype=torch.long).view(1, -1)
        if truncate is not None: input_ids = input_ids[:, -truncate:]

        max_new_tokens = kwargs.get("max_new_tokens", 1)
        if "max_new_tokens" in kwargs: del kwargs["max_new_tokens"]
        stopping_phrases = kwargs.get("stopping_phrases", None)
        if "stopping_phrases" in kwargs: del kwargs["stopping_phrases"]
        max_length = input_ids.size(1) + max_new_tokens
        step_size = kwargs.get("step_size", 1)
        if "step_size" in kwargs: del kwargs["step_size"]

        num_steps = 0

        while len(input_ids) < max_length:
            max_length_step = min(max_length, input_ids.size(1) + step_size)

            input_ids = await self.model.generate(input_ids, max_length = max_length_step, do_sample=False, num_return_sequences=1, early_stopping=True, **kwargs)
            text = await self.client.detokenize(input_ids[0].tolist())
            
            if input_ids.size(1) >= max_length:
                break

            for sp in stopping_phrases:
                if sp is not None and sp in text[len(prompt):]:
                    break
            num_steps += 1

        self.last_num_steps = num_steps

        if remove_stopping_phrases:
            # remove stop phrase and everything after it
            for sp in stopping_phrases:
                if sp is not None and sp in text[len(prompt):]:
                    return text[:text.rindex(sp)]
        
        return text

    async def cond_logprob(self, prompt, values):
        result = MockLMQLResult("PREDICTION", {})
        scorer = ScoringQuery(result, 0, prompt, values, None)
        scores = await scorer.score(self.client, batch_size=1)

        scores = torch.stack([s.sum() for s in scores], axis=0)
        log_probs = torch.log_softmax(scores, 0)

        return list(zip(values, log_probs.tolist()))