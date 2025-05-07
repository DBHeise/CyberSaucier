"use strict";
import cChef from 'cyberchef/src/node/index.mjs'
import should from 'should'
import path from 'path'
import crypto from 'crypto'
import Mocha from 'mocha'
import Service from './service.mjs'
import supertest from 'supertest'
import fs from 'fs'
import {promisify} from 'util'
import commander from 'commander'

const m = new Mocha()
m.timeout(0)
m.slow(5000)

//Taken from: https://gist.github.com/liangzan/807712#gistcomment-2632465
let rmdir = async (dirPath, options = {}) => {
    const
        { removeContentOnly = false, drillDownSymlinks = false } = options,        
        readdirAsync = promisify(fs.readdir),
        unlinkAsync = promisify(fs.unlink),
        rmdirAsync = promisify(fs.rmdir),
        lstatAsync = promisify(fs.lstat) // fs.lstat can detect symlinks, fs.stat can't
    let
        files

    try {
        files = await readdirAsync(dirPath)
    } catch (e) {
        throw new Error(e)
    }

    if (files.length) {
        for (let fileName of files) {
            let
                filePath = path.join(dirPath, fileName),
                fileStat = await lstatAsync(filePath),
                isSymlink = fileStat.isSymbolicLink(),
                isDir = fileStat.isDirectory()

            if (isDir || (isSymlink && drillDownSymlinks)) {
                await rmdir(filePath)
            } else {
                await unlinkAsync(filePath)
            }
        }
    }

    if (!removeContentOnly)
        await rmdirAsync(dirPath)
}

function testOptions() {
    return {
        Port: 4321,
        Listen: "127.0.0.1",
        RecipeFolder: ".\\testrecipies",
        RecipeGit: null,
        RecipeGitSparse: null,
        DisableLogging: true,
        GitInterval: -1
    }
}

////////////////// Cyber Chef Tests
let cyberChefTestSuite = new Mocha.Suite("CyberChef Simple Checks", new Mocha.Context())
cyberChefTestSuite.addTest(new Mocha.Test("simple recipe check", () => {
    //Test #1
    let input = "test"
    let recipe = [{ "op": "To Hex", "args": ["Space"] }]
    let dish = cChef.bake(input, recipe)
    should.exist(dish)
    should(dish.value).be.exactly("74 65 73 74")
    
}))
cyberChefTestSuite.addTest(new Mocha.Test("simple expected failure", () => {
    //Test #2
    let input = "test"
    let failRecipe = [{ "op": "From Hex", "args": ["Space"] }]
    let dish = null
    try {
        dish = cChef.bake(input, failRecipe)        
    } catch (e) {
        should.exist(e)
        should(e.message).be.exactly("Data is not a valid byteArray: [null,null]")
    }    
}))
m.suite.addSuite(cyberChefTestSuite)


////////////////// Internal Tests
let internalTestSuite = new Mocha.Suite("Internal Test Suite", new Mocha.Context())
internalTestSuite.addTest(new Mocha.Test("Service cTor", () => {
    let s = new Service()
    should.exist(s)
    should.exist(s.server)
    should.exist(s.list)
}))
internalTestSuite.addTest(new Mocha.Test("Service cTor with Options", () => {
    (async (s) => {
        should.exist(s)
        should.exist(s.server)
        should.exist(s.list)
    })(new Service(testOptions()))
}))
internalTestSuite.addTest(new Mocha.Test("Service Init", () => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        should.exist(s.list.TestRecipe)
        should.exist(s.list.TestRecipe002)
        should.exist(s.list['Test Recipe 003 - domain - complex'])
        should.exist(s.list['Test Recipe 004 - URL - complex'])
        should.exist(s.list['Email Puller'])
        should.exist(s.list['IPv4 Puller'])
        should.exist(s.list['URL Puller'])
    })(new Service(testOptions()))
}))
internalTestSuite.addTest(new Mocha.Test("Service filterRecipes, no filters", () => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        let ans = s.filterRecipes(s.list, null, null)
        should(ans.length).be.exactly(7)
    })(new Service(testOptions()))
}))
internalTestSuite.addTest(new Mocha.Test("Service filterRecipes, match filter", () => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        let ans = s.filterRecipes(s.list, "URL", null)
        should(ans.length).be.exactly(2)
    })(new Service(testOptions()))
}))
internalTestSuite.addTest(new Mocha.Test("Service filterRecipes, file filter", () => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        let ans = s.filterRecipes(s.list, null, "Find")
        should(ans.length).be.exactly(3)
    })(new Service(testOptions()))
}))
internalTestSuite.addTest(new Mocha.Test("Service filterRecipes, match and file filter", () => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        let ans = s.filterRecipes(s.list, "domain", "complex")
        should(ans.length).be.exactly(1)
    })(new Service(testOptions()))
}))
m.suite.addSuite(internalTestSuite)


////////////////// API Tests
let apiTestSuite = new Mocha.Suite("API Test Suite", new Mocha.Context())
apiTestSuite.addTest(new Mocha.Test("pull recipes", (done) => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        supertest(s.server.listener).get('/recipes').expect(200, function (err, resp) {
            should.not.exist(err)
            should.exist(resp.text)
            should(resp.body.length).be.exactly(7)
            done()
        })
    })(new Service(testOptions()))
}))
apiTestSuite.addTest(new Mocha.Test("pull a specific recipe", (done) => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        supertest(s.server.listener).get('/recipes/TestRecipe').expect(200, function (err, resp) {
            should.not.exist(err)
            should.exist(resp.body)
            resp.body.should.have.value("filename", "001.json")
            resp.body.should.have.value("author", "me")
            resp.body.should.have.value("createdOn", "2019-02-14T00:00:00.000Z")
            resp.body.should.have.value("name", "TestRecipe")
            resp.body.should.have.value("description", "a very simple to hex recipe")
            resp.body.should.have.value("recipe", [{ "op": "To Hex", "args": ["Space"] }])
            done()
        })
    })(new Service(testOptions()))
}))
apiTestSuite.addTest(new Mocha.Test("run all recipes", (done) => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        let input = "test"
        supertest(s.server.listener).post('/').set("Content-Type", "text/plain").send(input).expect(200, function (err, resp) {
            should.not.exist(err)
            should.exist(resp.body)
            should(resp.body.length).be.exactly(7)
            done()
        })
    })(new Service(testOptions()))
}))
apiTestSuite.addTest(new Mocha.Test("run all recipes, match by name", (done) => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        let input = "test"
        supertest(s.server.listener).post('/?match=TestRecipe').set("Content-Type", "text/plain").send(input).expect(200, function (err, resp) {
            should.not.exist(err)
            should.exist(resp.body)
            should(resp.body.length).be.exactly(2)
            should(resp.body[0].result).be.exactly("74 65 73 74")
            done()
        })
    })(new Service(testOptions()))
}))
apiTestSuite.addTest(new Mocha.Test("run all recipes, match by file", (done) => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        let input = "test"
        supertest(s.server.listener).post('/?file=001').set("Content-Type", "text/plain").send(input).expect(200, function (err, resp) {
            should.not.exist(err)
            should.exist(resp.body)
            should(resp.body.length).be.exactly(1)
            should(resp.body[0].result).be.exactly("74 65 73 74")
            done()
        })
    })(new Service(testOptions()))
}))
apiTestSuite.addTest(new Mocha.Test("run all recipes, match by name and file", (done) => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        let input = "foo bar person@example.com baz blah blah blah 02340954"
        supertest(s.server.listener).post('/?file=Find&match=Email').set("Content-Type", "text/plain").send(input).expect(200, function (err, resp) {
            should.not.exist(err)
            should.exist(resp.body)
            should(resp.body.length).be.exactly(1)
            should(resp.body[0]).have.property("result", "person@example.com")
            should(resp.body[0]).have.property("test", "userdefined")
            should(resp.body[0]).have.property("fieldname", "Email")
            done()
        })
    })(new Service(testOptions()))
}))
apiTestSuite.addTest(new Mocha.Test("run a specific recipe, multiple results", (done) => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        let input = "Incididunt 400.500.600.800 Lorem ipsum anim 1.2.3.4 dolor reprehenderit 123.123.123.123 nisi minim eu aliquip laboris."
        supertest(s.server.listener).post('/IPv4%20Puller').set("Content-Type", "text/plain").send(input).expect(200, function (err, resp) {
            should.not.exist(err)
            should.exist(resp.body)
            should(resp.body).have.property("result", "1.2.3.4\n123.123.123.123")
            should(resp.body).have.property("test", "userdefined")
            should(resp.body).have.property("fieldname", "IPv4")
            done()
        })
    })(new Service(testOptions()))
}))
apiTestSuite.addTest(new Mocha.Test("run a specific recipe", (done) => {
    (async (s) => {
        await s.InitGit()
        await s.Init()
        let input = "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"
        supertest(s.server.listener)
            .post('/Test%20Recipe%20003%20-%20domain%20-%20complex')
            .set("Content-Type", "text/plain")
            .send(input)
            .expect(200)
            .end((err, resp) => {
                should.not.exist(err)
                should.exist(resp.body)
                should(resp.body).have.property("result", "foobar.example.com")
                should(resp.body).have.property("something", "user defined")
                should(resp.body).have.property("fieldname", "Found")
                done()
            })
    })(new Service(testOptions()))
}))
m.suite.addSuite(apiTestSuite)

////////////////// Git Tests
let gitTestSuite = new Mocha.Suite("Git Test Suite", new Mocha.Context())
gitTestSuite.addTest(new Mocha.Test("Local Folder", (done) => {
    (async (s) => {
        await s.InitGit()
        should.exist(s.list.TestRecipe)
        should.exist(s.list.TestRecipe002)
        done()
    })(new Service({
        Port: 4321,
        Listen: "127.0.0.1",
        RecipeFolder: ".\\testrecipies",
        RecipeGit: null,
        RecipeGitSparse: null,
        DisableLogging: true,
        GitInterval: -1
    }))
}))
gitTestSuite.addTest(new Mocha.Test("Remote Git Repo", function(done) {
    let config = {
        Port: 4321,
        Listen: "127.0.0.1",
        RecipeFolder: ".\\recipe.git_" + crypto.randomBytes(6).toString('hex'),
        RecipeGit: "https://github.com/DBHeise/Test.git",
        RecipeGitSparse: null,
        DisableLogging: true,
        GitInterval: -1
    };
    this.test.timeout(10000);
    (async (s, cfg) => {
        await s.InitGit()
        should.exist(s.list.TestRecipe001)
        await rmdir(path.resolve(cfg.RecipeFolder))
        done()
    })(new Service(config), config);
}))
gitTestSuite.addTest(new Mocha.Test("Sparse Git Repo", function(done) {
    let config = {
        Port: 4321,
        Listen: "127.0.0.1",
        RecipeFolder: ".\\recipe.git_" + crypto.randomBytes(6).toString('hex'),
        RecipeGit: "https://github.com/DBHeise/Test.git",
        RecipeGitSparse: "CyberSaucier",
        DisableLogging: true,
        GitInterval: -1
    };
    this.test.timeout(10000);
    (async (s, cfg) => {
        await s.InitGit()
        should.exist(s.list.TestRecipe001)

        //Verify the TestFile.bin is NOT there
        let isFileThere = true
        let targetFile = path.join(path.resolve(cfg.RecipeFolder), "TestFile.bin")
        try {
            fs.accessSync(targetFile, fs.constants.R_OK)
        } catch (err) {
            isFileThere = false
        }

        await rmdir(path.resolve(cfg.RecipeFolder))

        should(isFileThere).be.false()

        done()

    })(new Service(config), config);
}))
//TODO: git update - new recipe
//TODO: git update - changed recipe
//TODO: git update - removed recipe
m.suite.addSuite(gitTestSuite)


const program = new commander.Command()
program
    .version("0.0.2")
    .arguments("[test selector]")
    .action(function(testRE) {
    if (testRE) {
        m.grep(testRE).run()
    } else {
        m.run()
    }
})

program.parse(process.argv);

