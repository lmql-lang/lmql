# Language Semantics

* incremental evaluation of scoring and validation expressions
    - i.e. evaluate as much as possible on each token (scoring and validation is applied like a parser)
        => early rejection is the main optimization angle with autoregressive transformers
    - evaluate boolean operators using aggressive short-circuiting such that negative overall validation results can be determined as early as possible 
    - overall we want to enforce *montonicity* in the sense that once the verifier returns false, it remains false no matter the additionally produced tokens

* backprop/synthetis of prediction masks on the (sub)-token level, when some sub-expression in the validation clause fails
    - allows for error recovery (instead of rejecting sequences right away)

* support scoring of sequences and sub-sequences using the same set of expressions supported for validation (e.g. token/chunk/sentence level)

* support calling batched models in the loop

# Milestones 

* 1: validation, early rejection, hooking up huggingface, basic sampling modes
* 2: scoring clause
* 3: masking/error recovery
* 4: batched models in the loop

# Main Narrative

- CONTEXT: 
    - large LMs have shown to be very powerful and many downstream use cases have demonstrate great performance
    - a number of techniques were developed to make use of LMs (prompting, validation, scoring, few-shot training, etc.)
- PROBLEM: 
    - new LMs are published frequently nowadays and users of LMs have to write very model-specific code to leverage them (prop. APIs, 
    fixed libraries, fixed models+tokenizers, etc.)
- SOLUTION: 
    - Provide a PL as an interface to interact with LMs, decoupling LM programming into a front-end (prompting, validation, scoring, error recovery)
    and a backend (tokenizer, model weights, model implementation) as it was done in compilers (cf. LLVM, MLIR)

# User Personas

- traditional inference
    - simple prompt (fixed PROMPT (e.g. few shot samples) > QUESTION > MODEL_OUTPUT)
    - one output variable (MODEL_OUTPUT)
    - experiments with different sampling parameters beam/argmax/sampling temperatures
    - no output validation
    
    - example: Normally uses OpenAI playground-style interface, wants some more control and automation

    - benefits:
        - simple syntax
        - easy configuration of different sampling methods
        - could be domain user (knows about simple SQL but no other PLs), no need for special knowledge 
            about deep learning, models or even Python.

- traditional inference with validation 
    - like above but uses a simple Python function operating on tokens, chunks, sentences or full sequences to validate output

    - benefits:
        - no need to modify the decoding loop shipped with e.g. huggingface library
        - built-in functions for chunking or extracting sentences to run validation function on
        - easy to switch to different models/tokenizers, without changing validation logic
        - users provide high-level sequence validation logic, runtime automatically handles branching and sampling using a generic 
            decoding algorithm which employs the validation function internally (enabling multiple samples, beam search, etc.)

- traditional inference with advanced prompt engineering
    - multi-part prompts, multiple output variables (e.g. metaprompting)
    - dynamic retrieval of few-shot examples
    - wants to parse the model output to obtain some more structured answer (e.g. "The answer is [OUTPUT]." prompting)

    - benefits:
        - prompt clause allows for multi-part prompts, including different constraints on different parts of the model output.
        - scripted interaction allows to dynamically retrieve few-shot samples, (do not need to be fixed right from the beginning)
        - prompt clause automatically dissects model output into different parts. 

- inference and scoring using external validation logic
    - uses Python function to validate
    - scores output sequence using some custom scheme (e.g. score invalid identifier in code output as 'bad')

    - benefits:
        - no need to modify the decoding loop shipped with e.g. huggingface library (validation + scoring)
        - easy to switch to different models/tokenizers, without changing validation logic

- power user:
    - multi-part prompts with scripted interactions and multiple output variables
    - use scoring + where clauses
    - use error recovery
    - use batched models in the loop

    - benefits:
        - quite novel use cases, which otherwise would need a lot of manual implementation work
