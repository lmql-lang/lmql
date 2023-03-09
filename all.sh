#!/bin/bash
set -x # show commands as they are executed

source activate.sh

python table3.py
python table4.py
python fig12.py

python table3_revised.py

# uncomment if running OPT-30B
# python table3_revised.py --with-opt-30b