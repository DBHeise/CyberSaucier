import requests, json, argparse, os
from termcolor import colored

parser = argparse.ArgumentParser(description="Verify the recipes by running them through CyberSaucier")
parser.add_argument('--rulefolder', help='Folder containing the json recipes')
parser.add_argument("--url", help="URL to CyberSaucier", default="http://localhost:7000")
args = parser.parse_args()


for root, dirs, files in os.walk(args.rulefolder):
    path = root.split(os.sep)
    for fname in files:
        if fname.lower().endswith("json"):
            file = os.path.join(root, fname)
            with open(file, 'r') as f:
                data=f.read()
            rule = json.loads(data)

            if "verify" in rule:
                u = args.url + "/" + rule["name"]
                resp = requests.post(url=u, data=rule["verify"]["originalInput"], headers={'Content-Type':'text/plain'})
                resp = resp.json()                
                if resp["result"] == rule["verify"]["expectedOutput"]:
                    print(colored(rule["name"] + " : PASS", "green"))
                else:
                    print(colored(rule["name"] + " : FAIL", "red"))
