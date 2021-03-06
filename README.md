# CyberSaucier

[![Build Status](https://travis-ci.org/DBHeise/CyberSaucier.svg?branch=master)](https://travis-ci.org/DBHeise/CyberSaucier)
[![dependencies Status](https://david-dm.org/DBHeise/CyberSaucier/status.svg)](https://david-dm.org/DBHeise/CyberSaucier)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/DBHeise/CyberSaucier/blob/master/LICENSE)

This is a wrapper around [CyberChef](https://github.com/gchq/CyberChef) to allow for programmatic running of recipes.

How is this different from [CyberChef-server](https://github.com/gchq/CyberChef-server)? At the time of its creation this was the only project that accomplished the goal of allowing programmatic access to CyberChef (CyberChef server was created on 21 Jun 2019, whereas this was created 18 Jan 2019). In addition, this wrapper includes recipies as part of the server (via server-side json files...either static or from a git repo), and a few other helpful features. The fundamental purpose of this service is to run a single input against multiple recipies and see which ones produce "output" (aka juice or sauce).

---
## How do I use it

### Run straight from dockerhub
Cybersaucier is available as a docker image, and on dockerhub: [crazydave42/cybersaucier](https://hub.docker.com/r/crazydave42/cybersaucier)

#### Docker
  
  ```cmd
  docker run --rm -d -p 7000:7000/tcp crazydave42/cybersaucier:latest
  ```

  Cybersaucier is now running and accessable on port 7000, however there are no recipies loaded...so its pretty useless, but you've got an instance of CyberChef, so there's that. A more practical example is to either use volumes to map a folder into the container, as follows:

  ```cmd
  docker run --rm -d -v F:/tmp/recipe:/data/recipe -e CYBERSAUCIER_RecipeFolder=/data/recipe -p 7000:7000/tcp crazydave42/cybersaucier:latest
  ```

  Now Cybersaucier is running and using the recipes on your "F:\tmp\recipe" folder on the docker host (which is mapped into the container at /data/recipe)

  OR, set the git repo and pull from there:
  
  ```cmd
  docker run --rm -d -e CYBERSAUCIER_RecipeGit=https://github.com/DBHeise/CyberChefRecipes.git -p 7000:7000/tcp crazydave42/cybersaucier:latest
  ```

  Now Cybersaucier is running and using the recipes in the specified repo (https://github.com/DBHeise/CyberChefRecipes.git in this case), but it will NOT automatically pull updates, you must add the ```GitInterval``` parameter (which defaults to 0): ```-e CYBERSAUCIER_GitInterval=300000``` (this will set the refresh interval to every 5 minutes).
  
  You can also add the ```RecipeGitSparse``` parameter to only pull part of a repo: ```-e CYBERSAUCIER_RecipeGitSparse=Simplified/*``` (this will only pull the Simplified folder within the repo)

#### Docker Compose

  Like all docker images, you can also run this using docker-compose. Here's an example docker-compose.yml:

```docker-compose
version:    '3'
services:
    cybersaucier:
        image: crazydave42/cybersaucier:latest
        volumes:
            - F:/tmp/recipe:/data/recipe
        ports:
            - 7000:7000
        environment:
            - CYBERSAUCIER_RecipeFolder=/data/recipe
            - CYBERSAUCIER_LogLevel=0
```

### Run locally

You can run Cybersaucier locally using nodejs/npm following these steps:

1. Clone the repo
2. Edit the cybersaucier.json file to your liking
3. Specifically point it to a folder or git repo that contains the recipies you use (see below for more information)
4. Either run it locally or in docker:
   * locally

    ```cmd
    npm start
    ```

    * docker (replace "{mycooltag}" with whatever string you want: see [docker](https://docs.docker.com/engine/reference/commandline/build/#tag-an-image--t) for more info)

    ```cmd
    docker build . -t {mycooltag}
    docker run --rm -d -p 7000:7000/tcp {mycooltag}
    ```

5. The service is now listening locally on TCP port 7000 (unless you changed the port in the config & Dockerfile obviously, then its listening on that port)

**WARNING** you must use a version of node less than v12 and greater than v9 for CyberChef to work correctly! (see CyberChef [wiki](https://github.com/gchq/CyberChef/wiki/Node-API) for more details) I recommend [v11 latest](https://nodejs.org/dist/latest-v11.x/)

---

## How do I add new recipes

Recipes are stored locally in a folder you specify. If using a git repo and setting the ```GitInterval``` parameter Cybersaucier will automatcally pull updates on that interval. If you use a local (not-git) folder, it does not automatically update the recipes...to add a new recipe you have to bounce the service.

---

## Format of a Recipe File

Recipe files are JSON files and are expected to be a single JSON object with a few required properties:

* name - the name of the recipe; used as an identifier
* recipe - the JSON CyberChef Recipe (use the "Save" option in the CyberChef UI to get the "Clean JSON" or "Compact JSON" form of the recipe to use here)
* meta - an extra object that will be included in the CyberChef output object
  * fieldname - a field to add on to the return object (takes the CyberChef output and adds it as a field [with this fieldname] to the output object)

Also you can look at the [testrecipies](https://github.com/DBHeise/CyberSaucier/tree/master/testrecipies) folder for some examples, as well as my repo [CyberChefRecipes](https://github.com/DBHeise/CyberChefRecipes)

---

## API Endpoints

* GET /
  * returns the standard cyberchef webpage (also contained in this repo)
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

## Configuration - cybersaucier.json

* Port
  * port on which this will listen (if you change this, you should also make the same change in the Dockerfile and/or the docker-compose.yml) [Default = 7000]
* ListenIP
  * IP Address on which to listen [Default = 0.0.0.0]
* DefaultFile
  * file to serve when someone does a basic GET
* RecipeFolder
  * local folder to store recipes
* RecipeGit
  * remote git repository where recipes live (can be empty)
* RecipeGitSparse
  * Sparse getting (only pull the specific folder in the repo) (can be empty)
* GitInterval
  * Number of milliseconds to wait between git pulls (if 0 or less automatic git pulls are disabled)
* DisableHttpLogging
  * bool - disables logging of individual HTTP requests
* LogLevel
  * int - level of verbosity (All: 0,Trace: 15,Debug: 33,Info: 50,Warn: 75,Error: 90,Fatal: 100)

It also supports all config parameters as environment variables prepended with "CYBERSAUCIER_"
