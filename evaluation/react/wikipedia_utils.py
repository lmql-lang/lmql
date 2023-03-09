import sys
from urllib.request import urlopen
from urllib.parse import urlencode, quote_plus
import json

"""
Which magazine was started first Arthur's Magazine or First for Women?
Tho 1: The important words are "Arthur's Magazine" and "First for Women".
Act 2: Search "Arthur's Magazine"
Obs 2: Arthur's Magazine (1844-1846) was an American literary periodical published in Philadelphia in the 19th century. Edited by Timothy Shay Arthur, it featured work by Edgar A. Poe, J.H. Ingraham, Sarah Josepha Hale, Thomas G. Spear, and others.
Tho 3: Arthur's Magazine was started in 1844.
Act 4: Search "First for Women"
Obs 4: First for Women is a woman's magazine published by A360media in the USA. The magazine was started in 1989 by Bauer Media Group. In 2011 the circulation of the magazine was 1,310,696 copies.
Tho 5: First for Women was started in 1989.
Act 6: Finish Arthur's Magazine

Musician and satirist Allie Goertz wrote a song about the "The Simpsons" character Milhouse, who Matt Groening named after who?
Tho 1: Allie Goertz is the important person.
Act 2: Search "Allie Goertz"
Obs 2: Allison Beth Goertz (born March 2, 1991) is an American comedy musician, writer and former editor for Mad magazine.  Goertz is known for her satirical songs based on various pop culture topics.
Tho 3: This is inconclusive.
Act 5: Search "Milhouse"
Obs 5: Milhouse Mussolini Van Houten is a recurring character in the Fox animated television series The Simpsons voiced by Pamela Hayden and created by Matt Groening. Milhouse is Bart Simpson's best friend in Mrs.
Tho 6: This seems unrelated.
Act 7: Finish President Richard Nixon
"""

global wikipedia_cache
wikipedia_cache = {}

questions = [
    ["Which magazine was started first Arthur's Magazine or First for Women?", "Arthur's Magazine"],
    ["Musician and satirist Allie Goertz wrote a song about the \"The Simpsons\" character Milhouse, who Matt Groening named after who?", "President Richard Nixon"]
]

def search(query):
    query = query.strip()
    if len(query) == 0:
        return "No query."
    print("Searching", query)

    if query in wikipedia_cache:
        return wikipedia_cache[query]

    # url encode query
    q = quote_plus(query)
    endpoint = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts&titles={q}&exintro=&exsentences=2&explaintext=&redirects=&formatversion=2&format=json"

    # get json from endpoint
    response = urlopen(endpoint)
    data = json.loads(response.read().decode('utf-8'))

    results = data['query']['pages']
    for r in results:
        print(r)
        if "missing" in r.keys() and r["missing"]:
            wikipedia_cache[query] = "No results."
            return "No results"
        wikipedia_cache[query] = r["extract"]
        return wikipedia_cache[query]

    wikipedia_cache[query] = "No results."
    return "No results."

if __name__ == "__main__":
    prompt = ""

    for q,a in questions:
        print("Question: ", q)
        prompt += q + "\n"

        i = 0
        while True:
            i += 1
            
            u = input("> ")
            if u.startswith("search"):
                q = u.split("search ")[1]
                prompt += f"Act {i}: " + "Search" + " \"" + q + "\"\n"
                prompt += f"Obs {i}: " + search(q) + "\n"
            elif u.startswith("finish"):
                prompt += "Act {i}: " + "Finish " + u.split("finish ")[1] + "\n"
                break
            elif u.startswith("think"):
                prompt += f"Tho {i}: " + u.split("think ")[1] + "\n"
            
            print(prompt, end="\n\n\n")

        print(prompt)