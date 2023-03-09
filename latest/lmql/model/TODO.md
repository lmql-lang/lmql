# dclib

* make sure to return user_data on where() calls, not rewrite (or both maybe?)

# Multi-Headed Prompt Interpreter

* decoding
    - implement update model kwargs for padding

* follow sets with subtokens
    - BUG: If follow(..) = "abc def" -> fin(False) then mask should include subtoken abc (prefix match with "abc def")
    - SOLUTION: tokenize tokens of token sets and only use subtoken equivalent of first resulting token (if multiple)
* re-check EqOp follow semantics

# Design Questions

* do we want to support backtracking (what is a principled way of doing this)
    * front-padding input_ids can lead to different results with hf
        - position_id as model_kwarg may fix this, but it is not clear whether this is stable HF API
    
    - need front-padding for end-to-end semantics
    - do not implement backtracking for now

* what is a good way to argue for a limited follow map lhs language (approximation and soundness?)
    - we argue for efficiency, lower bound semantics, soundness

* what are language semantics regarding decoding (do we decode end-to-end or only within queries)
    - do end-to-end

# Active

* prompt interpreter
    - allow for splitting into multiple interpreter heads controlled by the different decoder heads
    - do not simply use result[0] if there are multiple results (split into interpreter heads instead)
    - consider backtracking strategies or scoring for fin(False) hyptotheses

# Progress

* fragment-based parser
    - supports prompt programming
    - arbitrary expression support
* first ops implementations 
    - forward
    - follow
    - WIP: montonicity (new constraint, see gt)
* BIG-bench
* more use cases
    - focus on aggregation

# Tasks

* implement more ops in ops.py
* montonicity support: final, inc, dec
* call hugginface instead of mock model
    * translate masks to logit_masks (handle subtokenization)
* think about distribution decoding
    * group by (?)

# Optimization Points

* limit number of beams to number of allowed tokens for small masks (len(mask) < num_beams)
* do not query model for singular masks
