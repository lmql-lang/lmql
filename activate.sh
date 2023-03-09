LMQL_PATH="$(realpath $(dirname "${BASH_SOURCE[0]}"))/latest"
echo "Using LMQL distribution at $LMQL_PATH"
alias lmql="PYTHONPATH=$LMQL_PATH python -m lmql.cli \$*"
alias lmql-eval="PYTHONPATH=$LMQL_PATH:$LMQL_PATH/../evaluation python -m eval \$*"
export PYTHONPATH=$LMQL_PATH

