from dataclasses import dataclass
import torch
import lmql
from lmql.runtime.postprocessing.conditional_prob import ScoringQuery
import asyncio
import numpy as np
from lmql.utils import nputil

from transformers import AutoTokenizer, AutoModelForCausalLM

from transformers.generation.utils import *

@dataclass
class MockLMQLResult:
    distribution_variable: str
    variables: any

def score(
    self,
    input_ids,
    ids_to_score,
    logits_processor = None,
    stopping_criteria = None,
    max_length = None,
    pad_token_id = None,
    eos_token_id = None,
    output_attentions = False,
    output_hidden_states = False,
    output_scores = True,
    return_dict_in_generate = True,
    synced_gpus = False,
    **model_kwargs,
):
    r"""
    Generates sequences of token ids for models with a language modeling head using **greedy decoding** and can be
    used for text-decoder, text-to-text, speech-to-text, and vision-to-text models.
    <Tip warning={true}>
    In most cases, you do not need to call [`~generation.GenerationMixin.greedy_search`] directly. Use generate()
    instead. For an overview of generation strategies and code examples, check the [following
    guide](./generation_strategies).
    </Tip>
    Parameters:
        input_ids (`torch.LongTensor` of shape `(batch_size, sequence_length)`):
            The sequence used as a prompt for the generation.
        logits_processor (`LogitsProcessorList`, *optional*):
            An instance of [`LogitsProcessorList`]. List of instances of class derived from [`LogitsProcessor`]
            used to modify the prediction scores of the language modeling head applied at each generation step.
        stopping_criteria (`StoppingCriteriaList`, *optional*):
            An instance of [`StoppingCriteriaList`]. List of instances of class derived from [`StoppingCriteria`]
            used to tell if the generation loop should stop.
        max_length (`int`, *optional*, defaults to 20):
            **DEPRECATED**. Use `logits_processor` or `stopping_criteria` directly to cap the number of generated
            tokens. The maximum length of the sequence to be generated.
        pad_token_id (`int`, *optional*):
            The id of the *padding* token.
        eos_token_id (`int`, *optional*):
            The id of the *end-of-sequence* token.
        output_attentions (`bool`, *optional*, defaults to `False`):
            Whether or not to return the attentions tensors of all attention layers. See `attentions` under
            returned tensors for more details.
        output_hidden_states (`bool`, *optional*, defaults to `False`):
            Whether or not to return the hidden states of all layers. See `hidden_states` under returned tensors
            for more details.
        output_scores (`bool`, *optional*, defaults to `False`):
            Whether or not to return the prediction scores. See `scores` under returned tensors for more details.
        return_dict_in_generate (`bool`, *optional*, defaults to `False`):
            Whether or not to return a [`~utils.ModelOutput`] instead of a plain tuple.
        synced_gpus (`bool`, *optional*, defaults to `False`):
            Whether to continue running the while loop until max_length (needed for ZeRO stage 3)
        model_kwargs:
            Additional model specific keyword arguments will be forwarded to the `forward` function of the model.
            If model is an encoder-decoder model the kwargs should include `encoder_outputs`.
    Return:
        [`~generation.GreedySearchDecoderOnlyOutput`], [`~generation.GreedySearchEncoderDecoderOutput`] or
        `torch.LongTensor`: A `torch.LongTensor` containing the generated tokens (default behaviour) or a
        [`~generation.GreedySearchDecoderOnlyOutput`] if `model.config.is_encoder_decoder=False` and
        `return_dict_in_generate=True` or a [`~generation.GreedySearchEncoderDecoderOutput`] if
        `model.config.is_encoder_decoder=True`.
    Examples:
    ```python
    >>> from transformers import (
    ...     AutoTokenizer,
    ...     AutoModelForCausalLM,
    ...     LogitsProcessorList,
    ...     MinLengthLogitsProcessor,
    ...     StoppingCriteriaList,
    ...     MaxLengthCriteria,
    ... )
    >>> tokenizer = AutoTokenizer.from_pretrained("gpt2")
    >>> model = AutoModelForCausalLM.from_pretrained("gpt2")
    >>> # set pad_token_id to eos_token_id because GPT2 does not have a PAD token
    >>> model.generation_config.pad_token_id = model.generation_config.eos_token_id
    >>> input_prompt = "It might be possible to"
    >>> input_ids = tokenizer(input_prompt, return_tensors="pt").input_ids
    >>> # instantiate logits processors
    >>> logits_processor = LogitsProcessorList(
    ...     [
    ...         MinLengthLogitsProcessor(10, eos_token_id=model.generation_config.eos_token_id),
    ...     ]
    ... )
    >>> stopping_criteria = StoppingCriteriaList([MaxLengthCriteria(max_length=20)])
    >>> outputs = model.greedy_search(
    ...     input_ids, logits_processor=logits_processor, stopping_criteria=stopping_criteria
    ... )
    >>> tokenizer.batch_decode(outputs, skip_special_tokens=True)
    ["It might be possible to get a better understanding of the nature of the problem, but it's not"]
    ```"""
    # init values
    logits_processor = logits_processor if logits_processor is not None else LogitsProcessorList()
    stopping_criteria = stopping_criteria if stopping_criteria is not None else StoppingCriteriaList()
    if max_length is not None:
        warnings.warn(
            "`max_length` is deprecated in this function, use"
            " `stopping_criteria=StoppingCriteriaList([MaxLengthCriteria(max_length=max_length)])` instead.",
            UserWarning,
        )
        stopping_criteria = validate_stopping_criteria(stopping_criteria, max_length)
    pad_token_id = pad_token_id
    eos_token_id = eos_token_id
    if isinstance(eos_token_id, int):
        eos_token_id = [eos_token_id]
    output_scores = output_scores
    output_attentions = (
        output_attentions
    )
    output_hidden_states = (
        output_hidden_states
    )
    return_dict_in_generate = (
        return_dict_in_generate
    )

    # init attention / hidden states / scores tuples
    scores = () if (return_dict_in_generate and output_scores) else None
    decoder_attentions = () if (return_dict_in_generate and output_attentions) else None
    cross_attentions = () if (return_dict_in_generate and output_attentions) else None
    decoder_hidden_states = () if (return_dict_in_generate and output_hidden_states) else None

    # if model is an encoder-decoder, retrieve encoder attention weights and hidden states
    if return_dict_in_generate and self.config.is_encoder_decoder:
        encoder_attentions = model_kwargs["encoder_outputs"].get("attentions") if output_attentions else None
        encoder_hidden_states = (
            model_kwargs["encoder_outputs"].get("hidden_states") if output_hidden_states else None
        )

    # keep track of which sequences are already finished
    unfinished_sequences = input_ids.new(input_ids.shape[0]).fill_(1)

    this_peer_finished = False  # used by synced_gpus only
    tidx = -1
    token_scores = ()

    while True:
        tidx += 1

        if synced_gpus:
            # Under synced_gpus the `forward` call must continue until all gpus complete their sequence.
            # The following logic allows an early break if all peers finished generating their sequence
            this_peer_finished_flag = torch.tensor(0.0 if this_peer_finished else 1.0).to(input_ids.device)
            # send 0.0 if we finished, 1.0 otherwise
            dist.all_reduce(this_peer_finished_flag, op=dist.ReduceOp.SUM)
            # did all peers finish? the reduced sum will be 0.0 then
            if this_peer_finished_flag.item() == 0.0:
                break

        if tidx >= ids_to_score.size(1):
            break

        # prepare model inputs
        model_inputs = self.prepare_inputs_for_generation(input_ids, **model_kwargs)

        # forward pass to get next token
        outputs = self(
            **model_inputs,
            return_dict=True,
            output_attentions=output_attentions,
            output_hidden_states=output_hidden_states,
        )

        if synced_gpus and this_peer_finished:
            continue  # don't waste resources running the code we don't need

        next_token_logits = outputs.logits[:, -1, :]

        # pre-process distribution
        next_tokens_scores = logits_processor(input_ids, next_token_logits)

        # Store scores, attentions and hidden_states when required
        if return_dict_in_generate:
            if output_scores:
                scores += (next_tokens_scores,)
            if output_attentions:
                decoder_attentions += (
                    (outputs.decoder_attentions,) if self.config.is_encoder_decoder else (outputs.attentions,)
                )
                if self.config.is_encoder_decoder:
                    cross_attentions += (outputs.cross_attentions,)

            if output_hidden_states:
                decoder_hidden_states += (
                    (outputs.decoder_hidden_states,)
                    if self.config.is_encoder_decoder
                    else (outputs.hidden_states,)
                )

        # argmax
        next_tokens = ids_to_score[:, tidx]
        token_scores = token_scores + (torch.gather(next_tokens_scores, dim=-1, index=next_tokens[:, None]),)

        # finished sentences should have their next token be a padding token
        if eos_token_id is not None:
            if pad_token_id is None:
                raise ValueError("If `eos_token_id` is defined, make sure that `pad_token_id` is defined.")
            next_tokens = next_tokens * unfinished_sequences + pad_token_id * (1 - unfinished_sequences)

        # update generated ids, model inputs, and length for next step
        input_ids = torch.cat([input_ids, next_tokens[:, None]], dim=-1)
        model_kwargs = self._update_model_kwargs_for_generation(
            outputs, model_kwargs, is_encoder_decoder=self.config.is_encoder_decoder
        )

        # if eos_token was found in one sentence, set sentence to finished
        if eos_token_id is not None:
            unfinished_sequences = unfinished_sequences.mul((sum(next_tokens != i for i in eos_token_id)).long())

        # stop when each sentence is finished, or if we exceed the maximum length
        if unfinished_sequences.max() == 0 or stopping_criteria(input_ids, scores):
            if not synced_gpus:
                break
            else:
                this_peer_finished = True
    return token_scores

class LocalClient:
    def __init__(self, model_identifier):
        print("Loading", model_identifier, "in this process")
        self.model = AutoModelForCausalLM.from_pretrained(model_identifier, device_map="auto")
        print("Ready.")
        self.tokenizer = AutoTokenizer.from_pretrained(model_identifier)

        self.generate_tasks = asyncio.Queue()
        self.score_tasks = asyncio.Queue()
        self.workers = [
            asyncio.create_task(self.work_generate()),
            asyncio.create_task(self.work_score_distribution()),
        ]

    def __del__(self):
        for w in self.workers:
            w.cancel()

    async def tokenize(self, text):
        return self.tokenizer(text)["input_ids"]

    async def detokenize(self, tokens):
        return self.tokenizer.decode(tokens)
    
    async def work_generate(self):
        while True:
            args, kwargs, future = await self.generate_tasks.get()
            future.set_result(await self._generate(*args, **kwargs))

    async def generate(self, *args, **kwargs):
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        await self.generate_tasks.put((args, kwargs, fut))
        return await fut

    async def _generate(self, input_ids, *args, **kwargs):
        kwargs["pad_token_id"] = self.tokenizer.pad_token_id or self.tokenizer.eos_token_id
        kwargs["eos_token_id"] = self.tokenizer.eos_token_id
        input_ids = input_ids.to("cuda")
        return self.model.generate(input_ids, *args, **kwargs)
    
    async def work_score_distribution(self):
        while True:
            args, kwargs, future = await self.score_tasks.get()
            future.set_result(await self._score_distribution_values(*args, **kwargs))

    async def score_distribution_values(self, *args, **kwargs):
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        await self.score_tasks.put((args, kwargs, fut))
        return await fut

    async def _score_distribution_values(self, prompt, values, **decoder_args):
        prompt = prompt.lstrip("<s/>")
        # print(prompt)
        input_ids = torch.tensor(await self.tokenize(prompt), dtype=torch.long)
        values_ids = [torch.tensor(await self.tokenize(value), dtype=torch.long) for value in values]
        for i in range(len(values_ids)):
            if values_ids[i][0] == self.tokenizer.bos_token_id:
                values_ids[i] = values_ids[i][1:]

        value_scores = []
        
        for value_ids in values_ids:
            res = score(self.model, torch.cat([input_ids]).view(1, -1).to("cuda"), value_ids.view(1,-1).to("cuda"), output_scores=True, max_new_tokens=len(value_ids), return_dict_in_generate=True, pad_token_id=self.tokenizer.eos_token_id, eos_token_id=self.tokenizer.eos_token_id)
            scores = torch.tensor([s.view(-1).item() for s in res])
            value_scores.append(scores)
        
        return value_scores

LocalClient.clients = {}

def get_client(model):
    if model not in LocalClient.clients:
        LocalClient.clients[model] = LocalClient(model)
    return LocalClient.clients[model]

class HFPrompter:
    def __init__(self, model, local=False):
        if local:
            self.client = get_client(model)
            self.model = self.client
        else:
            self.client = lmql.model_registry.get(model)
            self.model = self.client.served_model
        
        self.last_num_steps = -1

    async def generate(self, prompt, remove_stopping_phrases = True, truncate=None, **kwargs):
        input_ids = torch.tensor([self.client.tokenizer.bos_token_id] + await self.client.tokenize(prompt), dtype=torch.long).view(1, -1)
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

            old_input_ids = input_ids
            input_ids = await self.model.generate(input_ids, max_length = max_length_step, do_sample=False, num_return_sequences=1, early_stopping=True, **kwargs)
            text = await self.client.detokenize(input_ids[0,1:].tolist())
            
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

        scores = np.stack([s.sum() for s in scores], axis=0)
        log_probs = nputil.log_softmax(scores)

        return list(zip(values, log_probs.tolist()))

async def main():
    local_client = LocalClient("gpt2-medium")
    await local_client.score_distribution_values("The quick brown fox jumps over the lazy ", ["dog", "cat", "mouse", "Hello world"])

if __name__ == "__main__":
    asyncio.run(main())