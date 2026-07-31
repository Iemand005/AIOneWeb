

function AIOne() {

}

function onLoad() {
    var inputForm = document.getElementById("message-form");
    inputForm.onsubmit = function(ev) { ev.preventDefault(); };
}

window.addEventListener("load", onLoad, false);