import re

def run(expr):
    # replace all that is not 0-9 + 0 * ( ) - / with space
    expr = re.sub(r"[^0-9\+\-\*\/\(\)]", " ", expr)
    # eval as python
    return eval(expr)