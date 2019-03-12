# CyberSaucier
[![Build Status](https://travis-ci.org/DBHeise/CyberSaucier.svg?branch=master)](https://travis-ci.org/DBHeise/CyberSaucier)
[![dependencies Status](https://david-dm.org/DBHeise/CyberSaucier/status.svg)](https://david-dm.org/DBHeise/CyberSaucier)
[![](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/DBHeise/CyberSaucier/blob/master/LICENSE)

This is a wrapper around [CyberChef](https://github.com/gchq/CyberChef) to allow for programmatic running of recipes.

---
## How do I use it
well you've got a couple of options, but I recommend the following:
* Clone the repo
* Edit the cybersaucier.json file to your liking
  * specifically point it to a folder or git repo that contains the recipies you use
* either run it locally or in docker:
  * locally
    ```
    npm start
    ```
  * docker (replace "{mycooltag}" with whatever string you want: see [docker](https://docs.docker.com/engine/reference/commandline/build/#tag-an-image--t) for more info)
    ```
    docker build . -t {mycooltag}
    docker run --rm -d -p 7000:7000/tcp {mycooltag}
    ```
* The service is now listening on http://localhost:7000 (unless you changed the port in the config & Dockerfile, then its listening on that port)

---
## Format of a Recipe File
Recipe files are JSON files and are expected to be a single JSON object with a few required properties:
* name - the name of the recipe; used as an identifier
* recipe - the JSON CyberChef Recipe (use the "Save" option in the CyberChef UI to get the "Clean JSON" or "Compact JSON" form of the recipe to use here)
* meta - an extra object that will be included in the CyberChef output object
  * fieldname - a field to add on to the return object (takes the CyberChef output and adds it as a field [with this fieldname] to the output object)

Also you can look at the [testrecipies](https://github.com/DBHeise/CyberSaucier/tree/master/testrecipies) folder for some examples.

---
## API Endpoints
* GET /
  * returns the standard cyberchef.htm (also contained in this repo)
* POST /?file=&match=
  * takes the POST body and runs all available recipes
  * (optional) file - the recipe filename must contain the given string
  * (optional) match - the recipe name must contain the given string
    * if both file & match are specified then the recipe must match BOTH the given file name and recipe name
* POST /{name}
  * takes the POST body and runs the specified recipe
* GET /recipes
  * retrieves a list of available recipes
* GET /recipes/{name}
  * retrieves the specified recipe's JSON data


---
## Docker image
- available as a docker image, and on dockerhub: [crazydave42/cybersaucier](https://hub.docker.com/r/crazydave42/cybersaucier)

---
## Configuration - cybersaucier.json
* Port
  - port on which this will listen (if you change this, you should also make the same change in the Dockerfile)
* ListenIP
  - IP Address on which to listen
* DefaultFile
  - file to serve when someone does a basic GET
* RecipeFolder
  - local folder to store recipes
* RecipeGit
  - remote git repository where recipes live (can be empty)
* RecipeGitSparse
  - Sparse getting (only pull the specific folder in the repo) (can be empty)
* GitInterval
  - Number of milliseconds to wait between git pulls (if 0 or less automatic git pulls are disabled)
* DisableHttpLogging
  - bool - disables logging of individual HTTP requests
* LogLevel
  - int - level of verbosity (All: 0,Trace: 15,Debug: 33,Info: 50,Warn: 75,Error: 90,Fatal: 100)


It also supports all config parameters as environment variables prepended with "CYBERSAUCIER_"
