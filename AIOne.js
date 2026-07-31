

function AIOne() {

}

function onLoad() {
    var inputForm = document.getElementById("message-form");
    inputForm.onsubmit = function(ev) {
        ev.preventDefault();

        console.log("Sending message...");
    };
}

window.addEventListener("load", onLoad, false);