import requests, json, argparse

URL = "http://localhost:7000"


parser = argparse.ArgumentParser(description="Process a file through CyberSaucier")
parser.add_argument('--input', help='Input file to process')
args = parser.parse_args()

body = ""
with open(args.input, "r") as inputFile:
    body = inputFile.read()

r = requests.post(url=URL, data=body, headers={'Content-Type':'text/plain'})
data = r.json()

for hit in data:
    if 'result' in hit:
        if hit['result'] != "":
            print(json.dumps(hit, indent=2, sort_keys=True))
