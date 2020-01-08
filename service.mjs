'use strict';

import fs from 'fs';
const fsPromises = fs.promises;
import path from 'path';
import Hapi from '@hapi/hapi';
import inert from 'inert';
import pino from 'hapi-pino';
import cChef from 'cyberchef/src/node/index';
import git from 'simple-git';
import config from './config';
import logger from './logger';
const log = logger("service")

class Service {
    constructor(options) {        
        log.Trace("cTor Called")
        this.cfg = options || config; 
        var hapiServerCfg = {
            port: this.cfg.Port,
            host: this.cfg.ListenIP,
            routes: {
                files :{
                    relativeTo: path.join(fs.realpathSync('.'), 'static')
                }
            }
        }       
        this.server = new Hapi.server(hapiServerCfg)
        log.Debug("HAPI Config: " + JSON.stringify(hapiServerCfg))
        this.server.self = this
        this.list = {}
        this.fileMap = {}
    }

    async Init() {
        log.Trace("Initializing Service")
        this.server.route({ method: "GET", path:"/", handler: this.handlerGetStaticFile })
        this.server.route({ method: "POST", path: "/", handler: this.handlerAllRecipes })
        this.server.route({ method: "POST", path: "/{name}", handler: this.handlerOneRecipe })
        this.server.route({ method: "GET", path: "/recipes", handler: this.handlerListRecipes })
        this.server.route({ method: "GET", path: "/recipes/{name}", handler: this.handlerListOneRecipe })

        const recipeFolder = path.resolve(this.cfg.RecipeFolder);
        await this.server.register(inert);

        this.server.route({ method: "GET", path: "/{param*}",  handler: {directory: { path: '.', redirectToSlash: true}}})

        if (!(this.cfg.DisableHttpLogging)) {
            await this.server.register(pino);
        }
    }
    async InitGit() {
        log.Trace("Initializing Git")
        const recipeFolder = path.resolve(this.cfg.RecipeFolder);

        if (this.cfg.RecipeGit && this.cfg.RecipeGit.length > 0) {
            if (this.cfg.RecipeGitSparse && this.cfg.RecipeGitSparse.length > 0) {
                await this.setupSparseRepo(recipeFolder, this.cfg.RecipeGit, this.cfg.RecipeGitSparse)
            } else {
                await this.setupFullRepo(recipeFolder, this.cfg.RecipeGit)
            }
        }
        await this.loadRecipes(recipeFolder);
    }

    async Start() {
        log.Trace("Starting Service")
        await this.server.start();
        log.Info(`Server running at: ${this.server.info.uri}`);
    }

    UpdateRecipies(updateBlob) {
        log.Trace("Updating Recipies")
        let self = this
        try {
            const recipeFolder = path.resolve(self.cfg.RecipeFolder);        
            if (updateBlob) {
                let delta = updateBlob.files
                for (let i = 0; i < delta.length; i++) {                
                    self.removeRecipe(path.resolve(recipeFolder, delta[i]))
                }
            }
            self.loadRecipes(recipeFolder)
        } catch (err) {
            log.Error("Error occured while Updating Recipies: " + err);
        }
    }
    //Default Route - static configured file
    handlerGetStaticFile(request, h) {
        let self = request.server.self;
        log.Trace("Serving Static File: " + self.cfg.DefaultFile)
        return h.file(self.cfg.DefaultFile)
    }

    filterRecipes(lst, nameMatch, fileMatch) {
        let ans = []
        for (let field in lst) {
            if (nameMatch || fileMatch) {
                if (nameMatch && fileMatch) {
                    if (field.indexOf(nameMatch) > -1 && lst[field].filename.indexOf(fileMatch) > -1) {
                        if (ans.indexOf(field) == -1) {
                            ans.push(field)
                        }
                    }
                } else {
                    if (field.indexOf(nameMatch) > -1) {
                        if (ans.indexOf(field) == -1) {
                            ans.push(field)
                        }
                    }
                    if (lst[field].filename.indexOf(fileMatch) > -1) {
                        if (ans.indexOf(field) == -1) {
                            ans.push(field)
                        }
                    }
                }
            } else {
                ans.push(field)
            }
        }
        return ans
    }

    handleCChefResults(dish, recipe) {
        let rObj = { 'recipeName': recipe.name }
        if (dish.error || dish.progress < 1) {
            rObj['error'] = dish
        } else {
            rObj['result'] = dish.value

            //Add recipe meta data
            for (const key in recipe["meta"]) {
                if (recipe["meta"].hasOwnProperty(key)) {
                    rObj[key] = recipe["meta"][key];
                }
            }
        }

        return rObj
    }

    runCChefRecipe(input, recipe) {
        let dish = null
        try { 
            dish = cChef.bake(input, recipe.recipe)
        } catch (e) {
            dish = { error: {message: e.message, type: e.type, code: e.code, stack: e.stack.split('\n') }}
        }
        return this.handleCChefResults(dish, recipe)
    }

    //POST - runs the request body as a payload against ALL recipes
    handlerAllRecipes(request, h) {
        let self = request.server.self;
        let matcher = request.query["match"]
        let file = request.query["file"]
        let input = request.payload
        return new Promise((resolve, reject) => {
            let recipes = self.filterRecipes(self.list, matcher, file)
            let ovens = recipes.map((name) => {
                const recipe = self.list[name]
                return self.runCChefRecipe(input, recipe)
            })
            Promise.all(ovens).then((results) => {
                resolve(results);
            })
        })

    }

    //POST - runs the request body against the specified recipe
    handlerOneRecipe(request, h) {
        let self = request.server.self;
        let input = request.payload
        const recipe = self.list[request.params.name];
        if (typeof recipe === "undefined" || recipe === null || recipe === "") {
            let r = h.response('Invalid recipe name');
            r.statusCode = 406;
            return r
        } else {
            return self.runCChefRecipe(input, recipe)
        }
    }

    //Retrieves the list of recipe names
    handlerListRecipes(request, h) {
        let ary = [];
        let self = request.server.self;
        for (let field in self.list) {
            ary.push(field)
        }
        return ary;
    }

    //Retrieves the specified recipe 
    handlerListOneRecipe(request, h) {
        let self = request.server.self;
        let recipe = self.list[request.params.name];
        if (typeof recipe === "undefined" || recipe === null || recipe === "") {
            let r = h.response('Invalid recipe name');
            r.statusCode = 406;
            return r;
        } else {
            return recipe;
        }
    }

    removeRecipe(fullPath) {
        log.Trace("Removing Recipie:" + fullPath);
        let name = this.fileMap[fullPath]
        delete this.list[name];
    }

    loadRecipeFile(fullPath, fileName) {
        log.Trace("Loading Recipe: " + fullPath)
        let content = fs.readFileSync(fullPath);
        let j = JSON.parse(content);
        j.filename = fileName
        j.fullpath = fullPath
        this.list[j.name] = j
        this.fileMap[fullPath] = j.name
    }

    //Read all JSON files from the specified folder (and subfolders)
    async loadRecipes(folder) {
        let self = this
        try {
            const names = fs.readdirSync(folder)
            for (let i = 0; i < names.length; i++) {
                let fullPath = path.join(folder, names[i])
                const f = fs.statSync(fullPath)
                if (f.isDirectory()) {
                    await self.loadRecipes(fullPath).catch(err => {
                        log.Error("Error while loading recipies:" + err)
                    })
                } else {
                    if (names[i].endsWith(".json")) {
                        self.loadRecipeFile(fullPath, names[i])
                    }
                }
            }
        } catch (err) {
            log.Error("Error occured while loading recipies: " + err);
        }
    }


    async setupSparseRepo(localFolder, remoteGit, sparseFolder) {
        try {
            fs.accessSync(localFolder, fs.constants.R_OK);
            log.Info(`Local git folder exists: ${localFolder}`)
        } catch (err) {
            //if the repo does not exist, clone it now
            log.Info(`Setting up sparse checkout locally: ${localFolder}`)
            await git('.').silent(true).clone(remoteGit, localFolder, ["--no-checkout"])
            let g = git(localFolder)
            g.addConfig("core.sparsecheckout", "true")
            fs.writeFileSync(path.join(localFolder, ".git/info/sparse-checkout"), sparseFolder)
        }

        log.Info(`Checkingout Latest`)
        await git(localFolder).silent(true).checkout("--")
    }

    async setupFullRepo(localFolder, remoteGit) {
        try {
            fs.accessSync(localFolder, fs.constants.R_OK);
            log.Info(`Local git folder exists: ${localFolder}`)
        } catch (err) {
            //if the repo does not exist, clone it now
            log.Info(`Cloning repo locally: ${localFolder}`)
            await git('.').silent(true).clone(remoteGit, localFolder);
        }

        log.Info(`Pulling Latest`)
        await git(localFolder).silent(true).pull()
    }

}




export default Service