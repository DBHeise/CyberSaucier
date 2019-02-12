"use strict";
import cChef from 'cyberchef/src/node/index';
import should from 'should'

//Test #1
let input = "test"
let recipe = [{ "op": "To Hex", "args": ["Space"] }]
cChef.bake(input, recipe).then(result => {
    should.exist(result)
    should(result.result).be.exactly("74 65 73 74")
}).catch(reason => {
    should.not.exist(reason)
})


//Test #2
let failRecipe =  [{ "op": "From Hex", "args": ["Space"] }]
cChef.bake(input, failRecipe).then(result => {
    should.not.exist(result)
}).catch(reason => {
    should.exist(reason)
    should(reason.message).be.exactly("Data is not a valid byteArray: [null,null]")
})



