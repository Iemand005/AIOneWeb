

function AIOne() {
    this.baseUrl = "https://api.groq.com/openai/v1";
    this.apiKey = "";
}

function onLoad() {
    var apiForm = document.getElementById("api-form");

    var inputForm = document.getElementById("message-form");
    inputForm.onsubmit = function(ev) {
        ev.preventDefault();

        console.log("Sending message...");
    };
}

window.addEventListener("load", onLoad, false);