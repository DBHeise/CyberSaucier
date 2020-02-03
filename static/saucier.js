var parent = document.getElementById("save").parentElement;
var testButton = document.createElement('button');
testButton.setAttribute("type", "button");
testButton.classList.add("btn");

testButton.classList.add("btn-primary");
testButton.classList.add("bmd-btn-icon");
testButton.setAttribute("id", "export");
testButton.setAttribute("data-toggle", "tooltip");
testButton.setAttribute("data-orginial-title", "Export recipe");
var i = document.createElement('i');
i.classList.add("material-icons");
i.innerText = "eject";
testButton.appendChild(i);
parent.insertBefore(testButton, parent.childNodes[0]);
testButton.onclick = function() {
    var recipeObj = app.getRecipeConfig()
    var recipeJson = JSON.stringify(recipeObj)
    var base64 = btoa(recipeJson)
    var inputb64 = btoa(document.getElementById("input-text").value)
    var outputb64 = btoa(document.getElementById("output-text").value)
    
    var loc = window.location
    var pathname = loc.pathname.substring(0, loc.pathname.lastIndexOf("/")+1)
    var newUrl = loc.origin + pathname + "test.htm?recipe=" + base64 + "&input=" + inputb64 + "&output=" + outputb64
    window.location = newUrl
}
