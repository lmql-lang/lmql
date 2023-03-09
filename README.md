# LMQL: Programming Large Language Models

This repository contains research artifacts for the PLDI'23 paper, *Programming Large Language Models*. This includes a runtime and IDE for the presented language model query language (LMQL) and the evaluation scripts to produce the results presented in the paper. 

For general use, please see *Getting Started*. For reproducing the results from the paper, see *Evaluation*. For a lightweight setup, without local GPU support, please see *Getting Started Without GPU* at the end of the document.

## To the Artifact Reviewers

We kindly refer the artifact reviewers to the additional infrastructure instructions as provided as part of the HotCRP submission under *Bidding instructions and special hardware requirements*, before continuing with this guide.

## Getting Started

### Operating System Support

The GPU-enabled version of LMQL was tested to work on Ubuntu 22.04 with CUDA 12.0 and Windows 10 via WSL2 and CUDA 11.7. The no-GPU version was tested to work on Ubuntu 22.04 and macOS 13.2 Ventura or Windows 10 via WSL2.

### Requirements

To setup a `conda` environment for LMQL with GPU support, run the following commands:

```
# prepare conda environment
conda env create -f requirements.yml -n lmql
conda activate lmql

# registers the `lmql` command in the current shell
source activate.sh
```

### Running LMQL Programs

To launch LMQL's playground IDE, run the following command:

```
lmql dev
```

This launches a browser-based playground IDE, including a showcase of many exemplary LMQL programs. If the IDE does not launch automatically, go to `http://localhost:3000`.

Alternatively, `lmql run` can be used to execute local `.lmql` files. Note that to use local HuggingFace Transformers models in the Playground IDE or via `lmql run`, you have to load and serve the corresponding model via the command `lmql serve-model`.


## Evaluation

We provide scripts and the LMQL source code to reproduce the results of the original submission as well as revised and extended results for Table 3 (as discussed in the rebuttal). This repository reproduces both, the original and the revised version. This reproduction package reproduces the exact results of the original PLDI submission #737, except for one exception as discussed below under *Updated Revision and Differences to the Original Submission*.

To reproduce the results of the paper, first follow the steps in the *Requirements* section above. Based on this, the paper results can be reproduced using the evaluation scripts `table3.py`, `table4.py`, `fig12.py` and `table3_revised.py`. To run all required evaluation scripts with one command, execute the following:

```
bash all.sh
```

Alternatively, one can also run the individual evaluation scripts one by one. However, before doing so, make sure to first activate the LMQL environment via the command `source activate.sh`.

**Results:** Upon completion, each script will produce the respective result files `table3.txt`, `table4.txt`, `fig12.txt` and `table3_revised.txt`, which directly align with the paper. For reference, we also include the results obtained by us in this way in file `RESULTS.md`.

**Running Time**: Depending on GPU resources, the complete evaluation can take a relatively long time to complete (e.g. up to 20 hours on two NVIDIA TITAN GPUs). We therefore recommend to run the evaluation scripts in a detachable terminal environment like `tmux`.

**OpenAI API Access and Cost**: The evaluation script `table3_revised.txt` invokes the OpenAI API to evaluate LMQL and baselines on the `text-davinci-003` model. Since this can be costly (~$60 per run), we suggest that you refrain from re-running this particular evaluation script many times. 

**OpenAI API Determinism**: Note that the OpenAI API is not fully deterministic, even for `argmax` sampling (cf. https://platform.openai.com/docs/guides/completion). Therefore, the results in `table3_revised.txt` may differ slighlty from our reference and across several runs.

### Re-Running Individual Evaluation Scripts 

All evaluation scripts can be re-run incrementally, i.e. the scripts automatically check for existing result files for the individual datasets in `evaluation/<dataset>/results/` and only re-run evaluation if the respective dataset result file is missing. To explicilty re-run an evaluation script, you can either delete the corresponding result files in `evaluation/<dataset>/results/` or pass the flag `--run-all` (e.g. `python3 fig12.py --run-all`). When executed, the top-level evaluation scripts (e.g. `fig12.py`) also print out the commands used to call the individual dataset evaluation suites, which can be executed individually if necessary.

### Updated Revision and Differences to the Original Submission

Using the provided artifact and LMQL version, you can reproduce our results from the original submission with the following exceptions:

* In the original submission, we included Accuracy values as full percentage values only (after rounding). In the updated revision of the paper, we will include the full numbers up to 2 decimal places (e.g. 12.34% as compared to 12%). The evaluation scripts in this reproduction package produce the values without rounding.

* The Arithmetic Evaluation query and statistics in the paper contained a bug. We regret the mistake and provide a corrected version of the query (`evaluation/arithmetic/calc.lmql`) in the updated revision of the paper. The reported metrics as produced in `table4.py` for Arithmetic Evaluation are based on this corrected query and therefore differ slightly from the original submission.

* The updated paper revision will also include an evaluation of the Table 3 datasets on the model `OPT-30B` (https://huggingface.co/facebook/opt-30b). However, unfortuantely, our infrastructure provider does not allow us to expose the cluster infrastructure required to run such a big model, to the external, anonymous artifact reviewers. Therefore, `all.sh` by default excludes running LMQL's evaluation on `OPT-30B`. This was discussed with the artifact evaluation chair beforehand, who authorized the omission. If the required GPU hardware is present (at least 3xA100 GPUs with 80GB VRAM), the evaluation can be run by uncommenting the respective line in the `all.sh` file.

### Revised and Extended Results for Table 3

Based on reviewer comments and other fixes, we will include a slightly revised version of Table 3 in the updated paper revision. The major changes of the datasets and methods in use, when compared to Table 3 in the original submission, are the following:

* Strengthen the Date Understanding Standard Decoding baseline implementation to be on-par with LMQL accuracy-wise. This ensures better comparabliity regarding token metrics and efficiency.
* Ensure that the two samples used in the few-shot examples for Date Understanding and Odd One Out are excluded during evaluation.
* Fix some whitespace issues in the prompts of both the baseline and the LMQL implementations, such that they align with each other, as much as possible.

## Project Structure

The key components of this repositories are organized according to the following file hierachy:

```
├─ README.md # this README file
├─ RESULTS.md # reference results as obtained by the authors
│  
├─ all.sh # runs all evaluation scripts of the reproduction package 
├─ activate.sh # prepare the current shell to use the LMQL distribution in `latest/lmql`
│
├─ table3.py # evaluation scripts for the individual paper figures
├─ table4.py
├─ fig12.py
├─ table3_revised.py
│
├─ latest/lmql # LMQL source code distribution
│
├─ evaluation/ # evaluation datasets, queries and baseline implementations
│  │
│  ├─ odd_one_out/ # scripts to produce original and revised Odd One Out results (Case Study 1)
│  ├─ date_understanding/ # scripts to produce the original and revised Date Understanding results (Case Study 1)
│  ├─ react/ # scripts to produce the ReAct results (Case Study 2)
│  ├─ arithmetic/ # scripts to produce the Arithmetic Evaluation results (Case Study 3)
│
```

## Getting Started without GPU

This section outlines how to use LMQL without local GPU support. Note, however, that the paper evaluation as described in *Evaluation* can only be run with a GPU setup as described in *Getting Started*. Nontheless, LMQL without GPU support can still be used to explore example queries and run them against OpenAI models.

### Requirements

To set up a `conda` environment for LMQL with GPU support, run the following commands:

```
# prepare conda environment
conda env create -f requirements-no-gpu.yml -n lmql-no-gpu
conda activate lmql-no-gpu

# registers the `lmql` command in the current shell
source activate.sh
```

### Configuring OpenAI Access

Since OpenAI models are only accessible via a paid API, you have to configure API credentials. To do so, create the file `latest/api.env` in this directory:

```
openai-org: <org identifier>
openai-secret: <api secret>
```

### Running LMQL Programs

To launch LMQL's playground IDE, run the following command:

```
lmql dev
```

This launches a browser-based playground IDE, including a showcase of many exemplary LMQL programs. If the IDE does not launch automatically, go to `http://localhost:3000`.

Alternatively, `lmql run` can be used to execute local `.lmql` files. In non-GPU mode, LMQL can only use OpenAI models, e.g. `openai/text-davinci-003`. Please see the OpenAI API documentation (https://platform.openai.com/docs/models/gpt-3-5) to learn more about the set of available models. 